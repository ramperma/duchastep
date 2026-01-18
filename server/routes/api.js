const express = require('express');
const router = express.Router();
const db = require('../db');
const { geocodeAddress, isPostalCode } = require('../services/geocoding');
const mapsService = require('../services/maps');
const placesService = require('../services/places');
const routesService = require('../services/routes');
const { filterTopN } = require('../services/haversine');

// Health check
router.get('/status', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Search endpoint - Enhanced to support addresses and return TOP 3 commercials
router.post('/search', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        let cleanQuery = query.trim();
        let originalAddress = null;
        let geocodedData = null;

        // Detect if input is CP or address
        if (isPostalCode(cleanQuery)) {
            cleanQuery = cleanQuery.padStart(5, '0');
            console.log(`🔎 Buscando CP: ${cleanQuery}`);
        } else {
            // It's an address - geocode it
            console.log(`🔎 Buscando dirección: ${cleanQuery}`);
            originalAddress = cleanQuery;
            geocodedData = await geocodeAddress(cleanQuery);

            if (!geocodedData || !geocodedData.postalCode) {
                return res.status(400).json({
                    error: 'No se pudo encontrar la dirección. Por favor, incluya el código postal o una dirección más específica.'
                });
            }

            cleanQuery = geocodedData.postalCode.padStart(5, '0');
            console.log(`📍 Dirección geocodificada -> CP: ${cleanQuery}`);
        }

        // Fetch DB Settings
        let centralMaxMinutes = 100;
        let conflictThreshold = 5; // Minutes difference to trigger recalculation
        let searchResultsCount = 3;
        let closeThresholdMinutes = 15;

        const settingsRes = await db.query(
            "SELECT key, value FROM settings WHERE key IN ('central_max_minutes', 'conflict_threshold_minutes', 'search_results_count', 'close_threshold_minutes')"
        );
        settingsRes.rows.forEach(row => {
            if (row.key === 'central_max_minutes') centralMaxMinutes = parseInt(row.value) || 100;
            if (row.key === 'conflict_threshold_minutes') conflictThreshold = parseInt(row.value) || 5;
            if (row.key === 'search_results_count') searchResultsCount = parseInt(row.value) || 3;
            if (row.key === 'close_threshold_minutes') closeThresholdMinutes = parseInt(row.value) || 15;
        });

        // Fetch Zip Data
        const zipRes = await db.query("SELECT * FROM zip_codes WHERE code = $1", [cleanQuery]);

        if (zipRes.rows.length === 0) {
            return res.json({
                viable: false,
                message: "CP desconocido en base de datos. Por favor, añádalo al sistema.",
                results: []
            });
        }

        const zipData = zipRes.rows[0];

        if (zipData.min_to_central === null) {
            return res.json({
                viable: false,
                message: "Datos pendientes de cálculo. Consulte con administración.",
                results: []
            });
        }

        const centralTimeMin = zipData.min_to_central;
        console.log(`⏱️ Tiempo a central (DB): ${centralTimeMin} min (Límite: ${centralMaxMinutes})`);

        // Check central viability
        if (centralTimeMin > centralMaxMinutes) {
            return res.json({
                viable: false,
                message: `NO VIABLE. Lejos de central (${centralTimeMin} min > ${centralMaxMinutes} min).`,
                results: []
            });
        }

        // Fetch TOP X commercials from cache
        const cacheRes = await db.query(`
            SELECT rc.*, c.name, c.city as c_city, c.address as c_address, c.lat as c_lat, c.lng as c_lng
            FROM routes_cache rc
            JOIN commercials c ON rc.commercial_id = c.id
            WHERE rc.origin_zip = $1 AND rc.duration_min <= 30 AND c.active = true
            ORDER BY rc.duration_min ASC, CAST(rc.distance_km AS DECIMAL) ASC
            LIMIT $2
        `, [cleanQuery, searchResultsCount]);

        if (cacheRes.rows.length === 0) {
            return res.json({
                viable: false,
                message: 'NO VIABLE. Sin comercial asignado o en rango (Verifique precálculo).',
                results: []
            });
        }

        let commercials = cacheRes.rows;
        let usedPrecision = false;

        // Check for conflict (difference between 1st and 2nd < threshold)
        if (originalAddress && commercials.length >= 2) {
            const diff = commercials[1].duration_min - commercials[0].duration_min;

            if (diff <= conflictThreshold) {
                console.log(`⚠️ Conflicto detectado: Diferencia ${diff} min <= ${conflictThreshold} min. Recalculando con precisión...`);

                // Recalculate using exact address via Distance Matrix
                try {
                    const destinations = commercials.map(c => `${c.c_lat},${c.c_lng}`);
                    const preciseRoutes = await mapsService.getDistanceMatrix(
                        `${geocodedData.lat},${geocodedData.lng}`,
                        destinations
                    );

                    if (preciseRoutes && preciseRoutes.length === commercials.length) {
                        // Update commercials with precise data
                        commercials = commercials.map((c, i) => ({
                            ...c,
                            duration_min: preciseRoutes[i].duration_min,
                            distance_km: preciseRoutes[i].distance_km,
                            precise: true
                        }));

                        // Re-sort by new duration
                        commercials.sort((a, b) => a.duration_min - b.duration_min || a.distance_km - b.distance_km);
                        usedPrecision = true;
                        console.log(`✅ Rutas recalculadas con precisión`);
                    }
                } catch (err) {
                    console.error('Error recalculando rutas precisas:', err.message);
                    // Fall back to cached routes
                }
            }
        }

        // Build results with ranking
        const results = commercials.map((c, index) => ({
            id: c.commercial_id,
            name: c.name,
            distance_km: parseFloat(c.distance_km),
            duration_min: c.duration_min,
            commercial_city: c.c_city,
            rank: index + 1,
            precise: c.precise || false
        }));

        const bestCommercial = results[0];
        let message = `✅ CLIENTE VIABLE (Distancia: ${centralTimeMin} min / Máx: ${centralMaxMinutes} min)`;
        message += ` - Atiende: ${bestCommercial.name} (a ${bestCommercial.duration_min} min)`;
        if (usedPrecision) message += ' [Precisión extra]';

        res.json({
            viable: true,
            message: message,
            results: results,
            closeThresholdMinutes,
            debug_time: centralTimeMin,
            geocoded: geocodedData ? {
                address: geocodedData.formattedAddress,
                postalCode: geocodedData.postalCode
            } : null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Commercials Management (CRUD) ---

// GET all commercials
router.get('/commercials', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM commercials ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching commercials' });
    }
});

// POST new commercial
router.post('/commercials', async (req, res) => {
    const { name, address, zip_code, city, google_calendar_id } = req.body;

    try {
        // Automatic geocoding
        let lat = null;
        let lng = null;
        const fullAddress = `${address}, ${zip_code} ${city}, Spain`;
        console.log(`🌍 Geocodificando nuevo comercial: ${fullAddress}`);

        const geoData = await geocodeAddress(fullAddress);
        if (geoData) {
            lat = geoData.lat;
            lng = geoData.lng;
            console.log(`📍 Coordenadas obtenidas: ${lat}, ${lng}`);
        } else {
            console.log(`⚠️ No se pudo geocodificar la dirección: ${fullAddress}`);
        }

        const result = await db.query(
            'INSERT INTO commercials (name, address, zip_code, city, google_calendar_id, lat, lng, active) VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *',
            [name, address, zip_code, city, google_calendar_id, lat, lng]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating commercial' });
    }
});

// PUT update commercial (details or active status)
router.put('/commercials/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, zip_code, city, active, google_calendar_id } = req.body;

    try {
        let result;

        // If 'name' is present, we assume it's a full detail update
        if (name) {
            // Automatic geocoding on update
            let lat = null;
            let lng = null;
            const fullAddress = `${address}, ${zip_code} ${city}, Spain`;
            console.log(`🌍 Geocodificando comercial editado: ${fullAddress}`);

            const geoData = await geocodeAddress(fullAddress);
            if (geoData) {
                lat = geoData.lat;
                lng = geoData.lng;
                console.log(`📍 Coordenadas actualizadas: ${lat}, ${lng}`);
            }

            result = await db.query(
                `UPDATE commercials 
                 SET name = $1, address = $2, zip_code = $3, city = $4, google_calendar_id = $5, lat = $6, lng = $7
                 WHERE id = $8 RETURNING *`,
                [name, address, zip_code, city, google_calendar_id, lat, lng, id]
            );
        }
        // If only 'active' is present (and no name), treat as toggle
        else if (active !== undefined) {
            result = await db.query(
                'UPDATE commercials SET active = $1 WHERE id = $2 RETURNING *',
                [active, id]
            );
        } else {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating commercial' });
    }
});

// POST trigger precalc for specific commercial
router.post('/commercials/:id/precalc', async (req, res) => {
    const { id } = req.params;
    const { runCommercialPrecalculation } = require('../services/precalc');

    try {
        // Run synchronously/blocking for simplicity on this button, or async if preferred.
        // Let's await it so the UI shows "loading" until done.
        const result = await runCommercialPrecalculation(id);

        if (result.success) {
            res.json({ message: 'Precálculo finalizado', count: result.count });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error intializing precalc' });
    }
});

// DELETE commercial
router.delete('/commercials/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Unassign from commercial references (zip_codes)
        await db.query('UPDATE zip_codes SET assigned_commercial_id = NULL WHERE assigned_commercial_id = $1', [id]);

        // 2. Delete related cache entries
        await db.query('DELETE FROM routes_cache WHERE commercial_id = $1', [id]);

        // 3. Delete commercial
        await db.query('DELETE FROM commercials WHERE id = $1', [id]);

        res.json({ message: 'Commercial deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting commercial' });
    }
});


// --- Users & Roles Management ---

// GET all roles
router.get('/roles', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM roles ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching roles' });
    }
});

// POST new role
router.post('/roles', async (req, res) => {
    const { name, permissions } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING *',
            [name, JSON.stringify(permissions || [])]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating role' });
    }
});

// PUT update role
router.put('/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;
    try {
        const result = await db.query(
            'UPDATE roles SET name = $1, permissions = $2 WHERE id = $3 RETURNING *',
            [name, JSON.stringify(permissions), id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating role' });
    }
});

// GET all users
router.get('/users', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.created_at, r.name as role_name, r.id as role_id 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            ORDER BY u.username ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// POST new user
router.post('/users', async (req, res) => {
    const { username, password, role_id } = req.body;
    const bcrypt = require('bcryptjs'); // Require here or top level

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id, username, role_id',
            [username, hash, role_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// PUT update user
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, role_id, password } = req.body;
    const bcrypt = require('bcryptjs');

    try {
        let query = 'UPDATE users SET username = $1, role_id = $2';
        let params = [username, role_id];
        let paramIdx = 3;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            query += `, password_hash = $${paramIdx}`;
            params.push(hash);
            paramIdx++;
        }

        query += ` WHERE id = $${paramIdx} RETURNING id, username, role_id`;
        params.push(id);

        const result = await db.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating user' });
    }
});

// DELETE user
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting user' });
    }
});


// --- Zip Codes Management ---

// GET zips (with search)
router.get('/zips', async (req, res) => {
    const { search, page = 1, limit = 50, sortBy = 'code', order = 'ASC' } = req.query;

    // Validate sort fields to prevent SQL injection
    const allowedSortFields = ['code', 'city', 'viable'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'code';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const offset = (page - 1) * limit;

    try {
        let query = 'SELECT * FROM zip_codes';
        let countQuery = 'SELECT COUNT(*) FROM zip_codes';
        let params = [];
        let countParams = [];

        if (search) {
            const whereClause = ' WHERE code LIKE $1 OR city ILIKE $1';
            query += whereClause;
            countQuery += whereClause;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        query += ` ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const [result, countResult] = await Promise.all([
            db.query(query, params),
            db.query(countQuery, countParams)
        ]);

        res.json({
            data: result.rows,
            total: parseInt(countResult.rows[0].count)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching zips' });
    }
});

// POST new zip
router.post('/zips', async (req, res) => {
    const { code, city } = req.body;
    const { runZipPrecalculation } = require('../services/precalc');

    try {
        const result = await db.query(
            'INSERT INTO zip_codes (code, city, viable) VALUES ($1, $2, true) ON CONFLICT (code) DO NOTHING RETURNING *',
            [code, city]
        );

        let data = result.rows[0];
        let message = 'CP creado correctamente';

        // Helper if it already existed
        if (!data) {
            const existing = await db.query('SELECT * FROM zip_codes WHERE code = $1', [code]);
            data = existing.rows[0];
            message = 'CP ya existía';
        }

        // Trigger Auto-Precalc (Async or Sync? Sync for now to confirm)
        // Only if it was created or we want to force updates.
        // User requested: "una vez creado... debe solicitar el precálculo"
        // We act proactively.

        if (data) {
            // We can run this in background or await. Let's await.
            const precalcRes = await runZipPrecalculation(data.code);
            if (precalcRes.success) {
                message += `. Precálculo: ${precalcRes.count} rutas.`;
            }
        }

        res.json({ ...data, message });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating zip' });
    }
});

// PUT update zip (toggle viable)
router.put('/zips/:code', async (req, res) => {
    const { code } = req.params;
    const { viable } = req.body;
    try {
        const result = await db.query(
            'UPDATE zip_codes SET viable = $1 WHERE code = $2 RETURNING *',
            [viable, code]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating zip' });
    }
});

// POST precalc for specific zip
router.post('/zips/:code/precalc', async (req, res) => {
    const { code } = req.params;
    const { runZipPrecalculation } = require('../services/precalc');

    try {
        const result = await runZipPrecalculation(code);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error in zip precalc' });
    }
});

// --- Calendar / Appointments ---

// GET /appointments - List for Calendar View
router.get('/appointments', async (req, res) => {
    const { listEvents } = require('../services/calendar');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';

    // 1. Verify Token (Simple Middleware logic here for speed)
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        const role = decoded.role;

        let commercialEmail = null;
        let isAdmin = (role === 'admin');

        // 2. If not admin, get the linked commercial email
        if (!isAdmin) {
            // Need to fetch user's linked commercial_id
            const userRes = await db.query(`
                SELECT c.google_calendar_id 
                FROM users u 
                JOIN commercials c ON u.commercial_id = c.id 
                WHERE u.id = $1
            `, [userId]);

            if (userRes.rows.length > 0) {
                commercialEmail = userRes.rows[0].google_calendar_id;
            } else {
                // User is not admin and not linked to a commercial? 
                // Return empty or error? Let's return empty events.
                return res.json([]);
            }
        }

        // 3. Fetch Events
        const events = await listEvents(isAdmin, commercialEmail);
        res.json(events);

    } catch (err) {
        console.error('Error in /appointments:', err.message);

        // Distinguish between JWT token errors and Google Calendar API errors
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }

        // For Google API errors or other issues, return 500 (not 401)
        // This prevents the frontend from logging out the user
        res.status(500).json({
            error: 'Error al obtener eventos del calendario. Verifique la configuración de Google Calendar.',
            details: err.message
        });
    }
});

router.post('/appointments', async (req, res) => {
    const { commercial_id, client_data, appointment_date } = req.body;
    const { createAppointment } = require('../services/calendar');

    if (!commercial_id || !client_data || !appointment_date) {
        return res.status(400).json({ error: 'Faltan datos requeridos (commercial_id, client_data, appointment_date)' });
    }

    console.log('📥 [API] Creando cita. Datos Cliente:', JSON.stringify(client_data, null, 2));

    try {
        // client_data now expected to contain address and observations inside or merged
        // But the previous signature was (commercialId, clientData, appointmentDate)
        // Let's assume client_data comes with new fields from frontend
        const result = await createAppointment(commercial_id, client_data, appointment_date);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// NUEVOS ENDPOINTS - Sistema de Rutas en Tiempo Real
// =====================================================

// POST /autocomplete - Sugerencias de direcciones (Places API New)
router.post('/autocomplete', async (req, res) => {
    const { input, sessionToken } = req.body;

    if (!input || !sessionToken) {
        return res.status(400).json({ error: 'Faltan input o sessionToken' });
    }

    // Contar solo caracteres alfanuméricos
    const alphanumCount = (input.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphanumCount < 5) {
        return res.json({ suggestions: [], message: 'Escribe al menos 5 caracteres' });
    }

    console.log(`🔍 [Autocomplete] Input: "${input}" (${alphanumCount} chars)`);

    const result = await placesService.autocomplete(input, sessionToken);

    if (result.error) {
        return res.status(500).json({ error: result.error });
    }

    res.json(result);
});

// POST /place-details - Obtener coordenadas de lugar seleccionado
router.post('/place-details', async (req, res) => {
    const { placeId, sessionToken } = req.body;

    if (!placeId) {
        return res.status(400).json({ error: 'Falta placeId' });
    }

    console.log(`📍 [PlaceDetails] PlaceId: ${placeId}`);

    const details = await placesService.getPlaceDetails(placeId, sessionToken);

    if (!details) {
        return res.status(500).json({ error: 'No se pudieron obtener los detalles del lugar' });
    }

    res.json(details);
});

// POST /ranking - Calcular TOP comerciales con Haversine + Routes API
router.post('/ranking', async (req, res) => {
    const { lat, lng, formattedAddress } = req.body;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Faltan coordenadas (lat, lng)' });
    }

    console.log(`🏆 [Ranking] Calculando para: ${formattedAddress || `${lat},${lng}`}`);

    try {
        // 1. Obtener configuración
        let centralMaxMinutes = 100;
        let searchResultsCount = 5;
        let closeThresholdMinutes = 15;

        const settingsRes = await db.query(
            "SELECT key, value FROM settings WHERE key IN ('central_max_minutes', 'search_results_count', 'close_threshold_minutes')"
        );
        settingsRes.rows.forEach(row => {
            if (row.key === 'central_max_minutes') centralMaxMinutes = parseInt(row.value) || 100;
            if (row.key === 'search_results_count') searchResultsCount = parseInt(row.value) || 5;
            if (row.key === 'close_threshold_minutes') closeThresholdMinutes = parseInt(row.value) || 15;
        });

        // 2. Obtener sede (central)
        const centralRes = await db.query("SELECT value FROM settings WHERE key = 'central_coords'");
        let centralCoords = null;
        if (centralRes.rows.length > 0 && centralRes.rows[0].value) {
            try {
                centralCoords = JSON.parse(centralRes.rows[0].value);
            } catch (e) {
                console.log('⚠️ No hay coordenadas de central configuradas');
            }
        }

        // 3. Obtener comerciales activos con coordenadas
        const commercialsRes = await db.query(
            'SELECT id, name, city, lat, lng FROM commercials WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL'
        );
        const allCommercials = commercialsRes.rows;

        if (allCommercials.length === 0) {
            return res.json({
                viable: false,
                message: 'No hay comerciales activos con coordenadas',
                results: []
            });
        }

        // 4. Pre-filtrar con Haversine (TOP N más cercanos en línea recta)
        const destination = { lat: parseFloat(lat), lng: parseFloat(lng) };
        const topCommercials = filterTopN(destination, allCommercials, searchResultsCount);

        console.log(`📊 [Haversine] Filtrados ${topCommercials.length} de ${allCommercials.length} comerciales`);

        // 5. Preparar orígenes para Routes API (comerciales + sede si existe)
        const originsForRoutes = topCommercials.map(c => ({
            id: c.id,
            name: c.name,
            city: c.city,
            lat: c.lat,
            lng: c.lng,
            type: 'commercial'
        }));

        if (centralCoords && centralCoords.lat && centralCoords.lng) {
            originsForRoutes.push({
                id: 0,
                name: 'DUCHASTEP (Sede)',
                city: 'Valencia',
                lat: centralCoords.lat,
                lng: centralCoords.lng,
                type: 'headquarters'
            });
        }

        // 6. Llamar a Routes API
        const routeResults = await routesService.computeRouteMatrix(originsForRoutes, destination);

        if (!routeResults || routeResults.length === 0) {
            // Fallback: devolver resultados de Haversine sin tiempos reales
            console.log('⚠️ Routes API falló, usando estimación Haversine');
            const fallbackResults = topCommercials.map((c, i) => ({
                id: c.id,
                name: c.name,
                commercial_city: c.city,
                distance_km: c.haversineKm.toFixed(2),
                duration_min: Math.round(c.haversineKm * 1.5), // Estimación: 1.5 min/km
                rank: i + 1,
                precise: false
            }));

            return res.json({
                viable: true,
                message: '⚠️ Usando estimación (Routes API no disponible)',
                results: fallbackResults,
                closeThresholdMinutes
            });
        }

        // 7. Filtrar solo comerciales (excluir sede del ranking visible pero usar para viabilidad)
        const sedeResult = routeResults.find(r => r.type === 'headquarters');
        const commercialResults = routeResults.filter(r => r.type === 'commercial');

        // Verificar viabilidad por tiempo a sede
        let viabilityMessage = '';
        if (sedeResult) {
            const timeToHQ = sedeResult.durationMin;
            if (timeToHQ > centralMaxMinutes) {
                return res.json({
                    viable: false,
                    message: `❌ NO VIABLE. Lejos de central (${timeToHQ} min > ${centralMaxMinutes} min).`,
                    results: []
                });
            }
            viabilityMessage = `(Distancia a central: ${timeToHQ} min)`;
        }

        // 8. Formatear resultados
        const results = commercialResults.slice(0, searchResultsCount).map((r, i) => ({
            id: r.id,
            name: r.name,
            commercial_city: r.city,
            distance_km: parseFloat(r.distanceKm) || 0,
            duration_min: r.durationMin,
            rank: i + 1,
            precise: true
        }));

        const bestCommercial = results[0];
        let message = `✅ CLIENTE VIABLE ${viabilityMessage}`;
        if (bestCommercial) {
            message += ` - Atiende: ${bestCommercial.name} (a ${bestCommercial.duration_min} min)`;
        }

        res.json({
            viable: true,
            message,
            results,
            closeThresholdMinutes,
            geocoded: {
                address: formattedAddress,
                lat,
                lng
            }
        });

    } catch (err) {
        console.error('❌ Error en /ranking:', err);
        res.status(500).json({ error: 'Error interno al calcular ranking' });
    }
});

module.exports = router;


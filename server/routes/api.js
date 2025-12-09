const express = require('express');
const router = express.Router();
const db = require('../db');

// Health check
router.get('/status', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Search endpoint
router.post('/search', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        // Pad to ensure 5 digits if user enters 3 or 4
        const cleanQuery = query.trim().padStart(5, '0');

        console.log(`🔎 Buscando CP: ${cleanQuery}`);

        // Direct lookup using the imported Excel logic
        const queryRes = await db.query(`
            SELECT z.*, c.name as commercial_name 
            FROM zip_codes z
            LEFT JOIN commercials c ON z.assigned_commercial_id = c.id
            WHERE z.code = $1
        `, [cleanQuery]);

        if (queryRes.rows.length === 0) {
            return res.status(404).json({ error: 'Código Postal no encontrado en la base de datos.' });
        }

        const data = queryRes.rows[0];
        let message = ''; // Initialize message
        const results = []; // Initialize results array

        // 1. Verificación CENTRAL (Strict DB Check)
        let centralTimeMin = null;
        let centralCheckPassed = false;
        let centralMaxMinutes = 100;

        try {
            // Fetch DB Settings
            const settingsRes = await db.query("SELECT key, value FROM settings WHERE key IN ('central_max_minutes')");
            settingsRes.rows.forEach(row => {
                if (row.key === 'central_max_minutes') centralMaxMinutes = parseInt(row.value) || 100;
            });

            // Fetch Zip Data directly
            const zipRes = await db.query("SELECT * FROM zip_codes WHERE code = $1", [cleanQuery]);

            if (zipRes.rows.length === 0) {
                // Unknown CP - we do not lookup
                res.json({
                    viable: false,
                    message: "CP desconocido en base de datos. Por favor, añádalo al sistema."
                });
                db.query('INSERT INTO search_history (query, ip, result, user_agent) VALUES ($1, $2, $3, $4)', [cleanQuery, req.ip, "UNKNOWN_CP", req.headers['user-agent']]).catch(console.error);
                return;
            }

            const zipData = zipRes.rows[0];

            if (zipData.min_to_central === null) {
                res.json({
                    viable: false,
                    message: "Datos pendientes de cálculo. Consulte con administración."
                });
                db.query('INSERT INTO search_history (query, ip, result, user_agent) VALUES ($1, $2, $3, $4)', [cleanQuery, req.ip, "PENDING_CALC", req.headers['user-agent']]).catch(console.error);
                return;
            }

            centralTimeMin = zipData.min_to_central;

            // Use the pre-calculated viable flag OR re-check?
            // User wants "Busco en la bbdd ... sigo adelante".
            // Since we update viability on settings change, zipData.viable SHOULD be correct.
            // But let's double check vs logical limit just to be safe/consistent with display.

            console.log(`⏱️ Tiempo a central (DB): ${centralTimeMin} min (Límite: ${centralMaxMinutes})`);

            if (centralTimeMin <= centralMaxMinutes) {
                // Double check viable flag consistency?
                // if (!zipData.viable) { ... } -> Might happen if limit changed but didn't save?
                // We'll trust the logic: logic says viable.
                centralCheckPassed = true;
            } else {
                message = `NO VIABLE. Lejos de central (${centralTimeMin} min > ${centralMaxMinutes} min).`;
            }

        } catch (err) {
            console.error('Error DB Search:', err);
            res.status(500).json({ error: 'Error interno' });
            return;
        }

        // 2. Verificación COMERCIALES (Strict Cache Check)
        let commercialCheckPassed = false;
        let bestCommercial = null;

        if (centralCheckPassed) {
            // Consultar SOLO la caché
            const cacheRes = await db.query(`
                SELECT rc.*, c.name, c.city as c_city 
                FROM routes_cache rc
                JOIN commercials c ON rc.commercial_id = c.id
                WHERE rc.origin_zip = $1 AND rc.duration_min <= 30 AND c.active = true
                ORDER BY rc.duration_min ASC, CAST(rc.distance_km AS DECIMAL) ASC
                LIMIT 1
             `, [cleanQuery]);

            if (cacheRes.rows.length > 0) {
                commercialCheckPassed = true;
                bestCommercial = cacheRes.rows[0];
            } else {
                message = 'NO VIABLE. Sin comercial asignado o en rango (Verifique precálculo).';
            }
        }

        // Construir Respuesta Final
        if (centralCheckPassed && commercialCheckPassed) {
            data.viable = true;
            message = `✅ CLIENTE VIABLE`;
            if (centralTimeMin) message += ` (Distancia: ${centralTimeMin} min / Máx: ${centralMaxMinutes} min)`;

            if (bestCommercial) {
                results.push({
                    id: bestCommercial.commercial_id,
                    name: bestCommercial.name,
                    distance_km: parseFloat(bestCommercial.distance_km),
                    duration_min: bestCommercial.duration_min,
                    commercial_city: bestCommercial.c_city
                });
                message += ` - Atiende: ${bestCommercial.name} (a ${bestCommercial.duration_min} min)`;
            }
        } else {
            data.viable = false;
            if (!message.includes('NO VIABLE')) message = 'NO VIABLE. Criterios no cumplidos.';
        }

        res.json({
            viable: data.viable,
            message: message,
            results: results,
            debug_time: centralTimeMin
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
        const result = await db.query(
            'INSERT INTO commercials (name, address, zip_code, city, google_calendar_id, active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *',
            [name, address, zip_code, city, google_calendar_id]
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
            result = await db.query(
                `UPDATE commercials 
                 SET name = $1, address = $2, zip_code = $3, city = $4, google_calendar_id = $5
                 WHERE id = $6 RETURNING *`,
                [name, address, zip_code, city, google_calendar_id, id]
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
        console.error(err);
        res.status(401).json({ error: 'Invalid token or error fetching events' });
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

module.exports = router;

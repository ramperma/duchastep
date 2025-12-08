const db = require('../db');
const maps = require('./maps');

// --- Helper: Calculate time from Central to Zips (Smart Cache) ---
// Only calculates for zips that don't have min_to_central set
const calculateCentralToZips = async (zips, onProgress) => {
    console.log('🏢 [Central] Verificando tiempos a central...');

    // 1. Get Central Address
    const settingsRes = await db.query("SELECT value FROM settings WHERE key = 'central_address'");
    if (settingsRes.rows.length === 0 || !settingsRes.rows[0].value) {
        console.log('⚠️ [Central] No hay dirección central configurada. Saltando.');
        return;
    }
    const centralAddress = settingsRes.rows[0].value;

    // 2. Filter Zips that need calculation (min_to_central IS NULL)
    // Note: 'zips' arg might be full list. We check property or DB?
    // Doing it in memory if passed zips have 'min_to_central' field, but safest is to rely on what was passed or passed as "to process".
    // For safety, let's assume the caller passes ALL zips, and we filter here by checking the object property.
    // Ensure the caller SELECT * FROM zip_codes.
    const zipsToProcess = zips.filter(z => z.min_to_central === null || z.min_to_central === undefined);

    if (zipsToProcess.length === 0) {
        console.log('✅ [Central] Todos los CPs ya tienen tiempo calculado. Saltando API.');
        return;
    }

    console.log(`ℹ️[Central] Calculando ${zipsToProcess.length} CPs pendientes...`);

    const BATCH_SIZE = 25;
    let processed = 0;

    // Notify start of this phase
    if (onProgress) onProgress(0, zipsToProcess.length);

    for (let i = 0; i < zipsToProcess.length; i += BATCH_SIZE) {
        const batch = zipsToProcess.slice(i, i + BATCH_SIZE);
        const destinations = batch.map(z => z.lat && z.lng ? `${z.lat},${z.lng} ` : `${z.code}, Spain`);

        try {
            const matrix = await maps.getDistances([centralAddress], destinations);

            if (matrix && matrix[0] && matrix[0].elements) {
                const results = matrix[0].elements;

                for (let j = 0; j < results.length; j++) {
                    const result = results[j];
                    const zip = batch[j];

                    if (result.status === 'OK') {
                        const durationMin = Math.floor(result.duration.value / 60);
                        await db.query(`UPDATE zip_codes SET min_to_central = $1 WHERE code = $2`, [durationMin, zip.code]);
                    }
                }
            }
        } catch (err) {
            console.error('❌ [Central] Error batch:', err.message);
        }

        processed += batch.length;
        if (onProgress) onProgress(processed, zipsToProcess.length);
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('✅ [Central] Calculados y guardados.');
};

// --- Helper: Update Viability Globally ---
const updateViability = async () => {
    console.log('🔄 [Viabilidad] Actualizando flags globales...');
    const resSettings = await db.query("SELECT value FROM settings WHERE key = 'central_max_minutes'");
    const limit = parseInt(resSettings.rows[0]?.value) || 100;

    const res = await db.query(`
        UPDATE zip_codes 
        SET viable = (min_to_central <= $1) 
        WHERE min_to_central IS NOT NULL
    `, [limit]);
    console.log(`✅[Viabilidad] Actualizados ${res.rowCount} CPs(Límite: ${limit} min).`);
};

// --- Helper: Calculate Routes (Smart Cache) ---
// for a single Zip vs All Commercials
// Returns success count (newly calculated routes)
const processRoutesForZip = async (zip, commercials) => {
    // 1. Check which commercials need calculation (not in cache)
    const cacheRes = await db.query('SELECT commercial_id FROM routes_cache WHERE origin_zip = $1 AND status = \'OK\'', [zip.code]);
    const cachedIds = new Set(cacheRes.rows.map(r => r.commercial_id));

    const commercialsToProcess = commercials.filter(c => !cachedIds.has(c.id));

    if (commercialsToProcess.length === 0) return 0; // All cached

    // 2. Prepare API calls
    const originStr = (zip.lat && zip.lng) ? `${zip.lat},${zip.lng} ` : `${zip.code}, Spain`;
    const destinationStrs = commercialsToProcess.map(c =>
        (c.lat && c.lng) ? `${c.lat},${c.lng} ` : `${c.address}, ${c.city}, ${c.zip_code}, Spain`
    );

    let newRoutes = 0;

    try {
        const matrix = await maps.getDistances([originStr], destinationStrs);
        if (matrix && matrix[0] && matrix[0].elements) {
            const results = matrix[0].elements;
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const commercial = commercialsToProcess[i];

                if (result.status === 'OK') {
                    const distanceKm = (result.distance.value / 1000).toFixed(2);
                    const durationMin = Math.floor(result.duration.value / 60);

                    await db.query(`
                        INSERT INTO routes_cache(origin_zip, commercial_id, distance_km, duration_min, status)
VALUES($1, $2, $3, $4, 'OK')
                        ON CONFLICT(origin_zip, commercial_id) 
                        DO UPDATE SET
distance_km = EXCLUDED.distance_km,
    duration_min = EXCLUDED.duration_min,
    updated_at = CURRENT_TIMESTAMP
        `, [zip.code, commercial.id, distanceKm, durationMin]);
                    newRoutes++;
                } else {
                    await db.query(`
                        INSERT INTO routes_cache(origin_zip, commercial_id, status)
VALUES($1, $2, $3)
                        ON CONFLICT(origin_zip, commercial_id) 
                        DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
    `, [zip.code, commercial.id, result.status]);
                }
            }
        }
    } catch (err) {
        console.error(`❌[Rutas] Error CP ${zip.code}: ${err.message} `);
    }
    return newRoutes;
};


// --- EXPORTED FUNCTION: Full Precalculation ---
const runPrecalculation = async (onProgress) => {
    console.log('🚀 [GLOBAL] Iniciando precálculo inteligente...');

    try {
        // Init progress
        if (onProgress) onProgress(0, 100); // Fake total start

        // 1. Fetch ALL Zips (to ensure Central Time is calculated for everyone)
        const allZipsRes = await db.query('SELECT * FROM zip_codes');
        const allZips = allZipsRes.rows;

        // 2. Central Calculation
        console.log(">> Fase Central");
        await calculateCentralToZips(allZips, (curr, total) => {
            // Map Central progress to 0-30% range?
            // Or just send raw. Frontend expects current/total.
            // If we send raw, the bar resets. That's acceptable for now to show life.
            if (onProgress) onProgress(curr, total);
        });

        // 3. Update Viability
        await updateViability();

        // 4. Fetch VIABLE Zips and Commercials
        const viableZipsRes = await db.query('SELECT * FROM zip_codes WHERE viable = true');
        const viableZips = viableZipsRes.rows;

        const commercialsRes = await db.query('SELECT * FROM commercials WHERE active = true');
        const commercials = commercialsRes.rows;

        if (commercials.length === 0) {
            console.log('⚠️ No hay comerciales activos.');
            if (onProgress) onProgress(0, 0); // Signal completion if no commercials to process
            return;
        }

        console.log(`📊[Rutas] Revisando cache de ${viableZips.length} CPs Viables x ${commercials.length} Comerciales...`);

        if (viableZips.length === 0) {
            if (onProgress) onProgress(0, 0); // Done
            return; // No viable zips to process routes for
        }

        let processed = 0;
        let totalNew = 0;

        // Notify start of Route phase
        if (onProgress) onProgress(0, viableZips.length);

        for (const zip of viableZips) {
            const newCount = await processRoutesForZip(zip, commercials);
            totalNew += newCount;
            processed++;

            if (onProgress) onProgress(processed, viableZips.length);
            // Delay only if we called API
            if (newCount > 0) await new Promise(r => setTimeout(r, 200));
        }

        console.log(`✅[GLOBAL] Completado.${totalNew} nuevas rutas calculadas(El resto ya estaban en caché).`);
        // Ensure frontend knows we are done-done
        // Sending processed=total is standard trigger.

    } catch (err) {
        console.error('❌ Error GLOBAL:', err);
    }
};

// --- EXPORTED: Single Zip Precalc ---
const runZipPrecalculation = async (zipCode) => {
    console.log(`🚀[Item] Precálculo CP: ${zipCode} `);
    try {
        // We get fresh data from DB to check if min_to_central is null
        const zipRes = await db.query('SELECT * FROM zip_codes WHERE code = $1', [zipCode]);
        if (zipRes.rows.length === 0) return { success: false, error: 'CP not found' };
        const zip = zipRes.rows[0];

        // 1. Central (Pass inside array)
        // calculateCentralToZips will check if min_to_central is null
        await calculateCentralToZips([zip], null);

        // 2. Viability (for this zip only)
        const resSettings = await db.query("SELECT value FROM settings WHERE key = 'central_max_minutes'");
        const limit = parseInt(resSettings.rows[0]?.value) || 100;
        await db.query(`UPDATE zip_codes SET viable = (min_to_central <= $1) WHERE code = $2 AND min_to_central IS NOT NULL`, [limit, zip.code]);

        // Refresh zip data to see if it is now viable
        const zipRefresh = await db.query('SELECT * FROM zip_codes WHERE code = $1', [zipCode]);
        const updatedZip = zipRefresh.rows[0];

        if (!updatedZip.viable) {
            return { success: true, message: 'CP no viable. Rutas no calculadas.', count: 0 };
        }

        // 3. Routes
        const commercialsRes = await db.query('SELECT * FROM commercials WHERE active = true');
        // processRoutesForZip checks cache
        const count = await processRoutesForZip(updatedZip, commercialsRes.rows);

        return { success: true, count };

    } catch (err) {
        console.error(err);
        return { success: false, error: err.message };
    }
};

// --- EXPORTED: Single Commercial Precalc ---
const runCommercialPrecalculation = async (commercialId) => {
    console.log(`🚀[Item] Precálculo Comercial: ${commercialId} `);
    try {
        const commRes = await db.query('SELECT * FROM commercials WHERE id = $1', [commercialId]);
        if (commRes.rows.length === 0) return { success: false, error: 'Comercial not found' };
        const commercial = commRes.rows[0];

        // Only for viable zips
        const viableZipsRes = await db.query('SELECT * FROM zip_codes WHERE viable = true');
        const viableZips = viableZipsRes.rows;

        // Check cache for this commercial
        const cacheRes = await db.query('SELECT origin_zip FROM routes_cache WHERE commercial_id = $1 AND status = \'OK\'', [commercialId]);
        const cachedZips = new Set(cacheRes.rows.map(r => r.origin_zip));

        const zipsToProcess = viableZips.filter(z => !cachedZips.has(z.code));

        if (zipsToProcess.length === 0) {
            console.log('✅ Todas las rutas para este comercial ya están cacheadas.');
            return { success: true, count: 0 };
        }

        console.log(`ℹ️ Calculando rutas para comercial ${commercial.name} desde ${zipsToProcess.length} CPs...`);

        let totalNew = 0;
        const destStr = (commercial.lat && commercial.lng) ? `${commercial.lat},${commercial.lng} ` : `${commercial.address}, ${commercial.city}, Spain`;

        for (const zip of zipsToProcess) {
            const originStr = (zip.lat && zip.lng) ? `${zip.lat},${zip.lng} ` : `${zip.code}, Spain`;
            try {
                const matrix = await maps.getDistances([originStr], [destStr]);
                if (matrix && matrix[0] && matrix[0].elements && matrix[0].elements[0].status === 'OK') {
                    const result = matrix[0].elements[0];
                    const dist = (result.distance.value / 1000).toFixed(2);
                    const dur = Math.floor(result.duration.value / 60);

                    await db.query(`
                        INSERT INTO routes_cache(origin_zip, commercial_id, distance_km, duration_min, status)
VALUES($1, $2, $3, $4, 'OK')
                        ON CONFLICT(origin_zip, commercial_id) 
                        DO UPDATE SET distance_km = EXCLUDED.distance_km, duration_min = EXCLUDED.duration_min, updated_at = CURRENT_TIMESTAMP
    `, [zip.code, commercial.id, dist, dur]);
                    totalNew++;
                }
            } catch (e) { console.error(e.message); }
            await new Promise(r => setTimeout(r, 100)); // Rate limit
        }
        return { success: true, count: totalNew };

    } catch (err) {
        return { success: false, error: err.message };
    }
};

module.exports = { runPrecalculation, runZipPrecalculation, runCommercialPrecalculation };

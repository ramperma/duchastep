const db = require('../db');
const maps = require('./maps');

// Helper to calculate time from Central to a list of Zips
const calculateCentralToZips = async (zips, onProgress) => {
    console.log('🏢 Calculando tiempos desde CENTRAL...');

    // 1. Get Central Address
    const settingsRes = await db.query("SELECT value FROM settings WHERE key = 'central_address'");
    if (settingsRes.rows.length === 0 || !settingsRes.rows[0].value) {
        console.log('⚠️ No hay dirección central configurada. Saltando cálculo de central.');
        return;
    }
    const centralAddress = settingsRes.rows[0].value;
    const BATCH_SIZE = 25; // Safe batch for Google Maps

    let processed = 0;

    // 2. Process in batches
    for (let i = 0; i < zips.length; i += BATCH_SIZE) {
        const batch = zips.slice(i, i + BATCH_SIZE);
        const destinations = batch.map(z => z.lat && z.lng ? `${z.lat},${z.lng}` : `${z.code}, Spain`);

        try {
            // Origin: Central, Dest: Batch of Zips
            const matrix = await maps.getDistances([centralAddress], destinations);

            if (matrix && matrix[0] && matrix[0].elements) {
                const results = matrix[0].elements;

                for (let j = 0; j < results.length; j++) {
                    const result = results[j];
                    const zip = batch[j];

                    if (result.status === 'OK') {
                        const durationMin = Math.floor(result.duration.value / 60);

                        // Update ZIP with new column
                        await db.query(`UPDATE zip_codes SET min_to_central = $1 WHERE code = $2`, [durationMin, zip.code]);
                    }
                }
            }
        } catch (err) {
            console.error('❌ Error batch central:', err.message);
        }

        processed += batch.length;
        if (onProgress) onProgress(processed, zips.length); // Reuse progress bar?
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('✅ Cálculo CENTRAL completado.');
};

const runPrecalculation = async (onProgress) => {
    console.log('🚀 Iniciando precálculo de rutas (BATCH)...');

    try {
        // ... (Existing variables)
        const commercialsRes = await db.query('SELECT * FROM commercials WHERE active = true');
        const commercials = commercialsRes.rows;

        // 2. Get all ENABLED (viable) ZIP codes
        const zipsRes = await db.query('SELECT * FROM zip_codes WHERE viable = true');
        const zips = zipsRes.rows;

        // --- NEW: Calculate Central Times First (or parallel) ---
        // We do it first to ensure search works quickly even if commercial routes fail
        await calculateCentralToZips(zips, onProgress);

        if (commercials.length === 0) {
            console.log('⚠️ No hay comerciales activos. Saltando precálculo.');
            if (onProgress) onProgress(0, 0);
            return;
        }

        console.log(`ℹ️  Comerciales activos encontrados: ${commercials.length}`);

        // 3. Process each ZIP code
        let processedCount = 0;
        let successCount = 0;

        for (const zip of zips) {
            // Prepare origin (ZIP center) using lat/lng string format
            const originStr = (zip.lat && zip.lng) ? `${zip.lat},${zip.lng}` : `${zip.code}, Spain`;

            // Prepare destinations (All Commercials) using lat/lng string format OR address fallback
            const destinationStrs = commercials.map(c => {
                if (c.lat && c.lng) return `${c.lat},${c.lng}`;
                return `${c.address}, ${c.city}, ${c.zip_code}, Spain`;
            });

            // Call API: One ZIP vs All Commercials
            try {
                const matrix = await maps.getDistances([originStr], destinationStrs);

                // Matrix rows[0] corresponds to our single origin
                if (matrix && matrix[0] && matrix[0].elements) {
                    const results = matrix[0].elements;

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        const commercial = commercials[i];

                        if (result.status === 'OK') {
                            const distanceKm = (result.distance.value / 1000).toFixed(2);
                            const durationMin = Math.floor(result.duration.value / 60);

                            // Upsert into routes_cache
                            await db.query(`
                                INSERT INTO routes_cache (origin_zip, commercial_id, distance_km, duration_min, status)
                                VALUES ($1, $2, $3, $4, 'OK')
                                ON CONFLICT (origin_zip, commercial_id) 
                                DO UPDATE SET 
                                    distance_km = EXCLUDED.distance_km,
                                    duration_min = EXCLUDED.duration_min,
                                    updated_at = CURRENT_TIMESTAMP
                            `, [zip.code, commercial.id, distanceKm, durationMin]);

                            successCount++;
                        } else {
                            // Save error status (e.g., ZERO_RESULTS)
                            await db.query(`
                                INSERT INTO routes_cache (origin_zip, commercial_id, status)
                                VALUES ($1, $2, $3)
                                ON CONFLICT (origin_zip, commercial_id) 
                                DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
                            `, [zip.code, commercial.id, result.status]);
                        }
                    }
                }
            } catch (innerErr) {
                console.error(`❌ Error procesando CP ${zip.code}:`, innerErr.message);
            }

            processedCount++;

            // Notify progress
            if (onProgress) onProgress(processedCount, zips.length);

            if (processedCount % 10 === 0) console.log(`... ⏳ Progreso: ${processedCount}/${zips.length} CPs procesados.`);

            // Small delay to be nice to API
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`✅ Precálculo finalizado. ${successCount} rutas guardadas/actualizadas.`);

    } catch (err) {
        console.error('❌ Error GLOBAL en precálculo:', err);
    }
};

const runCommercialPrecalculation = async (commercialId) => {
    console.log(`🚀 Iniciando precálculo de rutas para comercial ID: ${commercialId}`);

    try {
        // 1. Get commercial details
        const commercialRes = await db.query('SELECT * FROM commercials WHERE id = $1', [commercialId]);

        if (commercialRes.rows.length === 0) {
            console.log('⚠️ Comercial no encontrado.');
            return { success: false, error: 'Comercial no encontrado' };
        }

        const commercial = commercialRes.rows[0];

        // 2. Get all ENABLED (viable) ZIP codes
        const zipsRes = await db.query('SELECT * FROM zip_codes WHERE viable = true');
        const zips = zipsRes.rows;

        if (zips.length === 0) {
            console.log('⚠️ No hay códigos postales VIABLES. Nada que calcular.');
            return { success: true, count: 0 };
        }

        console.log(`📊 Procesando ${zips.length} CPs para comercial ${commercial.name}...`);

        let successCount = 0;

        // Prepare destination (Commercial)
        const destinationStr = (commercial.lat && commercial.lng)
            ? `${commercial.lat},${commercial.lng}`
            : `${commercial.address}, ${commercial.city}, ${commercial.zip_code}, Spain`;

        // Process in chunks to respect API limits? Or simple loop. Simple loop for now as it's just 1 commercial.
        for (const zip of zips) {
            const originStr = (zip.lat && zip.lng) ? `${zip.lat},${zip.lng}` : `${zip.code}, Spain`;

            try {
                // Call API: 1 Origin -> 1 Destination
                const matrix = await maps.getDistances([originStr], [destinationStr]);

                if (matrix && matrix[0] && matrix[0].elements && matrix[0].elements[0]) {
                    const result = matrix[0].elements[0];

                    if (result.status === 'OK') {
                        const distanceKm = (result.distance.value / 1000).toFixed(2);
                        const durationMin = Math.floor(result.duration.value / 60);

                        await db.query(`
                            INSERT INTO routes_cache (origin_zip, commercial_id, distance_km, duration_min, status)
                            VALUES ($1, $2, $3, $4, 'OK')
                            ON CONFLICT (origin_zip, commercial_id) 
                            DO UPDATE SET 
                                distance_km = EXCLUDED.distance_km,
                                duration_min = EXCLUDED.duration_min,
                                updated_at = CURRENT_TIMESTAMP
                        `, [zip.code, commercial.id, distanceKm, durationMin]);

                        successCount++;
                    } else {
                        await db.query(`
                            INSERT INTO routes_cache (origin_zip, commercial_id, status)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (origin_zip, commercial_id) 
                            DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
                        `, [zip.code, commercial.id, result.status]);
                    }
                }
            } catch (innerErr) {
                console.error(`❌ Error CP ${zip.code}:`, innerErr.message);
            }

            // Minimal delay
            await new Promise(r => setTimeout(r, 50));
        }

        console.log(`✅ Precálculo individual finalizado. ${successCount} rutas actualizadas.`);
        return { success: true, count: successCount };

    } catch (err) {
        console.error('❌ Error en precálculo individual:', err);
        return { success: false, error: err.message };
    }
};

const runZipPrecalculation = async (zipCode) => {
    console.log(`🚀 Iniciando precálculo de rutas para CP: ${zipCode}`);

    try {
        // 1. Get Zip details
        const zipRes = await db.query('SELECT * FROM zip_codes WHERE code = $1', [zipCode]);

        if (zipRes.rows.length === 0) {
            console.log('⚠️ CP no encontrado.');
            return { success: false, error: 'CP no encontrado' };
        }

        const zip = zipRes.rows[0];

        // 2. Get all ACTIVE commercials
        const commercialsRes = await db.query('SELECT * FROM commercials WHERE active = true');
        const commercials = commercialsRes.rows;

        if (commercials.length === 0) {
            console.log('⚠️ No hay comerciales activos. Nada que calcular.');
            return { success: true, count: 0 };
        }

        console.log(`📊 Procesando CP ${zip.code} x ${commercials.length} Comerciales...`);

        let successCount = 0;

        // --- NEW: Calculate Central Time for this Zip ---
        try {
            const settingsRes = await db.query("SELECT value FROM settings WHERE key = 'central_address'");
            if (settingsRes.rows.length > 0 && settingsRes.rows[0].value) {
                const centralAddress = settingsRes.rows[0].value;
                const zipDestination = (zip.lat && zip.lng) ? `${zip.lat},${zip.lng}` : `${zip.code}, Spain`;

                const centralMatrix = await maps.getDistances([centralAddress], [zipDestination]);
                if (centralMatrix && centralMatrix[0] && centralMatrix[0].elements && centralMatrix[0].elements[0].status === 'OK') {
                    const durationMin = Math.floor(centralMatrix[0].elements[0].duration.value / 60);
                    await db.query(`UPDATE zip_codes SET min_to_central = $1 WHERE code = $2`, [durationMin, zip.code]);
                    console.log(`⏱️ Tiempo a central calculado: ${durationMin} min`);
                }
            }
        } catch (centralErr) {
            console.error('❌ Error calculando central:', centralErr.message);
        }

        // Prepare origin
        const originStr = (zip.lat && zip.lng) ? `${zip.lat},${zip.lng}` : `${zip.code}, Spain`;

        // Prepare destinations (All Commercials) using lat/lng string format OR address fallback
        const destinationStrs = commercials.map(c => {
            if (c.lat && c.lng) return `${c.lat},${c.lng}`;
            return `${c.address}, ${c.city}, ${c.zip_code}, Spain`;
        });

        // Call API: 1 Origin vs All Commercials (Batch)
        try {
            const matrix = await maps.getDistances([originStr], destinationStrs);

            if (matrix && matrix[0] && matrix[0].elements) {
                const results = matrix[0].elements;

                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    const commercial = commercials[i];

                    if (result.status === 'OK') {
                        const distanceKm = (result.distance.value / 1000).toFixed(2);
                        const durationMin = Math.floor(result.duration.value / 60);

                        await db.query(`
                            INSERT INTO routes_cache (origin_zip, commercial_id, distance_km, duration_min, status)
                            VALUES ($1, $2, $3, $4, 'OK')
                            ON CONFLICT (origin_zip, commercial_id) 
                            DO UPDATE SET 
                                distance_km = EXCLUDED.distance_km,
                                duration_min = EXCLUDED.duration_min,
                                updated_at = CURRENT_TIMESTAMP
                        `, [zip.code, commercial.id, distanceKm, durationMin]);

                        successCount++;
                    } else {
                        await db.query(`
                            INSERT INTO routes_cache (origin_zip, commercial_id, status)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (origin_zip, commercial_id) 
                            DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
                        `, [zip.code, commercial.id, result.status]);
                    }
                }
            }
        } catch (innerErr) {
            console.error(`❌ Error procesando CP ${zip.code}:`, innerErr.message);
        }

        console.log(`✅ Precálculo CP finalizado. ${successCount} rutas actualizadas.`);
        return { success: true, count: successCount };

    } catch (err) {
        console.error('❌ Error en precálculo CP:', err);
        return { success: false, error: err.message };
    }
};

module.exports = { runPrecalculation, runCommercialPrecalculation, runZipPrecalculation };

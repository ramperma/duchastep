const db = require('./db');
const XLSX = require('xlsx');
const path = require('path');

const importExcel = async () => {
    console.log('🚀 Iniciando importación mejorada (priorizando VIABLES)...');

    const filePath = path.join(__dirname, '../TODOS CP COMUNIDAD VALENCIANA.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    console.log(`📄 Leídas ${data.length} filas.`);

    try {
        // --- STEP 1: Process Commercials ---
        console.log('👤 Procesando comerciales...');
        const commercialMap = new Map();
        const uniqueCommercials = new Set();

        data.forEach(row => {
            const name = row['COMERCIAL ASIGNADO'];
            if (name && typeof name === 'string' && name.trim() !== '') {
                uniqueCommercials.add(name.trim());
            }
        });

        for (const name of uniqueCommercials) {
            let res = await db.query('SELECT id FROM commercials WHERE name = $1', [name]);
            let id;
            if (res.rows.length > 0) {
                id = res.rows[0].id;
            } else {
                const insertRes = await db.query(
                    'INSERT INTO commercials (name, active) VALUES ($1, true) RETURNING id',
                    [name]
                );
                id = insertRes.rows[0].id;
                console.log(`   ✨ Nuevo comercial creado: ${name}`);
            }
            commercialMap.set(name, id);
        }
        console.log(`✅ ${commercialMap.size} comerciales listos.`);

        // --- STEP 2: Aggregate ZIP Code Data ---
        console.log('📍 Agregando datos de CPs (resolviendo duplicados)...');
        const zips = new Map();

        for (const row of data) {
            let cp = row['CP'];
            if (!cp) continue;
            cp = String(cp).trim().padStart(5, '0');

            const assignableRaw = String(row['ASIGNABLE ADS'] || '').toUpperCase().trim();
            const isViable = assignableRaw === 'SI' || assignableRaw === 'SÍ';

            const commName = row['COMERCIAL ASIGNADO'];
            let commId = null;
            if (commName && commercialMap.has(commName.trim())) {
                commId = commercialMap.get(commName.trim());
            }

            const currentData = zips.get(cp);

            // Logic: Overwrite if current row is VIABLE and stored one is not, or if new.
            if (!currentData || (!currentData.viable && isViable)) {
                zips.set(cp, {
                    city: row['POBLACIÓN'] || 'Desconocido',
                    province: row['PROVINCIA'],
                    lat: row['LATITUD'],
                    lng: row['LONGITUD'],
                    viable: isViable,
                    assigned_commercial_id: commId
                });
            }
        }
        console.log(`✅ ${zips.size} Códigos Postales ÚNICOS procesados.`);

        // --- STEP 3: Insert into DB ---
        console.log('💾 Guardando en Base de Datos...');
        let count = 0;

        for (const [code, info] of zips.entries()) {
            await db.query(`
                INSERT INTO zip_codes (code, city, province, lat, lng, viable, assigned_commercial_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (code) 
                DO UPDATE SET 
                    city = EXCLUDED.city,
                    province = EXCLUDED.province,
                    lat = EXCLUDED.lat,
                    lng = EXCLUDED.lng,
                    viable = EXCLUDED.viable,
                    assigned_commercial_id = EXCLUDED.assigned_commercial_id;
            `, [code, info.city, info.province, info.lat, info.lng, info.viable, info.assigned_commercial_id]);

            count++;
            if (count % 200 === 0) process.stdout.write('.');
        }

        console.log(`\n✅ Importación completada con éxito.`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
};

importExcel();

const db = require('./db');
const XLSX = require('xlsx');
const path = require('path');

const insertMissingCommercials = async () => {
    console.log('🚀 Insertando comerciales faltantes (Alzira y Gandía)...');

    const filePath = path.join(__dirname, '../TODOS CP COMUNIDAD VALENCIANA.xlsx');
    const workbook = XLSX.readFile(filePath);

    const sheetName = 'COORDENADAS COMERCIALES';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.error(`❌ No se encontró la hoja "${sheetName}"`);
        process.exit(1);
    }

    const data = XLSX.utils.sheet_to_json(sheet);

    // Lista de comerciales a asegurar
    const targets = ['NUEVO COMERCIAL ALZIRA', 'NUEVO COMERCIAL GANDÍA'];

    try {
        for (const row of data) {
            const nameRaw = row['COMERCIAL'];
            if (!nameRaw) continue;

            const name = nameRaw.trim();

            // Ver si es uno de los que buscamos (coincidencia parcial para Gandía/Gandia)
            const isTarget = targets.some(t => name.toUpperCase().includes(t.replace('ÍA', '').replace('IA', '')));
            // Esto es un poco laxo, mejor busquemos coincidencias más directas o iteremos sobre targets.

            // Mejor enfoque: Si el nombre del Excel está en nuestra lista de objetivos
            // Nota: En el Excel pone "NUEVO COMERCIAL GANDÍA" (con tilde) según tu captura? O sin ella. 
            // Asumiré que debo buscar por nombre aproximado.

            if (name.includes('ALZIRA') || name.includes('GAND')) {
                console.log(`🔎 Encontrado en Excel: ${name}`);

                const cp = row['C.P. COMERCIAL'];
                const lat = row['LATITUD'];
                const lng = row['LONGITUD'];
                const zipCode = cp ? String(cp).padStart(5, '0') : null;

                // Buscar ciudad
                let city = null;
                if (zipCode) {
                    const cityRes = await db.query('SELECT city FROM zip_codes WHERE code = $1 LIMIT 1', [zipCode]);
                    if (cityRes.rows.length > 0) {
                        city = cityRes.rows[0].city;
                    }
                }

                // Verificar si YA existe para no duplicar
                const existRes = await db.query('SELECT id FROM commercials WHERE name ILIKE $1', [name]);

                if (existRes.rows.length === 0) {
                    // INSERTAR
                    await db.query(`
                        INSERT INTO commercials (name, address, zip_code, city, lat, lng, active)
                        VALUES ($1, '', $2, $3, $4, $5, true)
                    `, [name, zipCode, city, lat, lng]);
                    console.log(`✅ INSERTADO: ${name} (CP: ${zipCode}, Ciudad: ${city})`);
                } else {
                    console.log(`ℹ️ Ya existe en DB: ${name} (Saltando)`);
                }
            }
        }

        console.log('\n🎉 Proceso finalizado.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
};

insertMissingCommercials();

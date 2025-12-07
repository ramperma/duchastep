const db = require('./db');
const XLSX = require('xlsx');
const path = require('path');

const updateCommercials = async () => {
    console.log('🚀 Actualizando datos de comerciales desde hoja "COORDENADAS COMERCIALES"...');

    const filePath = path.join(__dirname, '../TODOS CP COMUNIDAD VALENCIANA.xlsx');
    const workbook = XLSX.readFile(filePath);

    // Leer hoja de comerciales
    const sheetName = 'COORDENADAS COMERCIALES';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.error(`❌ No se encontró la hoja "${sheetName}"`);
        process.exit(1);
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📄 Leídas ${data.length} filas de comerciales.`);

    try {
        let updatedCount = 0;

        for (const row of data) {
            const nameRaw = row['COMERCIAL'];
            if (!nameRaw) continue;

            const name = nameRaw.trim();
            const cp = row['C.P. COMERCIAL'];
            const lat = row['LATITUD'];
            const lng = row['LONGITUD'];
            const zipCode = cp ? String(cp).padStart(5, '0') : null;

            // Intentar buscar la ciudad asociada a este CP en nuestra propia tabla zip_codes
            let city = null;
            if (zipCode) {
                const cityRes = await db.query('SELECT city FROM zip_codes WHERE code = $1 LIMIT 1', [zipCode]);
                if (cityRes.rows.length > 0) {
                    city = cityRes.rows[0].city;
                }
            }

            // Normalización de nombres para hacer match (la DB puede tener nombres ligeramente distintos si se importaron de la otra hoja)
            // En la primera importación usamos 'COMERCIAL ASIGNADO'. Aquí usamos 'COMERCIAL'. Deberían coincidir bastante.

            // Actualizamos por nombre exacto (case insensitive si es posible, o normal)
            const res = await db.query(`
                UPDATE commercials 
                SET 
                    zip_code = $1,
                    lat = $2,
                    lng = $3,
                    city = COALESCE($4, city) -- Solo actualiza si encontramos ciudad, si no deja la que esté (si hay)
                WHERE name ILIKE $5
            `, [zipCode, lat, lng, city, `%${name}%`]); // Usamos ILIKE y % por si hay pequeñas variaciones

            if (res.rowCount > 0) {
                console.log(`✅ Actualizado: ${name} (CP: ${zipCode}, Ciudad: ${city || '?'})`);
                updatedCount++;
            } else {
                console.log(`⚠️ No encontrado en DB: ${name} (Se creará nuevo si es necesario, pero este script solo actualiza)`);

                // Opcional: Insertar si no existe?
                // El usuario dijo que faltaban datos, pero los registros ya existían (IDs 9-19).
                // Si el nombre no coincide exactamente, puede ser un problema.
            }
        }

        console.log(`\n🎉 Proceso finalizado. ${updatedCount} comerciales actualizados.`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
};

updateCommercials();

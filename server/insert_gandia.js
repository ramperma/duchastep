const db = require('./db');
const dotenv = require('dotenv');
dotenv.config();

async function insertGandia() {
    try {
        const name = 'NUEVO COMERCIAL GANDÍA';
        const zipCode = '46701'; // De tu captura

        // 1. Obtener lat/lng y ciudad de la tabla zip_codes para el 46701
        console.log(`Buscando datos par CP ${zipCode}...`);
        const resZip = await db.query('SELECT city, lat, lng FROM zip_codes WHERE code = $1', [zipCode]);

        let city = 'Gandia';
        let lat = 38.967990; // Fallback aprox Gandia
        let lng = -0.180251; // Fallback aprox Gandia

        if (resZip.rows.length > 0) {
            city = resZip.rows[0].city;
            lat = resZip.rows[0].lat;
            lng = resZip.rows[0].lng;
            console.log(`> Encontrados datos en DB: ${city} (${lat}, ${lng})`);
        } else {
            console.log('> No encontrado en DB, usando fallbacks.');
        }

        // 2. Insertar
        const res = await db.query(`
            INSERT INTO commercials (name, address, zip_code, city, lat, lng, active)
            VALUES ($1, '', $2, $3, $4, $5, true)
            ON CONFLICT (id) DO NOTHING -- No tenemos id fijo, así que esto no saltará por id, pero evitará errores si reintentamos con lógica distinta
        `, [name, zipCode, city, lat, lng]);

        console.log(`✅ ${name} insertado correctamente.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

insertGandia();

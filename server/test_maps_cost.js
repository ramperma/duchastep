const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Cargar .env
dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.GOOGLE_MAPS_KEY;

if (!apiKey) {
    console.error('❌ No se encontró GOOGLE_MAPS_KEY en .env');
    process.exit(1);
}

const central = "C/ de l’Arquebisbe Fabián i Fuero, 28, 46009 València, Valencia";
const testCPs = [
    '46001, España', // Valencia (cerca)
    '46022, España', // Valencia (cerca)
    '46100, España', // Burjassot
    '46900, España', // Torrent
    '03001, España', // Alicante (lejos)
    '12001, España', // Castellón
    '28001, España', // Madrid (muy lejos)
    '08001, España', // Barcelona (muy lejos)
    '46701, España', // Gandia
    '46600, España'  // Alzira
];

async function runTest() {
    console.log(`🚀 Iniciando prueba de costos (10 peticiones) con API Key: ${apiKey.substring(0, 10)}...`);
    console.log(`📍 Origen: ${central}\n`);

    let successCount = 0;

    for (const dest of testCPs) {
        try {
            console.log(`Attempting: ${central} -> ${dest}`);
            const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
                params: {
                    origins: central,
                    destinations: dest,
                    key: apiKey,
                    units: 'metric'
                }
            });

            if (response.data.status === 'OK') {
                const element = response.data.rows[0].elements[0];
                if (element.status === 'OK') {
                    console.log(`✅ [OK] Destino: ${dest} | Distancia: ${element.distance.text} | Duración: ${element.duration.text}`);
                    successCount++;
                } else {
                    console.log(`⚠️ [Partial] API OK pero ruta no encontrada: ${dest} (${element.status})`);
                }
            } else {
                console.error(`❌ API Error: ${response.data.status} - ${response.data.error_message}`);
            }

        } catch (err) {
            console.error(`❌ Request Error: ${err.message}`);
        }

        // Pequeña pausa para no saturar (aunque 10 es nada)
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n🎉 Prueba finalizada. ${successCount}/10 peticiones exitosas.`);
    console.log(`💰 Coste estimado: $0.05 (cubierto por el crédito gratuito de $200/mes)`);
    console.log(`ℹ️  Revisa la consola de Google Cloud en unos minutos para ver el tráfico.`);
}

runTest();

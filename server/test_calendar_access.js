const { google } = require('googleapis');
const path = require('path');

// Load credentials
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

const checks = async () => {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const calendar = google.calendar({ version: 'v3', auth });

        const targetCalendarId = 'personalramon2@gmail.com';

        console.log(`🔎 Verificando acceso al calendario: ${targetCalendarId}...`);

        // Try simply getting the calendar metadata (lighter than listing events)
        const res = await calendar.calendars.get({
            calendarId: targetCalendarId
        });

        console.log(`✅ Acceso EXITOSO. Metadata:`);
        console.log(`   - Summary: ${res.data.summary}`);
        console.log(`   - TimeZone: ${res.data.timeZone}`);

    } catch (err) {
        console.error('❌ FALLO DE ACCESO:');
        console.error(`   - Código: ${err.code}`);
        console.error(`   - Mensaje: ${err.message}`);

        if (err.code === 404) {
            console.log('\n💡 DIAGNÓSTICO: La cuenta de servicio NO tiene permiso o el calendario no existe.');
            console.log('➡️  Solución: Comparte el calendario "ramperma@gmail.com" con:');
            console.log('   calendar-bot@graphite-hook-480711-i0.iam.gserviceaccount.com');
            console.log('   (Permiso requerido: "Hacer cambios en eventos" o mínimo "Ver todos los detalles")');
        }
    }
};

checks();

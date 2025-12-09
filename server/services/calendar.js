const { google } = require('googleapis');
const path = require('path');
const db = require('../db');

// Load credentials
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');

// Initialize auth
const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

const createAppointment = async (commercialId, clientData, appointmentDate) => {
    let centralEventId = null;
    let commercialEventId = null;
    let commercialEmail = null;

    try {
        // 1. Get Commercial Details
        const res = await db.query('SELECT id, name, google_calendar_id FROM commercials WHERE id = $1', [commercialId]);
        if (res.rows.length === 0) throw new Error('Comercial no encontrado');

        const commercial = res.rows[0];
        commercialEmail = commercial.google_calendar_id;

        if (!commercialEmail) {
            throw new Error(`El comercial ${commercial.name} no tiene configurado su email/ID de Google Calendar.`);
        }

        // 2. Prepare Event Object (Shared Data)
        const clientNameStr = clientData.client_name ? clientData.client_name.toUpperCase() : 'VISITA CLIENTE';
        const addressLine = clientData.address ? `**Dirección**: ${clientData.address}` : '';
        const obsLine = clientData.observations ? `**Observaciones**: ${clientData.observations}` : '';

        const eventBase = {
            summary: `${clientNameStr} (${clientData.zip_code})`, // Title: CLIENT NAME (ZIP)
            location: clientData.address || '', // Location field
            description: `
                **Comercial**: ${commercial.name}
                **Cliente**: ${clientData.zip_code} - ${clientData.city || 'Desconocida'}
                ${addressLine}
                ${obsLine}
                
                Generado automáticamente por Duchastep.
            `,
            start: { dateTime: new Date(appointmentDate).toISOString() },
            end: { dateTime: new Date(new Date(appointmentDate).getTime() + 60 * 60 * 1000).toISOString() }, // +1h
        };

        // --- STEP A: Create in CENTRAL Calendar (Bot's Primary) ---
        // We use Color ID here for visualization
        const colorId = ((commercial.id % 11) + 1).toString();

        const centralEvent = {
            ...eventBase,
            summary: `[${commercial.name}] ${clientNameStr} (${clientData.zip_code})`, // Tagged summary for central view, including Client Name
            colorId: colorId,
        };

        // Use configured central calendar or fallback to bot's primary
        const centralCalendarId = process.env.CENTRAL_CALENDAR_ID || 'primary';
        console.log(`ℹ️ [DEBUG] Usando Calendario Central ID: '${centralCalendarId}'`);

        console.log(`⏳ Creando evento en Calendario Central (${centralCalendarId})...`);
        const centralRes = await calendar.events.insert({
            calendarId: centralCalendarId,
            resource: centralEvent,
        });
        centralEventId = centralRes.data.id;
        console.log(`✅ Evento Central creado (${centralEventId})`);


        // --- STEP B: Create in COMMERCIAL'S Calendar ---
        console.log(`⏳ Creando evento en Calendario Comercial (${commercialEmail})...`);
        const commercialRes = await calendar.events.insert({
            calendarId: commercialEmail,
            resource: eventBase,
        });
        commercialEventId = commercialRes.data.id;
        console.log(`✅ Evento Comercial creado (${commercialEventId})`);

        return { success: true, link: centralRes.data.htmlLink };

    } catch (err) {
        console.error('❌ Error transaccional en Calendar:', err.message);

        // --- ROLLBACK LOGIC ---
        // If we failed at Step B, we must undo Step A to maintain consistency.
        if (centralEventId && !commercialEventId) {
            console.log(`⚠️ Iniciando ROLLBACK: Borrando evento central ${centralEventId}...`);
            const centralCalendarId = process.env.CENTRAL_CALENDAR_ID || 'primary';
            try {
                await calendar.events.delete({ calendarId: centralCalendarId, eventId: centralEventId });
                console.log('✅ Rollback completado correctamente.');
            } catch (rollbackErr) {
                console.error('🔥 CRITICAL: Falló el rollback. Datos inconsistentes en Calendar.', rollbackErr.message);
            }
        }

        throw new Error(`Error al agendar (Rollback ejecutado): ${err.message}`);
    }
};

// List events (Admin sees all on 'primary', Commercial sees filter by their email)
const listEvents = async (isAdmin, commercialEmail) => {
    try {
        const params = {
            calendarId: 'primary',
            timeMin: new Date().toISOString(), // From now
            maxResults: 250,
            singleEvents: true,
            orderBy: 'startTime',
        };

        // If not admin and we have an email, we filter.
        // Google List API 'q' parameter searches text. 
        // Searching for attendee email in 'q' might work but isn't 100% reliable for "attending".
        // Robust way: fetch all and filter in JS if the API doesn't support attendee filter directly.
        // Google Calendar API v3 doesn't have 'attendee' filter param in list.
        // 'sharedExtendedProperty' or 'privateExtendedProperty' could work if we set them on create.

        // For now: Fetch all for Admin. Fetch all & Filter for User.
        // NOTE: If volume is high, this needs optimization (e.g. sync tokens). 
        // Given < 50 commercials and manageable visits, fetching 250 upcoming is fine.

        const response = await calendar.events.list(params);
        let events = response.data.items;

        if (!isAdmin && commercialEmail) {
            events = events.filter(e => {
                // Check if commercialEmail is in attendees
                return e.attendees && e.attendees.some(a => a.email === commercialEmail);
            });
        }

        return events.map(e => ({
            id: e.id,
            title: e.summary,
            start: e.start.dateTime || e.start.date,
            end: e.end.dateTime || e.end.date,
            description: e.description,
            colorId: e.colorId // Pass color for frontend styling
        }));

    } catch (err) {
        console.error('❌ Error listando eventos:', err.message);
        throw err;
    }
};

module.exports = { createAppointment, listEvents };

const db = require('./db');

const migrate = async () => {
    try {
        await db.query("ALTER TABLE commercials ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255);");
        console.log("✅ Columna google_calendar_id añadida correctamente.");
    } catch (err) {
        console.error("❌ Error en migración:", err);
    } finally {
        process.exit();
    }
};

migrate();

const db = require('./db');

const migrate = async () => {
    try {
        await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS commercial_id INTEGER REFERENCES commercials(id);");
        console.log("✅ Columna commercial_id añadida a users.");
    } catch (err) {
        console.error("❌ Error en migración:", err);
    } finally {
        process.exit();
    }
};

migrate();

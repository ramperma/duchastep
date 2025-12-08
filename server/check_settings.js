const db = require('./db');

const checkSettings = async () => {
    try {
        const res = await db.query("SELECT * FROM settings WHERE key = 'central_max_minutes'");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
};

checkSettings();

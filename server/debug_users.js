const db = require('./db');

const debugUsers = async () => {
    try {
        const res = await db.query(`
            SELECT u.id, u.username, u.role_id, r.name as role_name 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
};

debugUsers();

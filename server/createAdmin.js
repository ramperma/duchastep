const db = require('./db');
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
    const username = 'admin';
    const password = 'password123'; // Default password

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await db.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
            [username, hash]
        );
        console.log(`✅ Usuario admin creado/verificado. (User: ${username}, Pass: ${password})`);
    } catch (err) {
        console.error('❌ Error creando admin:', err);
    } finally {
        process.exit();
    }
};

createAdmin();

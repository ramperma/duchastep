const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';

// LOGIN
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Check user exists (Join with roles to get role name)
        const result = await db.query(`
            SELECT u.*, r.name as role 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.username = $1
        `, [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 2. Check password
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 3. Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error en login' });
    }
});

module.exports = router;

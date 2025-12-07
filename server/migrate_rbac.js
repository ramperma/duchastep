const db = require('./db');

const migrateRBAC = async () => {
    console.log('🔄 Iniciando migración RBAC...');

    try {
        // 1. Create Roles table
        await db.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                permissions JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla roles creada.');

        // 2. Insert Default Roles
        await db.query(`
            INSERT INTO roles (name, permissions) 
            VALUES 
                ('admin', '["all"]'),
                ('user', '["search:read"]')
            ON CONFLICT (name) DO NOTHING;
        `);
        console.log('✅ Roles por defecto insertados.');

        // 3. Add role_id to users if not exists
        // We check if column exists first to avoid errors on re-run
        const checkCol = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='role_id'");

        if (checkCol.rows.length === 0) {
            await db.query(`ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);`);
            console.log('✅ Columna role_id añadida a users.');

            // 4. Migrate existing users
            // Map 'admin' string to admin role_id
            await db.query(`
                UPDATE users 
                SET role_id = (SELECT id FROM roles WHERE name = users.role)
                WHERE role_id IS NULL;
            `);
            // Default fallback for others
            await db.query(`
                UPDATE users 
                SET role_id = (SELECT id FROM roles WHERE name = 'user')
                WHERE role_id IS NULL;
            `);
            console.log('✅ Usuarios migrados a role_id.');

            // 5. Drop old role column (Optional, maybe keep for backup for now? Let's drop to be clean)
            // await db.query(`ALTER TABLE users DROP COLUMN role;`); 
            // Better to keep it for a moment or rename it. Let's rename.
            await db.query(`ALTER TABLE users RENAME COLUMN role TO role_old;`);
            console.log('✅ Columna role renombrada a role_old.');
        } else {
            console.log('ℹ️ Migración ya realizada anteriormente.');
        }

    } catch (err) {
        console.error('❌ Error en migración RBAC:', err);
    } finally {
        process.exit();
    }
};

migrateRBAC();

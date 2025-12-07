const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'duchastep';

const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

async function createDatabaseIfNotExists() {
    let user = process.env.DB_USER || 'postgres';
    let password = process.env.DB_PASSWORD;
    let host = process.env.DB_HOST || 'localhost';
    let port = process.env.DB_PORT || 5432;

    // Try connecting to 'postgres' database to check/create target DB
    let client = new Client({ user, host, database: 'postgres', password, port });

    try {
        await client.connect();
    } catch (err) {
        console.log('⚠️  No se pudo conectar a PostgreSQL con las credenciales por defecto.');
        console.log('Por favor, introduce las credenciales de tu servidor PostgreSQL local:');

        user = await askQuestion('Usuario (postgres): ') || 'postgres';
        password = await askQuestion('Contraseña: ');
        host = await askQuestion('Host (localhost): ') || 'localhost';
        port = await askQuestion('Puerto (5432): ') || 5432;

        client = new Client({ user, host, database: 'postgres', password, port });
        try {
            await client.connect();
        } catch (connErr) {
            console.error('❌ Error fatal: No se pudo conectar a PostgreSQL.', connErr.message);
            process.exit(1);
        }
    }

    try {
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'`);
        if (res.rowCount === 0) {
            console.log(`✨ Creando base de datos '${DB_NAME}'...`);
            await client.query(`CREATE DATABASE "${DB_NAME}"`);
            console.log('✅ Base de datos creada.');
        } else {
            console.log(`ℹ️  La base de datos '${DB_NAME}' ya existe.`);
        }
    } catch (err) {
        console.error('❌ Error verificando/creando base de datos:', err);
        process.exit(1);
    } finally {
        await client.end();
    }

    // Now connect to the actual DB and run schema
    const dbClient = new Client({ user, host, database: DB_NAME, password, port });
    try {
        await dbClient.connect();
        console.log('📜 Ejecutando esquema de base de datos...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await dbClient.query(schemaSql);
        console.log('✅ Tablas configuradas correctamente.');
    } catch (err) {
        console.error('❌ Error ejecutando esquema:', err);
    } finally {
        await dbClient.end();
    }
}

// Run if called directly
if (require.main === module) {
    createDatabaseIfNotExists();
}

module.exports = createDatabaseIfNotExists;

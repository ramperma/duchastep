const db = require('./db');
const { runPrecalculation } = require('./services/precalc');

const seedData = async () => {
    console.log('🌱 Iniciando carga de datos de prueba...');

    try {
        // 1. Limpiar tablas (Opcional, para empezar limpio)
        await db.query('TRUNCATE TABLE routes_cache, commercials, zip_codes RESTART IDENTITY CASCADE');

        // 2. Insertar Comerciales (8 ficticios distribuidos por la zona)
        const commercials = [
            { name: 'Comercial Valencia Centro', address: 'Carrer de Colón 1', zip: '46004', city: 'Valencia' },
            { name: 'Comercial Gandía', address: 'Passeig de les Germanies 15', zip: '46701', city: 'Gandía' },
            { name: 'Comercial Xàtiva', address: 'Baixada de l\'Estació 2', zip: '46800', city: 'Xàtiva' },
            { name: 'Comercial Sagunto', address: 'Avinguda del País Valencià 30', zip: '46500', city: 'Sagunto' },
            { name: 'Comercial Alzira', address: 'Plaça del Regne 5', zip: '46600', city: 'Alzira' },
            { name: 'Comercial Requena', address: 'Avenida de Arrabal 10', zip: '46340', city: 'Requena' },
            { name: 'Comercial Castellón', address: 'Carrer Major 50', zip: '12001', city: 'Castellón de la Plana' },
            { name: 'Comercial Ontinyent', address: 'Avinguda Daniel Gil 20', zip: '46870', city: 'Ontinyent' },
        ];

        for (const c of commercials) {
            await db.query(
                'INSERT INTO commercials (name, address, zip_code, city, active) VALUES ($1, $2, $3, $4, true)',
                [c.name, c.address, c.zip, c.city]
            );
        }
        console.log(`✅ ${commercials.length} Comerciales insertados.`);

        // 3. Insertar Códigos Postales (Selección representativa radio ~100km Valencia)
        // Incluimos Valencia capital, área metropolitana y ciudades clave de provincias limítrofes
        const zipCodes = [
            // Valencia Capital
            { code: '46001', city: 'Valencia - Ciutat Vella' },
            { code: '46009', city: 'Valencia - La Saïdia (SEDE)' },
            { code: '46015', city: 'Valencia - Campanar' },
            { code: '46022', city: 'Valencia - Ayora' },
            // Horta Nord/Sud/Oest
            { code: '46100', city: 'Burjassot' },
            { code: '46900', city: 'Torrent' },
            { code: '46920', city: 'Mislata' },
            { code: '46470', city: 'Catarroja' },
            { code: '46113', city: 'Moncada' },
            // Camp de Morvedre
            { code: '46500', city: 'Sagunto' },
            { code: '46520', city: 'Puerto de Sagunto' },
            // La Ribera
            { code: '46600', city: 'Alzira' },
            { code: '46680', city: 'Algemesí' },
            { code: '46400', city: 'Cullera' },
            { code: '46740', city: 'Carcaixent' },
            // La Safor
            { code: '46701', city: 'Gandía' },
            { code: '46780', city: 'Oliva' },
            // La Costera / Vall d'Albaida
            { code: '46800', city: 'Xàtiva' },
            { code: '46870', city: 'Ontinyent' },
            { code: '46810', city: 'Enguera' },
            // Requena-Utiel (Oeste)
            { code: '46340', city: 'Requena' },
            { code: '46300', city: 'Utiel' },
            { code: '46360', city: 'Buñol' },
            // Castellón (Norte - dentro del radio)
            { code: '12001', city: 'Castellón de la Plana' },
            { code: '12540', city: 'Vila-real' },
            { code: '12500', city: 'Vinaròs' }, // Quizás límite
            { code: '12600', city: 'La Vall d\'Uixó' },
            // Alicante (Sur - algunos entran, otros no)
            { code: '03700', city: 'Dénia' },
            { code: '03730', city: 'Jávea' },
            { code: '03801', city: 'Alcoy' }, // Límite montaña
            { code: '03501', city: 'Benidorm' }, // Probablemente fuera de tiempo (>100 min)
            { code: '03001', city: 'Alicante' }, // Probablemente fuera (>100 min)
        ];

        for (const z of zipCodes) {
            await db.query(
                'INSERT INTO zip_codes (code, city) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
                [z.code, z.city]
            );
        }
        console.log(`✅ ${zipCodes.length} Códigos Postales insertados.`);

        // 4. Ejecutar Precálculo (Generar Matriz)
        console.log('🔄 Ejecutando precálculo de rutas (Mock)...');
        await runPrecalculation();

    } catch (err) {
        console.error('❌ Error en seed:', err);
    } finally {
        process.exit();
    }
};

seedData();

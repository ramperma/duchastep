const db = require('./db');
const precalcService = require('./services/precalc');
require('dotenv').config();

const valenciaZips = [
    // Valencia Capital
    { code: '46001', city: 'Valencia - Ciutat Vella' },
    { code: '46002', city: 'Valencia - Ciutat Vella' },
    { code: '46003', city: 'Valencia - Ciutat Vella' },
    { code: '46004', city: 'Valencia - Eixample' },
    { code: '46005', city: 'Valencia - Eixample' },
    { code: '46006', city: 'Valencia - Eixample' },
    { code: '46007', city: 'Valencia - Extramurs' },
    { code: '46008', city: 'Valencia - Extramurs' },
    { code: '46009', city: 'Valencia - La Saïdia' },
    { code: '46010', city: 'Valencia - El Pla del Real' },
    { code: '46011', city: 'Valencia - Poblats Marítims' },
    { code: '46012', city: 'Valencia - Poblats Marítims' },
    { code: '46013', city: 'Valencia - Quatre Carreres' },
    { code: '46014', city: 'Valencia - L\'Olivereta' },
    { code: '46015', city: 'Valencia - Campanar' },
    { code: '46016', city: 'Valencia - Tavernes Blanques' },
    { code: '46017', city: 'Valencia - Patraix' },
    { code: '46018', city: 'Valencia - Jesús' },
    { code: '46019', city: 'Valencia - Rascanya' },
    { code: '46020', city: 'Valencia - Benimaclet' },
    { code: '46021', city: 'Valencia - Algirós' },
    { code: '46022', city: 'Valencia - Camins al Grau' },
    { code: '46023', city: 'Valencia - Camins al Grau' },
    { code: '46024', city: 'Valencia - Poblats Marítims' },
    { code: '46025', city: 'Valencia - Benicalap' },
    { code: '46026', city: 'Valencia - Poblats del Sud' },

    // Valencia Provincia (Selection)
    { code: '46100', city: 'Burjassot' },
    { code: '46110', city: 'Godella' },
    { code: '46113', city: 'Moncada' },
    { code: '46120', city: 'Alboraya' },
    { code: '46130', city: 'Massamagrell' },
    { code: '46160', city: 'Llíria' },
    { code: '46183', city: 'L\'Eliana' },
    { code: '46190', city: 'Riba-roja de Túria' },
    { code: '46200', city: 'Paiporta' },
    { code: '46210', city: 'Picanya' },
    { code: '46220', city: 'Picassent' },
    { code: '46230', city: 'Alginet' },
    { code: '46240', city: 'Carlet' },
    { code: '46250', city: 'L\'Alcúdia' },
    { code: '46260', city: 'Alberic' },
    { code: '46290', city: 'Alcàsser' },
    { code: '46300', city: 'Utiel' },
    { code: '46340', city: 'Requena' },
    { code: '46360', city: 'Buñol' },
    { code: '46370', city: 'Chiva' },
    { code: '46380', city: 'Cheste' },
    { code: '46400', city: 'Cullera' },
    { code: '46410', city: 'Sueca' },
    { code: '46460', city: 'Silla' },
    { code: '46470', city: 'Catarroja' },
    { code: '46500', city: 'Sagunto' },
    { code: '46520', city: 'Puerto de Sagunto' },
    { code: '46530', city: 'Puçol' },
    { code: '46600', city: 'Alzira' },
    { code: '46680', city: 'Algemesí' },
    { code: '46701', city: 'Gandía' },
    { code: '46730', city: 'Grau de Gandia' },
    { code: '46740', city: 'Carcaixent' },
    { code: '46780', city: 'Oliva' },
    { code: '46800', city: 'Xàtiva' },
    { code: '46810', city: 'Enguera' },
    { code: '46870', city: 'Ontinyent' },
    { code: '46900', city: 'Torrent' },
    { code: '46910', city: 'Alfafar' },
    { code: '46920', city: 'Mislata' },
    { code: '46930', city: 'Quart de Poblet' },
    { code: '46940', city: 'Manises' },
    { code: '46950', city: 'Xirivella' },
    { code: '46960', city: 'Aldaia' },
    { code: '46970', city: 'Alaquàs' },
    { code: '46980', city: 'Paterna' },

    // Alicante (Selection)
    { code: '03001', city: 'Alicante - Centro' },
    { code: '03002', city: 'Alicante - Centro' },
    { code: '03003', city: 'Alicante - Centro' },
    { code: '03004', city: 'Alicante - Centro' },
    { code: '03005', city: 'Alicante - Oeste' },
    { code: '03100', city: 'Jijona' },
    { code: '03110', city: 'Mutxamel' },
    { code: '03130', city: 'Santa Pola' },
    { code: '03140', city: 'Guardamar del Segura' },
    { code: '03160', city: 'Almoradí' },
    { code: '03170', city: 'Rojales' },
    { code: '03181', city: 'Torrevieja' },
    { code: '03190', city: 'Pilar de la Horadada' },
    { code: '03201', city: 'Elche' },
    { code: '03202', city: 'Elche' },
    { code: '03300', city: 'Orihuela' },
    { code: '03330', city: 'Crevillent' },
    { code: '03400', city: 'Villena' },
    { code: '03440', city: 'Ibi' },
    { code: '03501', city: 'Benidorm' },
    { code: '03502', city: 'Benidorm' },
    { code: '03550', city: 'Sant Joan d\'Alacant' },
    { code: '03560', city: 'El Campello' },
    { code: '03570', city: 'Villajoyosa' },
    { code: '03590', city: 'Altea' },
    { code: '03600', city: 'Elda' },
    { code: '03610', city: 'Petrer' },
    { code: '03630', city: 'Sax' },
    { code: '03640', city: 'Monóvar' },
    { code: '03650', city: 'Pinoso' },
    { code: '03660', city: 'Novelda' },
    { code: '03680', city: 'Aspe' },
    { code: '03690', city: 'San Vicente del Raspeig' },
    { code: '03700', city: 'Dénia' },
    { code: '03710', city: 'Calpe' },
    { code: '03724', city: 'Moraira' },
    { code: '03730', city: 'Jávea' },
    { code: '03801', city: 'Alcoy' },
    { code: '03820', city: 'Cocentaina' },

    // Castellón (Selection)
    { code: '12001', city: 'Castellón - Centro' },
    { code: '12002', city: 'Castellón - Centro' },
    { code: '12003', city: 'Castellón - Centro' },
    { code: '12004', city: 'Castellón - Norte' },
    { code: '12005', city: 'Castellón - Oeste' },
    { code: '12006', city: 'Castellón - Sur' },
    { code: '12100', city: 'Grao de Castellón' },
    { code: '12200', city: 'Onda' },
    { code: '12300', city: 'Morella' },
    { code: '12400', city: 'Segorbe' },
    { code: '12500', city: 'Vinaròs' },
    { code: '12530', city: 'Burriana' },
    { code: '12540', city: 'Vila-real' },
    { code: '12550', city: 'Almassora' },
    { code: '12560', city: 'Benicàssim' },
    { code: '12580', city: 'Benicarló' },
    { code: '12598', city: 'Peñíscola' },
    { code: '12600', city: 'La Vall d\'Uixó' },
    { code: '12520', city: 'Nules' }
];

const seedValencia = async () => {
    console.log('🌱 Iniciando carga de CPs Comunidad Valenciana...');

    try {
        // 1. Insert ZIP Codes
        for (const zip of valenciaZips) {
            await db.query(
                'INSERT INTO zip_codes (code, city) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
                [zip.code, zip.city]
            );
        }
        console.log(`✅ ${valenciaZips.length} CPs procesados.`);

        // 2. Trigger Pre-calculation
        console.log('🔄 Recalculando rutas para los nuevos CPs...');
        await precalcService.runPrecalculation();
        console.log('✅ Rutas calculadas correctamente.');

    } catch (err) {
        console.error('❌ Error en seedValencia:', err);
    } finally {
        process.exit();
    }
};

seedValencia();

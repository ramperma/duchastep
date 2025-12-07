const db = require('./db');
const dotenv = require('dotenv');

dotenv.config();

async function deleteRange() {
    try {
        console.log('Iniciando proceso de borrado para comerciales ID 1-8...');

        // 1. Desasignar de zip_codes (poner a NULL)
        console.log('Desvinculando códigos postales...');
        const resZip = await db.query('UPDATE zip_codes SET assigned_commercial_id = NULL WHERE assigned_commercial_id >= 1 AND assigned_commercial_id <= 8');
        console.log(`- ${resZip.rowCount} códigos postales actualizados.`);

        // 2. Borrar de routes_cache
        console.log('Limpiando caché de rutas...');
        const resRoute = await db.query('DELETE FROM routes_cache WHERE commercial_id >= 1 AND commercial_id <= 8');
        console.log(`- ${resRoute.rowCount} entradas de caché eliminadas.`);

        // 3. Borrar comerciales
        console.log('Borrando comerciales...');
        const resComm = await db.query('DELETE FROM commercials WHERE id >= 1 AND id <= 8');
        console.log(`- ${resComm.rowCount} comerciales eliminados.`);

        console.log('Operación completada con éxito.');
    } catch (err) {
        console.error('Error durante el proceso:', err);
    } finally {
        // No podemos cerrar el pool explícitamente porque db.js no lo expone, pero el proceso terminará
        process.exit(0);
    }
}

deleteRange();

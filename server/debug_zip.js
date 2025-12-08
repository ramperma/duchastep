const db = require('./db');

async function checkZip() {
    try {
        console.log('Checking CP 03001...');
        const res = await db.query("SELECT * FROM zip_codes WHERE code = '03001'");
        console.log(`Rows found: ${res.rows.length}`);
        if (res.rows.length > 0) {
            console.log('Row data:', res.rows[0]);
        } else {
            console.log('CP 03001 NOT FOUND in DB');
        }

        // Also check if there are nearby items or whitespace issues
        const resAll = await db.query("SELECT code FROM zip_codes WHERE code LIKE '%03001%'");
        console.log('Codes like 03001:', resAll.rows.map(r => `'${r.code}'`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkZip();

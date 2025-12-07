const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../TODOS CP COMUNIDAD VALENCIANA.xlsx');

try {
    const workbook = XLSX.readFile(filePath);

    // Inspeccionar la SEGUNDA hoja: "COORDENADAS COMERCIALES"
    const sheetName = 'COORDENADAS COMERCIALES';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        console.log(`La hoja "${sheetName}" no existe.`);
    } else {
        console.log(`\nInspeccionando hoja: ${sheetName}`);
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (data.length > 0) {
            console.log('Cabeceras:', data[0]);
            if (data.length > 1) {
                console.log('Ejemplo datos (fila 1):', data[1]);
            }
        }
    }

} catch (error) {
    console.error('Error:', error);
}

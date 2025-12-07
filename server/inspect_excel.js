const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../TODOS CP COMUNIDAD VALENCIANA.xlsx');
console.log('Leyendo archivo:', filePath);

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Asumimos que está en la primera hoja
    const sheet = workbook.Sheets[sheetName];

    // Convertir a JSON para ver las cabeceras y la primera fila
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length > 0) {
        console.log('Cabeceras (fila 0):', data[0]);
        if (data.length > 1) {
            console.log('Primera fila de datos (fila 1):', data[1]);
        }
    } else {
        console.log('El archivo parece estar vacío o no se pudo leer correctamente.');
    }

    // Ver si hay otras hojas
    console.log('Hojas disponibles:', workbook.SheetNames);

} catch (error) {
    console.error('Error leyendo el archivo:', error);
}

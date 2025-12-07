const XLSX = require('xlsx');
const path = require('path');

const inspect = () => {
    const filePath = path.join(__dirname, '../TODOS CP COMUNIDAD VALENCIANA.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`Hoja 1: ${sheetName}`);
    console.log('Cabeceras:', data[0]);
    console.log('Fila 2:', data[1]);
};

inspect();

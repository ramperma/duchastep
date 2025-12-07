const { runZipPrecalculation } = require('./services/precalc');

const test = async () => {
    console.log('Testing Precalc for 46001...');
    await runZipPrecalculation('46001');
    process.exit();
};

test();

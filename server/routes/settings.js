const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { geocodeAddress } = require('../services/geocoding');

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        // Always call it 'logo' + extension to avoid clutter, or unique name?
        // Let's use unique name to avoid browser caching issues
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// GET logo url
router.get('/logo', async (req, res) => {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key = 'logo_url'");
        if (result.rows.length > 0) {
            res.json({ url: result.rows[0].value });
        } else {
            res.json({ url: null });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching logo' });
    }
});

// POST upload logo
router.post('/logo', upload.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    try {
        // Upsert setting
        await db.query(`
            INSERT INTO settings (key, value) 
            VALUES ('logo_url', $1) 
            ON CONFLICT (key) 
            DO UPDATE SET value = EXCLUDED.value
        `, [fileUrl]);

        res.json({ url: fileUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error saving logo setting' });
    }
});

// GET all settings or specific key
router.get('/settings', async (req, res) => {
    try {
        const result = await db.query("SELECT key, value FROM settings");
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching settings' });
    }
});

// POST update settings (generic)
router.post('/settings', async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    try {
        await db.query(`
            INSERT INTO settings (key, value) 
            VALUES ($1, $2) 
            ON CONFLICT (key) 
            DO UPDATE SET value = EXCLUDED.value
        `, [key, value]);

        // Auto-update viability if max minutes changes
        if (key === 'central_max_minutes') {
            const limit = parseInt(value) || 100;
            console.log(`🔄 Actualizando viabilidad de CPs basado en nuevo límite: ${limit} min`);
            const result = await db.query(`
                UPDATE zip_codes 
                SET viable = (min_to_central <= $1) 
                WHERE min_to_central IS NOT NULL
            `, [limit]);
            console.log(`✅ ${result.rowCount} CPs actualizados.`);
        }

        res.json({ success: true, key, value });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error saving setting' });
    }
});

// POST geocode address
router.post('/settings/geocode', async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address is required' });

    try {
        const geoData = await geocodeAddress(address);
        if (geoData) {
            res.json({
                lat: geoData.lat,
                lng: geoData.lng,
                formattedAddress: geoData.formattedAddress
            });
        } else {
            res.status(404).json({ error: 'No se pudo encontrar la ubicación' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error en el servicio de geocodificación' });
    }
});

// SSE Endpoint for Pregress
let clients = [];

router.get('/settings/recalc/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    console.log('Cliente SSE conectado para progreso de precálculo');

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

// Broadcast helper
const sendProgress = (current, total) => {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ current, total })}\n\n`);
    });
};

// Trigger Recalculation
const precalcService = require('../services/precalc');

router.post('/settings/recalc', async (req, res) => {
    console.log('Iniciando precálculo solicitado por usuario...');
    // Start async process (don't wait)
    precalcService.runPrecalculation((current, total) => {
        sendProgress(current, total);
    });

    res.json({ message: 'Calculation started' });
});

module.exports = router;

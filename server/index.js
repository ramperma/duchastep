const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const initDb = require('./initDb');
const path = require('path');

dotenv.config();

// Initialize DB
initDb().then(() => {
  console.log('Database check completed.');
}).catch(console.error);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', apiRoutes);
app.use('/api', authRoutes);
app.use('/api', settingsRoutes);

app.get('/', (req, res) => {
  res.send('Duchastep API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

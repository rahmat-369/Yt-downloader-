import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import ytdlRouter from './api/ytdl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware penting!
app.use(cors({
    origin: '*', // Biar bisa diakses dari mana aja
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(__dirname)); // Serve file static

// Routes
app.use('/api', ytdlRouter);

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`✅ SERVER JALAN DI http://localhost:${PORT}`);
    console.log(`🔍 Test search: http://localhost:${PORT}/api/search?q=test`);
    console.log(`📁 Frontend: http://localhost:${PORT}`);
});

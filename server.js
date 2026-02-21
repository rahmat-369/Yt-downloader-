import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import yts from 'yt-search';
import { exec } from 'child_process';
import fs from 'fs';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Buat folder downloads kalau belum ada
if (!fs.existsSync('downloads')) {
    fs.mkdirSync('downloads');
}

// Fungsi download pake yt-dlp
async function downloadWithYtDlp(videoId, format = 'mp3', quality = '128') {
    try {
        const url = `https://youtu.be/${videoId}`;
        const outputDir = path.join(__dirname, 'downloads');
        let command;
        
        if (format === 'mp3') {
            // Download audio
            command = `yt-dlp -x --audio-format mp3 --audio-quality ${quality}k -o "${outputDir}/%(title)s.%(ext)s" ${url}`;
        } else {
            // Download video
            command = `yt-dlp -f "best[height<=${quality}]" -o "${outputDir}/%(title)s.%(ext)s" ${url}`;
        }
        
        console.log('Running command:', command);
        const { stdout, stderr } = await execPromise(command);
        
        // Cari file yang didownload
        const files = fs.readdirSync(outputDir);
        const latestFile = files
            .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time)[0];
        
        if (latestFile) {
            return `/downloads/${encodeURIComponent(latestFile.name)}`;
        }
        
        throw new Error('File tidak ditemukan');
    } catch (error) {
        console.error('Download error:', error);
        throw new Error('Gagal download: ' + error.message);
    }
}

// API Search
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        console.log('Search query:', q);
        
        if (!q) {
            return res.status(400).json({ error: 'Query diperlukan' });
        }

        // Cek apakah input adalah URL
        const isUrl = /youtu\.be|youtube\.com/.test(q);
        let videoId = null;
        let videos = [];

        if (isUrl) {
            // Extract video ID dari URL
            const match = q.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
            videoId = match ? match[1] : null;
        }

        if (videoId) {
            // Search by ID
            const video = await yts({ videoId });
            videos = [video];
        } else {
            // Search by keyword
            const search = await yts(q);
            videos = search.videos.slice(0, 12);
        }

        const formattedVideos = videos.map(v => ({
            videoId: v.videoId,
            title: v.title,
            thumbnail: v.thumbnail,
            timestamp: v.timestamp,
            views: v.views,
            author: v.author.name,
            url: v.url
        }));

        res.json({ success: true, videos: formattedVideos });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API Convert
app.post('/api/convert', async (req, res) => {
    try {
        const { videoId, format, quality } = req.body;
        console.log('Convert request:', { videoId, format, quality });

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID diperlukan' });
        }

        // Download pake yt-dlp
        const downloadUrl = await downloadWithYtDlp(videoId, format || 'mp3', quality || '128');
        
        res.json({ 
            success: true, 
            downloadUrl,
            format: format || 'mp3',
            quality: quality || '128'
        });

    } catch (error) {
        console.error('Convert error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bersihin file lama (optional)
setInterval(() => {
    const downloadsDir = path.join(__dirname, 'downloads');
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();
    
    files.forEach(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        
        // Hapus file lebih dari 1 jam
        if (age > 3600000) {
            fs.unlinkSync(filePath);
            console.log('Deleted old file:', file);
        }
    });
}, 3600000); // Setiap jam

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ SERVER JALAN DI http://localhost:${PORT}`);
    console.log(`📁 Download folder: ${path.join(__dirname, 'downloads')}`);
    console.log(`🔍 Test API: http://localhost:${PORT}/api/search?q=test`);
}); 

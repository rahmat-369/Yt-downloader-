import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import yts from 'yt-search';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// KONFIGURASI DARI KODE LU
const qualityvideo = ['144', '240', '360', '720', '1080'];
const qualityaudio = ['128', '320'];
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
    'Accept': '*/*',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://iframe.y2meta-uk.com',
    'Referer': 'https://iframe.y2meta-uk.com/'
};

// HELPER FUNCTIONS (ASLI DARI KODE LU)
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ekstrakid(url) {
    const p = /(?:youtu.be\/|youtube.com\/(?:watch?v=|shorts\/|live\/|embed\/))([a-zA-Z0-9_-]{11})/;
    const m = url.match(p);
    return m ? m[1] : null;
}

async function getkey() {
    const r = await axios.get('https://cnv.cx/v2/sanity/key', { headers });
    return r.data.key;
}

async function y2mate(videoId, format = 'mp3', quality = null) {
    const key = await getkey();
    const isVideo = format === 'mp4';
    const q = String(quality || (isVideo ? '720' : '128'));

    const r = await axios.post('https://cnv.cx/v2/converter',  
        new URLSearchParams({  
            link: `https://youtu.be/${videoId}`,  
            format,  
            audioBitrate: isVideo ? '128' : (qualityaudio.includes(q) ? q : '128'),  
            videoQuality: isVideo ? (qualityvideo.includes(q) ? q : '720') : '720',  
            filenameStyle: 'pretty',  
            vCodec: 'h264'  
        }).toString(),  
        { headers: { ...headers, key } }  
    );

    let res = r.data;
    if (res.status === 'tunnel' && res.url) return res.url;

    for (let i = 0; i < 20; i++) {
        await sleep(2500);
        const s = await axios.get(`https://cnv.cx/v2/status/${res.jobId}`, { headers });
        if (s.data.status === 'completed' && s.data.url) return s.data.url;
        if (s.data.status === 'error') throw new Error('Gagal mengonversi video');
    }
    throw new Error('Waktu tunggu habis (Timeout)');
}

// API SEARCH (TEST INI DULU!)
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        console.log('Search query:', q);
        
        if (!q) {
            return res.status(400).json({ error: 'Query diperlukan' });
        }

        const isUrl = /youtu\.be|youtube\.com/.test(q);
        let videoId = isUrl ? ekstrakid(q) : null;
        let videos = [];

        if (videoId) {
            const video = await yts({ videoId });
            videos = [video];
        } else {
            const search = await yts(q);
            videos = search.videos.slice(0, 10);
        }

        const formatted = videos.map(v => ({
            videoId: v.videoId,
            title: v.title,
            thumbnail: v.thumbnail,
            timestamp: v.timestamp,
            views: v.views,
            author: v.author
        }));

        res.json({ success: true, videos: formatted });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API CONVERT
app.post('/api/convert', async (req, res) => {
    try {
        const { videoId, format, quality } = req.body;
        console.log('Convert:', videoId, format, quality);

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID diperlukan' });
        }

        const downloadUrl = await y2mate(videoId, format || 'mp3', quality || '128');
        res.json({ success: true, downloadUrl });
    } catch (error) {
        console.error('Convert error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ SERVER JALAN DI http://localhost:${PORT}`);
    console.log(`🔍 TEST API: http://localhost:${PORT}/api/search?q=test`);
    console.log(`📁 Pastikan ini muncul JSON, BUKAN HTML!`);
});

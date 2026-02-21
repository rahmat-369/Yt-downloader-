import yts from 'yt-search';
import axios from 'axios';
import express from 'express';

const router = express.Router();

// Konfigurasi API & Headers (ASLI DARI KODE LU)
const qualityvideo = ['144', '240', '360', '720', '1080'];
const qualityaudio = ['128', '320'];
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept': '*/*',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://iframe.y2meta-uk.com',
    'Referer': 'https://iframe.y2meta-uk.com/'
};

// Helper Functions (ASLI DARI KODE LU)
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

    // Create Job  
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

    // Polling Status  
    for (let i = 0; i < 20; i++) {  
        await sleep(2500);  
        const s = await axios.get(`https://cnv.cx/v2/status/${res.jobId}`, { headers });  
        if (s.data.status === 'completed' && s.data.url) return s.data.url;  
        if (s.data.status === 'error') throw new Error('Gagal mengonversi video');  
    }  
    throw new Error('Waktu tunggu habis (Timeout)');
}

// ROUTES UNTUK WEB
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query diperlukan' });

        // Search Video (ASLI DARI KODE LU)
        const isUrl = /youtu\.be|youtube\.com/.test(q);
        let videoId = isUrl ? ekstrakid(q) : null;
        let video;
        let videos = [];

        if (videoId) {
            video = await yts({ videoId });
            videos = [video];
        } else {
            let search = await yts(q);
            videos = search.videos.slice(0, 12); // Ambil 12 video
        }

        if (!videos.length) return res.status(404).json({ error: 'Video tidak ditemukan' });

        // Format response buat frontend
        const formattedVideos = videos.map(v => ({
            videoId: v.videoId,
            title: v.title,
            thumbnail: v.thumbnail || v.image,
            timestamp: v.timestamp,
            views: v.views,
            author: v.author,
            url: v.url
        }));

        res.json({ 
            success: true, 
            videos: formattedVideos 
        });

    } catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/convert', async (req, res) => {
    try {
        const { videoId, format, quality } = req.body;
        
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID diperlukan' });
        }

        // Pake fungsi Y2MATE ASLI DARI KODE LU
        const downloadUrl = await y2mate(videoId, format || 'mp3', quality || '128');

        res.json({ 
            success: true, 
            downloadUrl,
            format: format || 'mp3',
            quality: quality || '128'
        });

    } catch (e) {
        console.error('Convert error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;

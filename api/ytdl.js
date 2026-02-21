import express from 'express';
import cors from 'cors';
import yts from 'yt-search';
import axios from 'axios';

const router = express.Router();

// Config
const qualityvideo = ['144', '240', '360', '480', '720', '1080'];
const qualityaudio = ['128', '320'];
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
    'Accept': '*/*',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://iframe.y2meta-uk.com',
    'Referer': 'https://iframe.y2meta-uk.com/'
};

// Helper functions
function extractId(url) {
    const patterns = [
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function getKey() {
    try {
        const response = await axios.get('https://cnv.cx/v2/sanity/key', { 
            headers,
            timeout: 10000 
        });
        return response.data.key;
    } catch (error) {
        throw new Error('Gagal mendapatkan API key');
    }
}

async function convert(videoId, format = 'mp3', quality = null) {
    const key = await getKey();
    const isVideo = format === 'mp4';
    const q = String(quality || (isVideo ? '720' : '128'));

    // Create job
    const createResponse = await axios.post('https://cnv.cx/v2/converter',
        new URLSearchParams({
            link: `https://youtu.be/${videoId}`,
            format,
            audioBitrate: isVideo ? '128' : (qualityaudio.includes(q) ? q : '128'),
            videoQuality: isVideo ? (qualityvideo.includes(q) ? q : '720') : '720',
            filenameStyle: 'pretty',
            vCodec: 'h264'
        }).toString(),
        { 
            headers: { ...headers, key },
            timeout: 15000
        }
    );

    let result = createResponse.data;
    
    // If direct URL available
    if (result.status === 'tunnel' && result.url) {
        return result.url;
    }

    // Poll for status
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        
        const statusResponse = await axios.get(`https://cnv.cx/v2/status/${result.jobId}`, { 
            headers,
            timeout: 10000
        });
        
        if (statusResponse.data.status === 'completed' && statusResponse.data.url) {
            return statusResponse.data.url;
        }
        
        if (statusResponse.data.status === 'error') {
            throw new Error('Gagal mengkonversi video');
        }
    }
    
    throw new Error('Waktu konversi habis');
}

// Routes
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query diperlukan' });

        let videos = [];
        const videoId = extractId(q);

        if (videoId) {
            // Search by ID
            const video = await yts({ videoId });
            videos = [video];
        } else {
            // Search by keyword
            const search = await yts(q);
            videos = search.videos.slice(0, 12);
        }

        res.json({ 
            success: true, 
            videos: videos.map(v => ({
                videoId: v.videoId,
                title: v.title,
                thumbnail: v.thumbnail,
                timestamp: v.timestamp,
                views: v.views,
                author: v.author
            }))
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/convert', async (req, res) => {
    try {
        const { videoId, format, quality } = req.body;
        
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID diperlukan' });
        }

        const downloadUrl = await convert(videoId, format, quality);
        
        res.json({ 
            success: true, 
            downloadUrl,
            format,
            quality
        });
    } catch (error) {
        console.error('Convert error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

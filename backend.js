import express from 'express';
import cors from 'cors';
import yts from 'yt-search';
import { ekstrakid, y2mate } from './downloader.js'; // pake script lu

const app = express();
app.use(cors());
app.use(express.json());

app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        let videos = [];
        
        if (/youtu\.be|youtube\.com/.test(q)) {
            const videoId = ekstrakid(q);
            const video = await yts({ videoId });
            videos = [video];
        } else {
            const search = await yts(q);
            videos = search.videos.slice(0, 10);
        }
        
        res.json({ videos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/download', async (req, res) => {
    try {
        const { videoId, format, quality } = req.body;
        const downloadUrl = await y2mate(videoId, format, quality);
        res.json({ downloadUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('🔥 DARK NEXA BACKEND RUNNING DI PORT 3000');
});

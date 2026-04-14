require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET || 'secret';
const PASSWORD = process.env.PASSWORD || 'password';
const BASE_DIR = process.env.CREW_IMAGES_PATH;

app.use(cors());
app.use(express.json());

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    // allow token in query auth for media endpoints
    let token = req.query.token || req.headers['authorization'];
    
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length).trimLeft();
    }
    
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// Login Route
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        const token = jwt.sign({ authenticated: true }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Incorrect password' });
    }
});

// Helper function to resolve and check path bounds
const getSafePath = (targetPath) => {
    if (!targetPath) return BASE_DIR;
    
    // Normalize targetPath to handle forward/backward slashes correctly
    targetPath = targetPath.replace(/\\/g, '/');
    const safePath = path.normalize(path.join(BASE_DIR, targetPath));
    const normalizedBaseDir = path.normalize(BASE_DIR);
    
    if (!safePath.startsWith(normalizedBaseDir)) {
        throw new Error('Access denied');
    }
    return safePath;
};

const getContentTypeForExt = (ext) => {
    const map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mov': 'video/quicktime',
        '.7z': 'application/x-7z-compressed'
    };
    return map[ext] || 'application/octet-stream';
};

const isValidFile = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm', '.ogg', '.mov', '.7z'];
    return mediaExtensions.includes(ext);
};

app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ success: true });
});

// List Directory Contents
app.get('/api/contents', authenticateToken, (req, res) => {
    try {
        const dirPath = getSafePath(req.query.path);
        
        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        const contents = items
            .map(item => {
                const itemPath = path.join(dirPath, item.name);
                const isDir = item.isDirectory();
                
                if (!isDir && !isValidFile(item.name)) return null;

                let stats = null;
                try {
                    stats = fs.statSync(itemPath);
                } catch (err) {}

                return {
                    name: item.name,
                    isDirectory: isDir,
                    size: stats ? stats.size : 0,
                    lastModified: stats ? stats.mtime : null
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                if (!a.isDirectory) {
                    const isVid = (name) => ['.mp4', '.webm', '.ogg', '.mov'].includes(path.extname(name).toLowerCase());
                    const aVid = isVid(a.name);
                    const bVid = isVid(b.name);
                    if (aVid !== bVid) return aVid ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
            
        res.json(contents);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Invalid path' });
    }
});

// Stream Media Files
app.get('/api/media', authenticateToken, (req, res) => {
    try {
        const filePath = getSafePath(req.query.path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = getContentTypeForExt(ext);
        
        // Handle Range for videos
        const range = req.headers.range;
        if (range && contentType.startsWith('video/')) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Invalid file path' });
    }
});

// Download Route
app.get('/api/download', authenticateToken, (req, res) => {
    try {
        const filePath = getSafePath(req.query.path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.download(filePath);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Invalid file path' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

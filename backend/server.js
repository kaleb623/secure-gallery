const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pLimit = require('p-limit');
const sharp = require('sharp');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET || 'secret';
const PASSWORD = process.env.PASSWORD || 'password';
const BASE_DIR = path.resolve(process.env.CREW_IMAGES_PATH || path.join(__dirname, '../../Crew Images'));

console.log(`[Gallery] Media directory resolved to: ${BASE_DIR}`);
if (!fs.existsSync(BASE_DIR)) {
    console.warn(`[Gallery WARNING] Media directory does NOT exist at: ${BASE_DIR}`);
}

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

    jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }, (err, user) => {
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
    
    const relative = path.relative(normalizedBaseDir, safePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
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
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm', '.ogg', '.mov'];
    return mediaExtensions.includes(ext);
};

app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ success: true });
});

// List Directory Contents
app.get('/api/contents', authenticateToken, async (req, res) => {
    try {
        const dirPath = getSafePath(req.query.path);
        
        try {
            await fs.promises.access(dirPath);
        } catch {
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        const limit = pLimit(50);
        let contents = await Promise.all(items.map(item => limit(async () => {
            const itemPath = path.join(dirPath, item.name);
            const isDir = item.isDirectory();

            if (!isDir && !isValidFile(item.name)) return null;

            let stats = null;
            try {
                stats = await fs.promises.stat(itemPath);
            } catch (err) {}

            return {
                name: item.name,
                isDirectory: isDir,
                size: stats ? stats.size : 0,
                lastModified: stats ? stats.mtime : null
            };
        })));

        contents = contents
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

// Streamlined All-Media Index with Category Merging & Year/Month Hierarchy
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_LOWER_MAP = {};
MONTH_NAMES.forEach((m, idx) => {
    MONTH_LOWER_MAP[m.toLowerCase()] = { name: m, order: idx + 1 };
});

let mediaCache = {
    timestamp: 0,
    data: null
};

app.get('/api/all-media', authenticateToken, async (req, res) => {
    try {
        const now = Date.now();
        const forceRefresh = req.query.refresh === 'true';
        if (!forceRefresh && mediaCache.data && (now - mediaCache.timestamp < 60000)) {
            return res.json(mediaCache.data);
        }

        const allFiles = [];
        const categoryMap = {};
        const yearMonthMap = {};

        const limit = pLimit(50);

        const walkDir = async (currentDir, relativePath = '') => {
            let items = [];
            try {
                items = await fs.promises.readdir(currentDir, { withFileTypes: true });
            } catch (err) {
                return;
            }

            const filePromises = [];
            const dirPromises = [];

            for (const item of items) {
                const itemRelPath = relativePath ? path.join(relativePath, item.name).replace(/\\/g, '/') : item.name;
                const fullItemPath = path.join(currentDir, item.name);

                if (item.isDirectory()) {
                    // Do not wrap recursive directory calls in limit to prevent deadlock
                    dirPromises.push(walkDir(fullItemPath, itemRelPath));
                } else if (isValidFile(item.name)) {
                    filePromises.push(limit(async () => {
                        let stats = null;
                        try {
                            stats = await fs.promises.stat(fullItemPath);
                        } catch (err) {}

                        const pathParts = relativePath ? relativePath.replace(/\\/g, '/').split('/') : [];

                        // Extract Year and Month from path
                        let detectedYear = null;
                        let detectedMonth = null;
                        let detectedCategory = null;

                        for (const p of pathParts) {
                            const cleanP = p.trim();
                            // Year detection (e.g. 2020, 2021, 2022, 21020 typo, 21021 typo)
                            if (/2020|21020/.test(cleanP)) {
                                detectedYear = '2020';
                            } else if (/2021|21021/.test(cleanP)) {
                                detectedYear = '2021';
                            } else if (/2022/.test(cleanP)) {
                                detectedYear = '2022';
                            } else if (/^20\d\d$/.test(cleanP)) {
                                detectedYear = cleanP;
                            }

                            // Month detection
                            const lowerP = cleanP.toLowerCase();
                            if (MONTH_LOWER_MAP[lowerP]) {
                                detectedMonth = MONTH_LOWER_MAP[lowerP].name;
                            }
                        }

                        // Extract non-date descriptive category
                        for (let i = pathParts.length - 1; i >= 0; i--) {
                            const p = pathParts[i];
                            const isYr = /2020|2021|2022|21020|21021|^20\d\d$/.test(p);
                            const isMo = !!MONTH_LOWER_MAP[p.toLowerCase()];
                            if (!isYr && !isMo) {
                                detectedCategory = p;
                                break;
                            }
                        }

                        if (!detectedCategory) {
                            detectedCategory = pathParts.length > 0 ? pathParts[0] : 'Root';
                        }

                        // Normalize names like 'GTA World Camera Pics' / 'gta-world-camera'
                        if (/gta.*camera/i.test(detectedCategory)) {
                            detectedCategory = 'GTA World Camera';
                        }

                        // Aggregate category
                        categoryMap[detectedCategory] = (categoryMap[detectedCategory] || 0) + 1;

                        // Aggregate year/month
                        if (detectedYear) {
                            if (!yearMonthMap[detectedYear]) {
                                yearMonthMap[detectedYear] = { total: 0, months: {} };
                            }
                            yearMonthMap[detectedYear].total++;
                            if (detectedMonth) {
                                yearMonthMap[detectedYear].months[detectedMonth] = (yearMonthMap[detectedYear].months[detectedMonth] || 0) + 1;
                            }
                        }

                        allFiles.push({
                            name: item.name,
                            path: relativePath,
                            fullRelativePath: itemRelPath,
                            category: detectedCategory,
                            year: detectedYear,
                            month: detectedMonth,
                            size: stats ? stats.size : 0,
                            lastModified: stats ? stats.mtime : null
                        });
                    }));
                }
            }

            await Promise.all(filePromises);
            await Promise.all(dirPromises);
        };

        try {
            await fs.promises.access(BASE_DIR);
            await walkDir(BASE_DIR);
        } catch (err) {
            // BASE_DIR might not exist
        }

        // Custom ordering: 'Pics', 'Old GTAW', then rest by count
        const priorityCategories = ['Pics', 'Old GTAW'];
        const allCatNames = Object.keys(categoryMap);
        
        const sortedCategories = allCatNames
            .map(name => ({ name, count: categoryMap[name] }))
            .sort((a, b) => {
                const aPrio = priorityCategories.indexOf(a.name);
                const bPrio = priorityCategories.indexOf(b.name);
                if (aPrio !== -1 && bPrio !== -1) return aPrio - bPrio;
                if (aPrio !== -1) return -1;
                if (bPrio !== -1) return 1;
                return b.count - a.count;
            });

        // Format Year / Month Tree (Months sorted chronologically)
        const yearsTree = Object.keys(yearMonthMap)
            .sort()
            .map(yr => {
                const yrData = yearMonthMap[yr];
                const sortedMonths = MONTH_NAMES
                    .filter(m => yrData.months[m])
                    .map(m => ({
                        name: m,
                        count: yrData.months[m]
                    }));

                return {
                    year: yr,
                    total: yrData.total,
                    months: sortedMonths
                };
            });

        mediaCache = {
            timestamp: now,
            data: {
                total: allFiles.length,
                categories: sortedCategories,
                yearsTree: yearsTree,
                files: allFiles
            }
        };

        res.json(mediaCache.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to index media files' });
    }
});


const CACHE_DIR = path.join(__dirname, '.cache/thumbnails');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Global queue for image processing to prevent CPU overload
const imageProcessingLimit = pLimit(4); // 4 concurrent sharp tasks

// Generate and serve optimized WebP thumbnails
app.get('/api/thumbnail', authenticateToken, async (req, res) => {
    try {
        const filePath = getSafePath(req.query.path);

        try {
            await fs.promises.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }

        const ext = path.extname(filePath).toLowerCase();

        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
            const stat = await fs.promises.stat(filePath);
            const hash = crypto.createHash('md5').update(filePath + stat.mtimeMs).digest('hex');
            const cachedThumbPath = path.join(CACHE_DIR, `${hash}.webp`);

            try {
                await fs.promises.access(cachedThumbPath);
                // Serve cached thumbnail
                res.writeHead(200, {
                    'Content-Type': 'image/webp',
                    'Cache-Control': 'public, max-age=864000'
                });
                return fs.createReadStream(cachedThumbPath).pipe(res);
            } catch (err) {
                // Cached file does not exist, queue processing
                await imageProcessingLimit(async () => {
                    try {
                        // Check again in case it was processed while we waited in queue
                        try {
                            await fs.promises.access(cachedThumbPath);
                        } catch {
                            await sharp(filePath)
                                .rotate() // auto-rotate based on EXIF data
                                .resize({ width: 300, withoutEnlargement: true })
                                .webp({ quality: 75 })
                                .toFile(cachedThumbPath);
                        }
                    } catch (sharpError) {
                        // Ignore corrupt files during thumbnail generation, will just fall back
                        console.error('Sharp processing error:', sharpError);
                    }
                });

                try {
                    await fs.promises.access(cachedThumbPath);
                    res.writeHead(200, {
                        'Content-Type': 'image/webp',
                        'Cache-Control': 'public, max-age=864000'
                    });
                    fs.createReadStream(cachedThumbPath)
                        .on('error', () => { res.end(); })
                        .pipe(res);
                } catch {
                    // If generation failed, fallback to original
                    res.redirect(`/api/media?path=${encodeURIComponent(req.query.path)}&token=${req.query.token || ''}`);
                }
            }
        } else {
            // For videos, redirect to original media endpoint or let frontend handle
            res.redirect(`/api/media?path=${encodeURIComponent(req.query.path)}&token=${req.query.token || ''}`);
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Invalid file path' });
    }
});

// Stream Media Files
app.get('/api/media', authenticateToken, async (req, res) => {
    try {
        const filePath = getSafePath(req.query.path);
        
        try {
            await fs.promises.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stat = await fs.promises.stat(filePath);
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
app.get('/api/download', authenticateToken, async (req, res) => {
    try {
        const filePath = getSafePath(req.query.path);
        try {
            await fs.promises.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }
        res.download(filePath);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Invalid file path' });
    }
});

// Archive Info Endpoint
app.get('/api/archive-info', authenticateToken, async (req, res) => {
    try {
        if (process.env.ARCHIVE_DOWNLOAD_URL) {
            return res.json({
                exists: true,
                filename: 'Crew Images.7z',
                sizeFormatted: '10.6 GB',
                externalUrl: process.env.ARCHIVE_DOWNLOAD_URL
            });
        }

        const archivePath = path.join(BASE_DIR, 'Crew Images.7z');
        try {
            await fs.promises.access(archivePath);
            const stat = await fs.promises.stat(archivePath);
            return res.json({
                exists: true,
                filename: 'Crew Images.7z',
                sizeBytes: stat.size,
                sizeFormatted: `${(stat.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
            });
        } catch {
            // File does not exist, continue
        }

        let rootItems = [];
        try {
            rootItems = await fs.promises.readdir(BASE_DIR);
        } catch {
            return res.json({ exists: false });
        }

        const altArchive = rootItems.find(f => f.toLowerCase().endsWith('.7z') || f.toLowerCase().endsWith('.zip'));
        if (altArchive) {
            const altPath = path.join(BASE_DIR, altArchive);
            try {
                const stat = await fs.promises.stat(altPath);
                return res.json({
                    exists: true,
                    filename: altArchive,
                    sizeBytes: stat.size,
                    sizeFormatted: `${(stat.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
                });
            } catch {
                return res.json({ exists: false });
            }
        }
        res.json({ exists: false });
    } catch (error) {
        res.json({ exists: false });
    }
});

// Download Entire Archive
app.get('/api/download-archive', authenticateToken, async (req, res) => {
    try {
        if (process.env.ARCHIVE_DOWNLOAD_URL) {
            return res.redirect(process.env.ARCHIVE_DOWNLOAD_URL);
        }

        let archivePath = path.join(BASE_DIR, 'Crew Images.7z');
        try {
            await fs.promises.access(archivePath);
        } catch {
            let rootItems = [];
            try {
                rootItems = await fs.promises.readdir(BASE_DIR);
            } catch {
                return res.status(404).json({ error: 'Archive file not found' });
            }
            const altArchive = rootItems.find(f => f.toLowerCase().endsWith('.7z') || f.toLowerCase().endsWith('.zip'));
            if (altArchive) {
                archivePath = path.join(BASE_DIR, altArchive);
            } else {
                return res.status(404).json({ error: 'Archive file not found' });
            }
        }
        res.download(archivePath, path.basename(archivePath));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to download archive' });
    }
});

// Serve frontend build in production if available
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((req, res) => {
        // Don't intercept API routes that 404
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

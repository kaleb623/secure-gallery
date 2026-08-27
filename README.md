# Secure Gallery

A private, self-hosted media archive and secure web gallery built for browsing large photo and video collections.

## Features

- **Authenticated Access**: Password-protected session & token authentication.
- **Modern Web Interface**: Responsive React + Vite frontend with dynamic folder explorer, responsive grid view, and lightbox media player.
- **Optimized Backend**: Node.js & Express server with efficient streaming and directory traversal protection.
- **Media File Safety**: Excludes heavy media directories from version control while supporting local media indexing.

## Tech Stack

- **Frontend**: React, Vite, CSS
- **Backend**: Node.js, Express
- **Tooling**: npm workspaces / concurrently

## Getting Started

### 1. Install Dependencies
```bash
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configure Environment
Create a `.env` file in `backend/` with your credentials:
```env
PORT=5000
GALLERY_PASSWORD=your_secure_password
MEDIA_DIR="../Crew Images"
```

### 3. Run the App
```bash
# Start backend server
npm run server

# Start frontend dev server
npm run dev
```

---

## Credits & Acknowledgments

This project was built and maintained with the help of **Claude Code** (Anthropic) and **Gemini** (Google).

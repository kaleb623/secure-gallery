import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { VirtuosoGrid } from 'react-virtuoso';
import {
  Folder, Image as ImageIcon, Video as VideoIcon, File as FileIcon,
  ChevronRight, ChevronLeft, CornerUpLeft, LogOut, Download, Maximize2, X, Play
} from 'lucide-react';

const gridComponents = {
  List: React.forwardRef(({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '24px',
        padding: '24px'
      }}
    >
      {children}
    </div>
  )),
  Item: ({ style, children, ...props }) => (
    <div {...props} style={{ ...style, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  )
};

const MediaCard = ({ item, path, token, onClick }) => {
  const { ref, inView } = useInView({ rootMargin: '200px 0px', triggerOnce: true });

  const isVideo = item.name.match(/\.(mp4|webm|ogg|mov)$/i);
  const isArchive = item.name.match(/\.(7z|zip|rar)$/i);
  const mediaUrl = `http://localhost:3001/api/media?path=${encodeURIComponent(path ? path + '/' + item.name : item.name)}&token=${token}`;

  return (
    <div
      className="file-card"
      onClick={() => onClick(item)}
    >
      <div className="file-thumbnail-container" ref={ref}>
        {inView ? (
          isVideo ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              <VideoIcon size={64} color="#555" />
              <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: '6px', display: 'flex', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Play size={12} color="#fff" fill="#fff" />
              </div>
            </div>
          ) : isArchive ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.03)' }}>
              <FileIcon size={64} color="var(--accent)" />
            </div>
          ) : (
            <img src={mediaUrl} alt={item.name} className="file-thumbnail" loading="lazy" />
          )
        ) : (
          <div className="observer-placeholder" />
        )}
      </div>
      <span className="file-name" title={item.name}>{item.name}</span>
    </div>
  );
};

export default function Explorer({ token, onLogout }) {
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    fetchContents(currentPath);
  }, [currentPath]);

  const fetchContents = async (path) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/contents?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) onLogout();
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setContents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const navigateTo = (index) => {
    if (index === -1) {
      setCurrentPath('');
    } else {
      const parts = currentPath.split('/');
      setCurrentPath(parts.slice(0, index + 1).join('/'));
    }
  };

  const pathParts = currentPath ? currentPath.split('/') : [];

  const handleMediaClick = (item) => {
    setSelectedMedia(item);
  };

  const closeMedia = React.useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const isVideo = (name) => name.match(/\.(mp4|webm|ogg|mov)$/i);
  const isArchive = (name) => name.match(/\.(7z|zip|rar)$/i);

  const mediaFiles = useMemo(() => contents.filter(item => !item.isDirectory), [contents]);

  const handleNextMedia = React.useCallback((e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!selectedMedia) return;
    const currentIndex = mediaFiles.findIndex(item => item.name === selectedMedia.name);
    if (currentIndex !== -1 && currentIndex < mediaFiles.length - 1) {
      setSelectedMedia(mediaFiles[currentIndex + 1]);
    }
  }, [selectedMedia, mediaFiles]);

  const handlePrevMedia = React.useCallback((e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!selectedMedia) return;
    const currentIndex = mediaFiles.findIndex(item => item.name === selectedMedia.name);
    if (currentIndex > 0) {
      setSelectedMedia(mediaFiles[currentIndex - 1]);
    }
  }, [selectedMedia, mediaFiles]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedMedia) return;
      if (e.key === 'ArrowRight') {
        handleNextMedia(null);
      } else if (e.key === 'ArrowLeft') {
        handlePrevMedia(null);
      } else if (e.key === 'Escape') {
        closeMedia();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMedia, handleNextMedia, handlePrevMedia, closeMedia]);

  const getMediaUrl = (item) => {
    const p = currentPath ? `${currentPath}/${item.name}` : item.name;
    return `http://localhost:3001/api/media?path=${encodeURIComponent(p)}&token=${token}`;
  };

  const getDownloadUrl = (item) => {
    const p = currentPath ? `${currentPath}/${item.name}` : item.name;
    return `http://localhost:3001/api/download?path=${encodeURIComponent(p)}&token=${token}`;
  };

  return (
    <div className="app-container fade-in">
      <div className="top-bar">
        <div className="top-bar-path">
          <Folder size={16} color="var(--accent)" />
          <span className="path-part" onClick={() => navigateTo(-1)}>Crew Images</span>
          {pathParts.map((part, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChevronRight size={14} color="var(--text-secondary)" />
              <span className="path-part" onClick={() => navigateTo(idx)}>{part}</span>
            </span>
          ))}
        </div>
        <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Logout
        </button>
      </div>

      <div className="main-content">
        <div className="sidebar">
          <div className="sidebar-item" onClick={() => setCurrentPath('')} style={{ color: !currentPath ? 'var(--accent)' : '' }}>
            <Folder size={20} />
            <span>Root</span>
          </div>
          {currentPath && (
            <div className="sidebar-item" onClick={navigateUp}>
              <CornerUpLeft size={20} />
              <span>Go Up</span>
            </div>
          )}
        </div>

        <div className="gallery-view">
          {currentPath === '' && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              fontSize: '14px'
            }}>
              <p style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '15px' }}>
                💗 What's up gang I have decided to nuke the server but I didn't wanna get rid of our memories. I'm sorry for any crazy leaks, I did my best to filter the files and get rid of any trash / junk and to remove anything crazy sensitive or porn or what the fuck ever you degenerates posted in there but I couldn't get all of it. By no means is this a goodbye, I hope you're all doing well and if you ever wanna gayme or whatever just message me on Discord 😊
              </p>
              <p>
                To be clear the people I sent this to are Owen, Miki/Tomoe, Yoshi, Ava, Avis, Nightmare & Kris. I know not everyone is even in the server still from that list but I feel like that was the most "lasting" of this group by far and probably contributed the most to the server collectively, but if I'm somehow missing someone and I'm an actual piece of shit do send this to them. Again there's nothing really sensitive in here that I'm aware of and if there is one of you posted it in the discord so don't blame me unless I was the one that posted it I guess. Much love to you all, for being around when you were. My 20s were pretty miserable and I was masking it a lot of the time but I genuinely had tons of fun with yall and should it ever be goodbye I truly hope you all find whatever it is you're looking for in life. I'll pay to keep this website online for like a year but you can download the full archive whenever during that time frame.
              </p>
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              Loading contents...
            </div>
          ) : contents.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              This folder is empty.
            </div>
          ) : (
            <div className="fade-in" style={{ height: '100%', width: '100%' }}>
              <VirtuosoGrid
                style={{ height: '100%', width: '100%' }}
                data={contents}
                components={gridComponents}
                itemContent={(index, item) => (
                  item.isDirectory ? (
                    <div
                      className="file-card folder"
                      onClick={() => handleFolderClick(item.name)}
                      style={{ flex: 1 }}
                    >
                      <div className="file-thumbnail-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                        <Folder className="file-icon" style={{ width: '64px', height: '64px', margin: 0 }} />
                      </div>
                      <span className="file-name">{item.name}</span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <MediaCard
                        item={item}
                        path={currentPath}
                        token={token}
                        onClick={handleMediaClick}
                      />
                    </div>
                  )
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="modal-content glass">
              <button className="close-btn" onClick={closeMedia}><X /></button>

              {mediaFiles.findIndex(item => item.name === selectedMedia.name) > 0 && (
                <button className="nav-btn prev-btn" onClick={handlePrevMedia}>
                  <ChevronLeft size={36} color="white" />
                </button>
              )}

              {mediaFiles.findIndex(item => item.name === selectedMedia.name) < mediaFiles.length - 1 && (
                <button className="nav-btn next-btn" onClick={handleNextMedia}>
                  <ChevronRight size={36} color="white" />
                </button>
              )}

              {isVideo(selectedMedia.name) ? (
                <video
                  src={getMediaUrl(selectedMedia)}
                  className="modal-media"
                  controls
                  autoPlay
                />
              ) : isArchive(selectedMedia.name) ? (
                <div className="modal-media glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', maxWidth: '500px', textAlign: 'center' }}>
                  <FileIcon size={80} color="var(--accent)" style={{ marginBottom: '24px' }} />
                  <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Server Archive</h2>
                  <p style={{ color: '#ffaaaa', marginBottom: '8px', fontWeight: 'bold' }}>Warning: TS IS (12GB+)</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>

                  </p>
                </div>
              ) : (
                <img
                  src={getMediaUrl(selectedMedia)}
                  className="modal-media"
                  alt={selectedMedia.name}
                />
              )}

              <div style={{ marginTop: '16px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', wordBreak: 'break-all', textAlign: 'center', maxWidth: '80vw' }}>
                {selectedMedia.name}
              </div>

              <div className="modal-controls">
                {!isArchive(selectedMedia.name) && (
                  <a href={getMediaUrl(selectedMedia)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="modal-btn">
                      <Maximize2 size={18} /> Open Direct Link
                    </button>
                  </a>
                )}
                <a href={getDownloadUrl(selectedMedia)} style={{ textDecoration: 'none' }}>
                  <button className="modal-btn" style={{ background: 'var(--accent)' }}>
                    <Download size={18} /> Download
                  </button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { VirtuosoGrid } from 'react-virtuoso';
import {
  Folder, Image as ImageIcon, Video as VideoIcon, File as FileIcon, LayoutGrid,
  ChevronRight, ChevronLeft, ChevronDown, CornerUpLeft, LogOut, Download, Maximize2, X, Play,
  Search, Sparkles, FolderTree, Layers, Calendar, Clock, Archive
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

const MediaCard = ({ item, path, token, onClick, showCategory = false }) => {
  const { ref, inView } = useInView({ rootMargin: '200px 0px', triggerOnce: true });

  const isVideo = item.name.match(/\.(mp4|webm|ogg|mov)$/i);
  const isArchive = item.name.match(/\.(7z|zip|rar)$/i);
  const itemPath = item.fullRelativePath || (path ? `${path}/${item.name}` : item.name);
  const mediaUrl = `/api/media?path=${encodeURIComponent(itemPath)}&token=${token}`;

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span className="file-name" title={item.name}>{item.name}</span>
        {showCategory && item.category && item.category !== 'Root' && (
          <span className="category-tag">
            {item.category}{item.year ? ` • ${item.year}` : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export default function Explorer({ token, onLogout }) {
  // Browsing Mode: 'streamlined' vs 'explorer' (Full Cruise)
  const [viewMode, setViewMode] = useState('streamlined');

  // Explorer (Full Cruise) Mode State
  const [currentPath, setCurrentPath] = useState('');
  const [explorerContents, setExplorerContents] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(false);

  // Streamlined Mode State
  const [allMediaData, setAllMediaData] = useState({ total: 0, categories: [], yearsTree: [], files: [] });
  // selectedScope: { type: 'all' | 'category' | 'year' | 'year_month', value: string, year?: string, month?: string }
  const [selectedScope, setSelectedScope] = useState({ type: 'all' });
  const [expandedYears, setExpandedYears] = useState({ '2020': true, '2021': true, '2022': true });
  const [streamlinedLoading, setStreamlinedLoading] = useState(false);

  // 7z Archive Info & Modal State
  const [archiveInfo, setArchiveInfo] = useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Shared Filter & Sort State
  const [filterType, setFilterType] = useState('all'); // 'all', 'images', 'videos'
  const [sortBy, setSortBy] = useState('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Fetch Archive Info on mount
  useEffect(() => {
    fetch('/api/archive-info', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data && data.exists) setArchiveInfo(data);
    })
    .catch(() => {});
  }, [token]);

  // Fetch Explorer (hierarchical) contents
  useEffect(() => {
    if (viewMode === 'explorer') {
      fetchExplorerContents(currentPath);
    }
  }, [currentPath, viewMode]);

  // Fetch Streamlined All-Media Index
  useEffect(() => {
    if (viewMode === 'streamlined' && allMediaData.files.length === 0) {
      fetchAllMedia();
    }
  }, [viewMode]);

  const fetchExplorerContents = async (path) => {
    setExplorerLoading(true);
    try {
      const res = await fetch(`/api/contents?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) onLogout();
        throw new Error('Failed to fetch contents');
      }
      const data = await res.json();
      setExplorerContents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setExplorerLoading(false);
    }
  };

  const fetchAllMedia = async () => {
    setStreamlinedLoading(true);
    try {
      const res = await fetch('/api/all-media', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) onLogout();
        throw new Error('Failed to index media');
      }
      const data = await res.json();
      setAllMediaData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setStreamlinedLoading(false);
    }
  };

  const isVideo = (name) => name && name.match(/\.(mp4|webm|ogg|mov)$/i);
  const isImage = (name) => name && name.match(/\.(jpe?g|png|gif|webp|bmp)$/i);
  const isArchive = (name) => name && name.match(/\.(7z|zip|rar)$/i);

  const toggleYearExpand = (year, e) => {
    if (e) e.stopPropagation();
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  // Active dataset depending on mode and selected scope
  const rawContents = useMemo(() => {
    if (viewMode === 'explorer') {
      return explorerContents;
    }
    // Streamlined Mode Scoping
    if (selectedScope.type === 'all') {
      return allMediaData.files;
    }
    if (selectedScope.type === 'category') {
      return allMediaData.files.filter(f => f.category === selectedScope.value);
    }
    if (selectedScope.type === 'year') {
      return allMediaData.files.filter(f => f.year === selectedScope.value);
    }
    if (selectedScope.type === 'year_month') {
      return allMediaData.files.filter(f => f.year === selectedScope.year && f.month === selectedScope.month);
    }
    return allMediaData.files;
  }, [viewMode, explorerContents, allMediaData, selectedScope]);

  // Counts calculation
  const counts = useMemo(() => {
    let images = 0, videos = 0, folders = 0;
    rawContents.forEach(item => {
      if (item.isDirectory) folders++;
      else if (isVideo(item.name)) videos++;
      else if (isImage(item.name)) images++;
    });
    return { images, videos, folders, all: rawContents.length };
  }, [rawContents]);

  // Filtered & Sorted items for current view
  const displayContents = useMemo(() => {
    let list = rawContents.filter(item => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCat = item.category ? item.category.toLowerCase().includes(query) : false;
        const matchYr = item.year ? item.year.includes(query) : false;
        const matchMo = item.month ? item.month.toLowerCase().includes(query) : false;
        if (!matchName && !matchCat && !matchYr && !matchMo) return false;
      }
      // Type filter
      if (filterType === 'images') {
        return item.isDirectory || isImage(item.name);
      }
      if (filterType === 'videos') {
        return item.isDirectory || isVideo(item.name);
      }
      return true;
    });

    // Sorting
    return [...list].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name, undefined, { numeric: true });
      }
      if (sortBy === 'date-desc') {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === 'size-desc') {
        return (b.size || 0) - (a.size || 0);
      }
      return 0;
    });
  }, [rawContents, filterType, sortBy, searchQuery]);

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

  const closeMedia = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const mediaFiles = useMemo(() => displayContents.filter(item => !item.isDirectory), [displayContents]);

  const handleNextMedia = useCallback((e) => {
    if (e) e.stopPropagation();
    if (!selectedMedia) return;
    const currentIndex = mediaFiles.findIndex(item => (item.fullRelativePath || item.name) === (selectedMedia.fullRelativePath || selectedMedia.name));
    if (currentIndex !== -1 && currentIndex < mediaFiles.length - 1) {
      setSelectedMedia(mediaFiles[currentIndex + 1]);
    }
  }, [selectedMedia, mediaFiles]);

  const handlePrevMedia = useCallback((e) => {
    if (e) e.stopPropagation();
    if (!selectedMedia) return;
    const currentIndex = mediaFiles.findIndex(item => (item.fullRelativePath || item.name) === (selectedMedia.fullRelativePath || selectedMedia.name));
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
    const p = item.fullRelativePath || (currentPath ? `${currentPath}/${item.name}` : item.name);
    return `/api/media?path=${encodeURIComponent(p)}&token=${token}`;
  };

  const getDownloadUrl = (item) => {
    const p = item.fullRelativePath || (currentPath ? `${currentPath}/${item.name}` : item.name);
    return `/api/download?path=${encodeURIComponent(p)}&token=${token}`;
  };

  const isLoading = viewMode === 'explorer' ? explorerLoading : streamlinedLoading;

  // Title rendering helper for Streamlined mode
  const getStreamlinedTitle = () => {
    if (selectedScope.type === 'all') return 'All Merged Media';
    if (selectedScope.type === 'category') return `Collection: ${selectedScope.value}`;
    if (selectedScope.type === 'year') return `Year: ${selectedScope.value}`;
    if (selectedScope.type === 'year_month') return `${selectedScope.year} › ${selectedScope.month}`;
    return 'Streamlined Feed';
  };

  return (
    <div className="app-container fade-in">
      {/* Top Header */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Mode Switcher */}
          <div className="view-mode-toggle">
            <button
              className={`mode-btn ${viewMode === 'streamlined' ? 'active' : ''}`}
              onClick={() => setViewMode('streamlined')}
              title="Browse merged collections & timeline across all folders"
            >
              <Sparkles size={14} />
              Streamlined Mode
            </button>
            <button
              className={`mode-btn ${viewMode === 'explorer' ? 'active' : ''}`}
              onClick={() => setViewMode('explorer')}
              title="Full cruise folder tree explorer"
            >
              <FolderTree size={14} />
              Full Cruise
            </button>
          </div>

          {/* Breadcrumb path / Title */}
          {viewMode === 'explorer' ? (
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
          ) : (
            <div className="top-bar-path">
              {selectedScope.type === 'year' || selectedScope.type === 'year_month' ? (
                <Calendar size={16} color="var(--accent)" />
              ) : (
                <Layers size={16} color="var(--accent)" />
              )}
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {getStreamlinedTitle()}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {archiveInfo && archiveInfo.exists && (
            <button
              className="archive-download-btn"
              onClick={() => setShowArchiveModal(true)}
              title="Download entire 10.8 GB compressed media archive"
            >
              <Archive size={15} />
              <span>Download Entire Archive</span>
              <span className="archive-size-pill">{archiveInfo.sizeFormatted}</span>
            </button>
          )}

          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        {/* Sidebar */}
        <div className="sidebar">
          {viewMode === 'streamlined' ? (
            <>
              {/* Collections Section */}
              <div className="sidebar-heading">
                <Layers size={13} />
                Collections
              </div>

              {/* All Media */}
              <div
                className={`sidebar-item ${selectedScope.type === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedScope({ type: 'all' })}
                style={{ color: selectedScope.type === 'all' ? 'var(--accent)' : '' }}
              >
                <LayoutGrid size={17} />
                <span>All Media</span>
                <span className="category-badge">{allMediaData.total || 0}</span>
              </div>

              {/* Categories ('Pics', 'Old GTAW' first, then others) */}
              {allMediaData.categories && allMediaData.categories.map((cat) => (
                <div
                  key={cat.name}
                  className={`sidebar-item ${selectedScope.type === 'category' && selectedScope.value === cat.name ? 'active' : ''}`}
                  onClick={() => setSelectedScope({ type: 'category', value: cat.name })}
                  style={{
                    color: selectedScope.type === 'category' && selectedScope.value === cat.name ? 'var(--accent)' : '',
                    fontWeight: (cat.name === 'Pics' || cat.name === 'Old GTAW') ? '600' : 'normal'
                  }}
                >
                  <Folder size={17} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                  <span className="category-badge">{cat.count}</span>
                </div>
              ))}

              <div className="sidebar-divider" />

              {/* Timeline (Years & Ordered Months) Section */}
              <div className="sidebar-heading">
                <Calendar size={13} />
                Timeline
              </div>

              {allMediaData.yearsTree && allMediaData.yearsTree.map((yrItem) => {
                const isExpanded = expandedYears[yrItem.year] !== false;
                const isYearSelected = selectedScope.type === 'year' && selectedScope.value === yrItem.year;

                return (
                  <div key={yrItem.year} style={{ marginBottom: '2px' }}>
                    {/* Year Header */}
                    <div
                      className={`sidebar-year-header ${isYearSelected ? 'active' : ''}`}
                      onClick={() => setSelectedScope({ type: 'year', value: yrItem.year })}
                      style={{ color: isYearSelected ? 'var(--accent)' : '' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          onClick={(e) => toggleYearExpand(yrItem.year, e)}
                          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px' }}
                        >
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                        <span>{yrItem.year}</span>
                      </div>
                      <span className="category-badge">{yrItem.total}</span>
                    </div>

                    {/* Nested Months (in chronological calendar order) */}
                    {isExpanded && (
                      <div className="fade-in">
                        {yrItem.months.map((mo) => {
                          const isMonthSelected = selectedScope.type === 'year_month' && selectedScope.year === yrItem.year && selectedScope.month === mo.name;

                          return (
                            <div
                              key={mo.name}
                              className={`sidebar-subitem ${isMonthSelected ? 'active' : ''}`}
                              onClick={() => setSelectedScope({ type: 'year_month', year: yrItem.year, month: mo.name })}
                              style={{ color: isMonthSelected ? 'var(--accent)' : '' }}
                            >
                              <Clock size={13} style={{ opacity: 0.6 }} />
                              <span style={{ flex: 1 }}>{mo.name}</span>
                              <span className="category-badge">{mo.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {/* Explorer / Full Cruise Mode Navigation */}
              <div className="sidebar-heading">
                <FolderTree size={13} />
                Navigation
              </div>
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
            </>
          )}
        </div>

        {/* Gallery View */}
        <div className="gallery-view">
          {/* Filter & Sort Toolbar */}
          <div className="filter-toolbar">
            <div className="filter-group">
              <button
                className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                <LayoutGrid size={14} />
                All
                <span className="filter-count">{counts.all}</span>
              </button>
              <button
                className={`filter-pill ${filterType === 'images' ? 'active' : ''}`}
                onClick={() => setFilterType('images')}
              >
                <ImageIcon size={14} />
                Photos
                <span className="filter-count">{counts.images}</span>
              </button>
              <button
                className={`filter-pill ${filterType === 'videos' ? 'active' : ''}`}
                onClick={() => setFilterType('videos')}
              >
                <VideoIcon size={14} />
                Videos
                <span className="filter-count">{counts.videos}</span>
              </button>
            </div>

            <div className="toolbar-controls">
              <div className="search-box">
                <Search size={14} color="var(--text-secondary)" />
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <X
                    size={14}
                    style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                    onClick={() => setSearchQuery('')}
                  />
                )}
              </div>

              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="default">Sort: Default</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="date-desc">Newest First</option>
                <option value="size-desc">Largest Size</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              Loading contents...
            </div>
          ) : displayContents.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              {searchQuery || filterType !== 'all' ? 'No matching items found.' : 'This folder is empty.'}
            </div>
          ) : (
            <div className="fade-in" style={{ height: '100%', width: '100%' }}>
              <VirtuosoGrid
                style={{ height: '100%', width: '100%' }}
                data={displayContents}
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
                        showCategory={viewMode === 'streamlined'}
                      />
                    </div>
                  )
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Downloading Entire Archive */}
      <AnimatePresence>
        {showArchiveModal && archiveInfo && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ zIndex: 2000 }}
          >
            <motion.div
              className="modal-content glass"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ maxWidth: '520px', padding: '36px 32px', textAlign: 'center' }}
            >
              <div style={{
                background: 'rgba(0, 120, 212, 0.15)',
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                border: '1px solid rgba(0, 120, 212, 0.3)'
              }}>
                <Archive size={34} color="var(--accent)" />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
                Download Full Server Archive
              </h2>

              <div style={{
                background: 'rgba(255, 170, 0, 0.1)',
                border: '1px solid rgba(255, 170, 0, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <p style={{ color: '#ffd166', fontSize: '13.5px', lineHeight: '1.5', margin: 0, fontWeight: '500' }}>
                  ⚠️ <strong>Large File Notice:</strong>
                </p>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', marginTop: '6px', lineHeight: '1.5', marginBottom: 0 }}>
                  This is a <strong>{archiveInfo.sizeFormatted}</strong> compressed 7-Zip file (<code>{archiveInfo.filename}</code>) containing every single photo and video in the entire server archive.
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '8px', marginBottom: 0 }}>
                  Please ensure you have sufficient disk space and a reliable internet connection before starting the download.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowArchiveModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    padding: '10px 20px',
                    borderRadius: '6px'
                  }}
                >
                  Cancel
                </button>
                <a
                  href={`/api/download-archive?token=${token}`}
                  onClick={() => setShowArchiveModal(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <button style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600'
                  }}>
                    <Download size={16} />
                    <span>Download ({archiveInfo.sizeFormatted})</span>
                  </button>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Viewer Lightbox Modal */}
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

              {mediaFiles.findIndex(item => (item.fullRelativePath || item.name) === (selectedMedia.fullRelativePath || selectedMedia.name)) > 0 && (
                <button className="nav-btn prev-btn" onClick={handlePrevMedia}>
                  <ChevronLeft size={36} color="white" />
                </button>
              )}

              {mediaFiles.findIndex(item => (item.fullRelativePath || item.name) === (selectedMedia.fullRelativePath || selectedMedia.name)) < mediaFiles.length - 1 && (
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
                <a href={getMediaUrl(selectedMedia)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <button className="modal-btn">
                    <Maximize2 size={18} /> Open Direct Link
                  </button>
                </a>
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

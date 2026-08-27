import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Explorer from './components/Explorer';
import './index.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('gallery_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token with backend
      fetch('/api/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setToken(null);
          localStorage.removeItem('gallery_token');
        }
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('gallery_token');
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleLogin = (newToken) => {
    localStorage.setItem('gallery_token', newToken);
    setToken(newToken);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('gallery_token');
    setToken(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          !isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />
        } />
        <Route path="/*" element={
          isAuthenticated ? <Explorer token={token} onLogout={handleLogout} /> : <Navigate to="/login" />
        } />
      </Routes>
    </Router>
  );
}

export default App;

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok) {
        onLogin(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <motion.div 
        className="login-box"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      >
        <Eye 
          size={50} 
          style={{ 
            margin: '0 auto 50px', 
            color: '#fff', 
            opacity: 0.7,
            strokeWidth: 1.5
          }} 
        />
        
        <form className="login-form" onSubmit={handleSubmit}>
          <input 
            type="password" 
            placeholder=" " 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 0,
              padding: '10px 0',
              color: '#fff',
              textAlign: 'center',
              outline: 'none',
              boxShadow: 'none',
              letterSpacing: '5px',
              fontSize: '18px',
              width: '100%',
              transition: 'border-color 0.3s'
            }}
            onFocus={(e) => e.target.style.borderBottom = '1px solid rgba(255,255,255,0.6)'}
            onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(255,255,255,0.2)'}
          />
          {error && <div style={{ color: '#ff4444', fontSize: '13px', marginTop: '20px', letterSpacing: '1px' }}>REJECTED</div>}
        </form>
      </motion.div>
    </div>
  );
}

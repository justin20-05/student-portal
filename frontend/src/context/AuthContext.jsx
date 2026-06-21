import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/';
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      try {
        const base64Url = savedToken.split('.')[1];
        const payload = JSON.parse(window.atob(base64Url));
        
        if (Date.now() >= payload.issuedAt + (30 * 60 * 1000)) {
          logout();
        } else {
          setUser({ id: payload.id, name: payload.name, email: payload.email, role: payload.role, mfaEnabled: payload.mfaEnabled });
        }
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

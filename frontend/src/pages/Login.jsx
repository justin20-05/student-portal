import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../assets/Logo.jpg';
import background from '../assets/Background.jpg'; 

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Form Fields State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI Flow Control State
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Security Feedback State
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);

  // Active Lockout Countdown Handler
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatLockoutTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handlePrimaryLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError('Please enter both your email and password.');

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.requiresMfa) {
        setRequiresMfa(true);
        setTempToken(response.data.tempToken);
        setInfoMessage(response.data.message);
        setAttemptsRemaining(null);
      } else {
        completeLoginSession(response.data);
      }
    } catch (err) {
      const resData = err.response?.data;
      if (resData?.locked) {
        setLockoutSeconds(resData.remainingSeconds || 900);
        setError(resData.error);
      } else {
        setError(resData?.error || 'Authentication failed. Please verify credentials.');
        if (resData?.attemptsRemaining !== undefined) {
          setAttemptsRemaining(resData.attemptsRemaining);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerification = async (e) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.length !== 6) return setError('Please type a valid 6-digit verification code.');

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-mfa', { tempToken, code: mfaCode });
      completeLoginSession(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid authenticator code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeLoginSession = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    
    if (data.user.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/student');
    }
  };

  return (
    // Crimson gradient wrapper with relative positioning for the background layer
    <div className="min-h-screen flex items-center justify-center px-4 relative bg-gradient-to-br from-red-800 to-red-950 overflow-hidden">
      
      {/* Translucent Background Image Layer */}
      <div 
        className="absolute inset-0 z-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${background})` }}
      ></div>

      {/* Main Form Container (z-10 keeps it above the background image) */}
      <div className="relative z-10 max-w-md w-full bg-white rounded-2xl shadow-2xl border border-red-100 p-8 transition-all">
        
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src={logo} 
            alt="WMSU Logo" 
            className="h-16 w-16 rounded-xl shadow-lg shadow-red-200 mb-4 mx-auto object-cover" 
          />
          {/* Updated bold and visible crimson text */}
          <h2 className="text-3xl font-black tracking-tight" style={{ color: '#DC143C' }}>WMSU - Portal</h2>
          <p className="text-sm text-slate-600 mt-2 font-medium">Provide your credentials to access your academic dashboard</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg text-sm text-red-800 font-bold">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg text-sm text-red-800 font-bold">
            {infoMessage}
          </div>
        )}

        {attemptsRemaining !== null && attemptsRemaining > 0 && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 text-center font-bold shadow-inner">
            Security Warning: You have <span className="font-bold underline">{attemptsRemaining}</span> more login attempts before account lockout triggers.
          </div>
        )}

        {/* Main Interface Layout Controls */}
        {lockoutSeconds > 0 ? (
          <div className="text-center py-6">
            <p className="text-lg font-bold text-slate-900 mb-2">Login Window Suspended</p>
            <p className="text-sm text-slate-800 max-w-xs mx-auto mt-1 font-medium">Too many failed login attempts have been registered. Please wait:</p>
            <div className="mt-4 inline-block px-4 py-2 bg-slate-900 text-red-400 font-mono tracking-widest text-lg rounded-lg shadow-inner">
              {formatLockoutTime(lockoutSeconds)}
            </div>
          </div>
        ) : !requiresMfa ? (
          
          <form onSubmit={handlePrimaryLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">School Email Address</label>
              <input
                type="email"
                placeholder="username@portal.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition text-sm text-slate-900 shadow-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Account Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(passwordE) => setPassword(passwordE.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition text-sm text-slate-900 shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-xs font-bold text-red-600 hover:text-red-800 focus:outline-none bg-transparent"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-md hover:shadow-lg focus:outline-none disabled:opacity-50 text-sm mt-4"
            >
              {loading ? 'Authenticating secure connection...' : 'Verify Identity'}
            </button>
          </form>
        ) : (
          
          <form onSubmit={handleMfaVerification} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 text-center">6-Digit Authenticator OTP</label>
              <input
                type="text"
                maxLength="6"
                placeholder="000000"
                value={mfaCode}
                onChange={(mfaE) => setMfaCode(mfaE.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className="w-full text-center tracking-widest font-mono text-2xl px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition text-slate-900 shadow-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-md hover:shadow-lg focus:outline-none disabled:opacity-50 text-sm"
            >
              {loading ? 'Verifying MFA token security...' : 'Validate & Open Portal'}
            </button>

            <button
              type="button"
              onClick={() => { setRequiresMfa(false); setMfaCode(''); setError(''); }}
              className="w-full text-slate-600 hover:text-red-700 text-xs font-bold text-center transition block underline mt-2"
            >
              Return to primary login
            </button>
          </form>
        )}

        {/* Security Baseline Notice Footer bar */}
        <div className="mt-8 border-t border-slate-200 pt-5 text-center">
          <p className="text-[11px] text-slate-500 font-bold tracking-wide">End-to-End Sessions Guarded by CSRF, XSS, and MFA Tokens</p>
        </div>

      </div>
    </div>
  );
}
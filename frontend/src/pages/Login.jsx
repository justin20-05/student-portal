import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Form Fields State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');

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

  // Stage 1: Basic Password Verification Handshake
  const handlePrimaryLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError('Please enter both your email and password.');

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Handle Multi-Factor Access Request Step
      if (response.data.requiresMfa) {
        setRequiresMfa(true);
        setTempToken(response.data.tempToken);
        setInfoMessage(response.data.message);
        setAttemptsRemaining(null);
      } else {
        // Direct Login Action Success (MFA not turned on yet)
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

  // Stage 2: 6-Digit Authenticator Token Submission
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

  // Handle Post-Authentication Redirection Route Map
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 transition-all">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-indigo-600 text-white font-bold text-2xl shadow-lg shadow-indigo-200 mb-4">
            SP
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Secure Student Portal</h2>
          <p className="text-sm text-slate-500 mt-1">Provide your credentials to access your academic dashboard</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mb-6 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg text-sm text-indigo-700 font-medium">
            {infoMessage}
          </div>
        )}

        {attemptsRemaining !== null && attemptsRemaining > 0 && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-center font-medium">
            ⚠️ Security Warning: You have <span className="font-bold underline">{attemptsRemaining}</span> more login attempts before account lockout triggers.
          </div>
        )}

        {/* Main Interface Layout Controls */}
        {lockoutSeconds > 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🔒</div>
            <p className="text-sm font-semibold text-slate-700">Login Window Suspended</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">Too many failed login attempts have been registered. Please wait:</p>
            <div className="mt-4 inline-block px-4 py-2 bg-slate-900 text-amber-400 font-mono tracking-widest text-lg rounded-lg shadow-inner">
              {formatLockoutTime(lockoutSeconds)}
            </div>
          </div>
        ) : !requiresMfa ? (
          
          <form onSubmit={handlePrimaryLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">School Email Address</label>
              <input
                type="email"
                placeholder="username@portal.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Account Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(passwordE) => setPassword(passwordE.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition shadow-md hover:shadow-lg focus:outline-none disabled:opacity-50 text-sm mt-2"
            >
              {loading ? 'Authenticating secure connection...' : 'Verify Identity'}
            </button>
          </form>
        ) : (
          
          <form onSubmit={handleMfaVerification} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">6-Digit Authenticator OTP</label>
              <input
                type="text"
                maxLength="6"
                placeholder="000000"
                value={mfaCode}
                onChange={(mfaE) => setMfaCode(mfaE.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className="w-full text-center tracking-widest font-mono text-2xl px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition shadow-md hover:shadow-lg focus:outline-none disabled:opacity-50 text-sm"
            >
              {loading ? 'Verifying MFA token security...' : 'Validate & Open Portal'}
            </button>

            <button
              type="button"
              onClick={() => { setRequiresMfa(false); setMfaCode(''); setError(''); }}
              className="w-full text-slate-500 hover:text-slate-700 text-xs font-medium text-center transition block underline"
            >
              Return to primary login
            </button>
          </form>
        )}

        {/* Security Baseline Notice Footer bar */}
        <div className="mt-8 border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-400 font-medium tracking-wide">🛡️ End-to-End Sessions Guarded by CSRF, XSS, and MFA Tokens</p>
        </div>

      </div>
    </div>
  );
}

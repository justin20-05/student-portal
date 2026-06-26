import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../assets/Logo.jpg'; // Imported the WMSU logo

export default function AdminPanel() {
  const { user, logout, setUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  // MFA states
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [isMfaActive, setIsMfaActive] = useState(false);
  const [showMfaActivatedModal, setShowMfaActivatedModal] = useState(false);
  const [showMfaDeactivatedModal, setShowMfaDeactivatedModal] = useState(false);
  const [showMfaDisableConfirm, setShowMfaDisableConfirm] = useState(false);
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Password management states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handleNewPasswordChange = (e) => {
    const val = e.target.value;
    setNewPassword(val);
    setPasswordValidations({
      length: val.length >= 12,
      upper: /[A-Z]/.test(val),
      lower: /[a-z]/.test(val),
      number: /[0-9]/.test(val),
      special: /[!@#$%^&*]/.test(val)
    });
  };

  const isPasswordFullyValid = Object.values(passwordValidations).every(Boolean);

  const newPasswordLength = newPassword.length;
  const lengthPercent = Math.min(100, Math.round((newPasswordLength / 12) * 100));
  const lengthColorClass = newPasswordLength >= 12 ? 'bg-emerald-500' : 'bg-amber-400';

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordFullyValid) return; // Failsafe
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(response.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update credentials. Please match policy rules.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityLogs = async () => {
    setError('');
    setCurrentPage(1);
    try {
      const response = await api.get('/admin/logs');
      setLogs(response.data.logs || []);
    } catch (err) {
      setError('Access Denied: Unable to fetch secure system activity audits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityLogs();
    setIsMfaActive(user?.mfaEnabled || false);
  }, []);

  useEffect(() => {
    setIsMfaActive(user?.mfaEnabled || false);
  }, [user]);

  const initiateMfaEnrollment = async () => {
    setError('');
    try {
      const response = await api.post('/auth/setup-mfa');
      setQrCodeData(response.data.qrCode);
      setMfaSetupSecret(response.data.secret);
      setShowMfaModal(true);
    } catch (err) {
      setError('Could not initialize MFA setup.');
    }
  };

  const confirmMfaEnrollment = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/confirm-mfa', { code: mfaVerificationCode });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setUser(prev => ({ ...(prev || {}), mfaEnabled: true }));
      }
      setIsMfaActive(true);
      setShowMfaActivatedModal(true);
      setMfaVerificationCode('');
      setTimeout(() => setShowMfaModal(false), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaToggle = async () => {
    setError('');
    if (isMfaActive) {
      setShowMfaDisableConfirm(true);
    } else {
      initiateMfaEnrollment();
    }
  };

  const confirmMfaDisable = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/disable-mfa', { code: mfaDisableCode });
      if (response.data.token) localStorage.setItem('token', response.data.token);
      setIsMfaActive(false);
      setUser(prev => ({ ...(prev || {}), mfaEnabled: false }));
      setMfaDisableCode('');
      setShowMfaDisableConfirm(false);
      setShowMfaDeactivatedModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid MFA code.');
    } finally {
      setLoading(false);
    }
  };

  // Helper utility to apply clean aesthetic badges to event types
  const getBadgeStyle = (action) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
      case 'MFA_SUCCESS':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LOGIN_FAILED':
      case 'MFA_FAILED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOGIN_LOCKED':
        return 'bg-red-100 text-red-800 border-red-200 animate-pulse';
      case 'PASSWORD_CHANGED':
      case 'MFA_ENABLED':
        // Changed from indigo to red to match the crimson theme
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatLogTimestamp = (log) => {
    const timestamp = log.timestamp ?? log.created_at ?? log.createdAt;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Unknown timestamp' : date.toLocaleString();
  };

  const getLogValue = (log, camelKey, snakeKey) => log[camelKey] ?? log[snakeKey] ?? '';

  // Pagination calculations
  const totalPages = Math.ceil(logs.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedLogs = logs.slice(startIdx, endIdx);

  // Derived stats
  const actionCounts = useMemo(() => {
    const counts = {};
    for (const l of logs) {
      const action = (l.action || l.type || 'UNKNOWN').toString();
      counts[action] = (counts[action] || 0) + 1;
    }
    return counts;
  }, [logs]);

  const hourlyBins = useMemo(() => {
    const now = Date.now();
    const hours = 8; // last 8 hours
    const bins = new Array(hours).fill(0);
    for (const l of logs) {
      const ts = new Date(l.timestamp || l.created_at || l.createdAt).getTime();
      if (Number.isNaN(ts)) continue;
      const diffHours = Math.floor((now - ts) / (1000 * 60 * 60));
      if (diffHours >= 0 && diffHours < hours) {
        bins[hours - 1 - diffHours] += 1; // recent on right
      }
    }
    return bins;
  }, [logs]);

  function ActionBarChart({ logs }) {
    const counts = actionCounts;
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8);
    const max = entries.length ? Math.max(...entries.map(e => e[1])) : 1;
    return (
      <div className="space-y-3">
        {entries.map(([k,v]) => (
          <div key={k} className="flex items-center space-x-3">
            <div className="text-xs text-slate-600 w-36 truncate font-mono">{k}</div>
            <div className="flex-1 bg-slate-50 rounded-full h-3 relative">
              <div className="absolute left-0 top-0 h-3 rounded-full bg-emerald-400" style={{ width: `${(v/max)*100}%` }} />
            </div>
            <div className="w-12 text-right text-xs font-bold text-slate-700">{v}</div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-sm text-slate-500">No actions to display.</div>}
      </div>
    );
  }

  function EventsLineChart() {
    const bins = hourlyBins; // older..newer left->right
    const width = 500, height = 120, padding = 8;
    const max = Math.max(1, ...bins);
    const points = bins.map((v,i) => {
      const x = padding + (i * (width - padding*2) / (bins.length - 1 || 1));
      const y = padding + (1 - v/max) * (height - padding*2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <div className="overflow-auto">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <polyline fill="none" stroke="#10B981" strokeWidth="3" points={points} strokeLinejoin="round" strokeLinecap="round" />
          {bins.map((v,i) => {
            const x = padding + (i * (width - padding*2) / (bins.length - 1 || 1));
            const y = padding + (1 - v/max) * (height - padding*2);
            return <circle key={i} cx={x} cy={y} r={3} fill="#065f46" />;
          })}
        </svg>
        <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
          {Array.from({length: bins.length}).map((_,i) => (
            <div key={i} className="w-1/8 text-center">{`${bins.length-1-i}h`}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Admin Top Navigation Header - Now White with adjusted text colors */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3">
          {/* Replaced AP logo with the WMSU Logo.jpg */}
          <img 
            src={logo} 
            alt="WMSU Logo" 
            className="h-10 w-10 rounded-lg shadow-md object-cover border border-slate-100" 
          />
          <div>
            <span className="font-bold text-slate-900 tracking-tight block text-lg">WMSU-Portal</span>
            <span className="text-[10px] text-red-600 font-bold font-mono tracking-widest uppercase">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800">{user?.name || 'Administrator'}</p>
            <p className="text-[11px] text-emerald-600 font-bold">Root Access Node Active</p>
          </div>

          {/* Updated Log Out Button - Light red background with red text */}
          <button 
            onClick={() => setShowLogoutConfirm(true)} 
            className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 text-xs font-bold px-4 py-2 rounded-lg transition border border-red-200 shadow-sm cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* Security Credentials Control Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Security Credentials Control</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Manage administrator account security</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right flex flex-col justify-center">
                <p className="text-sm font-bold text-slate-800">Multi-Factor Authentication</p>
                <p className="text-xs text-slate-500">{isMfaActive ? 'Enabled' : 'Disabled'}</p>
              </div>
              <button onClick={handleMfaToggle} className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isMfaActive ? 'bg-red-600' : 'bg-slate-300'}`}>
                <span className={`pointer-events-none inline-block h-7.5 w-8 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${isMfaActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-600">Use the toggle to enable or disable MFA for this admin account. Enabling will require scanning a QR code with an authenticator app.</p>
          </div>
          <button onClick={() => { setError(''); setSuccess(''); setShowPasswordModal(true); }} className="w-full mt-4 py-2.5 text-center bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer">
            Modify Account Password
          </button>
        </div>
        
        {/* Summary Cards & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Events</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{logs.length}</p>
            <p className="text-xs text-slate-500 mt-2">Captured since service start</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Unique Identities</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{new Set(logs.map(l => (l.userId || l.user_id || l.identity || l.actor || 'anon'))).size}</p>
            <p className="text-xs text-slate-500 mt-2">Distinct identity nodes in view</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">MFA Events</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{logs.filter(l => /MFA|mfa/i.test(l.action)).length}</p>
            <p className="text-xs text-slate-500 mt-2">Enable / Disable / OTP activity</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Action Count Breakdown</h4>
            <ActionBarChart logs={logs} />
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Events Over Time (hours)</h4>
            <EventsLineChart logs={logs} />
          </div>
        </div>

        {/* Error Alert Display Block */}
        {error && !showMfaModal && !showMfaDisableConfirm && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-sm text-red-800 font-bold shadow-sm">
            {error}
          </div>
        )}

        {/* Audit Log Infrastructure Table Layout */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Real-Time Core Security Audit Log</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Immutable runtime application event logs tracing brute-force telemetry, identities, and session updates</p>
            </div>
            <button 
              onClick={() => { setLoading(true); fetchSecurityLogs(); }}
              className="self-start sm:self-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
            >
              Refresh Event Matrix
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-20 text-slate-500 text-sm font-bold animate-pulse">
                Parsing real-time security events...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-sm font-medium">
                No system activity log entries located inside buffer.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-3.5 px-6">Event Timestamp</th>
                    <th className="py-3.5 px-6">Action Flag</th>
                    <th className="py-3.5 px-6">Associated Identity Node</th>
                    <th className="py-3.5 px-6">Origin IP Address</th>
                    <th className="py-3.5 px-6">Contextual Metadata Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-xs text-slate-500 font-mono font-medium">
                        {formatLogTimestamp(log)}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md border shadow-sm ${getBadgeStyle(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700">
                        {getLogValue(log, 'userId', 'user_id') || <span className="text-slate-400 italic font-medium">Anonymous/Public</span>}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs font-medium text-slate-500">
                        {getLogValue(log, 'ip', 'ip_address')}
                      </td>
                      <td className="py-4 px-6">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <pre className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-slate-700 max-w-xs overflow-x-auto shadow-inner">
                            {typeof log.details === 'string'
                              ? log.details
                              : JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-medium">Empty context</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {logs.length > 0 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="text-xs text-slate-600 font-medium">
                Showing {startIdx + 1} to {Math.min(endIdx, logs.length)} of {logs.length} events
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                  disabled={currentPage === 1} 
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                >
                  ← Prev
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    return (
                      <button 
                        key={page} 
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                          currentPage === page 
                            ? 'bg-red-600 text-white' 
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} 
                  disabled={currentPage === totalPages} 
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
      {/* MFA MODALS */}
      {showMfaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 text-center border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-2">Register Multi-Factor</h3>
            <p className="text-xs font-medium text-slate-600 mb-5">Scan the QR with an authenticator app</p>
            {qrCodeData && (
              <div className="bg-slate-50 p-4 inline-block rounded-xl border border-slate-200 mb-4 shadow-inner">
                <img src={qrCodeData} alt="MFA QR" className="mx-auto" />
              </div>
            )}
            <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10px] font-mono text-center font-bold text-slate-800 break-all select-all mb-5 shadow-sm">
              Secret Key: {mfaSetupSecret}
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-bold">
                {error}
              </div>
            )}
            <form onSubmit={confirmMfaEnrollment} className="space-y-4">
              <input type="text" maxLength="6" placeholder="000000" value={mfaVerificationCode} onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-2xl font-mono font-bold border border-slate-300 text-slate-900 tracking-widest py-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 transition" required />
              <div className="flex space-x-3 mt-2">
                <button type="button" onClick={() => {setShowMfaModal(false); setIsMfaActive(false); setError('');}} className="flex-1 py-3 text-xs font-bold bg-slate-200 text-slate-800 rounded-xl hover:bg-slate-300 transition cursor-pointer">Dismiss</button>
                <button type="submit" className="flex-1 py-3 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-md cursor-pointer">Activate Protection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMfaActivatedModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-start justify-center p-6 z-50 pt-20">
          <div className="bg-emerald-600 text-white max-w-xs w-full rounded-xl shadow-xl p-4 border border-emerald-500 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-0.5">✓</div>
              <div className="flex-1">
                <h4 className="text-base font-black tracking-tight mb-1">Multi-Factor Activated</h4>
                <p className="text-xs leading-relaxed opacity-95 mb-3">Your account now requires an authenticator code for future sign-ins.</p>
                <button onClick={() => setShowMfaActivatedModal(false)} className="w-full py-2 px-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg transition duration-200 text-xs uppercase tracking-wide cursor-pointer">Got It</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMfaDisableConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-2">Disable Multi-Factor Authentication</h3>
            <p className="text-sm text-slate-600 mb-5">Enter your authenticator code to confirm disabling MFA for this account.</p>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-bold mb-4">{error}</div>}
            <form onSubmit={confirmMfaDisable} className="space-y-4">
              <input type="text" maxLength="6" placeholder="000000" value={mfaDisableCode} onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-2xl font-mono font-bold border border-slate-300 text-slate-900 tracking-widest py-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 transition" required />
              <div className="flex space-x-3">
                <button type="button" onClick={() => {setShowMfaDisableConfirm(false); setMfaDisableCode(''); setError('');}} className="flex-1 py-3 text-xs font-bold bg-slate-200 text-slate-800 rounded-xl hover:bg-slate-300 transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Confirm Disable</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMfaDeactivatedModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-start justify-center p-6 z-50 pt-20">
          <div className="bg-red-600 text-white max-w-xs w-full rounded-xl shadow-xl p-4 border border-red-500 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-0.5">⚠</div>
              <div className="flex-1">
                <h4 className="text-base font-black tracking-tight mb-1">Multi-Factor Disabled</h4>
                <p className="text-xs leading-relaxed opacity-95 mb-3">MFA has been turned off for your account. Consider re-enabling for added security.</p>
                <button onClick={() => setShowMfaDeactivatedModal(false)} className="w-full py-2 px-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg transition duration-200 text-xs uppercase tracking-wide cursor-pointer">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-2">Confirm Sign Out</h3>
            <p className="text-sm text-slate-600 mb-4">Are you sure you want to log out? You will need to sign in again to continue.</p>
            <div className="flex space-x-3 mt-4">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 text-xs font-bold bg-slate-200 text-slate-800 rounded-lg cursor-pointer">Cancel</button>
              <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="flex-1 py-2.5 text-xs font-bold bg-red-600 text-white rounded-lg cursor-pointer">Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Password Enforcement Update Window */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6 border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-4">Enforce Password Modification</h3>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Current Active Password</label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"} 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    className="w-full px-3 py-2.5 pr-16 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-600 text-slate-900 bg-slate-50" 
                    required 
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-3 text-[10px] font-bold text-slate-600 uppercase">
                    {showCurrentPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">New Complex Password</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={handleNewPasswordChange} 
                    className="w-full px-3 py-2.5 pr-16 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-600 text-slate-900 bg-slate-50" 
                    required 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-3 text-[10px] font-bold text-slate-600 uppercase">
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {/* Live length progress bar */}
                <div className="mt-3">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`${lengthColorClass} h-2`} style={{ width: `${lengthPercent}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 text-right font-mono font-bold">{newPasswordLength} / 12 chars</div>
                </div>
                
                {/* Live Validating Password Guidelines */}
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
                  <p className="text-[11px] font-bold text-slate-800 mb-1.5">Password Requirements Setup:</p>
                  <ul className="text-[10px] font-bold space-y-1">
                    <li className={`flex items-center space-x-1.5 ${passwordValidations.length ? 'text-emerald-600' : 'text-slate-500'}`}>
                      <span>{passwordValidations.length ? '✓' : '○'}</span> <span>Minimum of 12 characters</span>
                    </li>
                    <li className={`flex items-center space-x-1.5 ${passwordValidations.upper ? 'text-emerald-600' : 'text-slate-500'}`}>
                      <span>{passwordValidations.upper ? '✓' : '○'}</span> <span>At least one uppercase letter (A-Z)</span>
                    </li>
                    <li className={`flex items-center space-x-1.5 ${passwordValidations.lower ? 'text-emerald-600' : 'text-slate-500'}`}>
                      <span>{passwordValidations.lower ? '✓' : '○'}</span> <span>At least one lowercase letter (a-z)</span>
                    </li>
                    <li className={`flex items-center space-x-1.5 ${passwordValidations.number ? 'text-emerald-600' : 'text-slate-500'}`}>
                      <span>{passwordValidations.number ? '✓' : '○'}</span> <span>At least one numeric digit (0-9)</span>
                    </li>
                    <li className={`flex items-center space-x-1.5 ${passwordValidations.special ? 'text-emerald-600' : 'text-slate-500'}`}>
                      <span>{passwordValidations.special ? '✓' : '○'}</span> <span>At least one special character (!@#$%^&*)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-bold">{error}</div>}
              {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-bold">{success}</div>}

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 text-center text-xs font-bold bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-800 transition">Cancel</button>
                <button 
                  type="submit" 
                  disabled={loading || !isPasswordFullyValid} 
                  className="flex-1 py-2.5 text-center text-xs font-bold bg-red-600 hover:bg-red-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
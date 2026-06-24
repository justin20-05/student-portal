import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../assets/Logo.jpg'; // Imported the WMSU logo

export default function AdminPanel() {
  const { user, logout, setUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // MFA states
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [isMfaActive, setIsMfaActive] = useState(false);
  const [showMfaActivatedModal, setShowMfaActivatedModal] = useState(false);
  const [showMfaDeactivatedModal, setShowMfaDeactivatedModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const fetchSecurityLogs = async () => {
    setError('');
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
    setLoading(true);
    if (isMfaActive) {
      try {
        const response = await api.post('/auth/disable-mfa');
        if (response.data.token) localStorage.setItem('token', response.data.token);
        setIsMfaActive(false);
        setUser(prev => ({ ...(prev || {}), mfaEnabled: false }));
        setShowMfaDeactivatedModal(true);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to disable MFA.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
      initiateMfaEnrollment();
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
            className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 text-xs font-bold px-4 py-2 rounded-lg transition border border-red-200 shadow-sm"
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
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${isMfaActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-600">Use the toggle to enable or disable MFA for this admin account. Enabling will require scanning a QR code with an authenticator app.</p>
          </div>
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
        {error && (
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
              className="self-start sm:self-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition"
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
                  {logs.map((log) => (
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

            <form onSubmit={confirmMfaEnrollment} className="space-y-4">
              <input type="text" maxLength="6" placeholder="000000" value={mfaVerificationCode} onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-2xl font-mono font-bold border border-slate-300 text-slate-900 tracking-widest py-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 transition" required />
              <div className="flex space-x-3 mt-2">
                <button type="button" onClick={() => {setShowMfaModal(false); setIsMfaActive(false);}} className="flex-1 py-3 text-xs font-bold bg-slate-200 text-slate-800 rounded-xl hover:bg-slate-300 transition">Dismiss</button>
                <button type="submit" className="flex-1 py-3 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-md">Activate Protection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMfaActivatedModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end justify-center p-6 z-50">
          <div className="bg-emerald-600 text-white max-w-sm w-full rounded-2xl shadow-2xl p-4 border border-emerald-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold">Multi-Factor Activated</h4>
                <p className="text-[13px] opacity-90">Your account now requires an authenticator code for future sign-ins.</p>
              </div>
              <button onClick={() => setShowMfaActivatedModal(false)} className="ml-4 text-sm font-bold uppercase opacity-90">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {showMfaDeactivatedModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end justify-center p-6 z-50">
          <div className="bg-red-600 text-white max-w-sm w-full rounded-2xl shadow-2xl p-4 border border-red-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold">Multi-Factor Disabled</h4>
                <p className="text-[13px] opacity-90">MFA has been turned off for your account. Consider re-enabling for added security.</p>
              </div>
              <button onClick={() => setShowMfaDeactivatedModal(false)} className="ml-4 text-sm font-bold uppercase opacity-90">Dismiss</button>
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
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 text-xs font-bold bg-slate-200 text-slate-800 rounded-lg">Cancel</button>
              <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="flex-1 py-2.5 text-xs font-bold bg-red-600 text-white rounded-lg">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
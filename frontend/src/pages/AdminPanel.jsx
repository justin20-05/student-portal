import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../assets/Logo.jpg'; // Imported the WMSU logo

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
  }, []);

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
            onClick={logout} 
            className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 text-xs font-bold px-4 py-2 rounded-lg transition border border-red-200 shadow-sm"
          >
            Log Out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
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
    </div>
  );
}
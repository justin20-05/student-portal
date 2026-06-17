import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

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
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Admin Top Navigation Header */}
      <nav className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 bg-indigo-500 text-white font-bold flex items-center justify-center rounded-lg text-sm">AP</div>
          <div>
            <span className="font-bold tracking-tight block text-sm">System Management</span>
            <span className="text-[10px] text-indigo-300 font-mono tracking-widest uppercase">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user?.name || 'Administrator'}</p>
            <p className="text-[11px] text-emerald-400 font-medium">Root Access Node Active</p>
          </div>
          <button onClick={logout} className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold px-4 py-2 rounded-lg transition border border-slate-700">
            Exit Console
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Error Alert Display Block */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Audit Log Infrastructure Table Layout */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Real-Time Core Security Audit Log</h3>
              <p className="text-xs text-slate-400 mt-0.5">Immutable runtime application event logs tracing brute-force telemetry, identities, and session updates</p>
            </div>
            <button 
              onClick={() => { setLoading(true); fetchSecurityLogs(); }}
              className="self-start sm:self-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              Refresh Event Matrix
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-20 text-slate-400 text-sm font-medium">
                Parsing real-time security events...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-sm">
                No system activity log entries located inside buffer.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3.5 px-6">Event Timestamp</th>
                    <th className="py-3.5 px-6">Action Flag</th>
                    <th className="py-3.5 px-6">Associated Identity Node</th>
                    <th className="py-3.5 px-6">Origin IP Address</th>
                    <th className="py-3.5 px-6">Contextual Metadata Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 text-xs text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md border ${getBadgeStyle(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">
                        {log.userId || <span className="text-slate-400 italic">Anonymous/Public</span>}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-500">
                        {log.ip}
                      </td>
                      <td className="py-4 px-6">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <pre className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono text-slate-600 max-w-xs overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Empty context</span>
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

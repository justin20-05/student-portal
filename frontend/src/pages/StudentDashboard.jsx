import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Structural sub-states for security tools
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [isMfaActive, setIsMfaActive] = useState(false);

  useEffect(() => {
    async function fetchDashboardProfile() {
      try {
        const response = await api.get('/student/profile');
        setProfileData(response.data);
      } catch (err) {
        setError('Failed to pull authenticated student profile context data safely.');
      }
    }
    fetchDashboardProfile();
    setIsMfaActive(user?.mfaEnabled || false);
  }, [user]);

  // Handle Strong Password Update Request
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(response.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update credentials. Please match policy rules.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request 2FA QR Registration Data
  const initiateMfaEnrollment = async () => {
    setError('');
    try {
      const response = await api.post('/auth/setup-mfa');
      setQrCodeData(response.data.qrCode);
      setMfaSetupSecret(response.data.secret);
      setShowMfaModal(true);
    } catch (err) {
      setError('Could not initialize structural MFA handshake pipelines.');
    }
  };

  // Step 2: Validate 6-digit Code to lock in MFA
  const confirmMfaEnrollment = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/auth/confirm-mfa', { code: mfaVerificationCode });
      setSuccess(response.data.message || 'MFA active!');
      setIsMfaActive(true);
      setMfaVerificationCode('');
      setTimeout(() => setShowMfaModal(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP verification token entry.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Aesthetic Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 bg-indigo-600 text-white font-bold flex items-center justify-center rounded-lg shadow-md text-sm">SP</div>
          <span className="font-bold text-slate-800 tracking-tight">Student Dashboard</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-700">{user?.name || 'Loading Student...'}</p>
            <p className="text-xs text-indigo-600 font-medium capitalize">{user?.role} Access Mode</p>
          </div>
          <button onClick={logout} className="bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition">
            Terminate Session
          </button>
        </div>
      </nav>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metadata Profile Card & Security Status Dashboard */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-4 border border-slate-200">👨‍🎓</div>
            <h3 className="text-lg font-bold text-slate-800">{user?.name}</h3>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <hr className="my-4 border-slate-100" />
            <div className="space-y-3 text-xs font-medium text-slate-600">
              <div className="flex justify-between"><span className="text-slate-400">Student ID:</span> <span className="font-semibold text-slate-800">2024-00001</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Course Major:</span> <span className="font-semibold text-slate-800">BS Information Technology</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Year Status:</span> <span className="font-semibold text-slate-800">3rd Year</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-400">Security Credentials Control</h4>
            
            {/* MFA Status Indicator */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-700">Multi-Factor Authenticator</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{isMfaActive ? 'Guarding Active Logins' : 'Disabled / Vulnerable'}</p>
              </div>
              {isMfaActive ? (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-md">Protected</span>
              ) : (
                <button onClick={initiateMfaEnrollment} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition">Enable</button>
              )}
            </div>

            <button onClick={() => { setError(''); setSuccess(''); setShowPasswordModal(true); }} className="w-full py-2.5 text-center bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition">
              Modify Account Password
            </button>
          </div>
        </div>

        {/* Right Column: Protected Content Data Visualization Area */}
        <div className="lg:col-span-2 space-y-6">
          {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-sm text-red-700 font-medium">{error}</div>}
          {success && <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-sm text-emerald-700 font-medium">{success}</div>}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Enrolled Courses & Academic Standing</h3>
            <p className="text-xs text-slate-400 mb-6">Secure data verified from protected endpoints</p>

            {profileData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Cumulative Student GPA</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{profileData.gpa}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Active Semester Credits</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{profileData.enrolledCredits} Units</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Verified Weekly Class Schedule</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {profileData.schedule?.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white hover:bg-slate-50 flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-700">{item.course}</span>
                        <span className="text-xs px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium rounded-full">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">Accessing application layer secure nodes...</div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL 1: Password Enforcement Update Window */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-4">Enforce Structural Password Modification</h3>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Active Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Complex Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" required />
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">🔒 Requires: 12+ characters, uppercase, lowercase, numbers, and symbols.</p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 text-center text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 text-center text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white disabled:opacity-50">Save Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 2FA/MFA Registration QR Verification view */}
      {showMfaModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-6 text-center border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-2">Register Multi-Factor Authentication</h3>
            <p className="text-xs text-slate-500 mb-4">Scan the cryptographic code with Google Authenticator or generic 2FA apps</p>
            
            {qrCodeData && (
              <div className="bg-slate-50 p-3 inline-block rounded-xl border border-slate-100 mb-4 shadow-inner">
                <img src={qrCodeData} alt="Cryptographic MFA QR Identity Node" className="mx-auto" />
              </div>
            )}
            
            <div className="text-left bg-slate-50 p-2.5 rounded-lg border text-[10px] font-mono text-center text-slate-600 break-all select-all mb-4">
              Secret Key: {mfaSetupSecret}
            </div>

            <form onSubmit={confirmMfaEnrollment} className="space-y-4">
              <input type="text" maxLength="6" placeholder="000000" value={mfaVerificationCode} onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-xl font-mono border tracking-widest py-2 rounded-lg" required />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setShowMfaModal(false)} className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg">Dismiss</button>
                <button type="submit" className="flex-1 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Activate Protection</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

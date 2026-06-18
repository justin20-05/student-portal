import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../assets/Logo.jpg'; // Import the logo

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [isMfaActive, setIsMfaActive] = useState(false);

  // Password Verification Logic State
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  // Session Timer State (60 seconds)
  const [timeLeft, setTimeLeft] = useState(60);

  // Live Password Validation Handler
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

  // Live 1-Minute Session Timer Logic
  useEffect(() => {
    let intervalTimer;

    const resetActivity = () => {
      setTimeLeft(60); // Reset back to 60 seconds on any activity
    };

    // Listen for user interactions to reset the timer
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, resetActivity));

    // Tick down every second
    intervalTimer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalTimer);
          logout(); // Force logout at 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      activityEvents.forEach(event => document.removeEventListener(event, resetActivity));
      clearInterval(intervalTimer);
    };
  }, [logout]);

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

  const handleMfaToggle = () => {
    if (isMfaActive) {
      setIsMfaActive(false); 
    } else {
      initiateMfaEnrollment();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      
    {/* Floating Session Timer Widget (Bottom Right) */}
      <div className="fixed bottom-6 right-6 bg-white px-5 py-3 rounded-xl shadow-2xl border border-red-200 backdrop-blur-sm z-40 flex flex-col items-end transition-all">
        <span className="text-[10px] uppercase tracking-wider text-red-900 font-bold mb-0.5">Session Expires In</span>
        <span className={`text-2xl font-mono font-black text-[#DC143C] ${timeLeft <= 15 ? 'animate-pulse font-black' : ''}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      </div>
      
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="WMSU Logo" className="h-10 w-10 rounded-lg shadow-md object-cover border border-slate-100" />
          <span className="font-bold text-slate-900 tracking-tight text-lg">WMSU - Portal</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800">{user?.name || 'Loading Student...'}</p>
            <p className="text-xs text-red-600 font-bold capitalize">{user?.role} Access Mode</p>
          </div>
          <button onClick={logout} className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 text-xs font-bold px-4 py-2 rounded-lg transition border border-red-200 shadow-sm">
            Log Out
          </button>
        </div>
      </nav>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metadata Profile Card & Security Status */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <h3 className="text-lg font-bold text-slate-900">{user?.name}</h3>
            <p className="text-sm font-medium text-slate-600">{user?.email}</p>
            <hr className="my-4 border-slate-200" />
            <div className="space-y-3 text-xs font-medium text-slate-800">
              <div className="flex justify-between"><span className="text-slate-500">Student ID:</span> <span className="font-bold">2024-00001</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Course Major:</span> <span className="font-bold">BS Information Technology</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Year Status:</span> <span className="font-bold">3rd Year</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Security Credentials Control</h4>
            
            {/* MFA Status Indicator & Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-900">Multi-Factor Authenticator</p>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">{isMfaActive ? 'Guarding Active Logins' : 'Disabled / Vulnerable'}</p>
              </div>
              <button
                onClick={handleMfaToggle}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isMfaActive ? 'bg-red-600' : 'bg-slate-300'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isMfaActive ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <button onClick={() => { setError(''); setSuccess(''); setShowPasswordModal(true); }} className="w-full py-2.5 text-center bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-md">
              Modify Account Password
            </button>
          </div>
        </div>

        {/* Right Column: Protected Content Data Visualization Area */}
        <div className="lg:col-span-2 space-y-6 pb-20"> {/* pb-20 added to prevent floating timer overlap */}
          {error && <div className="p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg text-sm text-red-800 font-bold shadow-sm">{error}</div>}
          {success && <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-sm text-emerald-800 font-bold shadow-sm">{success}</div>}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Enrolled Courses & Academic Standing</h3>
            <p className="text-xs font-medium text-slate-500 mb-6">Secure data verified from protected endpoints</p>

            {profileData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                    <p className="text-xs font-bold text-slate-500">Cumulative Student GPA</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{profileData.gpa}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                    <p className="text-xs font-bold text-slate-500">Active Semester Credits</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{profileData.enrolledCredits} Units</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Verified Weekly Class Schedule</h4>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {profileData.schedule?.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white hover:bg-slate-50 flex justify-between items-center text-sm transition-colors">
                        <span className="font-bold text-slate-800">{item.course}</span>
                        <span className="text-xs px-3 py-1 bg-red-50 border border-red-100 text-red-700 font-bold rounded-full">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 font-medium text-sm animate-pulse">Accessing application layer secure nodes...</div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL 1: Password Enforcement Update Window */}
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

      {/* MODAL 2: 2FA/MFA Registration QR Verification view */}
      {showMfaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 text-center border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-2">Register Multi-Factor</h3>
            <p className="text-xs font-medium text-slate-600 mb-5">Scan the cryptographic code with Google Authenticator or generic 2FA apps</p>
            
            {qrCodeData && (
              <div className="bg-slate-50 p-4 inline-block rounded-xl border border-slate-200 mb-4 shadow-inner">
                <img src={qrCodeData} alt="Cryptographic MFA QR Identity Node" className="mx-auto" />
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

    </div>
  );
}
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import AdminPanel from './pages/AdminPanel';

// 🛡️ Security Check: Role-Based Route Guard Middleware
function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500 animate-pulse">
          Verifying security handshake credentials...
        </div>
      </div>
    );
  }

  // If session token is missing entirely, redirect down to primary handshake login screen
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If user role does not match strict authorization profile, redirect to safe boundary context
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Identity Handshake Node Entrypoint */}
          <Route path="/" element={<Login />} />

          {/* Secure Student Subsystem Context */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Secure Administrative Operation Panel Node */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          {/* Safe Fallback Catch-All Boundary */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

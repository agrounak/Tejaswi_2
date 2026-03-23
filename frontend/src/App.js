import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StickerGenerator from './pages/StickerGenerator';
import Inventory from './pages/Inventory';
import Dispatch from './pages/Dispatch';
import DispatchHistory from './pages/DispatchHistory';
import Orders from './pages/Orders';
import AdminConfig from './pages/AdminConfig';
import RegisterUser from './pages/RegisterUser';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role || '';

  const navItems = [];
  navItems.push({ path: '/dashboard', label: 'Dashboard', icon: '\u2302' });

  if (role === 'Admin' || role === 'Sticker User') {
    navItems.push({ path: '/sticker', label: 'Sticker Generator', icon: '\u2399' });
  }
  if (role === 'Admin') {
    navItems.push({ path: '/inventory', label: 'Inventory', icon: '\u2692' });
  }
  if (role === 'Admin' || role === 'Dispatch User') {
    navItems.push({ path: '/dispatch', label: 'Dispatch', icon: '\u2708' });
    navItems.push({ path: '/dispatch-history', label: 'Dispatch History', icon: '\u2637' });
  }
  if (role === 'Admin') {
    navItems.push({ path: '/orders', label: 'Orders', icon: '\u2263' });
    navItems.push({ path: '/config', label: 'Configuration', icon: '\u2699' });
    navItems.push({ path: '/users', label: 'User Management', icon: '\u263A' });
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Tejaswi Nonwovens</h2>
        <p className="sidebar-subtitle">ERP System</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className="user-role">{role}</span>
        </div>
        <button className="btn btn-logout" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/sticker" element={<ProtectedRoute><StickerGenerator /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/dispatch" element={<ProtectedRoute><Dispatch /></ProtectedRoute>} />
          <Route path="/dispatch-history" element={<ProtectedRoute><DispatchHistory /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute><AdminConfig /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><RegisterUser /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

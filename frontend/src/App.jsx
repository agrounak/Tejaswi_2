import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';

/* ── Lazy page imports (create these pages separately) ── */
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import ProductionPlan from './pages/ProductionPlan.jsx';
import Schedule from './pages/Schedule.jsx';
import Settings from './pages/Settings.jsx';

/* ── Protected Route wrapper ── */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/* ── Sidebar ── */
function Sidebar({ collapsed, onToggle }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/',        label: 'Dashboard',       icon: '\u{1F4CA}' },
    { path: '/orders',  label: 'Orders',          icon: '\u{1F4CB}' },
    { path: '/plan',    label: 'Production Plan', icon: '\u2699\uFE0F' },
    { path: '/schedule',label: 'Schedule',         icon: '\u{1F4C5}' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/settings', label: 'Settings', icon: '\u{1F527}' });
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside style={{
      width: collapsed ? '60px' : '240px',
      minHeight: '100vh',
      background: '#1a1f36',
      color: '#c2c7d6',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: collapsed ? '16px 8px' : '20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              Order Tracking
            </div>
            <div style={{ fontSize: '11px', color: '#8a90a5', marginTop: '2px' }}>
              Production Planning
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: '#8a90a5',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
            lineHeight: 1,
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: collapsed ? '12px 0' : '10px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '2px 8px',
              borderRadius: '8px',
              textDecoration: 'none',
              color: isActive(item.path) ? '#fff' : '#8a90a5',
              background: isActive(item.path) ? 'rgba(99,102,241,0.2)' : 'transparent',
              fontWeight: isActive(item.path) ? 600 : 400,
              fontSize: '14px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive(item.path)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.path)) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', flexShrink: 0 }}>
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

/* ── Header ── */
function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
      height: '56px',
      background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 24px',
      gap: '16px',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#6366f1',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {(user?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>
            {user?.username || 'User'}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            {user?.role || ''}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            marginLeft: '8px',
            padding: '6px 14px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            background: '#fff',
            color: '#374151',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f9fafb';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

/* ── App ── */
function App() {
  const { isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><ProductionPlan /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;

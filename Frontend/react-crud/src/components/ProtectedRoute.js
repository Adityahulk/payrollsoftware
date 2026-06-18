import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <span className="font-body-sm" style={{ color: 'var(--on-surface-variant)' }}>Loading PayrollSync...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'SuperAdmin') return <Navigate to="/superadmin" replace />;
    if (user.role === 'Admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/employee" replace />;
  }

  return children;
}

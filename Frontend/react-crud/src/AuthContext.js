import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from './api/index';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

function parseAuthResponse(data) {
  const token = data.token ?? data.Token;
  let decodedRole = data.role ?? data.Role;
  let decodedEmpId = data.empId ?? data.EmpId;
  let decodedSpaceId = data.spaceId ?? data.SpaceId;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Role — prefer MS schema, then plain "role"
    decodedRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
      || payload.role
      || decodedRole;

    // EmpId — prefer the custom "EmpId" claim (always numeric), then nameidentifier
    const customEmpId = payload["EmpId"] ?? payload["empid"] ?? payload["empId"];
    const nameId = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]
      || payload.nameid;

    const rawId = customEmpId ?? nameId ?? decodedEmpId;
    decodedEmpId = rawId ? parseInt(rawId, 10) : decodedEmpId;

    // SpaceId
    const rawSpaceId = payload["SpaceId"] ?? payload["spaceid"];
    if (rawSpaceId !== undefined && rawSpaceId !== null && rawSpaceId !== '') {
      decodedSpaceId = parseInt(rawSpaceId, 10);
    }
  } catch (e) {
    // fallback to data
  }

  return {
    token,
    role: decodedRole,
    empId: decodedEmpId,
    spaceId: decodedSpaceId,
    name: data.name ?? data.Name ?? data.email ?? data.Email ?? 'User',
    email: data.email ?? data.Email,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      sessionStorage.clear();
    }
    setLoading(false);
  }, []);

  const persist = useCallback((userData) => {
    sessionStorage.setItem('token', userData.token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const redirect = useCallback((role) => {
    if (role === 'SuperAdmin') navigate('/superadmin');
    else if (role === 'Admin') navigate('/admin');
    else navigate('/employee'); // TeamLead, Manager, Employee all use /employee
  }, [navigate]);

  const login = useCallback(async (email, password) => {
    try {
      const res = await authApi.login(email, password);
      const userData = parseAuthResponse(res.data);
      persist(userData);
      redirect(userData.role);
      toast.success(`Welcome back, ${userData.name.split(' ')[0]}!`);
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
      throw error;
    }
  }, [persist, redirect]);

  const register = useCallback(async (formData) => {
    try {
      const res = await authApi.register(formData);
      const responseData = res.data;
      
      if (responseData.Status === 'Pending' || responseData.status === 'Pending') {
        toast.success('Registration successful! Please wait for admin approval.');
        navigate('/login');
        return;
      }
      
      const userData = parseAuthResponse(responseData);
      persist(userData);
      redirect(userData.role);
      toast.success('Account created successfully!');
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
      throw error;
    }
  }, [persist, redirect, navigate]);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
    navigate('/login');
    toast('Logged out successfully.', { icon: '👋' });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

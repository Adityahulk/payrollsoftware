import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/index';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // Step state: 1 = Enter Email, 2 = Verify OTP, 3 = Reset Password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);

  // STEP 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required!');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.forgotPassword(email.trim());
      toast.success(response.data?.message || 'If registered, an OTP has been sent!');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('OTP is required!');
      return;
    }
    if (otp.trim().length !== 6) {
      toast.error('OTP must be a 6-digit number!');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.verifyOtp(email.trim(), otp.trim());
      toast.success(response.data?.message || 'OTP verified successfully!');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Both password fields are required!');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long!');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match!');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.resetPassword(email.trim(), otp.trim(), newPassword);
      toast.success(response.data?.message || 'Password reset successfully!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password. Session expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at 10% 20%, rgb(91, 104, 235) 0%, rgb(40, 50, 175) 90.2%)',
      fontFamily: 'Inter, sans-serif',
      padding: 16
    }}>
      <div className="card fade-in" style={{
        maxWidth: 400,
        width: '100%',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        padding: 32
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#fff' }}>
              {step === 1 ? 'lock' : step === 2 ? 'sms' : 'published_with_changes'}
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 6 }}>
            {step === 1 ? 'Forgot Password?' : step === 2 ? 'Enter OTP' : 'New Password'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.4 }}>
            {step === 1 && 'Enter your email address and we will send you a 6-digit OTP to reset your password.'}
            {step === 2 && `We've sent a verification code to your email address associated with ${email}.`}
            {step === 3 && 'Choose a strong, secure password containing at least 6 characters.'}
          </p>
        </div>

        {/* Step 1: Email Form */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="john@company.com"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ height: 44 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
            >
              {loading ? <div className="spinner" /> : 'Send OTP Code'}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification Form */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>6-Digit OTP Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                required
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, height: 48, fontWeight: 700 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
            >
              {loading ? <div className="spinner" /> : 'Verify Code'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(1)}
              style={{ width: '100%', height: 38, justifyContent: 'center', marginTop: 10, fontSize: 12 }}
            >
              Back to Email
            </button>
          </form>
        )}

        {/* Step 3: Password Reset Form */}
        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ height: 44 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ height: 44 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
            >
              {loading ? <div className="spinner" /> : 'Reset Password'}
            </button>
          </form>
        )}

        {/* Back to Login Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            Remembered your password?{' '}
            <span
              onClick={() => navigate('/login')}
              style={{ color: '#4F46E5', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign In
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

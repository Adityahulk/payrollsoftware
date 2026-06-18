import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import logoMicrotechnique from '../logo.png';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async ({ email, password }) => {
    try {
      await login(email, password);
    } catch (err) {
      // toast handled in AuthContext / api layer
    }
  };

  return (
    <div className="login-page">
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: '5%', left: '5%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.35) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.25) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div className="login-layout">
        {/* Branding */}
        <div className="fade-in login-branding" style={{ color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <img src={logoMicrotechnique} alt="Microtechnique Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Microtechnique Payroll</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(167,243,208,.15)', border: '1px solid rgba(167,243,208,.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 24 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6EE7B7' }}>verified_user</span>
            <span style={{ fontSize: 12, color: '#6EE7B7', fontWeight: 600 }}>ISO 27001 Certified Enterprise Platform</span>
          </div>

          <h1 className="login-hero-heading">
            Unified Payroll<br />
            <span style={{ color: '#A5B4FC' }}>for the Modern<br />Enterprise.</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.65)', maxWidth: 420, marginBottom: 40, lineHeight: 1.6 }}>
            Automate payroll cycles, track attendance, manage projects, and empower your workforce — all in one place.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {['Role-Based Access', 'Attendance Tracking', 'Payroll & CTC', 'Real-Time Queries'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '7px 13px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#A5B4FC' }}>check_circle</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 32, marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,.1)' }}>
            {[{ v: '99.9%', l: 'Uptime' }, { v: '50K+', l: 'Employees' }, { v: '150+', l: 'Companies' }].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Login form */}
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, background: 'var(--primary-50)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--primary-500)' }}>lock</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email address <span className="form-label-required" />
              </label>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 18 }}>alternate_email</span>
                <input
                  id="email"
                  type="email"
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@company.com"
                  style={{ paddingLeft: 40 }}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </div>
              {errors.email && <span id="email-error" className="form-error"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>{errors.email.message}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password <span className="form-label-required" />
              </label>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 18 }}>key</span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className={`form-input ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'pass-error' : undefined}
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="icon-btn" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }} aria-label={showPass ? 'Hide password' : 'Show password'}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {errors.password && <span id="pass-error" className="form-error"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>{errors.password.message}</span>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <span 
                  onClick={() => navigate('/forgot-password')} 
                  style={{ fontSize: 12, color: 'var(--primary-600)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot Password?
                </span>
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ justifyContent: 'center', padding: '13px', fontSize: 15 }} aria-busy={isSubmitting}>
              {isSubmitting ? <><div className="spinner" />Authenticating...</> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>Sign In</>}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Don't have an account? </span>
            <button type="button" onClick={() => navigate('/register')} style={{ background: 'none', border: 'none', color: 'var(--primary-500)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              Create account
            </button>
          </div>

          <div style={{ marginTop: 16, background: 'var(--gray-50)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--primary-500)', marginTop: 1 }}>info</span>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 }}>
              Use your organization credentials. Roles: <strong>Admin</strong>, <strong>TeamLead</strong>, <strong>Employee</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

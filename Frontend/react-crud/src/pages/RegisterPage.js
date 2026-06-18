import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Minimum 6 characters"),
  confirmPassword: z.string(),
  role: z.enum(["Admin", "Manager", "TeamLead", "Employee"]),
  gender: z.string().min(1, "Gender required"),

  // Conditional
  spaceName: z.string().optional(),
  spaceId: z.string().optional(),

  // Optional
  phone: z.string().optional(),
  address: z.string().optional(),
  image: z.any().optional()
})
.superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords don't match", path: ['confirmPassword'] });
  }
  if (data.role === "Admin" && !data.spaceName) {
    ctx.addIssue({
      path: ["spaceName"],
      message: "Space name required for Admin",
      code: z.ZodIssueCode.custom
    });
  }
  if (data.role !== "Admin" && !data.spaceId) {
    ctx.addIssue({
      path: ["spaceId"],
      message: "Space ID required",
      code: z.ZodIssueCode.custom
    });
  }
});

const STEPS = ['Account', 'Profile', 'Confirm'];

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, trigger, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const watchedValues = watch();
  
  console.log("Validation Errors:", errors);

  const nextStep = async () => {
    const fields = step === 0
      ? ['email', 'password', 'confirmPassword']
      : ['name', 'role', 'gender', 'phone', 'address', watchedValues.role === 'Admin' ? 'spaceName' : 'spaceId'];
    const valid = await trigger(fields);
    if (valid) setStep(s => Math.min(s + 1, 2));
  };

  const onSubmit = async (data) => {
    const { confirmPassword, ...payload } = data;
    if (payload.role !== 'Admin') {
      payload.spaceId = parseInt(payload.spaceId);
      delete payload.spaceName;
    } else {
      delete payload.spaceId;
    }
    try {
      await registerUser(payload);
    } catch (err) { /* toast handled by AuthContext */ }
  };

  const FieldError = ({ name }) => errors[name]
    ? <span className="form-error"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>{errors[name].message}</span>
    : null;

  const onInvalidSubmit = (formErrors) => {
    console.error("Form Validation Failed:", formErrors);
    const errKeys = Object.keys(formErrors);
    if (errKeys.length > 0) {
      const firstError = formErrors[errKeys[0]];
      toast.error(firstError.message || 'Please check all required fields.');
    }
  };

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.3) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

      <div className="login-card" style={{ maxWidth: 500 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, background: 'var(--primary-50)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: 'var(--primary-500)' }}>person_add</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Create your account</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Join your organization workspace</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i <= step ? 'var(--primary-500)' : 'var(--gray-200)',
                  color: i <= step ? '#fff' : 'var(--gray-400)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, transition: 'all .2s',
                }}>
                  {i < step ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: i <= step ? 'var(--primary-500)' : 'var(--gray-400)' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? 'var(--primary-500)' : 'var(--gray-200)', margin: '0 8px', transition: 'background .2s' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} noValidate>
          {/* Step 0: Account */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="reg-email" type="email" className={`form-input ${errors.email ? 'input-error' : ''}`} placeholder="you@company.com" {...register('email')} />
                <FieldError name="email" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-pass">Password <span style={{ color: 'var(--error)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input id="reg-pass" type={showPass ? 'text' : 'password'} className={`form-input ${errors.password ? 'input-error' : ''}`} placeholder="Min 8 chars, uppercase + number" style={{ paddingRight: 44 }} {...register('password')} />
                  <button type="button" onClick={() => setShowPass(p => !p)} className="icon-btn" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }} aria-label="Toggle password">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <FieldError name="password" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Password <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="reg-confirm" type="password" className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`} placeholder="Re-enter password" {...register('confirmPassword')} />
                <FieldError name="confirmPassword" />
              </div>
            </div>
          )}

          {/* Step 1: Profile */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="reg-name" type="text" className={`form-input ${errors.name ? 'input-error' : ''}`} placeholder="John Doe" {...register('name')} />
                <FieldError name="name" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-role">Role <span style={{ color: 'var(--error)' }}>*</span></label>
                <select id="reg-role" className={`form-select ${errors.role ? 'input-error' : ''}`} {...register('role')}>
                  <option value="">Select your role</option>
                  <option value="Employee">Employee</option>
                  <option value="TeamLead">Team Lead</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
                <FieldError name="role" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-gender">Gender <span style={{ color: 'var(--error)' }}>*</span></label>
                <select id="reg-gender" className={`form-select ${errors.gender ? 'input-error' : ''}`} {...register('gender')}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError name="gender" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-phone">Phone (Optional)</label>
                <input id="reg-phone" type="text" className="form-input" placeholder="+1234567890" {...register('phone')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-address">Address (Optional)</label>
                <input id="reg-address" type="text" className="form-input" placeholder="123 Main St" {...register('address')} />
              </div>
              
              {watchedValues.role === 'Admin' ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-spaceName">Space Name <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input id="reg-spaceName" type="text" className={`form-input ${errors.spaceName ? 'input-error' : ''}`} placeholder="My New Space" {...register('spaceName')} />
                  <span className="form-hint">Create a new workspace for your organization</span>
                  <FieldError name="spaceName" />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-space">Space ID <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input id="reg-space" type="number" className={`form-input ${errors.spaceId ? 'input-error' : ''}`} placeholder="1" {...register('spaceId')} />
                  <span className="form-hint">Get this from your organization admin</span>
                  <FieldError name="spaceId" />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Email', value: watchedValues.email },
                  { label: 'Name', value: watchedValues.name },
                  { label: 'Role', value: watchedValues.role },
                  { label: watchedValues.role === 'Admin' ? 'Space Name' : 'Space ID', value: watchedValues.role === 'Admin' ? watchedValues.spaceName : watchedValues.spaceId },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{value || '—'}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => setStep(s => s - 1)} style={{ flex: 1 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>Back
              </button>
            )}
            {step < 2 ? (
              <button type="button" className="btn btn-primary" onClick={nextStep} style={{ flex: 1, justifyContent: 'center' }}>
                Continue<span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
                {isSubmitting ? <><div className="spinner" />Creating...</> : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>Create Account</>}
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--primary-500)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

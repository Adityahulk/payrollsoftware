import React from 'react';
import { ArrowRight, ShieldCheck, Clock, CheckCircle2, User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import screenshotDashboard from '../../Screenshot 2026-05-27 235539.png';

export default function Hero({ onOpenDemo, onNavigate }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const isLoggedIn = !!user;
  const loggedInUser = user;

  const getDashboardPath = (role) => {
    if (role === 'SuperAdmin') return '/superadmin';
    if (role === 'Admin') return '/admin';
    return '/employee';
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen pt-32 pb-24 flex items-center overflow-hidden mesh-bg"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10 w-full animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Hero Left Content Text Panel */}
          <div className="lg:col-span-6 flex flex-col space-y-8 text-left">
            {/* Elegant Chip Badge - Focused on Trust */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full w-fit backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold tracking-wider text-emerald-400 font-mono">
                Safe, Accurate & Honest Payroll Systems
              </span>
            </div>

            {/* Display Heading with Simplified Trust message */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white font-display">
              The Payroll Software <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
                Employees Actually Trust.
              </span>
            </h1>

            {/* Supporting paragraph description */}
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              We believe a payroll system should protect workers. <strong>Microtechnique Payroll</strong> provides completely transparent time-tracking, easy mobile access, and error-free Provident Fund (PF) deposits. We never record your GPS location or leak your personal ID details to third parties.
            </p>

            {/* Dynamic UI based on Authentication state */}
            {!isLoggedIn ? (
              <div className="space-y-4 pt-2">
                {/* Primary Action Buttons: Login and Register */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button
                    id="hero-btn-login"
                    onClick={() => navigate('/login')}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer border border-blue-450/10"
                  >
                    <span>Staff Portal Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    id="hero-btn-register"
                    onClick={() => navigate('/register')}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl glass border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-slate-100 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer bg-transparent"
                  >
                    <span>Create Free Account</span>
                  </button>
                </div>

                {/* Secondary navigation to Simulator */}
                <div className="text-left">
                  <button
                    id="hero-roi-nav"
                    onClick={() => onNavigate("roi")}
                    className="text-xs text-slate-400 hover:text-blue-400 underline transition-colors cursor-pointer border-none bg-transparent"
                  >
                    Are you an employer? Estimate your monthly savings in Rupees &rarr;
                  </button>
                </div>
              </div>
            ) : (
              /* Logged In Workspace States for Enhanced Employee Trust */
              <div className="glass bg-white/[0.03] border-emerald-500/20 rounded-2xl p-6 border text-left max-w-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{loggedInUser.name}</h4>
                      <p className="text-slate-500 text-[10px] uppercase font-mono">Role: {loggedInUser.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(getDashboardPath(loggedInUser.role))}
                      className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/10 transition cursor-pointer"
                    >
                      <span>Dashboard</span>
                    </button>
                    <button
                      onClick={logout}
                      className="flex items-center space-x-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/10 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-slate-550 block">Personal Privacy Key:</span>
                    <span className="text-emerald-400 font-bold font-mono">STATUS_ENCRYPTED</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-555 block">Active Attendance:</span>
                    <span className="text-blue-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Roster Up-To-Date
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-normal">
                  *Your personal records are securely locked. Under our <strong>Data Trust Charter</strong>, administrative managers cannot view your GPS location details or personal files.
                </p>
              </div>
            )}

            {/* Simplistic trust points */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/5 font-sans">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold font-sans">100% Secure</span>
                  <span className="text-slate-500 text-[10px] mt-0.5 font-sans">Strict Privacy Safeguard</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold font-sans">No Delayed Pay</span>
                  <span className="text-slate-500 text-[10px] mt-0.5 font-sans">On-Time Bank Deposits</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold font-sans">Transparent Logs</span>
                  <span className="text-slate-500 text-[10px] mt-0.5 font-sans">Verify Every Shift</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Right Platform Screenshot Mockup Panel */}
          <div className="lg:col-span-6 relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg md:max-w-xl lg:max-w-none group">
              {/* Backlit Blue/Indigo Glow Ring */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-indigo-600 rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition duration-700 pointer-events-none" />

              {/* High-fidelity browser shell frame - Styled in Frosted Glass */}
              <div className="relative glass rounded-2xl shadow-2xl overflow-hidden">
                {/* Browser top-bar */}
                <div className="bg-white/[0.02] border-b border-white/10 px-4 py-3 flex items-center justify-between backdrop-blur-md">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  </div>
                  {/* Fake location bar */}
                  <div className="bg-slate-950/40 border border-white/5 px-4 py-1 rounded text-[10px] text-slate-400 font-mono tracking-wide w-1/2 text-center select-none truncate">
                    microtechnique.co/portal/...
                  </div>
                  <div className="w-12 text-right">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  </div>
                </div>

                {/* Inside Dashboard Image */}
                <div className="relative aspect-[16/8] xl:aspect-[16/9] w-full bg-slate-950 overflow-hidden">
                  <img
                    src={screenshotDashboard}
                    alt="Workforce Registry Staff Area"
                    className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-101"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Simple Live Clock and Safety Status indicator */}
              <div className="absolute -bottom-6 -left-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-xs select-none">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-slate-400 text-[9px] tracking-wider uppercase font-semibold">Privacy Policy Verified</span>
                  <span className="text-white text-xs font-bold font-mono">100% Secure Storage</span>
                </div>
              </div>

              {/* Floating trust status badge */}
              <div className="absolute -top-6 -right-4 glass backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-xl shadow-2xl flex flex-col gap-0.5 text-left pointer-events-none select-none">
                <span className="text-slate-400 text-[9px] tracking-wider uppercase">Active Staff Session</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-white text-xs font-semibold font-mono">Protected by Privacy Lock</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

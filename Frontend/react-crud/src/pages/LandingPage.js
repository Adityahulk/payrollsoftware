import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Services from '../components/landing/Services';
import PayrollModule from '../components/landing/PayrollModule';
import DemoModal from '../components/landing/DemoModal';
import Footer from '../components/landing/Footer';
import { TESTIMONIALS } from '../components/landing/data';
import { Star, Quote, ArrowRight, ShieldCheck, Heart, UserCheck, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import screenshotConfig from '../Screenshot (324).png';

export default function LandingPage() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isLoggedIn = !!user;
  const loggedInUser = user;

  const getDashboardPath = (role) => {
    if (role === 'SuperAdmin') return '/superadmin';
    if (role === 'Admin') return '/admin';
    return '/employee';
  };

  // Interactive section tracking on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'solutions', 'payroll', 'roi', 'testimonials'];
      const scrollPos = window.scrollY + 120;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            // map ROI segment in PayrollModule to payroll nav link
            if (section === 'roi') {
              setActiveSection('roi');
            } else {
              setActiveSection(section);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigate = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="landing-page-root" className="bg-[#020617] text-slate-100 min-h-screen selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* Structural Glassmorphism Navbar */}
      <Navbar
        onOpenDemo={() => setDemoModalOpen(true)}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      {/* Hero Header with login and register triggers */}
      <Hero
        onOpenDemo={() => setDemoModalOpen(true)}
        onNavigate={handleNavigate}
      />

      {/* Trust Offerings Selection Grid */}
      <div id="solutions-section">
        <Services onOpenDemo={() => setDemoModalOpen(true)} />
      </div>

      {/* Payroll Presentation & Live savings ROI Simulator */}
      <PayrollModule />

      {/* ── Platform Configuration Showcase ─────────────────────────── */}
      <section className="bg-[#030712] py-20 border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[160px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Screenshot Left */}
            <div className="relative order-1">
              <div className="absolute -inset-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 rounded-3xl blur-3xl opacity-10 pointer-events-none" />
              <div className="relative glass rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                {/* Browser chrome bar */}
                <div className="bg-white/[0.02] border-b border-white/10 px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  </div>
                  <div className="flex-1 bg-slate-950/40 border border-white/5 rounded px-3 py-1 text-[10px] text-slate-400 font-mono text-center truncate">
                    microtechnique.co/payroll/spaces
                  </div>
                  <div className="w-10 text-right">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  </div>
                </div>
                {/* Screenshot */}
                <div className="relative overflow-hidden">
                  <img
                    src={screenshotConfig}
                    alt="Space Financial Rules and Configurations Panel"
                    className="w-full h-auto object-cover object-top transition-transform duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-5 -right-3 glass backdrop-blur-xl border border-white/15 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 select-none">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-base">⚙️</div>
                <div>
                  <div className="text-white text-xs font-bold">Live Config Rules</div>
                  <div className="text-slate-500 text-[10px]">Instant salary preview</div>
                </div>
              </div>
            </div>

            {/* Text Right */}
            <div className="flex flex-col space-y-6 text-left order-2">
              <span className="text-indigo-400 font-mono tracking-widest text-xs uppercase font-semibold">
                Admin Power Tools
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display leading-tight">
                Flexible Payroll Rules,<br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Per Department.
                </span>
              </h2>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Configure custom allowances and deductions for every Space (department). Set fixed-amount HRA, DA, PF, TDS, late penalties, and break penalties — all fully transparent to employees.
              </p>
              <div className="space-y-3">
                {[
                  { emoji: '➕', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Space Allowances', desc: 'Add HRA, DA, Travel & custom bonuses per department' },
                  { emoji: '➖', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         label: 'Smart Deductions', desc: 'PF/TDS with Late, Absent & Break penalty automation' },
                  { emoji: '👁️', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',        label: 'Real-time Preview', desc: 'See salary impact before committing any rule change' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${item.bg} glass`}>
                    <span className="text-lg flex-shrink-0">{item.emoji}</span>
                    <div>
                      <div className={`font-bold text-sm ${item.color}`}>{item.label}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials (Real, honest staff stories) */}
      <section
        id="testimonials"
        className="bg-[#030712] py-24 border-b border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 left-10 w-96 h-96 bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
          
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col space-y-4">
            <span className="text-blue-400 font-mono tracking-widest text-xs uppercase font-semibold">
              Worker Consensus
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              Trust Shared by Our Teams
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Read how real employees and office accountants experience honest calculations, transparent log sheets, and stress-free work environments.
            </p>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {TESTIMONIALS.map((test) => (
              <div
                key={test.id}
                className="glass bg-white/[0.02] border-white/8 p-6 sm:p-8 rounded-2xl flex flex-col justify-between hover:border-blue-550/30 transition-all duration-300 relative group shadow-lg"
              >
                {/* Quote Icon watermark */}
                <Quote className="absolute right-6 top-6 w-12 h-12 text-slate-800/20 group-hover:text-slate-705/30 transition-transform duration-300 group-hover:-translate-y-1 pointer-events-none" />

                <div className="space-y-4">
                  {/* Rating Stars */}
                  <div className="flex items-center space-x-1.5">
                    {Array.from({ length: test.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b]" />
                    ))}
                  </div>

                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed text-left">
                    &ldquo;{test.content}&rdquo;
                  </p>
                </div>

                {/* Profile row */}
                <div className="flex items-center space-x-3.5 pt-6 mt-6 border-t border-white/5">
                  <div className="w-10 h-10 rounded-xl glass bg-white/[0.03] border-white/10 flex items-center justify-center font-mono font-bold text-blue-400 text-sm select-none">
                    {test.name.charAt(0)}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-white text-xs font-bold">{test.name}</span>
                    <span className="text-slate-500 text-[10px] mt-0.5">{test.role} &bull; {test.company}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Simplistic trust points with high transparency replacing arrogant marketing claims */}
          <div className="mt-20 pt-12 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
            <div className="flex flex-col items-center p-4 glass bg-white/[0.01] rounded-xl border-white/5">
              <span className="text-white font-mono font-bold text-base flex items-center gap-1">
                <Heart className="w-4 h-4 text-emerald-400" /> ON-TIME
              </span>
              <span className="text-slate-500 text-[10px] uppercase font-semibold mt-1">Prompt Bank Deposit</span>
            </div>
            <div className="flex flex-col items-center p-4 glass bg-white/[0.01] rounded-xl border-white/5">
              <span className="text-white font-mono font-bold text-base">NO SPYING</span>
              <span className="text-slate-500 text-[10px] uppercase font-semibold mt-1">Geographic Privacy</span>
            </div>
            <div className="flex flex-col items-center p-4 glass bg-white/[0.01] rounded-xl border-white/5">
              <span className="text-white font-mono font-bold text-base">Aadhaar Lock</span>
              <span className="text-slate-500 text-[10px] uppercase font-semibold mt-1">Encrypted Records</span>
            </div>
            <div className="flex flex-col items-center p-4 glass bg-white/[0.01] rounded-xl border-white/5">
              <span className="text-white font-mono font-bold text-base">FREE HELP</span>
              <span className="text-slate-500 text-[10px] uppercase font-semibold mt-1">24Hr On-call Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ultimate Simplified CTA Section */}
      <section className="bg-[#020617] py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-650/10 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8 animate-fade-in">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display">
            A Payroll Solution Built <br />
            with Genuine Employee Trust.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Protect your staff's data privacy, guarantee direct bank payments on the dot, and experience simple, transparent shift logging without stress.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isLoggedIn ? (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-555 text-white font-bold text-sm px-8 py-4 rounded-xl transition-all duration-300 shadow-xl shadow-blue-950/30 flex items-center justify-center space-x-2 border border-blue-450/20 cursor-pointer"
                >
                  <span>Staff Portal Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto glass bg-white/[0.02] hover:bg-white/[0.06] border-white/15 text-sm font-semibold text-slate-300 hover:text-white px-8 py-4 rounded-xl transition duration-300 cursor-pointer bg-transparent"
                >
                  Create Free Organization
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 p-5 w-full max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-8 h-8 text-emerald-400" />
                  <div className="text-left">
                    <span className="text-white text-sm font-bold block">Session Active ({loggedInUser.name})</span>
                    <span className="text-slate-450 text-[11px]">Strict privacy protocol activated.</span>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                  <button
                    onClick={() => navigate(getDashboardPath(loggedInUser.role))}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-semibold text-xs rounded-xl border border-blue-500/10 cursor-pointer transition"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={logout}
                    className="w-full sm:w-auto px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold text-xs rounded-xl border border-rose-500/10 cursor-pointer transition"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Global Interactive Leads Consulting Modal */}
      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />

      {/* Official Bottom Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenDemo={() => setDemoModalOpen(true)}
      />
    </div>
  );
}

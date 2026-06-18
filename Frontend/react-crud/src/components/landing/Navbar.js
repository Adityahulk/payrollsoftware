import { useState, useEffect } from 'react';
import React from 'react';
import { Menu, X, ArrowRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import logoMicrotechnique from '../../logo.png';

export default function Navbar({ onOpenDemo, activeSection, onNavigate }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const isLoggedIn = !!user;
  const loggedInUser = user;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: "Trust Features", id: "solutions" },
    { label: "Salary Portal View", id: "payroll" },
    { label: "Savings Estimator (Rupees)", id: "roi" },
    { label: "Staff Stories", id: "testimonials" },
  ];

  const handleLinkClick = (id) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const getDashboardPath = (role) => {
    if (role === 'SuperAdmin') return '/superadmin';
    if (role === 'Admin') return '/admin';
    return '/employee';
  };

  return (
    <nav
      id="top-navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-slate-950/40 backdrop-blur-xl border-b border-white/5 shadow-2xl py-4"
          : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          {/* Logo Brand Panel */}
          <div
            id="brand-logo"
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => handleLinkClick("hero")}
          >
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center font-bold text-lg select-none shadow-md shadow-blue-500/10 p-0.5 border border-white/10 group-hover:scale-105 transition-transform duration-300">
              <img
                src={logoMicrotechnique}
                alt="Logo"
                className="w-full h-full object-contain filter brightness-110 drop-shadow scale-110"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-display select-none">
              MICROTECHNIQUE<span className="font-light text-blue-400">PAYROLL</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <div id="desktop-links" className="hidden lg:flex gap-8 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleLinkClick(item.id)}
                className={`transition-colors cursor-pointer text-sm font-medium border-none bg-transparent ${
                  activeSection === item.id
                    ? "text-blue-400 font-semibold"
                    : "text-slate-400 hover:text-blue-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Action CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            {!isLoggedIn ? (
              <>
                <button
                  id="navbar-login-btn"
                  onClick={() => navigate('/login')}
                  className="px-5 py-2 rounded-xl text-slate-300 text-sm font-semibold hover:text-white hover:bg-white/5 transition-all cursor-pointer border-none bg-transparent"
                >
                  Staff Log In
                </button>
                <button
                  id="navbar-register-btn"
                  onClick={() => navigate('/register')}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 cursor-pointer flex items-center gap-1.5 border border-blue-450/10"
                >
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 px-3 py-1.5">
                <button
                  onClick={() => navigate(getDashboardPath(loggedInUser.role))}
                  className="flex items-center gap-2 border-none bg-transparent cursor-pointer text-slate-300 hover:text-white"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs">Dashboard: <strong>{loggedInUser.name}</strong></span>
                </button>
                <button
                  onClick={logout}
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-lg transition border-none bg-transparent cursor-pointer"
                  title="Logout Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-400 hover:text-white hover:bg-white/5 p-2 rounded-full transition-all focus:outline-none border-none bg-transparent"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-panel"
          className="lg:hidden bg-slate-950/95 backdrop-blur-2xl border-b border-white/5 px-6 pt-4 pb-8 space-y-4 absolute top-full left-0 right-0 shadow-2xl transition-all"
        >
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleLinkClick(item.id)}
                className={`w-full text-left block px-4 py-3 rounded-xl text-base font-medium transition-all border-none ${
                  activeSection === item.id
                    ? "bg-blue-500/10 text-blue-400 border-l-2 border-blue-500"
                    : "text-slate-300 hover:bg-white/5 hover:text-white bg-transparent"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-white/5 space-y-3">
            {!isLoggedIn ? (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-center py-3 text-slate-300 hover:text-white rounded-xl hover:bg-white/5 font-semibold text-sm transition-all block cursor-pointer border-none bg-transparent"
                >
                  Staff Log In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/register');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm text-center py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer border border-blue-450/10"
                >
                  <span>Create Staff Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(getDashboardPath(loggedInUser.role));
                  }}
                  className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 py-2.5 rounded-xl text-white text-xs cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Dashboard: <strong>{loggedInUser.name}</strong></span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-center py-3 text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/15 rounded-xl font-bold text-sm transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out Securely</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

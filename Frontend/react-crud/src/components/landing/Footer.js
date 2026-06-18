import React from 'react';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import logoMicrotechnique from '../../logo.png';

export default function Footer({ onNavigate, onOpenDemo }) {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (e, targetId) => {
    e.preventDefault();
    onNavigate(targetId);
  };

  return (
    <footer
      id="site-footer"
      className="bg-[#020617] border-t border-white/5 pt-16 pb-12 relative overflow-hidden"
    >
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 border-b border-white/5 pb-12 mb-12 text-left">
          
          {/* Column 1: Company Logo Info */}
          <div className="flex flex-col space-y-4 text-left">
            <div className="flex items-center space-x-3 cursor-pointer group" onClick={(e) => handleLinkClick(e, "hero")}>
              <div className="w-10 h-10 rounded-lg bg-white border border-white/10 p-0.5 flex items-center justify-center overflow-hidden">
                <img
                  src={logoMicrotechnique}
                  alt="Microtechnique Logo"
                  className="w-full h-full object-contain scale-110"
                />
              </div>
              <span className="text-white font-semibold text-xs tracking-widest font-display uppercase">
                MICROTECHNIQUE PAYROLL
              </span>
            </div>
            <p className="text-slate-450 text-xs leading-relaxed max-w-sm">
              Simple, transparent staff logs and direct salary disbursement systems. Engineered with premium personal security so workers have full control.
            </p>
            {/* Compliance Badge */}
            <div className="flex items-center space-x-2 glass bg-[#10b981]/5 rounded-lg p-2.5 border border-[#10b981]/25 w-fit select-none">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider">EMPLOYEE PRIVACY LOCKED</span>
            </div>
          </div>

          {/* Column 2: Solutions Navigation */}
          <div className="flex flex-col space-y-3">
            <span className="text-white text-xs font-bold uppercase tracking-widest font-display">Trust Services</span>
            <div className="flex flex-col space-y-2 font-sans">
              <a href="#solutions" onClick={(e) => handleLinkClick(e, "solutions")} className="text-slate-500 hover:text-white text-xs transition-colors flex items-center decoration-none bg-transparent border-none">
                <span>Attendance Self-Service</span>
              </a>
              <a href="#payroll" onClick={(e) => handleLinkClick(e, "payroll")} className="text-slate-500 hover:text-white text-xs transition-colors decoration-none bg-transparent border-none">
                On-Time Bank Deposits
              </a>
              <a href="#solutions" onClick={(e) => handleLinkClick(e, "solutions")} className="text-slate-500 hover:text-white text-xs transition-colors decoration-none bg-transparent border-none">
                Provident Fund Tracker
              </a>
              <a href="#solutions" onClick={(e) => handleLinkClick(e, "solutions")} className="text-slate-500 hover:text-white text-xs transition-colors decoration-none bg-transparent border-none">
                Aadhaar Non-Disclosure Guard
              </a>
            </div>
          </div>

          {/* Column 3: Platform Resources */}
          <div className="flex flex-col space-y-3">
            <span className="text-white text-xs font-bold uppercase tracking-widest font-display">Savings Checks</span>
            <div className="flex flex-col space-y-2 font-sans">
              <a href="#roi" onClick={(e) => handleLinkClick(e, "roi")} className="text-slate-500 hover:text-white text-xs transition-colors flex items-center decoration-none bg-transparent border-none">
                <span>Rupee Time Estimator</span>
                <span className="glass bg-blue-500/10 border border-blue-550/20 text-blue-450 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded ml-1.5">Interactive</span>
              </a>
              <button onClick={onOpenDemo} className="text-left text-slate-500 hover:text-white text-xs transition-colors cursor-pointer border-none bg-transparent">
                Consult Implementation Kit
              </button>
              <button onClick={onOpenDemo} className="text-left text-slate-500 hover:text-white text-xs transition-colors cursor-pointer border-none bg-transparent">
                Read Employee Data Rights
              </button>
            </div>
          </div>

          {/* Column 4: Contact/Actions */}
          <div className="flex flex-col space-y-3 text-left">
            <span className="text-white text-xs font-bold uppercase tracking-widest font-display">Local Office Support</span>
            <p className="text-slate-455 text-xs leading-normal">
              Schedule a friendly setup call with our support desk to modernise paper ledgers.
            </p>
            <button
              onClick={onOpenDemo}
              className="glass bg-white/[0.03] hover:bg-white/[0.08] text-white text-xs font-semibold px-4 py-2.5 rounded-lg border-white/10 transition-all flex items-center justify-center space-x-1.5 w-full cursor-pointer bg-transparent border border-white/5"
            >
              <span>Get 1-on-1 Guidance</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Legal Attribution, with required exact bottom text */}
        <div className="flex flex-col items-center space-y-8 pt-4">
          
          {/* Center Brand Feature Segment */}
          <div className="flex items-center space-x-3 select-none">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="text-slate-400 font-mono text-[10px] tracking-wider uppercase font-semibold">
              Server Region: Mumbai, India (Encrypted Safe Hub)
            </span>
          </div>

          {/* The Absolute Core Requested Segment at the Bottom: "microtechnique payroll" */}
          <div
            id="brand-signature-container"
            className="flex flex-col items-center space-y-3.5 transition-opacity duration-300 hover:opacity-100"
          >
            {/* The Logo */}
            <div className="w-20 h-20 bg-white p-1.5 rounded-full border border-white/10 shadow-inner flex items-center justify-center select-none scale-105 hover:border-emerald-550/30 transition-all duration-300">
              <img
                src={logoMicrotechnique}
                alt="Microtechnique"
                className="w-full h-full object-contain filter drop-shadow-[0_2px_12px_rgba(59,130,246,0.3)] scale-110"
              />
            </div>
            
            {/* The exactly requested name: "microtechnique payroll" */}
            <div className="flex flex-col items-center">
              <h4 className="text-2xl sm:text-3xl font-black tracking-widest text-[#3b82f6] uppercase font-display select-all hover:text-blue-400 transition-colors bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                microtechnique payroll
              </h4>
              <span className="text-slate-500 text-[10px] tracking-widest uppercase font-mono font-medium mt-1">
                Trusted Employee Roster & Direct Deposit Suite
              </span>
            </div>
          </div>

          {/* Sub Legal Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full text-slate-500 text-[10px] font-mono border-t border-white/5 pt-6">
            <span>&copy; {currentYear} Microtechnique India Solutions Group. All rights reserved.</span>
            <div className="flex space-x-4">
              <span className="hover:text-slate-350 transition-colors select-none font-sans">Employee Trust Protocol v4.11</span>
              <span>•</span>
              <span className="hover:text-slate-350 transition-colors select-none font-sans">Aadhaar Protection Lock</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

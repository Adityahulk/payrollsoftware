import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, HelpCircle, FileText, ArrowRight } from 'lucide-react';

export default function DemoModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    employees: '50-250',
    interest: 'payroll-engine',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setSubmitted(true);
  };

  if (!isOpen) return null;

  return (
    <div
      id="demo-modal-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div
        id="demo-modal-content"
        className="relative w-full max-w-xl glass bg-[#0A0E1A]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-left"
      >
        {/* Header background ambient gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

        {/* Close Button */}
        <button
          id="close-demo-modal"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white glass bg-white/[0.04] p-1.5 rounded-full border border-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <div className="text-left">
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                Request Friendly Support Setup Consultation
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-1.5 font-sans">
                Schedule a friendly 1-on-1 walkthrough with a setup guide. We will help you upload your spreadsheets, activate your account, and configure employee slots.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="flex flex-col space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Rachel Adams"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="glass bg-white/[0.01] border-white/8 focus:border-blue-500 focus:outline-none text-white rounded-lg px-3.5 py-2.5 text-sm transition"
                />
              </div>

              {/* Corporate Email */}
              <div className="flex flex-col space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Work Email</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. rachel@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="glass bg-white/[0.01] border-white/8 focus:border-blue-500 focus:outline-none text-white rounded-lg px-3.5 py-2.5 text-sm transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company Name */}
              <div className="flex flex-col space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Company Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Apex Tech Ltd."
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="glass bg-white/[0.01] border-white/8 focus:border-blue-500 focus:outline-none text-white rounded-lg px-3.5 py-2.5 text-sm transition"
                />
              </div>

              {/* Workforce Size */}
              <div className="flex flex-col space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Workforce Size (FTEs)</label>
                <select
                  value={formData.employees}
                  onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                  className="glass bg-white/[0.01] border-white/8 focus:border-blue-500 focus:outline-none text-white rounded-lg px-3.5 py-2.5 text-sm transition cursor-pointer appearance-none animate-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
                >
                  <option className="bg-[#0b101c]" value="1-50">Under 50 employees</option>
                  <option className="bg-[#0b101c]" value="50-250">50 to 250 employees</option>
                  <option className="bg-[#0b101c]" value="250-1000">250 to 1,000 employees</option>
                  <option className="bg-[#0b101c]" value="1000+">Over 1,000 employees</option>
                </select>
              </div>
            </div>

            {/* Interest */}
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Primary Solution Interest</label>
              <select
                value={formData.interest}
                onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                className="glass bg-white/[0.01] border-white/8 focus:border-blue-500 focus:outline-none text-white rounded-lg px-3.5 py-2.5 text-sm transition cursor-pointer appearance-none animate-none"
                style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
              >
                <option className="bg-[#0b101c]" value="payroll-engine">Microtechnique Payroll Suite Setup</option>
                <option className="bg-[#0b101c]" value="cloud-infrastructure">Attendance tracking configuration help</option>
                <option className="bg-[#0b101c]" value="security-compliance">Employee data privacy guidance</option>
                <option className="bg-[#0b101c]" value="systems-consulting">Migrating from paper or spreadsheet ledgers</option>
              </select>
            </div>

            {/* Brief Message */}
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Consulting Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="Tell us about your current local HR challenges or specific targets..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="glass bg-white/[0.01] border-white/8 focus:border-blue-500 focus:outline-none text-white rounded-lg px-3.5 py-2.5 text-sm transition resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              id="submit-registration-form"
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-555 text-white font-semibold text-sm py-3.5 rounded-xl transition shadow-xl shadow-blue-950/30 flex items-center justify-center space-x-2 border border-blue-500/20 cursor-pointer"
            >
              <span>Submit Request & Setup Slot &rarr;</span>
            </button>
          </form>
        ) : (
          /* Successful Submission Screen */
          <div className="p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-xl glass bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto scale-110">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase font-semibold font-mono tracking-widest text-[#10b981]">Request Received successfully</span>
              <h3 className="text-2xl font-bold text-white tracking-tight font-display">
                Welcome to Microtechnique, {formData.name}!
              </h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto leading-normal">
                Our local onboarding support assistant has set aside a slot. Walkthrough notes have been sent to <strong className="text-white">{formData.email}</strong>.
              </p>
            </div>

            {/* Custom Generated Ticket Report Based on Size */}
            <div className="glass bg-white/[0.02] border-white/8 rounded-xl p-5 text-left space-y-3.5 relative">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase pb-2 border-b border-white/5">
                <span>onboarding ticket profile</span>
                <span className="text-blue-400 font-bold">#MT-{Math.floor(Math.random() * 90000 + 10000)}</span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-550">Staff size:</span>
                  <span className="font-semibold text-white uppercase">{formData.employees} Employees</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-550">Storage Cluster:</span>
                  <span className="font-semibold text-[#10b981]">Mumbai, India (Primary Encrypted Zone)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-550">Direct Bank Integration:</span>
                  <span className="font-semibold text-white">Direct checking SBI / HDFC Link</span>
                </div>
              </div>

              <div className="glass bg-white/[0.01] border-white/5 p-3.5 rounded-lg flex items-center space-x-2.5 text-left text-xs">
                <ShieldCheck className="w-4 h-4 text-[#10b981] flex-shrink-0" />
                <span className="text-[11px] text-slate-450 leading-normal">
                  Employee privacy protection checks activated. Our support representative will contact you shortly.
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              id="confirm-success-close-btn"
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
              className="w-full glass bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-white font-medium text-sm py-3 rounded-xl transition cursor-pointer"
            >
              Back to Overview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

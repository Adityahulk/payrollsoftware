import { useState } from 'react';
import React from 'react';
import { Sliders, Clock, HelpCircle, ShieldAlert, Sparkles, Monitor, AppWindow } from 'lucide-react';
import screenshotPortal from '../../Screenshot 2026-05-19 204918.png';

export default function PayrollModule() {
  // Calculator inputs in Indian Rupees (INR)
  const [employeeCount, setEmployeeCount] = useState(120);
  const [manualHours, setManualHours] = useState(4);
  const [hourlyRate, setHourlyRate] = useState(450); // Fully loaded local HR manager hourly cost (₹)
  const [errorRate, setErrorRate] = useState(3.5); // percentage of errors

  // Calculating saving formula metrics in INR (₹)
  // Microtechnique saves 85% of physical payroll processing and dispute overhead.
  const timeSavedHours = Math.round(employeeCount * manualHours * 0.85);
  const adminSavings = timeSavedHours * hourlyRate;
  
  // Traditional filing/rectification errors cost an average of ₹8,000 to correct and audit manually.
  const traditionalErrorsCount = Math.round(employeeCount * (errorRate / 100));
  const errorSavings = traditionalErrorsCount * 8000; // ₹8,000 correction price

  const totalMonthlySavings = adminSavings + errorSavings;
  const totalAnnualSavings = totalMonthlySavings * 12;

  // Manual Costs vs. Responsive Payroll Suite Costs
  const traditionalTotalCost = (employeeCount * manualHours * hourlyRate) + (traditionalErrorsCount * 8000);
  const microtechniqueCost = Math.round(traditionalTotalCost * 0.15); // saves 85%

  const activePoints = [
    { 
      title: "Automated Work Log Syncing", 
      desc: "Attendance hours map straight into salary drafts transparently. Employees get paid exactly what they earned." 
    },
    { 
      title: "One-Click Instant Bank Transfers", 
      desc: "Fast, accurate payments sent directly to SBI, HDFC, ICICI accounts with simple payslip breakdowns." 
    },
    { 
      title: "Encrypted Data Lock", 
      desc: "Employee home addresses, Aadhaar, PAN card, and bank account numbers are fully protected under privacy policies." 
    },
  ];

  return (
    <section
      id="payroll"
      className="bg-[#020617] py-24 border-b border-white/5 relative overflow-hidden"
    >
      {/* Radiant Glowing Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-20 flex flex-col space-y-4">
          <span className="text-blue-400 font-mono tracking-widest text-xs uppercase font-semibold">
            Simple Employee Solutions
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
            On-Time, Clear & Trusted Payroll
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            A stress-free system providing honest attendance tracking, accurate provident fund credits, and instant payslip downloads. Built to gain the complete confidence of your employees.
          </p>
        </div>

        {/* Content Segment 1: High Fidelity Mockup Presentation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-24">
          {/* Mockup Left */}
          <div className="lg:col-span-6 relative flex justify-center">
            <div className="relative w-full max-w-md md:max-w-xl lg:max-w-none">
              
              {/* Backglow element */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur-lg opacity-15 pointer-events-none" />

              {/* Tablet Mockup Border Frame */}
              <div className="relative glass rounded-xl shadow-2xl p-2.5 bg-white/[0.02]">
                <div className="bg-slate-950 rounded-lg overflow-hidden border border-white/5">
                  
                  {/* Mockup Top Menu Header */}
                  <div className="bg-white/[0.02] border-b border-white/5 px-4 py-2 flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-[9px] tracking-wider uppercase font-semibold">SECURED STAFF PORTAL PAGE</span>
                    <div className="flex space-x-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    </div>
                  </div>

                  {/* Portal image preview */}
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={screenshotPortal}
                      alt="Microtechnique Payroll Employee Dashboard"
                      className="w-full h-full object-cover object-top hover:scale-101 transition-transform duration-500"
                    />
                    {/* Fake Clock display */}
                    <div className="absolute bottom-4 left-4 glass bg-slate-900/95 backdrop-blur-xl border border-white/10 px-2.5 py-1.5 rounded-xl text-[9px] font-mono text-blue-400 font-bold select-none flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                      <span>On-Time Clock Sync</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Texts Right */}
          <div className="lg:col-span-6 flex flex-col space-y-6 text-left lg:pl-6 text-slate-100">
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
              Empowering Employees with Self-Service
            </h3>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Your staff can easily clock-in, check recorded working logs, submit simple leave requests, and see exact salary calculations in real-time. No hidden deductions, no guesswork. Every metric is clear and verifiable.
            </p>

            <div className="space-y-4 pt-2">
              {activePoints.map((pt, i) => (
                <div key={i} className="flex space-x-3 items-start">
                  <div className="w-8 h-8 rounded-lg glass bg-white/[0.03] border-white/10 text-blue-400 flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0 font-mono">
                    0{i + 1}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-white font-semibold text-sm">{pt.title}</span>
                    <span className="text-slate-400 text-xs mt-0.5">{pt.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Segment 2: Interactive ROI and Savings Simulator */}
        <div id="roi" className="glass bg-white/[0.02] border-white/10 rounded-2xl p-6 sm:p-10 relative">
          <div className="absolute top-4 right-4 glass bg-blue-500/10 border-blue-500/20 rounded-full px-3 py-1 text-[9px] font-mono text-blue-400 uppercase tracking-widest flex items-center space-x-1 font-semibold select-none">
            <Sparkles className="w-3 h-3 animate-spin-slow text-blue-400 mr-0.5" />
            <span>Simulate Monthly Savings</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            
            {/* Left: Input Variables Sliders */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white text-left tracking-tight mb-2 font-display">
                  Estimate HR Time & Cost Savings
                </h3>
                <p className="text-slate-400 text-xs text-left mb-8 leading-relaxed">
                  Understand how automating data collation avoids manual payroll mistakes, eliminates human errors, and preserves monthly correction budgets.
                </p>

                {/* Variable Slider 1: Employee Count */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-white text-xs font-bold font-display uppercase tracking-wider flex items-center">
                      Staff Size (FTEs)
                    </label>
                    <span className="text-blue-400 font-mono font-bold text-sm glass bg-white/[0.04] border-white/5 px-2.5 py-0.5 rounded">
                      {employeeCount} Employees
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="1000"
                    step="5"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>5</span>
                    <span>500</span>
                    <span>1,000</span>
                  </div>
                </div>

                {/* Variable Slider 2: Admin Hours per Employee */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-white text-xs font-bold font-display uppercase tracking-wider">
                      Manual Admin-checking / employee / mo
                    </label>
                    <span className="text-blue-400 font-mono font-bold text-sm glass bg-white/[0.04] border-white/5 px-2.5 py-0.5 rounded">
                      {manualHours} Hours / Month
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={manualHours}
                    onChange={(e) => setManualHours(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>1h</span>
                    <span>10h</span>
                    <span>20h</span>
                  </div>
                </div>

                {/* Variable Slider 3: Hourly Employer Rate */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-white text-xs font-bold font-display uppercase tracking-wider">
                      Fully Loaded Account hourly HR rate (₹ estimate)
                    </label>
                    <span className="text-blue-400 font-mono font-bold text-sm glass bg-white/[0.04] border-white/5 px-2.5 py-0.5 rounded">
                      ₹{hourlyRate} / Hour
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>₹100</span>
                    <span>₹1,000</span>
                    <span>₹2,000</span>
                  </div>
                </div>

                {/* Variable Slider 4: Error Rate */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-white text-xs font-bold font-display uppercase tracking-wider flex items-center">
                      Manual error correction rate & penalty risk
                    </label>
                    <span className="text-blue-400 font-mono font-bold text-sm glass bg-white/[0.04] border-white/5 px-2.5 py-0.5 rounded">
                      {errorRate}% average disputes
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="12"
                    step="0.5"
                    value={errorRate}
                    onChange={(e) => setErrorRate(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>0.5%</span>
                    <span>6.0%</span>
                    <span>12.0%</span>
                  </div>
                </div>
              </div>

              {/* System Note */}
              <div className="glass bg-white/[0.01] border-white/5 rounded-xl p-4 flex items-start space-x-2.5 mt-6">
                <Sliders className="w-4.5 h-4.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-450 text-left leading-normal">
                  *Savings estimates represent average time saved during roster-collation, direct tax preparation, and manual dispute processing. Calibrated to normal Indian business operational rates.
                </p>
              </div>
            </div>

            {/* Right: Output Savings Board */}
            <div className="lg:col-span-5 glass bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 sm:p-8 rounded-xl flex flex-col justify-between shadow-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-6">
                <div className="text-left">
                  <span className="text-slate-400 text-[10px] tracking-widest font-mono uppercase block">Estimated Preservation</span>
                  <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight block mt-2">
                    ₹{totalMonthlySavings.toLocaleString('en-IN')}
                    <span className="text-sm font-normal text-slate-400"> / Mo</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 font-sans">
                  <div className="glass bg-white/[0.02] border-white/5 p-4 rounded-xl text-left font-sans">
                    <span className="text-slate-450 text-[9px] tracking-wider uppercase font-semibold block font-sans">Annual Resource Value</span>
                    <span className="text-lg sm:text-xl font-bold text-blue-400 block mt-1">₹{totalAnnualSavings.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Retained funds</span>
                  </div>

                  <div className="glass bg-white/[0.02] border-white/5 p-4 rounded-xl text-left font-sans">
                    <span className="text-slate-450 text-[9px] tracking-wider uppercase font-semibold block">Admin labor allocation</span>
                    <span className="text-lg sm:text-xl font-bold text-blue-400 block mt-1">{timeSavedHours} Hours</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Saved / month</span>
                  </div>
                </div>

                {/* Animated Comparison Bars */}
                <div className="border-t border-white/5 pt-5 text-left">
                  <span className="text-white text-xs font-bold uppercase tracking-wider block mb-3">Estimated Overhead comparison:</span>
                  <div className="space-y-4">
                    {/* Manual costs */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-450">
                        <span>Traditional Manual Costs</span>
                        <span className="font-mono font-semibold">₹{traditionalTotalCost.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-700 h-full rounded-full w-full" />
                      </div>
                    </div>

                    {/* Microtechnique Suite Costs */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-blue-400">
                        <span>Transparent Microtechnique Automated</span>
                        <span className="font-mono font-bold">₹{microtechniqueCost.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden relative border border-blue-500/20">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: '15%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 mt-6 text-left">
                <span className="text-[11px] text-slate-400 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-2 animate-pulse" />
                  Employee trust ranking evaluated at <strong className="text-blue-400 ml-1">99.4% approval</strong>
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

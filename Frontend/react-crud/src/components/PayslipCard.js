import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import PayslipTemplateRenderer from './PayslipTemplateRenderer';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayslipCard({ slip, fmt, settings }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('Classic');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Sync activeTemplate with database templateSelector settings on load/update
  useEffect(() => {
    if (settings?.templateSelector && settings.templateSelector !== 'Default') {
      const tmpl = settings.templateSelector;
      setActiveTemplate(tmpl.charAt(0).toUpperCase() + tmpl.slice(1).toLowerCase());
    }
  }, [settings]);

  const monthName = MONTHS[(slip.month || new Date().getMonth() + 1) - 1];
  const yearVal = slip.year || new Date().getFullYear();
  const finalAmount = slip.finalamount || slip.finalAmount || 0;
  const paymentMethod = slip.paymentmethod || slip.paymentMethod || '—';
  const transactionId = slip.transactionid || slip.transactionId || '';

  const methodIcon = {
    'Cash': 'payments',
    'UPI': 'qr_code',
    'Bank Transfer': 'account_balance',
    'Razorpay': 'credit_card',
  }[paymentMethod] || 'receipt_long';

  const methodColor = {
    'Cash': '#10B981',
    'UPI': '#2563EB',
    'Bank Transfer': '#8B5CF6',
    'Razorpay': '#4F46E5',
  }[paymentMethod] || '#6B7280';

  const handleDownloadPdf = () => {
    const download = () => {
      setPdfLoading(true);
      const element = document.getElementById(`print-area-${slip.slipid}`);
      const companyName = settings?.companyName || "Default Company";
      
      const opt = {
        margin:       10,
        filename:     `Payslip_${companyName.replace(/\s+/g, '_')}_${monthName}_${yearVal}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      window.html2pdf()
        .from(element)
        .set(opt)
        .save()
        .then(() => setPdfLoading(false))
        .catch(err => {
          console.error(err);
          setPdfLoading(false);
          toast.error('Failed to generate PDF payslip.');
        });
    };

    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => download();
      document.body.appendChild(script);
    } else {
      download();
    }
  };

  // Build temporary settings override for renderer matching user toolbar choice
  const activeSettings = {
    ...settings,
    templateSelector: activeTemplate
  };

  return (
    <div style={{
      border: '1px solid var(--gray-200)',
      borderRadius: 16,
      overflow: 'hidden',
      background: '#FFF',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s'
    }}>
      {/* Payslip Header Bar */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
          background: expanded ? '#F8FAFC' : '#FFF',
          borderBottom: expanded ? '1px solid var(--gray-100)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${methodColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: methodColor }}>{methodIcon}</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
              Payslip — {monthName} {yearVal}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge badge-success" style={{ fontSize: 10 }}>Paid</span>
              {paymentMethod && (
                <span style={{ color: methodColor, fontWeight: 600 }}>via {paymentMethod}</span>
              )}
              {transactionId && (
                <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>• Txn: {transactionId.substring(0, 10)}...</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>{fmt(finalAmount)}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Net Pay</div>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded Payslip Details */}
      {expanded && (
        <div style={{ padding: '20px 24px', background: '#F8FAFC' }}>
          
          {/* Template Toolbar Switcher */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FFF',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid var(--gray-200)',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4F46E5' }}>palette</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)' }}>Choose Preview Template:</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['Classic', 'Modern', 'Compact'].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTemplate(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: activeTemplate === t ? '#4F46E5' : '#D1D5DB',
                    background: activeTemplate === t ? '#EEF2FF' : '#FFF',
                    color: activeTemplate === t ? '#4F46E5' : '#374151',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Render Area that html2pdf will capture */}
          <div 
            id={`print-area-${slip.slipid}`}
            style={{
              background: '#FFF',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              overflow: 'hidden'
            }}
          >
            <PayslipTemplateRenderer
              settings={activeSettings}
              payslipData={slip}
              user={user}
            />
          </div>

          {/* Download Button Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="btn"
              style={{
                background: '#8B5CF6',
                color: '#FFF',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)'
              }}
            >
              {pdfLoading ? (
                <>
                  <div style={{
                    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Generating PDF...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                  Download PDF Payslip
                </>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { subscribeToLoading } from '../api/client';

export default function GlobalLoader() {
  const [state, setState] = useState({ loading: false, mutating: false });

  useEffect(() => {
    return subscribeToLoading(setState);
  }, []);

  if (!state.loading) return null;

  return (
    <>
      {/* Sleek Top Viewport Shimmering Progress Bar (for all HTTP requests) */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          zIndex: 99999,
          background: 'linear-gradient(90deg, #4F46E5, #8B5CF6, #EC4899, #4F46E5)',
          backgroundSize: '200% 100%',
          animation: 'global-shimmer 1.5s infinite linear',
        }} 
      />

      {/* Full-Screen Glassmorphic Block Screen (for mutating actions POST/PUT/DELETE) */}
      {state.mutating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99998,
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          animation: 'global-fadeIn 0.25s ease-out'
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: '4px solid rgba(79, 70, 229, 0.1)',
            borderTopColor: '#4F46E5',
            borderRadius: '50%',
            animation: 'global-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.1)'
          }} />
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '12px 24px',
            borderRadius: 30,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.02)',
            fontSize: 13,
            fontWeight: 600,
            color: '#1F2937',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            letterSpacing: '0.01em',
            border: '1px solid rgba(243, 244, 246, 0.8)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4F46E5', animation: 'global-pulse 1.5s infinite' }}>sync</span>
            Processing secure request...
          </div>
        </div>
      )}

      {/* Embedded Styles */}
      <style>{`
        @keyframes global-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes global-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes global-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes global-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
      `}</style>
    </>
  );
}

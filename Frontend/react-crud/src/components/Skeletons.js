import React from 'react';

// ─── Shimmer base ────────────────────────────────────────────────────────────
function Shimmer({ width = '100%', height = 20, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ─── Dashboard stats skeleton (4 shimmer cards) ───────────────────────────────
export function DashboardStatsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Shimmer width={36} height={36} radius={8} />
            <Shimmer width={60} height={20} radius={99} />
          </div>
          <Shimmer width="40%" height={12} />
          <Shimmer width="70%" height={28} radius={4} />
        </div>
      ))}
    </div>
  );
}

// ─── Attendance calendar skeleton (7×5 grid) ─────────────────────────────────
export function CalendarSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
        <Shimmer width={160} height={24} />
        <Shimmer width={80} height={24} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, padding: 2 }}>
        {[...Array(35)].map((_, i) => (
          <div key={i} style={{ padding: 8, minHeight: 72 }}>
            <Shimmer width={24} height={16} radius={4} style={{ marginBottom: 6 }} />
            {i % 5 === 0 && <Shimmer width="80%" height={12} radius={4} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Project cards skeleton (3 cards) ────────────────────────────────────────
export function ProjectCardsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Shimmer width="60%" height={20} />
          <Shimmer width="90%" height={14} />
          <Shimmer width="40%" height={14} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {[...Array(3)].map((_, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Shimmer width="50%" height={14} />
                <Shimmer width={72} height={28} radius={6} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Work logs table skeleton (5 rows) ───────────────────────────────────────
export function WorkLogTableSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
        <Shimmer width={200} height={20} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
              {[80, 120, 100, 60, 200, 80].map((w, j) => (
                <td key={j} style={{ padding: '14px 20px' }}>
                  <Shimmer width={w} height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Profile form skeleton ────────────────────────────────────────────────────
export function ProfileSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Shimmer width={80} height={80} radius={40} />
          <div style={{ flex: 1 }}>
            <Shimmer width="60%" height={20} style={{ marginBottom: 8 }} />
            <Shimmer width="40%" height={14} />
          </div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <Shimmer width={80} height={12} style={{ marginBottom: 6 }} />
            <Shimmer width="100%" height={40} radius={8} />
          </div>
        ))}
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Shimmer width={140} height={20} />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Shimmer width={120} height={16} />
            <Shimmer width={80} height={32} radius={8} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generic card skeleton ────────────────────────────────────────────────────
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...Array(lines)].map((_, i) => (
        <Shimmer key={i} width={i === 0 ? '40%' : `${70 + Math.random() * 20}%`} height={i === 0 ? 18 : 14} />
      ))}
    </div>
  );
}

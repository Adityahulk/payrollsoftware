import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { spacesApi, monitorApi } from '../api';
import { BACKEND_ORIGIN } from '../config';
import toast from 'react-hot-toast';
import ScreenShareViewer from '../components/ScreenShareViewer';

export default function LiveMonitoringPage() {
  const [spaces, setSpaces] = useState([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [employeeFeeds, setEmployeeFeeds] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState(null);
  const [activeHistoryEmp, setActiveHistoryEmp] = useState(null);
  const [historyData, setHistoryData] = useState({ screenshots: [], videos: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('screenshots');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const getFullUrl = (url) => {
    if (!url) return '';
    return `${BACKEND_ORIGIN}/${url.replace(/^\//, '')}`;
  };

  // ── Monitoring Settings ──
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState(null); // { empId, name } or null for default space settings
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [monitorConfig, setMonitorConfig] = useState({
    intervalMinutes: 30,
    isEnabled: true,
    screenshotRetentionDays: 60,
    videoRetentionMinutes: 15,
  });
  const [configForm, setConfigForm] = useState({ ...monitorConfig });

  const fetchHistory = async (empId) => {
    if (!empId) return;
    setLoadingHistory(true);
    try {
      const res = await monitorApi.getEmployeeHistory(empId, selectedSpaceId);
      setHistoryData({
        screenshots: Array.isArray(res.data?.screenshots) ? res.data.screenshots : [],
        videos: Array.isArray(res.data?.videos) ? res.data.videos : [],
      });
    } catch (err) {
      console.error('[Fetch History Error]', err);
      toast.error('Failed to load employee history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeHistoryEmp) {
      fetchHistory(activeHistoryEmp.empId);
      setHistoryTab('screenshots');
    } else {
      setHistoryData({ screenshots: [], videos: [] });
    }
  }, [activeHistoryEmp]);

  // Helper to get initials for employee avatars
  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper to compute local relative time from ISO string
  const formatRelativeTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'No screenshot captured';
    const date = new Date(dateTimeStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Captured just now';
    if (diffMins < 60) return `Captured ${diffMins}m ago`;
    if (diffHours < 24) return `Captured ${diffHours}h ago`;

    return 'Captured ' + date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper to determine status color based on screenshot time (3-state)
  const getStatusColorAndLabel = (dateTimeStr) => {
    if (!dateTimeStr) return { color: 'var(--gray-400)', label: 'Offline' };
    const diffMins = (new Date() - new Date(dateTimeStr)) / 60000;
    
    if (diffMins <= 5) {
      return { color: '#10B981', label: 'Active' };
    }
    if (diffMins <= 15) {
      return { color: '#F59E0B', label: 'Idle' };
    }
    return { color: 'var(--gray-400)', label: 'Offline' };
  };

  // Fetch workspaces (spaces) belonging to this Admin
  const fetchSpaces = async () => {
    try {
      setLoadingSpaces(true);
      const res = await spacesApi.getMySpaces();
      const spacesList = Array.isArray(res.data) ? res.data : [];
      setSpaces(spacesList);
      if (spacesList.length > 0) {
        setSelectedSpaceId(spacesList[0].spaceid || spacesList[0].SpaceId);
      }
    } catch (err) {
      console.error('[Fetch Spaces Error]', err);
      toast.error('Failed to load workspaces.');
    } finally {
      setLoadingSpaces(false);
    }
  };

  // Fetch latest screenshots for the selected space
  const fetchFeeds = async (spaceId, silent = false) => {
    if (!spaceId) return;
    if (!silent) setLoadingFeeds(true);

    try {
      const res = await monitorApi.getLatestScreenshots(spaceId);
      setEmployeeFeeds(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[Fetch Feeds Error]', err);
      if (!silent) {
        toast.error('Failed to fetch screen feeds.');
      }
    } finally {
      if (!silent) setLoadingFeeds(false);
    }
  };

  // Load settings for a space/employee
  const loadMonitorConfig = useCallback(async (spaceId, empId = null) => {
    if (!spaceId) return;
    setSettingsLoading(true);
    try {
      const res = await monitorApi.getMonitorConfig(spaceId, empId);
      const cfg = res.data || {};
      const normalized = {
        intervalMinutes:          cfg.intervalMinutes          ?? 30,
        isEnabled:                cfg.isEnabled                ?? true,
        screenshotRetentionDays:  cfg.screenshotRetentionDays  ?? 60,
        videoRetentionMinutes:    cfg.videoRetentionMinutes    ?? 15,
      };
      setMonitorConfig(normalized);
      setConfigForm(normalized);
    } catch (err) {
      console.error('[Monitor Config Load Error]', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Save settings
  const saveMonitorConfig = async () => {
    if (!selectedSpaceId) return;
    setSettingsSaving(true);
    try {
      const empId = settingsTarget ? settingsTarget.empId : null;
      await monitorApi.saveMonitorConfig(selectedSpaceId, configForm, empId);
      if (!empId) {
        setMonitorConfig({ ...configForm });
      }
      toast.success(
        empId 
          ? `Monitoring settings for ${settingsTarget.name} saved successfully.`
          : 'Workspace default monitoring settings saved successfully.'
      );
      setShowSettings(false);
    } catch (err) {
      toast.error('Failed to save monitoring settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleOpenEmployeeSettings = (empId, name) => {
    setSettingsTarget({ empId, name });
    loadMonitorConfig(selectedSpaceId, empId);
    setShowSettings(true);
  };

  // Fetch spaces on mount
  useEffect(() => {
    fetchSpaces();
  }, []);

  // Fetch feeds + config when space is selected
  useEffect(() => {
    if (selectedSpaceId) {
      fetchFeeds(selectedSpaceId, false);
      loadMonitorConfig(selectedSpaceId, null);

      const interval = setInterval(() => {
        fetchFeeds(selectedSpaceId, true);
      }, 60000); // 1 minute interval

      return () => clearInterval(interval);
    }
  }, [selectedSpaceId, loadMonitorConfig]);

  return (
    <AppLayout role="admin">
      <div className="page-content fade-in">
        {/* Header Section */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, color: 'var(--gray-900)' }}>Live Screen Monitoring</h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              Monitor workspace feeds in real-time. Thumbnails refresh automatically every 1 minute.
            </p>
          </div>
          {selectedSpaceId && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSettingsTarget(null);
                  loadMonitorConfig(selectedSpaceId, null);
                  setShowSettings(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                title="Configure default workspace monitoring settings"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
                Settings
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchFeeds(selectedSpaceId, false)}
                disabled={loadingFeeds}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, animation: loadingFeeds ? 'spin 1s linear infinite' : 'none' }}>sync</span>
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* ── Monitoring Settings Modal ─────────────────────────────────────── */}
        {showSettings && (
          <div style={settingsModalStyles.overlay}>
            <div style={settingsModalStyles.panel}>
              <div style={settingsModalStyles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#6366F1' }}>tune</span>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>
                      {settingsTarget ? `Settings for ${settingsTarget.name}` : 'Default Workspace Settings'}
                    </h2>
                    <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                      {settingsTarget 
                        ? `Configure monitoring overrides for employee #${settingsTarget.empId}` 
                        : 'Configure default monitoring retention settings for this workspace'}
                    </p>
                  </div>
                </div>
                <button style={settingsModalStyles.closeBtn} onClick={() => setShowSettings(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              {settingsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={settingsModalStyles.spinner} />
                  <p style={{ color: '#64748B', fontSize: 13, marginTop: 12 }}>Loading settings...</p>
                </div>
              ) : (
                <div style={settingsModalStyles.body}>
                  {/* Screenshot Retention */}
                  <div style={settingsModalStyles.fieldGroup}>
                    <div style={settingsModalStyles.fieldHeader}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366F1' }}>photo_camera</span>
                      <div>
                        <label style={settingsModalStyles.fieldLabel}>Screenshot Retention</label>
                        <p style={settingsModalStyles.fieldHint}>Screenshots are automatically deleted after this many days</p>
                      </div>
                    </div>
                    <div style={settingsModalStyles.inputRow}>
                      <input
                        type="number"
                        className="form-input"
                        min={1}
                        max={365}
                        value={configForm.screenshotRetentionDays}
                        onChange={e => setConfigForm(p => ({ ...p, screenshotRetentionDays: parseInt(e.target.value) || 60 }))}
                        style={settingsModalStyles.numberInput}
                      />
                      <span style={settingsModalStyles.unit}>days</span>
                    </div>
                    <div style={settingsModalStyles.presets}>
                      {[7, 14, 30, 60, 90].map(d => (
                        <button
                          key={d}
                          style={{
                            ...settingsModalStyles.presetBtn,
                            ...(configForm.screenshotRetentionDays === d ? settingsModalStyles.presetBtnActive : {})
                          }}
                          onClick={() => setConfigForm(p => ({ ...p, screenshotRetentionDays: d }))}
                        >
                          {d === 60 ? '2 mo' : d === 90 ? '3 mo' : `${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={settingsModalStyles.divider} />

                  {/* Video Retention */}
                  <div style={settingsModalStyles.fieldGroup}>
                    <div style={settingsModalStyles.fieldHeader}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#F43F5E' }}>videocam</span>
                      <div>
                        <label style={settingsModalStyles.fieldLabel}>Video Recording Retention</label>
                        <p style={settingsModalStyles.fieldHint}>Recording chunks older than this are automatically deleted from disk</p>
                      </div>
                    </div>
                    <div style={settingsModalStyles.inputRow}>
                      <input
                        type="number"
                        className="form-input"
                        min={1}
                        max={10080}
                        value={configForm.videoRetentionMinutes}
                        onChange={e => setConfigForm(p => ({ ...p, videoRetentionMinutes: parseInt(e.target.value) || 15 }))}
                        style={settingsModalStyles.numberInput}
                      />
                      <span style={settingsModalStyles.unit}>minutes</span>
                    </div>
                    <div style={settingsModalStyles.presets}>
                      {[10, 15, 20, 30, 60].map(m => (
                        <button
                          key={m}
                          style={{
                            ...settingsModalStyles.presetBtn,
                            ...(configForm.videoRetentionMinutes === m ? settingsModalStyles.presetBtnActive : {})
                          }}
                          onClick={() => setConfigForm(p => ({ ...p, videoRetentionMinutes: m }))}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={settingsModalStyles.divider} />

                  {/* Capture Interval */}
                  <div style={settingsModalStyles.fieldGroup}>
                    <div style={settingsModalStyles.fieldHeader}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#F59E0B' }}>timer</span>
                      <div>
                        <label style={settingsModalStyles.fieldLabel}>Screenshot Capture Interval</label>
                        <p style={settingsModalStyles.fieldHint}>How frequently screenshots are automatically captured from employee devices</p>
                      </div>
                    </div>
                    <div style={settingsModalStyles.inputRow}>
                      <input
                        type="number"
                        className="form-input"
                        min={1}
                        max={1440}
                        value={configForm.intervalMinutes}
                        onChange={e => setConfigForm(p => ({ ...p, intervalMinutes: parseInt(e.target.value) || 30 }))}
                        style={settingsModalStyles.numberInput}
                      />
                      <span style={settingsModalStyles.unit}>minutes</span>
                    </div>
                    <div style={settingsModalStyles.presets}>
                      {[10, 20, 30, 60].map(m => (
                        <button
                          key={m}
                          style={{
                            ...settingsModalStyles.presetBtn,
                            ...(configForm.intervalMinutes === m ? settingsModalStyles.presetBtnActive : {})
                          }}
                          onClick={() => setConfigForm(p => ({ ...p, intervalMinutes: m }))}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={settingsModalStyles.divider} />

                  {/* Enable / Disable */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Enable Monitoring</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Turn screenshot capture on or off for this workspace</div>
                    </div>
                    <button
                      onClick={() => setConfigForm(p => ({ ...p, isEnabled: !p.isEnabled }))}
                      style={{
                        width: 48, height: 26, borderRadius: 13,
                        backgroundColor: configForm.isEnabled ? '#6366F1' : '#CBD5E1',
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: configForm.isEnabled ? 25 : 3,
                        width: 20, height: 20, borderRadius: '50%',
                        backgroundColor: '#FFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>

                  {/* Summary / Info Box */}
                  <div style={settingsModalStyles.infoBox}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366F1', flexShrink: 0 }}>info</span>
                    <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      Screenshots will be stored for <strong>{configForm.screenshotRetentionDays} days</strong> then permanently deleted from disk.
                      {' '}Video recordings will be deleted after <strong>{configForm.videoRetentionMinutes} minutes</strong>.
                      {' '}Captures occur every <strong>{configForm.intervalMinutes} min</strong>.
                    </span>
                  </div>
                </div>
              )}

              <div style={settingsModalStyles.footer}>
                <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={saveMonitorConfig}
                  disabled={settingsSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {settingsSaving ? (
                    <><span style={{ ...settingsModalStyles.spinner, width: 16, height: 16, borderWidth: 2, margin: 0 }} /> Saving...</>
                  ) : (
                    <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Save Settings</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Selector Tabs */}
        {loadingSpaces ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton animate-pulse" style={{ width: 120, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--gray-200)' }} />
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gray-500)', marginBottom: 24 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>corporate_fare</span>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No Workspaces Found</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>You need to configure at least one Space before monitoring screens.</p>
          </div>
        ) : (
          <div className="tabs" style={{ marginBottom: 24 }}>
            {spaces.map((space) => {
              const id = space.spaceid || space.SpaceId;
              const name = space.spacename || space.SpaceName;
              return (
                <button
                  key={id}
                  className={`tab-btn ${selectedSpaceId === id ? 'active' : ''}`}
                  onClick={() => setSelectedSpaceId(id)}
                  style={{ fontSize: 14, fontWeight: 600, padding: '12px 24px' }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {/* Feeds Grid */}
        {selectedSpaceId && (
          <div>
            {loadingFeeds ? (
              <div className="grid grid-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="skeleton animate-pulse" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-200)' }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton animate-pulse" style={{ width: '60%', height: 14, borderRadius: 4, background: 'var(--gray-200)', marginBottom: 4 }} />
                        <div className="skeleton animate-pulse" style={{ width: '40%', height: 10, borderRadius: 4, background: 'var(--gray-200)' }} />
                      </div>
                    </div>
                    <div className="skeleton animate-pulse" style={{ width: '100%', height: 180, borderRadius: 'var(--radius-md)', background: 'var(--gray-200)' }} />
                  </div>
                ))}
              </div>
            ) : employeeFeeds.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--gray-500)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>groups_off</span>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No Employees</h3>
                <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>There are no employees registered in this workspace yet.</p>
              </div>
            ) : (
              <div className="grid grid-3">
                {(() => {
                  // Compute status for each feed and apply search + filter
                  const enrichedFeeds = employeeFeeds.map(feed => {
                    const capturedAt = feed.capturedAt || feed.CapturedAt;
                    const name = feed.name || feed.Name || feed.employee_name || feed.employeeName || `Employee #${feed.empId || feed.EmpId}`;
                    const status = getStatusColorAndLabel(capturedAt);
                    return { ...feed, _name: name, _capturedAt: capturedAt, _status: status };
                  });

                  // Search filter
                  const searched = searchQuery.trim()
                    ? enrichedFeeds.filter(f => f._name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                    : enrichedFeeds;

                  // Status filter
                  const filtered = statusFilter === 'all'
                    ? searched
                    : searched.filter(f => f._status.label.toLowerCase() === statusFilter);

                  // Compute summary counts
                  const activeCount = enrichedFeeds.filter(f => f._status.label === 'Active').length;
                  const idleCount = enrichedFeeds.filter(f => f._status.label === 'Idle').length;
                  const offlineCount = enrichedFeeds.filter(f => f._status.label === 'Offline').length;

                  return (
                    <>
                      {/* Summary Stats Bar */}
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '6px 14px', borderRadius: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{activeCount} Active</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '6px 14px', borderRadius: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#D97706' }}>{idleCount} Idle</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '6px 14px', borderRadius: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9CA3AF' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{offlineCount} Offline</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '6px 14px', borderRadius: 8, marginLeft: 'auto' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366F1' }}>groups</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5' }}>Total: {enrichedFeeds.length}</span>
                        </div>
                      </div>

                      {/* Search + Filter Bar */}
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ flex: '1 1 280px', position: 'relative' }}>
                          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9CA3AF', pointerEvents: 'none' }}>search</span>
                          <input
                            type="text"
                            placeholder="Search employee by name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px 10px 38px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 14, outline: 'none', background: '#FAFBFC', transition: 'border-color 0.2s' }}
                            onFocus={e => e.target.style.borderColor = '#6366F1'}
                            onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[{ key: 'all', label: 'All', icon: 'apps' }, { key: 'active', label: 'Active', icon: 'check_circle' }, { key: 'idle', label: 'Idle', icon: 'schedule' }, { key: 'offline', label: 'Offline', icon: 'cloud_off' }].map(f => (
                            <button
                              key={f.key}
                              onClick={() => setStatusFilter(f.key)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                                borderRadius: 8, border: statusFilter === f.key ? '1px solid #6366F1' : '1px solid var(--gray-200)',
                                background: statusFilter === f.key ? '#EEF2FF' : '#FFF',
                                color: statusFilter === f.key ? '#4F46E5' : 'var(--gray-600)',
                                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{f.icon}</span>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filtered.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 24px', color: 'var(--gray-400)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 8, display: 'block', opacity: 0.5 }}>filter_alt_off</span>
                          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)', margin: 0 }}>No employees match your filter</p>
                          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Try adjusting your search or status filter.</p>
                        </div>
                      ) : filtered.map((feed) => {
                  const empId = feed.empId || feed.EmpId;
                  const name = feed._name;
                  const capturedAt = feed._capturedAt;
                  const latestScreenshotUrl = feed.latestScreenshotUrl || feed.LatestScreenshotUrl;
                  const status = feed._status;
                  return (
                    <div key={empId} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#FFF' }}>
                      {/* Employee Meta Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, fontWeight: 700, background: 'var(--primary-50)', color: 'var(--primary-700)' }}>
                            {getInitials(name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Emp ID: #{empId}</div>
                          </div>
                        </div>

                        {/* Live Status indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: status.label === 'Active' ? '#F0FDF4' : status.label === 'Idle' ? '#FFFBEB' : 'var(--gray-50)', padding: '4px 10px', borderRadius: 99, border: `1px solid ${status.label === 'Active' ? '#BBF7D0' : status.label === 'Idle' ? '#FDE68A' : 'var(--gray-100)'}` }}>
                          <span 
                            style={{ 
                              width: 6, 
                              height: 6, 
                              borderRadius: '50%', 
                              background: status.color,
                              boxShadow: status.label === 'Active' ? `0 0 8px ${status.color}` : 'none',
                              animation: status.label === 'Active' ? 'pulse 2s infinite' : 'none'
                            }} 
                          />
                          <span style={{ fontSize: 11, fontWeight: 600, color: status.label === 'Active' ? '#059669' : status.label === 'Idle' ? '#D97706' : 'var(--gray-600)' }}>{status.label}</span>
                        </div>
                      </div>

                      {/* Screen capture image display */}
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
                        {!latestScreenshotUrl ? (
                          <div
                            style={{
                              width: '100%',
                              height: 180,
                              background: 'var(--gray-50)',
                              border: '1px dashed var(--gray-300)',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--gray-400)',
                              gap: 6,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>monitor_off</span>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>No captures logged</span>
                          </div>
                        ) : (feed.status === 'missing' || feed.Status === 'missing') ? (
                          <div
                            style={{
                              width: '100%',
                              height: 180,
                              background: 'var(--gray-50)',
                              border: '1px dashed var(--gray-300)',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--gray-400)',
                              gap: 6,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>no_photography</span>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>Screenshot unavailable (file missing)</span>
                          </div>
                        ) : (
                          <a href={getFullUrl(latestScreenshotUrl)} target="_blank" rel="noreferrer" title={`View full capture taken at ${new Date(capturedAt).toLocaleTimeString()}`}>
                            <img
                              src={getFullUrl(latestScreenshotUrl)}
                              alt={`${name}'s screen capture`}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "https://placehold.co/400x300?text=No+Preview+Available";
                              }}
                              style={{
                                width: '100%',
                                height: 180,
                                objectFit: 'cover',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--gray-200)',
                                display: 'block',
                                transition: 'transform 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            />
                          </a>
                        )}
                      </div>

                      {/* Capture time footer */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gray-500)', fontSize: 12 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                        <span>{formatRelativeTime(capturedAt)}</span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={() => setActiveScreenShare({ empId, name })}
                          title="Send live screen share request to employee"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>podcasts</span>
                          Stream
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={() => setActiveHistoryEmp({ empId, name })}
                          title="View last 15 minutes logs"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
                          History
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', fontSize: 11 }}
                          onClick={() => handleOpenEmployeeSettings(empId, name)}
                          title="Configure monitoring overrides for this employee"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>settings</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Stream Peer Connection Component Overlay */}
      {activeScreenShare && (
        <ScreenShareViewer
          targetEmpId={activeScreenShare.empId}
          targetEmpName={activeScreenShare.name}
          targetSpaceId={selectedSpaceId}
          onClose={() => setActiveScreenShare(null)}
        />
      )}

      {/* Retrospective History Modal Overlay */}
      {activeHistoryEmp && (
        <div style={pageStyles.modalOverlay}>
          <div style={pageStyles.modalCard}>
            {/* Header */}
            {(() => {
              const activeFeed = employeeFeeds.find(f => (f.empId || f.EmpId) === activeHistoryEmp.empId) || {};
              const latestCapturedAt = activeFeed.capturedAt || activeFeed.CapturedAt;
              const status = getStatusColorAndLabel(latestCapturedAt);
              const displayName = activeHistoryEmp.name || `Employee #${activeHistoryEmp.empId}`;

              return (
                <div style={pageStyles.modalHeader}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-600)' }}>history</span>
                      {displayName} (ID: {activeHistoryEmp.empId})
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 5, 
                        background: status.label === 'Active' ? '#F0FDF4' : status.label === 'Idle' ? '#FFFBEB' : 'var(--gray-50)', 
                        padding: '4px 10px', 
                        borderRadius: 99, 
                        border: `1px solid ${status.label === 'Active' ? '#BBF7D0' : status.label === 'Idle' ? '#FDE68A' : 'var(--gray-100)'}`,
                        fontSize: 12,
                        fontWeight: 600,
                        marginLeft: 10
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
                        <span style={{ color: status.label === 'Active' ? '#059669' : status.label === 'Idle' ? '#D97706' : 'var(--gray-600)' }}>{status.label}</span>
                      </span>
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                      Viewing all captured logs — retained per admin config
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchHistory(activeHistoryEmp.empId)}
                      disabled={loadingHistory}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, animation: loadingHistory ? 'spin 1s linear infinite' : 'none' }}>
                        sync
                      </span>
                      Refresh
                    </button>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--gray-400)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 4,
                        borderRadius: '50%',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gray-700)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--gray-400)')}
                      onClick={() => setActiveHistoryEmp(null)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Tabs selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 20 }}>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: historyTab === 'screenshots' ? '3px solid var(--primary-600)' : '3px solid transparent',
                  color: historyTab === 'screenshots' ? 'var(--primary-700)' : 'var(--gray-500)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                }}
                onClick={() => setHistoryTab('screenshots')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>image</span>
                Screenshots ({historyData.screenshots.length})
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: historyTab === 'videos' ? '3px solid var(--primary-600)' : '3px solid transparent',
                  color: historyTab === 'videos' ? 'var(--primary-700)' : 'var(--gray-500)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                }}
                onClick={() => setHistoryTab('videos')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>video_library</span>
                Screen Recordings ({historyData.videos.length})
              </button>
            </div>

            {/* Content Panel */}
            <div style={{ flexGrow: 1, overflowY: 'auto', minHeight: '300px', maxHeight: '50vh', padding: '4px' }}>
              {loadingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: 12 }}>
                  <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(99, 102, 241, 0.1)', borderTop: '4px solid var(--primary-600)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500 }}>Retrieving history feeds...</p>
                </div>
              ) : historyTab === 'screenshots' ? (
                historyData.screenshots.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--gray-400)', gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.5 }}>image_not_supported</span>
                    <div style={{ textAlign: 'center' }}>
                       <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)', margin: 0 }}>No Screenshots Available</p>
                       <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>No screen captures were registered within the retention period.</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {historyData.screenshots.map((item) => {
                      const url = item.screenshot_url || item.screenshotUrl || item.ScreenshotUrl;
                      const time = item.created_at || item.capturedAt || item.CapturedAt;
                      const isMissing = item.status === 'missing' || item.Status === 'missing';
                      return (
                        <div key={item.logid || item.logId || item.LogId} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, overflow: 'hidden', background: '#F8FAFC', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }}
                             onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                             onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}>
                          {isMissing ? (
                            <div
                              style={{
                                width: '100%',
                                height: 135,
                                background: 'var(--gray-50)',
                                borderBottom: '1px solid var(--gray-200)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--gray-400)',
                                gap: 4,
                                padding: 8,
                                textAlign: 'center'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>no_photography</span>
                              <span style={{ fontSize: 11, fontWeight: 500 }}>Screenshot unavailable (file missing)</span>
                            </div>
                          ) : (
                            <a href={getFullUrl(url)} target="_blank" rel="noreferrer" title="Click to view full size">
                              <img
                                src={getFullUrl(url)}
                                alt="History screenshot"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "https://placehold.co/400x300?text=Image+Not+Found";
                                }}
                                style={{ width: '100%', height: 135, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--gray-150)' }}
                              />
                            </a>
                          )}
                          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--gray-400)' }}>schedule</span>
                              <span>{new Date(time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--primary-600)', fontWeight: 600, marginTop: 2 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                              <span>Screenshot</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                historyData.videos.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--gray-400)', gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.5 }}>video_camera_back</span>
                    <div style={{ textAlign: 'center' }}>
                       <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)', margin: 0 }}>No Video Recordings</p>
                       <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>No screen recording chunks were saved within the retention period.</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {historyData.videos.map((item) => {
                      const url = item.video_url || item.videoUrl || item.VideoUrl;
                      const time = item.created_at || item.capturedAt || item.CapturedAt;
                      const isMissing = item.status === 'missing' || item.Status === 'missing';
                      return (
                        <div key={item.logid || item.logId || item.LogId} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, overflow: 'hidden', background: '#F8FAFC', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          {isMissing ? (
                            <div
                              style={{
                                width: '100%',
                                height: 160,
                                background: 'var(--gray-50)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--gray-400)',
                                gap: 4,
                                padding: 8,
                                textAlign: 'center',
                                borderBottom: '1px solid var(--gray-200)'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>video_camera_back</span>
                              <span style={{ fontSize: 11, fontWeight: 500 }}>Recording unavailable (file missing)</span>
                            </div>
                          ) : (
                            <video
                              src={getFullUrl(url)}
                              controls
                              style={{ width: '100%', height: 160, backgroundColor: '#000', display: 'block' }}
                            />
                          )}
                          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--gray-150)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--gray-400)' }}>schedule</span>
                              <span>{new Date(time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F43F5E', fontWeight: 600, marginTop: 2 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>videocam</span>
                              <span>Recording</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 20, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setActiveHistoryEmp(null)} style={{ padding: '8px 20px', fontSize: 14, fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const pageStyles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Elegant Slate overlay
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '850px',
    height: '100%',
    maxHeight: '80vh',
    backgroundColor: '#FFF',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid var(--gray-200)',
    paddingBottom: '12px',
  },
};

// Add quick keyframe injections for spinner
if (typeof document !== 'undefined') {
  const styleId = 'live-monitoring-style';
  if (!document.getElementById(styleId)) {
    const sheet = document.createElement('style');
    sheet.id = styleId;
    sheet.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(16, 185, 129, 0.6); }
        50% { opacity: 0.6; box-shadow: 0 0 12px rgba(16, 185, 129, 0.9); }
      }
    `;
    document.head.appendChild(sheet);
  }
}

const settingsModalStyles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99990, padding: 24,
  },
  panel: {
    width: '100%', maxWidth: 560, backgroundColor: '#FFF',
    borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    border: '1px solid rgba(226,232,240,0.8)',
    display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #F1F5F9',
    backgroundColor: '#FAFBFF',
  },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B',
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: '20px 24px', overflowY: 'auto', flexGrow: 1 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '16px 24px', borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFBFF',
  },
  fieldGroup: { marginBottom: 4 },
  fieldHeader: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  fieldLabel: { fontSize: 14, fontWeight: 700, color: '#0F172A', display: 'block' },
  fieldHint: { fontSize: 12, color: '#64748B', margin: '2px 0 0', lineHeight: 1.4 },
  inputRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  numberInput: { width: 90, fontWeight: 700, fontSize: 18, textAlign: 'center' },
  unit: { fontSize: 14, color: '#64748B', fontWeight: 600 },
  presets: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  presetBtn: {
    padding: '4px 10px', borderRadius: 6,
    border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
    color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s',
  },
  presetBtnActive: {
    backgroundColor: '#6366F1', color: '#FFF',
    border: '1px solid #6366F1',
    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', margin: '16px 0' },
  infoBox: {
    display: 'flex', gap: 10, backgroundColor: '#EEF2FF',
    borderRadius: 8, padding: 12, borderLeft: '4px solid #6366F1',
    marginTop: 16,
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid #E2E8F0',
    borderTop: '3px solid #6366F1',
    animation: 'lm-spin 0.8s linear infinite',
    margin: '0 auto',
    display: 'inline-block',
  },
};

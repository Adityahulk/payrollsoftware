import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../AuthContext';
import { notificationsApi } from '../api';
import { SIGNALR_HUB_URL } from '../config';
import toast from 'react-hot-toast';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const connectionRef = useRef(null);

  const role = user?.role || 'Employee';
  const empId = user?.empId || user?.EmpId || 0;
  const spaceId = user?.spaceId || user?.SpaceId || 0;

  // Check read status role-wise
  const isNotificationRead = (n) => {
    if (role === 'Admin') return n.isReadAdmin || n.IsReadAdmin;
    if (role === 'Manager') return n.isReadManager || n.IsReadManager;
    if (role === 'TeamLead' || role === 'TL') return n.isReadTl || n.IsReadTl;
    return n.isReadEmployee || n.IsReadEmployee;
  };

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.getNotifications({ role, empId, spaceId });
      if (res.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    if (empId) {
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Connect to SignalR
  useEffect(() => {
    if (!empId) return;

    const token = sessionStorage.getItem('token');
    const connection = new HubConnectionBuilder()
      .withUrl(SIGNALR_HUB_URL, {
        accessTokenFactory: () => token || '',
        withCredentials: true
      })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    connectionRef.current = connection;

    const startConnection = async () => {
      try {
        await connection.start();
        console.log('[SignalR] Connected successfully.');
      } catch (err) {
        console.warn('[SignalR] Connection failed, retrying in 100s...', err);
        setTimeout(startConnection, 100000);
      }
    };

    connection.on('ReceiveNotification', (notification) => {
      // Dynamic client-side routing & filtering
      const targetRoles = notification.targetRole || notification.TargetRole || '';
      const notifSpaceId = notification.spaceId ?? notification.SpaceId ?? 0;

      let isRelevant = false;

      if (role === 'Admin') {
        isRelevant = notification.toType === 'Notification' &&
          (targetRoles.includes('Admin') || targetRoles.includes('System')) &&
          notifSpaceId === spaceId;
      } else if (role === 'Manager') {
        isRelevant = notification.toType === 'Notification' &&
          targetRoles.includes('Manager') &&
          notifSpaceId === spaceId;
      } else if (role === 'TeamLead' || role === 'TL') {
        isRelevant = notification.toType === 'Notification' &&
          targetRoles.includes('TL') &&
          notifSpaceId === spaceId;
      } else if (role === 'Employee') {
        // Employee gets warnings to them, space notices, query replies
        const toType = notification.toType || notification.ToType;
        const targetEmpId = notification.employeeId ?? notification.EmployeeId ?? 0;
        const queryCreatorId = notification.adminId ?? notification.AdminId ?? 0;

        isRelevant = (toType === 'Warning' && targetEmpId === empId) ||
          (toType === 'Notice' && notifSpaceId === spaceId) ||
          (toType === 'Query' && queryCreatorId === empId && (notification.reply || notification.Reply));
      }

      if (isRelevant) {
        setNotifications((prev) => [notification, ...prev]);
        toast.info(notification.noticeText || notification.NoticeText || 'New system update!', {
          icon: '🔔',
          duration: 8000,
        });
      }
    });

    startConnection();

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id, role);
      // Immediately remove notification from UI
      setNotifications((prev) =>
        prev.filter((n) => {
          const nId = n.noticeId ?? n.NoticeId;
          return nId !== id;
        })
      );
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const unreadCount = notifications.filter((n) => !isNotificationRead(n)).length;

  const formatTime = (timeStr) => {
    if (!timeStr) return 'Just now';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Notification Bell Trigger */}
      <button
        className="icon-btn"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--gray-700)' }}>notifications</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              background: '#EF4444',
              color: '#FFF',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #FFF',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {open && (
        <div className="notification-dropdown">
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-800)' }}>Notifications</span>
            {unreadCount > 0 && (
              <span className="badge badge-error" style={{ fontSize: 10, fontWeight: 700 }}>
                {unreadCount} New
              </span>
            )}
          </div>

          {/* List */}
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 6 }}>notifications_off</span>
                <span style={{ fontSize: 13 }}>All caught up!</span>
              </div>
            ) : (
              notifications.map((n) => {
                const nId = n.noticeId ?? n.NoticeId;
                const isRead = isNotificationRead(n);
                const text = n.noticeText ?? n.NoticeText;
                const dateStr = n.createdAt ?? n.CreatedAt;

                return (
                  <div
                    key={nId}
                    onClick={() => {
                      handleMarkAsRead(nId);
                      setOpen(false); // Close dropdown immediately
                    }}
                    className={`notification-item ${isRead ? '' : 'unread'}`}
                  >
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isRead ? 'transparent' : 'var(--primary-500)',
                      marginTop: 6,
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13,
                        color: 'var(--gray-700)',
                        margin: '0 0 4px',
                        lineHeight: '1.4',
                        fontWeight: isRead ? 500 : 700
                      }}>
                        {text}
                      </p>
                      <span style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: 'JetBrains Mono' }}>
                        {formatTime(dateStr)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

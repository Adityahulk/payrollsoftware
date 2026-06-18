import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../AuthContext';
import { BACKEND_ORIGIN } from '../config';
import toast from 'react-hot-toast';

export default function ScreenShareBroadcaster({ isClockedIn }) {
  const { user } = useAuth();
  const [request, setRequest] = useState(null); // { adminConnectionId, targetEmpId }
  // eslint-disable-next-line no-unused-vars
  const [isStreaming, setIsStreaming] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const connectionRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const streamRef = useRef(null);

  const empId = parseInt(user?.empId || user?.EmpId || 0, 10);
  const spaceId = parseInt(user?.spaceId || user?.SpaceId || 0, 10);
  const role = user?.role || 'Employee';

  // Do not activate screen sharing broadcaster for Admins or SuperAdmins
  const isMonitored = role !== 'Admin' && role !== 'SuperAdmin';

  const autoAcceptRequestRef = useRef();

  const autoAcceptRequest = async (currentRequest) => {
    try {
      // Try to reuse the background capture stream from AppLayout
      const stream = window.monitorStream;
      if (!stream || stream.getTracks().every(t => t.readyState === 'ended')) {
        // No live background stream — show consent modal for fresh share
        setShowConsentModal(true);
        return;
      }

      setIsStreaming(true);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Add tracks to PC
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && connectionRef.current && connectionRef.current.state === 'Connected') {
          connectionRef.current.invoke(
            'SendIceCandidate',
            currentRequest.adminConnectionId,
            JSON.stringify(event.candidate)
          ).catch((err) => console.warn('[WebRTC] Failed to send ICE candidate:', err));
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          stopScreenShare(true);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (connectionRef.current) {
        await connectionRef.current.invoke('SendOffer', currentRequest.adminConnectionId, offer.sdp);
        await connectionRef.current.invoke('NotifyScreenShareActive', empId, spaceId, true);
      }

      console.log('Live screen stream shared successfully.');
    } catch (err) {
      console.error('[ScreenShare] Auto accept failed, falling back to modal:', err);
      setShowConsentModal(true);
    }
  };

  autoAcceptRequestRef.current = autoAcceptRequest;

  useEffect(() => {
    if (!empId || !isMonitored) return;

    // Get JWT token for SignalR authentication
    const token = sessionStorage.getItem('token');

    // Connect to the ScreenShare SignalR Hub
    const url = `${BACKEND_ORIGIN}/hub/screenshare`;
    const connection = new HubConnectionBuilder()
      .withUrl(url, {
        // Pass JWT token so the Hub can identify the employee
        accessTokenFactory: () => token || '',
        withCredentials: true
      })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    connectionRef.current = connection;

    const startConnection = async () => {
      try {
        await connection.start();
        console.log('[ScreenShare Hub] Connected as empId:', empId);
        // Join the department room for isolation
        await connection.invoke('JoinRoom', spaceId);
      } catch (err) {
        console.error('[ScreenShare Hub] Connection failed, retrying in 5s...', err);
        setTimeout(startConnection, 5000);
      }
    };

    // Listen for screen sharing request from supervisors
    connection.on('RequestScreenShare', (targetEmpId, adminConnectionId) => {
      console.log(`[ScreenShare Hub] Incoming request for empId: ${targetEmpId}. Our empId: ${empId}`);
      if (targetEmpId === empId) {
        const reqObj = { adminConnectionId, targetEmpId };
        setRequest(reqObj);
        const stream = window.monitorStream;
        if (stream && stream.getTracks().some(t => t.readyState === 'live')) {
          console.log('[ScreenShare Hub] Reusing active background stream.');
          autoAcceptRequestRef.current(reqObj);
        } else {
          setShowConsentModal(true);
          console.log('Supervisor requested screen sharing.');
        }
      }
    });

    // Listen for WebRTC Answer
    connection.on('ReceiveAnswer', async (fromConnectionId, sdp) => {
      console.log(`[ScreenShare Hub] Received answer from admin: ${fromConnectionId}`);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp })
          );
        } catch (err) {
          console.error('[WebRTC] Error setting remote description:', err);
        }
      }
    });

    // Listen for WebRTC ICE Candidates
    connection.on('ReceiveIceCandidate', async (fromConnectionId, candidateStr) => {
      if (peerConnectionRef.current) {
        try {
          const candidate = JSON.parse(candidateStr);
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      }
    });

    startConnection();

    return () => {
      stopScreenShare(false);
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleConsentAccept = async () => {
    setShowConsentModal(false);
    if (!request) return;

    try {
      // 1. Get browser display media (native screen selection popup)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor' // Prefer whole screen if supported
        },
        audio: false
      });

      streamRef.current = stream;
      setIsStreaming(true);

      // 2. Initialize WebRTC Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Add tracks to PC
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE Candidates generated locally and send them to the admin
      pc.onicecandidate = (event) => {
        if (event.candidate && connectionRef.current && connectionRef.current.state === 'Connected') {
          connectionRef.current.invoke(
            'SendIceCandidate',
            request.adminConnectionId,
            JSON.stringify(event.candidate)
          ).catch((err) => console.warn('[WebRTC] Failed to send ICE candidate:', err));
        }
      };

      // Watch for peer connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          stopScreenShare(true);
        }
      };

      // If the employee stops sharing via the browser's native stop button
      stream.getVideoTracks()[0].onended = () => {
        console.log('[WebRTC] Stream track ended by browser control.');
        stopScreenShare(true);
      };

      // 3. Create Offer SDP and send it
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (connectionRef.current) {
        await connectionRef.current.invoke('SendOffer', request.adminConnectionId, offer.sdp);
        // Notify the hub group that this screen share is active
        await connectionRef.current.invoke('NotifyScreenShareActive', empId, spaceId, true);
      }

      console.log('Screen sharing started successfully.');
    } catch (err) {
      console.error('[ScreenShare] Failed to initialize screen sharing:', err);
      setIsStreaming(false);
      setRequest(null);

      // Notify active = false just in case
      if (connectionRef.current) {
        try {
          await connectionRef.current.invoke('NotifyScreenShareActive', empId, spaceId, false);
        } catch { }
      }
    }
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
    setRequest(null);
    console.log('Screen share request declined.');
  };

  const stopScreenShare = async (notifyHub = true) => {
    console.log('[ScreenShare] Stopping screen sharing...');
    setIsStreaming(false);
    setRequest(null);

    // Only stop the stream if it was a fresh stream (not the shared background stream)
    if (streamRef.current && streamRef.current !== window.monitorStream) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    } else {
      streamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (notifyHub && connectionRef.current) {
      try {
        await connectionRef.current.invoke('NotifyScreenShareActive', empId, spaceId, false);
      } catch (err) {
        console.warn('Failed to notify active state off:', err);
      }
    }
  };

  if (!isMonitored) return null;

  return (
    <>
      {/* Consent Request Modal */}
      {showConsentModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="card fade-in">
            <div style={styles.modalHeader}>
              <span className="material-symbols-outlined" style={styles.warningIcon}>monitor</span>
              <h3 style={styles.modalTitle}>Live Screen Share Request</h3>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalText}>
                A supervisor (Manager or Administrator) in your workspace is requesting to view your screen live.
              </p>
              <div style={styles.infoAlert}>
                <span className="material-symbols-outlined" style={styles.infoIcon}>info</span>
                <span style={styles.infoText}>
                  Accepting will trigger a browser dialog to select which screen or window you wish to share. You can stop sharing at any time.
                </span>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.declineButton} onClick={handleConsentDecline}>
                Decline
              </button>
              <button style={styles.acceptButton} onClick={handleConsentAccept}>
                Agree &amp; Share
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  );
}

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalCard: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: '#FFF',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  warningIcon: {
    fontSize: '28px',
    color: '#6366F1',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0F172A',
    margin: 0,
  },
  modalBody: {
    marginBottom: '24px',
  },
  modalText: {
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.6',
    margin: '0 0 16px 0',
  },
  infoAlert: {
    display: 'flex',
    gap: '10px',
    backgroundColor: '#EEF2F6',
    borderRadius: '8px',
    padding: '12px',
    borderLeft: '4px solid #6366F1',
  },
  infoIcon: {
    fontSize: '20px',
    color: '#6366F1',
    flexShrink: 0,
  },
  infoText: {
    fontSize: '12.5px',
    color: '#475569',
    lineHeight: '1.5',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  declineButton: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFF',
    color: '#64748B',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  acceptButton: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#6366F1',
    color: '#FFF',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
    transition: 'all 0.2s',
  },
  streamingBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '42px',
    backgroundColor: '#EF4444',
    color: '#FFF',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    fontFamily: 'system-ui, sans-serif',
  },
  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 16px',
    width: '100%',
    maxWidth: '1200px',
  },
  pulseDot: {
    width: '10px',
    height: '10px',
    backgroundColor: '#FFF',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  bannerText: {
    fontSize: '13px',
    flexGrow: 1,
  },
  stopBannerBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '4px',
    color: '#FFF',
    padding: '4px 12px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
  },
  surveillanceBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '40px',
    background: 'linear-gradient(90deg, #FEF08A 0%, #FDE047 100%)',
    borderBottom: '1px solid #EAB308',
    color: '#713F12',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(202, 138, 4, 0.15)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  pulseDotYellow: {
    width: '8px',
    height: '8px',
    backgroundColor: '#CA8A04',
    borderRadius: '50%',
    animation: 'pulse-yellow 2s infinite',
  },
  bannerTextYellow: {
    fontSize: '12.5px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    letterSpacing: '0.01em',
  },
  bannerIcon: {
    fontSize: '18px',
    color: '#B45309',
    verticalAlign: 'middle',
  }
};

// Add a quick keyframe injection if it does not exist
if (typeof document !== 'undefined') {
  const styleId = 'screenshare-pulse-style';
  if (!document.getElementById(styleId)) {
    const sheet = document.createElement('style');
    sheet.id = styleId;
    sheet.innerHTML = `
      @keyframes pulse {
        0% { opacity: 0.3; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.1); }
        100% { opacity: 0.3; transform: scale(0.9); }
      }
      @keyframes pulse-yellow {
        0% { opacity: 0.4; transform: scale(0.95); }
        50% { opacity: 1; transform: scale(1.1); }
        100% { opacity: 0.4; transform: scale(0.95); }
      }
    `;
    document.head.appendChild(sheet);
  }
}

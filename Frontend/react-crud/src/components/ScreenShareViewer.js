import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../AuthContext';
import { BACKEND_ORIGIN } from '../config';
import toast from 'react-hot-toast';

export default function ScreenShareViewer({ targetEmpId, targetEmpName, targetSpaceId, onClose }) {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('Connecting to hub...');
  const [isLive, setIsLive] = useState(false);

  const videoRef = useRef(null);
  const connectionRef = useRef(null);
  const visibilityRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const spaceId = parseInt(targetSpaceId || user?.spaceId || user?.SpaceId || 0, 10);

  useEffect(() => {
    if (!targetEmpId) return;

    // Get JWT token from session so the hub recognizes the admin
    const token = sessionStorage.getItem('token');

    // ── Buffer ICE candidates that arrive before setRemoteDescription ──────────
    // This is the most common WebRTC race condition: ICE candidates sent by the
    // employee arrive at the admin BEFORE the offer is processed and
    // setRemoteDescription is called. addIceCandidate fails without a remote desc.
    let iceCandidateBuffer = [];
    let remoteDescriptionSet = false;

    const url = `${BACKEND_ORIGIN}/hub/screenshare`;
    const connection = new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => token || '',
        withCredentials: true
      })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    connectionRef.current = connection;

    const setupSignalR = async () => {
      try {
        await connection.start();
        console.log('[ScreenShare Viewer] Hub connected. Requesting empId:', targetEmpId);
        setConnectionStatus('Connected. Sending screen request to employee...');

        // 1. Join the space room (so we receive StreamStateChanged broadcasts)
        await connection.invoke('JoinRoom', spaceId);

        // 2. Request screen share from target employee
        await connection.invoke('InitiateScreenRequest', targetEmpId, spaceId);
        setConnectionStatus('Request sent. Waiting for employee consent...');
      } catch (err) {
        console.error('[ScreenShare Viewer] Hub failed:', err);
        setConnectionStatus('Connection failed. Please close and try again.');
      }
    };

    // ── ReceiveOffer ─────────────────────────────────────────────────────────────
    // The employee sends us a WebRTC offer after accepting the screen share request
    connection.on('ReceiveOffer', async (streamerConnectionId, sdp) => {
      console.log('[WebRTC Viewer] Received SDP offer from employee:', streamerConnectionId);
      setConnectionStatus('Negotiating peer-to-peer connection...');

      try {
        // Close any existing peer connection
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        });

        peerConnectionRef.current = pc;

        // ── ontrack: video stream arrives → bind to <video> element ─────────────
        pc.ontrack = (event) => {
          console.log('[WebRTC Viewer] Remote track received:', event.track.kind, event.streams.length);
          if (videoRef.current) {
            const remoteStream = (event.streams && event.streams[0])
              ? event.streams[0]
              : new MediaStream([event.track]);

            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(e => console.warn('[WebRTC] autoplay failed:', e));

            const handleVisibility = () => {
              if (!document.hidden && videoRef.current) {
                videoRef.current.play().catch(() => { });
              }
            };
            visibilityRef.current = handleVisibility;
            document.addEventListener('visibilitychange', handleVisibility);

            setIsLive(true);
            setConnectionStatus('🔴 Streaming Live');
          }
        };

        // ── onicecandidate: send our ICE candidates to the employee ──────────────
        pc.onicecandidate = (event) => {
          if (event.candidate && connectionRef.current?.state === 'Connected') {
            connectionRef.current.invoke(
              'SendIceCandidate',
              streamerConnectionId,
              JSON.stringify(event.candidate)
            ).catch(err => console.warn('[WebRTC Viewer] ICE send failed:', err));
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC Viewer] ICE state:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC Viewer] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setConnectionStatus('🔴 Streaming Live');
          } else if (
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'failed' ||
            pc.connectionState === 'closed'
          ) {
            setIsLive(false);
            setConnectionStatus('Stream disconnected.');
            toast.error('The screen stream was lost.');
          }
        };

        // ── Step 1: Set remote description (the employee's offer) ────────────────
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
        console.log('[WebRTC Viewer] Remote description (offer) set successfully.');

        // ── Step 2: Apply buffered ICE candidates that arrived before the offer ──
        remoteDescriptionSet = true;
        for (const buffered of iceCandidateBuffer) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(buffered)));
            console.log('[WebRTC Viewer] Applied buffered ICE candidate.');
          } catch (e) {
            console.warn('[WebRTC Viewer] Failed to apply buffered ICE candidate:', e);
          }
        }
        iceCandidateBuffer = [];

        // ── Step 3: Create answer and set local description ──────────────────────
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC Viewer] Answer created and local description set.');

        // ── Step 4: Send answer back to the employee ─────────────────────────────
        await connection.invoke('SendAnswer', streamerConnectionId, answer.sdp);
        console.log('[WebRTC Viewer] Answer sent to employee.');

      } catch (err) {
        console.error('[WebRTC Viewer] Negotiation error:', err);
        setConnectionStatus('WebRTC negotiation failed. Please try again.');
        toast.error('Live stream negotiation failed.');
      }
    });

    // ── ReceiveIceCandidate ──────────────────────────────────────────────────────
    // CRITICAL: Buffer candidates if remote description isn't set yet.
    // Without buffering, ICE candidates that arrive before the offer is processed
    // are dropped → no ICE path → no video.
    connection.on('ReceiveIceCandidate', async (streamerConnectionId, candidateStr) => {
      if (!peerConnectionRef.current || !remoteDescriptionSet) {
        // Buffer it — will be applied after setRemoteDescription
        console.log('[WebRTC Viewer] Buffering ICE candidate (remote desc not set yet).');
        iceCandidateBuffer.push(candidateStr);
        return;
      }
      try {
        const candidate = JSON.parse(candidateStr);
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC Viewer] ICE candidate add failed:', err.message);
      }
    });

    // ── StreamStateChanged ───────────────────────────────────────────────────────
    connection.on('StreamStateChanged', (empId, streamerConnId, isActive) => {
      if (parseInt(empId) === parseInt(targetEmpId) && !isActive) {
        setIsLive(false);
        setConnectionStatus('Employee stopped sharing their screen.');
        toast('Screen sharing ended.', { icon: '📴' });
        setTimeout(() => onClose(), 2000);
      }
    });

    setupSignalR();

    return () => {
      console.log('[ScreenShare Viewer] Cleaning up...');
      if (visibilityRef.current) {
        document.removeEventListener('visibilitychange', visibilityRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (connectionRef.current) {
        connectionRef.current.invoke('LeaveRoom', spaceId).catch(() => { });
        connectionRef.current.stop();
      }
      iceCandidateBuffer = [];
    };
  }, [targetEmpId, spaceId, onClose]);

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) videoRef.current.requestFullscreen();
      else if (videoRef.current.webkitRequestFullscreen) videoRef.current.webkitRequestFullscreen();
    }
  };

  return (
    <div style={styles.viewerOverlay}>
      <div style={styles.viewerContainer}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.titleRow}>
              <span className="material-symbols-outlined" style={styles.liveIcon}>podcasts</span>
              <h2 style={styles.title}>Live Screen: {targetEmpName}</h2>
              {isLive && <span style={styles.liveBadge}>LIVE</span>}
              <span style={styles.surveillanceBadge}>CONTINUOUS SURVEILLANCE ACTIVE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#FBBF24' }}>shield</span>
              <span style={{ fontSize: '12px', color: '#FBBF24', fontWeight: '500' }}>
                Employee dashboard displays continuous surveillance warning.
              </span>
            </div>
            <p style={{ ...styles.statusText, marginTop: '4px' }}>{connectionStatus}</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} title="Close Stream">
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
          </button>
        </div>

        {/* Video / Placeholder */}
        <div style={styles.playerWrapper}>
          {!isLive && (
            <div style={styles.placeholder}>
              <div style={styles.loadingRing} />
              <p style={styles.placeholderText}>Waiting for employee...</p>
              <p style={styles.placeholderHint}>
                The employee will see a consent popup. Once they accept, the live stream will appear here.
              </p>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ ...styles.video, display: isLive ? 'block' : 'none' }}
          />
          {isLive && (
            <div style={styles.controlBar}>
              <button style={styles.controlBtn} onClick={handleFullscreen}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fullscreen</span>
                Fullscreen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  viewerOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#090D16', zIndex: 99999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', fontFamily: 'system-ui, sans-serif',
  },
  viewerContainer: {
    width: '100%', maxWidth: '1200px', height: '100%', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    backgroundColor: '#111827', borderRadius: '16px',
    border: '1px solid #374151',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #374151',
    backgroundColor: '#1F2937',
  },
  titleRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px',
  },
  liveIcon: { fontSize: '24px', color: '#F43F5E' },
  title: { fontSize: '18px', fontWeight: '700', color: '#F9FAFB', margin: 0 },
  liveBadge: {
    backgroundColor: '#EF4444', color: '#FFF', fontSize: '10px',
    fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
    letterSpacing: '0.05em', animation: 'ssv-pulse 1.5s infinite',
  },
  surveillanceBadge: {
    backgroundColor: '#FACC15', color: '#1E293B', fontSize: '10px',
    fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
    letterSpacing: '0.05em', marginLeft: '8px', display: 'inline-flex',
    alignItems: 'center',
  },
  statusText: { fontSize: '13px', color: '#9CA3AF', margin: 0 },
  closeBtn: {
    backgroundColor: 'transparent', border: 'none', color: '#D1D5DB',
    cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  playerWrapper: {
    flexGrow: 1, position: 'relative', backgroundColor: '#030712',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  placeholder: { textAlign: 'center', padding: '40px', zIndex: 2 },
  loadingRing: {
    width: '52px', height: '52px',
    border: '4px solid rgba(99,102,241,0.15)',
    borderTop: '4px solid #6366F1',
    borderRadius: '50%', margin: '0 auto 20px',
    animation: 'ssv-spin 1s linear infinite',
  },
  placeholderText: { fontSize: '16px', color: '#F3F4F6', fontWeight: '600', margin: '0 0 8px 0' },
  placeholderHint: { fontSize: '13px', color: '#6B7280', maxWidth: '360px', margin: '0 auto', lineHeight: '1.5' },
  video: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
  controlBar: { position: 'absolute', bottom: '20px', right: '20px', zIndex: 10 },
  controlBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    backgroundColor: 'rgba(31,41,55,0.85)', border: '1px solid #4B5563',
    borderRadius: '8px', color: '#F9FAFB', padding: '8px 16px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
};

if (typeof document !== 'undefined') {
  const styleId = 'ssv-keyframes';
  if (!document.getElementById(styleId)) {
    const sheet = document.createElement('style');
    sheet.id = styleId;
    sheet.innerHTML = `
      @keyframes ssv-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes ssv-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
    `;
    document.head.appendChild(sheet);
  }
}

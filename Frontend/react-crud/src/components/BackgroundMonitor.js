import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { monitorApi, attendanceApi } from '../api';
import ScreenShareBroadcaster from './ScreenShareBroadcaster';

export default function BackgroundMonitor() {
  const { user } = useAuth();

  // Background monitoring refs and state
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const intervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recorderIntervalRef = useRef(null);

  const empId = user?.empId || user?.EmpId;
  const userRole = user?.role || 'Employee';
  const isMonitored = userRole !== 'Admin' && userRole !== 'SuperAdmin';
  const [isClockedIn, setIsClockedIn] = useState(false);

  // Check clock-in status on mount and listen to clock events
  useEffect(() => {
    // On logout (empId becomes null), reset clock state immediately so recorder stops
    if (!empId || !isMonitored) {
      setIsClockedIn(false);
      return;
    }

    const checkClockStatus = async () => {
      try {
        const r = await attendanceApi.getMyAttendance();
        const data = r.data || {};
        const att = Array.isArray(data.attendance) ? data.attendance : Array.isArray(data) ? data : [];
        const todayRecord = att.find(a => {
          const d = new Date(a.attendanceDate || a.attendancedate || a.clockIn || a.clockin);
          return d.toDateString() === new Date().toDateString();
        });
        // Handle both camelCase (clockIn/clockOut) and lowercase (clockin/clockout) from API
        const hasClockedIn = !!(todayRecord?.clockIn || todayRecord?.clockin);
        const hasClockedOut = !!(todayRecord?.clockOut || todayRecord?.clockout);
        const clockedIn = hasClockedIn && !hasClockedOut;
        console.log('[Background Capture] Clock-in check — today record:', todayRecord, '| clockedIn:', clockedIn);
        setIsClockedIn(clockedIn);
      } catch (err) {
        console.error("[Background Capture] Failed to check clock-in status:", err);
      }
    };

    checkClockStatus();

    const handleClockInEvent = () => {
      console.log('[Background Capture] Received clock-in event.');
      setIsClockedIn(true);
    };
    const handleClockOutEvent = () => {
      console.log('[Background Capture] Received clock-out event.');
      setIsClockedIn(false);
    };

    window.addEventListener('clock-in-event', handleClockInEvent);
    window.addEventListener('clock-out-event', handleClockOutEvent);

    return () => {
      window.removeEventListener('clock-in-event', handleClockInEvent);
      window.removeEventListener('clock-out-event', handleClockOutEvent);
    };
  // NOTE: `user` is included so this effect re-runs on every login/logout cycle.
  // Without it, re-logging in as the same employee (same empId) would NOT re-trigger
  // the clock-in check, causing the recorder to silently stay off.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId, isMonitored, user]);

  // Capture loop runs ONLY when clocked in and monitored
  useEffect(() => {
    if (!empId || !isMonitored || !isClockedIn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (recorderIntervalRef.current) {
        clearInterval(recorderIntervalRef.current);
        recorderIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        window.monitorStream = null;
        console.log('Silent screen monitoring stopped.');
      }
      return;
    }

    let activeStream = null;
    let activeInterval = null;
    let activeRecorderInterval = null;
    let activeMediaRecorder = null;

    const startBackgroundCapture = async () => {
      if (streamRef.current) return;

      try {
        console.log('[Background Capture] Requesting screen share permissions...');
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: false
        });

        activeStream = stream;
        streamRef.current = stream;
        window.monitorStream = stream;

        const video = document.createElement("video");
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        
        await video.play();
        // Resume playback when tab becomes visible again
        const handleVisibility = () => {
          if (!document.hidden && videoRef.current) {
            videoRef.current.play().catch(err => {
              console.warn('[Background Capture] Playback resume failed:', err);
            });
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        // Cleanup listener when stream stops
        const cleanup = () => {
          document.removeEventListener('visibilitychange', handleVisibility);
        };
        // Ensure cleanup on component unmount or stream end
        window.addEventListener('beforeunload', cleanup);
        videoRef.current = video;

        stream.getVideoTracks()[0].onended = () => {
          // If the page is hidden (e.g., user switched tabs), ignore the ended event to keep monitoring active.
          if (document.hidden) {
            console.log('[Background Capture] Stream track ended due to tab visibility change; ignoring.');
            return;
          }
          console.warn('[Background Capture] Stream track ended by user.');
          setIsClockedIn(false); // Trigger cleanup
        };

        const canvas = document.createElement("canvas");
        
        // Helper to detect if a canvas frame is solid black/blank
        const isCanvasBlank = (cv) => {
          const ctx = cv.getContext('2d');
          if (!ctx) return true;
          try {
            const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
            for (let i = 0; i < data.length; i += 400) {
              if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
                return false; // Not blank, found non-black pixel
              }
            }
            return true; // Solid black
          } catch (e) {
            return false; // Fallback
          }
        };

        // ── 1. Screenshot Capture interval (every 60s) ──
        activeInterval = setInterval(() => {
          if (!videoRef.current || !streamRef.current) return;
          
          const activeVideo = videoRef.current;
          if (activeVideo.videoWidth === 0 || activeVideo.videoHeight === 0) return;

          canvas.width = activeVideo.videoWidth;
          canvas.height = activeVideo.videoHeight;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
            
            if (isCanvasBlank(canvas)) {
              console.log('[Background Capture] Ignored black/blank frame.');
              return;
            }

            canvas.toBlob(async (blob) => {
              if (!blob) return;

              try {
                const formData = new FormData();
                formData.append("imageFile", blob, "screenshot.jpg");
                formData.append("empId", empId);

                await monitorApi.uploadScreenshot(formData);
                console.log('[Background Capture] Screenshot uploaded successfully.');
              } catch (uploadErr) {
                console.error('[Background Capture] Upload failed:', uploadErr);
              }
            }, "image/jpeg", 0.7);
          }
        }, 60000);

        intervalRef.current = activeInterval;

        // ── 2. Video Recording interval (every 60s chunks) ──
        const getSupportedMimeType = () => {
          const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
          ];
          for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
          }
          return '';
        };

        const mimeType = getSupportedMimeType();
        if (mimeType) {
          let chunks = [];
          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          activeMediaRecorder = mediaRecorder;
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          mediaRecorder.onstop = async () => {
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, { type: mimeType });
            chunks = [];

            try {
              const formData = new FormData();
              formData.append("videoFile", blob, "recording.webm");
              formData.append("empId", empId);

              await monitorApi.uploadVideo(formData);
              console.log('[Background Capture] Video chunk uploaded successfully.');
            } catch (err) {
              console.error('[Background Capture] Video chunk upload failed:', err);
            }
          };

          // Start initial chunk
          mediaRecorder.start();

          activeRecorderInterval = setInterval(() => {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
            mediaRecorder.start();
          }, 60000);

          recorderIntervalRef.current = activeRecorderInterval;
        }

        console.log('Silent screen monitoring started.');
      } catch (err) {
        console.error('[Background Capture] Permission denied or failed to initialize:', err);
        setIsClockedIn(false);
      }
    };

    startBackgroundCapture();

    return () => {
      if (activeInterval) clearInterval(activeInterval);
      if (activeRecorderInterval) clearInterval(activeRecorderInterval);
      if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
        try { activeMediaRecorder.stop(); } catch (e) {}
      }
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      streamRef.current = null;
      window.monitorStream = null;
    };
  }, [empId, isMonitored, isClockedIn]);

  return <ScreenShareBroadcaster isClockedIn={isClockedIn} />;
}

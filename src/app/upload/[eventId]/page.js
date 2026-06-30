"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, AlertCircle, Loader2, Zap, Image as ImageIcon, Video, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * /upload/[eventId]?secret=YOUR_SECRET
 *
 * Universal upload page — no login required.
 * Works on:
 *   • Any smartphone (opens rear camera on every tap)
 *   • Any tablet or laptop with a camera
 *   • As the HTTP target for Python/FTP bridge scripts
 *
 * Every captured photo is POSTed to /api/upload/[eventId]
 * and appears instantly in the guest stream via Supabase Realtime.
 */
export default function UploadPage({ params, searchParams }) {
  const resolvedParams  = React.use(params);
  const resolvedSearch  = React.use(searchParams);
  const { eventId }     = resolvedParams;

  // ── Secret resolution ─────────────────────────────────────
  // Priority: URL param → localStorage (saved from previous visit) → empty
  // This means: scan QR once (with ?secret=), and it works forever after
  // even if the URL no longer carries the secret param.
  const STORAGE_KEY = 'aura_upload_secret';
  const urlSecret   = resolvedSearch?.secret || '';
  const [secret, setSecret] = useState(urlSecret);

  useEffect(() => {
    if (urlSecret) {
      // Got secret from URL — save it for future visits
      localStorage.setItem(STORAGE_KEY, urlSecret);
      setSecret(urlSecret);
    } else {
      // No secret in URL — try to recover from localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSecret(saved);
    }
  }, [urlSecret]);

  const [eventName,    setEventName]    = useState('Wedding Event');
  const [count,        setCount]        = useState(0);
  const [status,       setStatus]       = useState('idle'); // idle | uploading | success | error
  const [errorMsg,     setErrorMsg]     = useState('');
  const [recentPhotos, setRecentPhotos] = useState([]); // { url, id }
  const [isReady,      setIsReady]      = useState(false);

  // Webcam states
  const [uploadMode,      setUploadMode]      = useState('native'); // native | webcam
  const [devices,         setDevices]         = useState([]);
  const [selectedDeviceId,setSelectedDeviceId]= useState('');
  
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ── Fetch event name ────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/event-name/${eventId}`)
      .then(r => r.json())
      .then(d => { if (d.event_name) setEventName(d.event_name); })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, [eventId]);

  // ── Core: upload selected file to API ──────────────────────
  const uploadFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    setStatus('uploading');
    setErrorMsg('');

    try {
      const form = new FormData();
      form.append('file', file);

      const url = `/api/upload/${eventId}${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`;
      console.log('[upload] POST →', url, 'file:', file.name, file.size, 'bytes');

      const res  = await fetch(url, { method: 'POST', body: form });
      let json = {};
      try { json = await res.json(); } catch (_) {}
      console.log('[upload] API response:', res.status, json);

      if (!res.ok) throw new Error(json.errors?.[0]?.error || json.error || `HTTP ${res.status}`);

      const publicUrl = json.results?.[0]?.public_url;

      setCount(n => n + 1);
      setStatus('success');
      if (publicUrl) {
        setRecentPhotos(prev => [{ url: publicUrl, id: json.results[0].id }, ...prev.slice(0, 8)]);
      }

      // Auto-reset to idle after 1.5 s so photographer can shoot again immediately
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      console.error('[upload] Error:', err);
      setStatus('error');
      // Keep error message visible until user taps again (not auto-dismissed)
      setErrorMsg(err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same shutter press works again next time
    e.target.value = '';
  };

  const triggerCamera = () => {
    if (status === 'uploading') return; // don't open while busy
    inputRef.current?.click();
  };

  // ── Webcam Stream Management ───────────────────────────────
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startWebcam = async (deviceId) => {
    stopWebcam();
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      // Re-enumerate devices in case labels are now populated after permission grant
      await getDevices();
    } catch (err) {
      console.error('Failed to access webcam:', err);
      setErrorMsg('Webcam access error: ' + err.message);
      setStatus('error');
    }
  };

  const getDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  };

  // Handle webcam toggle/cleanup lifecycle
  useEffect(() => {
    if (uploadMode === 'webcam') {
      startWebcam(selectedDeviceId);
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [uploadMode, selectedDeviceId]);

  // Capture frame from live video feed
  const captureWebcam = async () => {
    if (status === 'uploading' || !videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    // Mirror standard preview on canvas if using front camera (we'll check default front mirroring)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setStatus('error');
          setErrorMsg('Failed to capture frame from webcam.');
          return;
        }
        const file = new File([blob], `camera-webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadFile(file);
      },
      'image/jpeg',
      0.92
    );
  };

  // Handle spacebar click to capture
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (uploadMode === 'webcam' && e.code === 'Space') {
        const activeEl = document.activeElement;
        const isInputField = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');
        if (!isInputField) {
          e.preventDefault();
          captureWebcam();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploadMode, selectedDeviceId, status]);

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center font-sans select-none overflow-hidden">

      {/* Gold top bar */}
      <div className="w-full h-1 bg-gradient-to-r from-gold-900 via-gold-400 to-gold-900 shrink-0" />

      {/* Header */}
      <header className="w-full max-w-sm px-4 pt-6 pb-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-950/60 border border-gold-700/30 text-gold-400 text-[10px] font-bold uppercase tracking-widest mb-3">
          <Zap className="h-3 w-3" /> Live Upload Mode
        </div>
        <h1 className="font-serif text-xl font-bold text-gold-100 leading-tight">
          {eventName}
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Every photo you take streams to guests instantly
        </p>
      </header>

      {/* Counter */}
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/50 border border-emerald-800/40"
        >
          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300">
            {count} photo{count !== 1 ? 's' : ''} uploaded this session
          </span>
        </motion.div>
      )}

      {/* Shutter mode toggle tabs */}
      <div className="flex bg-zinc-900/80 border border-zinc-800/80 rounded-full p-1 max-w-xs w-[90%] mt-5 mb-3 z-10">
        <button
          onClick={() => setUploadMode('native')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-bold transition-all ${
            uploadMode === 'native'
              ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          Native Shutter
        </button>
        <button
          onClick={() => setUploadMode('webcam')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-bold transition-all ${
            uploadMode === 'webcam'
              ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          Webcam Stream
        </button>
      </div>

      {uploadMode === 'native' ? (
        /* ── MAIN SHUTTER BUTTON ────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center w-full px-6 py-6">

          {/* Big shutter circle container */}
          <div
            className="relative flex items-center justify-center rounded-full transition-all duration-200 active:scale-95 cursor-pointer z-10"
            style={{ width: 200, height: 200 }}
          >
            {/* Transparent file input overlaying the entire shutter button */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={status === 'uploading'}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
              aria-label="Take and upload photo"
            />

            {/* Outer pulse ring */}
            {status === 'idle' && (
              <span className="absolute inset-0 rounded-full border-2 border-gold-500/30 animate-ping z-0" />
            )}

            {/* Outer ring */}
            <span className={`absolute inset-0 rounded-full border-4 transition-colors duration-300 z-0 ${
              status === 'uploading' ? 'border-gold-600' :
              status === 'success'  ? 'border-emerald-500' :
              status === 'error'    ? 'border-rose-500' :
              'border-gold-500/50'
            }`} />

            {/* Inner filled circle */}
            <span className={`absolute inset-3 rounded-full transition-colors duration-300 z-0 ${
              status === 'uploading' ? 'bg-gold-700/60' :
              status === 'success'  ? 'bg-emerald-800/60' :
              status === 'error'    ? 'bg-rose-900/60' :
              'bg-zinc-800/80 hover:bg-zinc-700/80'
            }`} />

            {/* Icon inside */}
            <span className="relative z-10 flex flex-col items-center gap-2 pointer-events-none">
              <AnimatePresence mode="wait">
                {status === 'idle' && (
                  <motion.div key="idle" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                    <Camera className="h-16 w-16 text-gold-300" />
                  </motion.div>
                )}
                {status === 'uploading' && (
                  <motion.div key="uploading" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                    <Loader2 className="h-16 w-16 text-gold-400 animate-spin" />
                  </motion.div>
                )}
                {status === 'success' && (
                  <motion.div key="success" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                    <CheckCircle className="h-16 w-16 text-emerald-400" />
                  </motion.div>
                )}
                {status === 'error' && (
                  <motion.div key="error" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                    <AlertCircle className="h-16 w-16 text-rose-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </span>
          </div>

          {/* Status label under button */}
          <div className="mt-6 h-10 flex items-center justify-center text-center">
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.p key="lbl-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                  Tap to Shoot & Upload
                </motion.p>
              )}
              {status === 'uploading' && (
                <motion.p key="lbl-up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm font-bold text-gold-400 uppercase tracking-widest">
                  Uploading to guest stream…
                </motion.p>
              )}
              {status === 'success' && (
                <motion.p key="lbl-ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                  ✓ Live on guest stream!
                </motion.p>
              )}
              {status === 'error' && (
                <motion.div key="lbl-err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-center">
                  <p className="text-sm font-bold text-rose-400 uppercase tracking-widest">Upload Failed</p>
                  <p className="text-[11px] text-rose-600 mt-1 max-w-[220px]">{errorMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* ── WEBCAM STREAM VIEW ─────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-6 py-6 gap-4">
          
          {/* Webcam Selection */}
          {devices.length > 1 && (
            <div className="w-full flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 z-10">
              <label htmlFor="camera-select" className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Camera:</label>
              <select
                id="camera-select"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="flex-1 bg-transparent text-xs text-zinc-300 font-medium focus:outline-none border-none cursor-pointer"
              >
                {devices.map((device, i) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-zinc-950 text-zinc-300">
                    {device.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Webcam Stream Feed Window */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-zinc-800 bg-zinc-950 flex items-center justify-center shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]" // mirror by default
            />

            {/* Upload status overlay */}
            <AnimatePresence>
              {status !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-20 ${
                    status === 'uploading' ? 'bg-zinc-950/60' :
                    status === 'success' ? 'bg-emerald-950/60' :
                    'bg-rose-950/60'
                  }`}
                >
                  {status === 'uploading' && (
                    <>
                      <Loader2 className="h-10 w-10 text-gold-400 animate-spin mb-2" />
                      <p className="text-xs font-bold text-gold-400 uppercase tracking-widest">Uploading Frame…</p>
                    </>
                  )}
                  {status === 'success' && (
                    <>
                      <CheckCircle className="h-10 w-10 text-emerald-400 mb-2" />
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Success!</p>
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      <AlertCircle className="h-10 w-10 text-rose-400 mb-2" />
                      <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">Failed</p>
                      <p className="text-[10px] text-rose-500 mt-1 max-w-[200px] text-center">{errorMsg}</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Capture Trigger Button */}
          <div className="flex flex-col items-center gap-2 mt-2 w-full">
            <button
              onClick={captureWebcam}
              disabled={status === 'uploading'}
              className="w-full py-3.5 bg-gradient-to-r from-gold-600 to-gold-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:from-gold-500 hover:to-gold-400 z-10 flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Capture & Upload
            </button>
            <p className="text-[10px] text-zinc-500 font-medium">
              Tip: Press <kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Spacebar</kbd> to capture instantly!
            </p>
          </div>
        </div>
      )}

      {/* Recent uploads thumbnails strip */}
      <AnimatePresence>
        {recentPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm px-4 pb-8"
          >
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 text-center">
              Recent Uploads
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentPhotos.map((photo, i) => (
                <motion.div
                  key={photo.id || i}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-16 w-16 rounded-xl overflow-hidden shrink-0 border-2 border-zinc-800 bg-zinc-900"
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="pb-6 text-center">
        <p className="text-[10px] text-zinc-700 font-serif">AuraStream · Photographer Upload Mode</p>
      </div>
    </div>
  );
}

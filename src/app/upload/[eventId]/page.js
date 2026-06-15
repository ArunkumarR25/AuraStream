"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, AlertCircle, Loader2, Zap, Image as ImageIcon } from 'lucide-react';
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
  const secret          = resolvedSearch?.secret || '';

  const [eventName,    setEventName]    = useState('Wedding Event');
  const [count,        setCount]        = useState(0);
  const [status,       setStatus]       = useState('idle'); // idle | uploading | success | error
  const [errorMsg,     setErrorMsg]     = useState('');
  const [recentPhotos, setRecentPhotos] = useState([]); // { url, id }
  const [isReady,      setIsReady]      = useState(false);

  const inputRef = useRef(null);

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

  // ─────────────────────────────────────────────────────────────

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

      {/* ── MAIN SHUTTER BUTTON ────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 py-8">

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

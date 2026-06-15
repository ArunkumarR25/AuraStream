"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  FolderOpen, Camera, Wifi, CheckCircle, AlertCircle, Loader2,
  ArrowLeft, Zap, Image as ImageIcon, RefreshCw, StopCircle, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const POLL_INTERVAL_MS = 1500; // check folder every 1.5 seconds
const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff'];
const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.cr2', '.cr3', '.nef', '.arw', '.dng'];

export default function HotFolderPage({ params }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const { eventId } = resolvedParams;

  const [event, setEvent] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [folderHandle, setFolderHandle] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [uploadQueue, setUploadQueue] = useState([]);  // { name, status, url, error }
  const [seenFiles, setSeenFiles] = useState(new Map()); // filename → lastModified+size key
  const [totalUploaded, setTotalUploaded] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [uploadSecret, setUploadSecret] = useState('');

  const pollRef = useRef(null);
  const uploadingRef = useRef(new Set()); // prevent double-uploading same file

  // ── Check browser support ──────────────────────────────────
  useEffect(() => {
    if (!('showDirectoryPicker' in window)) {
      setIsSupported(false);
    }
  }, []);

  // ── Load event metadata ────────────────────────────────────
  useEffect(() => {
    supabase.from('events').select('*').eq('id', eventId).single()
      .then(({ data }) => { if (data) setEvent(data); });

    // Try to load saved upload secret from localStorage
    const saved = localStorage.getItem('aura_upload_secret');
    if (saved) setUploadSecret(saved);
  }, [eventId]);

  // ── Pick folder via File System Access API ─────────────────
  const pickFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      setFolderHandle(handle);
      setFolderName(handle.name);
      setSeenFiles(new Map());
      uploadingRef.current.clear();
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('Could not open folder: ' + err.message);
      }
    }
  };

  // ── Upload a single file via the API route ─────────────────
  const uploadFile = useCallback(async (fileHandle, name) => {
    if (uploadingRef.current.has(name)) return;
    uploadingRef.current.add(name);

    const queueId = `${name}-${Date.now()}`;
    setUploadQueue(prev => [{ id: queueId, name, status: 'uploading' }, ...prev.slice(0, 49)]);

    try {
      const file = await fileHandle.getFile();

      // Build form data and POST to our API endpoint
      const formData = new FormData();
      formData.append('file', file, name);

      const apiUrl = `${window.location.origin}/api/upload/${eventId}${uploadSecret ? `?secret=${uploadSecret}` : ''}`;

      const res = await fetch(apiUrl, { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok || json.errors?.length > 0) {
        throw new Error(json.errors?.[0]?.error || 'Upload failed');
      }

      const publicUrl = json.results?.[0]?.public_url;
      setUploadQueue(prev => prev.map(i => i.id === queueId
        ? { ...i, status: 'success', url: publicUrl }
        : i
      ));
      setTotalUploaded(n => n + 1);
    } catch (err) {
      setUploadQueue(prev => prev.map(i => i.id === queueId
        ? { ...i, status: 'error', error: err.message }
        : i
      ));
      setTotalErrors(n => n + 1);
      // Remove from uploading set so it can be retried
      uploadingRef.current.delete(name);
    }
  }, [eventId, uploadSecret]);

  // ── Poll folder for new image files ───────────────────────
  const pollFolder = useCallback(async () => {
    if (!folderHandle) return;

    try {
      const newSeen = new Map(seenFiles);
      const toUpload = [];

      for await (const [name, handle] of folderHandle.entries()) {
        if (handle.kind !== 'file') continue;

        const ext = '.' + name.split('.').pop().toLowerCase();
        if (!SUPPORTED_EXTS.includes(ext)) continue;

        try {
          const file = await handle.getFile();
          const key = `${file.size}-${file.lastModified}`;
          const prevKey = newSeen.get(name);

          // New file OR file was modified (camera finished writing)
          if (!prevKey || prevKey !== key) {
            newSeen.set(name, key);
            if (!uploadingRef.current.has(name)) {
              toUpload.push({ handle, name });
            }
          }
        } catch {
          // File might be locked/writing — skip this cycle
        }
      }

      setSeenFiles(newSeen);

      // Upload each new file
      for (const { handle, name } of toUpload) {
        uploadFile(handle, name);
      }
    } catch (err) {
      console.error('Folder poll error:', err);
    }
  }, [folderHandle, seenFiles, uploadFile]);

  // ── Start / Stop watching ──────────────────────────────────
  const startWatching = () => {
    if (!folderHandle) return;
    setIsWatching(true);
    // Immediate first poll
    pollFolder();
    pollRef.current = setInterval(pollFolder, POLL_INTERVAL_MS);
  };

  const stopWatching = () => {
    setIsWatching(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Restart poll when pollFolder changes (seenFiles updated)
  useEffect(() => {
    if (!isWatching) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollFolder, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [isWatching, pollFolder]);

  // Cleanup on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const saveSecret = (val) => {
    setUploadSecret(val);
    localStorage.setItem('aura_upload_secret', val);
  };

  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { stopWatching(); router.back(); }}
            className="p-2 rounded-xl hover:bg-slate-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs font-bold text-zinc-100">Live Folder Watcher</p>
            {event && <p className="text-[10px] text-zinc-500">{event.event_name}</p>}
          </div>
        </div>

        {/* Status pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
          isWatching
            ? 'bg-emerald-950/60 border-emerald-700/40 text-emerald-400'
            : 'bg-slate-800 border-slate-700 text-zinc-500'
        }`}>
          {isWatching
            ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />LIVE</>
            : <><span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />IDLE</>
          }
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5">

        {/* Browser support warning */}
        {!isSupported && (
          <div className="bg-rose-950/40 border border-rose-700/40 text-rose-300 rounded-2xl p-4 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Browser not supported</p>
              <p className="text-xs text-rose-400">The File System Access API requires Chrome or Edge on desktop. Please open this page in Chrome to use the folder watcher.</p>
            </div>
          </div>
        )}

        {/* Upload secret config */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Upload Secret</p>
          <input
            type="password"
            placeholder="Paste your UPLOAD_SECRET from .env.local"
            value={uploadSecret}
            onChange={e => saveSecret(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
          <p className="text-[10px] text-zinc-600 mt-1.5">This secret authenticates uploads to the API. Found in your <span className="text-zinc-400 font-mono">.env.local</span> file.</p>
        </div>

        {/* Step 1 – Pick Folder */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gold-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
            <h2 className="font-bold text-zinc-100">Select Camera Hot Folder</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Choose the folder where your camera or SD card saves photos. This works with:
            <span className="block mt-1.5 text-zinc-300">• Canon / Nikon / Sony saving to SD card via card reader</span>
            <span className="block text-zinc-300">• Camera tethering software (Lightroom, Capture One) output folder</span>
            <span className="block text-zinc-300">• Any folder photos are saved to automatically</span>
          </p>
          <button
            onClick={pickFolder}
            disabled={!isSupported}
            className="flex items-center gap-2 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-white font-bold text-sm py-3 px-5 rounded-xl transition-all active:scale-95"
          >
            <FolderOpen className="h-4.5 w-4.5" />
            {folderName ? `📂 ${folderName}` : 'Open Camera Folder'}
          </button>
          {folderName && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Folder selected: <strong>{folderName}</strong>
            </p>
          )}
        </div>

        {/* Step 2 – Start/Stop */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gold-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
            <h2 className="font-bold text-zinc-100">Start Live Watching</h2>
          </div>
          <p className="text-xs text-zinc-400">
            Once watching, every new photo saved to the folder will automatically upload to the guest stream within ~2 seconds.
          </p>
          <div className="flex gap-3">
            <button
              onClick={startWatching}
              disabled={!folderHandle || isWatching}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition-all active:scale-95"
            >
              <Play className="h-4 w-4" /> Start Watching
            </button>
            <button
              onClick={stopWatching}
              disabled={!isWatching}
              className="flex-1 flex items-center justify-center gap-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition-all active:scale-95"
            >
              <StopCircle className="h-4 w-4" /> Stop
            </button>
          </div>

          {isWatching && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 flex items-center gap-3"
            >
              <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
              <div>
                <p className="text-xs font-bold text-emerald-300">Watching for new photos…</p>
                <p className="text-[10px] text-emerald-500">Checks every 1.5 seconds. Shoot — photos upload automatically!</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Stats bar */}
        {(totalUploaded > 0 || totalErrors > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{totalUploaded}</p>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">Uploaded</p>
            </div>
            <div className="bg-rose-950/30 border border-rose-800/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-rose-400">{totalErrors}</p>
              <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-0.5">Errors</p>
            </div>
          </div>
        )}

        {/* Upload Queue */}
        <AnimatePresence>
          {uploadQueue.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-gold-400" />
                  <span className="text-xs font-bold text-zinc-300">Recent Uploads</span>
                </div>
                <span className="text-[10px] text-zinc-500">{uploadQueue.length} files processed</span>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                {uploadQueue.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Thumbnail or status icon */}
                    <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center">
                      {item.url
                        ? <img src={item.url} alt="" className="w-full h-full object-cover" />
                        : item.status === 'uploading'
                          ? <Loader2 className="h-4 w-4 text-gold-400 animate-spin" />
                          : <AlertCircle className="h-4 w-4 text-rose-400" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{item.name}</p>
                      {item.error && <p className="text-[10px] text-rose-400">{item.error}</p>}
                    </div>

                    {item.status === 'uploading' && (
                      <span className="text-[10px] font-bold text-gold-400 whitespace-nowrap">Uploading…</span>
                    )}
                    {item.status === 'success' && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Done
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {uploadQueue.length === 0 && isWatching && (
          <div className="text-center py-12 text-zinc-600">
            <Camera className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-500">Waiting for photos…</p>
            <p className="text-xs text-zinc-600 mt-1">Take a shot with your camera. It will appear here within seconds.</p>
          </div>
        )}
      </main>
    </div>
  );
}

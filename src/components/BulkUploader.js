"use client";

import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  UploadCloud, CheckCircle, AlertCircle, Loader2, FileImage,
  Camera, SwitchCamera, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * BulkUploader
 * – Drag-and-drop area for desktop
 * – "Take Photo" button: opens rear camera directly on mobile (capture="environment")
 * – "Choose from Gallery" button: standard file picker
 * – Per-file upload queue with animated progress bars
 */
export default function BulkUploader({ eventId, onUploadComplete }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // ── Drag handlers ─────────────────────────────────────────
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }, [eventId]);

  // ── Core upload logic ─────────────────────────────────────
  const uploadFile = async (queueId, file) => {
    setUploadQueue(prev =>
      prev.map(i => i.id === queueId ? { ...i, status: 'uploading', progress: 10 } : i)
    );

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const filePath = `events/${eventId}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: storageErr } = await supabase.storage
        .from('wedding-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (storageErr) throw storageErr;

      setUploadQueue(prev =>
        prev.map(i => i.id === queueId ? { ...i, progress: 65 } : i)
      );

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('wedding-photos')
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // 3. Insert DB record
      const { data: dbData, error: dbErr } = await supabase
        .from('event_images')
        .insert({ event_id: eventId, storage_path: filePath, public_url: publicUrl })
        .select()
        .single();
      if (dbErr) throw dbErr;

      setUploadQueue(prev =>
        prev.map(i => i.id === queueId ? { ...i, status: 'success', progress: 100 } : i)
      );
      if (onUploadComplete) onUploadComplete(dbData);

    } catch (err) {
      console.error('Upload failed:', err);
      setUploadQueue(prev =>
        prev.map(i => i.id === queueId ? { ...i, status: 'error', progress: 0, errorMsg: err.message } : i)
      );
    }
  };

  const processFiles = (fileList) => {
    const validFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    const newItems = validFiles.map(file => {
      const queueId = `${file.name}-${Date.now()}-${Math.random()}`;
      // Start upload immediately
      uploadFile(queueId, file);
      return {
        id: queueId,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2),
        preview: URL.createObjectURL(file),
        status: 'uploading',
        progress: 0,
      };
    });
    setUploadQueue(prev => [...newItems, ...prev]);
  };

  const clearCompleted = () =>
    setUploadQueue(prev => prev.filter(i => i.status !== 'success'));

  // ── Status badge ──────────────────────────────────────────
  const StatusBadge = ({ item }) => {
    if (item.status === 'uploading')
      return (
        <span className="text-[10px] font-semibold text-gold-600 flex items-center gap-1 whitespace-nowrap">
          <Loader2 className="h-3 w-3 animate-spin" /> {item.progress}%
        </span>
      );
    if (item.status === 'success')
      return (
        <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
          <CheckCircle className="h-3 w-3" /> Uploaded
        </span>
      );
    if (item.status === 'error')
      return (
        <span title={item.errorMsg} className="text-[10px] font-semibold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-full cursor-help">
          <AlertCircle className="h-3 w-3" /> Failed
        </span>
      );
    return null;
  };

  return (
    <div className="w-full space-y-4">

      {/* ── Mobile Camera Buttons ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* TAKE PHOTO – opens rear camera directly on mobile */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 transition-all shadow-sm active:scale-95"
        >
          <Camera className="h-6 w-6 text-gold-300" />
          <span className="text-xs font-bold tracking-wide">Take Photo</span>
          <span className="text-[10px] text-slate-400">Opens camera</span>
        </button>

        {/* CHOOSE FROM GALLERY */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-sm active:scale-95"
        >
          <FileImage className="h-6 w-6 text-slate-500" />
          <span className="text-xs font-bold tracking-wide">Gallery</span>
          <span className="text-[10px] text-slate-400">Pick images</span>
        </button>
      </div>

      {/* Hidden Inputs */}
      {/* capture="environment" opens the REAR camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = ''; }}
      />

      {/* ── Drag & Drop Zone (desktop) ────────────────────── */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-7 px-4 transition-all duration-200 cursor-pointer text-center
          ${isDragActive
            ? 'border-gold-400 bg-gold-50/30 scale-[1.01]'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white'
          }`}
      >
        {/* Hidden catch-all file input */}
        <input
          type="file"
          multiple
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => { if (e.target.files?.length) processFiles(e.target.files); }}
        />
        <UploadCloud className={`h-9 w-9 mb-2 transition-colors ${isDragActive ? 'text-gold-500' : 'text-slate-300'}`} />
        <p className="text-xs font-semibold text-slate-600">
          Drag & drop photos here
        </p>
        <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, WEBP · Max 10 MB each</p>
      </div>

      {/* ── Upload Queue ──────────────────────────────────── */}
      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-gold-500" />
                <span className="text-xs font-bold text-slate-700">
                  Upload Queue ({uploadQueue.length})
                </span>
              </div>
              {uploadQueue.some(i => i.status === 'success') && (
                <button
                  onClick={clearCompleted}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Clear done
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
              {uploadQueue.map((item) => (
                <div key={item.id} className="p-3 flex items-center gap-3">
                  {/* Thumbnail preview */}
                  <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-100">
                    {item.preview
                      ? <img src={item.preview} alt="" className="w-full h-full object-cover" />
                      : <FileImage className="h-5 w-5 text-slate-400 m-auto mt-2.5" />
                    }
                  </div>

                  {/* Name + progress */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.size} MB</p>
                    {item.status === 'uploading' && (
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <motion.div
                          className="bg-gradient-to-r from-gold-400 to-gold-600 h-1 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    )}
                  </div>

                  <StatusBadge item={item} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

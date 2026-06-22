"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BulkUploader from '@/components/BulkUploader';
import CameraIntegration from '@/components/CameraIntegration';
import {
  Calendar, MapPin, Copy, Check, QrCode, LogOut, Camera,
  Image as ImageIcon, Trash2, ArrowLeft, ExternalLink, Sparkles,
  BarChart3, User, X, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EventWorkspacePage({ params }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const { eventId } = resolvedParams;

  const [user, setUser] = useState(null);
  const [event, setEvent] = useState(null);
  const [eventImages, setEventImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // ── Auth guard + Owner check ──────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/');
        return;
      }
      if (!isMounted) return;
      setUser(session.user);

      try {
        // Fetch event metadata
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (eventError || !eventData) {
          console.error("Event not found or failed to load:", eventError);
          router.replace('/dashboard');
          return;
        }

        // Owner guard: verify event belongs to current photographer
        if (eventData.photographer_id !== session.user.id) {
          console.warn("Access denied: photographer does not own this event.");
          router.replace('/dashboard');
          return;
        }

        if (isMounted) setEvent(eventData);

        // Load event images
        if (isMounted) setLoadingImages(true);
        const { data: imagesData } = await supabase
          .from('event_images')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false });

        if (isMounted && imagesData) setEventImages(imagesData);
      } catch (err) {
        console.error("Workspace loading error:", err);
        router.replace('/dashboard');
      } finally {
        if (isMounted) {
          setLoadingImages(false);
          setLoading(false);
        }
      }
    };

    if (eventId) {
      loadData();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === 'SIGNED_OUT') router.replace('/');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [eventId, router]);

  // ── Delete single photo ───────────────────────────────────
  const handleDeletePhoto = async (img) => {
    if (!confirm('Delete this photo?')) return;
    await supabase.from('event_images').delete().eq('id', img.id);
    // Also remove from storage
    await supabase.storage.from('wedding-photos').remove([img.storage_path]);
    setEventImages(prev => prev.filter(i => i.id !== img.id));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const guestUrl = (evtId) =>
    typeof window !== 'undefined' ? `${window.location.origin}/guest/${evtId}` : `/guest/${evtId}`;

  const handleNewUpload = (newImg) => {
    setEventImages(prev => [newImg, ...prev]);
  };

  // ── FAB quick-capture (opens camera on mobile) ────────────
  const handleFabCapture = (e) => {
    if (e.target.files?.length) {
      Array.from(e.target.files).forEach(file => {
        uploadFromFab(file);
      });
      e.target.value = '';
    }
  };

  const uploadFromFab = async (file) => {
    if (!event) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `events/${event.id}/${Date.now()}-fab.${ext}`;
      await supabase.storage.from('wedding-photos').upload(filePath, file);
      const { data: urlData } = supabase.storage.from('wedding-photos').getPublicUrl(filePath);
      const { data: dbData } = await supabase
        .from('event_images')
        .insert({ event_id: event.id, storage_path: filePath, public_url: urlData.publicUrl })
        .select().single();
      if (dbData) setEventImages(prev => [dbData, ...prev]);
    } catch (err) {
      console.error('FAB upload error:', err);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
      <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading Workspace…</p>
    </div>
  );

  const qrUrl = event
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&color=0f172a&bgcolor=ffffff&data=${encodeURIComponent(guestUrl(event.id))}`
    : '';

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col">

      {/* ── Header ───────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Camera className="h-4 w-4 text-gold-300" />
            </div>
            <div>
              <p className="font-serif text-base font-bold text-slate-800 leading-none">
                {event ? event.event_name : 'Loading event...'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Event Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 py-1.5 px-3 rounded-full border border-slate-200/50">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{user?.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ───────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {event && (
          <div className="space-y-5">
            {/* Event Info Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                  <h1 className="font-serif text-xl font-bold text-slate-800">{event.event_name}</h1>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(event.event_date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {event.venue}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleCopyLink(guestUrl(event.id))}
                    className="flex-1 sm:flex-none text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200/50"
                  >
                    {copiedLink ? (
                      <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">Copied!</span></>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" />Guest Link</>
                    )}
                  </button>
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <QrCode className="h-3.5 w-3.5 text-gold-300" /> QR Code
                  </button>
                </div>
              </div>
            </div>

            {/* Workspace Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Uploaders & Stats */}
              <div className="lg:col-span-4 space-y-4">
                {/* Uploader Box */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                  <h3 className="font-serif text-base font-bold text-slate-800 mb-0.5">Upload Photos</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Select wedding photos from your machine to stream live to all registered guests.
                  </p>
                  <BulkUploader eventId={event.id} onUploadComplete={handleNewUpload} />
                </div>

                {/* Stats Panel */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-3.5">
                  <h3 className="font-serif text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-slate-400" /> Event Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Photos</p>
                      <p className="text-2xl font-bold text-slate-800">{eventImages.length}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
                      <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider mb-1">Status</p>
                      <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1 mt-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Camera Integration */}
                <CameraIntegration
                  eventId={event.id}
                  uploadSecret={process.env.NEXT_PUBLIC_UPLOAD_HINT || 'aura-secret-change-me-2026'}
                />
              </div>

              {/* Right Column: Photos Grid */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <h3 className="font-serif text-base font-bold text-slate-800">
                    Photo Gallery
                    <span className="ml-2 text-xs font-semibold text-slate-400 font-sans">({eventImages.length})</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <Zap className="h-3 w-3" /> Live Sync
                  </div>
                </div>

                <div className="p-4 flex-1">
                  {loadingImages ? (
                    <div className="py-20 flex flex-col items-center text-slate-400 gap-2">
                      <div className="h-6 w-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                      <p className="text-xs font-medium">Loading photos…</p>
                    </div>
                  ) : eventImages.length === 0 ? (
                    <div className="py-20 flex flex-col items-center text-center gap-2 border border-dashed border-slate-200 rounded-xl">
                      <ImageIcon className="h-10 w-10 text-slate-200" />
                      <p className="text-xs font-semibold text-slate-500">No photos yet</p>
                      <p className="text-[10px] text-slate-400 max-w-[180px]">
                        Drag and drop photos, or use the camera integrations to stream.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[550px] overflow-y-auto pr-1">
                      {eventImages.map((img) => (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative aspect-square rounded-xl overflow-hidden group bg-slate-100 border border-slate-100 shadow-sm"
                        >
                          <img
                            src={img.public_url}
                            alt="Wedding photo"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleDeletePhoto(img)}
                              className="bg-white/90 hover:bg-rose-50 text-rose-600 p-2.5 rounded-full shadow-md transition-colors"
                              title="Delete Photo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating camera FAB for photographer's quick mobile upload */}
      <AnimatePresence>
        {event && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-5 z-50 lg:hidden"
          >
            <label
              htmlFor="fab-camera-input"
              className="flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white pl-4 pr-5 py-3.5 rounded-full shadow-2xl cursor-pointer transition-all font-bold text-sm"
              style={{ boxShadow: '0 4px 24px rgba(197,144,47,0.3)' }}
            >
              <Camera className="h-5 w-5 text-gold-300" />
              Shoot & Upload
            </label>
            <input
              id="fab-camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFabCapture}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && event && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-6 border border-slate-200 shadow-2xl text-center relative"
            >
              <button
                onClick={() => setShowQRModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>

              <QrCode className="h-6 w-6 text-slate-700 mx-auto mb-1" />
              <h3 className="font-serif text-lg font-bold text-slate-800 mb-0.5">Guest QR Code</h3>
              <p className="text-xs text-slate-500 mb-5">Guests scan this to view and download photos in real-time</p>

              <div className="w-52 h-52 mx-auto bg-white border-2 border-slate-100 rounded-2xl overflow-hidden p-2">
                <img src={qrUrl} alt="QR Code for guest portal" className="w-full h-full object-contain" />
              </div>

              <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 mt-4 font-mono break-all select-all">
                {guestUrl(event.id)}
              </p>

              <div className="flex gap-3 mt-5">
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Download QR
                </a>
                <button
                  onClick={() => handleCopyLink(guestUrl(event.id))}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Link
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

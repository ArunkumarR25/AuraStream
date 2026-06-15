"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BulkUploader from '@/components/BulkUploader';
import CameraIntegration from '@/components/CameraIntegration';
import {
  Calendar, MapPin, Plus, Copy, Check, QrCode, LogOut, Camera,
  Image as ImageIcon, Trash2, ArrowLeft, ExternalLink, Sparkles,
  BarChart3, User, X, Zap, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Event creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Active event detail
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventImages, setEventImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Floating camera FAB (quick mobile capture)
  const fabCameraRef = useRef(null);

  // ── Auth guard + data load ────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/'); return; }
      if (!isMounted) return;
      setUser(session.user);

      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      if (isMounted && data) setEvents(data);
      if (isMounted) setLoading(false);
    };

    load();

    // Listen for auth changes (e.g. token refresh, sign out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/');
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [router]);

  // ── Load images for selected event ───────────────────────
  useEffect(() => {
    if (!selectedEvent) { setEventImages([]); return; }
    let isMounted = true;
    setLoadingImages(true);

    supabase
      .from('event_images')
      .select('*')
      .eq('event_id', selectedEvent.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (isMounted && data) setEventImages(data);
        if (isMounted) setLoadingImages(false);
      });

    return () => { isMounted = false; };
  }, [selectedEvent]);

  // ── Create event ──────────────────────────────────────────
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          photographer_id: user.id,
          event_name: eventName,
          event_date: eventDate,
          venue,
        })
        .select()
        .single();
      if (error) throw error;
      setEvents(prev => [data, ...prev]);
      setEventName(''); setEventDate(''); setVenue('');
      setShowCreateForm(false);
    } catch (err) {
      alert(err.message || 'Failed to create event');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Delete event ──────────────────────────────────────────
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event and all its photos permanently?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    if (selectedEvent?.id === eventId) setSelectedEvent(null);
  };

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
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const guestUrl = (eventId) =>
    typeof window !== 'undefined' ? `${window.location.origin}/guest/${eventId}` : `/guest/${eventId}`;

  // Callback from BulkUploader when an image finishes uploading
  const handleNewUpload = (newImg) => {
    setEventImages(prev => [newImg, ...prev]);
  };

  // ── FAB quick-capture (opens rear camera on mobile) ───────
  const handleFabCapture = (e) => {
    if (e.target.files?.length) {
      // Trigger the BulkUploader hidden input manually is complex cross-component,
      // so we handle it inline here and re-use the same uploadFile logic
      Array.from(e.target.files).forEach(file => {
        const id = `fab-${Date.now()}-${Math.random()}`;
        // Delegate to BulkUploader by simulating a drop on its gallery ref
        // Instead: directly upload here and push to eventImages
        uploadFromFab(file);
      });
      e.target.value = '';
    }
  };

  const uploadFromFab = async (file) => {
    if (!selectedEvent) return;
    try {
      const ext = file.name.split('.').pop();
      const filePath = `events/${selectedEvent.id}/${Date.now()}-fab.${ext}`;
      await supabase.storage.from('wedding-photos').upload(filePath, file);
      const { data: urlData } = supabase.storage.from('wedding-photos').getPublicUrl(filePath);
      const { data: dbData } = await supabase
        .from('event_images')
        .insert({ event_id: selectedEvent.id, storage_path: filePath, public_url: urlData.publicUrl })
        .select().single();
      if (dbData) setEventImages(prev => [dbData, ...prev]);
    } catch (err) {
      console.error('FAB upload error:', err);
    }
  };

  // ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
      <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading dashboard…</p>
    </div>
  );

  const qrUrl = selectedEvent
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&color=0f172a&bgcolor=ffffff&data=${encodeURIComponent(guestUrl(selectedEvent.id))}`
    : '';

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col">

      {/* ── Header ───────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {selectedEvent && (
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Camera className="h-4 w-4 text-gold-300" />
            </div>
            <div className="hidden sm:block">
              <p className="font-serif text-base font-bold text-slate-800 leading-none">AuraStream</p>
              <p className="text-[10px] text-slate-400 font-medium">
                {selectedEvent ? selectedEvent.event_name : 'Photographer Dashboard'}
              </p>
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

      {/* ── Main ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">

          {/* ── Events List View ─────────────────────────── */}
          {!selectedEvent && (
            <motion.div
              key="events-list"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="font-serif text-xl sm:text-2xl font-bold text-slate-800">My Events</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Manage live wedding photo streams</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> New Event
                </button>
              </div>

              {events.length === 0 ? (
                <div className="py-20 bg-white border border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center px-6">
                  <ImageIcon className="h-12 w-12 text-slate-200 mb-3" />
                  <h3 className="font-serif text-lg font-bold text-slate-600">No events yet</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Create your first wedding event to generate a guest QR code and start the live stream.
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="mt-5 bg-slate-900 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create First Event
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {events.map((evt) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                    >
                      <div className="h-1 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300" />

                      <div className="p-5 flex-1 space-y-3">
                        <div>
                          <h3 className="font-serif text-base font-bold text-slate-800 group-hover:text-gold-700 transition-colors line-clamp-2">
                            {evt.event_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            {new Date(evt.event_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{evt.venue}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => navigator.clipboard.writeText(guestUrl(evt.id))}
                            className="flex-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                          >
                            <Copy className="h-3 w-3" /> Copy Link
                          </button>
                          <a
                            href={guestUrl(evt.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                          >
                            <Eye className="h-3 w-3" /> Preview
                          </a>
                        </div>
                      </div>

                      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                        <button
                          onClick={() => setSelectedEvent(evt)}
                          className="text-xs font-bold text-slate-800 hover:text-gold-600 flex items-center gap-1 transition-colors"
                        >
                          Open Manager <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Event Detail / Workspace ─────────────────── */}
          {selectedEvent && (
            <motion.div
              key="event-detail"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              className="space-y-5"
            >
              {/* Event info bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div>
                    <h1 className="font-serif text-xl font-bold text-slate-800">{selectedEvent.event_name}</h1>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1.5">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(selectedEvent.event_date).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedEvent.venue}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleCopyLink(guestUrl(selectedEvent.id))}
                      className="flex-1 sm:flex-none text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200/50"
                    >
                      {copiedLink
                        ? <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">Copied!</span></>
                        : <><Copy className="h-3.5 w-3.5" />Guest Link</>
                      }
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

              {/* Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Uploader column */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                    <h3 className="font-serif text-base font-bold text-slate-800 mb-0.5">Upload Photos</h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Tap <strong>Take Photo</strong> to shoot directly with your camera — uploads instantly.
                    </p>
                    <BulkUploader eventId={selectedEvent.id} onUploadComplete={handleNewUpload} />
                  </div>

                  {/* Stats */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                    <h3 className="font-serif text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
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

                  {/* Camera Integration panel */}
                  <CameraIntegration
                    eventId={selectedEvent.id}
                    uploadSecret={process.env.NEXT_PUBLIC_UPLOAD_HINT || 'aura-secret-change-me-2026'}
                  />
                </div>

                {/* Photo Grid column */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-serif text-base font-bold text-slate-800">
                      Photo Gallery
                      <span className="ml-2 text-xs font-semibold text-slate-400 font-sans">({eventImages.length})</span>
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <Zap className="h-3 w-3" /> Live Sync
                    </div>
                  </div>

                  <div className="p-4">
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
                          Use the camera button above to shoot and stream instantly.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
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
                                title="Delete"
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Floating Camera FAB (mobile, only when event open) ── */}
      <AnimatePresence>
        {selectedEvent && (
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
            {/* Opens rear camera immediately on mobile */}
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

      {/* ── Create Event Modal ────────────────────────────── */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl relative"
            >
              <button
                onClick={() => setShowCreateForm(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="font-serif text-xl font-bold text-slate-800 mb-1">New Wedding Event</h3>
              <p className="text-xs text-slate-500 mb-5">Fill in the couple's details to set up a live photo stream.</p>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Event Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Emma & James — June 2026"
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-700 focus:bg-white transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={e => setEventDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-700 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Venue</label>
                    <input
                      type="text"
                      required
                      placeholder="The Grand Hall"
                      value={venue}
                      onChange={e => setVenue(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-700 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    {formSubmitting && <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Create Event
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR Code Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showQRModal && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-6 border border-slate-200 shadow-2xl text-center"
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

              <div className="w-52 h-52 mx-auto bg-white border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner p-2">
                <img src={qrUrl} alt="QR Code for guest portal" className="w-full h-full object-contain" />
              </div>

              <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 mt-4 font-mono break-all select-all">
                {guestUrl(selectedEvent.id)}
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
                  onClick={() => handleCopyLink(guestUrl(selectedEvent.id))}
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

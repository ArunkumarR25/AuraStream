"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Calendar, MapPin, Plus, Copy, Check, LogOut, Camera,
  Image as ImageIcon, Trash2, ArrowLeft, User, X, Eye
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
  const [copiedEventId, setCopiedEventId] = useState(null);

  // ── Auth guard + data load ────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/');
        return;
      }
      if (!isMounted) return;
      setUser(session.user);

      // Filter events to only retrieve those owned by this photographer
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('photographer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (isMounted && data) setEvents(data);
      if (isMounted) setLoading(false);
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

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
      setEventName('');
      setEventDate('');
      setVenue('');
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
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleCopyLink = (eventId, url) => {
    navigator.clipboard.writeText(url);
    setCopiedEventId(eventId);
    setTimeout(() => setCopiedEventId(null), 2000);
  };

  const guestUrl = (eventId) =>
    typeof window !== 'undefined' ? `${window.location.origin}/guest/${eventId}` : `/guest/${eventId}`;

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
      <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading dashboard…</p>
    </div>
  );

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col">

      {/* ── Header ───────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Camera className="h-4 w-4 text-gold-300" />
            </div>
            <div>
              <p className="font-serif text-base font-bold text-slate-800 leading-none">AuraStream</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Photographer Dashboard</p>
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
        <div className="space-y-5">
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
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer"
                  onClick={() => router.push(`/dashboard/${evt.id}`)}
                >
                  <div className="h-1 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300" />

                  <div className="p-5 flex-1 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <h3
                        onClick={() => router.push(`/dashboard/${evt.id}`)}
                        className="font-serif text-base font-bold text-slate-800 hover:text-gold-700 transition-colors line-clamp-2 cursor-pointer"
                      >
                        {evt.event_name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {new Date(evt.event_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 font-sans">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{evt.venue}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(evt.id, guestUrl(evt.id));
                        }}
                        className="flex-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        {copiedEventId === evt.id ? (
                          <><Check className="h-3 w-3 text-emerald-600" /> Copied!</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy Link</>
                        )}
                      </button>
                      <a
                        href={guestUrl(evt.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Eye className="h-3 w-3" /> Preview
                      </a>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/dashboard/${evt.id}`)}
                      className="text-xs font-bold text-slate-800 hover:text-gold-600 flex items-center gap-1 transition-colors"
                    >
                      Manage Event <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
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
        </div>
      </main>

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
    </div>
  );
}

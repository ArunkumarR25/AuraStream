"use client";

import React, { useState, useEffect } from 'react';
import { supabase, isMockClient } from '@/lib/supabaseClient';
import SelfieFilter from '@/components/SelfieFilter';
import { 
  Calendar, MapPin, Download, Heart, Sparkles, Image as ImageIcon, 
  ChevronLeft, ChevronRight, X, Play, Share2, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GuestPortal({ params }) {
  // Unwrap dynamic routing parameters (Next.js 15 / React 19 standard)
  const resolvedParams = React.use(params);
  const eventId = resolvedParams.eventId;

  const [event, setEvent] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Selfie mock filter states
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [matchedImageIds, setMatchedImageIds] = useState([]);

  // Lightbox / Zoom view states
  const [activeImageIndex, setActiveImageIndex] = useState(null);

  // Fetch initial event and images
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        // Fetch event metadata
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (eventError) throw eventError;
        setEvent(eventData);

        // Fetch event photos
        const { data: imagesData, error: imagesError } = await supabase
          .from('event_images')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false });

        if (imagesData) {
          setImages(imagesData);
        }
      } catch (err) {
        console.error("Failed to load guest portal data: ", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  // Supabase Real-time listener for postgres changes
  useEffect(() => {
    if (!eventId) return;

    // Set up Realtime Subscription for database inserts & deletes on event_images
    const channel = supabase.channel(`event_images_stream:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_images',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          console.log('Realtime change received:', payload);
          if (payload.eventType === 'INSERT') {
            setImages((prev) => {
              // avoid duplicates in case polling already added it
              if (prev.find(i => i.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setImages((prev) => prev.filter((img) => img.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log(`Realtime channel status: ${status}`);
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
      setRealtimeConnected(false);
    };
  }, [eventId]);

  // ── POLLING FALLBACK ─────────────────────────────────────────
  // Polls every 4 seconds regardless of Realtime status.
  // This ensures photos always appear even if Supabase Realtime
  // is not enabled on the project (the most common setup gap).
  useEffect(() => {
    if (!eventId) return;

    const poll = async () => {
      try {
        const { data } = await supabase
          .from('event_images')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false });

        if (data) {
          setImages(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const newOnes = data.filter(i => !existingIds.has(i.id));
            if (newOnes.length > 0) {
              return [...newOnes, ...prev];
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // Poll immediately on mount (after initial load), then every 4s
    const intervalId = setInterval(poll, 4000);
    return () => clearInterval(intervalId);
  }, [eventId]);

  // When selfie scan completes and toggles filter, select random images to mock matches
  // Handle filter toggle
  const handleFilterToggle = (active) => {
    setIsFilterActive(active);
  };

  // Filter photos array
  const displayedImages = isFilterActive
    ? images.filter(img => matchedImageIds.includes(img.id))
    : images;

  // Handle cross-origin file downloads gracefully
  const downloadImage = async (imgUrl, imgName) => {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = imgName || 'wedding-photo.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Direct blob download failed, falling back to open in tab: ", err);
      window.open(imgUrl, '_blank');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event ? event.event_name : 'Wedding Live Stream',
        text: `Check out live photos from the wedding!`,
        url: window.location.href,
      }).catch(err => console.error(err));
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#070707] text-gold-300 min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mb-3" />
        <p className="font-serif text-sm tracking-widest uppercase text-gold-200/70">Entering Wedding Portal...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#070707] text-zinc-400 min-h-screen p-6 text-center">
        <Heart className="h-12 w-12 text-rose-800 mb-3 animate-pulse" />
        <h3 className="font-serif text-xl font-bold text-gold-200">Event Not Found</h3>
        <p className="text-xs text-zinc-500 mt-2 max-w-xs">
          The wedding stream you are looking for does not exist or has been deleted by the host photographer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0a0a0a] text-zinc-200 font-sans min-h-screen flex flex-col items-center select-none pb-12">
      {/* Dynamic top gold gradient bar */}
      <div className="w-full h-1 bg-gradient-to-r from-gold-900 via-gold-400 to-gold-950 shrink-0" />

      {/* Container restricted to mobile-optimized widths */}
      <div className="w-full max-w-md px-4 flex-1 flex flex-col gap-6 pt-6">
        
        {/* Luxury Hero Banner */}
        <div className="glass-panel rounded-3xl p-6 text-center relative overflow-hidden shadow-2xl shrink-0">
          {/* Subtle glowing gold accent backdrops */}
          <div className="absolute -top-20 -left-20 w-44 h-44 bg-gold-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-gold-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold-950/60 border border-gold-500/20 text-gold-400 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Live Photo Stream
          </div>

          <h1 className="font-serif text-2xl font-bold text-gold-100 tracking-wide leading-tight">
            {event.event_name}
          </h1>

          <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-zinc-400 mt-3 font-serif">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gold-500/80" />
              <span>{new Date(event.event_date).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-gold-500/80" />
              <span>{event.venue}</span>
            </div>
          </div>

          {/* Quick share button */}
          <button 
            onClick={handleShare}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/40 border border-zinc-700/30 text-zinc-400 hover:text-gold-300 transition-colors"
            title="Share Portal"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Selfie Scan UI Widget Container */}
        <div className="w-full shrink-0">
          <SelfieFilter 
            eventId={eventId}
            images={images}
            isFilterActive={isFilterActive} 
            onFilterToggle={handleFilterToggle} 
            onMatchesFound={setMatchedImageIds}
          />
        </div>

        {/* Image Grid Area */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-serif text-base font-semibold text-gold-200 tracking-wide">
              {isFilterActive ? 'Matches For You' : 'Event Stream'} ({displayedImages.length})
            </h3>
            <span className={`text-[10px] flex items-center gap-1.5 py-1 px-2.5 rounded-full border ${
              realtimeConnected
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                : 'text-amber-400 bg-amber-950/60 border-amber-800/40'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              {realtimeConnected ? 'Live Sync' : 'Auto Sync'}
            </span>
          </div>

          {displayedImages.length === 0 ? (
            <div className="flex-1 py-20 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-3xl text-center p-6 flex flex-col items-center justify-center">
              <ImageIcon className="h-10 w-10 text-zinc-700 mb-2" />
              <p className="text-xs font-semibold text-zinc-500">No photos shared yet</p>
              <p className="text-[10px] text-zinc-600 mt-1 max-w-[200px] mx-auto">
                {isFilterActive 
                  ? "We couldn't match your face to any of the uploaded photos. Try clearing the filter."
                  : "Photos will start appearing automatically here as soon as the photographer uploads them."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {displayedImages.map((img, index) => (
                <div 
                  key={img.id} 
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/40 shadow-md flex flex-col justify-end"
                >
                  <img
                    onClick={() => setActiveImageIndex(index)}
                    src={img.public_url}
                    alt="Wedding photo stream"
                    className="absolute inset-0 w-full h-full object-cover cursor-zoom-in active:scale-98 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Gradient shadow overlay for actions */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                  {/* Direct download trigger button */}
                  <button
                    onClick={() => downloadImage(img.public_url, `wedding-${eventId}-${index}.jpg`)}
                    className="absolute bottom-2.5 right-2.5 bg-black/75 hover:bg-gold-600 text-white p-2 rounded-full shadow-md backdrop-blur-sm transition-all active:scale-90"
                    title="Download Photo"
                  >
                    <Download className="h-4 w-4 text-gold-200" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Gallery Overlay Screen */}
      <AnimatePresence>
        {activeImageIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between"
          >
            {/* Lightbox Header */}
            <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-xs text-zinc-400 font-mono">
                {activeImageIndex + 1} of {displayedImages.length}
              </span>
              <button
                onClick={() => setActiveImageIndex(null)}
                className="p-1.5 rounded-full bg-zinc-800/60 text-zinc-300 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Lightbox Media Frame */}
            <div className="flex-1 flex items-center justify-center p-2 relative select-none">
              {/* Previous Image navigation */}
              {activeImageIndex > 0 && (
                <button
                  onClick={() => setActiveImageIndex(prev => prev - 1)}
                  className="absolute left-4 p-3 rounded-full bg-zinc-900/60 text-zinc-300 hover:text-white border border-zinc-800/40 z-10 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              <img
                src={displayedImages[activeImageIndex].public_url}
                alt="Wedding photograph highres"
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />

              {/* Next Image navigation */}
              {activeImageIndex < displayedImages.length - 1 && (
                <button
                  onClick={() => setActiveImageIndex(prev => prev + 1)}
                  className="absolute right-4 p-3 rounded-full bg-zinc-900/60 text-zinc-300 hover:text-white border border-zinc-800/40 z-10 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Lightbox Actions footer */}
            <div className="p-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-3">
              <button
                onClick={() => downloadImage(
                  displayedImages[activeImageIndex].public_url, 
                  `wedding-${eventId}-${activeImageIndex}.jpg`
                )}
                className="gold-button w-full max-w-xs py-3.5 px-6 rounded-full font-semibold text-sm tracking-wider uppercase flex items-center justify-center gap-2"
              >
                <Download className="h-4.5 w-4.5" />
                Download High-Res
              </button>
              <p className="text-[10px] text-zinc-500 font-serif">AuraStream SaaS Luxury Wedding Sharing</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle, Sparkles, Filter, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SelfieFilter({ isFilterActive, onFilterToggle }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [scanState, setScanState] = useState('idle'); // idle | streaming | scanning | completed
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      setScanState('streaming');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not access camera. Please allow camera permissions to try the selfie scanner.");
      setScanState('idle');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureAndScan = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set dimensions to match video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame on canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedPhoto(dataUrl);
      
      // Stop the stream now that we have the frame
      stopCamera();
      
      // Start the mock scan sequence
      runMockScan();
    }
  };

  const runMockScan = () => {
    setScanState('scanning');
    setScanProgress(0);

    const steps = [
      { text: 'Detecting facial structure...', duration: 1000 },
      { text: 'Extracting key landmarks (eyes, nose, jaw)...', duration: 1200 },
      { text: 'Comparing signature with gallery items...', duration: 1400 },
      { text: 'Filtering wedding photo stream...', duration: 800 }
    ];

    let currentStepIndex = 0;
    setScanStep(steps[0].text);

    // Animate scan progress bar
    const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
    const intervalTime = 100;
    let elapsed = 0;

    const progressInterval = setInterval(() => {
      elapsed += intervalTime;
      const pct = Math.min((elapsed / totalDuration) * 100, 98);
      setScanProgress(Math.floor(pct));
    }, intervalTime);

    // Sequence steps
    const runStep = () => {
      if (currentStepIndex < steps.length) {
        setScanStep(steps[currentStepIndex].text);
        setTimeout(() => {
          currentStepIndex++;
          runStep();
        }, steps[currentStepIndex - 1]?.duration || 1000);
      } else {
        clearInterval(progressInterval);
        setScanProgress(100);
        setScanState('completed');
        onFilterToggle(true); // Automatically turn on filter when complete!
      }
    };

    runStep();
  };

  const resetScanner = () => {
    setCapturedPhoto(null);
    setScanState('idle');
    setScanProgress(0);
    setScanStep('');
    if (isOpen) {
      startCamera();
    }
  };

  const handleOpenModal = () => {
    setIsOpen(true);
    startCamera();
  };

  const handleCloseModal = () => {
    stopCamera();
    setIsOpen(false);
    resetScanner();
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Trigger Button */}
      <div className="flex gap-2 w-full justify-center">
        <button
          onClick={handleOpenModal}
          className="flex-1 max-w-sm flex items-center justify-center gap-2 py-3.5 px-6 rounded-full border border-gold-400 bg-black/60 hover:bg-black/80 text-gold-300 font-semibold text-sm tracking-wider uppercase transition-all duration-300 shadow-[0_4px_20px_rgba(197,144,47,0.15)] hover:shadow-[0_4px_25px_rgba(197,144,47,0.3)] hover:-translate-y-0.5"
        >
          <Camera className="h-4.5 w-4.5 text-gold-400" />
          Scan My Face
        </button>

        {/* Quick toggle button if scanning was already done */}
        {isFilterActive && (
          <button
            onClick={() => onFilterToggle(false)}
            className="flex items-center justify-center p-3.5 rounded-full border border-rose-500 bg-rose-950/40 text-rose-300 hover:bg-rose-950/60 transition-colors"
            title="Clear selfie filter"
          >
            <Filter className="h-4.5 w-4.5 shrink-0" />
          </button>
        )}
      </div>

      {/* Filter status indicator badge */}
      {isFilterActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-950/80 border border-gold-500/30 text-gold-300 text-xs font-semibold"
        >
          <Sparkles className="h-3 w-3 text-gold-400 animate-pulse" />
          Showing your matched photos only
          <button onClick={() => onFilterToggle(false)} className="ml-1 text-gold-400 hover:text-gold-200">
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}

      {/* Camera/Scan Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[#121212] border border-gold-500/20 rounded-3xl p-6 shadow-[0_10px_50px_rgba(197,144,47,0.2)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-serif text-lg text-gold-100 font-semibold tracking-wide">AI Photo Finder</h3>
                  <p className="text-xs text-zinc-400">Scan your face to find your photos instantly</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Viewport Frame */}
              <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-full overflow-hidden border-2 border-gold-500/50 shadow-[0_0_30px_rgba(197,144,47,0.1)] bg-zinc-950">
                {scanState === 'streaming' && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    {/* Scanner line animation overlay */}
                    <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-400 to-transparent shadow-[0_0_15px_#d0aa3d] animate-scan" />
                  </>
                )}

                {scanState === 'scanning' && capturedPhoto && (
                  <>
                    <img 
                      src={capturedPhoto} 
                      alt="Captured face" 
                      className="w-full h-full object-cover scale-x-[-1] filter grayscale brightness-75 contrast-125"
                    />
                    {/* Golden digital overlay grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(197,144,47,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(197,144,47,0.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                    {/* Scanner bar */}
                    <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-300 to-transparent shadow-[0_0_15px_#c5902f] animate-scan" />
                  </>
                )}

                {scanState === 'completed' && capturedPhoto && (
                  <div className="relative w-full h-full">
                    <img 
                      src={capturedPhoto} 
                      alt="Captured face" 
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-16 w-16 bg-gold-500 rounded-full flex items-center justify-center text-white shadow-[0_0_35px_rgba(197,144,47,0.6)]"
                      >
                        <CheckCircle className="h-10 w-10" />
                      </motion.div>
                    </div>
                  </div>
                )}

                {scanState === 'idle' && (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
                    <Camera className="h-8 w-8 text-zinc-600 mb-2 animate-pulse" />
                    <p className="text-xs">Preparing camera stream...</p>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Status and Progress bar */}
              <div className="mt-6 text-center">
                {scanState === 'streaming' && (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs text-zinc-400 font-medium">Position your face inside the circle</p>
                    <button
                      onClick={captureAndScan}
                      className="gold-button flex items-center justify-center gap-2 py-3 px-8 rounded-full font-semibold text-sm tracking-wider uppercase"
                    >
                      Capture Photo
                    </button>
                  </div>
                )}

                {scanState === 'scanning' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
                      <span className="font-semibold text-gold-400 animate-pulse">{scanStep}</span>
                      <span className="font-mono text-zinc-300">{scanProgress}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        className="bg-gold-500 h-1.5 rounded-full" 
                        style={{ width: `${scanProgress}%` }}
                        layout
                      />
                    </div>
                  </div>
                )}

                {scanState === 'completed' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gold-200 flex items-center justify-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-gold-400" />
                      Selfie scan completed successfully!
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                      We found matching photos. The guest portal has been filtered to only display photos with your face.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleCloseModal}
                        className="flex-1 max-w-[160px] py-2.5 px-4 bg-gold-600 hover:bg-gold-500 text-white rounded-full font-medium text-xs tracking-wider uppercase transition-colors"
                      >
                        See Photos
                      </button>
                      <button
                        onClick={resetScanner}
                        className="py-2.5 px-3 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-full transition-colors"
                        title="Scan again"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

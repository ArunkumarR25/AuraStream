"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, ExternalLink, Smartphone, Terminal, Zap, Wifi, Video, FolderOpen, Info } from 'lucide-react';

const FTP_HOST = process.env.NEXT_PUBLIC_FTP_HOST || 'not-configured';
const FTP_PORT = process.env.NEXT_PUBLIC_FTP_PORT || '2121';

export default function CameraIntegration({ eventId, uploadSecret }) {
  const router = useRouter();
  const [copied, setCopied] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [activeTab, setActiveTab] = useState('flow-1');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const uploadUrl = baseUrl ? `${baseUrl}/api/upload/${eventId}?secret=${uploadSecret}` : '';
  const mobileUrl = baseUrl ? `${baseUrl}/upload/${eventId}?secret=${uploadSecret}` : '';
  const qrMobile = mobileUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=0f172a&bgcolor=ffffff&data=${encodeURIComponent(mobileUrl)}`
    : '';

  const ftpConfigured = FTP_HOST !== 'not-configured';

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2500);
  };

  const CopyBtn = ({ text, id }) => (
    <button
      onClick={() => copy(text, id)}
      className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
    >
      {copied === id
        ? <><Check className="h-3 w-3 text-emerald-600" /><span className="text-emerald-700">Copied</span></>
        : <><Copy className="h-3 w-3" />Copy</>}
    </button>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Zap className="h-4.5 w-4.5 text-gold-500" />
          <div>
            <h3 className="font-serif text-base font-bold text-slate-800">Choose Camera Flow</h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Select how you want to shoot and stream</p>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/20">
        {[
          { id: 'flow-1', label: '1. Phone Shutter', icon: Smartphone },
          { id: 'flow-2', label: '2. Laptop Webcam', icon: Video },
          { id: 'flow-3', label: '3. Hot Folder', icon: FolderOpen },
          { id: 'flow-4', label: '4. DSLR WiFi (FTP)', icon: Wifi },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-3 px-2 border-b-2 text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'border-gold-500 text-gold-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="p-5">

        {/* ── FLOW 1: PHONE SHUTTER ─────────────────── */}
        {activeTab === 'flow-1' && (
          <div className="space-y-4">
            <div>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                Zero Configuration · Free
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-2">Mobile Phone Shutter Mode</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Scan standard QR using your phone camera. Tap the gold shutter button to capture and stream instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-white p-1">
                <img src={qrMobile} alt="Mobile upload QR" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 space-y-2 w-full min-w-0">
                <p className="text-xs text-slate-600">
                  Scan this QR or copy the link to open it on your phone:
                </p>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <code className="flex-1 text-[9px] font-mono text-slate-600 truncate">{mobileUrl}</code>
                  <CopyBtn text={mobileUrl} id="mobile-url" />
                </div>
                <a
                  href={mobileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-gold-600 hover:text-gold-700"
                >
                  Open in browser <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-700 mb-1">How to run:</p>
              <p className="flex gap-2"><span>1.</span> Scan QR code with iPhone or Android phone.</p>
              <p className="flex gap-2"><span>2.</span> A dark camera page will open.</p>
              <p className="flex gap-2"><span>3.</span> Tap the big gold button. Your native camera will open.</p>
              <p className="flex gap-2"><span>4.</span> Take a photo and click OK. It uploads instantly!</p>
            </div>
          </div>
        )}

        {/* ── FLOW 2: LAPTOP WEBCAM ─────────────────── */}
        {activeTab === 'flow-2' && (
          <div className="space-y-4">
            <div>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                Zero Configuration · Free
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-2">Webcam / USB Camera Live Capture</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect external USB cameras or low-resolution capture devices to your laptop. Stream live and snap pictures directly inside your browser.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-600">
                You can access this on any laptop or computer. Click the button below to launch the camera capture stream page.
              </p>
              <a
                href={mobileUrl ? `${mobileUrl}&mode=webcam` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto self-start bg-slate-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Video className="h-3.5 w-3.5 text-gold-300" /> Launch Laptop Webcam Page
              </a>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-700 mb-1">How to use:</p>
              <p className="flex gap-2"><span>1.</span> Open the link above on your laptop.</p>
              <p className="flex gap-2"><span>2.</span> Toggle to <strong>Webcam Stream</strong> tab.</p>
              <p className="flex gap-2"><span>3.</span> Choose your camera from the dropdown menu.</p>
              <p className="flex gap-2"><span>4.</span> Click "Capture & Upload" or press the <kbd className="bg-zinc-200 px-1 py-0.5 rounded font-mono text-[10px]">Spacebar</kbd> on your keyboard to instantly capture and upload!</p>
            </div>
          </div>
        )}

        {/* ── FLOW 3: HOT FOLDER ─────────────────── */}
        {activeTab === 'flow-3' && (
          <div className="space-y-4">
            <div>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                No Terminals Required · Free
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-2">Web-based Local Hot Folder Watcher</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Watch a folder on your computer directly from the browser! If you have camera tethering software (like Lightroom, Capture One, or Sony Imaging Edge) saving images to a laptop folder, the webpage will automatically detect and upload them instantly.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-600">
                Uses standard secure Chrome/Edge Folder Access APIs. Absolutely no commands to run in terminals!
              </p>
              <button
                onClick={() => router.push(`/dashboard/hotfolder/${eventId}`)}
                className="w-full sm:w-auto self-start bg-slate-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <FolderOpen className="h-3.5 w-3.5 text-gold-300" /> Go to Web Hot Folder Watcher
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-700 mb-1">How it works:</p>
              <p className="flex gap-2"><span>1.</span> Connect DSLR/Mirrorless camera to your laptop (via cable, tethering software, or SD card reader).</p>
              <p className="flex gap-2"><span>2.</span> Set up your tethering app to store photos in a specific laptop directory (e.g. `C:/camera_photos`).</p>
              <p className="flex gap-2"><span>3.</span> Open the Hot Folder Watcher page on this laptop, click "Open Camera Folder", and select that directory.</p>
              <p className="flex gap-2"><span>4.</span> Click "Start Watching". Every photo you take will automatically stream live to your guests!</p>
            </div>
          </div>
        )}

        {/* ── FLOW 4: DSLR WIFI FTP ─────────────────── */}
        {activeTab === 'flow-4' && (
          <div className="space-y-4">
            <div>
              <span className="bg-gold-50 text-gold-800 border border-gold-200 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                WiFi DSLR Tethering · Free
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-2">Local FTP Server Gateway</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect your professional camera (Canon, Nikon, Sony, etc.) directly using WiFi. Your camera transfers photos via WiFi to a local FTP gateway running on your laptop, which sends them to Supabase.
              </p>
            </div>

            {/* Port info alert */}
            <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3.5 text-xs flex gap-2.5">
              <Info className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-900">Rendu Port confusion details (No Credit Cards):</p>
                <p className="text-blue-800 mt-1 leading-relaxed">
                  Next.js website runs on standard web ports (port 3000 local or Vercel free cloud). 
                  The local FTP gateway runs only on your laptop on <strong>port 2121</strong>.
                  You do NOT need to deploy the FTP server on any credit-card cloud servers like fly.io! 
                  Simply run it locally on your laptop network for 100% free.
                </p>
              </div>
            </div>

            {/* Connection settings */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">Local Connection Credentials:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Local Host / Network IP</p>
                  <code className="text-xs text-slate-800 font-bold block mt-1">Check terminal output when running</code>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Port (local)</p>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-xs text-slate-800 font-bold">{FTP_PORT}</code>
                    <CopyBtn text={FTP_PORT} id="ftp-port" />
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Username</p>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-xs text-slate-800 font-bold">event_{eventId}</code>
                    <CopyBtn text={`event_${eventId}`} id="ftp-username" />
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Password</p>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-xs text-slate-800 font-bold truncate max-w-[150px]">{uploadSecret}</code>
                    <CopyBtn text={uploadSecret} id="ftp-password" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-700 mb-1">How to run locally:</p>
              <p className="flex gap-2"><span>1.</span> Open your laptop command terminal inside the project directory.</p>
              <p className="flex gap-2"><span>2.</span> Run: <code className="bg-zinc-200 px-1 py-0.5 rounded font-mono text-[10px]">npm run ftp</code> (Starts FTP server on port 2121).</p>
              <p className="flex gap-2"><span>3.</span> Connect your DSLR to the same WiFi network (e.g. your phone hotspot).</p>
              <p className="flex gap-2"><span>4.</span> In camera FTP settings, enter your laptop IP, port 2121, username, and password.</p>
              <p className="flex gap-2"><span>5.</span> Take photos on DSLR — they transfer to laptop WiFi and upload instantly!</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

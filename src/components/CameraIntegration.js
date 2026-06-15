"use client";

import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Smartphone, Terminal, Zap } from 'lucide-react';

export default function CameraIntegration({ eventId, uploadSecret }) {
  const [copied,  setCopied]  = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // Only read window.location on the client to avoid SSR hydration mismatch
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const uploadUrl = baseUrl ? `${baseUrl}/api/upload/${eventId}?secret=${uploadSecret}` : '';
  const mobileUrl = baseUrl ? `${baseUrl}/upload/${eventId}?secret=${uploadSecret}`     : '';
  const qrMobile  = mobileUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=0f172a&bgcolor=ffffff&data=${encodeURIComponent(mobileUrl)}`
    : '';

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
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-gold-500" />
          <h3 className="font-serif text-base font-bold text-slate-800">Camera Integration</h3>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Auto-upload active
        </span>
      </div>

      <div className="p-5 space-y-6">

        {/* ── SECTION 1: Mobile / Phone ─────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-slate-500" /> Mobile / Phone Camera
              </h4>
              <p className="text-[10px] text-slate-500">Scan QR → tap shutter → uploads instantly</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex gap-4 items-start">
            <div className="shrink-0 w-28 h-28 rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50 p-1">
              <img src={qrMobile} alt="Mobile upload QR" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Scan the QR code with your <strong>iPhone or Android</strong>. A fullscreen shutter opens — tap to shoot and upload continuously.
              </p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <code className="flex-1 text-[9px] font-mono text-slate-600 truncate">{mobileUrl}</code>
                <CopyBtn text={mobileUrl} id="mobile-url" />
              </div>
              <a
                href={mobileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-gold-600 hover:text-gold-700"
              >
                <ExternalLink className="h-3 w-3" /> Open upload page
              </a>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-700 mb-1">How to use on phone:</p>
            {['Scan the QR code with your phone camera', 'The page opens a full-screen dark shutter view', 'Tap the big gold button → rear camera opens', 'Shoot → photo uploads and appears on guest stream', 'Tap again to shoot the next photo continuously'].map((s, i) => (
              <p key={i} className="flex items-start gap-2"><span className="text-gold-500 font-bold">{i + 1}.</span>{s}</p>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* ── SECTION 2: External Camera / FTP Connection ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-slate-500" /> External Camera (DSLR / Mirrorless)
              </h4>
              <p className="text-[10px] text-slate-500">Connect camera directly using FTP</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-[11px] leading-relaxed">
              <p className="font-bold text-emerald-900 mb-1">⭐ Zero-Code Photographer Flow</p>
              No coding required! Your camera can connect directly to our built-in FTP server. Every photo you take will stream instantly to the website.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Server / Host</p>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <code className="text-[11px] font-mono text-slate-800 font-bold truncate">
                    {baseUrl ? baseUrl.replace(/^https?:\/\//, '').split(':')[0] : 'localhost'}
                  </code>
                  <CopyBtn text={baseUrl ? baseUrl.replace(/^https?:\/\//, '').split(':')[0] : 'localhost'} id="ftp-host" />
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Port</p>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <code className="text-[11px] font-mono text-slate-800 font-bold">2121</code>
                  <CopyBtn text="2121" id="ftp-port" />
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Username</p>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <code className="text-[11px] font-mono text-slate-800 font-bold truncate">event_{eventId}</code>
                  <CopyBtn text={`event_${eventId}`} id="ftp-user" />
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase">FTP Password</p>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <code className="text-[11px] font-mono text-slate-800 font-bold truncate">{uploadSecret}</code>
                  <CopyBtn text={uploadSecret} id="ftp-pass" />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[11px] text-blue-800 space-y-1">
              <p className="font-bold text-blue-900 mb-1.5">How to configure on your Camera:</p>
              {[
                'Connect your camera to Wi-Fi (e.g., your phone hotspot or event Wi-Fi).',
                'Go to your Camera settings → Network / FTP Transfer Settings.',
                'Add a new FTP connection server with the Host, Port, Username, and Password shown above.',
                'Select FTP protocol (Plain FTP / no encryption) and Passive Mode.',
                'Start the gateway server on the host: run "npm run ftp" in the project terminal.',
                'Take a picture! The camera will upload it directly over FTP, and it will immediately show on the guest stream!',
              ].map((s, i) => (
                <p key={i} className="flex items-start gap-2"><span className="text-blue-500 font-bold">{i + 1}.</span>{s}</p>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 my-4" />

          {/* API and curl fallback */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">API Upload Endpoint</p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <code className="flex-1 text-[9px] font-mono text-slate-600 break-all">{uploadUrl}</code>
                <CopyBtn text={uploadUrl} id="api-url" />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Test with cURL</p>
              <div className="relative bg-slate-950 text-emerald-300 rounded-xl p-3 text-[10px] font-mono border border-slate-800">
                <pre>{`curl -X POST "${uploadUrl}" \\
  -F "file=@/path/to/photo.jpg"`}</pre>
                <CopyBtn text={`curl -X POST "${uploadUrl}" \\\n  -F "file=@/path/to/photo.jpg"`} id="curl" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

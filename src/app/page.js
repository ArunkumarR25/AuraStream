"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Camera, Mail, Lock, ArrowRight, Loader2, Sparkles, Eye, EyeOff,
  CheckCircle, AlertTriangle, Heart, User, KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VIEWS = { LOGIN: 'login', SIGNUP: 'signup', RESET: 'reset', CHECK_EMAIL: 'check_email' };

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState(VIEWS.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace('/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const clearMessages = () => { setError(''); setInfo(''); };

  // ── Sign Up ──────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;

      // If Supabase returns a session immediately (email confirm disabled), go to dashboard
      if (data.session) {
        router.replace('/dashboard');
      } else {
        setView(VIEWS.CHECK_EMAIL);
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Sign In ───────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/dashboard');
    } catch (err) {
      // Friendly messages for common Supabase errors
      if (err.message?.toLowerCase().includes('invalid login')) {
        setError('Incorrect email or password. Please try again.');
      } else if (err.message?.toLowerCase().includes('email not confirmed')) {
        setError('Please verify your email first. Check your inbox for a confirmation link.');
      } else {
        setError(err.message || 'Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password Reset ────────────────────────────────────────
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dashboard`,
      });
      if (error) throw error;
      setInfo('Password reset link sent! Check your inbox.');
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-br from-slate-50 via-white to-stone-100 font-sans flex flex-col">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-gold-400 via-gold-600 to-gold-400" />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* ── Left Brand Panel ─────────────────────────────── */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white flex-col justify-between p-14 relative overflow-hidden">
          {/* Glow orbs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-gold-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gold-800/10 rounded-full blur-3xl" />

          <div>
            <div className="flex items-center gap-2 mb-16">
              <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                <Camera className="h-5 w-5 text-gold-300" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight">AuraStream</span>
            </div>

            <h2 className="font-serif text-4xl font-bold leading-[1.15] mb-6 text-white">
              Your wedding moments,<br />
              <span className="text-gold-gradient">shared instantly.</span>
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
              Capture from your camera, upload instantly, and let guests watch your artistry unfold live — on any device.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="space-y-4">
            {[
              { icon: Camera, text: 'One-tap mobile camera upload' },
              { icon: Sparkles, text: 'Real-time guest photo stream' },
              { icon: Heart, text: 'AI selfie face-match filter' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                <div className="h-8 w-8 bg-gold-900/40 border border-gold-700/30 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-gold-400" />
                </div>
                {text}
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-600 mt-8">© 2026 AuraStream SaaS. All rights reserved.</p>
        </div>

        {/* ── Right Auth Panel ──────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 py-12">
          <div className="w-full max-w-md">

            {/* Logo (mobile only) */}
            <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
              <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <Camera className="h-5 w-5 text-gold-300" />
              </div>
              <span className="font-serif text-xl font-bold text-slate-800">AuraStream</span>
            </div>

            <AnimatePresence mode="wait">

              {/* ── EMAIL CONFIRMED SCREEN ─────────────────── */}
              {view === VIEWS.CHECK_EMAIL && (
                <motion.div
                  key="check_email"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-200">
                    <Mail className="h-9 w-9 text-emerald-600" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-800 mb-2">Check your inbox</h2>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                    We sent a confirmation link to <strong className="text-slate-700">{email}</strong>.
                    Click it to activate your account and start streaming.
                  </p>
                  <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 text-left">
                    <strong>Tip:</strong> If you don't see it, check your spam folder. The link expires in 24 hours.
                  </div>
                  <button
                    onClick={() => setView(VIEWS.LOGIN)}
                    className="mt-6 text-sm text-slate-600 hover:text-slate-900 underline"
                  >
                    Back to sign in
                  </button>
                </motion.div>
              )}

              {/* ── PASSWORD RESET SCREEN ─────────────────── */}
              {view === VIEWS.RESET && (
                <motion.div
                  key="reset"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  <button onClick={() => setView(VIEWS.LOGIN)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6">
                    ← Back to sign in
                  </button>
                  <h2 className="font-serif text-2xl font-bold text-slate-800 mb-1">Reset password</h2>
                  <p className="text-sm text-slate-500 mb-6">Enter your email and we'll send a reset link.</p>

                  {error && <AlertBox type="error" message={error} />}
                  {info && <AlertBox type="success" message={info} />}

                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <InputField icon={Mail} type="email" placeholder="photographer@studio.com" label="Email" value={email} onChange={setEmail} required />
                    <button type="submit" disabled={loading} className="w-full btn-primary">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send Reset Link'}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ── LOGIN SCREEN ───────────────────────────── */}
              {view === VIEWS.LOGIN && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  <h2 className="font-serif text-3xl font-bold text-slate-800 mb-1">Photographer Sign In</h2>
                  <p className="text-sm text-slate-500 mb-7">Welcome back. Access your wedding event dashboard.</p>

                  {error && <AlertBox type="error" message={error} />}
                  {info && <AlertBox type="success" message={info} />}

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <InputField icon={Mail} type="email" placeholder="photographer@studio.com" label="Email address" value={email} onChange={setEmail} required />
                    <InputField
                      icon={Lock} type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••" label="Password" value={password} onChange={setPassword} required
                      suffix={
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="text-slate-400 hover:text-slate-600">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setView(VIEWS.RESET)} className="text-xs text-gold-600 hover:text-gold-700 font-semibold">
                        Forgot password?
                      </button>
                    </div>
                    <button type="submit" disabled={loading} className="w-full btn-primary">
                      {loading
                        ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        : <span className="flex items-center justify-center gap-2">Sign In <ArrowRight className="h-4 w-4" /></span>
                      }
                    </button>
                  </form>

                  <p className="text-center text-sm text-slate-500 mt-6">
                    New to AuraStream?{' '}
                    <button onClick={() => { setView(VIEWS.SIGNUP); clearMessages(); }} className="text-gold-600 font-bold hover:text-gold-700">
                      Create a free account
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── SIGN UP SCREEN ─────────────────────────── */}
              {view === VIEWS.SIGNUP && (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  <h2 className="font-serif text-3xl font-bold text-slate-800 mb-1">Create Photographer Account</h2>
                  <p className="text-sm text-slate-500 mb-7">Set up your studio and start streaming in minutes.</p>

                  {error && <AlertBox type="error" message={error} />}

                  <form onSubmit={handleSignUp} className="space-y-4">
                    <InputField icon={User} type="text" placeholder="John Smith Photography" label="Full Name / Studio" value={fullName} onChange={setFullName} required />
                    <InputField icon={Mail} type="email" placeholder="photographer@studio.com" label="Email address" value={email} onChange={setEmail} required />
                    <InputField
                      icon={Lock} type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 6 characters" label="Password" value={password} onChange={setPassword} required
                      suffix={
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="text-slate-400 hover:text-slate-600">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />

                    {/* Password strength indicator */}
                    <PasswordStrength password={password} />

                    <button type="submit" disabled={loading} className="w-full btn-primary">
                      {loading
                        ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        : <span className="flex items-center justify-center gap-2">Create Account <ArrowRight className="h-4 w-4" /></span>
                      }
                    </button>

                    <p className="text-[11px] text-center text-slate-400">
                      By signing up you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </form>

                  <p className="text-center text-sm text-slate-500 mt-6">
                    Already have an account?{' '}
                    <button onClick={() => { setView(VIEWS.LOGIN); clearMessages(); }} className="text-gold-600 font-bold hover:text-gold-700">
                      Sign in
                    </button>
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared Sub-Components ─────────────────────────────────────

function InputField({ icon: Icon, type, placeholder, label, value, onChange, required, suffix }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative flex items-center">
        <Icon className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type={type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-slate-700 focus:bg-white transition-all placeholder:text-slate-400"
        />
        {suffix && <div className="absolute right-3.5">{suffix}</div>}
      </div>
    </div>
  );
}

function AlertBox({ type, message }) {
  const styles = type === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  const Icon = type === 'error' ? AlertTriangle : CheckCircle;
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium mb-4 ${styles}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-600'];
  const textColors = ['text-rose-600', 'text-orange-500', 'text-amber-600', 'text-emerald-600', 'text-emerald-700'];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-[11px] font-semibold ${textColors[score]}`}>{labels[score]}</p>
    </div>
  );
}

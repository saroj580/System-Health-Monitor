// views/ActivationView.tsx
// Full-screen license activation gate supporting:

import React, { useState, useId } from 'react';

interface ActivationViewProps {
  error: string | null;
  isLoading: boolean;
  onActivate: (token: string) => Promise<void>;
  trialAvailable?: boolean;
  onStartTrial: (name: string, email: string) => Promise<void>;
  isStartingTrial: boolean;
  trialError: string | null;
}

export const ActivationView: React.FC<ActivationViewProps> = ({
  error,
  isLoading,
  onActivate,
  trialAvailable = true,
  onStartTrial,
  isStartingTrial,
  trialError,
}) => {
  const [token, setToken] = useState('');
  const [trialName, setTrialName] = useState('');
  const [trialEmail, setTrialEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'trial' | 'key'>(trialAvailable ? 'trial' : 'key');

  const tokenInputId = useId();
  const nameInputId = useId();
  const emailInputId = useId();

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) onActivate(token);
  };

  const handleTrialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trialEmail.trim()) {
      onStartTrial(trialName.trim() || 'Trial User', trialEmail.trim());
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">

      {/* Subtle cyan background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.015) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-[0.07] blur-[130px] bg-cpu pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 rounded-full opacity-[0.05] blur-[90px] bg-ram pointer-events-none" />

      {/* Card */}
      <div className="relative glass w-full max-w-lg px-8 py-9 animate-fade-in shadow-[0_16px_48px_rgba(0,0,0,0.5)]">

        {/* Logo + Header */}
        <div className="flex flex-col items-center gap-3.5 mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-cpu/[.08] border border-cpu/25 shadow-[0_0_24px_rgba(0,212,255,0.12)]">
            <svg viewBox="0 0 24 24" fill="none" width="30" height="30">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="#00d4ff" strokeWidth="1.5" />
              <path d="M8 21h8M12 17v4" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 10.5C7 9.1 8.1 8 9.5 8S12 9.1 12 10.5 10.9 13 9.5 13 7 11.9 7 10.5z" fill="#00d4ff" opacity=".7" />
              <path d="M13 10h4M13 12h3" stroke="#00d4ff" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">System Monitor &amp; Task Automator</h1>
            <p className="text-[0.74rem] text-slate-400 mt-0.5">Choose an option below to unlock your application</p>
          </div>
        </div>

        {/* Tabs: Model 2 (Trial) vs Model 1 (License Key) */}
        <div className="flex p-1 bg-black/40 border border-white/[.08] rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('trial')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[0.76rem] font-semibold rounded-md transition-all duration-[180ms] ${activeTab === 'trial'
              ? 'bg-cpu/[.15] text-cpu border border-cpu/30 shadow-[0_0_12px_rgba(0,212,255,0.12)]'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <span>⚡ 7-Day Free Trial</span>
            {trialAvailable ? (
              <span className="px-1.5 py-0.2 rounded text-[0.62rem] bg-emerald-500/20 text-emerald-400 font-bold">FREE</span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[0.62rem] bg-slate-700 text-slate-400">USED</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('key')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[0.76rem] font-semibold rounded-md transition-all duration-[180ms] ${activeTab === 'key'
              ? 'bg-white/[.12] text-slate-100 border border-white/20'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <span>🔑 Enter License Key</span>
          </button>
        </div>

        {/*  TAB 1: MODEL 2 — 7-DAY FREE TRIAL  */}
        {activeTab === 'trial' && (
          <div className="animate-fade-in flex flex-col gap-4">
            {trialAvailable ? (
              <>
                <div className="p-3.5 rounded-lg bg-cpu/[.05] border border-cpu/15 text-[0.77rem] text-slate-300 leading-relaxed">
                  <div className="font-semibold text-cpu flex items-center gap-1.5 mb-1">
                    <span>✨ Instant Access</span>
                  </div>
                  Try all features for 7 days without requiring a license key. Telemetry and all automation tasks will unlock immediately.
                </div>

                <form onSubmit={handleTrialSubmit} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={nameInputId} className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                      Your Name
                    </label>
                    <input
                      id={nameInputId}
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={trialName}
                      onChange={(e) => setTrialName(e.target.value)}
                      disabled={isStartingTrial}
                      className="w-full bg-white/[.03] border border-white/[.10] rounded-[8px] px-3 py-2 text-[0.8rem] text-slate-100 placeholder-slate-600 outline-none focus:border-cpu/40 focus:bg-white/[.05] transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={emailInputId} className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                      Your Email Address <span className="text-cpu">*</span>
                    </label>
                    <input
                      id={emailInputId}
                      type="email"
                      required
                      placeholder="e.g. jane@example.com"
                      value={trialEmail}
                      onChange={(e) => setTrialEmail(e.target.value)}
                      disabled={isStartingTrial}
                      className="w-full bg-white/[.03] border border-white/[.10] rounded-[8px] px-3 py-2 text-[0.8rem] text-slate-100 placeholder-slate-600 outline-none focus:border-cpu/40 focus:bg-white/[.05] transition-all"
                    />
                  </div>

                  {trialError && (
                    <div className="flex items-center gap-2 text-[0.74rem] text-rose-400 bg-rose-500/[.10] border border-rose-500/25 rounded-md px-3 py-2">
                      <span>⚠ {trialError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isStartingTrial || !trialEmail.trim()}
                    className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-[8px] font-semibold text-[0.82rem] transition-all bg-gradient-to-r from-cpu/25 to-cpu/15 border border-cpu/40 text-cpu hover:from-cpu/35 hover:to-cpu/25 hover:border-cpu/60 hover:shadow-[0_0_20px_rgba(0,212,255,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isStartingTrial ? (
                      <>
                        <svg className="w-4 h-4 animate-spin-ring" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="20" />
                        </svg>
                        <span>Starting Trial…</span>
                      </>
                    ) : (
                      <>
                        <span>Start 7-Day Free Trial →</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="p-4 rounded-lg bg-amber-500/[.08] border border-amber-500/20 text-center">
                <p className="text-amber-400 font-semibold text-[0.8rem] mb-1">
                  Free Trial Already Completed
                </p>
                <p className="text-slate-400 text-[0.74rem] leading-relaxed mb-3">
                  The 7-day evaluation period has already been used on this computer. Please enter a valid license key to continue.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('key')}
                  className="px-4 py-1.5 text-[0.75rem] font-semibold rounded bg-white/[.08] hover:bg-white/[.15] text-slate-200 border border-white/15 transition-all"
                >
                  Switch to License Key
                </button>
              </div>
            )}
          </div>
        )}

        {/*  TAB 2: MODEL 1 — RSA LICENSE KEY  */}
        {activeTab === 'key' && (
          <form onSubmit={handleKeySubmit} className="animate-fade-in flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor={tokenInputId} className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                  Customer License Key
                </label>
                <span className="text-[0.67rem] text-slate-500">RSA Cryptographic Token</span>
              </div>
              <textarea
                id={tokenInputId}
                rows={4}
                className={`w-full bg-white/[.03] border rounded-[8px] px-3.5 py-2.5 font-mono text-[0.72rem] text-slate-200 placeholder-slate-600 resize-none outline-none transition-all duration-[180ms] focus:bg-white/[.05]
                  ${error
                    ? 'border-rose-500/40 focus:border-rose-500/60 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
                    : 'border-white/[.10] focus:border-cpu/40 focus:shadow-[0_0_0_3px_rgba(0,212,255,0.10)]'
                  }`}
                placeholder="Paste the JWT license key provided by your developer…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isLoading}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-[0.74rem] text-rose-400 bg-rose-500/[.08] border border-rose-500/20 rounded-md px-3 py-2 animate-fade-in">
                <span>⚠ {error}</span>
              </div>
            )}

            <button
              id="activate-license-btn"
              type="submit"
              disabled={isLoading || !token.trim()}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-[8px] font-semibold text-[0.82rem] transition-all bg-cpu/[.12] border border-cpu/30 text-cpu hover:bg-cpu/20 hover:border-cpu/60 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin-ring" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="20" />
                  </svg>
                  <span>Verifying RSA Signature…</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Activate Commercial License</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security / offline guarantee */}
        <p className="text-center text-[0.67rem] text-slate-500 mt-6 leading-relaxed">
          🔐 100% Offline Verification — Keys are cryptographically verified locally.
        </p>
      </div>

      {/* Footer */}
      <p className="relative mt-5 text-[0.68rem] text-slate-600">
        System Monitor &amp; Task Automator · v1.0.0-PreAlpha
      </p>
    </div>
  );
};

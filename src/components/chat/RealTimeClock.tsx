import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Globe, Sparkles, Check, Copy, ChevronDown, Radio } from 'lucide-react';

interface RealTimeClockProps {
  variant?: 'header' | 'banner';
  onAskDate?: (query?: string) => void;
  className?: string;
}

export const RealTimeClock: React.FC<RealTimeClockProps> = ({
  variant = 'header',
  onAskDate,
  className = '',
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Update every second for a fluid real-time clock
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

  // Capitalize first letter helper
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  // Formatted date values in French
  const dayName = capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(now)
  );
  const fullDateStr = capitalize(
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
  );
  const shortDateStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeWithSeconds = `${hours}:${minutes}:${seconds}`;

  const handleCopyDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${fullDateStr} — ${timeWithSeconds} (${timeZone})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onAskDate) {
      onAskDate('Quel jour sommes-nous aujourd\'hui ?');
    }
  };

  if (variant === 'banner') {
    return (
      <div
        className={`w-full max-w-lg mx-auto rounded-2xl p-4 border transition-all shadow-lg backdrop-blur-md ${className}`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-emerald-400 uppercase font-mono">
              Horloge & Date Système en Direct
            </span>
          </div>

          <span
            className="text-[11px] font-mono px-2 py-0.5 rounded-md border"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {timeZone}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 py-1">
          <div>
            <div
              className="text-base sm:text-lg font-bold tracking-tight capitalize"
              style={{ color: 'var(--text-primary)' }}
            >
              {fullDateStr}
            </div>
            <div className="text-xs opacity-75 mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>L'IA fait automatiquement référence à cette date en temps réel</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              className="font-mono text-xl sm:text-2xl font-bold tracking-wider px-3 py-1 rounded-xl border bg-black/25 text-amber-400 shadow-inner"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {hours}:{minutes}
              <span className="text-xs text-amber-500/80 ml-1">.{seconds}</span>
            </div>
          </div>
        </div>

        {onAskDate && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={handleCopyDate}
              className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              title="Copier la date et l'heure actuelle"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>

            <button
              onClick={handleAskClick}
              className="text-xs font-medium px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Tester : "Quel jour sommes-nous ?"</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Variant: Header (compact & interactive)
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border hover:border-amber-500/40 transition-all text-xs cursor-pointer group"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
        title="Date et heure en temps réel synchronisées avec RYXIA"
      >
        {/* Pulsing Live indicator */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>

        {/* Date display */}
        <div className="flex items-center gap-1.5 font-medium">
          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0 hidden xs:inline" />
          <span className="hidden sm:inline capitalize font-medium">{dayName}</span>
          <span className="hidden md:inline">{shortDateStr}</span>
          <span className="md:hidden text-[11px]">{shortDateStr}</span>
        </div>

        {/* Divider */}
        <span className="opacity-30 font-light">|</span>

        {/* Live digital time */}
        <div className="flex items-center gap-1 font-mono font-semibold text-amber-400">
          <Clock className="w-3 h-3 text-amber-400/80 shrink-0 hidden xs:inline" />
          <span>{hours}:{minutes}</span>
          <span className="text-[10px] opacity-75 hidden sm:inline">:{seconds}</span>
        </div>

        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover on click */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-80 max-w-[90vw] rounded-2xl shadow-2xl p-4 z-50 border animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Horloge Système & IA
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                En direct
              </span>
            </div>

            {/* Big Clock display */}
            <div
              className="rounded-xl p-3 mb-3 text-center border bg-neutral-100 dark:bg-black/30"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="font-mono text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-wider">
                {timeWithSeconds}
              </div>
              <div className="text-xs font-semibold capitalize mt-1" style={{ color: 'var(--text-primary)' }}>
                {fullDateStr}
              </div>
            </div>

            {/* Meta info list */}
            <div className="space-y-2 text-xs mb-3.5" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="opacity-75 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  Fuseau horaire
                </span>
                <span className="font-mono font-medium text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  {timeZone}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="opacity-75 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Statut RYXIA
                </span>
                <span className="font-semibold text-emerald-400 text-[11px]">
                  Synchronisé avec l'IA
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed opacity-75 mb-3" style={{ color: 'var(--text-secondary)' }}>
              L'intelligence artificielle RYXIA utilise cette date et cette heure en temps réel pour toutes vos questions temporelles, agendas et plannings.
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={handleCopyDate}
                className="flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié' : 'Copier'}</span>
              </button>

              {onAskDate && (
                <button
                  onClick={handleAskClick}
                  className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demander à l'IA</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

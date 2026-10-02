import React from 'react';
import { Sparkles, Terminal, BookOpen, Lightbulb, ArrowRight, Zap, Shield, Database, Lock, Cpu } from 'lucide-react';
import { RYXIA_MODES } from '../../lib/modes.ts';
import { RyxiaMode } from '../../types/index.ts';

interface LandingPageProps {
  onStart: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onLogin }) => {
  const modesList: RyxiaMode[] = ['general', 'code', 'study', 'creative'];

  return (
    <div className="min-h-screen bg-[#07080b] text-[#f0f0f4] flex flex-col selection:bg-amber-500/20 selection:text-amber-200">
      {/* Top Bar Contract (3 zones: Brand, nav links, primary action) */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#07080b]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Zone 1: Single element brand */}
          <div className="flex items-center gap-3">
            <span className="font-display font-extrabold text-xl tracking-tight text-white">
              RYXIA
            </span>
            <span className="text-xs text-neutral-400 font-normal">
              by Adan
            </span>
          </div>

          {/* Zone 2: Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#modes" className="hover:text-white transition-colors">Modes spécialisés</a>
            <a href="#streaming" className="hover:text-white transition-colors">Streaming</a>
            <a href="#memory" className="hover:text-white transition-colors">Mémoire</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white transition-colors whitespace-nowrap"
            >
              Se connecter
            </button>
            <button
              onClick={onStart}
              className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-200 transition-all rounded-md shadow-sm whitespace-nowrap flex items-center gap-1.5"
            >
              Commencer
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-white/10 bg-white/[0.03] text-xs font-medium text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Intelligence artificielle nouvelle génération · GPT-5.6 Luna & Responses Engine
          </div>

          <h1 className="font-display text-5xl sm:text-7xl font-extrabold tracking-tight text-white mb-6 text-balance">
            RYXIA
          </h1>

          <p className="font-display text-2xl sm:text-3xl font-semibold text-neutral-200 mb-6">
            Your AI. Your way.
          </p>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-400 mb-10 leading-relaxed text-balance">
            Une plateforme d’intelligence artificielle haut de gamme, conçue pour l’excellence intellectuelle, l’ingénierie logicielle et la création sans compromis.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={onStart}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 transition-all rounded-md shadow-lg shadow-white/5 flex items-center justify-center gap-2"
            >
              Ouvrir RYXIA
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLogin}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all rounded-md"
            >
              Connexion au compte
            </button>
          </div>

          {/* Visual Showcase Monolith */}
          <div className="relative mx-auto max-w-4xl rounded-xl border border-white/10 bg-[#0d0e14] shadow-2xl shadow-black/80 overflow-hidden">
            <div className="h-9 px-4 bg-[#0a0b10] border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
              </div>
              <span className="text-[11px] font-mono text-neutral-500">ryxia.adan.ai · session active</span>
              <div className="w-12" />
            </div>

            <div className="relative aspect-[16/9] w-full bg-neutral-950 flex items-center justify-center overflow-hidden">
              <img
                src="/src/assets/images/hero_ryxia_core_1790939331576.jpg"
                alt="RYXIA Core Obsidian Monolith"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e14] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-left">
                <div>
                  <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-1">Architecture Unifiée</div>
                  <div className="text-lg font-semibold text-white">Prêt pour vos défis d'ingénierie et de réflexion</div>
                </div>
                <button
                  onClick={onStart}
                  className="px-4 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md rounded-md transition-all whitespace-nowrap"
                >
                  Lancer une session
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Une IA pour tout faire */}
      <section className="py-24 px-6 border-t border-white/[0.06] bg-[#090a0f]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 block">Polyvalence Intégrale</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Une IA conçue pour surpasser les attentes
            </h2>
            <p className="text-neutral-400 leading-relaxed">
              RYXIA ne se contente pas de répondre. Elle contextualise, synthétise, écrit du code propre et résout des problématiques complexes avec méthode.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-lg border border-white/[0.08] bg-[#0e0f16] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-white/[0.05] border border-white/10 flex items-center justify-center text-amber-300 mb-5">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Streaming instantané</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Latence minimale et émission progressive des jetons via Server-Sent Events pour une fluidité de lecture immédiate.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs text-neutral-500 font-mono">
                SSE Pipeline · Temps réel
              </div>
            </div>

            <div className="p-6 rounded-lg border border-white/[0.08] bg-[#0e0f16] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-white/[0.05] border border-white/10 flex items-center justify-center text-sky-400 mb-5">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Mémoire conversationnelle</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Chaque conversation conserve l'intégralité du fil conducteur. RYXIA comprend les références passées sans répétition.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs text-neutral-500 font-mono">
                Contexte persistant · Indexé
              </div>
            </div>

            <div className="p-6 rounded-lg border border-white/[0.08] bg-[#0e0f16] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-white/[0.05] border border-white/10 flex items-center justify-center text-emerald-400 mb-5">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Confidentialité & Sécurité</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Sessions privées avec isolation totale des données utilisateur. Vos clés et vos échanges restent sous votre contrôle.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs text-neutral-500 font-mono">
                JWT Auth · Clés sécurisées côté serveur
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Plusieurs modes */}
      <section id="modes" className="py-24 px-6 border-t border-white/[0.06] bg-[#07080b]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 block">Spécialisation à la demande</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              4 modes d'expertise dédiés
            </h2>
            <p className="text-neutral-400 leading-relaxed">
              Passez d'un rôle à l'autre en un clic. Chaque mode charge ses propres directives système optimisées pour son domaine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {modesList.map((mKey) => {
              const m = RYXIA_MODES[mKey];
              const getIcon = () => {
                if (mKey === 'code') return <Terminal className="w-5 h-5 text-emerald-400" />;
                if (mKey === 'study') return <BookOpen className="w-5 h-5 text-sky-400" />;
                if (mKey === 'creative') return <Lightbulb className="w-5 h-5 text-amber-400" />;
                return <Sparkles className="w-5 h-5 text-purple-400" />;
              };

              return (
                <div
                  key={mKey}
                  className="p-6 rounded-lg border border-white/[0.08] bg-[#0b0c12] hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center">
                        {getIcon()}
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500">{m.badge}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{m.name}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{m.description}</p>
                  </div>
                  <button
                    onClick={onStart}
                    className="mt-6 pt-4 border-t border-white/[0.06] text-xs font-medium text-neutral-300 hover:text-white flex items-center justify-between transition-colors"
                  >
                    <span>Lancer ce mode</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 3 & 4: Vitesse & Contexte */}
      <section id="streaming" className="py-24 px-6 border-t border-white/[0.06] bg-[#090a0f]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 block">Performance & Rendu</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-6">
              Pensé pour être rapide, lisible et ergonomique
            </h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                Grâce au support natif de Markdown avec syntax highlighting, tableaux et indentation automatique, la lisibilité est optimale pour les rédactions denses comme pour les blocs de code complexes.
              </p>
              <p>
                Vous pouvez à tout moment arrêter une génération en cours d'un simple clic sur le bouton <span className="text-white font-medium">Arrêter</span>, ou régénérer une réponse avec des nuances différentes.
              </p>
            </div>

            <div className="mt-8 flex items-center gap-6 text-sm text-neutral-400 font-mono">
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">&lt; 180ms</div>
                <div className="text-xs text-neutral-500">Premier jeton</div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">100%</div>
                <div className="text-xs text-neutral-500">Contexte sauvegardé</div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-2xl font-bold text-white">Zéro pub</div>
                <div className="text-xs text-neutral-500">Expérience épurée</div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-white/10 bg-[#0d0e14] shadow-xl font-mono text-xs text-neutral-300">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06] text-neutral-500">
              <span>ryxia_stream.ts</span>
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                STREAMING ACTIF
              </span>
            </div>
            <pre className="overflow-x-auto text-neutral-300 leading-relaxed">
              <code>{`// Initialisation du flux RYXIA Responses API
const responseStream = await ryxia.chat.stream({
  model: "gpt-5.6-luna",
  mode: "code",
  memoryContext: conversation.history,
  onChunk: (token) => terminal.append(token)
});

// Réponse reçue en temps réel
> Analysing data structures... Done.
> Optimisation asymptotique validée.`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Creator Spotlight */}
      <section className="py-20 px-6 border-t border-white/[0.06] bg-[#07080b]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-8 p-8 rounded-xl border border-white/[0.08] bg-[#0b0c12]">
          <img
            src="/src/assets/images/avatar_adan_creator_1790939344620.jpg"
            alt="Adan - Créateur de RYXIA"
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shrink-0"
          />
          <div>
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Signature du concepteur</div>
            <h3 className="text-xl font-bold text-white mb-2">RYXIA — by Adan</h3>
            <p className="text-sm text-neutral-400 leading-relaxed mb-4">
              "L'intelligence artificielle ne doit pas être une boîte noire impersonnelle ni un gadget surchargé. RYXIA a été forgé pour offrir un environnement de réflexion pur, rigoureux et adaptable à votre propre manière de penser et de construire."
            </p>
            <div className="text-xs text-neutral-500">
              Conception & Architecture · Your AI. Your way.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.06] bg-[#050608] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white">RYXIA</span>
            <span>·</span>
            <span>RYXIA — by Adan</span>
            <span>·</span>
            <span>Your AI. Your way.</span>
          </div>
          <div>
            Version 1.0.0 Pro · GPT-5.6 Luna Engine
          </div>
        </div>
      </footer>
    </div>
  );
};

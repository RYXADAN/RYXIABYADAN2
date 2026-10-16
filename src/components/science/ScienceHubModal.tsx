import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Sparkles, ExternalLink, Dna, FlaskConical, BookOpen, Layers, RotateCw, Send, Check, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api.ts';

interface ScienceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (text: string) => void;
}

type ScienceTab = 'proteins' | 'chemicals' | 'literature';

export const ScienceHubModal: React.FC<ScienceHubModalProps> = ({
  isOpen,
  onClose,
  onSendToChat,
}) => {
  const [activeTab, setActiveTab] = useState<ScienceTab>('proteins');
  const [query, setQuery] = useState('TP53');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [proteinData, setProteinData] = useState<any>(null);
  const [chemicalData, setChemicalData] = useState<any>(null);
  const [literatureData, setLiteratureData] = useState<any[]>([]);

  // 3Dmol viewer
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  const [viewerStyle, setViewerStyle] = useState<'cartoon' | 'stick' | 'sphere'>('cartoon');
  const [sentSuccess, setSentSuccess] = useState(false);

  // Preloaded Quick-Try examples as required by Science Skill design system
  const proteinExamples = ['TP53', 'BRCA1', 'EGFR', 'PCSK9', '4HHB', '1TUP'];
  const chemicalExamples = ['Aspirin', 'Imatinib', 'Caffeine', 'Paracetamol', 'Dopamine'];
  const literatureExamples = ['AlphaFold', 'CRISPR Cas9', 'mRNA vaccine', 'Cancer immunotherapy'];

  // Auto-search default on mount
  useEffect(() => {
    if (isOpen) {
      handleSearch('TP53', 'proteins');
    }
  }, [isOpen]);

  const handleSearch = async (targetQuery = query, targetTab = activeTab) => {
    if (!targetQuery.trim()) return;
    setLoading(true);
    setError(null);
    setSentSuccess(false);

    try {
      if (targetTab === 'proteins') {
        const data = await api.science.getProtein(targetQuery.trim());
        setProteinData(data);
        render3DModel(data.cifUrl, data.source);
      } else if (targetTab === 'chemicals') {
        const data = await api.science.getChemical(targetQuery.trim());
        setChemicalData(data);
      } else if (targetTab === 'literature') {
        const data = await api.science.getLiterature(targetQuery.trim());
        setLiteratureData(data);
      }
    } catch (err: any) {
      console.warn('Science search notice:', err);
      setError(err.message || 'Aucun résultat trouvé pour cette recherche.');
    } finally {
      setLoading(false);
    }
  };

  const render3DModel = async (cifUrl: string, source: 'alphafold' | 'pdb') => {
    if (!viewerContainerRef.current) return;

    try {
      // Dynamic import of 3dmol
      const $3Dmol = (await import('3dmol')).default || (await import('3dmol'));

      if (!viewerInstanceRef.current) {
        viewerInstanceRef.current = $3Dmol.createViewer(viewerContainerRef.current, {
          backgroundColor: '#090d16',
        });
      }

      const viewer = viewerInstanceRef.current;
      viewer.clear();

      const response = await fetch(cifUrl);
      if (!response.ok) throw new Error('Impossible de charger le fichier structure mmCIF.');
      const cifData = await response.text();

      viewer.addModel(cifData, 'cif');

      if (source === 'alphafold') {
        // Canonical AlphaFold 4-band pLDDT Color Scheme
        const plddtColorFunc = (atom: any) => {
          const b = atom.b;
          if (b > 90) return '#0053D6'; // Very high (>90): Dark Blue
          if (b > 70) return '#65CBF3'; // Confident (70-90): Light Blue
          if (b > 50) return '#FFDB13'; // Low (50-70): Yellow
          return '#FF7D45';             // Very low (<50): Orange
        };
        viewer.setStyle({}, { cartoon: { colorfunc: plddtColorFunc } });
      } else {
        viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
      }

      viewer.zoomTo();
      viewer.render();
    } catch (e) {
      console.warn('3Dmol render note:', e);
    }
  };

  const updateViewerStyle = async (style: 'cartoon' | 'stick' | 'sphere') => {
    setViewerStyle(style);
    if (!viewerInstanceRef.current) return;
    const viewer = viewerInstanceRef.current;

    if (style === 'cartoon') {
      if (proteinData?.source === 'alphafold') {
        const colorFunc = (atom: any) => {
          const b = atom.b;
          if (b > 90) return '#0053D6';
          if (b > 70) return '#65CBF3';
          if (b > 50) return '#FFDB13';
          return '#FF7D45';
        };
        viewer.setStyle({}, { cartoon: { colorfunc: colorFunc } });
      } else {
        viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
      }
    } else if (style === 'stick') {
      viewer.setStyle({}, { stick: { colorscheme: 'amino' } });
    } else if (style === 'sphere') {
      viewer.setStyle({}, { sphere: { colorscheme: 'rasmol' } });
    }
    viewer.render();
  };

  const handleSendFindingToChat = () => {
    if (!onSendToChat) return;

    let textToSend = '';
    if (activeTab === 'proteins' && proteinData) {
      textToSend = `Peux-tu analyser en détail la protéine **${proteinData.name}** (${proteinData.gene || proteinData.id}) issue de ${proteinData.source === 'alphafold' ? 'AlphaFold DB' : 'RCSB PDB'} ? Décris sa fonction biologique, ses domaines clés, et son rôle pathologique éventuel.`;
    } else if (activeTab === 'chemicals' && chemicalData) {
      textToSend = `Peux-tu m'expliquer le mode d'action pharmacologique, les cibles biologiques et les propriétés chimiques de la molécule **${chemicalData.title}** (Formule : ${chemicalData.formula}, SMILES : \`${chemicalData.smiles}\`) d'après PubChem ?`;
    } else if (activeTab === 'literature' && literatureData.length > 0) {
      const topPaper = literatureData[0];
      textToSend = `Fais-moi une synthèse critique de l'étude scientifique : "${topPaper.title}" (${topPaper.authors}, ${topPaper.journal} ${topPaper.year}). Quels en sont les apports majeurs et les limites ?`;
    }

    if (textToSend) {
      onSendToChat(textToSend);
      setSentSuccess(true);
      setTimeout(() => {
        onClose();
        setSentSuccess(false);
      }, 600);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-5xl h-[88vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden border transition-all"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Dna className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg tracking-tight">RYXIA Science Skills</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/25">
                  DeepMind Science Suite
                </span>
              </div>
              <p className="text-xs opacity-65">
                AlphaFold DB · RCSB PDB 3D · PubChem Chimie · Europe PMC Littérature
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors opacity-70 hover:opacity-100"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Search Bar */}
        <div
          className="p-4 sm:px-6 border-b shrink-0 space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {/* Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] text-xs">
              <button
                onClick={() => {
                  setActiveTab('proteins');
                  setQuery('TP53');
                  handleSearch('TP53', 'proteins');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === 'proteins'
                    ? 'bg-teal-500 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Dna className="w-3.5 h-3.5" />
                <span>Protéines 3D & AlphaFold</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('chemicals');
                  setQuery('Aspirin');
                  handleSearch('Aspirin', 'chemicals');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === 'chemicals'
                    ? 'bg-teal-500 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Chimie PubChem</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('literature');
                  setQuery('CRISPR Cas9');
                  handleSearch('CRISPR Cas9', 'literature');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === 'literature'
                    ? 'bg-teal-500 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Littérature Europe PMC</span>
              </button>
            </div>

            {/* Quick-Try Pill Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs">
              <span className="text-[11px] opacity-60 font-medium">Exemples :</span>
              {(activeTab === 'proteins'
                ? proteinExamples
                : activeTab === 'chemicals'
                ? chemicalExamples
                : literatureExamples
              ).map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    setQuery(chip);
                    handleSearch(chip, activeTab);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono border border-[var(--border-subtle)] bg-[var(--bg-main)] hover:border-teal-500 hover:text-teal-400 transition-colors shadow-2xs"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50 text-teal-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  activeTab === 'proteins'
                    ? 'Nom de gène ou identifiant (ex: TP53, P04637, 4HHB, EGFR, PCSK9)...'
                    : activeTab === 'chemicals'
                    ? 'Nom de composé ou médicament (ex: Aspirin, Imatinib, Caffeine, Paracetamol)...'
                    : 'Sujet ou terme de recherche médicale (ex: CRISPR, mRNA vaccine, Cancer immunotherapy)...'
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Rechercher</span>
            </button>
          </form>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="opacity-70 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: PROTEINS & ALPHAFOLD 3D */}
          {activeTab === 'proteins' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-[460px]">
              {/* 3D WebGL Viewer Canvas */}
              <div className="lg:col-span-7 flex flex-col rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[#090d16] relative min-h-[380px]">
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-black/60 backdrop-blur-md text-teal-400 border border-teal-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-teal-400" />
                    {proteinData?.source === 'alphafold' ? 'AlphaFold DB (pLDDT)' : 'RCSB PDB (Expérimental)'}
                  </span>
                </div>

                {/* Style selector controls */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px]">
                  <button
                    onClick={() => updateViewerStyle('cartoon')}
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      viewerStyle === 'cartoon' ? 'bg-teal-500 text-white font-bold' : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Rubans
                  </button>
                  <button
                    onClick={() => updateViewerStyle('stick')}
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      viewerStyle === 'stick' ? 'bg-teal-500 text-white font-bold' : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Bâtonnets
                  </button>
                  <button
                    onClick={() => updateViewerStyle('sphere')}
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      viewerStyle === 'sphere' ? 'bg-teal-500 text-white font-bold' : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Sphères
                  </button>
                </div>

                {/* 3Dmol WebGL Container */}
                <div
                  ref={viewerContainerRef}
                  className="w-full flex-1 min-h-[360px] cursor-grab active:cursor-grabbing"
                />

                {/* AlphaFold pLDDT Legend */}
                {proteinData?.source === 'alphafold' && (
                  <div className="p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between text-[11px] font-mono px-4 flex-wrap gap-2">
                    <span className="text-neutral-400 font-sans text-xs">Indice de confiance pLDDT :</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0053D6]" />
                        <span className="text-neutral-300">&gt;90 Très élevé</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#65CBF3]" />
                        <span className="text-neutral-300">70-90 Confiant</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFDB13]" />
                        <span className="text-neutral-300">50-70 Faible</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF7D45]" />
                        <span className="text-neutral-300">&lt;50 Désordonné</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Protein Metadata & Provenance Card */}
              <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-teal-400 uppercase tracking-wider font-semibold">
                      {proteinData?.gene ? `Gène : ${proteinData.gene}` : `ID : ${proteinData?.id || '—'}`}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono">
                      {proteinData?.uniprotAccession || proteinData?.id}
                    </span>
                  </div>

                  <h3 className="text-base font-bold font-display leading-snug">
                    {proteinData?.name || 'Sélectionnez ou recherchez une structure biomoléculaire'}
                  </h3>

                  {proteinData?.organism && (
                    <div className="text-xs opacity-75">
                      <span className="opacity-50">Organisme :</span> {proteinData.organism}
                    </div>
                  )}

                  {proteinData?.resolution && (
                    <div className="text-xs opacity-75 font-mono">
                      <span className="opacity-50">Résolution :</span> {proteinData.resolution} Å ({proteinData.experimentalMethod})
                    </div>
                  )}

                  {proteinData?.sequenceLength && (
                    <div className="text-xs opacity-75 font-mono">
                      <span className="opacity-50">Longueur de séquence :</span> {proteinData.sequenceLength} acides aminés
                    </div>
                  )}

                  {/* External verified links */}
                  <div className="pt-2 space-y-1.5 text-xs">
                    <span className="text-[11px] font-semibold opacity-60 block">Bases de données officielles :</span>
                    <div className="flex flex-wrap gap-2">
                      {proteinData?.cifUrl && (
                        <a
                          href={proteinData.cifUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-teal-500 text-teal-400 text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <span>Fichier mmCIF</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}
                      {proteinData?.alphaGenomeUrl && (
                        <a
                          href={proteinData.alphaGenomeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-teal-500 text-teal-400 text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <span>AlphaGenome Atlas</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Send to chat button */}
                <button
                  onClick={handleSendFindingToChat}
                  disabled={!proteinData}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  {sentSuccess ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>{sentSuccess ? 'Transmis à RYXIA !' : 'Poser une question à RYXIA sur cette protéine'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CHEMICALS (PUBCHEM) */}
          {activeTab === 'chemicals' && chemicalData && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
              <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-white rounded-xl border shadow-xs">
                <img
                  src={chemicalData.imageUrl}
                  alt={chemicalData.title}
                  className="max-h-56 object-contain"
                />
                <span className="text-[11px] text-neutral-500 font-mono mt-2">
                  Structure 2D PubChem CID {chemicalData.cid}
                </span>
              </div>

              <div className="md:col-span-8 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-teal-400 font-semibold">PubChem CID : {chemicalData.cid}</span>
                    <a
                      href={chemicalData.pubchemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-400 flex items-center gap-1 hover:underline"
                    >
                      <span>Fiche officielle</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <h3 className="text-xl font-bold font-display">{chemicalData.title}</h3>
                  {chemicalData.iupacName && (
                    <div className="text-xs opacity-70">
                      <span className="font-semibold">Nom IUPAC :</span> {chemicalData.iupacName}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                      <div className="text-[11px] opacity-60">Formule moléculaire</div>
                      <div className="text-sm font-mono font-bold text-teal-400">{chemicalData.formula}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                      <div className="text-[11px] opacity-60">Masse moléculaire</div>
                      <div className="text-sm font-mono font-bold text-teal-400">{chemicalData.molecularWeight} g/mol</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] space-y-1">
                    <div className="text-[11px] opacity-60">SMILES canonique :</div>
                    <div className="text-xs font-mono break-all select-all text-neutral-300">
                      {chemicalData.smiles}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSendFindingToChat}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {sentSuccess ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>{sentSuccess ? 'Transmis à RYXIA !' : 'Demander l\'analyse pharmacologique à RYXIA'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LITERATURE (EUROPE PMC) */}
          {activeTab === 'literature' && (
            <div className="space-y-3">
              <div className="text-xs opacity-65 flex items-center justify-between">
                <span>Publications scientifiques indexées dans Europe PMC & PubMed :</span>
                <span className="font-mono text-[11px]">{literatureData.length} articles trouvés</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {literatureData.map((paper) => (
                  <div
                    key={paper.id}
                    className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-teal-500/50 transition-all flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          {paper.year || 'Récent'}
                        </span>
                        {paper.isOpenAccess && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            Open Access
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-sm font-display line-clamp-2 leading-snug">
                        {paper.title}
                      </h4>

                      <div className="text-[11px] opacity-70 line-clamp-1">
                        {paper.authors} · <span className="font-medium italic">{paper.journal}</span>
                      </div>

                      {paper.abstract && (
                        <p className="text-xs opacity-60 line-clamp-3 leading-relaxed">
                          {paper.abstract}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 flex items-center gap-1 hover:underline text-[11px]"
                      >
                        <span>Lire l'article</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() => {
                          if (onSendToChat) {
                            onSendToChat(`Fais-moi une synthèse critique de l'étude scientifique : "${paper.title}" (${paper.authors}, ${paper.journal} ${paper.year}).`);
                            onClose();
                          }
                        }}
                        className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Analyser dans RYXIA</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

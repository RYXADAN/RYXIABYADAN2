import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Download,
  Upload,
  RefreshCw,
  Send,
  Sliders,
  Maximize2,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { GeneratedImage } from '../../types/index.ts';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | null;
  onImageCreatedForChat?: (image: GeneratedImage) => void;
  initialMode?: 'create' | 'edit';
  initialImageBase64?: string | null;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  onImageCreatedForChat,
  initialMode = 'create',
  initialImageBase64 = null,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>(initialMode);

  // Creation State
  const [createPrompt, setCreatePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);

  // Edit State
  const [editPrompt, setEditPrompt] = useState('');
  const [sourceImageBase64, setSourceImageBase64] = useState<string | null>(initialImageBase64);
  const [isEditing, setIsEditing] = useState(false);
  const [editedImage, setEditedImage] = useState<GeneratedImage | null>(null);

  // Error & UI State
  const [error, setError] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImageBase64) {
      setSourceImageBase64(initialImageBase64);
      setActiveTab('edit');
    }
  }, [initialImageBase64]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomImageUrl) {
          setZoomImageUrl(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, zoomImageUrl, onClose]);

  if (!isOpen) return null;

  const quickPrompts = [
    'Une ville cyberpunk futuriste sous une pluie nocturne avec reflets néons holographiques',
    'Un chat astronaute flottant dans l\'espace avec la Terre en arrière-plan, photoréaliste',
    'Un paysage montagneux alpin au lever du soleil avec brume dorée et lac miroir',
    'Un logo minimaliste et moderne d\'aigle géométrique en or brossé sur fond noir mat',
  ];

  const quickEditPrompts = [
    'Ajoute des néons lumineux futuristes et une ambiance nocturne cyberpunk',
    'Transforme le style en peinture à l\'huile impressionniste avec textures riches',
    'Remplace l\'arrière-plan par un coucher de soleil sur une plage tropicale',
    'Ajoute une lueur dorée magique et des particules étincelantes autour du sujet',
  ];

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!createPrompt.trim() || isGenerating) return;

    setError(null);
    setIsGenerating(true);

    try {
      const res = await api.images.generate({
        prompt: createPrompt.trim(),
        aspectRatio,
        conversationId: conversationId || undefined,
      });

      const img: GeneratedImage = {
        imageUrl: res.image.imageUrl,
        mimeType: res.image.mimeType,
        prompt: res.image.prompt,
        model: res.image.model,
        aspectRatio,
        createdAt: new Date().toISOString(),
      };

      setGeneratedImage(img);
      if (onImageCreatedForChat) {
        onImageCreatedForChat(img);
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Impossible de générer l\'image avec le moteur RYXIA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editPrompt.trim() || !sourceImageBase64 || isEditing) return;

    setError(null);
    setIsEditing(true);

    try {
      const res = await api.images.edit({
        prompt: editPrompt.trim(),
        imageBase64: sourceImageBase64,
        aspectRatio,
        conversationId: conversationId || undefined,
      });

      const img: GeneratedImage = {
        imageUrl: res.image.imageUrl,
        mimeType: res.image.mimeType,
        prompt: res.image.prompt,
        model: res.image.model,
        aspectRatio,
        createdAt: new Date().toISOString(),
      };

      setEditedImage(img);
      if (onImageCreatedForChat) {
        onImageCreatedForChat(img);
      }
    } catch (err: any) {
      console.error('Edit error:', err);
      setError(err.message || 'Impossible de modifier l\'image avec le moteur RYXIA.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner un fichier image valide (PNG, JPEG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSourceImageBase64(base64);
      setEditedImage(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = (dataUrl: string, filenamePrefix = 'ryxia_image') => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filenamePrefix}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendToEditor = (imgDataUrl: string) => {
    setSourceImageBase64(imgDataUrl);
    setEditedImage(null);
    setActiveTab('edit');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-base tracking-tight">Studio Image RYXIA</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                  RYXIA Visual Engine
                </span>
              </div>
              <p className="text-xs opacity-60">Création et retouche avancée d'images par IA</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] opacity-70 hover:opacity-100 transition-colors flex items-center gap-1 text-xs font-mono"
              title="Fermer (Échap)"
            >
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px]">
                Échap
              </span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          className="flex items-center px-5 pt-2 pb-0 gap-2 border-b shrink-0 bg-[var(--bg-sidebar)]"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'create'
                ? 'border-amber-500 text-amber-500 bg-[var(--bg-main)]'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Créer une image</span>
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'edit'
                ? 'border-amber-500 text-amber-500 bg-[var(--bg-main)]'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Modifier une image</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:opacity-80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'create' ? (
            /* TAB 1: CREATE IMAGE */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controls Column */}
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-70">
                    Description textuelle (Prompt)
                  </label>
                  <textarea
                    value={createPrompt}
                    onChange={(e) => setCreatePrompt(e.target.value)}
                    placeholder="Décrivez l'image que vous souhaitez générer avec précision (sujet, style, éclairage, ambiance)..."
                    rows={4}
                    className="w-full p-3 rounded-xl text-sm border focus:outline-hidden focus:border-amber-500 transition-colors resize-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* Aspect Ratio Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-70">
                    Format d'affichage (Aspect Ratio)
                  </label>
                  <div className="grid grid-cols-5 gap-2 text-xs font-medium">
                    {[
                      { id: '1:1', label: '1:1', desc: 'Carré' },
                      { id: '16:9', label: '16:9', desc: 'Paysage' },
                      { id: '9:16', label: '9:16', desc: 'Portrait' },
                      { id: '4:3', label: '4:3', desc: 'Standard' },
                      { id: '3:4', label: '3:4', desc: 'Vertical' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAspectRatio(item.id as any)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                          aspectRatio === item.id
                            ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold shadow-xs'
                            : 'hover:bg-[var(--bg-surface-hover)] border-[var(--border-color)] opacity-70'
                        }`}
                      >
                        <span className="font-mono text-xs">{item.label}</span>
                        <span className="text-[10px] opacity-75">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Inspiration Prompts */}
                <div>
                  <span className="text-xs opacity-60 font-medium block mb-1.5">Suggestions rapides :</span>
                  <div className="space-y-1.5">
                    {quickPrompts.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCreatePrompt(q)}
                        className="w-full text-left p-2 rounded-lg text-xs border border-transparent hover:border-amber-500/30 hover:bg-[var(--bg-surface)] transition-all opacity-75 hover:opacity-100 flex items-center justify-between group"
                      >
                        <span className="line-clamp-1">{q}</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-500 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={!createPrompt.trim() || isGenerating}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Génération en cours avec RYXIA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Générer avec le Studio RYXIA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preview Column */}
              <div className="lg:col-span-6 flex flex-col">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-70">
                  Résultat
                </label>

                <div
                  className="flex-1 min-h-[300px] rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {isGenerating ? (
                    <div className="text-center space-y-3 p-6 animate-pulse">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">Création de l'image en cours...</div>
                        <div className="text-xs opacity-60">Le moteur RYXIA synthétise votre requête</div>
                      </div>
                    </div>
                  ) : generatedImage ? (
                    <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
                      <div className="relative group max-h-[360px] w-full flex items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-lg">
                        <img
                          src={generatedImage.imageUrl}
                          alt={generatedImage.prompt}
                          referrerPolicy="no-referrer"
                          className="max-h-[360px] w-auto object-contain rounded-xl"
                        />
                        <button
                          onClick={() => setZoomImageUrl(generatedImage.imageUrl)}
                          className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/70 hover:bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Agrandir"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Image Details & Actions */}
                      <div className="w-full flex items-center justify-between text-xs pt-1">
                        <span className="opacity-60 font-mono text-[11px] truncate max-w-[200px]">
                          {generatedImage.model} · {generatedImage.aspectRatio}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => sendToEditor(generatedImage.imageUrl)}
                            className="px-2.5 py-1.5 rounded-lg border hover:border-amber-500 text-amber-500 text-xs font-semibold transition-colors flex items-center gap-1.5"
                            title="Modifier cette image dans l'onglet d'édition"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadImage(generatedImage.imageUrl, 'ryxia_gen')}
                            className="p-1.5 rounded-lg border hover:bg-[var(--bg-surface-hover)] transition-colors"
                            title="Télécharger"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 space-y-2 opacity-50">
                      <ImageIcon className="w-10 h-10 mx-auto opacity-50" />
                      <div className="text-xs">Aucune image générée pour le moment.</div>
                      <div className="text-[11px] opacity-75">Saisissez une description et cliquez sur Générer.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: EDIT IMAGE */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Source Upload & Instructions */}
              <div className="lg:col-span-6 space-y-4">
                {/* Image Upload Area */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
                      Image source à modifier
                    </label>
                    {sourceImageBase64 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-amber-500 hover:underline"
                      >
                        Changer d'image
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {sourceImageBase64 ? (
                    <div className="relative group rounded-xl border overflow-hidden p-2 flex items-center justify-center max-h-[180px] bg-black/20" style={{ borderColor: 'var(--border-color)' }}>
                      <img
                        src={sourceImageBase64}
                        alt="Image source"
                        referrerPolicy="no-referrer"
                        className="max-h-[160px] object-contain rounded-lg"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Remplacer l'image</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-center space-y-2"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <Upload className="w-8 h-8 opacity-60 text-amber-500" />
                      <div>
                        <div className="text-xs font-semibold">Cliquez pour importer une image</div>
                        <div className="text-[11px] opacity-60">PNG, JPG, WebP jusqu'à 10 Mo</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit Instructions */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-70">
                    Instructions de modification
                  </label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Expliquez ce que vous souhaitez changer (ex: 'Ajoute des lunettes de soleil', 'Change l'éclairage en coucher de soleil', 'Transforme le style en dessin animé')..."
                    rows={3}
                    className="w-full p-3 rounded-xl text-sm border focus:outline-hidden focus:border-amber-500 transition-colors resize-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* Quick Edit Suggestions */}
                <div>
                  <span className="text-xs opacity-60 font-medium block mb-1.5">Suggestions d'édition :</span>
                  <div className="space-y-1.5">
                    {quickEditPrompts.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditPrompt(q)}
                        className="w-full text-left p-2 rounded-lg text-xs border border-transparent hover:border-amber-500/30 hover:bg-[var(--bg-surface)] transition-all opacity-75 hover:opacity-100 flex items-center justify-between group"
                      >
                        <span className="line-clamp-1">{q}</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-500 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Edit Button */}
                <button
                  type="button"
                  onClick={() => handleEdit()}
                  disabled={!editPrompt.trim() || !sourceImageBase64 || isEditing}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isEditing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Retouche par RYXIA en cours...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Appliquer les modifications avec le Studio RYXIA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right Column: Comparison & Result */}
              <div className="lg:col-span-6 flex flex-col">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-70">
                  Image Modifiée
                </label>

                <div
                  className="flex-1 min-h-[300px] rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {isEditing ? (
                    <div className="text-center space-y-3 p-6 animate-pulse">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                        <Wand2 className="w-6 h-6 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">Modification de l'image en cours...</div>
                        <div className="text-xs opacity-60">Le moteur RYXIA applique vos retouches</div>
                      </div>
                    </div>
                  ) : editedImage ? (
                    <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
                      <div className="relative group max-h-[360px] w-full flex items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-lg">
                        <img
                          src={editedImage.imageUrl}
                          alt={editedImage.prompt}
                          referrerPolicy="no-referrer"
                          className="max-h-[360px] w-auto object-contain rounded-xl"
                        />
                        <button
                          onClick={() => setZoomImageUrl(editedImage.imageUrl)}
                          className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/70 hover:bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Agrandir"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="w-full flex items-center justify-between text-xs pt-1">
                        <span className="opacity-60 font-mono text-[11px] truncate max-w-[200px]">
                          {editedImage.model}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => sendToEditor(editedImage.imageUrl)}
                            className="px-2.5 py-1.5 rounded-lg border hover:border-amber-500 text-amber-500 text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Rééditer cette version modifiée"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Rééditer</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadImage(editedImage.imageUrl, 'ryxia_edited')}
                            className="p-1.5 rounded-lg border hover:bg-[var(--bg-surface-hover)] transition-colors"
                            title="Télécharger"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 space-y-2 opacity-50">
                      <Layers className="w-10 h-10 mx-auto opacity-50" />
                      <div className="text-xs">Importez une image et indiquez les retouches souhaitées.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setZoomImageUrl(null)}
        >
          <button
            onClick={() => setZoomImageUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomImageUrl}
            alt="Image grand format"
            referrerPolicy="no-referrer"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

// FILE: frontend/src/components/FlashcardCreator.jsx

import { useState, useEffect } from 'react';
import { SlidersHorizontal, Loader2, Plus, Check, Eye, EyeOff, Trash2, AlignLeft, AlignCenter, AlignRight, Sparkles, Layers } from 'lucide-react';

import FormInputs from './creator/FormInputs';
import StylePanel from './creator/StylePanel';
import FloatingPreviewPanel, { getStoredPreviewPanelMode } from './creator/FloatingPreviewPanel';

// Importamos la función de parseo unificada y centralizada
import { parseCardStyles } from '../lib/utils';
import { readAiGenerationProgress } from '../lib/aiProgressStream';
import { getJSON, setJSON } from '../lib/safeLocalStorage';

const ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];

const SWATCHES = [
  { label: 'Predeterminado', value: '' },
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Oro', value: '#f59e0b' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Azul', value: '#3b82f6' },
];

const PREVIEW_VISIBLE_KEY = 'ufc_preview_visible_v1';
const AI_GENERATION_ENDPOINT = import.meta.env.VITE_AI_GENERATION_MODE === 'v1'
  ? '/api/flashcards/generate-ai'
  : '/api/flashcards/generate-ai-v2';

export default function FlashcardCreator({
  question, setQuestion, answer, setAnswer, bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles, isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel, contentImage, setContentImage,
  imageSide, setImageSide, onFastDelete, hasCards,
  userId, deckId, authToken, onAiSuccess, onInviteRequired
}) {
  const [showPreview, setShowPreview] = useState(() => Boolean(getJSON(PREVIEW_VISIBLE_KEY)));
  const [previewMode, setPreviewMode] = useState(() => getStoredPreviewPanelMode());
  
  const [isAi, setIsAi] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiNumCards, setAiNumCards] = useState(5);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);

  const activeTab = editingId ? 'single' : (isAi ? 'ai' : (isBulk ? 'bulk' : 'single'));

  useEffect(() => {
    setJSON(PREVIEW_VISIBLE_KEY, showPreview);
  }, [showPreview]);

  useEffect(() => {
    if (showPreview && previewMode === 'docked' && showStyles) setShowStyles(false);
  }, [previewMode, setShowStyles, showPreview, showStyles]);

  const handleTabChange = (tabId) => {
    setError('');
    setShowPreview(false);
    setShowStyles(false);
    
    if (tabId === 'single') {
      setIsBulk(false);
      setIsAi(false);
    } else if (tabId === 'bulk') {
      setIsBulk(true);
      setIsAi(false);
    } else if (tabId === 'ai') {
      setIsBulk(false);
      setIsAi(true);
    }
  };

  // El motor redundante parseCurrentStyles fue removido con éxito.
  // Ahora consumimos directamente la utilidad unificada de la aplicación.
  const styles = parseCardStyles(fontSize);
  const previewLocksStandaloneStyles = showPreview && previewMode === 'docked';
  const showStandaloneStylePanel = showStyles && (!showPreview || previewMode !== 'docked');

  const updateStyle = (key, value) => {
    setFontSize(JSON.stringify({ ...styles, [key]: value }));
  };

  const handleBgFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) { setError('La imagen es muy grande (máx. 700KB).'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setBgImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleContentImageFile = async (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          let width = img.width, height = img.height;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setContentImage(canvas.toDataURL('image/jpeg', 0.7));
          setImageSide(side);
        };
      };
    } catch (err) { setError('Error al procesar la imagen.'); }
    e.target.value = '';
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      if (!aiText.trim() || aiSaving) return;
      setAiSaving(true);
      setError('');
      setAiProgress({
        generated: 0,
        audited: 0,
        accepted: 0,
        target: Number(aiNumCards) || 0,
        total: Number(aiNumCards) || 0,
        message: 'Preparando la generación con IA...',
      });

      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
        const res = await fetch(`${BACKEND_URL}${AI_GENERATION_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            userId,
            deckId,
            text: aiText,
            count: aiNumCards,
            batchStyles: { bgImage, textAlign, fontSize }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 && errData.code === 'INVITE_REQUIRED') {
            onInviteRequired?.();
            return;
          }
          if (res.status === 401) {
            throw new Error('Tu sesión expiró. Cierra sesión e inicia sesión de nuevo para generar con IA.');
          }
          throw new Error(errData.message || errData.error || 'El motor de IA experimentó una saturación o no configuraste tu API Key.');
        }

        const result = await readAiGenerationProgress(res, setAiProgress);
        await onAiSuccess?.(result);
        
        setAiText('');
        setIsAi(false); 
      } catch (err) {
        setError(err.message || 'Error de conexión con el nodo de Inteligencia Artificial.');
      } finally {
        setAiProgress(null);
        setAiSaving(false);
      }
    } else {
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      
      {/* SECTOR DE CABECERA CON CONTROL SEGMENTADO GEOMÉTRICO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {editingId ? 'Modo de edición activa' : 'Método de construcción'}
        </p>
        
        {!editingId && (
          <div className="grid grid-cols-3 sm:flex bg-slate-100 p-1 border border-slate-200/60 rounded-xl items-center w-full sm:w-auto self-center">
            {[
              { id: 'single', label: 'Manual', Icon: Plus },
              { id: 'bulk', label: 'Lote', Icon: Layers },
              { id: 'ai', label: 'IA', Icon: Sparkles }
            ].map((tab) => {
              const TabIcon = tab.Icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected && tab.id === 'ai' ? 'text-indigo-500 animate-pulse' : ''}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <FormInputs 
        isBulk={isBulk} 
        isAi={isAi}
        question={question} setQuestion={setQuestion} 
        answer={answer} setAnswer={setAnswer} 
        bulkText={bulkText} setBulkText={setBulkText}
        contentImage={contentImage} imageSide={imageSide} 
        handleContentImageFile={handleContentImageFile} 
        removeContentImage={() => { setContentImage(''); setImageSide(''); }}
        aiText={aiText} setAiText={setAiText}
        aiNumCards={aiNumCards} setAiNumCards={setAiNumCards}
      />

      {/* ✨ ACTUALIZADO: Retiramos 'activeTab !== "ai"' para que la botonera de estilos esté siempre disponible */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button 
          type="button" 
          onClick={() => {
            const nextShowPreview = !showPreview;
            setShowPreview(nextShowPreview);
            if (nextShowPreview && previewMode === 'docked') setShowStyles(false);
          }} 
          className={`flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 text-xs font-bold rounded-xl h-12 sm:h-11 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer p-1 ${
            showPreview ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
          <span className="text-center leading-tight">{showPreview ? 'Cerrar vista' : 'Previsualizar Tarjeta'}</span>
        </button>

        <button 
          type="button" 
          onClick={() => { if (!previewLocksStandaloneStyles) setShowStyles(!showStyles); }} 
          disabled={previewLocksStandaloneStyles} 
          className={`flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 text-xs font-bold rounded-xl h-12 sm:h-11 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer p-1 ${
            previewLocksStandaloneStyles 
              ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200' 
              : showStyles 
              ? 'bg-slate-100 text-slate-900 border-slate-300' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="text-center leading-tight">Estilo rápido</span>
        </button>
      </div>

      {/* ✨ ACTUALIZADO: Inyección inteligente de placeholders dinámicos si están en modo IA */}
      {showPreview && (
        <FloatingPreviewPanel 
          question={activeTab === 'ai' ? '¿Pregunta muestra generada por la IA?' : question} 
          answer={activeTab === 'ai' ? 'Esta será la respuesta explicativa de tu tarjeta inteligente.' : answer} 
          bgImage={bgImage} textAlign={textAlign} styles={styles} contentImage={contentImage} imageSide={imageSide}
          ALIGNS={ALIGNS} SWATCHES={SWATCHES} setTextAlign={setTextAlign} handleBgFile={handleBgFile} updateStyle={updateStyle} setBgImage={setBgImage}
          onModeChange={setPreviewMode}
        />
      )}

      {/* ✨ ACTUALIZADO: Unificado el panel de control estético rápido para los 3 modos */}
      {showStandaloneStylePanel && (
        <StylePanel 
          ALIGNS={ALIGNS} SWATCHES={SWATCHES} textAlign={textAlign} setTextAlign={setTextAlign} bgImage={bgImage} setBgImage={setBgImage}
          styles={styles} updateStyle={updateStyle} handleBgFile={handleBgFile}
        />
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3.5">
        {!editingId ? (
          onFastDelete && hasCards ? (
            <button type="button" disabled={aiSaving} onClick={onFastDelete} className="flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 text-xs font-bold h-12 sm:h-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] shadow-3xs cursor-pointer disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" /> <span className="text-center">Borrado Rápido</span>
            </button>
          ) : <div className="w-full h-12 sm:h-11" />
        ) : (
          <button type="button" onClick={onCancel} className="flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 rounded-xl border border-slate-200 h-12 sm:h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] shadow-3xs cursor-pointer">
            <span className="text-center">Cancelar</span>
          </button>
        )}

        <button 
          type="submit" 
          disabled={saving || aiSaving || (activeTab === 'ai' ? !aiText.trim() : (activeTab === 'bulk' ? !bulkText.trim() : (!question.trim() || !answer.trim())))} 
          className={`flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 rounded-xl text-xs font-bold h-12 sm:h-11 transition-all active:scale-[0.98] cursor-pointer shadow-sm ${
            activeTab === 'ai' 
              ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-slate-800 text-white border border-indigo-950/20' 
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {saving || aiSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : editingId ? (
            <Check className="w-3.5 h-3.5 shrink-0" />
          ) : activeTab === 'ai' ? (
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-[pulse_1.5s_infinite]" />
          ) : (
            <Plus className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="text-center">
            {editingId ? 'Guardar' : activeTab === 'ai' ? 'Generar con IA' : activeTab === 'bulk' ? 'Generar lote' : 'Agregar tarjeta'}
          </span>
        </button>
      </div>

      {aiSaving && aiProgress && (
        <section role="status" aria-live="polite" className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" aria-hidden="true" />
              <p className="truncate text-xs font-bold text-indigo-950">{aiProgress.message}</p>
            </div>
            <span className="shrink-0 text-xs font-black tabular-nums text-indigo-700">
              {aiProgress.accepted || 0}/{aiProgress.target || 0}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-200/70" role="progressbar" aria-valuemin={0} aria-valuemax={aiProgress.total || 1} aria-valuenow={Math.min(aiProgress.generated || 0, aiProgress.total || 0)} aria-label="Tarjetas generadas">
            <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-300" style={{ width: `${aiProgress.total ? Math.min(100, ((aiProgress.generated || 0) / aiProgress.total) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-[11px] font-medium text-indigo-700">
            {aiProgress.generated || 0} generadas · {aiProgress.audited || 0} auditadas · {aiProgress.accepted || 0} listas para guardar
          </p>
        </section>
      )}

      {error && <p className="mt-2 text-xs text-red-600 font-semibold bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]">{error}</p>}
    </form>
  );
}

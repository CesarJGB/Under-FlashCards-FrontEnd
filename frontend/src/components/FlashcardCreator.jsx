import { useState } from 'react';
import { SlidersHorizontal, Loader2, Plus, Check, Eye, EyeOff, Trash2, AlignLeft, AlignCenter, AlignRight, Sparkles, Layers } from 'lucide-react';

import FormInputs from './creator/FormInputs';
import StylePanel from './creator/StylePanel';
import LivePreview from './creator/LivePreview';

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

export default function FlashcardCreator({
  question, setQuestion, answer, setAnswer, bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles, isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel, contentImage, setContentImage,
  imageSide, setImageSide, onFastDelete, hasCards,
  userId, deckId, onAiSuccess // 🚀 Inyectado userId para comunicación segura con el backend
}) {
  const [showPreview, setShowPreview] = useState(false);
  
  const [isAi, setIsAi] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiNumCards, setAiNumCards] = useState(5);
  const [aiSaving, setAiSaving] = useState(false);

  const activeTab = editingId ? 'single' : (isAi ? 'ai' : (isBulk ? 'bulk' : 'single'));

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

  const parseCurrentStyles = () => {
    if (fontSize && fontSize.startsWith('{')) {
      try { 
        const p = JSON.parse(fontSize);
        const mapOldSize = (val) => {
          if (typeof val === 'number') return val;
          return { 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24 }[val] || 16;
        };
        return {
          qSize: mapOldSize(p.qSize), qBold: p.qBold ?? true, qItalic: p.qItalic ?? false, qColor: p.qColor || '',
          aSize: mapOldSize(p.aSize), aBold: p.aBold ?? false, aItalic: p.aItalic ?? false, aColor: p.aColor || '',
          bgColor: p.bgColor || ''
        };
      } catch (e) {}
    }
    const numSize = { 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24 }[fontSize] || 16;
    return { qSize: numSize, qBold: true, qItalic: false, qColor: '', aSize: numSize, aBold: false, aItalic: false, aColor: '', bgColor: '' };
  };

  const styles = parseCurrentStyles();

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
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
        const res = await fetch(`${BACKEND_URL}/api/flashcards/generate-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId, // 🧠 Enviado para que el backend localice la clave segura del usuario
            deckId,
            text: aiText,
            count: aiNumCards,
            batchStyles: { bgImage, textAlign, fontSize }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'El motor de IA experimentó una saturación o no configuraste tu API Key.');
        }

        const newCards = await res.json();
        if (onAiSuccess) onAiSuccess(newCards);
        
        setAiText('');
        setIsAi(false); 
      } catch (err) {
        setError(err.message || 'Error de conexión con el nodo de Inteligencia Artificial.');
      } finally {
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

      {activeTab !== 'ai' && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button 
            type="button" 
            onClick={() => { setShowPreview(!showPreview); setShowStyles(false); }} 
            className={`flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 text-xs font-bold rounded-xl h-12 sm:h-11 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer p-1 ${
              showPreview ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
            <span className="text-center leading-tight">{showPreview ? 'Cerrar vista' : 'Previsualizar Tarjeta'}</span>
          </button>

          <button 
            type="button" 
            onClick={() => { if (!showPreview) setShowStyles(!showStyles); }} 
            disabled={showPreview} 
            className={`flex w-full flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 text-xs font-bold rounded-xl h-12 sm:h-11 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer p-1 ${
              showPreview 
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
      )}

      {showPreview && activeTab !== 'ai' && (
        <LivePreview 
          question={question} answer={answer} bgImage={bgImage} textAlign={textAlign} styles={styles} contentImage={contentImage} imageSide={imageSide}
          ALIGNS={ALIGNS} SWATCHES={SWATCHES} setTextAlign={setTextAlign} handleBgFile={handleBgFile} updateStyle={updateStyle}
        />
      )}

      {!showPreview && showStyles && activeTab !== 'ai' && (
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
      
      {error && <p className="mt-2 text-xs text-red-600 font-semibold bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]">{error}</p>}
    </form>
  );
}

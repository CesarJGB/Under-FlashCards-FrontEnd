// ARCHIVO: frontend/src/components/FlashcardCreator.jsx
import { useState } from 'react';
import { SlidersHorizontal, Loader2, Plus, Check, Eye, EyeOff, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

// Importación de tus archivos modulares desde la carpeta creator
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
  imageSide, setImageSide, onFastDelete, hasCards
}) {

  const [showPreview, setShowPreview] = useState(false);

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
          aSize: mapOldSize(p.aSize), aBold: p.aBold ?? false, aItalic: p.aItalic ?? false, aColor: p.aColor || ''
        };
      } catch (e) {}
    }
    const numSize = { 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24 }[fontSize] || 16;
    return { qSize: numSize, qBold: true, qItalic: false, qColor: '', aSize: numSize, aBold: false, aItalic: false, aColor: '' };
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

  return (
    <form onSubmit={onSubmit} className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
        <p className="text-sm font-bold text-slate-700">
          {editingId ? 'Editar tarjeta' : isBulk ? 'Creación masiva por mazo de texto' : 'Nueva tarjeta'}
        </p>
        {!editingId && (
          <button 
            type="button" 
            onClick={() => { setIsBulk(!isBulk); setError(''); setShowPreview(false); }} 
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 underline transition-colors"
          >
            {isBulk ? 'Volver a tarjeta única' : 'Cambiar a creación en lote'}
          </button>
        )}
      </div>

      {/* 📝 CAMPOS DE ENTRADA (DELEGADO) */}
      <FormInputs 
        isBulk={isBulk} question={question} setQuestion={setQuestion} answer={answer} setAnswer={setAnswer} bulkText={bulkText} setBulkText={setBulkText}
        contentImage={contentImage} imageSide={imageSide} handleContentImageFile={handleContentImageFile} removeContentImage={() => { setContentImage(''); setImageSide(''); }}
      />

      {/* 👁️ FILA SUPERIOR: CONFIGURACIÓN (Corregido con alineación estricta text-center) */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button 
          type="button" 
          onClick={() => { setShowPreview(!showPreview); setShowStyles(false); }} 
          className={`flex w-full items-center justify-center text-center gap-2 text-xs font-bold rounded-xl h-11 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer ${
            showPreview ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {showPreview ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
          <span className="text-center">{showPreview ? 'Cerrar vista' : 'Previsualizar Tarjeta'}</span>
        </button>

        <button 
          type="button" 
          onClick={() => { if (!showPreview) setShowStyles(!showStyles); }} 
          disabled={showPreview} 
          className={`flex w-full items-center justify-center text-center gap-2 text-xs font-bold rounded-xl h-11 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer ${
            showPreview 
              ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200' 
              : showStyles 
              ? 'bg-slate-100 text-slate-900 border-slate-300' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span className="text-center">Estilo rápido</span>
        </button>
      </div>

      {/* 🎴 SIMULADOR DE PREVISUALIZACIÓN */}
      {showPreview && (
        <LivePreview 
          question={question} answer={answer} bgImage={bgImage} textAlign={textAlign} styles={styles} contentImage={contentImage} imageSide={imageSide}
          ALIGNS={ALIGNS} SWATCHES={SWATCHES} setTextAlign={setTextAlign} handleBgFile={handleBgFile} updateStyle={updateStyle}
        />
      )}

      {/* 🎨 PANEL DE DISEÑO */}
      {!showPreview && showStyles && (
        <StylePanel 
          ALIGNS={ALIGNS} SWATCHES={SWATCHES} textAlign={textAlign} setTextAlign={setTextAlign} bgImage={bgImage} setBgImage={setBgImage}
          styles={styles} updateStyle={updateStyle} handleBgFile={handleBgFile}
        />
      )}

      {/* 🚀 FILA INFERIOR: ACCIONES CORE (Corregido con alineación estricta text-center) */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3.5">
        
        {/* Columna Izquierda: Cancelar o Borrado Rápido */}
        {editingId ? (
          <button 
            type="button" 
            onClick={onCancel} 
            className="flex w-full items-center justify-center text-center gap-2 rounded-xl border border-slate-200 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] shadow-3xs cursor-pointer"
          >
            <span className="text-center">Cancelar</span>
          </button>
        ) : onFastDelete && hasCards ? (
          <button 
            type="button" 
            onClick={onFastDelete} 
            className="flex w-full items-center justify-center text-center gap-2 text-xs font-bold h-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] shadow-3xs cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-center">Borrado Rápido</span>
          </button>
        ) : (
          <div className="w-full h-11" />
        )}

        {/* Columna Derecha: Agregar Tarjeta o Guardar Cambios */}
        <button
          type="submit"
          disabled={saving || (isBulk ? !bulkText.trim() : (!question.trim() || !answer.trim()))}
          className="flex w-full items-center justify-center text-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold h-11 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : editingId ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <Plus className="w-4 h-4 shrink-0" />
          )}
          <span className="text-center">{editingId ? 'Guardar cambios' : isBulk ? 'Generar lote' : 'Agregar tarjeta'}</span>
        </button>

      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

import { useState } from 'react';
import { 
  SlidersHorizontal, 
  ImagePlus, 
  Check, 
  Plus, 
  Minus,
  Loader2, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  Italic, 
  Palette,
  Eye,
  EyeOff
} from 'lucide-react';

const ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

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
  question, setQuestion, answer, setAnswer,
  bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles,
  isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel
}) {

  const [showPreview, setShowPreview] = useState(false);
  const [qColorOpen, setQColorOpen] = useState(false);
  const [aColorOpen, setAColorOpen] = useState(false);

  const parseCurrentStyles = () => {
    if (fontSize && fontSize.startsWith('{')) {
      try { 
        const p = JSON.parse(fontSize);
        const mapOldSize = (val) => {
          if (typeof val === 'number') return val;
          const m = { 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24 };
          return m[val] || 16;
        };
        return {
          qSize: mapOldSize(p.qSize), qBold: p.qBold ?? true, qItalic: p.qItalic ?? false, qColor: p.qColor || '',
          aSize: mapOldSize(p.aSize), aBold: p.aBold ?? false, aItalic: p.aItalic ?? false, aColor: p.aColor || ''
        };
      } catch (e) {}
    }
    const standardSize = fontSize && !fontSize.startsWith('{') ? fontSize : 'text-base';
    const mapping = { 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24 };
    const numSize = mapping[standardSize] || 16;
    return {
      qSize: numSize, qBold: true, qItalic: false, qColor: '',
      aSize: numSize, aBold: false, aItalic: false, aColor: ''
    };
  };

  const styles = parseCurrentStyles();

  const updateStyle = (key, value) => {
    const updated = { ...styles, [key]: value };
    setFontSize(JSON.stringify(updated));
  };

  const togglePreview = () => {
    const nextState = !showPreview;
    setShowPreview(nextState);
    setShowStyles(false);
    setQColorOpen(false);
    setAColorOpen(false);
  };

  const handleBgFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      setError('La imagen es muy grande (máx. 700KB).');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setBgImage(reader.result);
    reader.readAsDataURL(file);
  };

  const renderStyleGroup = (title, prefix, colorOpen, setColorOpen) => {
    const sizeKey = `${prefix}Size`;
    const boldKey = `${prefix}Bold`;
    const italicKey = `${prefix}Italic`;
    const colorKey = `${prefix}Color`;

    const currentSizeNum = styles[sizeKey];

    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs relative">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</p>
        
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Controles Incrementales +/- */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => updateStyle(sizeKey, Math.max(12, currentSizeNum - 1))}
              className="p-1 rounded-md hover:bg-white text-slate-600 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-[11px] font-extrabold text-slate-800 min-w-[32px] text-center font-mono">
              {currentSizeNum}px
            </span>
            <button
              type="button"
              onClick={() => updateStyle(sizeKey, Math.min(40, currentSizeNum + 1))}
              className="p-1 rounded-md hover:bg-white text-slate-600 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Atributos y Desplegable de Color */}
          <div className="flex items-center gap-1">
            <button
              type="button" onClick={() => updateStyle(boldKey, !styles[boldKey])}
              className={`p-1.5 rounded-lg border transition-colors ${styles[boldKey] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button" onClick={() => updateStyle(italicKey, !styles[italicKey])}
              className={`p-1.5 rounded-lg border transition-colors ${styles[italicKey] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            
            <div className="relative">
              <button
                type="button" 
                onClick={() => setColorOpen(!colorOpen)}
                style={styles[colorKey] ? { backgroundColor: styles[colorKey] } : {}}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                  styles[colorKey] 
                    ? 'text-white border-transparent shadow-xs' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Palette className={`w-3.5 h-3.5 ${styles[colorKey] ? 'drop-shadow-xs text-white' : ''}`} />
              </button>

              {/* 🌟 CORREGIDO: Menú 100% horizontal de una sola línea fluido (flex-row) con scroll táctil */}
              {colorOpen && (
                <div className="absolute right-0 bottom-full mb-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xl z-30 flex flex-row items-center gap-2 overflow-x-auto max-w-[270px] sm:max-w-none animate-[slideUp_0.1s_ease-out]">
                  {SWATCHES.map((c) => (
                    <button
                      key={c.value} type="button" title={c.label}
                      onClick={() => { updateStyle(colorKey, c.value); setColorOpen(false); }}
                      style={c.value ? { backgroundColor: c.value } : {}}
                      className={`w-8 h-8 rounded-xl border shrink-0 transition-all ${
                        styles[colorKey] === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : 'border-slate-200 hover:scale-105'
                      } ${!c.value ? 'bg-slate-100 relative after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"]' : ''}`}
                    />
                  ))}
                  <label className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer overflow-hidden relative bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shrink-0 hover:scale-105 transition-transform">
                    <input 
                      type="color" 
                      value={styles[colorKey] && styles[colorKey].startsWith('#') ? styles[colorKey] : '#ffffff'} 
                      onChange={(e) => updateStyle(colorKey, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer scale-150" 
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
        <p className="text-sm font-bold text-slate-700">
          {editingId ? 'Editar tarjeta' : isBulk ? 'Creación masiva por bloque de texto' : 'Nueva tarjeta'}
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

      {isBulk && !editingId ? (
        <div className="animate-[fadeIn_0.2s_ease]">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Pega tu texto estructurado abajo:</label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"P: ¿Qué día fue teóricamente ayer?\nR: 20 de junio\n\nP: ¿Cuál es el número atómico del Hidrógeno?\nR: 1"}
            className="min-h-[160px] w-full font-mono text-xs rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-300"
          />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 animate-[fadeIn_0.2s_ease]">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pregunta</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="¿Cuál es la capital de Francia?"
                className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Respuesta</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="París"
                className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
          </div>

          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={togglePreview}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-4 py-2 border transition-all active:scale-95 ${
                showPreview ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Cerrar Previsualización' : 'Previsualizar Tarjeta'}
            </button>

            {!showPreview && (
              <button
                type="button"
                onClick={() => setShowStyles((s) => !s)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-xl px-4 py-2 border transition-colors ${
                  showStyles ? 'bg-slate-100 text-slate-900 border-slate-300' : 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Estilo rápido
              </button>
            )}
          </div>

          {/* PANEL DE PREVISUALIZACIÓN EN VIVO */}
          {showPreview && (
            <div className="mt-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-4 animate-[fadeIn_0.15s_ease] shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Previsualización en tiempo real</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              
              <div className="flex justify-center py-2 bg-white/40 border border-slate-200/40 rounded-xl">
                <div 
                  style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                  className="relative w-full max-w-[320px] min-h-[220px] rounded-2xl border border-slate-200 shadow-md overflow-hidden bg-white flex flex-col p-4 justify-center"
                >
                  {bgImage && <span className="absolute inset-0 bg-black/55" />}
                  <span className="absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full bg-slate-400/30 z-10" />
                  
                  <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">
                    <p className={`text-[8px] font-bold uppercase tracking-wide ${bgImage ? 'text-white/60' : 'text-slate-400'} ${ALIGN_CLASS[textAlign] || 'text-center'}`}>Pregunta</p>
                    <p 
                      style={{ 
                        fontSize: `${styles.qSize}px`, 
                        ...(styles.qColor ? { color: styles.qColor } : {}) 
                      }}
                      className={`mt-0.5 whitespace-pre-wrap truncate-3-lines ${ALIGN_CLASS[textAlign] || 'text-center'} ${styles.qBold ? 'font-bold' : 'font-normal'} ${styles.qItalic ? 'italic' : ''} ${bgImage && !styles.qColor ? 'text-white' : (!styles.qColor ? 'text-slate-900' : '')}`}
                    >
                      {question.trim() || 'Escribe tu pregunta...'}
                    </p>

                    <div className={`my-2.5 border-t border-dashed ${bgImage ? 'border-white/30' : 'border-slate-200'}`} />

                    <p className={`text-[8px] font-bold uppercase tracking-wide ${bgImage ? 'text-white/60' : 'text-slate-400'} ${ALIGN_CLASS[textAlign] || 'text-center'}`}>Respuesta</p>
                    <p 
                      style={{ 
                        fontSize: `${styles.aSize}px`, 
                        ...(styles.aColor ? { color: styles.aColor } : {}) 
                      }}
                      className={`mt-0.5 whitespace-pre-wrap truncate-3-lines ${ALIGN_CLASS[textAlign] || 'text-center'} ${styles.aBold ? 'font-bold' : 'font-normal'} ${styles.aItalic ? 'italic' : ''} ${bgImage && !styles.aColor ? 'text-white/90' : (!styles.aColor ? 'text-slate-700' : '')}`}
                    >
                      {answer.trim() || 'Escribe tu respuesta...'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controles avanzados integrados abajo del Preview */}
              <div className="space-y-3 pt-1 border-t border-slate-200/60">
                <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200/70 shadow-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Alineación</p>
                    <div className="flex gap-1">
                      {ALIGNS.map(({ value, label, Icon }) => (
                        <button
                          key={value} type="button" title={label}
                          onClick={() => setTextAlign(value)}
                          className={`rounded-lg p-1.5 border transition-colors ${textAlign === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Fondo mazo</p>
                    <div className="flex items-center gap-1.5">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 shadow-2xs">
                        <ImagePlus className="w-3.5 h-3.5 text-slate-500" /> <span className="text-[11px]">Subir</span>
                        <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
                      </label>
                      {bgImage && (
                        <button type="button" onClick={() => setBgImage('')} className="text-xs text-red-600 hover:underline">Borrar</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {renderStyleGroup('Estilo de la Pregunta', 'q', qColorOpen, setQColorOpen)}
                  {renderStyleGroup('Estilo de la Respuesta', 'a', aColorOpen, setAColorOpen)}
                </div>
              </div>
            </div>
          )}

          {/* PANEL TRADICIONAL RÁPIDO */}
          {!showPreview && showStyles && (
            <div className="mt-3 border-t border-slate-100 pt-3 space-y-3 animate-[fadeIn_0.12s_ease]">
              <div className="grid grid-cols-2 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200/40">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Alineación</p>
                  <div className="flex gap-1">
                    {ALIGNS.map(({ value, label, Icon }) => (
                      <button
                        key={value} type="button" title={label}
                        onClick={() => setTextAlign(value)}
                        className={`rounded-lg p-1.5 border transition-colors ${textAlign === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Fondo</p>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-xs">
                      <ImagePlus className="w-3.5 h-3.5 text-slate-500" /> <span>Imagen</span>
                      <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
                    </label>
                    {bgImage && <button type="button" onClick={() => setBgImage('')} className="text-xs text-red-600 hover:underline">Quitar</button>}
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {renderStyleGroup('Estilo de la Pregunta', 'q', qColorOpen, setQColorOpen)}
                {renderStyleGroup('Estilo de la Respuesta', 'a', aColorOpen, setAColorOpen)}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <button
          type="submit"
          disabled={saving || (isBulk ? !bulkText.trim() : (!question.trim() || !answer.trim()))}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-transform active:scale-95 shadow-sm"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {editingId ? 'Guardar cambios' : isBulk ? 'Generar lote de tarjetas' : 'Agregar tarjeta'}
        </button>
        {editingId && (
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

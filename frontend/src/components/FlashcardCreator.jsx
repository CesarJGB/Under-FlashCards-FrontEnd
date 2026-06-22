// ARCHIVO: frontend/src/components/FlashcardCreator.jsx
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
  EyeOff,
  Pipette,
  X,
  Trash2
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

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; 
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('Error al procesar el archivo de imagen.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
  });
};

export default function FlashcardCreator({
  question, setQuestion, answer, setAnswer,
  bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles,
  isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel,
  contentImage, setContentImage, imageSide, setImageSide,
  onFastDelete, hasCards
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

  const handleContentImageFile = async (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const compressedBase64 = await compressImage(file);
      setContentImage(compressedBase64);
      setImageSide(side);
    } catch (err) {
      setError(err.message || 'Error al procesar la imagen de contenido.');
    }
    e.target.value = '';
  };

  const removeContentImage = () => {
    setContentImage('');
    setImageSide('');
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
                  styles[colorKey] ? 'text-white border-transparent shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Palette className={`w-3.5 h-3.5 ${styles[colorKey] ? 'drop-shadow-xs text-white' : ''}`} />
              </button>

              {colorOpen && (
                <div className="absolute right-0 bottom-full mb-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xl z-30 grid grid-cols-4 gap-2 w-[168px] animate-[slideUp_0.1s_ease-out]">
                  {SWATCHES.map((c) => (
                    <button
                      key={c.value} type="button" title={c.label}
                      onClick={() => { updateStyle(colorKey, c.value); setColorOpen(false); }}
                      style={c.value ? { backgroundColor: c.value } : {}}
                      className={`w-8 h-8 rounded-xl border transition-all ${
                        styles[colorKey] === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : 'border-slate-200 hover:scale-105'
                      } ${!c.value ? 'bg-slate-100 relative after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"]' : ''}`}
                    />
                  ))}
                  
                  <label className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer overflow-hidden relative bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shrink-0 hover:scale-105 transition-transform flex items-center justify-center group shadow-xs" title="Color personalizado">
                    <Pipette className="w-3.5 h-3.5 text-white drop-shadow-xs group-hover:scale-110 transition-transform relative z-10" />
                    <input 
                      type="color" 
                      value={styles[colorKey] && styles[colorKey].startsWith('#') ? styles[colorKey] : '#ffffff'} 
                      onChange={(e) => updateStyle(colorKey, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer scale-150 z-0" 
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
          <div className="grid sm:grid-cols-2 gap-4 animate-[fadeIn_0.2s_ease]">
            <div className="flex flex-col">
              <label className="block text-xs font-medium text-slate-500 mb-1">Pregunta</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="¿Cuál es la capital de Francia?"
                className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              <div className="mt-2 flex items-center min-h-[36px]">
                {contentImage && imageSide === 'question' ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-1 pr-2.5 max-w-full animate-[slideUp_0.1s_ease]">
                    <img src={contentImage} alt="Miniatura Pregunta" className="w-8 h-8 rounded-lg object-cover bg-slate-200 border border-slate-200" />
                    <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">Imagen de pregunta</span>
                    <button type="button" onClick={removeContentImage} className="text-slate-400 hover:text-red-500 transition-colors p-0.5" title="Eliminar imagen"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  (!contentImage || imageSide !== 'answer') && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 hover:border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors shadow-2xs">
                      <ImagePlus className="w-3.5 h-3.5 text-slate-400" /> <span className="text-[11px] font-medium">Añadir imagen</span>
                      <input type="file" accept="image/*" onChange={(e) => handleContentImageFile(e, 'question')} className="hidden" />
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="block text-xs font-medium text-slate-500 mb-1">Respuesta</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="París"
                className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              <div className="mt-2 flex items-center min-h-[36px]">
                {contentImage && imageSide === 'answer' ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-1 pr-2.5 max-w-full animate-[slideUp_0.1s_ease]">
                    <img src={contentImage} alt="Miniatura Respuesta" className="w-8 h-8 rounded-lg object-cover bg-slate-200 border border-slate-200" />
                    <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">Imagen de respuesta</span>
                    <button type="button" onClick={removeContentImage} className="text-slate-400 hover:text-red-500 transition-colors p-0.5" title="Eliminar imagen"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  (!contentImage || imageSide !== 'question') && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 hover:border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors shadow-2xs">
                      <ImagePlus className="w-3.5 h-3.5 text-slate-400" /> <span className="text-[11px] font-medium">Añadir imagen</span>
                      <input type="file" accept="image/*" onChange={(e) => handleContentImageFile(e, 'answer')} className="hidden" />
                    </label>
                  )
                )}
              </div>
            </div>
          </div>

          {/* 🌟 FILA SUPERIOR: PREVISUALIZAR Y ESTILO (Simetría de Rejilla Gemela) */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={togglePreview}
              className={`inline-flex items-center justify-center gap-2 text-xs font-bold rounded-xl py-2.5 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer ${
                showPreview 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {showPreview ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
              <span>{showPreview ? 'Cerrar vista' : 'Previsualizar Tarjeta'}</span>
            </button>

            <button
              type="button"
              onClick={() => { if (!showPreview) setShowStyles((s) => !s); }}
              disabled={showPreview}
              className={`inline-flex items-center justify-center gap-2 text-xs font-bold rounded-xl py-2.5 border transition-all active:scale-[0.98] shadow-3xs cursor-pointer ${
                showPreview
                  ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
                  : showStyles 
                  ? 'bg-slate-100 text-slate-900 border-slate-300' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span>Estilo rápido</span>
            </button>
          </div>

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
                  
                  <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0 py-2">
                    <p className={`text-[8px] font-bold uppercase tracking-wide ${bgImage ? 'text-white/60' : 'text-slate-400'} ${ALIGN_CLASS[textAlign] || 'text-center'}`}>Pregunta</p>
                    <p 
                      style={{ fontSize: `${styles.qSize}px`, ...(styles.qColor ? { color: styles.qColor } : {}) }}
                      className={`mt-0.5 whitespace-pre-wrap truncate-3-lines ${ALIGN_CLASS[textAlign] || 'text-center'} ${styles.qBold ? 'font-bold' : 'font-normal'} ${styles.qItalic ? 'italic' : ''} ${bgImage && !styles.qColor ? 'text-white' : (!styles.qColor ? 'text-slate-900' : '')}`}
                    >
                      {question.trim() || 'Escribe tu pregunta...'}
                    </p>
                    
                    {contentImage && imageSide === 'question' && (
                      <div className="mt-2 flex justify-center">
                        <img src={contentImage} alt="Preview contenido P" className="max-h-24 rounded-lg object-contain border border-slate-200/60 bg-slate-50 p-0.5 shadow-2xs" />
                      </div>
                    )}

                    <div className={`my-2.5 border-t border-dashed ${bgImage ? 'border-white/30' : 'border-slate-200'}`} />

                    <p className={`text-[8px] font-bold uppercase tracking-wide ${bgImage ? 'text-white/60' : 'text-slate-400'} ${ALIGN_CLASS[textAlign] || 'text-center'}`}>Respuesta</p>
                    <p 
                      style={{ fontSize: `${styles.aSize}px`, ...(styles.aColor ? { color: styles.aColor } : {}) }}
                      className={`mt-0.5 whitespace-pre-wrap truncate-3-lines ${ALIGN_CLASS[textAlign] || 'text-center'} ${styles.aBold ? 'font-bold' : 'font-normal'} ${styles.aItalic ? 'italic' : ''} ${bgImage && !styles.aColor ? 'text-white/90' : (!styles.aColor ? 'text-slate-700' : '')}`}
                    >
                      {answer.trim() || 'Escribe tu respuesta...'}
                    </p>

                    {contentImage && imageSide === 'answer' && (
                      <div className="mt-2 flex justify-center">
                        <img src={contentImage} alt="Preview contenido R" className="max-h-24 rounded-lg object-contain border border-slate-200/60 bg-slate-50 p-0.5 shadow-2xs" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

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

      {/* 🌟 FILA INFERIOR: ACCIONES CORE (Simetría Flex unificada en el mismo nivel Y) */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        
        {/* Lado Izquierdo: Borrado Rápido */}
        {!editingId && onFastDelete && hasCards ? (
          <button
            type="button"
            onClick={onFastDelete}
            className="flex-1 inline-flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] shadow-3xs cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
            <span>Borrado Rápido</span>
          </button>
        ) : (
          /* Caja invisible que preserva simetría si no cumple la condicional */
          !editingId && <div className="flex-1" />
        )}

        {/* Lado Derecho: Cancelar + Guardar / Agregar */}
        <div className="flex-1 flex gap-2">
          {editingId && (
            <button 
              type="button" 
              onClick={onCancel} 
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors active:scale-[0.98]"
            >
              Cancelar
            </button>
          )}
          
          <button
            type="submit"
            disabled={saving || (isBulk ? !bulkText.trim() : (!question.trim() || !answer.trim()))}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold py-2.5 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editingId ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <Plus className="w-4 h-4 shrink-0" />
            )}
            <span>{editingId ? 'Guardar cambios' : isBulk ? 'Generar lote' : 'Agregar tarjeta'}</span>
          </button>
        </div>

      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

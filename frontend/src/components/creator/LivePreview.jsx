// ARCHIVO: frontend/src/components/creator/LivePreview.jsx
import { useState } from 'react';
import { ImagePlus, Palette, Pipette } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

export default function LivePreview({ question, answer, bgImage, textAlign, styles, contentImage, imageSide, ALIGNS, SWATCHES, setTextAlign, handleBgFile, updateStyle }) {
  const [bgColorOpen, setBgColorOpen] = useState(false);

  return (
    <div className="mt-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-4 animate-[fadeIn_0.15s_ease] shadow-inner">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Previsualización en tiempo real</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      
      <div className="flex justify-center py-2 bg-white/40 border border-slate-200/40 rounded-xl">
        <div 
          style={{
            backgroundColor: styles.bgColor || '#ffffff',
            backgroundImage: bgImage ? `url(${bgImage})` : undefined, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center'
          }}
          className="relative w-full max-w-[320px] min-h-[220px] rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col p-4 justify-center"
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
                <img src={contentImage} alt="Preview P" className="max-h-24 rounded-lg object-contain border border-slate-200/60 bg-slate-50 p-0.5 shadow-2xs" />
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
                <img src={contentImage} alt="Preview R" className="max-h-24 rounded-lg object-contain border border-slate-200/60 bg-slate-50 p-0.5 shadow-2xs" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1 border-t border-slate-200/60">
        <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200/70 shadow-xs">
          
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 w-full">Alineación</p>
            <div className="flex gap-1 justify-center">
              {ALIGNS.map(({ value, label, Icon }) => (
                <button key={value} type="button" title={label} onClick={() => setTextAlign(value)} className={`rounded-lg p-1.5 border transition-colors ${textAlign === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}><Icon className="w-3.5 h-3.5" /></button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 w-full">Fondo mazo</p>
            <div className="flex items-center justify-center gap-1.5">
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 shadow-2xs shrink-0">
                <ImagePlus className="w-3.5 h-3.5 text-slate-500" /> <span className="text-[11px]">Subir</span>
                <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
              </label>
              {bgImage && <button type="button" onClick={() => setBgImage('')} className="text-xs text-red-600 hover:underline shrink-0">Borrar</button>}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBgColorOpen(!bgColorOpen)}
                  style={styles.bgColor ? { backgroundColor: styles.bgColor } : {}}
                  className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                    styles.bgColor ? 'text-white border-transparent shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Palette className={`w-3.5 h-3.5 ${styles.bgColor ? 'drop-shadow-xs text-white' : ''}`} />
                </button>

                {bgColorOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setBgColorOpen(false)} />
                    <div className="absolute right-0 mt-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xl z-40 grid grid-cols-4 gap-2 w-[168px] animate-[slideUp_0.1s_ease-out]">
                      {SWATCHES.map((c) => (
                        <button key={c.value} type="button" title={c.label} onClick={() => { updateStyle('bgColor', c.value); setBgColorOpen(false); }} style={c.value ? { backgroundColor: c.value } : {}} className={`w-8 h-8 rounded-xl border transition-all ${styles.bgColor === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : 'border-slate-200 hover:scale-105'} ${!c.value ? 'bg-slate-100 relative after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"]' : ''}`} />
                      ))}
                      <label className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer overflow-hidden relative bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shrink-0 hover:scale-105 transition-transform flex items-center justify-center group shadow-xs">
                        <Pipette className="w-3.5 h-3.5 text-white drop-shadow-xs group-hover:scale-110 transition-transform relative z-10" />
                        <input type="color" value={styles.bgColor && styles.bgColor.startsWith('#') ? styles.bgColor : '#ffffff'} onChange={(e) => updateStyle('bgColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer scale-150 z-0" />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

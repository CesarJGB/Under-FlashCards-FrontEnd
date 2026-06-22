// ARCHIVO: frontend/src/components/creator/LivePreview.jsx
const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

export default function LivePreview({ question, answer, bgImage, textAlign, styles, contentImage, imageSide, ALIGNS, SWATCHES, setTextAlign, handleBgFile, updateStyle }) {
  return (
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
    </div>
  );
}

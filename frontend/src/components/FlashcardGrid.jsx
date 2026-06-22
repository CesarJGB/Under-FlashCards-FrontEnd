// ARCHIVO: frontend/src/components/FlashcardGrid.jsx
import { useState } from 'react';
import { Pencil, Trash2, Layers, Image, X } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

const parseCardStyles = (fontSizeField, hasBg) => {
  if (fontSizeField && fontSizeField.startsWith('{')) {
    try {
      const p = JSON.parse(fontSizeField);
      return {
        qSize: p.qSize || 'text-base', qBold: p.qBold ?? true, qItalic: p.qItalic ?? false, qColor: p.qColor || '',
        aSize: p.aSize || 'text-base', aBold: p.aBold ?? false, aItalic: p.aItalic ?? false, aColor: p.aColor || ''
      };
    } catch (e) {}
  }
  return {
    qSize: fontSizeField || 'text-base', qBold: true, qItalic: false, qColor: '',
    aSize: fontSizeField || 'text-base', aBold: false, aItalic: false, aColor: ''
  };
};

export default function FlashcardGrid({ cards, onEdit, onDelete }) {
  // 🔍 ESTADO LOCAL: Controla qué imagen se está previsualizando en pantalla completa
  const [activePreview, setActivePreview] = useState(null);
  
  if (cards.length === 0) {
    return (
      <div className="mt-4 text-center border border-dashed border-slate-300 rounded-2xl py-10 text-slate-400">
        <Layers className="w-6 h-6 mx-auto mb-1.5" />
        Aún no hay tarjetas en este mazo.
      </div>
    );
  }

  return (
    <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const hasBg = !!card.bgImage;
        const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
        const st = parseCardStyles(card.fontSize, hasBg);

        const isQNum = typeof st.qSize === 'number';
        const qSizeStyle = isQNum ? { fontSize: `${st.qSize}px` } : {};
        const qSizeClass = isQNum ? '' : st.qSize;

        const isANum = typeof st.aSize === 'number';
        const aSizeStyle = isANum ? { fontSize: `${st.aSize}px` } : {};
        const aSizeClass = isANum ? '' : st.aSize;

        const cardStyle = hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
        const finalQStyle = { ...(st.qColor ? { color: st.qColor } : {}), ...qSizeStyle };
        const finalAStyle = { ...(st.aColor ? { color: st.aColor } : {}), ...aSizeStyle };

        return (
          <div key={card.id} style={cardStyle} className="relative rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-white flex flex-col justify-between">
            {hasBg && <span className="absolute inset-0 bg-black/55" />}

            <div className="relative z-10 p-4 pt-6">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-full bg-slate-400/40" />
              
              <div className="flex justify-end gap-1 mb-1">
                <button onClick={() => onEdit(card)} className={`p-1.5 rounded-lg transition-colors ${hasBg ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(card)} className={`p-1.5 rounded-lg transition-colors ${hasBg ? 'text-red-300 hover:bg-white/20' : 'text-red-600 hover:bg-red-50'}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 🎴 SECCIÓN PREGUNTA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                  Pregunta
                </p>
                {/* Botón interactivo de Preview directo en Grid */}
                {card.contentImage && card.imageSide === 'question' && (
                  <button 
                    type="button"
                    onClick={() => setActivePreview({ title: 'Imagen de la Pregunta', src: card.contentImage })}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-normal uppercase border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                      hasBg ? 'bg-white/20 text-white border-white/20 hover:bg-white/30' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    <Image className="w-2.5 h-2.5 shrink-0" /> Ver Imagen
                  </button>
                )}
              </div>
              
              <p style={finalQStyle} className={`mt-1 whitespace-pre-wrap ${alignClass} ${qSizeClass} ${st.qBold ? 'font-bold' : 'font-normal'} ${st.qItalic ? 'italic' : ''} ${hasBg && !st.qColor ? 'text-white' : 'text-slate-900'}`}>
                {card.question}
              </p>

              <div className={`my-3 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

              {/* 🎴 SECCIÓN RESPUESTA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                  Respuesta
                </p>
                {/* Botón interactivo de Preview directo en Grid */}
                {card.contentImage && card.imageSide === 'answer' && (
                  <button 
                    type="button"
                    onClick={() => setActivePreview({ title: 'Imagen de la Respuesta', src: card.contentImage })}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-normal uppercase border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                      hasBg ? 'bg-white/20 text-white border-white/20 hover:bg-white/30' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    <Image className="w-2.5 h-2.5 shrink-0" /> Ver Imagen
                  </button>
                )}
              </div>

              <p style={finalAStyle} className={`mt-1 whitespace-pre-wrap ${alignClass} ${aSizeClass} ${st.aBold ? 'font-bold' : 'font-normal'} ${st.aItalic ? 'italic' : ''} ${hasBg && !st.aColor ? 'text-white/90' : 'text-slate-700'}`}>
                {card.answer}
              </p>
            </div>
          </div>
        );
      })}

      {/* 🖼️ LIGHTBOX MODAL FLOTANTE (Renders on top of everything if an image is clicked) */}
      {activePreview && (
        <div 
          onClick={() => setActivePreview(null)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-[fadeIn_0.15s_ease]"
        >
          <div 
            onClick={(e) => e.stopPropagation()} // Evita cerrar si se pica la tarjeta blanca
            className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-[scaleIn_0.15s_ease-out]"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-slate-400" /> {activePreview.title}
              </span>
              <button 
                type="button" 
                onClick={() => setActivePreview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 bg-slate-100/40 flex justify-center items-center min-h-[220px]">
              <img 
                src={activePreview.src} 
                alt="Vista ampliada" 
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-xs border border-white bg-white p-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

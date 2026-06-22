// ARCHIVO: frontend/src/components/FlashcardGrid.jsx
import { Pencil, Trash2, Layers, Image } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

// 🧠 DESEMPAQUETADOR VISUAL: Parsea el objeto de estilos o aplica fallbacks inteligentes
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
  // Fallback retrocompatible para cartas viejas
  return {
    qSize: fontSizeField || 'text-base', qBold: true, qItalic: false, qColor: '',
    aSize: fontSizeField || 'text-base', aBold: false, aItalic: false, aColor: ''
  };
};

export default function FlashcardGrid({ cards, onEdit, onDelete }) {
  
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
        
        // Obtenemos la configuración tipográfica independiente
        const st = parseCardStyles(card.fontSize, hasBg);

        // 🛠️ CONTROL DE TIPOS PARA LA PREGUNTA
        const isQNum = typeof st.qSize === 'number';
        const qSizeStyle = isQNum ? { fontSize: `${st.qSize}px` } : {};
        const qSizeClass = isQNum ? '' : st.qSize;

        // 🛠️ CONTROL DE TIPOS PARA LA RESPUESTA
        const isANum = typeof st.aSize === 'number';
        const aSizeStyle = isANum ? { fontSize: `${st.aSize}px` } : {};
        const aSizeClass = isANum ? '' : st.aSize;

        const cardStyle = hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
        
        // Combinación inteligente de colores personalizados y tamaños dinámicos
        const finalQStyle = { ...(st.qColor ? { color: st.qColor } : {}), ...qSizeStyle };
        const finalAStyle = { ...(st.aColor ? { color: st.aColor } : {}), ...aSizeStyle };

        return (
          <div key={card.id} style={cardStyle} className="relative rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-white">
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

              {/* 🎴 SECCIÓN DE PREGUNTA MODULAR CORREGIDA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                  Pregunta
                </p>
                {/* Indicador visual inteligente si la pregunta lleva imagen */}
                {card.contentImage && card.imageSide === 'question' && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-normal uppercase border animate-[fadeIn_0.15s_ease] ${
                    hasBg 
                      ? 'bg-white/20 text-white border-white/10 shadow-xs' 
                      : 'bg-slate-100 text-slate-600 border-slate-200/60'
                  }`}>
                    <Image className="w-2.5 h-2.5 shrink-0" /> Imagen
                  </span>
                )}
              </div>
              
              <p 
                style={finalQStyle}
                className={`mt-1 whitespace-pre-wrap ${alignClass} ${qSizeClass} ${st.qBold ? 'font-bold' : 'font-normal'} ${st.qItalic ? 'italic' : ''} ${hasBg && !st.qColor ? 'text-white' : 'text-slate-900'}`}
              >
                {card.question}
              </p>

              <div className={`my-3 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

              {/* 🎴 SECCIÓN DE RESPUESTA MODULAR CORREGIDA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                  Respuesta
                </p>
                {/* Indicador visual inteligente si la respuesta lleva imagen */}
                {card.contentImage && card.imageSide === 'answer' && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-normal uppercase border animate-[fadeIn_0.15s_ease] ${
                    hasBg 
                      ? 'bg-white/20 text-white border-white/10 shadow-xs' 
                      : 'bg-slate-100 text-slate-600 border-slate-200/60'
                  }`}>
                    <Image className="w-2.5 h-2.5 shrink-0" /> Imagen
                  </span>
                )}
              </div>

              <p 
                style={finalAStyle}
                className={`mt-1 whitespace-pre-wrap ${alignClass} ${aSizeClass} ${st.aBold ? 'font-bold' : 'font-normal'} ${st.aItalic ? 'italic' : ''} ${hasBg && !st.aColor ? 'text-white/90' : 'text-slate-700'}`}
              >
                {card.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

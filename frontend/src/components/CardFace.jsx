// FILE: frontend/src/components/CardFace.jsx
import { Maximize2 } from 'lucide-react';
import { parseCardStyles } from '../lib/utils';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

/**
 * Renderiza el contenido completo de una cara de tarjeta (pregunta o respuesta):
 * texto con sus estilos personalizados (tamaño, negrita, cursiva, color) e imagen
 * adjunta si corresponde a ese lado, con botón de expandir a pantalla completa.
 *
 * Se usa tanto en el modo flip (una cara a la vez) como en el modo study
 * (ambas caras visibles juntas) de SessionPlayer.
 */
export default function CardFace({ card, side, dark, onExpandImage }) {
  if (!card) return null;

  const st = parseCardStyles(card.fontSize);
  const isAnswer = side === 'answer';

  const size = isAnswer ? st.aSize : st.qSize;
  const bold = isAnswer ? st.aBold : st.qBold;
  const italic = isAnswer ? st.aItalic : st.qItalic;
  const color = isAnswer ? st.aColor : st.qColor;
  const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
  const text = isAnswer ? card.answer : card.question;

  const hasImage = !!card.contentImage && card.imageSide === side;
  const hasBg = !!card.bgImage;

  // Color explícito definido por el usuario tiene prioridad; si no hay,
  // usamos blanco sobre fondo oscuro (dark del modo flip) o sobre bgImage
  // decorativo (que siempre lleva overlay oscuro encima), y slate-900 en
  // cualquier otro caso.
  const textColorClass = color ? '' : ((dark || hasBg) ? 'text-white' : 'text-slate-900');

  return (
    <>
      <p
        style={{
          fontSize: `${size}px`,
          ...(color ? { color } : {}),
        }}
        className={`whitespace-pre-wrap ${alignClass} ${bold ? 'font-bold' : 'font-normal'} ${italic ? 'italic' : ''} ${textColorClass}`}
      >
        {text}
      </p>

      {hasImage && (
        <div className="mt-4 flex justify-center w-full animate-[slideUp_0.18s_ease-out]">
          <div className="relative max-w-max group">
            <img
              src={card.contentImage}
              alt="Imagen de estudio"
              className={`max-h-32 sm:max-h-40 w-auto object-contain rounded-xl border p-1 shadow-2xs ${
                dark ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200/60'
              }`}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExpandImage(); }}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-950 text-white shadow-md backdrop-blur-xs transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95 flex items-center justify-center border border-white/10 cursor-pointer"
              title="Ver en pantalla completa"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Helper para que el componente padre arme el `style` de fondo de la tarjeta
 * (bgColor sólido + bgImage si existe), igual que en ReviewMode.jsx.
 * Exportado aparte porque el fondo se aplica al contenedor de la cara completa,
 * no al texto, y SessionPlayer necesita decidir cuándo usarlo (modo flip lo
 * aplica por cara; modo study podría optar por no usarlo, según se decida).
 */
export function getCardBackgroundStyle(card) {
  const st = parseCardStyles(card?.fontSize);
  const hasBg = !!card?.bgImage;
  return {
    style: {
      backgroundColor: st.bgColor || '#ffffff',
      ...(hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    },
    hasBg,
  };
}

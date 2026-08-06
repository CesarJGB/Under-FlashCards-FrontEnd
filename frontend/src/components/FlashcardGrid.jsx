// FILE: frontend/src/components/FlashcardGrid.jsx

import { useState } from 'react';
import { Image, Layers, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import ActionSheet from './common/ActionSheet';

// Importamos la función de parseo unificada y centralizada
import { parseCardStyles } from '../lib/utils';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

function getCardPresentation(card) {
  const hasBg = Boolean(card.bgImage);
  const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
  const styles = parseCardStyles(card.fontSize);
  const cardStyle = {
    backgroundColor: styles.bgColor || '#ffffff',
    ...(hasBg ? {
      backgroundImage: `url(${card.bgImage})`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    } : {}),
  };

  return {
    hasBg,
    alignClass,
    styles,
    cardStyle,
    questionStyle: {
      ...(styles.qColor ? { color: styles.qColor } : {}),
      fontSize: `${styles.qSize}px`,
    },
    answerStyle: {
      ...(styles.aColor ? { color: styles.aColor } : {}),
      fontSize: `${styles.aSize}px`,
    },
  };
}

function CardActionPreview({ card }) {
  const {
    hasBg,
    alignClass,
    styles,
    cardStyle,
    questionStyle,
    answerStyle,
  } = getCardPresentation(card);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner dark:border-slate-700 dark:bg-slate-950/50">
      <article
        style={cardStyle}
        className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700"
        aria-label="Previsualización de la carta seleccionada"
      >
        {hasBg && <span className="absolute inset-0 bg-black/55" />}

        <div className="relative z-10 min-w-0 p-4 pt-6">
          <span className="absolute left-1/2 top-2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-slate-400/40" />

          <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
            Pregunta
          </p>
          <p
            style={questionStyle}
            className={`mt-1 line-clamp-6 min-w-0 whitespace-pre-wrap break-words ${alignClass} ${styles.qBold ? 'font-bold' : 'font-normal'} ${styles.qItalic ? 'italic' : ''} ${hasBg && !styles.qColor ? 'text-white' : 'text-slate-900'}`}
          >
            {card.question || 'Sin pregunta'}
          </p>

          {card.contentImage && card.imageSide === 'question' && (
            <img
              src={card.contentImage}
              alt="Imagen de la pregunta"
              className="mt-3 max-h-28 w-full rounded-xl border border-white/40 bg-white/90 object-contain p-1"
            />
          )}

          <div className={`my-3 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

          <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
            Respuesta
          </p>
          <p
            style={answerStyle}
            className={`mt-1 line-clamp-5 min-w-0 whitespace-pre-wrap break-words ${alignClass} ${styles.aBold ? 'font-bold' : 'font-normal'} ${styles.aItalic ? 'italic' : ''} ${hasBg && !styles.aColor ? 'text-white/90' : 'text-slate-700'}`}
          >
            {card.answer || 'Sin respuesta'}
          </p>

          {card.contentImage && card.imageSide === 'answer' && (
            <img
              src={card.contentImage}
              alt="Imagen de la respuesta"
              className="mt-3 max-h-28 w-full rounded-xl border border-white/40 bg-white/90 object-contain p-1"
            />
          )}
        </div>
      </article>
    </div>
  );
}

export default function FlashcardGrid({ cards, onEdit, onDelete }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [actionCard, setActionCard] = useState(null);
  
  if (cards.length === 0) {
    return (
      <div className="mt-4 text-center border border-dashed border-slate-300 rounded-2xl py-10 text-slate-400">
        <Layers className="w-6 h-6 mx-auto mb-1.5" />
        Aún no hay tarjetas en este mazo.
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
      {cards.map((card) => {
        const {
          hasBg,
          alignClass,
          styles,
          cardStyle,
          questionStyle,
          answerStyle,
        } = getCardPresentation(card);

        return (
          <article key={card.id} style={cardStyle} className="relative min-w-0 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between dark:border-slate-700">
            {hasBg && <span className="absolute inset-0 bg-black/55" />}

            <div className="relative z-10 min-w-0 p-3 pt-5 sm:p-4 sm:pt-6">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-full bg-slate-400/40" />
              
              {(typeof onEdit === 'function' || typeof onDelete === 'function') && (
                <div className="mb-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActionCard(card)}
                    aria-label="Abrir acciones de la carta"
                    aria-haspopup="dialog"
                    className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors ${hasBg ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* SECCIÓN PREGUNTA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                  Pregunta
                </p>
                {card.contentImage && card.imageSide === 'question' && (
                  <button 
                    type="button"
                    onClick={() => setImagePreview({ title: 'Imagen de la Pregunta', src: card.contentImage })}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-normal uppercase border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                      hasBg ? 'bg-white/20 text-white border-white/20 hover:bg-white/30' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    <Image className="w-2.5 h-2.5 shrink-0" /> Ver Imagen
                  </button>
                )}
              </div>
              
              <p style={questionStyle} className={`mt-1 line-clamp-3 min-w-0 break-words whitespace-pre-wrap ${alignClass} ${styles.qBold ? 'font-bold' : 'font-normal'} ${styles.qItalic ? 'italic' : ''} ${hasBg && !styles.qColor ? 'text-white' : 'text-slate-900'}`}>
                {card.question}
              </p>

              <div className={`my-3 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

              {/* SECCIÓN RESPUESTA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                  Respuesta
                </p>
                {card.contentImage && card.imageSide === 'answer' && (
                  <button 
                    type="button"
                    onClick={() => setImagePreview({ title: 'Imagen de la Respuesta', src: card.contentImage })}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-normal uppercase border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                      hasBg ? 'bg-white/20 text-white border-white/20 hover:bg-white/30' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    <Image className="w-2.5 h-2.5 shrink-0" /> Ver Imagen
                  </button>
                )}
              </div>

              <p style={answerStyle} className={`mt-1 line-clamp-2 min-w-0 break-words whitespace-pre-wrap ${alignClass} ${styles.aBold ? 'font-bold' : 'font-normal'} ${styles.aItalic ? 'italic' : ''} ${hasBg && !styles.aColor ? 'text-white/90' : 'text-slate-700'}`}>
                {card.answer}
              </p>
            </div>
          </article>
        );
      })}

      {/* MENÚ DE ACCIONES DE LA CARTA */}
      {actionCard && (
        <ActionSheet
          open
          title="Vista de la carta"
          compact
          onClose={() => setActionCard(null)}
          options={[
            typeof onEdit === 'function' && {
              id: 'edit-card',
              icon: Pencil,
              label: 'Editar',
              onSelect: () => onEdit(actionCard),
            },
            typeof onDelete === 'function' && {
              id: 'delete-card',
              icon: Trash2,
              label: 'Borrar',
              danger: true,
              onSelect: () => onDelete(actionCard),
            },
            {
              id: 'cancel-card-actions',
              icon: X,
              label: 'Cancelar',
            },
          ].filter(Boolean)}
        >
          <CardActionPreview card={actionCard} />
        </ActionSheet>
      )}

      {/* LIGHTBOX MODAL FLOTANTE */}
      {imagePreview && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label={imagePreview.title}
          onClick={() => setImagePreview(null)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-[fadeIn_0.15s_ease]"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-[scaleIn_0.15s_ease-out]"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-slate-400" /> {imagePreview.title}
              </span>
              <button 
                type="button" 
                onClick={() => setImagePreview(null)}
                aria-label="Cerrar imagen"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-6 bg-slate-100/40 flex justify-center items-center min-h-[220px]">
              <img 
                src={imagePreview.src} 
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

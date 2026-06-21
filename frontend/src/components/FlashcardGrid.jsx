import { Pencil, Trash2, Layers } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

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
        const sizeClass = card.fontSize || 'text-base';
        const cardStyle = hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

        return (
          <div key={card.id} style={cardStyle} className="relative rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-white">
            {hasBg && <span className="absolute inset-0 bg-black/55" />}

            <div className="relative z-10 p-4 pt-6">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-full bg-slate-400/40" />
              <div className="flex justify-end gap-1 mb-1">
                <button onClick={() => onEdit(card)} className={`p-1.5 rounded-lg ${hasBg ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(card)} className={`p-1.5 rounded-lg ${hasBg ? 'text-red-300 hover:bg-white/20' : 'text-red-600 hover:bg-red-50'}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className={`text-[10px] font-semibold uppercase tracking-wide ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>Pregunta</p>
              <p className={`mt-0.5 font-semibold whitespace-pre-wrap ${sizeClass} ${alignClass} ${hasBg ? 'text-white' : 'text-slate-900'}`}>{card.question}</p>

              <div className={`my-3 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

              <p className={`text-[10px] font-semibold uppercase tracking-wide ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>Respuesta</p>
              <p className={`mt-0.5 whitespace-pre-wrap ${sizeClass} ${alignClass} ${hasBg ? 'text-white/90' : 'text-slate-700'}`}>{card.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

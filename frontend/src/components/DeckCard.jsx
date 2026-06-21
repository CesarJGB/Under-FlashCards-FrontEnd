import { Pencil, Trash2, Layers } from 'lucide-react';

const isDark = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};

export default function DeckCard({ deck, onOpen, onEdit, onDelete }) {
  const dark = deck.coverImage ? true : isDark(deck.coverColor);
  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor };

  return (
    <button
      onClick={() => onOpen(deck)}
      style={bgStyle}
      className="group relative text-left h-44 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <span className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-black/15" />
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onEdit(deck); }}
          className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white"
        >
          <Pencil className="w-3.5 h-3.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(deck); }}
          className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-bold text-white drop-shadow">
          {deck.title}
        </p>
        <p className="text-xs text-white/80">
          {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
        </p>
      </div>

      {!deck.coverImage && !dark && (
        <span className="absolute top-4 left-4 text-slate-900/30">
          <Layers className="w-6 h-6" />
        </span>
      )}
    </button>
  );
}

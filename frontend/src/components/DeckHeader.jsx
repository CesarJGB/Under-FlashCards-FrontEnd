import { ArrowLeft, Download, Layers, Pencil, BookOpen } from 'lucide-react';

export default function DeckHeader({ deck, mode, setMode, onBack, onExport }) {
  const isDark = (hex) => {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 140;
  };

  const headerDark = deck.coverImage || isDark(deck.coverColor);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la Biblioteca
        </button>
        {mode === 'edit' && (
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar mazo
          </button>
        )}
      </div>

      {mode === 'edit' && (
        <div
          className="mt-3 rounded-2xl p-5 border border-slate-200"
          style={
            deck.coverImage
              ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { backgroundColor: deck.coverColor }
          }
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${
              headerDark ? 'bg-white/85 text-slate-900' : 'bg-slate-900/10 text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Mazo
          </span>
          <h2 className={`mt-1.5 text-xl font-extrabold drop-shadow ${headerDark ? 'text-white' : 'text-slate-900'}`}>
            {deck.title}
          </h2>
        </div>
      )}

      <div className="mt-4 w-full max-w-xl mx-auto flex justify-center px-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Pencil className="w-4 h-4" /> Modo Edición
          </button>
          <button
            type="button"
            onClick={() => setMode('review')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'review' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Modo Repaso
          </button>
        </div>
      </div>
    </>
  );
}

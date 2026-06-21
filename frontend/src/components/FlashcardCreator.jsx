import { SlidersHorizontal, ImagePlus, Check, Plus, Loader2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const FONT_SIZES = [
  { label: 'Pequeña', value: 'text-sm' },
  { label: 'Normal', value: 'text-base' },
  { label: 'Grande', value: 'text-lg' },
  { label: 'Extra Grande', value: 'text-xl' },
];

const ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];

export default function FlashcardCreator({
  question, setQuestion, answer, setAnswer,
  bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles,
  isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel
}) {
  
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

  return (
    <form onSubmit={onSubmit} className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
        <p className="text-sm font-bold text-slate-700">
          {editingId ? 'Editar tarjeta' : isBulk ? 'Creación masiva por bloque de texto' : 'Nueva tarjeta'}
        </p>
        {!editingId && (
          <button
            type="button"
            onClick={() => { setIsBulk(!isBulk); setError(''); }}
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
          <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
            * Cada par de bloques <code className="bg-slate-100 px-1 rounded font-mono">P:</code> y <code className="bg-slate-100 px-1 rounded font-mono">R:</code> generará una tarjeta de forma automática.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 animate-[fadeIn_0.2s_ease]">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pregunta</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="¿Cuál es la capital de Francia?"
              className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Respuesta</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="París"
              className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowStyles((s) => !s)}
        className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Opciones de estilo {isBulk && '(Se aplicarán a todo el lote)'}
      </button>

      {showStyles && (
        <div className="mt-3 grid sm:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Tamaño de letra</p>
            <div className="flex flex-wrap gap-1">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFontSize(f.value)}
                  className={`rounded-lg px-2 py-1 text-xs font-medium border transition-colors ${
                    fontSize === f.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Alineación</p>
            <div className="flex gap-1">
              {ALIGNS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setTextAlign(value)}
                  className={`rounded-lg p-1.5 border transition-colors ${
                    textAlign === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Fondo</p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                <ImagePlus className="w-3.5 h-3.5" /> Imagen
                <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
              </label>
              {bgImage && (
                <button type="button" onClick={() => setBgImage('')} className="text-xs text-red-600 hover:underline">
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving || (isBulk ? !bulkText.trim() : (!question.trim() || !answer.trim()))}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {editingId ? 'Guardar cambios' : isBulk ? 'Generar lote de tarjetas' : 'Agregar tarjeta'}
        </button>
        {editingId && (
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

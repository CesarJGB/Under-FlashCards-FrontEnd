import { SlidersHorizontal, ImagePlus, Check, Plus, Loader2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Palette } from 'lucide-react';

const SIZES = [
  { label: 'Sm', value: 'text-sm' },
  { label: 'Base', value: 'text-base' },
  { label: 'Lg', value: 'text-lg' },
  { label: 'Xl', value: 'text-xl' },
  { label: '2Xl', value: 'text-2xl' },
];

const ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];

// Paleta de colores sugeridos estilo Tailwind
const SWATCHES = [
  { label: 'Predeterminado', value: '' },
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Oro', value: '#f59e0b' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Azul', value: '#3b82f6' },
];

export default function FlashcardCreator({
  question, setQuestion, answer, setAnswer,
  bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles,
  isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel
}) {

  // 🧠 DESEMPAQUETADOR MÁGICO: Lee el JSON de fontSize o aplica el fallback predeterminado
  const parseCurrentStyles = () => {
    if (fontSize && fontSize.startsWith('{')) {
      try { return JSON.parse(fontSize); } catch (e) {}
    }
    // Estado inicial de fábrica si es una tarjeta limpia o antigua
    return {
      qSize: fontSize || 'text-base', qBold: true, qItalic: false, qColor: '',
      aSize: fontSize || 'text-base', aBold: false, aItalic: false, aColor: ''
    };
  };

  const styles = parseCurrentStyles();

  // Guarda los cambios empaquetándolos de nuevo en la cadena de texto de fontSize
  const updateStyle = (key, value) => {
    const updated = { ...styles, [key]: value };
    setFontSize(JSON.stringify(updated));
  };

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

  // Sub-componente interno para no duplicar código de renderizado de controles
  const renderStyleGroup = (title, prefix) => {
    const sizeKey = `${prefix}Size`;
    const boldKey = `${prefix}Bold`;
    const italicKey = `${prefix}Italic`;
    const colorKey = `${prefix}Color`;

    return (
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</p>
        
        {/* Tamaño y Tipografía */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {SIZES.map((s) => (
              <button
                key={s.value} type="button"
                onClick={() => updateStyle(sizeKey, s.value)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  styles[sizeKey] === s.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <button
              type="button" onClick={() => updateStyle(boldKey, !styles[boldKey])}
              className={`p-1.5 rounded-lg border transition-colors ${styles[boldKey] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button" onClick={() => updateStyle(italicKey, !styles[italicKey])}
              className={`p-1.5 rounded-lg border transition-colors ${styles[italicKey] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Muestras de Color */}
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase mb-1 flex items-center gap-1"><Palette className="w-3 h-3" /> Color del texto</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c.value} type="button" title={c.label}
                onClick={() => updateStyle(colorKey, c.value)}
                style={c.value ? { backgroundColor: c.value } : {}}
                className={`w-5 h-5 rounded-full border transition-all ${
                  styles[colorKey] === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : 'border-slate-300 hover:scale-105'
                } ${!c.value ? 'bg-linear-to-br from-slate-200 to-slate-400 relative after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-[8px] after:text-slate-700 after:content-["×"]' : ''}`}
              />
            ))}
            {/* Color personalizado nativo */}
            <label className="w-5 h-5 rounded-full border border-slate-300 cursor-pointer overflow-hidden relative bg-linear-to-tr from-amber-400 via-rose-400 to-indigo-400 shrink-0">
              <input 
                type="color" 
                value={styles[colorKey] && styles[colorKey].startsWith('#') ? styles[colorKey] : '#ffffff'} 
                onChange={(e) => updateStyle(colorKey, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer scale-150" 
              />
            </label>
          </div>
        </div>
      </div>
    );
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
        Configuración de Estilo Avanzada
      </button>

      {showStyles && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-4 animate-[fadeIn_0.15s_ease]">
          {/* Fila Global: Alineación y Imagen de Fondo */}
          <div className="grid grid-cols-2 gap-4 bg-slate-100/50 p-3 rounded-xl border border-slate-200/40">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Alineación del Mazo</p>
              <div className="flex gap-1">
                {ALIGNS.map(({ value, label, Icon }) => (
                  <button
                    key={value} type="button" title={label}
                    onClick={() => setTextAlign(value)}
                    className={`rounded-lg p-1.5 border transition-colors ${textAlign === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Fondo de Tarjeta</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-xs">
                  <ImagePlus className="w-3.5 h-3.5 text-slate-500" /> <span>Imagen</span>
                  <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
                </label>
                {bgImage && (
                  <button type="button" onClick={() => setBgImage('')} className="text-xs text-red-600 hover:underline">Quitar</button>
                )}
              </div>
            </div>
          </div>

          {/* Fila Dividida: Controles de Pregunta vs Respuesta */}
          <div className="grid sm:grid-cols-2 gap-3">
            {renderStyleGroup('Estilo de la Pregunta', 'q')}
            {renderStyleGroup('Estilo de la Respuesta', 'a')}
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

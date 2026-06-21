import { useState } from 'react';
import { X, ImagePlus, Loader2, Check } from 'lucide-react';

const COLOR_SWATCHES = [
  '#ffffff', '#fde68a', '#fca5a5', '#a7f3d0',
  '#93c5fd', '#c4b5fd', '#f9a8d4', '#1f2937',
];

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DeckModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [coverColor, setCoverColor] = useState(initial?.coverColor || '#ffffff');
  const [coverImage, setCoverImage] = useState(initial?.coverImage || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setError('La imagen es muy grande (máx. 1.5MB).');
      return;
    }
    setError('');
    setCoverImage(await fileToBase64(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), coverColor, coverImage });
    } catch (err) {
      setError(err.message || 'No se pudo guardar el mazo.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">
            {initial ? 'Editar mazo' : 'Nuevo mazo'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Biología 101"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />

          <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Color de portada</label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverColor(c)}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full border ${
                  coverColor === c ? 'ring-2 ring-offset-2 ring-slate-900' : 'border-slate-200'
                }`}
              />
            ))}
            <input
              type="color"
              value={coverColor}
              onChange={(e) => setCoverColor(e.target.value)}
              className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border border-slate-200"
            />
          </div>

          <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Imagen de portada (opcional)</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <ImagePlus className="w-4 h-4" />
              Subir
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
            {coverImage && (
              <div className="flex items-center gap-2">
                <img src={coverImage} alt="portada" className="w-10 h-10 rounded-lg object-cover" />
                <button type="button" onClick={() => setCoverImage('')} className="text-xs text-red-600 hover:underline">
                  Quitar
                </button>
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

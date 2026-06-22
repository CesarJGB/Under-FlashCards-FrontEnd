// ARCHIVO: frontend/src/components/creator/StylePanel.jsx
import { useState } from 'react';
import { ImagePlus, Plus, Minus, Bold, Italic, Palette, Pipette } from 'lucide-react';

export default function StylePanel({ ALIGNS, SWATCHES, textAlign, setTextAlign, bgImage, setBgImage, styles, updateStyle, handleBgFile }) {
  const [qColorOpen, setQColorOpen] = useState(false);
  const [aColorOpen, setAColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false); // Estado del selector de fondo sólida

  const renderStyleGroup = (title, prefix, colorOpen, setColorOpen) => {
    const sizeKey = `${prefix}Size`;
    const boldKey = `${prefix}Bold`;
    const italicKey = `${prefix}Italic`;
    const colorKey = `${prefix}Color`;
    const currentSizeNum = styles[sizeKey];

    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs relative">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
            <button type="button" onClick={() => updateStyle(sizeKey, Math.max(12, currentSizeNum - 1))} className="p-1 rounded-md hover:bg-white text-slate-600 transition-colors"><Minus className="w-3 h-3" /></button>
            <span className="text-[11px] font-extrabold text-slate-800 min-w-[32px] text-center font-mono">{currentSizeNum}px</span>
            <button type="button" onClick={() => updateStyle(sizeKey, Math.min(40, currentSizeNum + 1))} className="p-1 rounded-md hover:bg-white text-slate-600 transition-colors"><Plus className="w-3 h-3" /></button>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => updateStyle(boldKey, !styles[boldKey])} className={`p-1.5 rounded-lg border transition-colors ${styles[boldKey] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => updateStyle(italicKey, !styles[italicKey])} className={`p-1.5 rounded-lg border transition-colors ${styles[italicKey] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Italic className="w-3.5 h-3.5" /></button>
            
            <div className="relative">
              <button type="button" onClick={() => setColorOpen(!colorOpen)} style={styles[colorKey] ? { backgroundColor: styles[colorKey] } : {}} className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${styles[colorKey] ? 'text-white border-transparent shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Palette className="w-3.5 h-3.5" /></button>
              {colorOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setColorOpen(false)} />
                  <div className="absolute right-0 bottom-full mb-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xl z-40 grid grid-cols-4 gap-2 w-[168px] animate-[slideUp_0.1s_ease-out]">
                    {SWATCHES.map((c) => (
                      <button key={c.value} type="button" title={c.label} onClick={() => { updateStyle(colorKey, c.value); setColorOpen(false); }} style={c.value ? { backgroundColor: c.value } : {}} className={`w-8 h-8 rounded-xl border transition-all ${styles[colorKey] === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : 'border-slate-200 hover:scale-105'} ${!c.value ? 'bg-slate-100 relative after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"]' : ''}`} />
                    ))}
                    <label className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer overflow-hidden relative bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shrink-0 hover:scale-105 transition-transform flex items-center justify-center group shadow-xs">
                      <Pipette className="w-3.5 h-3.5 text-white drop-shadow-xs group-hover:scale-110 transition-transform relative z-10" />
                      <input type="color" value={styles[colorKey] && styles[colorKey].startsWith('#') ? styles[colorKey] : '#ffffff'} onChange={(e) => updateStyle(colorKey, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer scale-150 z-0" />
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 space-y-3 animate-[fadeIn_0.12s_ease]">
      <div className="grid grid-cols-2 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200/40">
        
        {/* Lado Izquierdo: Alineación */}
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 w-full">Alineación</p>
          <div className="flex gap-1 justify-center">
            {ALIGNS.map(({ value, label, Icon }) => (
              <button key={value} type="button" title={label} onClick={() => setTextAlign(value)} className={`rounded-lg p-1.5 border transition-colors ${textAlign === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}><Icon className="w-3.5 h-3.5" /></button>
            ))}
          </div>
        </div>
        
        {/* 🌟 Lado Derecho: Controles de Fondo Centrados con Corrección de Desplegable */}
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 w-full">Fondo</p>
          <div className="flex items-center justify-center gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-xs shrink-0">
              <ImagePlus className="w-3.5 h-3.5 text-slate-500" /> <span>Imagen</span>
              <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
            </label>
            {bgImage && <button type="button" onClick={() => setBgImage('')} className="text-xs text-red-600 hover:underline shrink-0">Quitar</button>}

            <div className="w-[1px] h-5 bg-slate-200 mx-0.5 shrink-0" />

            {/* Selector de Color de Fondo Sólido */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setBgColorOpen(!bgColorOpen)}
                style={styles.bgColor ? { backgroundColor: styles.bgColor } : {}}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                  styles.bgColor ? 'text-white border-transparent shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
                title="Color de fondo sólido"
              >
                <Palette className={`w-3.5 h-3.5 ${styles.bgColor ? 'drop-shadow-xs text-white' : ''}`} />
              </button>

              {bgColorOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBgColorOpen(false)} />
                  {/* 🚀 SOLUCIÓN: right-0 mt-2 orienta la caja de muestras hacia adentro de la carta */}
                  <div className="absolute right-0 mt-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xl z-40 grid grid-cols-4 gap-2 w-[168px] animate-[slideUp_0.1s_ease-out]">
                    {SWATCHES.map((c) => (
                      <button
                        key={c.value} 
                        type="button" 
                        title={c.label}
                        onClick={() => { updateStyle('bgColor', c.value); setBgColorOpen(false); }}
                        style={c.value ? { backgroundColor: c.value } : {}}
                        className={`w-8 h-8 rounded-xl border transition-all ${
                          styles.bgColor === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : 'border-slate-200 hover:scale-105'
                        } ${!c.value ? 'bg-slate-100 relative after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"]' : ''}`}
                      />
                    ))}
                    
                    <label className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer overflow-hidden relative bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shrink-0 hover:scale-105 transition-transform flex items-center justify-center group shadow-xs" title="Color personalizado">
                      <Pipette className="w-3.5 h-3.5 text-white drop-shadow-xs group-hover:scale-110 transition-transform relative z-10" />
                      <input 
                        type="color" 
                        value={styles.bgColor && styles.bgColor.startsWith('#') ? styles.bgColor : '#ffffff'} 
                        onChange={(e) => updateStyle('bgColor', e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer scale-150 z-0" 
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
      
      <div className="grid sm:grid-cols-2 gap-3">
        {renderStyleGroup('Estilo de la Pregunta', 'q', qColorOpen, setQColorOpen)}
        {renderStyleGroup('Estilo de la Respuesta', 'a', aColorOpen, setAColorOpen)}
      </div>
    </div>
  );
}

// ARCHIVO: frontend/src/components/creator/LivePreview.jsx
import { useState } from 'react';
import { ImagePlus, Palette, Pipette } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };
const FLOATING_CARD_WIDTH = 320;
const FLOATING_CARD_HEIGHT = 220;

export function CardFrame({ question, answer, bgImage, textAlign, styles, contentImage, imageSide, fixedSize = false }) {
  return (
    <div
      style={{
        backgroundColor: styles.bgColor || '#ffffff',
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...(fixedSize ? { width: FLOATING_CARD_WIDTH, height: FLOATING_CARD_HEIGHT } : {}),
      }}
      className={`relative rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col p-4 justify-center ${
        fixedSize ? '' : 'w-full max-w-[320px] min-h-[220px]'
      }`}
    >
      {bgImage && <span className="absolute inset-0 bg-black/55" />}
      <span className="absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full bg-slate-400/30 z-10" />

      <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0 py-2">
        <p className={`text-[8px] font-bold uppercase tracking-wide ${bgImage ? 'text-white/60' : 'text-slate-400'} ${ALIGN_CLASS[textAlign] || 'text-center'}`}>Pregunta</p>
        <p
          style={{ fontSize: `${styles.qSize}px`, ...(styles.qColor ? { color: styles.qColor } : {}) }}
          className={`mt-0.5 whitespace-pre-wrap truncate-3-lines ${ALIGN_CLASS[textAlign] || 'text-center'} ${styles.qBold ? 'font-bold' : 'font-normal'} ${styles.qItalic ? 'italic' : ''} ${bgImage && !styles.qColor ? 'text-white' : (!styles.qColor ? 'text-slate-900' : '')}`}
        >
          {question.trim() || 'Escribe tu pregunta...'}
        </p>

        {contentImage && imageSide === 'question' && (
          <div className="mt-2 flex justify-center">
            <img src={contentImage} alt="Preview P" className="max-h-24 rounded-lg object-contain border border-slate-200/60 bg-slate-50 p-0.5 shadow-2xs" />
          </div>
        )}

        <div className={`my-2.5 border-t border-dashed ${bgImage ? 'border-white/30' : 'border-slate-200'}`} />

        <p className={`text-[8px] font-bold uppercase tracking-wide ${bgImage ? 'text-white/60' : 'text-slate-400'} ${ALIGN_CLASS[textAlign] || 'text-center'}`}>Respuesta</p>
        <p
          style={{ fontSize: `${styles.aSize}px`, ...(styles.aColor ? { color: styles.aColor } : {}) }}
          className={`mt-0.5 whitespace-pre-wrap truncate-3-lines ${ALIGN_CLASS[textAlign] || 'text-center'} ${styles.aBold ? 'font-bold' : 'font-normal'} ${styles.aItalic ? 'italic' : ''} ${bgImage && !styles.aColor ? 'text-white/90' : (!styles.aColor ? 'text-slate-700' : '')}`}
        >
          {answer.trim() || 'Escribe tu respuesta...'}
        </p>

        {contentImage && imageSide === 'answer' && (
          <div className="mt-2 flex justify-center">
            <img src={contentImage} alt="Preview R" className="max-h-24 rounded-lg object-contain border border-slate-200/60 bg-slate-50 p-0.5 shadow-2xs" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LivePreview({
  question,
  answer,
  bgImage,
  setBgImage,
  textAlign,
  styles,
  contentImage,
  imageSide,
  ALIGNS,
  SWATCHES,
  setTextAlign,
  handleBgFile,
  updateStyle,
  variant = 'docked',
  floatingSize,
  showControls = true,
  previewOnly = false,
}) {
  const [bgColorOpen, setBgColorOpen] = useState(false);

  if (variant === 'floating') {
    const availableWidth = Math.max(120, floatingSize?.width || FLOATING_CARD_WIDTH);
    const availableHeight = Math.max(90, floatingSize?.height || FLOATING_CARD_HEIGHT);
    const scale = Math.min(1, availableWidth / FLOATING_CARD_WIDTH, availableHeight / FLOATING_CARD_HEIGHT);

    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100/70">
        <div style={{ width: FLOATING_CARD_WIDTH * scale, height: FLOATING_CARD_HEIGHT * scale }} className="shrink-0">
          <div style={{ width: FLOATING_CARD_WIDTH, height: FLOATING_CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <CardFrame
              question={question}
              answer={answer}
              bgImage={bgImage}
              textAlign={textAlign}
              styles={styles}
              contentImage={contentImage}
              imageSide={imageSide}
              fixedSize
            />
          </div>
        </div>
      </div>
    );
  }

  const isPreviewOnly = previewOnly || !showControls;

  return (
    <div className={isPreviewOnly
      ? 'rounded-2xl border border-slate-200 bg-slate-50/70 p-2 shadow-inner dark:border-slate-700 dark:bg-slate-900/50'
      : 'mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner animate-[fadeIn_0.15s_ease] dark:border-slate-700 dark:bg-slate-900/50'}
    >
      {!isPreviewOnly && (
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-700/60">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Previsualización en tiempo real</span>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        </div>
      )}

      <div className={isPreviewOnly
        ? 'flex justify-center rounded-xl border border-slate-200/40 bg-white/40 py-1 dark:border-slate-700/50 dark:bg-slate-800/40'
        : 'flex justify-center rounded-xl border border-slate-200/40 bg-white/40 py-2 dark:border-slate-700/50 dark:bg-slate-800/40'}
      >
        <CardFrame
          question={question}
          answer={answer}
          bgImage={bgImage}
          textAlign={textAlign}
          styles={styles}
          contentImage={contentImage}
          imageSide={imageSide}
        />
      </div>

      {showControls && (
      <div className="space-y-3 border-t border-slate-200/60 pt-1 dark:border-slate-700/60">
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-800">
          
          <div className="flex flex-col items-center justify-center text-center">
            <p className="mb-1.5 w-full text-[10px] font-bold uppercase tracking-wide text-slate-400">Alineación</p>
            <div className="flex justify-center gap-1">
              {ALIGNS.map(({ value, label, Icon }) => (
              <button key={value} type="button" title={label} aria-label={label} aria-pressed={textAlign === value} onClick={() => setTextAlign(value)} className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-colors ${textAlign === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Icon className="h-4 w-4" aria-hidden="true" /></button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-center">
            <p className="mb-1.5 w-full text-[10px] font-bold uppercase tracking-wide text-slate-400">Fondo mazo</p>
            <div className="flex items-center justify-center gap-1.5">
              <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                <ImagePlus className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" /> <span className="text-[11px]">Subir</span>
                <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
              </label>
              {bgImage && typeof setBgImage === 'function' && <button type="button" onClick={() => setBgImage('')} className="min-h-10 shrink-0 px-1 text-xs text-red-600 hover:underline dark:text-red-400">Borrar</button>}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBgColorOpen(!bgColorOpen)}
                  style={styles.bgColor ? { backgroundColor: styles.bgColor } : {}}
                  aria-label="Color de fondo sólido"
                  aria-expanded={bgColorOpen}
                  className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-all ${
                    styles.bgColor ? 'border-transparent text-white shadow-xs' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                {bgColorOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setBgColorOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 mt-2 z-40 grid w-[168px] grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-[slideUp_0.1s_ease-out] dark:border-slate-700 dark:bg-slate-800">
                      {SWATCHES.map((c) => (
                        <button key={c.value} type="button" title={c.label} aria-label={c.label} aria-pressed={styles.bgColor === c.value} onClick={() => { updateStyle('bgColor', c.value); setBgColorOpen(false); }} style={c.value ? { backgroundColor: c.value } : {}} className={`relative min-h-9 min-w-9 rounded-xl border transition-all ${styles.bgColor === c.value ? 'scale-110 ring-2 ring-slate-900 ring-offset-1 dark:ring-slate-100' : 'border-slate-200 hover:scale-105 dark:border-slate-600'} ${!c.value ? 'bg-slate-100 after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"] dark:bg-slate-700 dark:after:text-slate-300' : ''}`} />
                      ))}
                      <label className="relative flex min-h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shadow-xs transition-transform hover:scale-105 dark:border-slate-600">
                        <Pipette className="relative z-10 h-3.5 w-3.5 text-white drop-shadow-xs" aria-hidden="true" />
                        <input type="color" value={styles.bgColor && styles.bgColor.startsWith('#') ? styles.bgColor : '#ffffff'} onChange={(e) => updateStyle('bgColor', e.target.value)} className="absolute inset-0 z-0 scale-150 cursor-pointer opacity-0" aria-label="Elegir color de fondo" />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
      )}
    </div>
  );
}

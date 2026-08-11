import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Palette, Wand2, X } from 'lucide-react';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { getMateriaColor, hexToRgba, MATERIA_PALETTE } from '../../lib/materiaColors';
import {
  getAutomaticMateriaIconId,
  getMateriaIconLabel,
  isValidMateriaIconId,
  MATERIA_ICON_MAP,
  MATERIA_ICON_OPTIONS,
} from '../../lib/materiaIcons';

function CustomizationButton({ title, subtitle, preview, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[68px] w-full items-center justify-between rounded-2xl border-2 border-slate-200 p-3.5 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-zinc-700 dark:hover:border-indigo-500/60 dark:hover:bg-zinc-800"
    >
      <div className="flex min-w-0 items-center gap-3">
        {preview}
        <div className="min-w-0 text-left">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  );
}

function BackHeader({ title, onBack }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver a la edición de la materia"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-all duration-200 hover:bg-slate-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 active:scale-95 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
      </button>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
    </div>
  );
}

export default function AcademicFolderModal({
  academicModal, academicInput, setAcademicInput,
  academicColor, setAcademicColor,
  academicIcon, setAcademicIcon,
  setAcademicModal, handleCreateAcademicFolder, handleUpdateAcademicFolder,
}) {
  const keyboardHeight = useKeyboardHeight();
  const inputRef = useRef(null);
  const [step, setStep] = useState('main'); // 'main' | 'color' | 'icon'

  const isEditing = !!academicModal?.editing;
  const isMateria = academicModal?.type === 'materia';
  const canPickColor = isMateria && typeof setAcademicColor === 'function';
  const canPickIcon = isMateria && typeof setAcademicIcon === 'function';

  const previewAccent = useMemo(
    () => academicColor || getMateriaColor({ name: academicInput || 'Materia' }),
    [academicColor, academicInput]
  );
  const previewIconId = academicIcon || getAutomaticMateriaIconId(academicInput);
  const PreviewIcon = MATERIA_ICON_MAP[previewIconId] || MATERIA_ICON_MAP.generic;

  const handleClose = useCallback(() => {
    setAcademicModal(null);
    setAcademicInput('');
    if (typeof setAcademicColor === 'function') setAcademicColor(null);
    if (typeof setAcademicIcon === 'function') setAcademicIcon(null);
  }, [setAcademicColor, setAcademicIcon, setAcademicInput, setAcademicModal]);

  useEffect(() => {
    setStep('main');
    setAcademicInput(academicModal?.editing?.name || '');
    if (typeof setAcademicColor === 'function') {
      setAcademicColor(academicModal?.editing?.color || null);
    }
    if (typeof setAcademicIcon === 'function') {
      const editingIcon = academicModal?.editing?.icon;
      setAcademicIcon(isValidMateriaIconId(editingIcon) ? editingIcon : null);
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicModal]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (step === 'main') handleClose();
        else setStep('main');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleClose, step]);

  const getTypeName = (type) => {
    const names = { materia: 'materia', tema: 'tema', subtema: 'subtema' };
    return names[type] || 'carpeta';
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!academicInput.trim()) return;

    if (isEditing && handleUpdateAcademicFolder) {
      handleUpdateAcademicFolder(event);
    } else {
      handleCreateAcademicFolder(event);
    }
  };

  const typeName = getTypeName(academicModal?.type);
  const mainTitle = isEditing ? `Editar ${typeName}` : `Crear nueva ${typeName}`;
  const hideCreateMateriaHeader = isMateria && !isEditing;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-slate-900/40 animate-[fadeIn_0.2s_ease]"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-4"
        style={{ paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0' }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={step === 'main' ? mainTitle : step === 'color' ? 'Color de la materia' : 'Icono de la materia'}
          className="pointer-events-auto max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] dark:bg-zinc-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-6 pb-6 pt-5">
            {step === 'main' && (
              <div className="animate-[fadeIn_0.2s_ease]">
                {hideCreateMateriaHeader ? (
                  <div className="-mb-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      aria-label="Cerrar"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition-all duration-200 hover:bg-slate-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 active:scale-95 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <X className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 pt-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{mainTitle}</h3>
                      {!isMateria && (
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                          {isEditing ? 'Modifica esta carpeta' : 'Ingresa un nombre para organizar tu contenido'}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      aria-label="Cerrar"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-all duration-200 hover:bg-slate-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 active:scale-95 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <X className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="academic-folder-name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Nombre
                    </label>
                    <input
                      id="academic-folder-name"
                      ref={inputRef}
                      type="text"
                      required
                      placeholder={`Ej: Matemáticas ${typeName === 'materia' ? 'Avanzadas' : '1'}`}
                      value={academicInput}
                      onChange={(event) => setAcademicInput(event.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      autoCapitalize="off"
                      enterKeyHint="done"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-medium transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900"
                    />
                  </div>

                  {canPickColor && (
                    <CustomizationButton
                      title="Color de la materia"
                      subtitle={academicColor ? 'Color personalizado' : 'Automático'}
                      onClick={() => setStep('color')}
                      preview={(
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: previewAccent }}
                        >
                          {academicColor
                            ? <Palette className="h-5 w-5 text-white" aria-hidden="true" />
                            : <Wand2 className="h-5 w-5 text-white" aria-hidden="true" />}
                        </div>
                      )}
                    />
                  )}

                  {canPickIcon && (
                    <CustomizationButton
                      title="Icono de la materia"
                      subtitle={academicIcon ? getMateriaIconLabel(academicIcon) : 'Automático'}
                      onClick={() => setStep('icon')}
                      preview={(
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: previewAccent }}
                        >
                          <PreviewIcon className="h-[18px] w-[18px] text-white" strokeWidth={2.2} aria-hidden="true" />
                        </div>
                      )}
                    />
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="h-12 flex-1 cursor-pointer rounded-2xl border-2 border-slate-200 font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 active:scale-[0.98] dark:border-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="h-12 flex-1 cursor-pointer rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:scale-[0.98]"
                    >
                      {isEditing ? 'Guardar cambios' : `Crear ${typeName}`}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {step === 'color' && canPickColor && (
              <div className="animate-[fadeIn_0.2s_ease]">
                <BackHeader title="Color de la materia" onBack={() => setStep('main')} />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="grid grid-cols-4 gap-2">
                    {[null, ...MATERIA_PALETTE].map((color) => {
                      const isSelected = (academicColor || null) === color;
                      return (
                        <button
                          key={color ?? 'auto'}
                          type="button"
                          onClick={() => setAcademicColor(color)}
                          aria-label={color ? `Usar color ${color}` : 'Usar color automático'}
                          aria-pressed={isSelected}
                          style={color ? { backgroundColor: color } : undefined}
                          className={`flex h-12 w-12 items-center justify-center justify-self-center rounded-xl border-2 transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 ${
                            color ? '' : 'bg-slate-200 dark:bg-zinc-700'
                          } ${
                            isSelected
                              ? 'scale-105 border-white ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-800'
                              : 'border-white hover:scale-105 dark:border-zinc-800'
                          }`}
                        >
                          {!color && <Wand2 className="h-4 w-4 text-slate-600 dark:text-slate-200" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3 dark:border-zinc-700">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <input
                        type="color"
                        value={academicColor || '#6366F1'}
                        onChange={(event) => setAcademicColor(event.target.value)}
                        className="h-7 w-7 cursor-pointer rounded border border-slate-300 dark:border-zinc-600"
                      />
                      Color personalizado
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('main')}
                  className="mt-4 h-12 w-full cursor-pointer rounded-2xl bg-slate-900 font-semibold text-white transition-all duration-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  Listo
                </button>
              </div>
            )}

            {step === 'icon' && canPickIcon && (
              <div className="animate-[fadeIn_0.2s_ease]">
                <BackHeader title="Icono de la materia" onBack={() => setStep('main')} />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => setAcademicIcon(null)}
                      aria-label="Usar icono automático"
                      aria-pressed={academicIcon === null}
                      title="Automático"
                      style={academicIcon === null ? {
                        borderColor: previewAccent,
                        boxShadow: `0 0 0 2px ${hexToRgba(previewAccent, 0.25)}`,
                        color: previewAccent,
                      } : { color: previewAccent }}
                      className="flex aspect-square min-h-12 items-center justify-center rounded-xl border-2 border-slate-200 bg-white transition-all duration-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-700"
                    >
                      <Wand2 className="h-5 w-5" aria-hidden="true" />
                    </button>

                    {MATERIA_ICON_OPTIONS.map(({ id, label, Icon }) => {
                      const isSelected = academicIcon === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setAcademicIcon(id)}
                          aria-label={`Usar icono de ${label}`}
                          aria-pressed={isSelected}
                          title={label}
                          style={isSelected ? {
                            borderColor: previewAccent,
                            boxShadow: `0 0 0 2px ${hexToRgba(previewAccent, 0.25)}`,
                            color: previewAccent,
                          } : { color: previewAccent }}
                          className="flex aspect-square min-h-12 items-center justify-center rounded-xl border-2 border-slate-200 bg-white transition-all duration-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-700"
                        >
                          <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('main')}
                  className="mt-4 h-12 w-full cursor-pointer rounded-2xl bg-slate-900 font-semibold text-white transition-all duration-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

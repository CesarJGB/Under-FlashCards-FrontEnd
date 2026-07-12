// FILE: frontend/src/components/library/info/PublicProfileCard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  ExternalLink,
  Link2,
  Loader2,
  QrCode,
  Share2,
  MoreHorizontal // 👈 Agregado para el menú de los 3 puntos
} from 'lucide-react';
import { setJSON } from '../../../lib/safeLocalStorage';
import { buildPublicMateriaUrl } from '../../../lib/publicMateria';
import PublicMateriaPreviewDialog from './PublicMateriaPreviewDialog';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function sanitizeFileName(value) {
  return String(value || 'materia')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'materia';
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export default function PublicProfileCard({ materia, materias, setMaterias, userId }) {
  const [isActivating, setIsActivating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewShareId, setPreviewShareId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showInfo, setShowInfo] = useState(false); // 👈 Estado para el menú desplegable de información

  const shareId = materia?.publicProfile?.shareId || null;
  const isPublicEnabled = !!materia?.publicProfile?.enabled;
  const publicUrl = useMemo(
    () => (isPublicEnabled ? buildPublicMateriaUrl(shareId) : ''),
    [isPublicEnabled, shareId]
  );
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!feedback) return undefined;

    const timeoutId = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    setPreviewShareId(shareId || '');
  }, [shareId]);

  useEffect(() => {
    if (!publicUrl) {
      setQrDataUrl('');
      setQrLoading(false);
      return;
    }

    let cancelled = false;

    const generateQr = async () => {
      setQrLoading(true);

      try {
        const qrModule = await import('qrcode');
        const QRCode = qrModule.default || qrModule;
        const dataUrl = await QRCode.toDataURL(publicUrl, {
          width: 360,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setQrDataUrl('');
          setFeedback({ tone: 'error', message: 'No se pudo generar el QR.' });
        }
      } finally {
        if (!cancelled) {
          setQrLoading(false);
        }
      }
    };

    generateQr();

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const persistUpdatedMateria = (updatedMateria) => {
    const nextMaterias = materias.map((item) =>
      String(item._id || item.id) === String(updatedMateria._id || updatedMateria.id)
        ? { ...item, ...updatedMateria }
        : item
    );

    setMaterias(nextMaterias);
    try {
      setJSON(`materias_${userId}`, nextMaterias);
    } catch (err) {
      console.error('[PublicProfileCard] Error persisting materias cache:', err);
    }
  };

  const requestPublicProfile = async () => {
    const materiaId = materia?._id || materia?.id;
    if (!materiaId) {
      throw new Error('No se encontro la materia que quieres compartir.');
    }

    const res = await fetch(`${BACKEND_URL}/api/academic/materias/${materiaId}/public-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      }
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.materia) {
      throw new Error(body.error || 'No se pudo activar el perfil publico.');
    }

    persistUpdatedMateria(body.materia);
    return body.materia;
  };

  const handleActivatePublicProfile = async () => {
    if (isActivating) return;

    setIsActivating(true);
    setFeedback(null);

    try {
      const updatedMateria = await requestPublicProfile();
      setPreviewShareId(updatedMateria?.publicProfile?.shareId || '');
      setFeedback({ tone: 'success', message: 'Enlace publico generado. Ya puedes compartirlo.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message || 'No se pudo generar el enlace.' });
    } finally {
      setIsActivating(false);
    }
  };

  const handleOpenPreview = async () => {
    if (previewOpen) return;

    let resolvedShareId = previewShareId || shareId;

    if (!resolvedShareId) {
      if (isActivating) return;

      setIsActivating(true);
      setFeedback(null);

      try {
        const updatedMateria = await requestPublicProfile();
        resolvedShareId = updatedMateria?.publicProfile?.shareId || '';
        setPreviewShareId(resolvedShareId);
        setFeedback({ tone: 'success', message: 'Vista previa lista. Asi se vera la materia compartida.' });
      } catch (err).antano {
        setFeedback({ tone: 'error', message: err.message || 'No se pudo abrir la vista previa.' });
        return;
      } finally {
        setIsActivating(false);
      }
    }

    if (!resolvedShareId) return;
    setPreviewShareId(resolvedShareId);
    setPreviewOpen(true);
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;

    try {
      await copyToClipboard(publicUrl);
      setFeedback({ tone: 'success', message: 'Enlace copiado al portapapeles.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: 'No se pudo copiar el enlace.' });
    }
  };

  const handleNativeShare = async () => {
    if (!publicUrl || !canUseNativeShare) return;

    try {
      await navigator.share({
        title: `Perfil de ${materia?.name || 'materia'}`,
        text: `Resumen publico de ${materia?.name || 'esta materia'}`,
        url: publicUrl
      });
      setFeedback({ tone: 'success', message: 'Compartido correctamente.' });
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setFeedback({ tone: 'error', message: 'No se pudo abrir el menu de compartir.' });
      }
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;

    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = `qr-${sanitizeFileName(materia?.name)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setFeedback({ tone: 'success', message: 'QR descargado.' });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-xs">
      
      {/* 🔗 TÍTULO E ÍCONO ALINEADOS HORIZONTALMENTE (Subtítulo eliminado permanentemente) */}
      <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 shrink-0">
          <Link2 className="w-5 h-5" />
        </div>
        <h4 className="font-bold text-slate-950 dark:text-slate-50 text-base leading-none">
          Perfil publico de la materia
        </h4>
      </div>

      {/* 📝 DESCRIPCIÓN INICIAL (Se elimina dinámicamente al generar el link) */}
      {!publicUrl && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Genera un enlace publico de solo lectura para compartir el panorama general de esta materia. Tambien puedes descargar un QR que abra la pagina publica directamente.
        </p>
      )}

      {!publicUrl ? (
        /* 🔘 ESTADO INICIAL: Mantiene exactamente 2 botones alineados */
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleActivatePublicProfile}
            disabled={isActivating}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isActivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            {isActivating ? 'Generando...' : 'Generar enlace'}
          </button>

          <button
            type="button"
            onClick={handleOpenPreview}
            disabled={isActivating}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-70 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isActivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            {isActivating ? 'Preparando...' : 'Vista previa'}
          </button>
        </div>
      ) : (
        <>
          {/* 🔍 APARTADO DE URL PÚBLICA COMPACTO CON MENÚ FLOTANTE DE 3 PUNTOS */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold flex items-center justify-between relative">
              <span>URL publica</span>
              
              {/* Contenedor del Botón de 3 Puntos */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowInfo(!showInfo)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* Menú contextual flotante que aloja la información oculta */}
                {showInfo && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowInfo(false)} />
                    <div className="absolute right-0 top-6 z-20 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl p-3 text-[11px] text-slate-500 dark:text-slate-400 normal-case font-normal leading-normal animate-[fadeIn_0.1s_ease]">
                      Cualquier persona con este enlace puede abrir la pagina publica y ver el resumen general de la materia.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fila del QR y Enlace (Alineados al centro horizontalmente) */}
            <div className="flex items-center gap-3">
              {qrLoading ? (
                <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR de ${materia?.name || 'la materia'}`}
                  className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white p-1.5 shrink-0 object-contain"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500">
                  <QrCode className="w-4 h-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60 line-clamp-2 select-all">
                  {publicUrl}
                </p>
              </div>
            </div>
          </div>

          {/* 🔘 ESTADO ACTIVO: Cuadrícula simétrica estricta de 2 columnas (Grid 2x2 / 2x3) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenPreview}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Vista previa
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar enlace
            </button>

            <button
              type="button"
              onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir pagina
            </button>

            {canUseNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar QR
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
              : 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40'
          }`}
        >
          {feedback.tone === 'success' ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {feedback.message}
        </div>
      )}

      <PublicMateriaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        shareId={previewShareId || shareId}
        materiaName={materia?.name}
      />
    </div>
  );
}

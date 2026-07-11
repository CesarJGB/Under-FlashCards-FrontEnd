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
  Share2
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
      } catch (err) {
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
      <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
          <Link2 className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-slate-950 dark:text-slate-50">Perfil publico de la materia</h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            Comparte resumen y estadisticas sin pedir inicio de sesion
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Genera un enlace publico de solo lectura para compartir el panorama general de esta materia. Tambien puedes descargar un QR que abra la pagina publica directamente.
      </p>

      {!publicUrl ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleActivatePublicProfile}
            disabled={isActivating}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            {isActivating ? 'Generando enlace...' : 'Generar enlace publico'}
          </button>

          <button
            type="button"
            onClick={handleOpenPreview}
            disabled={isActivating}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-70 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            {isActivating ? 'Preparando preview...' : 'Vista previa'}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">
              URL publica
            </div>
            <div className="flex items-start gap-3">
              {qrLoading ? (
                <div className="w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR de ${materia?.name || 'la materia'}`}
                  className="w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white p-2 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500">
                  <QrCode className="w-5 h-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-all">{publicUrl}</p>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Cualquier persona con este enlace puede abrir la pagina publica y ver el resumen general de la materia.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenPreview}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Vista previa
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              Copiar enlace
            </button>

            <button
              type="button"
              onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir pagina
            </button>

            {canUseNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Compartir
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
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

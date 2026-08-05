function isIOSBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function normalizePdfDownloadFileName(fileName) {
  const candidate = String(fileName ?? '').trim();
  if (!candidate) return 'Horario.pdf';
  return candidate.toLowerCase().endsWith('.pdf') ? candidate : `${candidate}.pdf`;
}

/**
 * Safari/iOS blocks a popup opened after a Worker terminates because it no
 * longer considers it part of the original tap. Open a harmless target while
 * that tap is still active, then navigate it to the Blob only once the PDF is
 * ready. Desktop browsers keep the normal direct-download path.
 */
export function preparePdfDownload() {
  if (typeof window === 'undefined' || !isIOSBrowser()) return null;
  const target = window.open('', '_blank');
  if (!target) return null;
  try {
    target.document.title = 'Preparando PDF…';
  } catch {
    // A browser extension can make the initial document inaccessible. The
    // normal anchor fallback below remains available in that case.
  }
  return target;
}

export function discardPreparedPdfDownload(target) {
  if (!target || target.closed) return;
  try {
    target.close();
  } catch {
    // Closing a browser-owned tab is best effort only.
  }
}

export function savePdfBuffer(buffer, fileName, { target } = {}) {
  if (!buffer) throw new Error('No se recibió contenido para el PDF.');
  const safeFileName = normalizePdfDownloadFileName(fileName);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  if (target && !target.closed) {
    try {
      // The iOS PDF viewer receives a blob URL rather than an anchor. Giving
      // the prepared document the same name as the PDF also prevents its
      // share/save sheet from falling back to "Unknown".
      if (target.document) target.document.title = safeFileName;
      target.location.href = url;
      // iOS needs the object URL alive while its PDF preview initializes.
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      return { mode: 'preview' };
    } catch {
      discardPreparedPdfDownload(target);
    }
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same task breaks otherwise successful downloads in
  // Safari. A short delayed cleanup keeps memory bounded without racing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { mode: 'download' };
}

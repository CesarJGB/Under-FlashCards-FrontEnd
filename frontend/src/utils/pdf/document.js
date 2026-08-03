import { jsPDF } from 'jspdf';

export function createPdfDocument(options = {}) {
  return new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: options.unit || 'mm',
    format: options.format || 'a4',
    compress: true,
  });
}

export function getPageMetrics(doc, margin = 15) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  return {
    width,
    height,
    margin,
    contentWidth: width - (margin * 2),
    top: margin,
    bottom: height - margin,
  };
}

export function createPdfFileName(title, suffix) {
  const baseName = String(title || 'mazo')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'mazo';
  return `${baseName}-${suffix}.pdf`;
}
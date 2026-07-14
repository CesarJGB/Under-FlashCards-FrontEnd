import { jsPDF } from 'jspdf';

export function createPdfDocument() {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
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

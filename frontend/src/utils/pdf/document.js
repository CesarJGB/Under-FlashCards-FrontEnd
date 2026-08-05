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

export function sanitizeSchedulePdfFileNameSegment(value, fallback = 'Horario') {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function formatSchedulePdfDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return [safeDate.getFullYear(), safeDate.getMonth() + 1, safeDate.getDate()]
    .map((part, index) => index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'))
    .join('-');
}

export function createSchedulePdfFileName(scheduleName, viewType, date = new Date()) {
  const name = sanitizeSchedulePdfFileNameSegment(scheduleName, 'Horario');
  const view = viewType === 'Cuadricula' ? 'Cuadricula' : 'Compacta';
  return `Horario_${name}_${view}_${formatSchedulePdfDate(date)}.pdf`;
}

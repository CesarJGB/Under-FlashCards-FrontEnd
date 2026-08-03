import { isValidHexColor, mixWithWhite } from '../../../lib/materiaColors.js';
import { resolveScheduleClassColor } from '../../../components/library/calendar/scheduleUtils.js';

function hexToRgb(hex) {
  const valueString = String(hex || '');
  const rgbMatch = valueString.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  const clean = valueString.replace('#', '');
  const expanded = clean.length === 3 ? clean.split('').map((value) => value + value).join('') : clean;
  const value = Number.parseInt(expanded, 16);
  if (!Number.isFinite(value)) return { r: 99, g: 102, b: 241 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function getSchedulePdfColors(classItem, subjectColors = []) {
  const accent = resolveScheduleClassColor(classItem, subjectColors);
  const safeAccent = isValidHexColor(accent) ? accent : '#6366F1';
  return {
    accent: hexToRgb(safeAccent),
    // Pasteles impresos: mantienen la identidad de la materia sin sacrificar
    // texto nítido ni gastar demasiada tinta al imprimir.
    surface: hexToRgb(mixWithWhite(safeAccent, 0.88)),
    border: hexToRgb(mixWithWhite(safeAccent, 0.68)),
  };
}

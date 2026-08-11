import {
  Atom,
  BadgeDollarSign,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Calculator,
  ChartNoAxesColumn,
  CircuitBoard,
  Code2,
  Cog,
  Dna,
  FlaskConical,
  Globe2,
  GraduationCap,
  Languages,
  Landmark,
  LibraryBig,
  Lightbulb,
  Microscope,
  Music2,
  Palette,
  Scale,
  Stethoscope,
} from 'lucide-react';
import { normalizeMateriaName } from './materiaColors.js';

export const MATERIA_ICON_OPTIONS = Object.freeze([
  { id: 'calculator', label: 'Matemáticas', Icon: Calculator, keywords: ['matemat', 'calculo', 'algebra', 'geometr', 'aritmet'] },
  { id: 'statistics', label: 'Estadística', Icon: ChartNoAxesColumn, keywords: ['estadistic', 'probabilidad', 'datos'] },
  { id: 'flask', label: 'Química', Icon: FlaskConical, keywords: ['quimic'] },
  { id: 'atom', label: 'Física', Icon: Atom, keywords: ['fisic'] },
  { id: 'biology', label: 'Biología', Icon: Dna, keywords: ['biolog', 'genetic', 'ecolog'] },
  { id: 'medicine', label: 'Salud', Icon: Stethoscope, keywords: ['medicin', 'salud', 'anatom', 'fisiolog', 'enfermer'] },
  { id: 'engineering', label: 'Ingeniería', Icon: Cog, keywords: ['ingenier', 'mecanic'] },
  { id: 'code', label: 'Programación', Icon: Code2, keywords: ['program', 'comput', 'informat', 'codigo', 'software'] },
  { id: 'electronics', label: 'Electrónica', Icon: CircuitBoard, keywords: ['electron', 'circuit', 'robot'] },
  { id: 'languages', label: 'Idiomas', Icon: Languages, keywords: ['ingles', 'espanol', 'frances', 'aleman', 'idioma', 'lengua'] },
  { id: 'literature', label: 'Literatura', Icon: BookOpen, keywords: ['literat', 'lectura', 'redaccion', 'gramatic'] },
  { id: 'history', label: 'Historia', Icon: Landmark, keywords: ['historia', 'arqueolog'] },
  { id: 'geography', label: 'Geografía', Icon: Globe2, keywords: ['geograf', 'territor'] },
  { id: 'art', label: 'Arte', Icon: Palette, keywords: ['arte', 'diseno', 'pintura', 'dibujo'] },
  { id: 'music', label: 'Música', Icon: Music2, keywords: ['music', 'solfeo'] },
  { id: 'economics', label: 'Economía', Icon: BadgeDollarSign, keywords: ['econom', 'finanz', 'contab'] },
  { id: 'business', label: 'Administración', Icon: BriefcaseBusiness, keywords: ['admin', 'negocio', 'empresa', 'marketing'] },
  { id: 'law', label: 'Derecho', Icon: Scale, keywords: ['derecho', 'legal', 'ley', 'jurid'] },
  { id: 'psychology', label: 'Psicología', Icon: Brain, keywords: ['psicolog', 'neuro'] },
  { id: 'philosophy', label: 'Filosofía', Icon: Lightbulb, keywords: ['filosof', 'etica'] },
  { id: 'education', label: 'Educación', Icon: GraduationCap, keywords: ['educa', 'pedagog', 'docen'] },
  { id: 'microscope', label: 'Laboratorio', Icon: Microscope, keywords: ['laboratorio', 'investigacion'] },
  { id: 'science', label: 'Ciencias', Icon: Atom, keywords: ['ciencia'] },
  { id: 'generic', label: 'General', Icon: LibraryBig, keywords: [] },
]);

export const MATERIA_ICON_IDS = Object.freeze(MATERIA_ICON_OPTIONS.map(({ id }) => id));
export const MATERIA_ICON_MAP = Object.freeze(
  Object.fromEntries(MATERIA_ICON_OPTIONS.map(({ id, Icon }) => [id, Icon]))
);

const MATERIA_ICON_METADATA = Object.freeze(
  Object.fromEntries(MATERIA_ICON_OPTIONS.map((option) => [option.id, option]))
);

const AUTOMATIC_FALLBACK_ICON_IDS = Object.freeze([
  'generic',
  'education',
  'science',
  'literature',
  'calculator',
  'microscope',
  'geography',
  'atom',
]);

export function isValidMateriaIconId(value) {
  return typeof value === 'string' && Object.hasOwn(MATERIA_ICON_MAP, value);
}

function stableHash(value) {
  const key = normalizeMateriaName(value);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getAutomaticMateriaIconId(name) {
  const normalizedName = normalizeMateriaName(name);
  const keywordMatch = MATERIA_ICON_OPTIONS.find(({ keywords }) =>
    keywords.some((keyword) => normalizedName.includes(keyword))
  );

  if (keywordMatch) return keywordMatch.id;
  return AUTOMATIC_FALLBACK_ICON_IDS[stableHash(normalizedName) % AUTOMATIC_FALLBACK_ICON_IDS.length];
}

export function getMateriaIconId(materia) {
  if (isValidMateriaIconId(materia?.icon)) return materia.icon;
  return getAutomaticMateriaIconId(materia?.name || materia?._id || '');
}

export function getMateriaIconComponent(materia) {
  return MATERIA_ICON_MAP[getMateriaIconId(materia)] || LibraryBig;
}

export function getMateriaIconLabel(iconId) {
  return MATERIA_ICON_METADATA[iconId]?.label || MATERIA_ICON_METADATA.generic.label;
}

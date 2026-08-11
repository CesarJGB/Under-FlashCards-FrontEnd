const MATERIA_ICON_DEFINITIONS = Object.freeze([
  ['calculator', ['matemat', 'calculo', 'algebra', 'geometr', 'aritmet']],
  ['statistics', ['estadistic', 'probabilidad', 'datos']],
  ['flask', ['quimic']],
  ['atom', ['fisic']],
  ['biology', ['biolog', 'genetic', 'ecolog']],
  ['medicine', ['medicin', 'salud', 'anatom', 'fisiolog', 'enfermer']],
  ['engineering', ['ingenier', 'mecanic']],
  ['code', ['program', 'comput', 'informat', 'codigo', 'software']],
  ['electronics', ['electron', 'circuit', 'robot']],
  ['languages', ['ingles', 'espanol', 'frances', 'aleman', 'idioma', 'lengua']],
  ['literature', ['literat', 'lectura', 'redaccion', 'gramatic']],
  ['history', ['historia', 'arqueolog']],
  ['geography', ['geograf', 'territor']],
  ['art', ['arte', 'diseno', 'pintura', 'dibujo']],
  ['music', ['music', 'solfeo']],
  ['economics', ['econom', 'finanz', 'contab']],
  ['business', ['admin', 'negocio', 'empresa', 'marketing']],
  ['law', ['derecho', 'legal', 'ley', 'jurid']],
  ['psychology', ['psicolog', 'neuro']],
  ['philosophy', ['filosof', 'etica']],
  ['education', ['educa', 'pedagog', 'docen']],
  ['microscope', ['laboratorio', 'investigacion']],
  ['science', ['ciencia']],
  ['generic', []],
]);

const MATERIA_ICON_IDS = Object.freeze(MATERIA_ICON_DEFINITIONS.map(([id]) => id));
const MATERIA_ICON_ID_SET = new Set(MATERIA_ICON_IDS);
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

function normalizeMateriaName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stableHash(value) {
  const key = normalizeMateriaName(value);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function isValidMateriaIconId(value) {
  return typeof value === 'string' && MATERIA_ICON_ID_SET.has(value);
}

function getAutomaticMateriaIconId(name) {
  const normalizedName = normalizeMateriaName(name);
  const keywordMatch = MATERIA_ICON_DEFINITIONS.find(([, keywords]) =>
    keywords.some((keyword) => normalizedName.includes(keyword))
  );

  if (keywordMatch) return keywordMatch[0];
  return AUTOMATIC_FALLBACK_ICON_IDS[stableHash(normalizedName) % AUTOMATIC_FALLBACK_ICON_IDS.length];
}

module.exports = {
  MATERIA_ICON_IDS,
  getAutomaticMateriaIconId,
  isValidMateriaIconId,
};

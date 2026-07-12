import { BarChart3, BookOpenText, Compass, Layers } from 'lucide-react';
import GlobalStatsWidget from './widgets/GlobalStatsWidget';
import MateriasSummaryWidget from './widgets/MateriasSummaryWidget';
import QuickViewSubjectsWidget from './widgets/QuickViewSubjectsWidget';
import UnclassifiedDecksWidget from './widgets/UnclassifiedDecksWidget';

export const DEFAULT_WIDGET_ORDER = [
  'quickViewSubjects',
  'globalStats',
  'materiasSummary',
  'unclassifiedDecks'
];

const LEGACY_WIDGET_ID_MAP = {
  0: 'quickViewSubjects',
  1: 'globalStats',
  2: 'materiasSummary',
  3: 'unclassifiedDecks'
};

export const HOME_WIDGET_REGISTRY = {
  quickViewSubjects: {
    id: 'quickViewSubjects',
    title: 'Vista rápida de materias',
    description: 'Grid paginado de materias con navegación directa a Library.',
    category: 'Asignaturas',
    icon: Layers,
    capabilities: ['Configurable', 'Swipe lateral', 'Acciones por materia'],
    Component: QuickViewSubjectsWidget,
    getPreview: ({ quickView }) => {
      const count = quickView?.visibleMaterias?.length || 0;
      return count > 0 ? `${count} materias activas` : 'Configura las materias';
    }
  },
  globalStats: {
    id: 'globalStats',
    title: 'Resumen global',
    description: 'Snapshot compacto del total de tarjetas y dominio general.',
    category: 'Resumen',
    icon: BarChart3,
    capabilities: ['Lectura rápida'],
    Component: GlobalStatsWidget,
    getPreview: ({ globalStats }) => `${globalStats?.globalMastery ?? 0}% dominio`
  },
  materiasSummary: {
    id: 'materiasSummary',
    title: 'Mapa de materias',
    description: 'Resumen compacto de las materias con más actividad.',
    category: 'Asignaturas',
    icon: BookOpenText,
    capabilities: ['Resumen', 'Navegación'],
    Component: MateriasSummaryWidget,
    getPreview: ({ enrichedMaterias }) => `${enrichedMaterias?.length || 0} materias detectadas`
  },
  unclassifiedDecks: {
    id: 'unclassifiedDecks',
    title: 'Mazos fuera de jerarquía',
    description: 'Accesos rápidos para revisar mazos sin materia raíz.',
    category: 'Repaso',
    icon: Compass,
    capabilities: ['Atajos', 'Acción directa'],
    Component: UnclassifiedDecksWidget,
    getPreview: ({ unclassifiedDecks }) => `${unclassifiedDecks?.length || 0} mazos huérfanos`
  }
};

export const HOME_WIDGET_DEFINITIONS = DEFAULT_WIDGET_ORDER.map((id) => HOME_WIDGET_REGISTRY[id]);

export function getHomeWidgetDefinition(widgetId) {
  return HOME_WIDGET_REGISTRY[widgetId] || null;
}

export function normalizeWidgetOrder(order) {
  if (!Array.isArray(order)) return DEFAULT_WIDGET_ORDER;

  const allowedIds = new Set(DEFAULT_WIDGET_ORDER);
  const uniqueIds = [];

  order.forEach((rawId) => {
    const mappedId = typeof rawId === 'number' ? LEGACY_WIDGET_ID_MAP[rawId] : rawId;
    if (!mappedId || !allowedIds.has(mappedId) || uniqueIds.includes(mappedId)) return;
    uniqueIds.push(mappedId);
  });

  const missingIds = DEFAULT_WIDGET_ORDER.filter((id) => !uniqueIds.includes(id));
  return [...uniqueIds, ...missingIds];
}

import { BarChart3, BookOpenText, Layers, WalletCards } from 'lucide-react';
import GlobalStatsWidget from './widgets/GlobalStatsWidget';
import MateriasSummaryWidget from './widgets/MateriasSummaryWidget';
import OpenRouterBalanceWidget from './widgets/OpenRouterBalanceWidget';
import QuickViewSubjectsWidget from './widgets/QuickViewSubjectsWidget';

export const DEFAULT_WIDGET_ORDER = [
  'quickViewSubjects',
  'globalStats',
  'materiasSummary',
  'openRouterBalance'
];

const LEGACY_WIDGET_ID_MAP = {
  0: 'quickViewSubjects',
  1: 'globalStats',
  2: 'materiasSummary',
  // El índice 3 pertenecía a Mazos Sueltos. Se conserva para no romper
  // preferencias numéricas ya guardadas, pero ahora representa el nuevo widget.
  3: 'openRouterBalance',
  unclassifiedDecks: 'openRouterBalance'
};

const WIDGET_ID_TO_LEGACY_INDEX = {
  quickViewSubjects: 0,
  globalStats: 1,
  materiasSummary: 2,
  openRouterBalance: 3
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
  openRouterBalance: {
    id: 'openRouterBalance',
    title: 'Saldo de OpenRouter',
    description: 'Saldo y consumo reciente de tu clave de IA.',
    category: 'Cuenta',
    icon: WalletCards,
    capabilities: ['Saldo actual', 'Consumo diario', 'Actualización manual'],
    Component: OpenRouterBalanceWidget,
    getPreview: ({ openRouterBalance }) => {
      const info = openRouterBalance?.snapshot?.info;
      if (!info) return 'Configura tu clave de OpenRouter';
      if (info.limit_remaining === null) return 'Clave sin límite asignado';
      return `$${Number(info.limit_remaining).toFixed(2)} disponibles`;
    }
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
    const mappedId = LEGACY_WIDGET_ID_MAP[rawId] || rawId;
    if (!mappedId || !allowedIds.has(mappedId) || uniqueIds.includes(mappedId)) return;
    uniqueIds.push(mappedId);
  });

  const missingIds = DEFAULT_WIDGET_ORDER.filter((id) => !uniqueIds.includes(id));
  return [...uniqueIds, ...missingIds];
}

export function serializeWidgetOrder(order) {
  return normalizeWidgetOrder(order)
    .map((widgetId) => WIDGET_ID_TO_LEGACY_INDEX[widgetId])
    .filter((value) => Number.isInteger(value));
}

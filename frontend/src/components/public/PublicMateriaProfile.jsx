import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  GraduationCap,
  Layers3,
  Loader2,
  Radar,
  Sparkles
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function formatDate(value) {
  if (!value) return 'Sin datos recientes';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos recientes';

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function CriteriaNode({ node, depth = 0 }) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const paddingLeft = depth > 0 ? `${depth * 14}px` : undefined;

  return (
    <div className="space-y-2" style={paddingLeft ? { paddingLeft } : undefined}>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">{node.name}</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-1">
              {node.type === 'folder' ? 'Criterio agrupador' : 'Criterio evaluable'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
              {node.weight || 0}% del curso
            </span>
            {node.grade != null && (
              <span className="px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40">
                Calificacion: {node.grade}
              </span>
            )}
          </div>
        </div>
      </div>

      {hasChildren && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <CriteriaNode key={child.id || child._id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PublicMateriaView({ data, embedded = false }) {
  const cards = useMemo(() => {
    if (!data) return [];

    return [
      {
        key: 'mastery',
        label: 'Dominio actual',
        value: `${data.materia.analytics?.masteryPercentage ?? 0}%`,
        hint: 'Consolidado global de la materia',
        icon: Radar,
        accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
      },
      {
        key: 'temas',
        label: 'Temas registrados',
        value: data.stats?.temasCount ?? 0,
        hint: 'Suma de temas en todos los parciales',
        icon: BookOpen,
        accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
      },
      {
        key: 'decks',
        label: 'Mazos asociados',
        value: data.stats?.decksCount ?? 0,
        hint: 'Mazos vinculados a esta materia',
        icon: Layers3,
        accent: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
      },
      {
        key: 'cards',
        label: 'Tarjetas totales',
        value: data.stats?.cardsCount ?? 0,
        hint: 'Suma de tarjetas de todos los mazos',
        icon: GraduationCap,
        accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
      }
    ];
  }, [data]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500 font-bold">
              Under-Flash
            </p>
            <h1 className="text-lg md:text-xl font-black tracking-tight truncate">Perfil publico de materia</h1>
          </div>
        </div>

        {embedded ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Vista previa interna
          </div>
        ) : (
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir a Under-Flash
          </a>
        )}
      </div>

      <section className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Sin login, solo lectura
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                {data.materia.name}
              </h2>
              <p className="mt-2 text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                Resumen publico de la materia con indicadores globales, parciales activos y criterios de evaluacion compartidos.
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-950 dark:bg-slate-800 text-white px-5 py-4 min-w-[180px] shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300 font-bold">Ultima actualizacion</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed">
              {formatDate(data.materia.analytics?.lastCalculatedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(data.materia.activeParciales || []).map((parcial) => (
            <span
              key={parcial}
              className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider"
            >
              Parcial {parcial}
            </span>
          ))}
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/40">
            Meta {data.materia.metaCalificacion ?? 70}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs"
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${card.accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-bold">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {card.hint}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Panorama general</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Lectura rapida del avance global de la materia.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
              <span>Dominio consolidado</span>
              <span>{data.materia.analytics?.masteryPercentage ?? 0}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, data.materia.analytics?.masteryPercentage ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Resenas</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
                {data.materia.analytics?.totalReviewsCount ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Velocidad</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
                {data.materia.analytics?.avgResponseTime ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Indice</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
                {data.materia.analytics?.velocityIndex ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Parciales</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Distribucion de temas por bloque.</p>
            </div>
          </div>

          <div className="space-y-3">
            {(data.stats?.parciales || []).map((parcial) => (
              <div
                key={parcial.number}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Parcial {parcial.number}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {parcial.isActive ? 'Incluido en el resumen principal' : 'No activo para el dominio principal'}
                  </p>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-slate-50">
                  {parcial.temasCount} tema{parcial.temasCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Criterios de evaluacion</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Estructura compartida de criterios, pesos y calificaciones registradas en la materia.
            </p>
          </div>
        </div>

        {Array.isArray(data.materia.evaluationCriteria) && data.materia.evaluationCriteria.length > 0 ? (
          <div className="space-y-3">
            {data.materia.evaluationCriteria.map((node) => (
              <CriteriaNode key={node.id || node._id} node={node} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Esta materia todavia no tiene criterios de evaluacion compartidos.
          </div>
        )}
      </section>
    </>
  );
}

export default function PublicMateriaProfile({ shareId, embedded = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareId) {
      setData(null);
      setError('No se encontro un enlace publico valido para esta materia.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch(`${BACKEND_URL}/api/public/materias/${shareId}`);
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body.error || 'No se pudo cargar el perfil publico.');
        }

        if (!cancelled) {
          setData(body);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar el perfil publico.');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const pageClasses = embedded
    ? 'min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50'
    : 'min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50';
  const containerClasses = embedded
    ? 'max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-8'
    : 'max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-10 space-y-8';

  return (
    <div className={pageClasses}>
      <div className={containerClasses}>
        {loading ? (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {embedded ? 'Cargando vista previa publica...' : 'Cargando materia publica...'}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 p-10 text-center shadow-xs space-y-2">
            <p className="text-lg font-black text-slate-900 dark:text-slate-50">Este perfil no esta disponible</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        ) : data ? (
          <PublicMateriaView data={data} embedded={embedded} />
        ) : null}
      </div>
    </div>
  );
}

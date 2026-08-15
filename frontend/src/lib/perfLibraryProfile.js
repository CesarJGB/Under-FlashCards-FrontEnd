// FILE: frontend/src/lib/perfLibraryProfile.js
// Instrumentación de investigación de la Fase 2B (perfil de navegador de
// Library). NO es productiva: es INERTE en el flujo normal.
//
// Garantías:
// - Sólo se activa en builds con VITE_PERF_LIBRARY_PROFILE === '1' (el
//   harness de investigación construye con esa bandera; el build productivo
//   normal no la define).
// - Cuando está desactivada, las funciones son no-ops sin estado, sin
//   medición, sin User Timing y sin lecturas de reloj: no cambian estado,
//   solicitudes, orden visual, UX ni comportamiento.
// - Cuando está activada sólo registra contadores de renders y eventos de
//   invocación de loaders (timestamps y resultados); nunca altera el flujo.
//
// El registro vive en memoria de la página; el runner del harness lo extrae
// al final de cada escenario. Nada de esto se persiste en producción.

const PROFILE_FLAG =
  typeof import.meta !== 'undefined' &&
  import.meta.env != null &&
  import.meta.env.VITE_PERF_LIBRARY_PROFILE === '1';

const NOOP_INVOCATION = { end() {} };

/**
 * Crea una instancia de perfilado. `enabled=false` produce una instancia
 * totalmente inerte (no-op). El singleton exportado se configura con la
 * bandera de build; la fábrica permite pruebas deterministas de ambos modos.
 */
export function createPerfLibraryProfile(enabled) {
  const renderCounts = new Map();
  const loaderInvocations = [];
  // Activas por nombre de loader: detecta solapamiento de ejecuciones
  // equivalentes (misma función invocada antes de que la anterior termine).
  const activeByLoader = new Map();

  return {
    renderCount(name) {
      if (!enabled || !name) return;
      renderCounts.set(name, (renderCounts.get(name) || 0) + 1);
    },

    /**
     * Marca el inicio de una invocación de loader. Devuelve un objeto con
     * `end(result)` que registra el final. `args` aporta el perfil de llamada
     * (showSpinner/signal) usado para atribuir el iniciador lógico sin
     * inspeccionar stacks.
     */
    beginLoader(name, args = {}) {
      if (!enabled || !name) return NOOP_INVOCATION;
      const start = performance.now();
      const overlapping = activeByLoader.has(name);
      activeByLoader.set(name, start);
      const record = {
        // `loader`, no `name`: la serialización de resultados prohíbe la
        // clave `name` (nombres reales); el nombre de función no es sensible.
        loader: name,
        start,
        end: null,
        result: 'running',
        aborted: false,
        showSpinner: Boolean(args.showSpinner),
        hasSignal: Boolean(args.signal),
        overlapped: overlapping,
      };
      loaderInvocations.push(record);
      return {
        end(result) {
          if (record.end !== null) return;
          record.end = performance.now();
          record.result = result === 'error' ? 'error' : 'ok';
          record.aborted = Boolean(args.signal && args.signal.aborted);
          if (activeByLoader.get(name) === start) activeByLoader.delete(name);
        },
      };
    },

    snapshot() {
      return {
        renderCounts: Object.fromEntries(renderCounts),
        loaderInvocations: loaderInvocations.map((inv) => ({ ...inv })),
      };
    },

    reset() {
      renderCounts.clear();
      loaderInvocations.length = 0;
      activeByLoader.clear();
    },
  };
}

/** Singleton del build: inerte salvo bandera explícita de investigación. */
export const perfLibraryProfile = createPerfLibraryProfile(PROFILE_FLAG);

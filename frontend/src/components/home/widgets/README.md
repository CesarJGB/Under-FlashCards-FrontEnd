# Guía de widgets del Home

Esta carpeta contiene los widgets que aparecen en el carrusel de la sección Home. Un widget es un componente React autónomo que muestra una parte de la información del usuario y, opcionalmente, permite navegar a otra sección o ejecutar una acción.

## Arquitectura rápida

El flujo principal es:

```text
HomeSection
  ├─ construye widgetContext con datos y callbacks
  └─ renderiza WidgetCarousel
       ├─ consulta homeWidgetRegistry.js
       ├─ muestra el widget activo
       ├─ genera previews de los widgets siguientes
       └─ abre WidgetCarouselExpanded para reordenar
```

Archivos importantes:

| Archivo | Responsabilidad |
| --- | --- |
| `../homeWidgetRegistry.js` | Registro central de widgets, metadatos, orden por defecto y normalización del orden. |
| `../WidgetCarousel.jsx` | Carrusel, tarjeta activa, previews y gesto de swipe lateral. |
| `../WidgetCarouselExpanded.jsx` | Vista para reordenar los widgets. |
| `HomeWidgetShell.jsx` | Estructura visual compartida: encabezado, contenido, footer y paginación opcional. |
| `../HomeSection.jsx` | Obtiene/prepara los datos y expone el contexto que reciben los widgets. |
| `useWidgetPager.js` | Lógica reutilizable de paginación y swipe dentro de un widget. |

## Crear un widget nuevo

### 1. Crear el componente

Crea un archivo en esta carpeta, por ejemplo `StudyStreakWidget.jsx`.

El componente debe:

- Exportar un `default`.
- Recibir únicamente los datos y callbacks que necesita.
- Renderizar contenido válido para el espacio de una tarjeta.
- Manejar estados vacíos sin romper el layout.
- Usar botones reales para acciones, con `type="button"`.
- Usar `?.` en callbacks que puedan no estar disponibles.
- Evitar hacer fetch directamente si los datos ya pueden prepararse en `HomeSection`.

Ejemplo mínimo:

```jsx
import { Flame } from 'lucide-react';
import HomeWidgetShell from './HomeWidgetShell';

export default function StudyStreakWidget({ studyStats, onOpenStudy }) {
  const streak = studyStats?.currentStreak || 0;

  return (
    <HomeWidgetShell
      title="Racha de estudio"
      description="Tu progreso reciente."
      icon={Flame}
      footerNote={`${streak} días consecutivos.`}
    >
      <div className="h-full flex flex-col justify-between rounded-[28px] bg-orange-50 p-5">
        <p className="text-4xl font-black text-orange-600">{streak}</p>

        <button
          type="button"
          onClick={() => onOpenStudy?.()}
          className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700"
        >
          Empezar sesión
        </button>
      </div>
    </HomeWidgetShell>
  );
}
```

### 2. Importarlo y registrarlo

En `../homeWidgetRegistry.js`:

```jsx
import { Flame } from 'lucide-react';
import StudyStreakWidget from './widgets/StudyStreakWidget';
```

Añade el identificador al orden por defecto si debe aparecer para usuarios nuevos:

```jsx
export const DEFAULT_WIDGET_ORDER = [
  'quickViewSubjects',
  'globalStats',
  'materiasSummary',
  'unclassifiedDecks',
  'studyStreak'
];
```

Añade la definición al objeto `HOME_WIDGET_REGISTRY`:

```jsx
studyStreak: {
  id: 'studyStreak',
  title: 'Racha de estudio',
  description: 'Resumen de tus días consecutivos de estudio.',
  category: 'Progreso',
  icon: Flame,
  capabilities: ['Lectura rápida', 'Acción directa'],
  Component: StudyStreakWidget,
  getPreview: ({ studyStats }) => `${studyStats?.currentStreak || 0} días de racha`
}
```

También actualiza `WIDGET_ID_TO_LEGACY_INDEX` si el widget debe guardarse mediante el formato numérico heredado:

```jsx
const WIDGET_ID_TO_LEGACY_INDEX = {
  quickViewSubjects: 0,
  globalStats: 1,
  materiasSummary: 2,
  unclassifiedDecks: 3,
  studyStreak: 4
};
```

El registro debe tener siempre estos campos:

- `id`: identificador estable y único. No lo cambies después de publicar el widget si ya se guarda el orden en usuarios.
- `title`: nombre visible en el carrusel y en la vista expandida.
- `description`: explicación corta del widget.
- `category`: categoría mostrada en la biblioteca de widgets.
- `icon`: componente de `lucide-react`.
- `capabilities`: lista corta de capacidades informativas.
- `Component`: componente React que se renderiza.
- `getPreview`: función que recibe el contexto y devuelve el texto de preview.

## Pasar datos al widget

El componente recibe las propiedades de `widgetContext`, definido en `HomeSection.jsx`. Actualmente incluye:

```js
{
  user,
  globalStats,
  enrichedMaterias,
  unclassifiedDecks,
  quickView,
  getKnowledgeAccent,
  getParcialesBadge,
  onNavigateToLibrary,
  onOpenReview
}
```

Si el widget necesita un dato nuevo:

1. Obtén o calcula el dato en `HomeSection`.
2. Añádelo a `widgetContext`.
3. Añádelo también a la lista de dependencias del `useMemo` que crea el contexto.
4. Recíbelo en el componente y en su `getPreview`.

Ejemplo:

```jsx
const widgetContext = useMemo(() => ({
  user,
  studyStats,
  onOpenStudy
}), [user, studyStats, onOpenStudy]);
```

No uses una variable que no esté en el contexto esperando que el registro la proporcione. `getPreview` y `Component` reciben el mismo objeto de contexto.

## Usar `HomeWidgetShell`

`HomeWidgetShell` no es obligatorio, pero es la opción recomendada para mantener consistencia. Sus propiedades principales son:

```jsx
<HomeWidgetShell
  title="Título"
  description="Descripción corta"
  icon={Icon}
  headerAction={/* acción opcional */}
  footerNote="Texto inferior"
  currentPage={currentPage}
  totalPages={totalPages}
  onSelectPage={goToPage}
  bodyClassName=""
>
  {/* contenido del widget */}
</HomeWidgetShell>
```

Consideraciones de layout:

- El carrusel reserva aproximadamente `360px` de alto para la tarjeta activa.
- El contenido normalmente debe usar `h-full`, `flex`, `min-h-0` o combinaciones equivalentes para no desbordarse.
- El cuerpo del shell ocupa el espacio disponible con `flex-1 min-h-0`.
- El footer puede mostrar puntos de paginación si `totalPages > 1`.
- No agregues una altura fija mayor sin comprobar móvil y escritorio.

## Paginación y swipe

Para un widget con varias páginas, reutiliza `useWidgetPager.js`:

```jsx
const {
  currentPage,
  totalPages,
  pageItems,
  goToPage,
  shouldSuppressClick,
  swipeHandlers
} = useWidgetPager(items, PAGE_SIZE);
```

Aplica `swipeHandlers` al área que debe responder al gesto:

```jsx
<div {...swipeHandlers} style={{ touchAction: totalPages > 1 ? 'pan-y' : 'auto' }}>
  {/* página actual */}
</div>
```

Si esa área contiene botones:

- Llama `shouldSuppressClick()` antes de navegar para no activar un click al terminar un swipe.
- Usa `onPointerDown={(event) => event.stopPropagation()}` en controles que deban funcionar sin mover el carrusel padre.
- Renderiza estados vacíos y placeholders para evitar saltos de altura entre páginas.

## Navegación y acciones

Usa los callbacks existentes en vez de acoplar el widget a `App.jsx`:

- `onNavigateToLibrary(target)`: abrir Library con un destino concreto.
- `onOpenReview(deck)`: abrir el repaso de un mazo.

Los destinos de Library deben mantener la forma esperada por la navegación actual:

```js
{
  materiaId: materia.id,
  parcialNumber: null,
  temaId: null,
  subtemaId: null
}
```

Si una nueva acción necesita un callback que no existe, añádelo de extremo a extremo: prop de `HomeSection`, handler en `App.jsx`, contexto del widget y finalmente componente.

## Modificar un widget existente

Antes de editarlo, revisa:

- Qué propiedades recibe y quién las produce.
- Si el widget está dentro de `HomeWidgetShell`.
- Si tiene botones internos, paginación o swipe.
- Qué forma tienen los objetos de datos, especialmente `materia.id`, `deck.id`/`deck._id` y sus contadores.
- Qué hace cuando la colección está vacía o está cargando.
- Si `getPreview` sigue describiendo el contenido después del cambio.

Mantén estable el `id` del registro. Cambiarlo hace que el sistema lo considere un widget diferente y puede alterar el orden guardado de los usuarios.

## Persistencia y orden

El orden se guarda en preferencias del usuario y también se cachea en `localStorage` desde `HomeSection`.

`normalizeWidgetOrder` hace lo siguiente:

- Descarta identificadores desconocidos.
- Elimina duplicados.
- Traduce índices numéricos antiguos mediante `LEGACY_WIDGET_ID_MAP`.
- Añade al final los widgets que falten en `DEFAULT_WIDGET_ORDER`.

Por eso, al añadir un widget nuevo debes comprobar que:

- Está en `DEFAULT_WIDGET_ORDER`.
- Está en `HOME_WIDGET_REGISTRY`.
- Tiene una entrada en `WIDGET_ID_TO_LEGACY_INDEX` si se conserva el formato legado.
- No reutiliza el `id` de otro widget.

## Checklist antes de terminar

- [ ] El archivo está dentro de `frontend/src/components/home/widgets/`.
- [ ] El componente exporta `default`.
- [ ] El componente maneja datos vacíos, nulos y estados de carga relevantes.
- [ ] Los botones tienen `type="button"` y callbacks funcionales.
- [ ] El componente no desborda la tarjeta de aproximadamente `360px`.
- [ ] Se añadieron el import y la definición en `homeWidgetRegistry.js`.
- [ ] El `id` está en `DEFAULT_WIDGET_ORDER`.
- [ ] Se actualizó el mapa legado si corresponde.
- [ ] `getPreview` funciona con datos vacíos.
- [ ] Los datos nuevos están en `widgetContext` y en sus dependencias de `useMemo`.
- [ ] La paginación no confunde clicks con swipes.
- [ ] Se verificó el widget en móvil y escritorio.
- [ ] Se ejecutaron los checks disponibles del frontend.

## Errores frecuentes

### El widget no aparece

Comprueba que el `id` esté en `DEFAULT_WIDGET_ORDER`, que la definición tenga `Component` y que el identificador no tenga diferencias de mayúsculas o spelling.

### Aparece en el carrusel, pero falla el preview

`getPreview` recibe el contexto completo, pero puede recibir datos aún no cargados. Usa optional chaining y valores por defecto.

### El orden desaparece o se reacomoda

Revisa `DEFAULT_WIDGET_ORDER`, `normalizeWidgetOrder` y los mapas de compatibilidad numérica. No cambies identificadores ya persistidos.

### Un click navega después de deslizar

Usa `shouldSuppressClick()` en el handler del botón cuando el widget utilice `useWidgetPager`.

### La tarjeta crece o corta contenido

Revisa `h-full`, `min-h-0`, `flex-1`, el número de elementos renderizados y los estilos responsive. El carrusel tiene una altura de tarjeta fija.

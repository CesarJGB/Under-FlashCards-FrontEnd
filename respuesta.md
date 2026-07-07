Riesgos de localStorage en móvil y cómo mitigarlos

Resumen corto
- Sí: hay escenarios en móviles donde localStorage puede fallar o comportarse de manera inesperada (modo incógnito, cuota llena, políticas del navegador, etc.).
- Estado actual: el código ya maneja algunos errores con try/catch en lugares (por ejemplo HomeSection y QuickViewGrid), pero hay puntos críticos sin protección (por ejemplo inicializadores en App.jsx usan JSON.parse sin try/catch).
- Recomendación inmediata: centralizar el acceso a localStorage en un helper `safeLocalStorage` (getJSON/setJSON/remove) que capture errores, haga fallback en memoria y limpie claves corruptas.

Escenarios problemáticos en móvil
1) Modo incógnito / políticas del navegador
- Algunos navegadores bloquean o limitan localStorage en modo privacidad; setItem puede lanzar (QuotaExceededError / SecurityError).

2) Cuota de almacenamiento llena
- setItem puede fallar cuando el navegador alcanza la cuota; esto es más probable si guardas objetos grandes (p. ej. `metrics`).

3) Caché corrupto (JSON inválido)
- JSON.parse sobre una cadena truncada o corrupta lanzará y, si ocurre en el render (useState initializer), puede romper la app.

4) localStorage deshabilitado
- Usuarios o políticas corporativas pueden deshabilitar storage; getItem o setItem pueden lanzar o devolverse nulos.

5) Evicción / limpieza automática
- El navegador puede evictar data en condiciones de espacio; hay que tolerar claves faltantes.

Qué hace el código ahora y puntos débiles
- Protected: HomeSection.jsx y QuickViewGrid.jsx usan try/catch al parsear o al escribir en localStorage en varias ocasiones (buenas prácticas ya presentes).
- Débil: App.jsx inicializa `decks` y `materias` con `JSON.parse(localStorage.getItem(...))` sin try/catch; un JSON corrupto aquí puede provocar una excepción en render.

Qué sucede si el caché está corrupto (ejemplo concreto)
- Si `JSON.parse` falla en un initializer sin try/catch, el componente lanzará durante render y la app puede quedar rota o mostrar una pantalla en blanco.
- En código que ya usa try/catch, la caché se elimina o se ignora y la app sigue funcionando con datos frescos del servidor (fallback silencioso).

Recomendaciones prácticas (priorizadas)

1) Implementar un helper safeLocalStorage (alta prioridad, bajo coste)
- Ruta sugerida: `frontend/src/lib/safeLocalStorage.js`.
- Comportamiento:
  - getJSON(key): intenta parsear; si falla, elimina la clave y devuelve null; si localStorage no disponible, devuelve fallback en memoria.
  - setJSON(key, value): intenta setItem; si falla por cuota o bloqueo, guarda en memoria como fallback y devuelve false.
  - remove(key): elimina de localStorage e inMemory.

Ejemplo:
```js
// frontend/src/lib/safeLocalStorage.js
const inMemory = {};

function isQuotaExceeded(e) {
  return e && (e.code === 22 || e.code === 1014 ||
    e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

export function getJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    try { localStorage.removeItem(key); } catch (e) {}
    return Object.prototype.hasOwnProperty.call(inMemory, key) ? inMemory[key] : null;
  }
}

export function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (isQuotaExceeded(err) || err instanceof DOMException) {
      try { inMemory[key] = value; } catch (e) {}
      return false;
    }
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch (err) { /* ignore */ }
  try { delete inMemory[key]; } catch (err) { /* ignore */ }
}
```

2) Aplicar safeLocalStorage en inicializadores críticos
- Reemplazar en App.jsx las lecturas iniciales:
```js
import { getJSON } from './lib/safeLocalStorage';
const [decks, setDecks] = useState(() => getJSON(`decks_${user.id}`) || []);
const [materias, setMaterias] = useState(() => getJSON(`materias_${user.id}`) || []);
```
- Evita crashes por JSON corrupto en render.

3) Reducir lo que persistes (especialmente en domainPreviews)
- Guarda solo lo necesario: `{ mastery, parciales, timestamp }` y evita persistir `metrics` completos si no son necesarios para el render inmediato.
- Menor payload = menor probabilidad de QuotaExceeded y parse errors.

4) Estrategias de fallback en setJSON falla por cuota
- Políticas posibles:
  - Evictar entradas antiguas (p. ej. domainPreviews más viejos) antes de reintentar.
  - Guardar en memoria y notificar silenciosamente al usuario (opcional).
  - Registrar telemetría para entender incidencia en usuarios.

5) Considerar IndexedDB para datos grandes o persistencia robusta
- IndexedDB (o librerías como localForage) es asincrónico, más adecuado para objetos grandes y menos propenso a excepciones síncronas por cuota.

6) Tests y monitoreo
- Añadir tests que simulen:
  - JSON.parse throwing
  - QuotaExceededError en setItem
  - localStorage deshabilitado
- Añadir logs/telemetría cuando setJSON falla para detectar distribuciones de error en móviles.

Plan de acción inmediato sugerido
1. Implemento `frontend/src/lib/safeLocalStorage.js` y lo uso en App.jsx (protección crítica contra crash en render).
2. Re-escribir persistencia de `domainPreviews` para guardar únicamente `{ mastery, parciales, timestamp }`.
3. Opcional: reemplazar otras lecturas/escrituras dispersas por wrappers `getJSON/setJSON`.

¿Quieres que implemente el helper `safeLocalStorage.js` y lo aplique a App.jsx y a los puntos críticos ahora? Puedo hacerlo y subir commits con tests básicos.

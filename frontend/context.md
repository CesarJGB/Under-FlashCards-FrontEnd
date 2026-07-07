# Contexto para trabajar en LoginScreen (LoginScreen.jsx)

Resumen
- Propósito: proporcionar todo el contexto necesario para que otra IA (o un desarrollador) realice cambios estéticos en la pantalla de login (`frontend/src/components/LoginScreen.jsx`) sin buscar archivos adicionales.
- Alcance: UI/estética del login; también incluyo integración, contrato backend, dependencias, variables de entorno, pruebas y recomendaciones prácticas para implementar cambios seguros.

---

Archivo objetivo
- Path: `frontend/src/components/LoginScreen.jsx`
- Contenido actual (cópialo tal cual si lo necesitas):
```jsx
import { Sparkles, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginScreen({ onSuccess, onError, error }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 mb-5">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Flashcards</h1>
          <p className="mt-2 text-slate-500">Inicia sesión para estudiar mejor.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <p className="text-sm font-medium text-slate-700 text-center mb-6">
            Continúa con tu cuenta de Google
          </p>
          <div className="flex justify-center" data-testid="google-login-button">
            <GoogleLogin
              onSuccess={onSuccess}
              onError={onError}
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              locale="es"
            />
          </div>
          {error && (
            <div className="mt-5 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

Cómo se integra en la app
- `App.jsx` envuelve la app en `GoogleOAuthProvider` con `clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID`. Si la variable no existe, `App` devuelve `null`.
- `LoginScreen` recibe props:
  - `onSuccess(credentialResponse)` — callback cuando Google devuelve `credential` (idToken).
  - `onError()` — callback en fallo del provider.
  - `error` — string que muestra un mensaje de error en la UI.
- `App.jsx` (resumen del flujo actual): el `onSuccess` local decodifica el token (para mostrar info rápido) y luego POST a `${BACKEND_URL}/api/auth/google` con `{ credential }`. Si el backend responde OK se setea el `user`.

---

Contrato backend (resumen)
- Endpoint: `POST /api/auth/google`
- Request body: JSON `{ credential }` (o `{ token }`)
- Backend (Express) verifica con `google-auth-library`:
  - `oauthClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })`
  - valida `payload.aud === GOOGLE_CLIENT_ID` y `payload.email_verified`.
- Respuesta exitosa:
```json
{
  "success": true,
  "user": {
    "id": "<mongo_id>",
    "email": "...",
    "name": "...",
    "picture": "...",
    "hasApiKey": true|false
  }
}
```
- Errores devuelven 4xx/5xx con `{ error: '...' }`.

---

Variables de entorno relevantes
- Frontend:
  - `VITE_GOOGLE_CLIENT_ID` — obligatorio para renderizar la app.
  - `VITE_BACKEND_URL` — URL del backend (ej. `http://localhost:8001`).
  - Nota: `vite.config.js` permite `VITE_` y `REACT_APP_` como prefijos.
- Backend:
  - `GOOGLE_CLIENT_ID` — usado para verificar tokens.
  - `FRONTEND_URL` — orígenes permitidos en CORS; en dev agregar `http://localhost:5173` o el puerto de Vite.

---

Dependencias relevantes (frontend)
- `@react-oauth/google` — GoogleLogin y hooks.
- `jwt-decode` — usado en App para decodificar token (ver nota debajo).
- `lucide-react` — íconos.
- `tailwindcss` — utilidades para estilos.

---

IDs útiles para tests
- `data-testid="google-login-button"` — wrapper del botón Google.
- También existe `frontend/src/constants/testIds/auth.js` con más ids si quieres estandarizar.

---

Notas importantes / Riesgos
- No hardcodear ClientID ni backend URL: usar env vars.
- Verificar `jwt-decode` import: el archivo `App.jsx` usa `import { jwtDecode } from 'jwt-decode'`; la librería exporta normalmente la función por defecto. Posible corrección: `import jwtDecode from 'jwt-decode';` (revisar antes de ejecutar).
- `GoogleLogin` renderiza el botón por defecto y puede ser difícil de estilizar totalmente desde el wrapper. Para control completo, usar `useGoogleLogin` y crear un botón custom.
- Asegurarse de que `GoogleOAuthProvider` envuelve la app, y que la consola de Google tiene agregado el origen de desarrollo en "Authorized JavaScript origins".
- Diferencias de puerto en README vs package.json: revisar `frontend/package.json` (script `start` pone puerto 3000) y README (`5173`). En local, usa el puerto real que vite ejecute y añade ese origen en Google Cloud Console.

---

Guía práctica para cambios estéticos (tareas concretas)
- Objetivo general: modernizar/ajustar la apariencia del login manteniendo la integración funcional.
- Tareas de ejemplo (cada item es independiente, puedes aplicar 1 o varias):
  1. Cambiar la tarjeta blanca por una tarjeta con degradado y sombra suave:
     - Sugerencia Tailwind: `bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-lg`.
  2. Rediseñar el botón de Google:
     - Opción rápida: estilizar el wrapper y aplicar `!important` CSS si hay que sobreescribir el botón nativo.
     - Opción robusta: reemplazar `GoogleLogin` por un botón custom usando `useGoogleLogin` para controlar markup y estilos (ver snippet más abajo).
     - Botón recomendación: `flex items-center gap-3 px-5 py-3 rounded-xl shadow-sm bg-white hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-200`.
     - Añadir icono "G" SVG y texto: "Continuar con Google".
  3. Tipografía y espaciado:
     - H1: `text-4xl md:text-5xl`, subtexto `text-base text-slate-500`.
  4. Añadir micro-animaciones:
     - Hover en tarjeta: `transition-transform duration-200 hover:-translate-y-1`.
     - Aparecer con `animate-fadeIn` (definir keyframes en CSS si hace falta).
  5. Modo oscuro:
     - Añadir clases `dark:` en elementos clave y comprobar que `index.html` y Tailwind están configurados para dark mode si se desea.
  6. Accesibilidad:
     - Asegurarse de `aria-label` en botones y foco visible (`focus:ring`).
  7. Error UX:
     - Convertir el texto de error en un componente `Alert` con icono y botón "Reintentar".
  8. Mobile-first:
     - Asegurar que el layout central no ocupe demasiado en móviles; `max-w-md` está bien, ajustar padding en pantallas pequeñas.

---

Opciones de implementación (con código de ejemplo)
- Implementación mínima: ajustar el wrapper y algunas clases Tailwind en `LoginScreen.jsx`.
- Implementación recomendada para control total del botón Google (ejemplo usando `useGoogleLogin`):

```jsx
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Sparkles, AlertCircle } from 'lucide-react';

export default function LoginScreen({ onSuccess, onError, error }) {
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setLoading(true);
      try {
        onSuccess(tokenResponse); // App.jsx debe manejar fetch al backend
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      onError(err);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* ...encabezado igual... */}
        <div className="bg-white rounded-2xl shadow p-8">
          <button
            onClick={() => login()}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-lg bg-white border hover:shadow-md transition"
            aria-label="Continuar con Google"
          >
            {/* SVG G icon inline o componente */}
            <svg className="w-5 h-5" /* ... */ />
            <span>Continuar con Google</span>
            {loading && <span className="ml-2">Cargando…</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- Nota: con este enfoque tienes control total sobre las clases, estructura y accesibilidad del botón. Recuerda: `useGoogleLogin` devuelve una función `login()`.

---

Pruebas y verificación manual
1. Levantar backend (`cd backend && npm install && npm start`). Asegurarse de `GOOGLE_CLIENT_ID` y `FRONTEND_URL` en .env.
2. Levantar frontend (`cd frontend && npm install && npm run dev`). Establecer `VITE_GOOGLE_CLIENT_ID` y `VITE_BACKEND_URL`.
3. Abrir el frontend y probar:
   - Visual: verificar el nuevo diseño en móvil y escritorio.
   - Google flow: click en el botón → debe abrir popup (oOneTap) y `onSuccess` llega a App.
   - Mensajes de error: simular fallo y verificar alert.
4. Console: revisar errores relacionados con CORS o token audience mismatch.
5. Verificar que `data-testid="google-login-button"` aún esté presente si tests dependen de él, o actualizar ids.

---

Sugerencias para pruebas automáticas
- Unit tests (React Testing Library):
  - Mockear `@react-oauth/google` para exponer un botón que llame a `onSuccess({ credential: 'MOCK' })`.
  - Aserciones: renderizado del título, botón estilizado, comportamiento de error.
- E2E (Cypress / Playwright):
  - Mockear backend o interceptar POST `/api/auth/google` para devolver un usuario simulado.
  - No automatizar la ventana real de Google en CI; usar mocks.

---

Checklist para PR
1. Ejecutar `npm run build` en frontend para asegurar que no hay errores de compilación.
2. Probar interacción completa localmente.
3. Incluir screenshots en la descripción del PR (mobile + desktop).
4. Añadir pruebas unitarias o actualizar mocks si se cambió test-id.
5. Mensaje de commit conciso: `ui(login): refine login screen visuals` y detalles breves en PR.

---

Archivos que probablemente habrá que tocar
- `frontend/src/components/LoginScreen.jsx` (principal)
- `frontend/src/App.jsx` (posible ajuste: mostrar spinner, corregir import de `jwt-decode`)
- `frontend/index.css` o `frontend/src/index.css` (si agregas keyframes o utilidades)
- `tailwind.config.js` (si necesitas extender colores o animaciones)
- Tests y snapshots si existen

---

Requisitos del diseñador / cliente (preguntas que la IA/developer debe hacer antes de comenzar)
- ¿Deseas un rediseño leve (colores, espaciado) o un rediseño completo?
- ¿Tienes paleta de colores, tipografías o logos concretos para aplicar?
- ¿Deseas soporte explícito para modo oscuro?
- ¿Hay restricciones de la marca (uso del botón de Google, texto, tamaño del logo)?
- ¿Prefieres mantener `GoogleLogin` por simplicidad o usar `useGoogleLogin` para control total?

---

Notas finales y recomendaciones de seguridad
- Mantener la verificación del idToken en backend — la UI solo muestra información inmediata.
- No exponer secrets en el frontend.
- Asegurarse que el dominio de desarrollo esté en "Authorized JavaScript origins" en Google Cloud Console.

---

Si quieres, puedo:
1. Crear un PR con cambios estéticos sugeridos (necesito confirmación). 
2. Añadir tests y mocks para el nuevo botón.
3. Implementar una versión alternativa del login usando `useGoogleLogin`.

---

Archivo creado por OpenCode — `frontend/context.md`

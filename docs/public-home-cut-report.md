# Renovación de la pantalla pública — PARTIAL

## Resultado

`PARTIAL`. La pantalla pública, el carrusel, el ActionSheet de autenticación y la
integración en memoria del código de invitación están implementados. Las pruebas
deterministas y el build pasan.

Quedaron sin completar la conversión WebP/AVIF y la comprobación visual responsive
porque el entorno no dispone de un codificador operativo y Chromium no puede
arrancar por una biblioteca del sistema ausente. No se instalaron dependencias.

## Base

- HEAD local inicial: `611ffb0fc614f98d79b9f8ee191897bd7206e53a`.
- `FETCH_HEAD`: `5b5503c1105bad0f6814236b01c0bc869b174928`.
- Recursos recuperados únicamente al working tree desde `FETCH_HEAD`.
- Sin pull, merge, rebase, reset, clean, stage, commit ni push.
- Cambios ajenos preexistentes conservados.

## Implementación

- `LoginScreen` ahora presenta una pantalla móvil pastel con identidad Under
  Flashcards, safe areas, `100dvh`, scroll vertical de respaldo y CTA fijo/sticky.
- Carrusel configurado desde un arreglo de cuatro slides con los textos exactos y
  las imágenes 1–4 en orden.
- Autoplay cada 4.8 segundos, wrap al primer slide, indicadores accesibles,
  navegación directa, swipe con Pointer Events y reinicio tras interacción.
- Pausa por pestaña oculta, hover/interacción y `prefers-reduced-motion`;
  timers/listeners se limpian al cambiar estado o desmontar.
- El CTA reutiliza `frontend/src/components/common/ActionSheet.jsx`; no se creó
  otro modal y no se modificaron sus contratos de portal, foco, overlay, Escape,
  scroll lock, capas, safe area o scroll interno.
- Se conserva un único `GoogleLogin` y sus callbacks. Su superficie tiene borde,
  radio, sombra, foco y estado de carga sobre el botón oficial de Google.
- El código de invitación vive solo en estado React. No se envía a
  `/api/auth/google`. Solo después de `needsInvite` se llama a
  `/api/auth/redeem-invite` con `{ credential, code }` y se presenta el error real
  del servidor. Sin código se conserva `InviteGateScreen` como fallback.
- Una cuenta que ya tiene acceso sigue entrando por la rama existente y el código
  no se canjea.

## Recursos

| Recurso | Original | Optimizado |
|---|---:|---:|
| `Imagen 1.PNG` | 1,967,172 bytes | No generado |
| `Imagen 2.PNG` | 1,867,388 bytes | No generado |
| `Imagen 3.PNG` | 1,789,002 bytes | No generado |
| `Imagen 4.PNG` | 2,551,025 bytes | No generado |

`Test` (1 byte) no se usó, optimizó, modificó ni eliminó.

Vite requiere `?url` porque la extensión original es `.PNG` en mayúsculas. Los
originales se conservaron. El build confirma que actualmente se entregan con su
peso original.

## Bloqueos de optimización y comprobación visual

- No están disponibles `magick`, `convert`, `cwebp`, `avifenc`, `ffmpeg`,
  `pngquant`, `oxipng`, `zopflipng` ni `pngcrush`.
- Pillow no está instalado (`ModuleNotFoundError: No module named 'PIL'`).
- Chromium/Playwright existe, pero no arranca por `libatk-1.0.so.0` ausente.
- La herramienta local de imagen falló por
  `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`.

Por ello no se generaron WebP ni capturas de 360×800, 390×844, 430×932 o desktop.
No se instalaron librerías para evitar incumplir el alcance.

## Verificación

- `npm run test:public-home`: PASS, 4/4.
- `npm run test:manual-editor:unit`: PASS, 58/58.
- `npm run build`: PASS, 2245 módulos transformados.
- `git diff --check`: PASS.
- Lint: no existe script de lint en `frontend/package.json`.
- Playwright responsive: no ejecutado; Chromium está bloqueado por
  `libatk-1.0.so.0` ausente.

## Riesgos residuales

- Las cuatro imágenes suman aproximadamente 8.17 MB sin optimizar.
- Layout, transición, teclado móvil y aspecto real del botón oficial de Google no
  pudieron validarse en navegador/dispositivo.
- El flujo OAuth y el canje requieren Google/backend reales, por lo que se
  verificaron mediante contratos estáticos, no con credenciales ni red.

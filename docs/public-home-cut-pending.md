# Pendientes de la pantalla pública renovada

La implementación funcional del carrusel y la autenticación quedó terminada. Los
siguientes puntos necesitan una sesión posterior con herramientas de imagen y un
entorno de navegador operativo.

## Optimización de ilustraciones

- Convertir `Imagen 1.PNG` a `Imagen 4.PNG` a WebP o AVIF, conservando calidad y
  transparencia donde exista.
- Limitar el lado mayor a aproximadamente 960 px, sin ampliar originales.
- Conservar PNG como fallback solamente si la matriz de navegadores lo requiere.
- Actualizar los imports del carrusel y registrar los pesos finales.

Los PNG actuales suman aproximadamente 8.17 MB. No se generaron variantes porque
el entorno no dispone de `cwebp`, `avifenc`, ImageMagick, FFmpeg ni Pillow.

## Verificación visual responsive

Comprobar con el ActionSheet cerrado y abierto:

- 360 × 800;
- 390 × 844;
- 430 × 932;
- escritorio;
- orientación landscape y pantallas de poca altura.

Revisar especialmente slides 1 y 4, una transición activa, indicadores, CTA,
campo de invitación desplegado, botón oficial de Google, dark mode, zoom y texto
sin recortes.

## Dispositivos y teclado

- Validar teclado real en Safari iOS y Chrome Android.
- Confirmar scroll interno del ActionSheet, safe area y visibilidad del input.
- Confirmar restauración del foco al CTA tras overlay, Escape y cierre explícito.
- Validar swipe horizontal sin bloquear scroll vertical, zoom ni gestos de borde.

## Autenticación real

- Probar Google con una cuenta existente con acceso: el código escrito debe
  ignorarse.
- Probar un usuario nuevo con código válido, inválido, revocado y ya utilizado.
- Confirmar el fallback `InviteGateScreen` cuando no se introduce código.
- Confirmar estados de carga y error del botón oficial en red lenta o fallo OAuth.

## Bloqueo observado

Chromium/Playwright estaba instalado, pero no pudo arrancar por la ausencia de
`libatk-1.0.so.0`. No deben instalarse binarios o dependencias automáticamente;
la siguiente sesión debe disponer previamente de un entorno compatible.

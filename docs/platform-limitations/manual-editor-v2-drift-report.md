# Informe de drift previo a la arquitectura V2

**Commit auditado en Fase 2:** `bc541f930f7fc6e3eb055adb0cb4a232d5099b5c`.  
**Commit actual revalidado:** `ba3027f0d34fa9297f4224235eef263f3d387671`.  
**Fecha de revalidación:** 2026-08-08.  
**Resultado:** el repositorio avanzó dos commits, pero no cambió código de producción. Ningún hallazgo P0, P1 o `KEEP` de Fase 2 quedó obsoleto.

## Comparación del repositorio

La comparación oficial entre commits registra únicamente:

| Ruta | Cambio |
|---|---|
| `docs/platform-limitations/README.md` | Se añadió el índice de la auditoría de Fase 2. |
| `docs/platform-limitations/manual-editor-audit.md` | Se incorporó al historial. |
| `docs/platform-limitations/manual-editor-dependency-map.md` | Se incorporó al historial. |
| `docs/platform-limitations/manual-editor-conflicts.md` | Se incorporó al historial. |
| `docs/platform-limitations/manual-editor-runtime-inventory.md` | Se incorporó al historial. |
| `docs/platform-limitations/Test` | Se eliminó el archivo marcador. |

`git diff bc541f9..ba3027f -- frontend/src backend/src` devuelve cero rutas. La comparación remota también contiene únicamente los seis cambios documentales anteriores.

## Archivos revalidados

Los siguientes blobs son idénticos entre el commit auditado y el commit actual:

| Archivo | Blob actual | Estado del hallazgo |
|---|---|---|
| `frontend/src/components/creator/ManualCardEditorModal.jsx` | `5fb3896552d9e0adc9808f4097ba92176432a864` | Vigente sin cambios. |
| `frontend/src/components/creator/StylePanel.jsx` | `ba944e932ad88ef0e1ad6700b3dca4819eedd232` | Vigente sin cambios. |
| `frontend/src/components/common/ActionSheet.jsx` | `f54e7ec2bb893a0b1b5193b8c0f1621ef5c81209` | Vigente sin cambios. |
| `frontend/src/components/FlashcardCreator.jsx` | `d3f2cae00eff2aa2edcbe09c9e3cc59096e7f0bd` | Vigente sin cambios. |
| `frontend/src/components/creator/FormInputs.jsx` | `144dfba3a642163aaf253a137e6558dece97ea0d` | Vigente sin cambios. |
| `frontend/src/components/DeckInterior.jsx` | `dcbce121d5d9e6c1cdcdaac9fe9ba88554dcc6fa` | Vigente sin cambios. |
| `frontend/src/App.jsx` | `4c84bb52a1d3435b6183ee14aa8e9fec40ddc501` | Vigente sin cambios. |
| `frontend/src/index.css` | `55c1c6195ccf233319fc48d85525b96f06512df4` | Vigente sin cambios. |
| `frontend/index.html` | `d39545b8dd722e039756d5461f28b4dd5f6e2e13` | Vigente sin cambios. |
| `frontend/src/lib/scrollLock.js` | `67c0b6c3e7bda65bc99ac714db3225215bd99569` | Vigente sin cambios. |
| `frontend/src/hooks/useKeyboardHeight.js` | `b37edc4f8eed5e6cb3d4817c0f5d8e783cc4fc77` | Vigente y sigue fuera del grafo del editor. |
| `frontend/src/hooks/useModalAccessibility.js` | `2e268c93fe23a1aa5a81e0ae4bea52caf979f0c5` | Vigente y sigue sin ser reutilizable directamente. |

## Hallazgos afectados

| Hallazgo o grupo | Cambio encontrado | ¿Sigue vigente? | Efecto sobre V2 |
|---|---|---|---|
| Todos los `EDITOR-*` P0/P1 | Ningún cambio de código. | Sí. | Se conservan prioridad, evidencia y alcance. |
| `KEEP-001` a `KEEP-013` | Ningún cambio de código. | Sí. | Se preservan como restricciones de migración. |
| `EDITOR-HOOK-001` | `useKeyboardHeight` conserva fórmula, observers y timers auditados. | Sí. | V2 mantiene la prohibición de importarlo; su refactor global permanece fuera de alcance. |
| `EDITOR-AS-001` | `ActionSheet` conserva `preserveFocus` y su trap local. | Sí. | Requiere un corte compartido independiente y pruebas de todos sus callers. |
| `EDITOR-SCROLL-001` | App `main` continúa siendo el scroller y el modal sigue bloqueando `body` inline. | Sí. | El lease debe apuntar al nodo real y evolucionar `scrollLock.js`, no duplicarlo. |
| `EDITOR-DEAD-001` | Ningún caller empezó a pasar `onFooterHeightChange`. | Sí, P2. | Puede retirarse solo en el corte final tras reconfirmar callers. |

## Decisión

La arquitectura V2 se diseña sobre `ba3027f0d34fa9297f4224235eef263f3d387671`. No se corrige ni descarta ningún hallazgo por drift. El único efecto del cambio de repositorio es que los documentos de Fase 2 ya son archivos rastreados y la Fase 3 debe añadir sus entregables de forma incremental.

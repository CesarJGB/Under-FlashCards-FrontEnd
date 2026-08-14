// FILE: backend/src/utils/imageContractTelemetry.js
// Fase 1G — Corte 5A: observabilidad temporal del contrato legacy de entrega
// de imágenes. Clasifica el contrato negociado por las cinco lecturas y emite
// como máximo UNA línea JSON estable por petición, sin PII y sin contadores.
//
// Esta utilidad es observación pura: no cambia payloads, status HTTP ni
// comportamiento de las rutas; un logger que lance jamás rompe la petición.
// No requiere base de datos, endpoint nuevo, dependencias ni servicios
// externos: queda activa automáticamente al desplegar el backend y se retira
// íntegramente en el Corte 5B (retirar esta utilidad, sus llamadas en los
// controladores y sus pruebas).

// Únicas superficies observadas (lecturas negociadas del contrato).
const SURFACES = new Set([
  'deck-list',
  'deck-cards',
  'continuous-session',
  'normal-session',
  'all-cards',
]);

// Clasifica el valor crudo del query parameter `contract`:
//   'indexed'       => valor exacto 'indexed' (contrato indexado).
//   undefined       => la propiedad no fue enviada (legacy por defecto).
//   cualquier otro  => otro valor o tipo, incluyendo '' o array (legacy).
function classifyContract(contractValue) {
  if (contractValue === 'indexed') return 'indexed';
  if (contractValue === undefined) return 'legacy-missing';
  return 'legacy-other';
}

// Clasifica el valor crudo del query parameter `cover`:
//   'thumbnail' => valor exacto 'thumbnail'.
//   undefined   => la propiedad no fue enviada.
//   otro valor  => otro valor o tipo, incluyendo '' o array.
//   'not-applicable' => la superficie no negocia cover (todo excepto deck-list).
function classifyCover(coverValue, surface) {
  if (surface !== 'deck-list') return 'not-applicable';
  if (coverValue === 'thumbnail') return 'thumbnail';
  if (coverValue === undefined) return 'absent';
  return 'other';
}

// Esquema estable del evento. `at` es opcional para poder fijar la fecha en
// pruebas; en producción es `new Date().toISOString()` (UTC).
function buildUsageEvent({ surface, contract, cover, at }) {
  return {
    event: 'image_delivery_contract_usage',
    schemaVersion: 1,
    at: at || new Date().toISOString(),
    surface,
    contract,
    cover,
  };
}

// Registra una línea JSON por petición (máximo una). Sólo observa `query`:
// no accede a params, headers, body, IP ni URL, por lo que nunca transporta
// userId, deckId, ids de tarjetas, tokens ni contenido. Superficies no
// permitidas: no registra nada. Devuelve true si registró; false si la
// superficie no es permitida o el logger falló (sin lanzar jamás).
function logImageDeliveryContractUsage({ surface, req, logger = console }) {
  if (!SURFACES.has(surface)) return false;
  const query = req && req.query ? req.query : {};
  const event = buildUsageEvent({
    surface,
    contract: classifyContract(query.contract),
    cover: classifyCover(query.cover, surface),
  });
  try {
    logger.log(JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  SURFACES,
  classifyContract,
  classifyCover,
  buildUsageEvent,
  logImageDeliveryContractUsage,
};

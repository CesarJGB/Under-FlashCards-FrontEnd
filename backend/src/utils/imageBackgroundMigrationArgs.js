// FILE: backend/src/utils/imageBackgroundMigrationArgs.js
// Fase 1F — Corte 4: parseo PURO de argumentos del script de migración de
// fondos (migrateImageBackgrounds.js). Separado de los efectos de base de
// datos para poder probarse sin credenciales ni conexión.
//
// Contrato del modo de ejecución:
// - Sin --apply, el modo es SIEMPRE dry-run.
// - Se exige exactamente un alcance: --deck-id=<id>, --user-id=<id> o --all.
// - --all exige además --confirm-all.
// - La escritura exige simultáneamente --apply, --backup-confirmed y
//   --maintenance-confirmed.
// - Cualquier argumento desconocido o combinación inválida lanza
//   MigrationUsageError con el motivo en español.

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

class MigrationUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationUsageError';
  }
}

function requireNoValue(name, inlineValue) {
  if (inlineValue !== null) {
    throw new MigrationUsageError(`${name} no acepta un valor (${name}=...).`);
  }
}

function requireValue(name, inlineValue, argv, index) {
  if (inlineValue !== null) {
    if (inlineValue === '') {
      throw new MigrationUsageError(`${name} requiere un valor no vacío.`);
    }
    return inlineValue;
  }
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('--')) {
    throw new MigrationUsageError(`${name} requiere un valor (${name}=<id> o ${name} <id>).`);
  }
  return next;
}

function validateObjectId(name, value) {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new MigrationUsageError(`${name} debe ser un ObjectId de 24 caracteres hexadecimales.`);
  }
}

// Parsea los argumentos (sin nombre de script, es decir process.argv.slice(2)).
// Devuelve un objeto normalizado:
//   { dryRun, apply, scope: 'deck'|'user'|'all', deckId|null, userId|null,
//     confirmAll, backupConfirmed, maintenanceConfirmed }
function parseImageBackgroundMigrationArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const options = {
    apply: false,
    backupConfirmed: false,
    maintenanceConfirmed: false,
    confirmAll: false,
    all: false,
    deckId: null,
    userId: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (typeof token !== 'string' || !token.startsWith('--')) {
      throw new MigrationUsageError(`Argumento desconocido: ${token}`);
    }
    const eq = token.indexOf('=');
    const name = eq === -1 ? token : token.slice(0, eq);
    const inlineValue = eq === -1 ? null : token.slice(eq + 1);

    switch (name) {
      case '--apply':
        requireNoValue(name, inlineValue);
        options.apply = true;
        break;
      case '--backup-confirmed':
        requireNoValue(name, inlineValue);
        options.backupConfirmed = true;
        break;
      case '--maintenance-confirmed':
        requireNoValue(name, inlineValue);
        options.maintenanceConfirmed = true;
        break;
      case '--confirm-all':
        requireNoValue(name, inlineValue);
        options.confirmAll = true;
        break;
      case '--all':
        requireNoValue(name, inlineValue);
        options.all = true;
        break;
      case '--deck-id': {
        const value = requireValue(name, inlineValue, args, index);
        if (inlineValue === null) index += 1;
        validateObjectId(name, value);
        options.deckId = value;
        break;
      }
      case '--user-id': {
        const value = requireValue(name, inlineValue, args, index);
        if (inlineValue === null) index += 1;
        validateObjectId(name, value);
        options.userId = value;
        break;
      }
      default:
        throw new MigrationUsageError(`Argumento desconocido: ${token}`);
    }
  }

  const scopeCount = [options.deckId !== null, options.userId !== null, options.all]
    .filter(Boolean).length;
  if (scopeCount === 0) {
    throw new MigrationUsageError(
      'Se requiere exactamente un alcance: --deck-id=<id>, --user-id=<id> o --all.'
    );
  }
  if (scopeCount > 1) {
    throw new MigrationUsageError(
      'Sólo se permite un alcance: --deck-id, --user-id o --all, no varios a la vez.'
    );
  }
  if (options.all && !options.confirmAll) {
    throw new MigrationUsageError('--all exige --confirm-all para confirmar el alcance global.');
  }
  if (!options.all && options.confirmAll) {
    throw new MigrationUsageError('--confirm-all sólo es válido junto con --all.');
  }
  if (options.apply && (!options.backupConfirmed || !options.maintenanceConfirmed)) {
    throw new MigrationUsageError(
      'La escritura exige simultáneamente --apply, --backup-confirmed y --maintenance-confirmed.'
    );
  }

  return {
    dryRun: !options.apply,
    apply: options.apply,
    scope: options.all ? 'all' : options.deckId !== null ? 'deck' : 'user',
    deckId: options.deckId,
    userId: options.userId,
    confirmAll: options.confirmAll,
    backupConfirmed: options.backupConfirmed,
    maintenanceConfirmed: options.maintenanceConfirmed,
  };
}

module.exports = {
  MigrationUsageError,
  parseImageBackgroundMigrationArgs,
};

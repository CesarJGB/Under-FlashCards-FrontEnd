// FILE: backend/test/imageBackgroundMigrationArgs.test.js
// Fase 1F — Corte 4: pruebas deterministas del parseo de argumentos
// backend/src/utils/imageBackgroundMigrationArgs.js. Sin conexión a MongoDB,
// sin credenciales y sin red.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseImageBackgroundMigrationArgs,
  MigrationUsageError,
} = require('../src/utils/imageBackgroundMigrationArgs');

const DECK_ID = '0123456789abcdef01234567';
const USER_ID = 'abcdef0123456789abcdef01';

function expectUsageError(argv, pattern) {
  assert.throws(
    () => parseImageBackgroundMigrationArgs(argv),
    (error) => {
      assert.ok(error instanceof MigrationUsageError, `esperaba MigrationUsageError, recibió ${error.name}`);
      if (pattern) assert.match(error.message, pattern);
      return true;
    }
  );
}

// ---------------------------------------------------------------------------
// Alcance
// ---------------------------------------------------------------------------

test('args: sin argumentos → error de alcance', () => {
  expectUsageError([], /exactamente un alcance/);
});

test('args: --apply sin alcance → error de alcance', () => {
  expectUsageError(['--apply'], /exactamente un alcance/);
});

test('args: --deck-id=<id> por defecto es dry-run', () => {
  const parsed = parseImageBackgroundMigrationArgs([`--deck-id=${DECK_ID}`]);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.apply, false);
  assert.equal(parsed.scope, 'deck');
  assert.equal(parsed.deckId, DECK_ID);
  assert.equal(parsed.userId, null);
});

test('args: --user-id=<id> por defecto es dry-run', () => {
  const parsed = parseImageBackgroundMigrationArgs([`--user-id=${USER_ID}`]);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.scope, 'user');
  assert.equal(parsed.userId, USER_ID);
  assert.equal(parsed.deckId, null);
});

test('args: --deck-id acepta el valor separado por espacio', () => {
  const parsed = parseImageBackgroundMigrationArgs(['--deck-id', DECK_ID]);
  assert.equal(parsed.scope, 'deck');
  assert.equal(parsed.deckId, DECK_ID);
});

test('args: --user-id acepta 24 hex en mayúsculas', () => {
  const parsed = parseImageBackgroundMigrationArgs(['--user-id=ABCDEF0123456789ABCDEF01']);
  assert.equal(parsed.scope, 'user');
  assert.equal(parsed.userId, 'ABCDEF0123456789ABCDEF01');
});

test('args: dos alcances simultáneos → error', () => {
  expectUsageError([`--deck-id=${DECK_ID}`, `--user-id=${USER_ID}`], /un alcance/);
  expectUsageError([`--deck-id=${DECK_ID}`, '--all'], /un alcance/);
  expectUsageError([`--user-id=${USER_ID}`, '--all'], /un alcance/);
});

// ---------------------------------------------------------------------------
// --all y --confirm-all
// ---------------------------------------------------------------------------

test('args: --all sin --confirm-all → error', () => {
  expectUsageError(['--all'], /--confirm-all/);
});

test('args: --all --confirm-all → dry-run global', () => {
  const parsed = parseImageBackgroundMigrationArgs(['--all', '--confirm-all']);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.scope, 'all');
  assert.equal(parsed.confirmAll, true);
});

test('args: --confirm-all sin --all → error', () => {
  expectUsageError(`--confirm-all --deck-id=${DECK_ID}`.split(' '), /--all/);
});

// ---------------------------------------------------------------------------
// Protecciones del modo --apply
// ---------------------------------------------------------------------------

test('args: --apply con alcance sin confirmaciones → error', () => {
  expectUsageError(`--apply --deck-id=${DECK_ID}`.split(' '), /--backup-confirmed/);
});

test('args: --apply --backup-confirmed sin --maintenance-confirmed → error', () => {
  expectUsageError(
    `--apply --backup-confirmed --deck-id=${DECK_ID}`.split(' '),
    /--maintenance-confirmed/
  );
});

test('args: --apply --maintenance-confirmed sin --backup-confirmed → error', () => {
  expectUsageError(
    `--apply --maintenance-confirmed --deck-id=${DECK_ID}`.split(' '),
    /--backup-confirmed/
  );
});

test('args: la escritura exige simultáneamente --apply, --backup-confirmed y --maintenance-confirmed', () => {
  const parsed = parseImageBackgroundMigrationArgs([
    '--apply',
    '--backup-confirmed',
    '--maintenance-confirmed',
    `--deck-id=${DECK_ID}`,
  ]);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.dryRun, false);
  assert.equal(parsed.backupConfirmed, true);
  assert.equal(parsed.maintenanceConfirmed, true);
});

test('args: --all con las tres señales → modo apply global', () => {
  const parsed = parseImageBackgroundMigrationArgs([
    '--all',
    '--confirm-all',
    '--apply',
    '--backup-confirmed',
    '--maintenance-confirmed',
  ]);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.dryRun, false);
  assert.equal(parsed.scope, 'all');
});

test('args: confirmaciones sin --apply se aceptan y mantienen dry-run', () => {
  const parsed = parseImageBackgroundMigrationArgs([
    '--backup-confirmed',
    '--maintenance-confirmed',
    `--deck-id=${DECK_ID}`,
  ]);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.apply, false);
  assert.equal(parsed.backupConfirmed, true);
  assert.equal(parsed.maintenanceConfirmed, true);
});

// ---------------------------------------------------------------------------
// Argumentos desconocidos o mal formados
// ---------------------------------------------------------------------------

test('args: flag desconocido → error', () => {
  expectUsageError(['--nope'], /desconocido/);
  expectUsageError(['posicional'], /desconocido/);
});

test('args: --deck-id con formato inválido → error', () => {
  expectUsageError(['--deck-id=short'], /ObjectId de 24 caracteres/);
  expectUsageError(['--deck-id=0123456789abcdef0123456z'], /ObjectId de 24 caracteres/);
});

test('args: --user-id con formato inválido → error', () => {
  expectUsageError(['--user-id=123'], /ObjectId de 24 caracteres/);
});

test('args: --deck-id sin valor → error', () => {
  expectUsageError(['--deck-id'], /requiere un valor/);
  expectUsageError(['--deck-id', '--apply'], /requiere un valor/);
});

test('args: --deck-id con valor vacío → error', () => {
  expectUsageError(['--deck-id='], /valor no vacío/);
});

test('args: flag con valor no aceptado → error', () => {
  expectUsageError(['--apply=1', `--deck-id=${DECK_ID}`], /no acepta un valor/);
  expectUsageError(['--all=true', '--confirm-all'], /no acepta un valor/);
});

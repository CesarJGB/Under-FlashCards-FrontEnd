#!/usr/bin/env node

/*
 * Real A/B benchmark for the original and combined deck pipelines.
 *
 * Usage from backend/:
 *   node test/benchmarkV2.js --user-id <mongo-user-id> [--port <port>]
 *
 * The script uses ALLOW_DEV_USER_ID only for this local benchmark. It can
 * target a specific user with BENCHMARK_USER_ID or --user-id, creates two
 * temporary decks per repetition, runs both endpoints with the same extracted
 * PDF text, alternates execution order, and deletes the test data.
 */
const fs = require('fs');
const path = require('path');
const { once } = require('events');
const { performance } = require('node:perf_hooks');
const { spawn } = require('child_process');

const backendDirectory = path.resolve(__dirname, '..');
const fixturesDirectory = '/home/ubuntu/test-fixtures';
const targetCount = 100;
const runsPerVersion = 4;
const defaultPort = 8022;

function findFirstPdf(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`No existe el directorio de fixtures: ${directory}`);
  }

  const fileName = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second))[0];

  if (!fileName) throw new Error(`No se encontró ningún PDF en ${directory}.`);
  return path.join(directory, fileName);
}

async function extractPdfText(pdfPath) {
  let pdfParse;
  try {
    const imported = require('pdf-parse');
    pdfParse = typeof imported === 'function' ? imported : imported.default;
  } catch (error) {
    throw new Error('Falta pdf-parse. Instálalo con: npm install pdf-parse', { cause: error });
  }

  if (typeof pdfParse !== 'function') {
    throw new Error('La versión instalada de pdf-parse no expone una función de parseo compatible.');
  }

  const result = await pdfParse(fs.readFileSync(pdfPath));
  const text = result?.text?.trim();
  if (!text) throw new Error('El PDF no contiene texto extraíble.');
  return text;
}

function parsePort(value) {
  const port = Number.parseInt(value || defaultPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('El puerto debe ser un entero entre 1 y 65535.');
  }
  return port;
}

function parseArguments(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) return { help: true };

  let userId = process.env.BENCHMARK_USER_ID || null;
  let portValue = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--user-id') {
      userId = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--port') {
      portValue = args[index + 1];
      index += 1;
      continue;
    }
    if (/^\d+$/.test(argument) && portValue === null) {
      portValue = argument;
      continue;
    }
    if (!argument.startsWith('-') && !userId) userId = argument;
  }

  if (userId && !/^[a-f\d]{24}$/i.test(userId)) {
    throw new Error('El userId debe ser un ObjectId de MongoDB de 24 caracteres hexadecimales.');
  }

  return { userId, port: parsePort(portValue) };
}

function startServer(port) {
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      ALLOW_DEV_USER_ID: 'true',
      AI_DEBUG_LOGS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Drain both pipes so a verbose provider or database log cannot block the
  // child process while the benchmark is running.
  server.stdout.resume();
  server.stderr.resume();
  return server;
}

async function waitForServer(port, server) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`El servidor de benchmark terminó antes de iniciar (código ${server.exitCode}).`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The server may still be connecting to MongoDB or binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor de benchmark no respondió dentro de 30 segundos.');
}

async function readSseResponse(response) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`La API respondió HTTP ${response.status}: ${body}`);
  }
  if (!response.body) throw new Error('La API no devolvió un stream SSE.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completion = null;

  const processEvent = (rawEvent) => {
    const event = rawEvent.replace(/\r/g, '');
    const eventType = event.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = event.match(/^data:\s*(.+)$/m)?.[1];
    if (!eventType || !data) return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      throw new Error('La API devolvió un evento SSE no válido.', { cause: error });
    }

    if (eventType === 'complete') completion = payload;
    if (eventType === 'error') {
      throw new Error(payload?.error || 'La API emitió un error SSE.');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r/g, '');

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      processEvent(buffer.slice(0, separatorIndex));
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');
    }
    if (done) break;
  }

  if (!completion) throw new Error('La API cerró el stream sin evento complete.');
  return completion;
}

async function runGeneration({ port, endpoint, userId, deckId, text }) {
  const startedAt = performance.now();
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'x-user-id': String(userId),
    },
    body: JSON.stringify({
      deckId: String(deckId),
      text,
      count: targetCount,
      batchStyles: { textAlign: 'center', fontSize: 'text-base' },
    }),
  });
  const completion = await readSseResponse(response);
  const durationMs = performance.now() - startedAt;
  const tokenUsage = completion.metrics?.tokenUsage || {};
  const promptTokens = Number(tokenUsage.promptTokens);
  const completionTokens = Number(tokenUsage.completionTokens);
  const reportedTotalTokens = Number(tokenUsage.totalTokens);
  const fallbackTotalTokens = [promptTokens, completionTokens].every(Number.isFinite)
    && promptTokens + completionTokens > 0
    ? promptTokens + completionTokens
    : null;

  return {
    durationMs,
    tokens: Number.isFinite(reportedTotalTokens) && reportedTotalTokens > 0
      ? reportedTotalTokens
      : fallbackTotalTokens,
    accepted: Number(completion.createdCount) || Number(completion.metrics?.accepted) || 0,
    runId: completion.runId || null,
  };
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    once(server, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

function formatSeconds(durationMs) {
  return Number.isFinite(durationMs) ? (durationMs / 1000).toFixed(3) : 'N/D';
}

function formatTokens(tokens) {
  return Number.isFinite(tokens) ? Math.round(tokens).toLocaleString('es-MX') : 'N/D';
}

function average(values) {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length > 0
    ? finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length
    : null;
}

function median(values) {
  const finiteValues = values.filter(Number.isFinite).sort((first, second) => first - second);
  if (finiteValues.length === 0) return null;
  const middle = Math.floor(finiteValues.length / 2);
  return finiteValues.length % 2 === 0
    ? (finiteValues[middle - 1] + finiteValues[middle]) / 2
    : finiteValues[middle];
}

function summarizeResults(results, version) {
  const versionResults = results.map((run) => run[version]);
  const durations = versionResults.map((result) => result.durationMs);
  const tokens = versionResults.map((result) => result.tokens);
  const accepted = versionResults.map((result) => result.accepted);
  return {
    averageDurationMs: average(durations),
    medianDurationMs: median(durations),
    minimumDurationMs: Math.min(...durations),
    maximumDurationMs: Math.max(...durations),
    averageTokens: average(tokens),
    totalTokens: tokens.filter(Number.isFinite).reduce((total, value) => total + value, 0),
    averageAccepted: average(accepted),
    allReachedTarget: accepted.every((value) => value === targetCount),
  };
}

async function main() {
  const options = parseArguments();
  if (options.help) {
    console.log('Uso: node test/benchmarkV2.js --user-id <mongo-user-id> [--port <puerto>]');
    console.log('También puedes definir BENCHMARK_USER_ID y pasar solo el puerto.');
    return;
  }
  const { userId, port } = options;
  const pdfPath = findFirstPdf(fixturesDirectory);
  const sourceText = await extractPdfText(pdfPath);

  require('dotenv').config({ path: path.join(backendDirectory, '.env') });
  const mongoose = require('mongoose');
  const User = require('../src/models/User');
  const Deck = require('../src/models/Deck');
  const Flashcard = require('../src/models/Flashcard');

  let server = null;
  const temporaryDeckIds = [];
  const results = [];

  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGO_URL, {
      dbName: process.env.DB_NAME || 'flashcards',
      serverSelectionTimeoutMS: 30000,
    });

    const user = await User.findOne({
      ...(userId ? { _id: userId } : {}),
      aiApiKey: { $type: 'string', $ne: '' },
    }).select('_id').lean();
    if (!user) {
      throw new Error(userId
        ? `El usuario ${userId} no existe o no tiene una API key de IA configurada.`
        : 'No hay un usuario de prueba con una API key de IA configurada.');
    }

    server = startServer(port);
    await waitForServer(port, server);

    for (let run = 1; run <= runsPerVersion; run += 1) {
      const oldDeck = await Deck.create({
        userId: user._id,
        title: `Benchmark IA antigua ${run} ${new Date().toISOString()}`,
      });
      temporaryDeckIds.push(oldDeck._id);
      const v2Deck = await Deck.create({
        userId: user._id,
        title: `Benchmark IA V2 ${run} ${new Date().toISOString()}`,
      });
      temporaryDeckIds.push(v2Deck._id);

      const variants = run % 2 === 1
        ? [
          { key: 'old', label: 'Antigua', endpoint: '/api/flashcards/generate-ai', deckId: oldDeck._id },
          { key: 'v2', label: 'Nueva V2', endpoint: '/api/flashcards/generate-ai-v2', deckId: v2Deck._id },
        ]
        : [
          { key: 'v2', label: 'Nueva V2', endpoint: '/api/flashcards/generate-ai-v2', deckId: v2Deck._id },
          { key: 'old', label: 'Antigua', endpoint: '/api/flashcards/generate-ai', deckId: oldDeck._id },
        ];
      const runResults = {};

      for (const variant of variants) {
        console.log(`[benchmark-v2] Corrida ${run}/${runsPerVersion}: ${variant.label} (${variant.endpoint})`);
        const result = await runGeneration({
          port,
          endpoint: variant.endpoint,
          userId: user._id,
          deckId: variant.deckId,
          text: sourceText,
        });
        result.accepted = await Flashcard.countDocuments({ deckId: variant.deckId });
        runResults[variant.key] = result;
        console.log(`  ${formatSeconds(result.durationMs)} s | ${formatTokens(result.tokens)} tokens | ${result.accepted} tarjetas`);
      }

      results.push({
        run,
        order: variants.map((variant) => variant.key).join(' -> '),
        ...runResults,
      });

      // Delete each pair immediately so a failed later repetition cannot leave
      // completed benchmark data in the user's account until process exit.
      await Flashcard.deleteMany({ deckId: { $in: [oldDeck._id, v2Deck._id] } });
      await Deck.deleteMany({ _id: { $in: [oldDeck._id, v2Deck._id] } });
    }
  } finally {
    if (temporaryDeckIds.length > 0) {
      await Flashcard.deleteMany({ deckId: { $in: temporaryDeckIds } });
      await Deck.deleteMany({ _id: { $in: temporaryDeckIds } });
    }
    await stopServer(server);
    await mongoose.disconnect();
  }

  console.log(`\nPDF: ${pdfPath}`);
  console.log(`Texto extraído: ${sourceText.length.toLocaleString('es-MX')} caracteres`);
  console.log(`Objetivo: ${targetCount} tarjetas por método`);
  console.log(`Repeticiones: ${runsPerVersion} por método`);
  console.log('');
  console.log('| Versión | Prueba | Orden de ejecución | Tiempo (s) | Tokens | Tarjetas |');
  console.log('| --- | ---: | --- | ---: | ---: | ---: |');
  for (const run of results) {
    console.log(`| Antigua | ${run.run} | ${run.order} | ${formatSeconds(run.old.durationMs)} | ${formatTokens(run.old.tokens)} | ${run.old.accepted} |`);
    console.log(`| Nueva V2 | ${run.run} | ${run.order} | ${formatSeconds(run.v2.durationMs)} | ${formatTokens(run.v2.tokens)} | ${run.v2.accepted} |`);
  }

  const oldSummary = summarizeResults(results, 'old');
  const v2Summary = summarizeResults(results, 'v2');
  const timeReduction = oldSummary.averageDurationMs && v2Summary.averageDurationMs
    ? (1 - v2Summary.averageDurationMs / oldSummary.averageDurationMs) * 100
    : null;
  const tokenReduction = oldSummary.averageTokens && v2Summary.averageTokens
    ? (1 - v2Summary.averageTokens / oldSummary.averageTokens) * 100
    : null;

  console.log('');
  console.log('| Resumen | Antigua | Nueva V2 |');
  console.log('| --- | ---: | ---: |');
  console.log(`| Tiempo promedio (s) | ${formatSeconds(oldSummary.averageDurationMs)} | ${formatSeconds(v2Summary.averageDurationMs)} |`);
  console.log(`| Mediana de tiempo (s) | ${formatSeconds(oldSummary.medianDurationMs)} | ${formatSeconds(v2Summary.medianDurationMs)} |`);
  console.log(`| Tiempo mínimo (s) | ${formatSeconds(oldSummary.minimumDurationMs)} | ${formatSeconds(v2Summary.minimumDurationMs)} |`);
  console.log(`| Tiempo máximo (s) | ${formatSeconds(oldSummary.maximumDurationMs)} | ${formatSeconds(v2Summary.maximumDurationMs)} |`);
  console.log(`| Tokens promedio | ${formatTokens(oldSummary.averageTokens)} | ${formatTokens(v2Summary.averageTokens)} |`);
  console.log(`| Tokens acumulados | ${formatTokens(oldSummary.totalTokens)} | ${formatTokens(v2Summary.totalTokens)} |`);
  console.log(`| Tarjetas promedio | ${oldSummary.averageAccepted} | ${v2Summary.averageAccepted} |`);
  console.log(`| Todas las corridas alcanzaron ${targetCount} | ${oldSummary.allReachedTarget ? 'Sí' : 'No'} | ${v2Summary.allReachedTarget ? 'Sí' : 'No'} |`);
  console.log('');
  console.log(`Reducción media de tiempo V2: ${Number.isFinite(timeReduction) ? `${timeReduction.toFixed(2)}%` : 'N/D'}`);
  console.log(`Reducción media de tokens V2: ${Number.isFinite(tokenReduction) ? `${tokenReduction.toFixed(2)}%` : 'N/D'}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[benchmark-v2] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  extractPdfText,
  findFirstPdf,
  parseArguments,
  readSseResponse,
  runGeneration,
};

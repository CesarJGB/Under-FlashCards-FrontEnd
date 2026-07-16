/*
 * Manual integration benchmark for the deck AI pipeline.
 *
 * Usage from backend/:
 *   node scripts/benchmarkAiDeck.js run-1 8011
 *
 * It uses a temporary deck, deletes it (and its generated cards) afterward,
 * and keeps the server-side AI telemetry under test_reports/ai-benchmark.
 */
const { once } = require('events');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

const rootDirectory = path.resolve(__dirname, '..', '..');
const backendDirectory = path.join(rootDirectory, 'backend');
const reportsDirectory = path.join(rootDirectory, 'test_reports', 'ai-benchmark');
const pdfPath = '/home/ubuntu/test-fixtures/Farma EsmeNotas Act20Ene26.pdf';
const targetCount = 520;

function parseArguments() {
  const [runName, portValue] = process.argv.slice(2);
  const port = Number.parseInt(portValue, 10);
  if (!runName || !/^[a-z0-9-]+$/i.test(runName) || !Number.isInteger(port) || port < 1) {
    throw new Error('Uso: node scripts/benchmarkAiDeck.js <nombre-corrida> <puerto>.');
  }
  return { runName, port };
}

function appendJsonLine(stream, event, payload = {}) {
  stream.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...payload })}\n`);
}

async function extractPdfText() {
  const pdfModulePath = path.join(
    rootDirectory,
    'frontend',
    'node_modules',
    'pdfjs-dist',
    'legacy',
    'build',
    'pdf.mjs'
  );
  const pdfjsLib = await import(pathToFileURL(pdfModulePath).href);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = pdf.numPages;
  const extractedChunks = [];
  let pagesWithText = 0;

  try {
    for (let pageNum = 1; pageNum <= pages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      try {
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items
          .map((item) => (typeof item?.str === 'string' ? item.str : ''))
          .filter(Boolean);

        if (pageStrings.length > 0) {
          extractedChunks.push(`\n--- [Texto de la Pagina ${pageNum}] ---\n${pageStrings.join(' ')}`);
          pagesWithText += 1;
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await pdf.destroy();
  }

  const text = extractedChunks.join('').trim();
  if (!text) throw new Error('El PDF no contiene texto extraible.');
  return { text, pages, pagesWithText };
}

function startServer(port, serverLog) {
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      AI_DEBUG_LOGS: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(serverLog, { end: false });
  server.stderr.pipe(serverLog, { end: false });
  return server;
}

async function waitForServer(port, server) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`El servidor de benchmark finalizo antes de iniciar (codigo ${server.exitCode}).`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor de benchmark no respondio dentro de 30 segundos.');
}

async function readSseResponse(response, clientLog) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`La API respondio ${response.status}: ${body}`);
  }
  if (!response.body) throw new Error('La API no devolvio un stream SSE.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completion = null;

  const processEvent = (rawEvent) => {
    const event = rawEvent.replace(/\r/g, '');
    const eventType = event.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = event.match(/^data:\s*(.+)$/m)?.[1];
    if (!eventType || !data) return;

    const payload = JSON.parse(data);
    appendJsonLine(clientLog, `sse_${eventType}`, { payload });
    if (eventType === 'complete') completion = payload;
    if (eventType === 'error') {
      throw new Error(payload?.error || 'La API emitio un error SSE.');
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

  if (!completion) throw new Error('La API cerro el stream sin evento complete.');
  return completion;
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    once(server, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

function saveRunCompletedLog(serverLogPath, runCompletedPath) {
  const lines = fs.readFileSync(serverLogPath, 'utf8').split(/\r?\n/);
  const runCompletedLines = lines.filter((line) => {
    if (!line.startsWith('[ai] ')) return false;
    try {
      return JSON.parse(line.slice(5)).event === 'run_completed';
    } catch {
      return false;
    }
  });
  fs.writeFileSync(runCompletedPath, `${runCompletedLines.join('\n')}\n`);
  return runCompletedLines.length;
}

async function main() {
  const { runName, port } = parseArguments();
  fs.mkdirSync(reportsDirectory, { recursive: true });
  const serverLogPath = path.join(reportsDirectory, `${runName}.server.log`);
  const clientLogPath = path.join(reportsDirectory, `${runName}.client.jsonl`);
  const runCompletedPath = path.join(reportsDirectory, `${runName}.run_completed.log`);
  const summaryPath = path.join(reportsDirectory, `${runName}.summary.json`);
  const serverLog = fs.createWriteStream(serverLogPath, { flags: 'w' });
  const clientLog = fs.createWriteStream(clientLogPath, { flags: 'w' });
  let server = null;
  let mongoose = null;
  let Deck = null;
  let Flashcard = null;
  let temporaryDeck = null;
  let completion = null;
  let source = null;
  let persistedCount = 0;

  try {
    require('dotenv').config({ path: path.join(backendDirectory, '.env') });
    mongoose = require('mongoose');
    const User = require('../src/models/User');
    Deck = require('../src/models/Deck');
    Flashcard = require('../src/models/Flashcard');
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGO_URL, {
      dbName: process.env.DB_NAME || 'flashcards',
      serverSelectionTimeoutMS: 30000,
    });

    const user = await User.findOne({ aiApiKey: { $type: 'string', $ne: '' } }).select('_id').lean();
    if (!user) throw new Error('No hay un usuario de prueba con una AI API key configurada.');

    source = await extractPdfText();
    appendJsonLine(clientLog, 'benchmark_input', {
      pdfPath,
      targetCount,
      sourceCharacters: source.text.length,
      pages: source.pages,
      pagesWithText: source.pagesWithText,
    });
    temporaryDeck = await Deck.create({
      userId: user._id,
      title: `Benchmark IA ${runName} ${new Date().toISOString()}`,
    });
    appendJsonLine(clientLog, 'temporary_deck_created', { deckId: String(temporaryDeck._id) });

    server = startServer(port, serverLog);
    await waitForServer(port, server);
    appendJsonLine(clientLog, 'server_ready', { port });

    const response = await fetch(`http://127.0.0.1:${port}/api/flashcards/generate-ai`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        'x-user-id': String(user._id),
      },
      body: JSON.stringify({
        deckId: String(temporaryDeck._id),
        text: source.text,
        count: targetCount,
        batchStyles: { textAlign: 'center', fontSize: 'text-base' },
      }),
    });
    completion = await readSseResponse(response, clientLog);
    persistedCount = await Flashcard.countDocuments({ deckId: temporaryDeck._id });
    appendJsonLine(clientLog, 'persisted_cards', { persistedCount });
  } catch (error) {
    appendJsonLine(clientLog, 'benchmark_failed', { message: error.message });
    throw error;
  } finally {
    if (temporaryDeck && Flashcard && Deck) {
      await Flashcard.deleteMany({ deckId: temporaryDeck._id });
      await Deck.deleteOne({ _id: temporaryDeck._id });
      appendJsonLine(clientLog, 'temporary_deck_deleted', { deckId: String(temporaryDeck._id) });
    }
    if (mongoose) await mongoose.disconnect();
    if (server) await stopServer(server);
    await new Promise((resolve) => serverLog.end(resolve));
    await new Promise((resolve) => clientLog.end(resolve));
  }

  const runCompletedEvents = saveRunCompletedLog(serverLogPath, runCompletedPath);
  const summary = {
    runName,
    pdfPath,
    targetCount,
    sourceCharacters: source.text.length,
    pages: source.pages,
    pagesWithText: source.pagesWithText,
    persistedCount,
    completion,
    runCompletedEvents,
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(`[benchmark] ${error.stack || error.message}`);
  process.exitCode = 1;
});

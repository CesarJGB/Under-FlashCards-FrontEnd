import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { build, createServer, preview } from 'vite';
import { chromium, firefox, webkit } from 'playwright';

const COMMIT = process.env.PERF_COMMIT || 'UNKNOWN';
const OUTPUT = process.argv[2] || '/tmp/image-grid-results.json';
const PAYLOAD_RESULTS = process.argv[3] || '/tmp/image-payload-results.json';
const REPETITIONS = 5;
const PORT = 4178;
const BASE = `http://127.0.0.1:${PORT}/tests/performance/image-grid/index.html`;
const BUILD_MODE = process.env.PERF_BUILD_MODE === 'production' ? 'production' : 'development';
const MATRIX_MODE = process.env.PERF_MATRIX_MODE || 'full';

function summary(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(finite.length / 2);
  return {
    values,
    median: finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2,
    min: finite[0] ?? null,
    max: finite.at(-1) ?? null,
  };
}

async function afterFrames(page, count = 2) {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function measureHover(page, transitions = 20) {
  const first = page.locator('article').first();
  const box = await first.boundingBox();
  if (!box) throw new Error('First card has no bounding box');
  const start = await page.evaluate(() => performance.now());
  for (let index = 0; index < transitions; index += 1) {
    await page.mouse.move(2, 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }
  await afterFrames(page);
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

async function measureScroll(page) {
  return page.evaluate(async () => {
    const startedAt = performance.now();
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    for (let index = 0; index <= 24; index += 1) {
      scrollTo(0, max * (index / 24));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    for (let index = 24; index >= 0; index -= 1) {
      scrollTo(0, max * (index / 24));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return performance.now() - startedAt;
  });
}

async function measureMenu(page) {
  const start = await page.evaluate(() => performance.now());
  await page.locator('button[aria-label="Abrir acciones de la carta"]').first().click();
  await page.getByRole('dialog', { name: 'Vista de la carta' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('dialog', { name: 'Vista de la carta' }).waitFor({ state: 'detached' });
  await afterFrames(page);
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

async function measurePreview(page) {
  const trigger = page.getByRole('button', { name: /Ver Imagen/i }).first();
  if (await trigger.count() === 0) return null;
  const start = await page.evaluate(() => performance.now());
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /Imagen de la/i });
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'Cerrar imagen' }).click();
  await dialog.waitFor({ state: 'detached' });
  await afterFrames(page);
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

async function runOne(page, config) {
  const query = new URLSearchParams(Object.entries(config).map(([key, value]) => [key, String(value)]));
  const url = `${BASE}?${query}`;
  const startedAt = performance.now();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.evaluate(() => window.__imageGridHarness.ready);
  const decode = await page.evaluate(() => window.__imageGridHarness.decodeSources());
  await afterFrames(page);
  const readyMs = performance.now() - startedAt;
  await page.evaluate(() => window.__imageGridHarness.resetTransientMetrics());
  const hoverMs = await measureHover(page);
  const scrollMs = await measureScroll(page);
  const menuMs = await measureMenu(page);
  const previewMs = await measurePreview(page);
  const snapshot = await page.evaluate(() => window.__imageGridHarness.snapshot());
  const closed = await page.evaluate(() => window.__imageGridHarness.close());
  return {
    readyWallMs: readyMs,
    harnessMountMs: snapshot.commits[0]?.commitTime - snapshot.commits[0]?.startTime || null,
    reactActualDurationMs: snapshot.commits[0]?.actualDuration ?? null,
    reactBaseDurationMs: snapshot.commits[0]?.baseDuration ?? null,
    decodeTotalMs: decode.reduce((sum, item) => sum + item.duration, 0),
    decodeCount: decode.length,
    decodeErrors: decode.filter((item) => item.status === 'error').length,
    hover20TransitionsMs: hoverMs,
    scrollRoundTripMs: scrollMs,
    menuOpenCloseMs: menuMs,
    previewOpenCloseMs: previewMs,
    domNodes: snapshot.domNodes,
    articleCount: snapshot.articleCount,
    imageElementCount: snapshot.imageElementCount,
    dataUrlStyleCount: snapshot.dataUrlStyleCount,
    blobStyleCount: snapshot.blobStyleCount,
    longTaskCount: snapshot.longTasks.length,
    longTaskTotalMs: snapshot.longTasks.reduce((sum, item) => sum + item.duration, 0),
    usedJSHeapSize: snapshot.performanceMemory?.usedJSHeapSize ?? null,
    usedJSHeapAfterClose: closed.performanceMemory,
    scrollHeight: snapshot.scrollHeight,
  };
}

function aggregateRuns(runs) {
  const numericKeys = Object.keys(runs[0] || {}).filter((key) => runs.some((run) => typeof run[key] === 'number'));
  return Object.fromEntries(numericKeys.map((key) => [key, summary(runs.map((run) => run[key]).filter((value) => typeof value === 'number'))]));
}

async function runScenario(browserName, browser, config, kind = 'core') {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  const runs = [];
  let error = null;
  for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
    try {
      runs.push(await runOne(page, config));
    } catch (caught) {
      error = String(caught?.stack || caught);
      break;
    }
  }
  await context.close();
  return {
    scenarioId: `${browserName}-${config.count}-${config.scenario}-${kind}-${config.shadow || 'on'}-${config.overlay || 'on'}-w${config.window || config.count}-${config.reference || 'data'}`,
    evidence: 'MEASURED',
    status: error ? 'FAIL' : 'PASS',
    browser: browserName,
    kind,
    configuration: config,
    repetitionsRequested: REPETITIONS,
    repetitionsCompleted: runs.length,
    runs,
    aggregate: runs.length ? aggregateRuns(runs) : {},
    limitation: 'Headless Playwright mide DOM/React/eventos y duración end-to-end del harness; no equivale a Safari físico ni certifica GPU/compositor del dispositivo.',
    error,
  };
}

async function traceChromium(page, action) {
  const client = await page.context().newCDPSession(page);
  const events = [];
  client.on('Tracing.dataCollected', ({ value }) => events.push(...value));
  const complete = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink,cc',
    options: 'sampling-frequency=10000',
    transferMode: 'ReportEvents'
  });
  await action();
  await client.send('Tracing.end');
  await complete;
  await client.detach();
  const interesting = new Set(['RunTask', 'FunctionCall', 'EventDispatch', 'UpdateLayoutTree', 'Layout', 'Paint', 'CompositeLayers', 'RasterTask', 'Decode Image']);
  const totals = {};
  for (const event of events) {
    if (!interesting.has(event.name) || typeof event.dur !== 'number') continue;
    const entry = totals[event.name] || { count: 0, durationMs: 0 };
    entry.count += 1;
    entry.durationMs += event.dur / 1000;
    totals[event.name] = entry;
  }
  return totals;
}

async function runChromiumTraces(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  const traces = [];
  for (const variant of [
    { id: 'baseline', shadow: 'on', overlay: 'on' },
    { id: 'shadow_off', shadow: 'off', overlay: 'on' },
    { id: 'overlay_off', shadow: 'on', overlay: 'off' },
  ]) {
    const query = new URLSearchParams({ count: '500', scenario: 'shared_large', shadow: variant.shadow, overlay: variant.overlay });
    const runs = [];
    for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
      await page.goto(`${BASE}?${query}`, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.evaluate(() => window.__imageGridHarness.ready);
      await page.evaluate(() => window.__imageGridHarness.decodeSources());
      runs.push(await traceChromium(page, async () => {
        await measureHover(page);
        await measureScroll(page);
      }));
    }
    const names = new Set(runs.flatMap((run) => Object.keys(run)));
    traces.push({
      scenarioId: `chromium-trace-${variant.id}`,
      evidence: 'MEASURED', status: 'PASS', variant: variant.id,
      repetitions: REPETITIONS, values: runs,
      aggregate: Object.fromEntries([...names].map((name) => [name, {
        count: summary(runs.map((run) => run[name]?.count || 0)),
        durationMs: summary(runs.map((run) => run[name]?.durationMs || 0))
      }])),
      limitation: 'CDP headless en esta VM; las categorías ausentes se registran como cero y no representan Safari/GPU físico.'
    });
  }
  await context.close();
  return traces;
}

async function measureLocalStorage(browserName, browser, payload) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const scenarios = [];
  for (const row of payload.deckResponses) {
    const result = await page.evaluate(({ key, characters }) => {
      localStorage.clear();
      const values = [];
      let error = null;
      for (let repetition = 0; repetition < 5; repetition += 1) {
        try {
          const startedAt = performance.now();
          localStorage.setItem(key, 'x'.repeat(characters));
          values.push(performance.now() - startedAt);
          localStorage.removeItem(key);
        } catch (caught) {
          error = { name: caught?.name || 'Error', message: caught?.message || String(caught) };
          break;
        }
      }
      localStorage.clear();
      return { values, error };
    }, { key: `perf-${row.scenarioId}`, characters: row.jsonCharacters });
    scenarios.push({
      scenarioId: `${browserName}-localstorage-${row.scenarioId}`,
      evidence: 'MEASURED', browser: browserName,
      status: result.error ? 'FAIL' : 'PASS', characters: row.jsonCharacters,
      repetitionsRequested: 5, repetitionsCompleted: result.values.length,
      setItemMs: result.values.length ? summary(result.values) : null,
      error: result.error,
      limitation: 'Origen HTTP local aislado; string ASCII del mismo número de caracteres, no cuota universal ni datos reales.'
    });
  }
  await context.close();
  return scenarios;
}

const frontendRoot = new URL('../../../', import.meta.url).pathname;
let temporaryBuildDirectory = null;
let server;
if (BUILD_MODE === 'production') {
  temporaryBuildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-flashcards-image-grid-'));
  await build({
    root: frontendRoot,
    logLevel: 'error',
    build: {
      outDir: temporaryBuildDirectory,
      emptyOutDir: true,
      rollupOptions: { input: path.join(frontendRoot, 'tests/performance/image-grid/index.html') }
    }
  });
  server = await preview({
    root: frontendRoot,
    logLevel: 'error',
    build: { outDir: temporaryBuildDirectory },
    preview: { host: '127.0.0.1', port: PORT, strictPort: true }
  });
} else {
  server = await createServer({
    root: frontendRoot,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: PORT, strictPort: true },
  });
  await server.listen();
}

const browserTypes = { chromium, firefox, webkit };
const browsers = {};
const availability = [];
for (const [name, type] of Object.entries(browserTypes)) {
  try {
    const browser = await type.launch({ headless: true });
    browsers[name] = browser;
    availability.push({ browser: name, status: 'PASS', version: browser.version() });
  } catch (error) {
    availability.push({ browser: name, status: 'BLOCKED', label: 'BLOCKED — BROWSER BINARY UNAVAILABLE', error: String(error) });
  }
}

const core = [];
const isolated = [];
const localStorage = [];
const coreScenarios = ['no_image', 'shared_small', 'shared_large', 'distinct_small', 'content_all', 'background_and_content'];
for (const [browserName, browser] of Object.entries(browsers)) {
  const fullMatrix = browserName === 'chromium'
    ? [20, 100, 500, 1000].flatMap((count) => coreScenarios.map((scenario) => ({ count, scenario })))
    : browserName === 'webkit'
      ? [
          ...[20, 100, 500, 1000].flatMap((count) => ['no_image', 'shared_large'].map((scenario) => ({ count, scenario }))),
          ...[100, 500].flatMap((count) => ['shared_small', 'distinct_small', 'content_all', 'background_and_content'].map((scenario) => ({ count, scenario })))
        ]
      : [100, 500].flatMap((count) => ['no_image', 'shared_large'].map((scenario) => ({ count, scenario })));
  const matrix = MATRIX_MODE === 'core'
    ? (browserName === 'firefox' ? [100, 500] : [20, 100, 500, 1000])
        .flatMap((count) => ['no_image', 'shared_large'].map((scenario) => ({ count, scenario })))
    : fullMatrix;
  for (const { count, scenario } of matrix) {
      core.push(await runScenario(browserName, browser, { count, scenario }, 'core'));
      process.stdout.write(`core ${browserName} ${count} ${scenario}\n`);
  }
  const payload = JSON.parse(fs.readFileSync(PAYLOAD_RESULTS, 'utf8'));
  localStorage.push(...await measureLocalStorage(browserName, browser, payload));
}

if (browsers.chromium) {
  for (const config of [
    { count: 500, scenario: 'shared_large', shadow: 'off' },
    { count: 500, scenario: 'shared_large', overlay: 'off' },
    { count: 1000, scenario: 'shared_large', window: 40 },
    { count: 500, scenario: 'shared_large', reference: 'blob' },
  ]) {
    isolated.push(await runScenario('chromium', browsers.chromium, config, 'isolated-control'));
  }
}

const traces = browsers.chromium ? await runChromiumTraces(browsers.chromium) : [];
for (const browser of Object.values(browsers)) await browser.close();
if (BUILD_MODE === 'production') {
  await new Promise((resolve) => server.httpServer.close(resolve));
  fs.rmSync(temporaryBuildDirectory, { recursive: true, force: true });
} else {
  await server.close();
}

const output = {
  schemaVersion: '1.0.0',
  kind: 'under-flashcards-real-grid-baseline',
  commit: COMMIT,
  createdAt: new Date().toISOString(),
  environment: {
    node: process.version,
    playwright: '1.62.1',
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model || 'unknown',
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    mode: `Vite ${BUILD_MODE} + headless browser; real FlashcardGrid import; reducedMotion=reduce; viewport 1280x900; font requests blocked.`,
    matrixMode: MATRIX_MODE
  },
  browserAvailability: availability,
  repetitions: REPETITIONS,
  core,
  isolatedControls: isolated,
  chromiumTraceAttribution: traces,
  localStorage,
  physicalDevice: {
    status: 'PENDING — DEVICE REQUIRED', evidence: 'PENDING — DEVICE REQUIRED',
    target: 'iPhone 16 Pro Max / Safari físico',
    limitation: 'Playwright WebKit no certifica touch, GPU, compositor, memoria ni Safari físico.'
  }
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: OUTPUT, core: core.length, isolated: isolated.length, traces: traces.length, localStorage: localStorage.length }));

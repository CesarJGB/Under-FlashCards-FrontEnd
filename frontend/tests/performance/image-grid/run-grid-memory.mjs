import fs from 'node:fs';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const COMMIT = process.env.PERF_COMMIT || 'UNKNOWN';
const OUTPUT = process.argv[2] || '/tmp/image-grid-memory-results.json';
const REPETITIONS = 5;
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}/tests/performance/image-grid/index.html`;

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    values,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  };
}

async function collect(client) {
  await client.send('HeapProfiler.collectGarbage');
  return client.send('Runtime.getHeapUsage');
}

const server = await createServer({
  root: new URL('../../../', import.meta.url).pathname,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: PORT, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ headless: true });

const configurations = [];
for (const count of [100, 500, 1000]) {
  for (const scenario of ['no_image', 'shared_small', 'shared_large', 'distinct_small', 'content_all', 'background_and_content']) {
    configurations.push({ count, scenario });
  }
}
configurations.push(
  { count: 500, scenario: 'shared_large', reference: 'blob' },
  { count: 1000, scenario: 'shared_large', window: 40 }
);

const results = [];
for (const configuration of configurations) {
  const runs = [];
  let error = null;
  for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
    const client = await context.newCDPSession(page);
    try {
      await page.goto('about:blank');
      const before = await collect(client);
      const query = new URLSearchParams(Object.entries(configuration).map(([key, value]) => [key, String(value)]));
      await page.goto(`${BASE}?${query}`, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.evaluate(() => window.__imageGridHarness.ready);
      await page.evaluate(() => window.__imageGridHarness.decodeSources());
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const loaded = await collect(client);
      const snapshot = await page.evaluate(() => window.__imageGridHarness.snapshot());
      await page.evaluate(() => window.__imageGridHarness.close());
      const closed = await collect(client);
      runs.push({
        usedBeforeBytes: before.usedSize,
        usedLoadedBytes: loaded.usedSize,
        usedAfterCloseBytes: closed.usedSize,
        embedderBeforeBytes: before.embedderHeapUsedSize,
        embedderLoadedBytes: loaded.embedderHeapUsedSize,
        embedderAfterCloseBytes: closed.embedderHeapUsedSize,
        jsDeltaLoadedBytes: loaded.usedSize - before.usedSize,
        jsDeltaAfterCloseBytes: closed.usedSize - before.usedSize,
        embedderDeltaLoadedBytes: loaded.embedderHeapUsedSize - before.embedderHeapUsedSize,
        embedderDeltaAfterCloseBytes: closed.embedderHeapUsedSize - before.embedderHeapUsedSize,
        domNodes: snapshot.domNodes,
        articleCount: snapshot.articleCount,
      });
    } catch (caught) {
      error = String(caught?.stack || caught);
    } finally {
      await client.detach().catch(() => {});
      await context.close();
    }
    if (error) break;
  }
  const numericKeys = Object.keys(runs[0] || {}).filter((key) => typeof runs[0][key] === 'number');
  results.push({
    scenarioId: `chromium-memory-${configuration.count}-${configuration.scenario}-w${configuration.window || configuration.count}-${configuration.reference || 'data'}`,
    evidence: 'MEASURED', status: error ? 'FAIL' : 'PASS', configuration,
    repetitionsRequested: REPETITIONS, repetitionsCompleted: runs.length, runs,
    aggregate: Object.fromEntries(numericKeys.map((key) => [key, summary(runs.map((run) => run[key]))])),
    limitation: 'Chromium CDP tras GC explícito; heap JS/embedder del renderer, no memoria GPU, superficie raster ni Safari físico.',
    error,
  });
  process.stdout.write(`memory ${configuration.count} ${configuration.scenario} ${configuration.reference || 'data'} w${configuration.window || configuration.count}\n`);
}

await browser.close();
await server.close();
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  schemaVersion: '1.0.0', kind: 'under-flashcards-grid-memory-baseline', commit: COMMIT,
  createdAt: new Date().toISOString(), repetitions: REPETITIONS,
  environment: {
    browser: 'chromium', version: '151.0.7922.34', playwright: '1.62.1',
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model || 'unknown', logicalCpuCount: os.cpus().length,
    method: 'CDP HeapProfiler.collectGarbage + Runtime.getHeapUsage'
  },
  results
}, null, 2)}\n`);
console.log(JSON.stringify({ output: OUTPUT, scenarios: results.length }));

import React, { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import FlashcardGrid from '../../../src/components/FlashcardGrid.jsx';
import '../../../src/index.css';
import './harness.css';

const params = new URLSearchParams(window.location.search);
const requestedCount = Number(params.get('count') || 100);
const scenario = params.get('scenario') || 'no_image';
const shadow = params.get('shadow') !== 'off';
const overlay = params.get('overlay') !== 'off';
const windowSize = Math.min(requestedCount, Number(params.get('window') || requestedCount));
const referenceMode = params.get('reference') || 'data';

function pseudoText(length, seed) {
  let state = seed || 1;
  let output = '';
  // XML comments cannot contain "--"; keep the 64-character padding alphabet
  // comment-safe so every synthetic fixture exercises real image decoding.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.';
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output += alphabet[state & 63];
  }
  return output;
}

function svgSource({ width, height, targetBytes, seed }) {
  const start = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g"><stop stop-color="#312e81"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="35%" cy="45%" r="20%" fill="#f8fafc" opacity=".22"/><!--`;
  const end = '--></svg>';
  return `${start}${pseudoText(Math.max(0, targetBytes - start.length - end.length), seed)}${end}`;
}

const visualProfiles = {
  small: { width: 320, height: 180, targetBytes: 8 * 1024 },
  large: { width: 2400, height: 1600, targetBytes: 128 * 1024 },
  content: { width: 600, height: 338, targetBytes: 16 * 1024 },
};

const objectUrls = [];
const imageSources = new Set();
function sourceFor(profileName, seed) {
  const svg = svgSource({ ...visualProfiles[profileName], seed });
  if (referenceMode === 'blob') {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    objectUrls.push(url);
    imageSources.add(url);
    return url;
  }
  const url = `data:image/svg+xml;base64,${btoa(svg)}`;
  imageSources.add(url);
  return url;
}

const sharedSmall = sourceFor('small', 11);
const sharedLarge = sourceFor('large', 12);
const sharedContent = sourceFor('content', 13);

function imagesFor(index) {
  if (scenario === 'shared_small') return { bgImage: sharedSmall };
  if (scenario === 'shared_large') return { bgImage: sharedLarge };
  if (scenario === 'distinct_small') return { bgImage: sourceFor('small', 1000 + index) };
  if (scenario === 'content_all') return { contentImage: sharedContent, imageSide: index % 2 ? 'question' : 'answer' };
  if (scenario === 'background_and_content') {
    return { bgImage: sharedLarge, contentImage: sharedContent, imageSide: index % 2 ? 'question' : 'answer' };
  }
  return {};
}

const cards = Array.from({ length: windowSize }, (_, index) => ({
  id: `perf-card-${index}`,
  question: `Pregunta sintética ${index}: memoria, red y renderizado`,
  answer: `Respuesta sintética ${index}: contenido controlado`,
  textAlign: index % 3 === 0 ? 'left' : index % 3 === 1 ? 'center' : 'right',
  fontSize: JSON.stringify({ qSize: 18, aSize: 16, qBold: true, aBold: false }),
  ...imagesFor(index),
}));

const commitSamples = [];
const longTasks = [];
if ('PerformanceObserver' in window) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {}
}

const startedAt = performance.now();
let readyResolve;
const ready = new Promise((resolve) => { readyResolve = resolve; });

function onRender(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  commitSamples.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
}

function App() {
  const classes = ['perf-harness', !shadow && 'perf-shadow-off', !overlay && 'perf-overlay-off'].filter(Boolean).join(' ');
  return (
    <main className={classes} data-perf-harness>
      <Profiler id="FlashcardGrid" onRender={onRender}>
        <FlashcardGrid cards={cards} onEdit={() => {}} onDelete={() => {}} />
      </Profiler>
    </main>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

requestAnimationFrame(() => requestAnimationFrame(() => {
  const finishedAt = performance.now();
  readyResolve({ startedAt, finishedAt });
}));

window.__imageGridHarness = {
  ready,
  configuration: {
    requestedCount, mountedCount: cards.length, scenario, shadow, overlay, referenceMode,
    visualProfiles
  },
  snapshot() {
    return {
      configuration: this.configuration,
      domNodes: document.querySelectorAll('*').length,
      articleCount: document.querySelectorAll('article').length,
      imageElementCount: document.images.length,
      dataUrlStyleCount: [...document.querySelectorAll('article')].filter((node) => node.style.backgroundImage.includes('data:image')).length,
      blobStyleCount: [...document.querySelectorAll('article')].filter((node) => node.style.backgroundImage.includes('blob:')).length,
      commits: [...commitSamples],
      longTasks: [...longTasks],
      performanceMemory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : null,
      scrollHeight: document.documentElement.scrollHeight,
    };
  },
  resetTransientMetrics() {
    longTasks.length = 0;
  },
  async decodeSources() {
    const results = [];
    for (const src of imageSources) {
      const image = new Image();
      image.src = src;
      const startedAt = performance.now();
      try {
        await image.decode();
        results.push({ status: 'decoded', duration: performance.now() - startedAt });
      } catch (error) {
        results.push({ status: 'error', duration: performance.now() - startedAt, error: String(error) });
      }
    }
    return results;
  },
  async close() {
    root.unmount();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const url of objectUrls) URL.revokeObjectURL(url);
    return {
      domNodes: document.querySelectorAll('*').length,
      performanceMemory: performance.memory ? performance.memory.usedJSHeapSize : null,
    };
  }
};

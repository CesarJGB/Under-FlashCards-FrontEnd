// Spec Playwright de la pantalla publica / login (app REAL servida por Vite).
// Fases A/B: reproduccion e instrumentacion del ciclo de vida del boton de Google.
// Fases D/E/G: contratos regresivos y verificaciones visuales.
import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve(process.cwd(), 'test-results/login');
const CONTAINER_SELECTOR = '[data-testid="google-login-button"]';

// ---------------------------------------------------------------------------
// Instrumentacion de GIS (solo en el contexto de la pagina, nunca produccion).
// GIS re-ejecuta su bootstrap (StrictMode carga el script dos veces) y resetea
// google.accounts.id.renderButton a la funcion original. Por eso el wrap se
// re-instala en cada tick y la marca vive en la FUNCION, no en el objeto.
// ---------------------------------------------------------------------------
const GSI_INSTRUMENT = () => {
  window.__gsiProbe = { renderButtonCalls: [], initializeCalls: [], scriptAppends: [], rewrapCount: 0 };
  const wrapNow = () => {
    const gid = window.google?.accounts?.id;
    if (!gid) return false;
    if (typeof gid.renderButton === 'function' && !gid.renderButton.__ufProbeWrapped) {
      const orig = gid.renderButton;
      const wrapper = function (container, options) {
        window.__gsiProbe.renderButtonCalls.push({
          at: performance.now(),
          width: options?.width ?? null,
          containerTag: container?.tagName ?? null,
          containerW: container?.getBoundingClientRect?.().width ?? null,
          containerH: container?.getBoundingClientRect?.().height ?? null,
          childCountBefore: container?.childElementCount ?? null,
        });
        return orig.call(gid, container, options);
      };
      wrapper.__ufProbeWrapped = true;
      gid.renderButton = wrapper;
      window.__gsiProbe.rewrapCount += 1;
    }
    if (typeof gid.initialize === 'function' && !gid.initialize.__ufProbeWrapped) {
      const origInit = gid.initialize;
      const initWrapper = function (config) {
        window.__gsiProbe.initializeCalls.push({ at: performance.now(), clientId: config?.client_id ?? null });
        return origInit.call(gid, config);
      };
      initWrapper.__ufProbeWrapped = true;
      gid.initialize = initWrapper;
    }
    return true;
  };
  const origAppend = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (node?.tagName === 'SCRIPT' && node?.src?.includes('gsi/client')) {
      window.__gsiProbe.scriptAppends.push({ at: performance.now() });
      node.addEventListener('load', () => wrapNow(), { once: true });
    }
    return origAppend.call(this, node);
  };
  const timer = setInterval(wrapNow, 20);
  window.__gsiProbeStop = () => clearInterval(timer);
};

// ---------------------------------------------------------------------------
// Watcher: observa document.body desde ANTES de abrir el sheet para capturar
// creacion del contenedor, montaje de GoogleLogin y mutaciones de GIS
// (incluidos iframes globales de accounts.google.com).
// ---------------------------------------------------------------------------
async function installLifecycleWatcher(page, { sampleMs = 1200 } = {}) {
  return page.evaluate(async ({ containerSelector, sampleMs }) => {
    const result = {
      containerCreatedAt: null,
      samples: [],
      mutations: [],
      gsi: null,
      mounts: 0,
      unmounts: 0,
      iframeReplacementCount: 0,
    };
    let startedAt = null;
    let rAFId = null;
    let observer = null;
    let resolveProbe = null;
    let previousIframe = null;
    const done = new Promise((resolve) => { resolveProbe = resolve; });

    const recordFrame = (now) => {
      const container = document.querySelector(containerSelector);
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const iframes = Array.from(container.querySelectorAll('iframe'));
      const iframe = iframes[0] || null;
      if (previousIframe && iframe && previousIframe !== iframe) result.iframeReplacementCount += 1;
      previousIframe = iframe;
      const styles = getComputedStyle(container);
      result.samples.push({
        t: Math.round(now),
        w: Math.round(rect.width * 10) / 10,
        h: Math.round(rect.height * 10) / 10,
        childCount: container.childElementCount,
        iframeCount: iframes.length,
        iframeWidths: iframes.map((f) => f.getAttribute('width')),
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
      });
    };

    const startSampling = () => {
      startedAt = performance.now();
      const step = (now) => {
        recordFrame(now);
        if (now - startedAt < sampleMs) {
          rAFId = requestAnimationFrame(step);
        } else {
          cancelAnimationFrame(rAFId);
          setTimeout(() => {
            observer?.disconnect();
            result.gsi = window.__gsiProbe;
            window.__gsiProbeStop?.();
            resolveProbe(result);
          }, 200);
        }
      };
      rAFId = requestAnimationFrame(step);
    };

    observer = new MutationObserver((records) => {
      const container = document.querySelector(containerSelector);
      for (const record of records) {
        const target = record.target;
        const isContainerTarget = target === container;
        const insideContainer = container?.contains?.(target);
        const touchesGsi = Array.from(record.addedNodes).some((n) => n.tagName === 'IFRAME' && (n.src || '').includes('accounts.google.com/gsi'))
          || Array.from(record.removedNodes).some((n) => n.tagName === 'IFRAME' && (n.src || '').includes('accounts.google.com/gsi'));
        if (!isContainerTarget && !insideContainer && !touchesGsi) continue;
        const rect = container?.getBoundingClientRect?.();
        result.mutations.push({
          t: Math.round(performance.now()),
          type: record.type,
          target: isContainerTarget ? 'container' : (target?.tagName || ''),
          childCount: container?.childElementCount ?? null,
          containerW: rect ? Math.round(rect.width) : null,
          containerH: rect ? Math.round(rect.height) : null,
          added: Array.from(record.addedNodes).map((n) => ({
            tag: n.tagName || '#text',
            isIframe: n.tagName === 'IFRAME',
            gsi: n.tagName === 'IFRAME' && (n.src || '').includes('accounts.google.com/gsi'),
            height40: n.style?.height === '40px' || Boolean(n.querySelector?.('[style*="height: 40px"]')),
            childCount: n.childElementCount ?? null,
          })),
          removed: Array.from(record.removedNodes).map((n) => ({
            tag: n.tagName || '#text',
            isIframe: n.tagName === 'IFRAME',
            gsi: n.tagName === 'IFRAME' && (n.src || '').includes('accounts.google.com/gsi'),
          })),
        });
        if (container && isContainerTarget) {
          if (container.childElementCount > 0 && Array.from(record.addedNodes).some((n) => n.tagName === 'DIV' || n.tagName === 'IFRAME')) {
            result.mounts += 1;
          } else if (container.childElementCount === 0 && record.removedNodes.length > 0 && result.mounts > 0) {
            result.unmounts += 1;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['width', 'height', 'style', 'src'] });

    const finder = setInterval(() => {
      const container = document.querySelector(containerSelector);
      if (container && !startedAt) {
        result.containerCreatedAt = Math.round(performance.now());
        startSampling();
      }
    }, 5);
    setTimeout(() => {
      clearInterval(finder);
      if (!startedAt) {
        observer.disconnect();
        result.gsi = window.__gsiProbe;
        window.__gsiProbeStop?.();
        resolveProbe(result);
      }
    }, 8000);

    return done;
  }, { containerSelector: CONTAINER_SELECTOR, sampleMs });
}

function summarizeProbe(evidence) {
  const { samples, mutations, gsi, mounts, unmounts, containerCreatedAt } = evidence;
  const renderCalls = gsi?.renderButtonCalls ?? [];
  const widths = samples.map((s) => s.w);
  const iframeRemovals = mutations.filter((m) => m.removed.some((n) => n.isIframe));
  const gsiIframeAdds = mutations.filter((m) => m.added.some((n) => n.gsi));
  const gsiIframeRemovals = mutations.filter((m) => m.removed.some((n) => n.gsi));
  const widthChanges = widths.filter((w, i) => i > 0 && w !== widths[i - 1]).length;
  return {
    containerCreatedAt,
    renderButtonCalls: renderCalls.length,
    renderButtonWidths: renderCalls.map((c) => c.width),
    renderButtonContainerWidths: renderCalls.map((c) => c.containerW),
    initializeCalls: gsi?.initializeCalls?.length ?? 0,
    scriptAppends: gsi?.scriptAppends?.length ?? 0,
    rewrapCount: gsi?.rewrapCount ?? 0,
    mounts,
    unmounts,
    totalMutations: mutations.length,
    iframeRemovals: iframeRemovals.length,
    gsiIframeAdds: gsiIframeAdds.length,
    gsiIframeRemovals: gsiIframeRemovals.length,
    iframeReplacementCount: evidence.iframeReplacementCount,
    iframeRemovalTimes: iframeRemovals.map((m) => m.t),
    widths: [...new Set(widths.map((w) => Math.round(w)))],
    widthChanges,
    heightHistory: [...new Set(samples.map((s) => Math.round(s.h)))],
    iframeCounts: [...new Set(samples.map((s) => s.iframeCount))],
    childCounts: [...new Set(samples.map((s) => s.childCount))],
    firstFrame: samples[0],
    lastFrame: samples[samples.length - 1],
  };
}

async function openPublicScreen(page) {
  await page.addInitScript(GSI_INSTRUMENT);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
}

async function saveEvidence(name, evidence, summary) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, name);
  await writeFile(file, JSON.stringify({ summary, evidence }, null, 2));
  return file;
}

async function dragWithMouse(page, locator, deltaY) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, startY + deltaY, { steps: 8 });
  await page.mouse.up();
}

async function waitForSheetTransformToSettle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const sheet = document.querySelector('[data-action-sheet-snap]');
    if (!sheet) {
      resolve();
      return;
    }
    let previous = getComputedStyle(sheet).transform;
    let stableFrames = 0;
    const check = () => {
      const current = getComputedStyle(sheet).transform;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 3) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
}

// ---------------------------------------------------------------------------
// FASE A: reproduccion del comportamiento actual (BEFORE) sin editar produccion.
// ---------------------------------------------------------------------------
test.describe('login google lifecycle', () => {
  test('probe: ciclo de vida DOM del boton de Google al abrir (BEFORE)', async ({ page }, testInfo) => {
    await openPublicScreen(page);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'login-before-open.png') });

    const probePromise = installLifecycleWatcher(page, { sampleMs: 1200 });
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="google-login-button"] iframe'));
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'login-google-first-appear.png') });
    const evidence = await probePromise;

    const summary = summarizeProbe(evidence);
    const file = await saveEvidence('evidence-google-before.json', evidence, summary);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'login-stable.png') });
    testInfo.attach('google-evidence-summary', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    testInfo.attach('google-evidence-path', { body: file, contentType: 'text/plain' });

    console.log('GOOGLE PROBE SUMMARY (BEFORE):');
    console.log(JSON.stringify(summary, null, 2));
    expect(summary).toBeTruthy();
  });

  test('regresión: GIS recibe un contenedor con ancho estable antes de renderButton', async ({ page }) => {
    await openPublicScreen(page);
    const probePromise = installLifecycleWatcher(page, { sampleMs: 1200 });
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    const evidence = await probePromise;
    const summary = summarizeProbe(evidence);
    const internalWidths = evidence.gsi.renderButtonCalls.map((call) => call.containerW);

    expect(internalWidths.length).toBeGreaterThan(0);
    expect(internalWidths.every((width) => Number.isFinite(width) && width > 0)).toBe(true);
    expect(new Set(internalWidths).size).toBe(1);
    expect(summary.widthChanges).toBe(0);
    expect(summary.iframeCounts).toContain(1);
  });

  test('contrato visual auth en 360, 390 y 430 sin overflow horizontal', async ({ page }) => {
    for (const [width, height] of [[360, 800], [390, 844], [430, 932]]) {
      await page.setViewportSize({ width, height });
      await openPublicScreen(page);
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      await expect(page.getByTestId('login-auth-panel')).toBeVisible();
      await expect(page.locator('#invite-code')).toBeVisible();
      await page.waitForTimeout(250);

      const visual = await page.evaluate(() => {
        const sheet = document.querySelector('[data-auth-surface="outer"]');
        const panel = document.querySelector('[data-testid="login-auth-panel"]');
        const input = document.querySelector('#invite-code');
        const google = document.querySelector('[data-testid="google-login-button"]');
        const iframe = google?.querySelector('iframe');
        const lua = panel?.querySelector('img[aria-hidden="true"]');
        const getRect = (node) => {
          const rect = node?.getBoundingClientRect();
          return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
        };
        const getStyle = (node) => node ? getComputedStyle(node) : null;
        const sheetStyle = getStyle(sheet);
        const panelStyle = getStyle(panel);
        const inputStyle = getStyle(input);
        return {
          sheetRect: getRect(sheet),
          panelRect: getRect(panel),
          inputRect: getRect(input),
          googleRect: getRect(google),
          iframeRect: getRect(iframe),
          luaRect: getRect(lua),
          sheetBackground: sheetStyle?.backgroundColor,
          panelBackground: panelStyle?.backgroundColor,
          panelBorder: panelStyle?.border,
          panelRadius: Number.parseFloat(panelStyle?.borderTopLeftRadius || '0'),
          panelOverflow: panelStyle?.overflow,
          inputBackground: inputStyle?.backgroundColor,
          luaLoaded: Boolean(lua?.complete && lua?.naturalWidth > 0),
          iframeCount: google?.querySelectorAll('iframe').length || 0,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
            || document.body.scrollWidth > document.body.clientWidth,
        };
      });

      expect(visual.sheetBackground).toBe('rgb(248, 246, 251)');
      expect(visual.panelBackground).toBe('rgb(239, 236, 245)');
      expect(visual.panelBorder).toContain('1px solid rgb(203, 197, 213)');
      expect(visual.panelRadius).toBeGreaterThan(0);
      expect(visual.panelOverflow).toBe('hidden');
      expect(visual.inputBackground).toBe('rgb(255, 254, 255)');
      expect(visual.panelBackground).not.toBe(visual.inputBackground);
      expect(visual.iframeCount).toBe(1);
      expect(visual.luaLoaded).toBe(true);
      expect(visual.panelRect.left).toBeGreaterThan(visual.sheetRect.left);
      expect(visual.panelRect.right).toBeLessThan(visual.sheetRect.right);
      expect(visual.panelRect.top).toBeGreaterThan(visual.sheetRect.top);
      expect(visual.panelRect.top).toBeLessThan(visual.sheetRect.bottom);
      expect(visual.luaRect.right).toBeGreaterThan(visual.inputRect.right);
      expect(visual.luaRect.bottom).toBeGreaterThan(visual.inputRect.bottom);
      expect(visual.horizontalOverflow).toBe(false);

      await page.screenshot({ path: path.join(EVIDENCE_DIR, `login-${width}.png`) });
      await page.getByRole('button', { name: 'Cerrar inicio de sesión' }).click();
      await expect(page.getByTestId('login-auth-panel')).toHaveCount(0);
    }
  });

  test('regresión de restoreSnapAfterInput para compact y expanded', async ({ page }) => {
    await openPublicScreen(page);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    const snap = page.locator('[data-action-sheet-snap]');
    const input = page.locator('#invite-code');

    await expect(snap).toHaveAttribute('data-action-sheet-snap', 'compact');
    await input.focus();
    await expect(snap).toHaveAttribute('data-action-sheet-snap', 'expanded');
    await waitForSheetTransformToSettle(page);
    await input.blur();
    await expect(snap).toHaveAttribute('data-action-sheet-snap', 'compact');
    await waitForSheetTransformToSettle(page);

    await dragWithMouse(page, page.locator('button[data-action-sheet-handle="true"]'), -70);
    await expect(snap).toHaveAttribute('data-action-sheet-snap', 'expanded');
    await waitForSheetTransformToSettle(page);
    await input.focus();
    await input.blur();
    await expect(snap).toHaveAttribute('data-action-sheet-snap', 'expanded');
  });
});

import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve(process.cwd(), 'test-results/lua-video');

async function findVideoSource(page) {
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((candidate) => (
    candidate.name.includes('lua_loading_animation_5s.mp4')
    || candidate.name.endsWith('.mp4')
  )));
  return page.evaluate(() => performance.getEntriesByType('resource').find((candidate) => (
    candidate.name.includes('lua_loading_animation_5s.mp4')
    || candidate.name.endsWith('.mp4')
  ))?.name || null);
}

async function mountLoadingVideoProbe(page, source) {
  await page.evaluate((src) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#FBFAFF] px-5 py-4 sm:px-8 sm:py-8';
    overlay.dataset.testid = 'lua-video-probe';

    const content = document.createElement('div');
    content.className = 'flex h-full min-h-0 w-full max-w-5xl flex-col items-center justify-center gap-[clamp(0.75rem,3vh,2rem)]';

    const videoFrame = document.createElement('div');
    videoFrame.className = 'relative isolate aspect-square h-auto w-[min(90vw,40rem,58vh)] max-w-full shrink-0 overflow-hidden bg-[#FBFAFF] leading-none';
    videoFrame.dataset.testid = 'lua-video-frame';

    const video = document.createElement('video');
    video.className = 'block h-full w-full max-w-full object-contain';
    video.dataset.testid = 'lua-video';
    video.src = src;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.style.isolation = 'isolate';
    video.style.WebkitBackfaceVisibility = 'hidden';
    video.style.backfaceVisibility = 'hidden';
    video.style.WebkitMaskImage = '-webkit-radial-gradient(white, black)';

    const edgeMask = document.createElement('div');
    edgeMask.className = 'pointer-events-none absolute inset-0 z-10 border-2 border-[#FBFAFF]';
    edgeMask.dataset.testid = 'lua-video-edge-mask';
    edgeMask.setAttribute('aria-hidden', 'true');

    videoFrame.append(video);
    videoFrame.append(edgeMask);
    content.append(videoFrame);
    const phrase = document.createElement('p');
    phrase.className = 'max-w-4xl text-center text-[clamp(1.25rem,4.5vw,2rem)] font-extrabold leading-[1.4]';
    phrase.innerHTML = '<span class="text-slate-950">No hay atajos para volverse fuerte;</span> <span class="text-violet-600">la verdadera habilidad se construye repitiendo lo básico todos los días.</span>';
    content.append(phrase);
    overlay.append(content);
    document.body.append(overlay);
    video.load();
  }, source);

  await page.waitForFunction(() => {
    const video = document.querySelector('[data-testid="lua-video"]');
    return video?.readyState >= 1 || Boolean(video?.error);
  }, undefined, { timeout: 5_000 });
}

test.describe('Lua loading video geometry', () => {
  test('LUA-VIDEO-GEOMETRY: el frame y el video comparten sus límites', async ({ page }, testInfo) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const geometries = [];

    for (const [width, height] of [[390, 844], [393, 852], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const source = await findVideoSource(page);
      console.log(`LUA VIDEO SOURCE ${source}`);
      await mountLoadingVideoProbe(page, source);
      const geometry = await page.evaluate((src) => {
        const video = document.querySelector('[data-testid="lua-video"]');
        const overlay = document.querySelector('[data-testid="lua-video-probe"]');
        const frame = video?.parentElement;
        const content = frame?.parentElement;
        const edgeMask = frame?.querySelector('[data-testid="lua-video-edge-mask"]');
        const videoRect = video?.getBoundingClientRect();
        const frameRect = frame?.getBoundingClientRect();
        const edgeMaskRect = edgeMask?.getBoundingClientRect();
        const overlayRect = overlay?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();
        const videoStyle = video ? getComputedStyle(video) : null;
        const getRect = (rect) => rect ? {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        } : null;
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          devicePixelRatio: window.devicePixelRatio,
          source: src,
          intrinsic: {
            width: video?.videoWidth || 0,
            height: video?.videoHeight || 0,
            duration: video?.duration || 0,
            readyState: video?.readyState || 0,
            networkState: video?.networkState || 0,
            error: video?.error ? { code: video.error.code, message: video.error.message } : null,
          },
          overlay: getRect(overlayRect),
          content: getRect(contentRect),
          frame: getRect(frameRect),
          edgeMask: getRect(edgeMaskRect),
          video: getRect(videoRect),
          style: videoStyle ? {
            display: videoStyle.display,
            position: videoStyle.position,
            aspectRatio: videoStyle.aspectRatio,
            objectFit: videoStyle.objectFit,
            objectPosition: videoStyle.objectPosition,
            transform: videoStyle.transform,
            border: videoStyle.border,
            borderRadius: videoStyle.borderRadius,
            overflow: videoStyle.overflow,
            backgroundColor: videoStyle.backgroundColor,
            opacity: videoStyle.opacity,
            transition: videoStyle.transition,
            filter: videoStyle.filter,
            backfaceVisibility: videoStyle.backfaceVisibility,
            webkitMaskImage: videoStyle.webkitMaskImage,
          } : null,
          frameStyle: frame ? {
            overflow: getComputedStyle(frame).overflow,
            backgroundColor: getComputedStyle(frame).backgroundColor,
            isolation: getComputedStyle(frame).isolation,
          } : null,
        };
      }, source);
      geometries.push(geometry);
      const screenshotPath = path.join(EVIDENCE_DIR, `lua-video-${width}x${height}.png`);
      await page.screenshot({ path: screenshotPath });
      await page.evaluate(() => document.querySelector('[data-testid="lua-video-probe"]')?.remove());
    }

    testInfo.attach('lua-video-geometry', { body: JSON.stringify(geometries, null, 2), contentType: 'application/json' });
    testInfo.attach('lua-video-ios-validation', {
      body: 'REQUIRES_PHYSICAL_IOS_VALIDATION',
      contentType: 'text/plain',
    });
    console.log('LUA VIDEO GEOMETRY:');
    console.log(JSON.stringify(geometries, null, 2));
    console.log('LUA VIDEO PLAYBACK:', JSON.stringify(geometries.map(({ viewport, intrinsic }) => ({
      viewport,
      status: intrinsic.width > 0 && intrinsic.height > 0 ? 'decoded' : 'not-decoded-by-linux-engine',
      errorCode: intrinsic.error?.code || null,
    }))));

    for (const geometry of geometries) {
      expect(geometry.video.width).toBeGreaterThan(0);
      expect(geometry.video.height).toBeGreaterThan(0);
      expect(Math.abs(geometry.video.width - geometry.frame.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.video.height - geometry.frame.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.edgeMask.width - geometry.frame.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.edgeMask.height - geometry.frame.height)).toBeLessThanOrEqual(0.5);
      expect(geometry.style.backfaceVisibility).toBe('hidden');
    }
  });
});

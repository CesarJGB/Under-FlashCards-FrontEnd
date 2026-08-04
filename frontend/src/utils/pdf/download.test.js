import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePdfDownload, savePdfBuffer } from './download.js';

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

test('iOS prepara una única pestaña síncrona para el preview', () => {
  let openCount = 0;
  const target = { closed: false, document: { title: '' }, location: { href: '' }, close() {} };
  const restoreNavigator = replaceGlobal('navigator', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 1 });
  const restoreWindow = replaceGlobal('window', { open: () => { openCount += 1; return target; } });
  try {
    assert.equal(preparePdfDownload(), target);
    assert.equal(openCount, 1);
    assert.equal(target.document.title, 'Preparando PDF…');
  } finally {
    restoreWindow();
    restoreNavigator();
  }
});

test('escritorio usa una sola descarga y conserva un nombre seguro', () => {
  let clicked = 0;
  let appended = 0;
  let revoked = 0;
  const link = { href: '', download: '', rel: '', click: () => { clicked += 1; }, remove() {} };
  const restoreNavigator = replaceGlobal('navigator', { userAgent: 'Mozilla/5.0', platform: 'Linux', maxTouchPoints: 0 });
  const restoreWindow = replaceGlobal('window', { setTimeout() {} });
  const restoreDocument = replaceGlobal('document', {
    createElement: () => link,
    body: { appendChild: () => { appended += 1; } },
  });
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => { revoked += 1; };
  try {
    const result = savePdfBuffer(new Uint8Array([1, 2, 3]), 'Horario Química-horizontal.pdf');
    assert.deepEqual(result, { mode: 'download' });
    assert.equal(clicked, 1);
    assert.equal(appended, 1);
    assert.equal(link.download, 'Horario Química-horizontal.pdf');
    assert.equal(revoked, 0);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    restoreDocument();
    restoreWindow();
    restoreNavigator();
  }
});

test('preview iOS navega la pestaña preparada sin crear una descarga extra', () => {
  const target = { closed: false, location: { href: '' } };
  let createdAnchor = false;
  const restoreWindow = replaceGlobal('window', { setTimeout() {} });
  const restoreDocument = replaceGlobal('document', { createElement: () => { createdAnchor = true; return {}; }, body: {} });
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:preview';
  URL.revokeObjectURL = () => {};
  try {
    const result = savePdfBuffer(new Uint8Array([1]), 'horario.pdf', { target });
    assert.deepEqual(result, { mode: 'preview' });
    assert.equal(target.location.href, 'blob:preview');
    assert.equal(createdAnchor, false);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    restoreDocument();
    restoreWindow();
  }
});

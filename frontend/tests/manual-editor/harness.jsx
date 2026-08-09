import React, {
  Profiler,
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import ManualCardEditorModal from '../../src/components/creator/ManualCardEditorModal';
import ActionSheet from '../../src/components/common/ActionSheet';
import {
  createManualEditorDiagnostics,
  installManualEditorListenerProbe,
  observeManualEditorHarnessEvents,
  readManualEditorDiagnosticSnapshot,
} from '../../src/components/creator/manual-editor/manualEditorDiagnostics';
import { getEditorLayerRuntimeSnapshot } from '../../src/components/creator/manual-editor/useEditorLayerStack';
import { getScrollLeaseSnapshot } from '../../src/lib/scrollLock';

const MOCK_IMAGE = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22120%22 viewBox=%220 0 160 120%22%3E%3Crect width=%22160%22 height=%22120%22 rx=%2218%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2250%22 cy=%2244%22 r=%2214%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M20 100 66 58l24 22 18-16 32 36Z%22 fill=%22%2364758b%22/%3E%3C/svg%3E';
const LONG_TEXT = Array.from({ length: 36 }, (_, index) => (
  `Línea sintética ${String(index + 1).padStart(2, '0')} para probar desplazamiento.`
)).join('\n');

const BASE_STYLES = Object.freeze({
  qSize: 18,
  qBold: true,
  qItalic: false,
  qColor: '#0f172a',
  aSize: 16,
  aBold: false,
  aItalic: true,
  aColor: '#2563eb',
  bgColor: '#ffffff',
});

const FIXTURES = Object.freeze({
  empty: {
    question: '',
    answer: '',
    styles: BASE_STYLES,
    textAlign: 'left',
  },
  distinct: {
    question: 'Pregunta sintética para caracterización.',
    answer: 'Respuesta sintética diferente para caracterización.',
    styles: BASE_STYLES,
    textAlign: 'left',
  },
  long: {
    question: LONG_TEXT,
    answer: 'Respuesta sintética breve asociada al fixture largo.',
    styles: BASE_STYLES,
    textAlign: 'left',
  },
  styled: {
    question: 'Lado pregunta con estilo sintético.',
    answer: 'Lado respuesta con estilo sintético diferente.',
    styles: {
      ...BASE_STYLES,
      qSize: 20,
      qBold: true,
      qItalic: false,
      qColor: '#b91c1c',
      aSize: 15,
      aBold: false,
      aItalic: true,
      aColor: '#047857',
    },
    textAlign: 'left',
    alignBySide: { question: 'left', answer: 'right' },
  },
  image: {
    question: 'Pregunta sintética con imagen mock.',
    answer: 'Respuesta sintética para la imagen mock.',
    styles: BASE_STYLES,
    textAlign: 'center',
    contentImage: MOCK_IMAGE,
    imageSide: 'question',
  },
  error: {
    question: 'Pregunta sintética para error de guardado.',
    answer: 'Respuesta sintética para error de guardado.',
    styles: BASE_STYLES,
    textAlign: 'left',
    error: 'Error de guardado simulado.',
    saveMode: 'error',
  },
  saving: {
    question: 'Pregunta sintética durante guardado.',
    answer: 'Respuesta sintética durante guardado.',
    styles: BASE_STYLES,
    textAlign: 'left',
    saving: true,
  },
});

const diagnostics = createManualEditorDiagnostics();
const listenerProbe = installManualEditorListenerProbe(window);
const stopObservingHarness = observeManualEditorHarnessEvents(diagnostics, window);

function installPickerStubs() {
  const prototype = window.HTMLInputElement.prototype;
  const nativeClick = prototype.click;
  const originalShowPickerDescriptor = Object.getOwnPropertyDescriptor(prototype, 'showPicker');
  const state = {
    colorMode: 'success',
    colorRequests: 0,
    colorFallbackClicks: 0,
    imageRequests: 0,
  };

  Object.defineProperty(prototype, 'showPicker', {
    configurable: true,
    get() {
      if (this.type !== 'color') {
        return originalShowPickerDescriptor?.get?.call(this)
          ?? originalShowPickerDescriptor?.value;
      }
      if (state.colorMode === 'absent') return undefined;
      return function showPickerHarnessStub() {
        state.colorRequests += 1;
        diagnostics.record('picker:color:show-picker');
        if (state.colorMode === 'throw') {
          throw new DOMException('Harness rejection', 'NotAllowedError');
        }
      };
    },
  });

  prototype.click = function clickHarnessStub() {
    if (this.type === 'file') {
      state.imageRequests += 1;
      diagnostics.record('picker:image:click');
      return;
    }
    if (this.type === 'color') {
      state.colorFallbackClicks += 1;
      diagnostics.record('picker:color:fallback-click');
      return;
    }
    return nativeClick.call(this);
  };

  return {
    configureColor(mode) {
      state.colorMode = ['success', 'throw', 'absent'].includes(mode) ? mode : 'success';
    },
    read() {
      return { ...state };
    },
    reset() {
      state.colorRequests = 0;
      state.colorFallbackClicks = 0;
      state.imageRequests = 0;
    },
    restore() {
      prototype.click = nativeClick;
      if (originalShowPickerDescriptor) {
        Object.defineProperty(prototype, 'showPicker', originalShowPickerDescriptor);
      } else {
        delete prototype.showPicker;
      }
    },
  };
}

const pickerStubs = installPickerStubs();

function installSyntheticGeometryController() {
  const windowDescriptors = {
    visualViewport: Object.getOwnPropertyDescriptor(window, 'visualViewport'),
    innerWidth: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
    innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
  };
  const documentDescriptors = {
    clientWidth: Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth'),
    clientHeight: Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight'),
  };
  const fakeViewport = new EventTarget();
  let current = null;

  for (const field of ['width', 'height', 'offsetLeft', 'offsetTop', 'scale']) {
    Object.defineProperty(fakeViewport, field, {
      configurable: true,
      get: () => current?.visual?.[field],
    });
  }

  const restoreDescriptor = (target, property, descriptor) => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else delete target[property];
  };

  const apply = (sample) => {
    if (!sample?.layout) return false;
    current = {
      source: sample.source === 'layout-fallback' ? 'layout-fallback' : 'visual-viewport',
      layout: {
        left: 0,
        top: 0,
        width: Number(sample.layout.width),
        height: Number(sample.layout.height),
      },
      visual: {
        left: Number(sample.visual?.left ?? sample.visual?.offsetLeft ?? 0),
        top: Number(sample.visual?.top ?? sample.visual?.offsetTop ?? 0),
        width: Number(sample.visual?.width ?? sample.layout.width),
        height: Number(sample.visual?.height ?? sample.layout.height),
        scale: Number(sample.visual?.scale ?? 1),
      },
    };
    current.visual.offsetLeft = current.visual.left;
    current.visual.offsetTop = current.visual.top;

    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: current.layout.width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: current.layout.height });
      Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: current.layout.width });
      Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: current.layout.height });
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: current.source === 'visual-viewport' ? fakeViewport : undefined,
      });
    } catch {
      return false;
    }
    return true;
  };

  const emit = (count = 1) => {
    const repetitions = Math.max(1, Math.min(1000, Math.trunc(count)));
    for (let index = 0; index < repetitions; index += 1) {
      fakeViewport.dispatchEvent(new Event('resize'));
      fakeViewport.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
    }
  };

  return {
    apply,
    emit,
    read: () => (current ? structuredClone(current) : null),
    restore() {
      restoreDescriptor(window, 'visualViewport', windowDescriptors.visualViewport);
      restoreDescriptor(window, 'innerWidth', windowDescriptors.innerWidth);
      restoreDescriptor(window, 'innerHeight', windowDescriptors.innerHeight);
      restoreDescriptor(document.documentElement, 'clientWidth', documentDescriptors.clientWidth);
      restoreDescriptor(document.documentElement, 'clientHeight', documentDescriptors.clientHeight);
      current = null;
    },
  };
}

const syntheticGeometry = installSyntheticGeometryController();

function cloneFixture(name) {
  const fixture = FIXTURES[name] || FIXTURES.distinct;
  return {
    ...fixture,
    styles: { ...fixture.styles },
    contentImage: fixture.contentImage || '',
    imageSide: fixture.imageSide || '',
    error: fixture.error || '',
    saveMode: fixture.saveMode || 'success',
    saving: Boolean(fixture.saving),
  };
}

function Harness() {
  const initial = useMemo(() => cloneFixture('distinct'), []);
  const [fixtureName, setFixtureName] = useState('distinct');
  const [open, setOpen] = useState(false);
  const [initialSide, setInitialSide] = useState('question');
  const [question, setQuestion] = useState(initial.question);
  const [answer, setAnswer] = useState(initial.answer);
  const [styles, setStyles] = useState(initial.styles);
  const [textAlign, setTextAlign] = useState(initial.textAlign);
  const [contentImage, setContentImage] = useState(initial.contentImage);
  const [imageSide, setImageSide] = useState(initial.imageSide);
  const [error, setError] = useState(initial.error);
  const [saving, setSaving] = useState(initial.saving);
  const [saveMode, setSaveMode] = useState(initial.saveMode);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, forceRender] = useState(0);
  const renderCountRef = useRef(0);
  const renderCountOutputRef = useRef(null);
  const questionTriggerRef = useRef(null);
  const answerTriggerRef = useRef(null);
  const returnSideRef = useRef('question');

  const updateStyle = useCallback((key, value) => {
    setStyles((current) => ({ ...current, [key]: value }));
  }, []);

  const applyFixture = useCallback((name, side = 'question', shouldOpen = false) => {
    const fixture = cloneFixture(name);
    const normalizedSide = side === 'answer' ? 'answer' : 'question';
    returnSideRef.current = normalizedSide;
    setFixtureName(FIXTURES[name] ? name : 'distinct');
    setQuestion(fixture.question);
    setAnswer(fixture.answer);
    setStyles(fixture.styles);
    setTextAlign(fixture.alignBySide?.[normalizedSide] || fixture.textAlign);
    setContentImage(fixture.contentImage);
    setImageSide(fixture.imageSide);
    setError(fixture.error);
    setSaving(fixture.saving);
    setSaveMode(fixture.saveMode);
    setInitialSide(normalizedSide);
    setOpen(Boolean(shouldOpen));
    diagnostics.record(shouldOpen ? 'state:opening' : 'state:fixture-ready', {
      state: { modal: shouldOpen ? 'opening' : 'closed' },
    });
  }, []);

  const openEditor = useCallback((side = 'question') => {
    const normalizedSide = side === 'answer' ? 'answer' : 'question';
    returnSideRef.current = normalizedSide;
    const sideAlignment = FIXTURES[fixtureName]?.alignBySide?.[normalizedSide];
    if (sideAlignment) setTextAlign(sideAlignment);
    setInitialSide(normalizedSide);
    setOpen(true);
    diagnostics.record('state:opening', { state: { modal: 'opening' } });
  }, [fixtureName]);

  const resolveReturnFocus = useCallback(() => {
    const preferred = returnSideRef.current === 'answer'
      ? answerTriggerRef.current
      : questionTriggerRef.current;
    return preferred?.isConnected
      ? preferred
      : questionTriggerRef.current?.isConnected
        ? questionTriggerRef.current
        : answerTriggerRef.current?.isConnected
          ? answerTriggerRef.current
          : null;
  }, []);

  const closeEditor = useCallback(() => {
    setOpen(false);
    diagnostics.record('state:closing', { state: { modal: 'closing' } });
  }, []);

  const captureSnapshot = useCallback(() => {
    const snapshot = readManualEditorDiagnosticSnapshot({
      windowLike: window,
      documentLike: document,
      renderCount: renderCountRef.current,
      listenerCount: listenerProbe.snapshot(),
    });
    diagnostics.record('snapshot', snapshot || {});
    return snapshot;
  }, []);

  useEffect(() => {
    diagnostics.record(open ? 'state:open' : 'state:closed', {
      state: { modal: open ? 'open' : 'closed' },
    });
  }, [open]);

  useEffect(() => {
    window.__manualEditorHarness = {
      ready: true,
      fixtures: Object.keys(FIXTURES),
      chooseFixture: applyFixture,
      open: openEditor,
      close: closeEditor,
      openSheet: () => setSheetOpen(true),
      closeSheet: () => setSheetOpen(false),
      forceRender: () => forceRender((value) => value + 1),
      getRenderCount: () => renderCountRef.current,
      getDiagnostics: () => diagnostics.read(),
      resetDiagnostics: () => diagnostics.reset(),
      getListenerSnapshot: () => listenerProbe.snapshot(),
      getLayerSnapshot() {
        const modal = document.querySelector('[data-testid="manual-card-editor-modal"]');
        return {
          topId: modal?.dataset.editorLayerTop || null,
          count: Number(modal?.dataset.editorLayerCount || 0),
          ids: [...document.querySelectorAll('[data-editor-layer-id]')]
            .map((node) => node.dataset.editorLayerId),
        };
      },
      getOwnershipSnapshot() {
        return {
          layers: getEditorLayerRuntimeSnapshot(),
          scroll: getScrollLeaseSnapshot(),
        };
      },
      getModalRuntimeSnapshot() {
        const appScrollRoot = document.querySelector('[data-app-scroll-root]');
        const inertRoot = document.getElementById('root');
        const overlayRoot = document.querySelector('[data-editor-overlay-root="true"]');
        const palette = document.querySelector('[data-color-palette="true"]');
        const active = document.activeElement;
        return {
          inert: Boolean(inertRoot?.inert || inertRoot?.hasAttribute('inert')),
          scrollOffsets: {
            app: { x: appScrollRoot?.scrollLeft || 0, y: appScrollRoot?.scrollTop || 0 },
          },
          portalTarget: palette
            ? palette.parentElement === overlayRoot
            : Boolean(overlayRoot),
          activeElement: active && active !== document.body
            ? { tag: active.tagName.toLowerCase(), testId: active.dataset?.testid || '' }
            : null,
        };
      },
      captureSnapshot,
      setGeometrySample: syntheticGeometry.apply,
      emitGeometryEvents: syntheticGeometry.emit,
      getSyntheticGeometry: syntheticGeometry.read,
      getGeometrySnapshot() {
        const modal = document.querySelector('[data-testid="manual-card-editor-modal"]');
        try {
          return JSON.parse(modal?.dataset.editorGeometry || 'null');
        } catch {
          return null;
        }
      },
      getPaletteMetrics() {
        const palette = document.querySelector('[data-color-palette="true"]');
        if (!palette) return null;
        const rect = palette.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          maxWidth: getComputedStyle(palette).maxWidth,
          maxHeight: getComputedStyle(palette).maxHeight,
          geometry: palette.dataset.colorPaletteGeometry,
          epoch: Number(palette.dataset.colorPaletteEpoch || 0),
          revision: Number(palette.dataset.colorPaletteRevision || 0),
        };
      },
      getOverflowSnapshot() {
        return captureSnapshot()?.overflow || null;
      },
      configureColorPicker: pickerStubs.configureColor,
      getPickerState: pickerStubs.read,
      resetPickerState: pickerStubs.reset,
      setSelection(start, end, direction = 'none') {
        const textarea = document.querySelector('[data-testid^="manual-card-editor-"][data-testid$="question"], [data-testid^="manual-card-editor-"][data-testid$="answer"]');
        if (!textarea) return false;
        textarea.focus();
        textarea.setSelectionRange(start, end, direction);
        textarea.dispatchEvent(new Event('select', { bubbles: true }));
        return true;
      },
      commitCustomColor(color = '#123456') {
        const input = document.querySelector('[data-color-palette="true"] input[type="color"]');
        if (!input) return false;
        input.focus();
        input.value = color;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        diagnostics.record('picker:color:commit');
        return true;
      },
      cancelCustomColor() {
        const input = document.querySelector('[data-color-palette="true"] input[type="color"]');
        input?.dispatchEvent(new Event('cancel'));
        diagnostics.record('picker:color:cancel-stub');
        return Boolean(input);
      },
      returnCustomColorUnknown() {
        window.dispatchEvent(new Event('focus'));
        diagnostics.record('picker:color:return-unknown-stub');
      },
      commitImage() {
        const input = document.querySelector('[data-testid="manual-card-editor-modal"] input[type="file"]');
        if (!input) return false;
        const file = new File([new Uint8Array([137, 80, 78, 71])], 'synthetic-fixture.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        diagnostics.record('picker:image:commit');
        return true;
      },
      cancelImage() {
        const input = document.querySelector('[data-testid="manual-card-editor-modal"] input[type="file"]');
        input?.dispatchEvent(new Event('cancel'));
        diagnostics.record('picker:image:cancel-stub');
        return Boolean(input);
      },
      returnImageUnknown() {
        window.dispatchEvent(new Event('focus'));
        diagnostics.record('picker:image:return-unknown-stub');
      },
      getPublicState: () => ({
        fixture: fixtureName,
        modal: open ? 'open' : 'closed',
        sheet: sheetOpen ? 'open' : 'closed',
        activeSide: document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.activeSide || null,
        pickerStatus: document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.pickerStatus || 'idle',
        geometryPhase: document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.geometryPhase || 'unavailable',
        geometryRevision: Number(document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.geometryRevision || 0),
        geometryEpoch: Number(document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.geometryEpoch || 0),
        geometrySource: document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.geometrySource || null,
        geometryOrientation: document.querySelector('[data-testid="manual-card-editor-modal"]')?.dataset.geometryOrientation || null,
      }),
    };

    return () => {
      delete window.__manualEditorHarness;
    };
  }, [applyFixture, captureSnapshot, closeEditor, fixtureName, open, openEditor, sheetOpen]);

  const handleRender = useCallback(() => {
    renderCountRef.current += 1;
    if (renderCountOutputRef.current) {
      renderCountOutputRef.current.textContent = String(renderCountRef.current);
    }
    diagnostics.record('render', { renderCount: renderCountRef.current });
  }, []);

  const handleContentImageFile = useCallback((_event, side) => {
    setContentImage(MOCK_IMAGE);
    setImageSide(side === 'answer' ? 'answer' : 'question');
  }, []);

  const handleSave = useCallback(async () => {
    if (saveMode === 'error') {
      setError('Error de guardado simulado.');
      diagnostics.record('error:save', { error: { name: 'Error', code: 'save-simulated' } });
      return false;
    }
    return true;
  }, [saveMode]);

  return (
    <div className="harness-shell">
      <div className="harness-toolbar" data-testid="harness-toolbar">
        <select
          aria-label="Fixture"
          value={fixtureName}
          onChange={(event) => applyFixture(event.target.value, initialSide, false)}
          data-testid="harness-fixture"
        >
          {Object.keys(FIXTURES).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button ref={questionTriggerRef} type="button" onClick={() => openEditor('question')} data-testid="harness-open-question">Abrir pregunta</button>
        <button ref={answerTriggerRef} type="button" onClick={() => openEditor('answer')} data-testid="harness-open-answer">Abrir respuesta</button>
        <button type="button" onClick={() => setSheetOpen(true)} data-testid="harness-open-sheet">Abrir sheet</button>
        <button type="button" onClick={() => forceRender((value) => value + 1)} data-testid="harness-force-render">Render externo</button>
        <output>renders: <span ref={renderCountOutputRef} data-testid="harness-render-count">0</span></output>
      </div>

      <main className="harness-app-main" data-app-scroll-root data-testid="harness-app-scroll-root">
        <p className="harness-status">Superficie sintética sin autenticación, API ni datos reales.</p>
        <div className="harness-fixture-content" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <div className="harness-card" key={index} />)}
        </div>
      </main>

      <Profiler id="manual-card-editor" onRender={handleRender}>
        <ManualCardEditorModal
          key={open ? initialSide : 'manual-card-editor-closed'}
          open={open}
          initialSide={initialSide}
          question={question}
          setQuestion={setQuestion}
          answer={answer}
          setAnswer={setAnswer}
          contentImage={contentImage}
          imageSide={imageSide}
          handleContentImageFile={handleContentImageFile}
          removeContentImage={() => {
            setContentImage('');
            setImageSide('');
          }}
          onSaveCard={handleSave}
          onClose={closeEditor}
          saving={saving}
          error={error}
          isEditing={false}
          styles={styles}
          updateStyle={updateStyle}
          textAlign={textAlign}
          setTextAlign={setTextAlign}
          resolveReturnFocus={resolveReturnFocus}
        />
      </Profiler>

      <ActionSheet
        open={sheetOpen}
        title="Acciones de prueba"
        onClose={() => setSheetOpen(false)}
        options={[
          {
            id: 'synthetic-action',
            label: 'Acción sintética',
            description: 'No usa datos ni servicios externos.',
            onSelect() {},
          },
        ]}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);

window.addEventListener('pagehide', () => {
  stopObservingHarness();
  pickerStubs.restore();
  syntheticGeometry.restore();
  listenerProbe.restore();
}, { once: true });

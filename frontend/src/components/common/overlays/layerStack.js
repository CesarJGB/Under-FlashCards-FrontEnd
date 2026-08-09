const KINDS = new Set(['popover', 'sheet']);
const FOCUS_POLICIES = new Set(['pointer-preserve', 'move-focus', 'none']);

const hasId = (value) => typeof value === 'string' && value.trim().length > 0;

const serializeLayer = (layer, order) => {
  if (!layer || !hasId(layer.id) || layer.nativePicker === true) return null;
  return {
    id: layer.id,
    ownerId: hasId(layer.ownerId) ? layer.ownerId : 'overlay',
    kind: KINDS.has(layer.kind) ? layer.kind : 'popover',
    focusPolicy: FOCUS_POLICIES.has(layer.focusPolicy) ? layer.focusPolicy : 'none',
    order,
    token: hasId(layer.token) ? layer.token : `${layer.id}:${order}`,
    historyToken: hasId(layer.historyToken) ? layer.historyToken : null,
  };
};

const finish = (state, layers, nextOrder = state.nextOrder) => ({
  layers,
  topId: layers.at(-1)?.id ?? null,
  nextOrder,
});

export function createEditorLayerState() {
  return { layers: [], topId: null, nextOrder: 1 };
}

export function editorLayerReducer(state = createEditorLayerState(), event = {}) {
  switch (event.type) {
    case 'OPEN_LAYER': {
      const layer = serializeLayer(event.layer, state.nextOrder);
      if (!layer) return state;
      const existing = state.layers.find((entry) => entry.id === layer.id);
      if (existing?.token === layer.token) return state;
      const layers = state.layers.filter((entry) => (
        entry.id !== layer.id
        && !(event.replaceOwner === true && entry.ownerId === layer.ownerId)
      ));
      return finish(state, [...layers, layer], state.nextOrder + 1);
    }

    case 'TOGGLE_LAYER': {
      const requestedId = event.layer?.id;
      if (!hasId(requestedId)) return state;
      const existing = state.layers.find((entry) => entry.id === requestedId);
      if (existing) {
        if (event.expectedToken && event.expectedToken !== existing.token) return state;
        return finish(state, state.layers.filter((entry) => entry.id !== requestedId));
      }
      return editorLayerReducer(state, {
        type: 'OPEN_LAYER',
        layer: event.layer,
        replaceOwner: event.replaceOwner,
      });
    }

    case 'DISMISS_TOP': {
      const top = state.layers.at(-1);
      if (!top) return state;
      if (event.id && event.id !== top.id) return state;
      if (event.token && event.token !== top.token) return state;
      return finish(state, state.layers.slice(0, -1));
    }

    case 'REMOVE_LAYER': {
      const existing = state.layers.find((entry) => entry.id === event.id);
      if (!existing || (event.token && event.token !== existing.token)) return state;
      return finish(state, state.layers.filter((entry) => entry.id !== event.id));
    }

    case 'RESET':
      return state.layers.length === 0 && state.nextOrder === 1
        ? state
        : createEditorLayerState();

    default:
      return state;
  }
}

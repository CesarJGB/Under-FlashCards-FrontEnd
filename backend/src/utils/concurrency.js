function toConcurrency(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function createAbortError() {
  const error = new Error('La operación fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function createConcurrencyLimiter(concurrency) {
  const limit = toConcurrency(concurrency);
  const queue = [];
  let activeCount = 0;

  function dispatch() {
    while (activeCount < limit && queue.length > 0) {
      const entry = queue.shift();
      entry.signal?.removeEventListener('abort', entry.abort);
      if (entry.signal?.aborted) {
        entry.reject(createAbortError());
        continue;
      }

      activeCount += 1;
      let released = false;
      entry.resolve(() => {
        if (released) return;
        released = true;
        activeCount -= 1;
        dispatch();
      });
    }
  }

  function acquire({ signal } = {}) {
    if (signal?.aborted) return Promise.reject(createAbortError());

    if (activeCount < limit) {
      activeCount += 1;
      let released = false;
      return Promise.resolve(() => {
        if (released) return;
        released = true;
        activeCount -= 1;
        dispatch();
      });
    }

    return new Promise((resolve, reject) => {
      const entry = { signal, resolve, reject, abort: null };
      entry.abort = () => {
        const index = queue.indexOf(entry);
        if (index !== -1) queue.splice(index, 1);
        reject(createAbortError());
      };
      signal?.addEventListener('abort', entry.abort, { once: true });
      queue.push(entry);
    });
  }

  return { acquire };
}

async function mapWithConcurrency(items, concurrency, mapper, { signal } = {}) {
  if (!Array.isArray(items)) throw new TypeError('items debe ser un arreglo.');
  if (typeof mapper !== 'function') throw new TypeError('mapper debe ser una función.');
  if (items.length === 0) return [];

  const results = new Array(items.length);
  const workerCount = Math.min(items.length, toConcurrency(concurrency));
  let nextIndex = 0;
  let firstError = null;

  async function runWorker() {
    while (!firstError && !signal?.aborted) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      if (itemIndex >= items.length) return;

      try {
        results[itemIndex] = await mapper(items[itemIndex], itemIndex);
      } catch (error) {
        firstError ??= error;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));

  if (firstError) throw firstError;
  if (signal?.aborted) throw createAbortError();
  return results;
}

module.exports = { createConcurrencyLimiter, mapWithConcurrency };

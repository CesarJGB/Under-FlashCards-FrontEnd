const MAX_TEXT_LENGTH = 600;
const SENSITIVE_QUERY_KEY = /^(?:access[_-]?token|api[_-]?key|authorization|client[_-]?secret|code|cookie|credential|id[_-]?token|nonce|password|refresh[_-]?token|secret|session|state|token)$/i;
const KNOWN_EXTERNAL_HOST = /(^|\.)(?:accounts\.google\.com|google\.com|googleapis\.com|gstatic\.com|googleusercontent\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/i;

function limitText(value) {
  return String(value ?? '').slice(0, MAX_TEXT_LENGTH);
}

export function sanitizeText(value) {
  return limitText(value)
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/(["']?\b(?:access[_-]?token|api[_-]?key|authorization|client[_-]?secret|code|cookie|credential|id[_-]?token|nonce|password|refresh[_-]?token|secret|session|state|token)\b["']?)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,\s;&}]+)/gi, '$1:[REDACTED]')
    .replace(/\b(?:access[_-]?token|api[_-]?key|authorization|client[_-]?secret|code|cookie|credential|id[_-]?token|nonce|password|refresh[_-]?token|secret|session|state|token)\s*[:=]\s*[^\s,;&]+/gi, (match) => {
      const key = match.slice(0, match.search(/[:=]/));
      return `${key}[REDACTED]`;
    })
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
}

export function sanitizeUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value, 'http://127.0.0.1');
    if (!['http:', 'https:'].includes(url.protocol)) {
      return `${url.protocol}//[REDACTED]`;
    }
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    url.hash = '';
    return url.toString();
  } catch {
    return sanitizeText(value);
  }
}

function readResourceType(request) {
  try {
    return request.resourceType();
  } catch {
    return null;
  }
}

function isApiRequest(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname === '/api' || pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function isKnownExternalUrl(url) {
  try {
    return KNOWN_EXTERNAL_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function getConsoleLocation(message) {
  const location = message.location?.();
  return location?.url ? sanitizeUrl(location.url) : null;
}

export function installBrowserDiagnostics(page) {
  const state = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };

  const onConsole = (message) => {
    const entry = {
      type: message.type(),
      text: sanitizeText(message.text()),
      location: getConsoleLocation(message),
    };

    if (message.type() === 'error') state.consoleErrors.push(entry);
    if (message.type() === 'warning') state.consoleWarnings.push(entry);
  };

  const onPageError = (error) => {
    state.pageErrors.push({
      name: sanitizeText(error?.name || 'Error'),
      message: sanitizeText(error?.message || error),
      stack: sanitizeText(error?.stack || ''),
    });
  };

  const onRequestFailed = (request) => {
    const url = sanitizeUrl(request.url());
    state.requestFailures.push({
      url,
      method: request.method(),
      resourceType: readResourceType(request),
      failure: sanitizeText(request.failure()?.errorText || 'unknown'),
      api: isApiRequest(request.url()),
      external: isKnownExternalUrl(request.url()),
    });
  };

  const onResponse = (response) => {
    const status = response.status();
    if (status < 400) return;

    const request = response.request();
    const url = request.url();
    state.httpErrors.push({
      url: sanitizeUrl(url),
      method: request.method(),
      status,
      statusText: sanitizeText(response.statusText()),
      resourceType: readResourceType(request),
      api: isApiRequest(url),
      external: isKnownExternalUrl(url),
    });
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  return {
    snapshot({ project = null, browser = null, viewport = null } = {}) {
      return {
        project,
        browser,
        viewport: viewport || page.viewportSize(),
        currentUrl: sanitizeUrl(page.url()),
        consoleErrors: [...state.consoleErrors],
        consoleWarnings: [...state.consoleWarnings],
        pageErrors: [...state.pageErrors],
        requestFailures: [...state.requestFailures],
        httpErrors: [...state.httpErrors],
      };
    },
    stop() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    },
  };
}

function addClassification(classifications, value) {
  if (!classifications.includes(value)) classifications.push(value);
}

export function classifyDiagnostics(diagnostics, { appMounted = false, rootResponseStatus = null } = {}) {
  const backendNetworkFailures = diagnostics.requestFailures.filter((entry) => entry.api);
  const backendHttpErrors = diagnostics.httpErrors.filter((entry) => entry.api);
  const externalFailures = [
    ...diagnostics.requestFailures.filter((entry) => entry.external),
    ...diagnostics.httpErrors.filter((entry) => entry.external),
  ];
  const unexpectedFailures = [
    ...diagnostics.requestFailures.filter((entry) => !entry.api && !entry.external),
    ...diagnostics.httpErrors.filter((entry) => !entry.api && !entry.external),
  ];
  const classifications = [];

  if (diagnostics.pageErrors.length > 0) {
    addClassification(classifications, 'FRONTEND_RUNTIME_ERROR');
  }

  if (!appMounted) {
    addClassification(classifications, 'APP_NOT_MOUNTED');
  } else if (rootResponseStatus >= 200 && rootResponseStatus < 400 && diagnostics.pageErrors.length === 0) {
    addClassification(classifications, 'APP_BOOT_OK');
  }

  if (
    backendNetworkFailures.length > 0
    || backendHttpErrors.some((entry) => entry.status >= 500)
  ) {
    addClassification(classifications, 'BACKEND_UNAVAILABLE');
  }

  if (backendHttpErrors.some((entry) => entry.status >= 400 && entry.status < 500)) {
    addClassification(classifications, 'BACKEND_HTTP_ERROR');
  }

  if (externalFailures.length > 0) {
    addClassification(classifications, 'EXTERNAL_RESOURCE_FAILURE');
  }

  if (unexpectedFailures.length > 0 || classifications.length === 0) {
    addClassification(classifications, 'OTHER');
  }

  return {
    primaryClassification: classifications[0],
    classifications,
    backendUnavailableCount: backendNetworkFailures.length
      + backendHttpErrors.filter((entry) => entry.status >= 500).length,
    externalFailureCount: externalFailures.length,
    unexpectedFailureCount: unexpectedFailures.length,
  };
}

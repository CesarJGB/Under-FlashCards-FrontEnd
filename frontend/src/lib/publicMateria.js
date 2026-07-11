export const PUBLIC_MATERIA_QUERY_PARAM = 'materiaPublica';

export function getPublicMateriaShareId() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const shareId = params.get(PUBLIC_MATERIA_QUERY_PARAM);

  return shareId?.trim() || null;
}

export function buildPublicMateriaUrl(shareId) {
  if (!shareId || typeof window === 'undefined') return '';

  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PUBLIC_MATERIA_QUERY_PARAM, shareId);

  return url.toString();
}

import { useCallback, useEffect, useRef } from 'react';

const scrollRegistry = new Map();
const inertRegistry = new Map();
const legacyReleases = new Map();

const incrementOwner = (owners, owner) => {
  owners.set(owner, (owners.get(owner) || 0) + 1);
};

const decrementOwner = (owners, owner) => {
  const count = owners.get(owner) || 0;
  if (count <= 1) owners.delete(owner);
  else owners.set(owner, count - 1);
};

const snapshotInert = (node) => ({
  hadAttribute: Boolean(node?.hasAttribute?.('inert')),
  attributeValue: node?.getAttribute?.('inert'),
  hasProperty: Boolean(node && 'inert' in node),
  propertyValue: node && 'inert' in node ? node.inert : undefined,
});

const applyInert = (node) => {
  if (!node) return;
  if ('inert' in node) node.inert = true;
  else node.setAttribute?.('inert', '');
};

const restoreInert = (node, snapshot) => {
  if (!node || !snapshot) return;
  if (snapshot.hasProperty) node.inert = snapshot.propertyValue;
  if (snapshot.hadAttribute) node.setAttribute?.('inert', snapshot.attributeValue ?? '');
  else node.removeAttribute?.('inert');
};

const acquireInert = (node, owner) => {
  if (!node) return () => {};
  let record = inertRegistry.get(node);
  if (!record) {
    record = { owners: new Map(), snapshot: snapshotInert(node) };
    inertRegistry.set(node, record);
    applyInert(node);
  }
  incrementOwner(record.owners, owner);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = inertRegistry.get(node);
    if (!current) return;
    decrementOwner(current.owners, owner);
    if (current.owners.size > 0) return;
    restoreInert(node, current.snapshot);
    inertRegistry.delete(node);
  };
};

export function acquireScrollLease({ owner = 'default', scrollRoot, inertRoot } = {}) {
  if (!scrollRoot) return acquireInert(inertRoot, owner);
  let record = scrollRegistry.get(scrollRoot);
  if (!record) {
    record = {
      owners: new Map(),
      snapshot: {
        overflow: scrollRoot.style?.overflow ?? '',
        overflowX: scrollRoot.style?.overflowX ?? '',
        overflowY: scrollRoot.style?.overflowY ?? '',
        overscrollBehavior: scrollRoot.style?.overscrollBehavior ?? '',
        overscrollBehaviorX: scrollRoot.style?.overscrollBehaviorX ?? '',
        overscrollBehaviorY: scrollRoot.style?.overscrollBehaviorY ?? '',
        scrollTop: scrollRoot.scrollTop ?? 0,
        scrollLeft: scrollRoot.scrollLeft ?? 0,
      },
    };
    scrollRegistry.set(scrollRoot, record);
    if (scrollRoot.style) {
      scrollRoot.style.overflow = 'hidden';
      scrollRoot.style.overscrollBehavior = 'none';
    }
  }
  incrementOwner(record.owners, owner);
  const releaseInert = acquireInert(inertRoot, owner);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    releaseInert();
    const current = scrollRegistry.get(scrollRoot);
    if (!current) return;
    decrementOwner(current.owners, owner);
    if (current.owners.size > 0) return;
    if (scrollRoot.style) {
      scrollRoot.style.overflow = current.snapshot.overflow;
      scrollRoot.style.overflowX = current.snapshot.overflowX;
      scrollRoot.style.overflowY = current.snapshot.overflowY;
      scrollRoot.style.overscrollBehavior = current.snapshot.overscrollBehavior;
      scrollRoot.style.overscrollBehaviorX = current.snapshot.overscrollBehaviorX;
      scrollRoot.style.overscrollBehaviorY = current.snapshot.overscrollBehaviorY;
    }
    scrollRoot.scrollTop = current.snapshot.scrollTop;
    scrollRoot.scrollLeft = current.snapshot.scrollLeft;
    scrollRegistry.delete(scrollRoot);
  };
}

export function acquireScrollLeaseGroup({
  owner = 'default',
  scrollRoots = [],
  inertRoot,
} = {}) {
  const roots = [...new Set(scrollRoots.filter(Boolean))];
  const releases = roots.length > 0
    ? roots.map((scrollRoot, index) => acquireScrollLease({
      owner,
      scrollRoot,
      inertRoot: index === 0 ? inertRoot : null,
    }))
    : [acquireScrollLease({ owner, inertRoot })];
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releases.reverse().forEach((release) => release());
  };
}

export function useScrollLease(config = {}) {
  const releaseRef = useRef(null);
  const { active = true, owner, scrollRoot, inertRoot } = config;
  useEffect(() => {
    if (!active || !scrollRoot) return undefined;
    const release = acquireScrollLease({ owner, scrollRoot, inertRoot });
    releaseRef.current = release;
    return () => {
      release();
      if (releaseRef.current === release) releaseRef.current = null;
    };
  }, [active, inertRoot, owner, scrollRoot]);

  return useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);
}

export function getScrollLeaseSnapshot() {
  return {
    scrollRoots: scrollRegistry.size,
    inertRoots: inertRegistry.size,
    ownerCount: [...scrollRegistry.values()].reduce(
      (total, record) => total + record.owners.size,
      0,
    ),
    owners: [...scrollRegistry.values()].flatMap((record) => [...record.owners.keys()]),
  };
}

export function lockBodyScroll(owner = 'default') {
  if (legacyReleases.has(owner) || typeof document === 'undefined') return;
  legacyReleases.set(owner, acquireScrollLease({ owner, scrollRoot: document.body }));
}

export function unlockBodyScroll(owner = 'default') {
  const release = legacyReleases.get(owner);
  if (!release) return;
  legacyReleases.delete(owner);
  release();
}

export function useBodyScrollLock(active = true, owner = 'default') {
  useEffect(() => {
    if (!active) return undefined;
    lockBodyScroll(owner);
    return () => unlockBodyScroll(owner);
  }, [active, owner]);
}

export function isBodyScrollLocked() {
  return typeof document !== 'undefined' && scrollRegistry.has(document.body);
}

// Mantener alineada con las muestras no blancas de frontend/src/lib/deckColors.js.
const DECK_AUTO_COLOR_PALETTE = Object.freeze([
  '#fde68a',
  '#fca5a5',
  '#a7f3d0',
  '#93c5fd',
  '#c4b5fd',
  '#f9a8d4',
  '#1f2937',
]);

function getRandomDeckColor(random = Math.random) {
  const index = Math.min(
    DECK_AUTO_COLOR_PALETTE.length - 1,
    Math.floor(random() * DECK_AUTO_COLOR_PALETTE.length)
  );
  return DECK_AUTO_COLOR_PALETTE[index];
}

function resolveDeckCoverColor(value, random = Math.random) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return getRandomDeckColor(random);
}

module.exports = {
  DECK_AUTO_COLOR_PALETTE,
  getRandomDeckColor,
  resolveDeckCoverColor,
};

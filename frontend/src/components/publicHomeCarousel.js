export const PUBLIC_HOME_SLIDE_COUNT = 4;
export const PUBLIC_HOME_AUTOPLAY_MS = 4800;

export function getNextPublicHomeSlide(index, direction = 1) {
  return (index + direction + PUBLIC_HOME_SLIDE_COUNT) % PUBLIC_HOME_SLIDE_COUNT;
}

export function canAutoplayPublicHome({ reducedMotion, documentVisible, interacting }) {
  return !reducedMotion && documentVisible && !interacting;
}

export function splitPublicHomeEmphasis(text, emphasis) {
  const start = text.indexOf(emphasis);
  if (start < 0) return [{ text, emphasized: false }];
  return [
    { text: text.slice(0, start), emphasized: false },
    { text: emphasis, emphasized: true },
    { text: text.slice(start + emphasis.length), emphasized: false },
  ].filter((segment) => segment.text);
}

export const PUBLIC_HOME_SLIDE_COUNT = 4;
export const PUBLIC_HOME_AUTOPLAY_MS = 4800;

export function getNextPublicHomeSlide(index, direction = 1) {
  return (index + direction + PUBLIC_HOME_SLIDE_COUNT) % PUBLIC_HOME_SLIDE_COUNT;
}

export function canAutoplayPublicHome({ reducedMotion, documentVisible, interacting }) {
  return !reducedMotion && documentVisible && !interacting;
}

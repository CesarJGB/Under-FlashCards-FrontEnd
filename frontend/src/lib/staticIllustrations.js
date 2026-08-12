import studyModes from '../../media/svg/Modo estudio v2.svg';
import minigames from '../../media/svg/Minijuegos.svg';
import exams from '../../media/svg/Exámenes .svg';
import features from '../../media/svg/Funcionalidades .svg';
import dailyChallenge from '../../media/svg/Reto diario  .svg';
import schoolCalendar from '../../media/svg/Calendario escolar .svg';
import quickNotes from '../../media/svg/Notas .svg';

export const staticIllustrations = Object.freeze({
  studyModes,
  minigames,
  exams,
  features,
  dailyChallenge,
  schoolCalendar,
  quickNotes,
});

export const staticIllustrationUrls = Object.freeze([
  ...new Set(Object.values(staticIllustrations)),
]);

const preloadedImages = new Map();
const browserUnavailableResult = Promise.resolve([]);
let preloadPromise;

function preloadIllustration(url) {
  const existing = preloadedImages.get(url);
  if (existing) return existing.promise;

  const image = new window.Image();
  const promise = new Promise((resolve, reject) => {
    image.onload = async () => {
      if (typeof image.decode === 'function') {
        try {
          await image.decode();
        } catch {
          // Some Safari versions reject decode() for an otherwise loaded image.
        }
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Unable to preload illustration: ${url}`));
  });

  preloadedImages.set(url, { image, promise });
  image.src = url;
  return promise;
}

export function preloadStaticIllustrations() {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') {
    return browserUnavailableResult;
  }

  if (!preloadPromise) {
    preloadPromise = Promise.allSettled(staticIllustrationUrls.map(preloadIllustration));
  }

  return preloadPromise;
}

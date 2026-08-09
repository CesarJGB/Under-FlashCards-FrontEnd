const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

export function normalizeHexColor(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;
  if (/^#[0-9a-f]{6}$/.test(withHash)) return withHash;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    return `#${withHash.slice(1).split('').map((digit) => `${digit}${digit}`).join('')}`;
  }
  return null;
}

export function hexToHsl(value, fallback = '#0f172a') {
  const hex = normalizeHexColor(value) || normalizeHexColor(fallback) || '#0f172a';
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  const saturation = delta === 0
    ? 0
    : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    h: hue,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

export function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) || 0) % 360 + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = h / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment < 1) [red, green] = [chroma, secondary];
  else if (segment < 2) [red, green] = [secondary, chroma];
  else if (segment < 3) [green, blue] = [chroma, secondary];
  else if (segment < 4) [green, blue] = [secondary, chroma];
  else if (segment < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];

  const match = l - chroma / 2;
  const channel = (value) => Math.round((value + match) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

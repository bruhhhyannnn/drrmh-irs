import { CAMPUS_LOGO_EDGE } from './campus-logo';

// Browser-only: scales a chosen campus logo (PNG, JPG or SVG) into a 512 × 512 square before
// upload, centred and keeping transparency. WebP where the browser can encode it, else PNG.

/** File types the Logo field accepts. */
export const LOGO_INPUT_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function scaleLogo(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    // An SVG without width and height has no natural size; draw it at the full square.
    const width = image.naturalWidth || CAMPUS_LOGO_EDGE;
    const height = image.naturalHeight || CAMPUS_LOGO_EDGE;
    const scale = Math.min(CAMPUS_LOGO_EDGE / width, CAMPUS_LOGO_EDGE / height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = CAMPUS_LOGO_EDGE;
    canvas.height = CAMPUS_LOGO_EDGE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser can’t prepare images.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, (CAMPUS_LOGO_EDGE - w) / 2, (CAMPUS_LOGO_EDGE - h) / 2, w, h);

    // Browsers that can't encode WebP hand back a PNG instead.
    const webp = await toBlob(canvas, 'image/webp', 0.92);
    if (webp?.type === 'image/webp') return webp;
    const png = await toBlob(canvas, 'image/png');
    if (!png) throw new Error('The logo couldn’t be prepared.');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

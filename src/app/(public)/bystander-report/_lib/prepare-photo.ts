// Photos are prepared on the device before they are kept or sent: scaled to at most 1600px on
// the long edge and re-encoded as JPEG through a canvas. Re-encoding drops all metadata,
// including the GPS location a phone camera writes into the file. The server strips JPEG
// metadata again (src/lib/bystander-photos.ts) in case a client skips this step.

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function preparePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    // Browsers apply the camera's orientation flag when decoding and drawing, so the
    // re-encoded photo keeps the right way up after the flag itself is dropped.
    await image.decode();

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    // JPEG has no transparency; without a fill, transparent PNG areas turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
        'image/jpeg',
        JPEG_QUALITY
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

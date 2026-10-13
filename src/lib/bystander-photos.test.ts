import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signBystanderPhotos, uploadBystanderPhotos } from './bystander-photos';

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock('./supabase-admin', () => ({
  supabaseAdmin: { storage: { from: () => storage } },
}));

/** One JPEG marker segment: FF, marker, a two-byte length that counts itself, the payload. */
const segment = (marker: number, payload: number[]) => {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
};

const SOI = [0xff, 0xd8];
const JFIF = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]);
const EXIF_GPS = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53]);
const ICC = segment(0xe2, [0x49, 0x43, 0x43, 0x5f]);
const XMP = segment(0xe1, [0x68, 0x74, 0x74, 0x70]);
const COMMENT = segment(0xfe, [0x68, 0x69]);
const QUANT_TABLE = segment(0xdb, [0x00, 0x01]);
const SCAN = [...segment(0xda, [0x01, 0x02]), 0x12, 0x34, 0x56, 0xff, 0xd9];

const jpeg = (...parts: number[][]) => new Blob([new Uint8Array(parts.flat())]);

/** The bytes handed to Storage for each upload, in call order. */
const uploadedBytes = () =>
  storage.upload.mock.calls.map(([, bytes]) => Array.from(bytes as Uint8Array));

beforeEach(() => {
  storage.upload.mockResolvedValue({ error: null });
});

describe('uploadBystanderPhotos', () => {
  it('removes Exif, XMP and comments but keeps JFIF and the colour profile', async () => {
    const photo = jpeg(SOI, JFIF, EXIF_GPS, ICC, XMP, COMMENT, QUANT_TABLE, SCAN);

    const paths = await uploadBystanderPhotos('report-1', [photo]);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^report-1\/[0-9a-f-]{36}\.jpg$/);
    expect(uploadedBytes()).toEqual([[...SOI, ...JFIF, ...ICC, ...QUANT_TABLE, ...SCAN]]);
    expect(storage.upload).toHaveBeenCalledWith(paths[0], expect.any(Uint8Array), {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('skips files that are empty, too large or not a JPEG', async () => {
    const tooLarge = new Blob([new Uint8Array(3 * 1024 * 1024 + 1)]);
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]);
    const truncated = jpeg(SOI, [0xff, 0xe1, 0x00]);

    const paths = await uploadBystanderPhotos('report-1', [new Blob([]), tooLarge, png, truncated]);

    expect(paths).toEqual([]);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('uploads at most three photos', async () => {
    const photo = jpeg(SOI, JFIF, SCAN);

    const paths = await uploadBystanderPhotos('report-1', [photo, photo, photo, photo]);

    expect(paths).toHaveLength(3);
    expect(storage.upload).toHaveBeenCalledTimes(3);
  });

  it('drops a photo that fails to upload without failing the rest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.upload
      .mockResolvedValueOnce({ error: { message: 'Bucket not found' } })
      .mockResolvedValueOnce({ error: null });
    const photo = jpeg(SOI, JFIF, SCAN);

    const paths = await uploadBystanderPhotos('report-1', [photo, photo]);

    expect(paths).toHaveLength(1);
  });
});

describe('signBystanderPhotos', () => {
  it('returns the signed URLs that were made', async () => {
    storage.createSignedUrls.mockResolvedValue({
      data: [{ signedUrl: 'https://storage/a' }, { signedUrl: null }],
      error: null,
    });

    expect(await signBystanderPhotos(['a.jpg', 'b.jpg'])).toEqual(['https://storage/a']);
    expect(await signBystanderPhotos([])).toEqual([]);
  });

  it('gives a readable error when signing fails', async () => {
    storage.createSignedUrls.mockResolvedValue({ data: null, error: { message: 'JWT expired' } });

    await expect(signBystanderPhotos(['a.jpg'])).rejects.toThrow(
      'Could not load the photos for this report.'
    );
  });
});

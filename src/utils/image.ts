/**
 * Redução de fotos antes de salvar. Fotos de celular (12 MP, 3-6 MB) em base64
 * enchem o localStorage em poucas OS; reduzidas a 1600 px em JPEG 0,7 ficam
 * com ~200-400 KB.
 */

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_JPEG_QUALITY = 0.7;

export interface Size {
  width: number;
  height: number;
}

/** Encaixa as dimensões no lado máximo, mantendo a proporção. Nunca amplia. */
export function fitWithin(width: number, height: number, maxSide: number): Size {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

type Drawable = ImageBitmap | HTMLImageElement | HTMLVideoElement;

function drawToJpeg(source: Drawable, size: Size, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

/**
 * Converte um arquivo de imagem ou o quadro atual de um <video> em data URL JPEG
 * reduzido. Respeita a orientação EXIF quando o navegador suporta
 * `createImageBitmap` (o fallback com <img> também aplica EXIF nos navegadores atuais).
 */
export async function downscaleToDataUrl(
  source: Blob | HTMLVideoElement,
  maxSide: number = PHOTO_MAX_SIDE,
  quality: number = PHOTO_JPEG_QUALITY
): Promise<string> {
  if (source instanceof HTMLVideoElement) {
    const size = fitWithin(source.videoWidth || 640, source.videoHeight || 480, maxSide);
    return drawToJpeg(source, size, quality);
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
      try {
        return drawToJpeg(bitmap, fitWithin(bitmap.width, bitmap.height, maxSide), quality);
      } finally {
        bitmap.close();
      }
    } catch {
      // formato não suportado pelo createImageBitmap (ex.: Safari antigo): tenta com <img>
    }
  }

  const img = await loadImageElement(source);
  return drawToJpeg(img, fitWithin(img.naturalWidth, img.naturalHeight, maxSide), quality);
}

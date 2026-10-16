import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { http } from '../../services/http';
import { Photo } from '../../types';

/** Fotos são imutáveis: uma vez baixadas, ficam em memória durante a sessão. */
const cache = new Map<string, Promise<string>>();

function load(path: string): Promise<string> {
  let pending = cache.get(path);
  if (!pending) {
    pending = http.blob(path).then((blob) => URL.createObjectURL(blob));
    pending.catch(() => cache.delete(path));
    cache.set(path, pending);
  }
  return pending;
}

/**
 * <img> para fotos da OS. As da equipe exigem o token (baixadas com fetch autenticado);
 * as do portal e as ainda não enviadas (data URL) usam a URL direta.
 */
export const PhotoImage: React.FC<{ photo: Photo; alt?: string; className?: string }> = ({
  photo,
  alt,
  className,
}) => {
  const [src, setSrc] = useState<string | null>(photo.authPath ? null : photo.url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!photo.authPath) {
      setSrc(photo.url);
      return;
    }
    let alive = true;
    setFailed(false);
    load(photo.authPath)
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [photo.authPath, photo.url]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-stone-900 text-stone-600 ${className ?? ''}`}>
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }
  if (!src) {
    return <div className={`bg-stone-900 animate-pulse ${className ?? ''}`} />;
  }
  return <img src={src} alt={alt ?? photo.caption} className={className} loading="lazy" />;
};

/** Reduz a foto da câmera antes do envio (celulares geram 4–12 MB por foto). */
export async function shrinkImage(dataUrl: string, maxSide = 1600, quality = 0.82): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

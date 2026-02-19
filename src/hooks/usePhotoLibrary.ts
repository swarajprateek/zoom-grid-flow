import { useState, useCallback } from "react";

export interface Photo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  file: File;
  addedAt: number;
}

function createThumbnail(file: File, maxSize = 300): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  const addPhotos = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newPhotos: Photo[] = await Promise.all(
      imageFiles.map(async (file) => {
        const url = URL.createObjectURL(file);
        const thumbnailUrl = await createThumbnail(file);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          thumbnailUrl,
          file,
          addedAt: Date.now(),
        };
      })
    );
    setPhotos((prev) => [...newPhotos, ...prev]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const downloadPhoto = useCallback((photo: Photo) => {
    const a = document.createElement("a");
    a.href = photo.url;
    a.download = photo.name;
    a.click();
  }, []);

  return { photos, addPhotos, removePhoto, downloadPhoto };
}

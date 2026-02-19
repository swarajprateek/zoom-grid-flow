import { useState, useCallback } from "react";

export interface Photo {
  id: string;
  name: string;
  url: string;
  file: File;
  addedAt: number;
}

export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  const addPhotos = useCallback((files: FileList | File[]) => {
    const newPhotos: Photo[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
        file,
        addedAt: Date.now(),
      }));
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

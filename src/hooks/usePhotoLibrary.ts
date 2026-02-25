import { useCallback, useEffect, useState } from "react";

export interface Photo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  addedAt: number;
  downloadUrl: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  `${window.location.protocol}//${window.location.hostname}:4001`;

const toAbsoluteUrl = (pathOrUrl: string) =>
  pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE_URL}${pathOrUrl}`;

const normalizePhoto = (photo: Photo): Photo => ({
  ...photo,
  url: toAbsoluteUrl(photo.url),
  thumbnailUrl: toAbsoluteUrl(photo.thumbnailUrl),
  downloadUrl: toAbsoluteUrl(photo.downloadUrl),
});

export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);

  const markHealthy = useCallback(() => {
    setIsDatabaseDown(false);
  }, []);

  const markDatabaseDown = useCallback(() => {
    setIsDatabaseDown(true);
  }, []);

  const refreshPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/photos`);
      if (!res.ok) throw new Error("Failed to load photos");
      const data = (await res.json()) as { photos: Photo[] };
      setPhotos(data.photos.map(normalizePhoto));
      markHealthy();
    } catch (error) {
      markDatabaseDown();
      throw error;
    }
  }, [markDatabaseDown, markHealthy]);

  useEffect(() => {
    refreshPhotos().catch((error) => {
      console.error(error);
    });
  }, [refreshPhotos]);

  const addPhotos = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const body = new FormData();
    imageFiles.forEach((file) => body.append("photos", file));

    try {
      const res = await fetch(`${API_BASE_URL}/api/photos`, {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error("Failed to upload photos");
      markHealthy();
      await refreshPhotos();
    } catch (error) {
      markDatabaseDown();
      throw error;
    }
  }, [markDatabaseDown, markHealthy, refreshPhotos]);

  const removePhoto = useCallback((id: string) => {
    fetch(`${API_BASE_URL}/api/photos/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete photo");
        markHealthy();
        setPhotos((prev) => prev.filter((photo) => photo.id !== id));
      })
      .catch((error) => {
        markDatabaseDown();
        console.error(error);
      });
  }, [markDatabaseDown, markHealthy]);

  const downloadPhoto = useCallback((photo: Photo) => {
    const a = document.createElement("a");
    a.href = photo.downloadUrl;
    a.download = photo.name;
    a.click();
  }, []);

  return {
    photos,
    isDatabaseDown,
    refreshPhotos,
    addPhotos: async (files: FileList | File[]) => {
      try {
        await addPhotos(files);
      } catch (error) {
        console.error(error);
      }
    },
    removePhoto: (id: string) => {
      removePhoto(id);
    },
    downloadPhoto,
  };
}

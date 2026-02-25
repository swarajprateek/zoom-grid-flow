import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrlSync, loadApiBaseUrl } from "@/lib/runtimeConfig";

export interface Photo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  addedAt: number;
  downloadUrl: string;
}

const toAbsoluteUrl = (apiBaseUrl: string, pathOrUrl: string) =>
  pathOrUrl.startsWith("http") ? pathOrUrl : `${apiBaseUrl}${pathOrUrl}`;

const normalizePhoto = (apiBaseUrl: string, photo: Photo): Photo => ({
  ...photo,
  url: toAbsoluteUrl(apiBaseUrl, photo.url),
  thumbnailUrl: toAbsoluteUrl(apiBaseUrl, photo.thumbnailUrl),
  downloadUrl: toAbsoluteUrl(apiBaseUrl, photo.downloadUrl),
});

export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(getApiBaseUrlSync());

  useEffect(() => {
    loadApiBaseUrl().then(setApiBaseUrl).catch(() => {
      // keep fallback if runtime config fails to load
    });
  }, []);

  const markHealthy = useCallback(() => {
    setIsDatabaseDown(false);
  }, []);

  const markDatabaseDown = useCallback(() => {
    setIsDatabaseDown(true);
  }, []);

  const refreshPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/photos`);
      if (!res.ok) throw new Error("Failed to load photos");
      const data = (await res.json()) as { photos: Photo[] };
      setPhotos(data.photos.map((photo) => normalizePhoto(apiBaseUrl, photo)));
      markHealthy();
    } catch (error) {
      markDatabaseDown();
      throw error;
    }
  }, [apiBaseUrl, markDatabaseDown, markHealthy]);

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
      const res = await fetch(`${apiBaseUrl}/api/photos`, {
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
  }, [apiBaseUrl, markDatabaseDown, markHealthy, refreshPhotos]);

  const removePhoto = useCallback((id: string) => {
    fetch(`${apiBaseUrl}/api/photos/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete photo");
        markHealthy();
        setPhotos((prev) => prev.filter((photo) => photo.id !== id));
      })
      .catch((error) => {
        markDatabaseDown();
        console.error(error);
      });
  }, [apiBaseUrl, markDatabaseDown, markHealthy]);

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

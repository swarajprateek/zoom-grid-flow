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

export interface AuthUser {
  id: string;
  username: string;
  storageFolder?: string;
}

export class AuthActionError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuthActionError";
    this.code = code;
  }
}

const toAbsoluteUrl = (apiBaseUrl: string, pathOrUrl: string) =>
  pathOrUrl.startsWith("http") ? pathOrUrl : `${apiBaseUrl}${pathOrUrl}`;

const AUTH_TOKEN_KEY = "photoLibraryAuthToken";

const withTokenInUrl = (url: string, authToken: string | null) => {
  if (!authToken) {
    return url;
  }
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("auth", authToken);
  return nextUrl.toString();
};

const normalizePhoto = (apiBaseUrl: string, authToken: string | null, photo: Photo): Photo => {
  const url = toAbsoluteUrl(apiBaseUrl, photo.url);
  const thumbnailUrl = toAbsoluteUrl(apiBaseUrl, photo.thumbnailUrl);
  const downloadUrl = toAbsoluteUrl(apiBaseUrl, photo.downloadUrl);

  return {
    ...photo,
    url: withTokenInUrl(url, authToken),
    thumbnailUrl: withTokenInUrl(thumbnailUrl, authToken),
    downloadUrl: withTokenInUrl(downloadUrl, authToken),
  };
};

export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(getApiBaseUrlSync());
  const [authToken, setAuthToken] = useState<string | null>(
    () => localStorage.getItem(AUTH_TOKEN_KEY) || null
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

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

  const clearAuth = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setAuthError(null);
    setAuthErrorCode(null);
    setAuthNotice(null);
    setPhotos([]);
  }, []);

  const authorizedFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers || {});
      if (authToken) {
        headers.set("Authorization", `Bearer ${authToken}`);
      }
      return fetch(url, { ...init, headers });
    },
    [authToken]
  );

  const refreshAuthUser = useCallback(async () => {
    if (!authToken) {
      setAuthUser(null);
      return;
    }
    const res = await authorizedFetch(`${apiBaseUrl}/api/auth/me`);
    if (res.status === 401) {
      clearAuth();
      throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
      throw new Error("Failed to validate session");
    }
    const data = (await res.json()) as { user: AuthUser };
    setAuthUser(data.user);
  }, [apiBaseUrl, authToken, authorizedFetch, clearAuth]);

  const refreshPhotos = useCallback(async () => {
    if (!authToken) {
      setPhotos([]);
      return;
    }
    try {
      const res = await authorizedFetch(`${apiBaseUrl}/api/photos`);
      if (res.status === 401) {
        clearAuth();
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) throw new Error("Failed to load photos");
      const data = (await res.json()) as { photos: Photo[] };
      setPhotos(data.photos.map((photo) => normalizePhoto(apiBaseUrl, authToken, photo)));
      markHealthy();
    } catch (error) {
      markDatabaseDown();
      throw error;
    }
  }, [apiBaseUrl, authToken, authorizedFetch, clearAuth, markDatabaseDown, markHealthy]);

  useEffect(() => {
    refreshAuthUser().catch((error) => {
      console.error(error);
    });
  }, [refreshAuthUser]);

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
      const res = await authorizedFetch(`${apiBaseUrl}/api/photos`, {
        method: "POST",
        body,
      });
      if (res.status === 401) {
        clearAuth();
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) throw new Error("Failed to upload photos");
      markHealthy();
      await refreshPhotos();
    } catch (error) {
      markDatabaseDown();
      throw error;
    }
  }, [apiBaseUrl, authorizedFetch, clearAuth, markDatabaseDown, markHealthy, refreshPhotos]);

  const removePhoto = useCallback((id: string) => {
    authorizedFetch(`${apiBaseUrl}/api/photos/${id}`, { method: "DELETE" })
      .then((res) => {
        if (res.status === 401) {
          clearAuth();
          throw new Error("Session expired. Please log in again.");
        }
        if (!res.ok) throw new Error("Failed to delete photo");
        markHealthy();
        setPhotos((prev) => prev.filter((photo) => photo.id !== id));
      })
      .catch((error) => {
        markDatabaseDown();
        console.error(error);
      });
  }, [apiBaseUrl, authorizedFetch, clearAuth, markDatabaseDown, markHealthy]);

  const login = useCallback(
    async (loginId: string, password: string) => {
      setAuthError(null);
      setAuthErrorCode(null);
      setAuthNotice(null);
      const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const errorMessage = payload.error || "Invalid credentials";
        setAuthError(errorMessage);
        setAuthErrorCode(payload.code || null);
        throw new AuthActionError(errorMessage, payload.code);
      }
      const payload = (await res.json()) as { token: string; user: AuthUser };
      localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
      setAuthToken(payload.token);
      setAuthUser(payload.user);
      markHealthy();
      setAuthNotice(
        `Welcome back, ${payload.user.username}. Opened folder: ${payload.user.storageFolder ?? `users/${payload.user.id}`}.`
      );
    },
    [apiBaseUrl, markHealthy]
  );

  const register = useCallback(
    async (loginId: string, password: string) => {
      setAuthError(null);
      setAuthErrorCode(null);
      setAuthNotice(null);
      const res = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const errorMessage = payload.error || "Failed to create account";
        setAuthError(errorMessage);
        setAuthErrorCode(payload.code || null);
        throw new AuthActionError(errorMessage, payload.code);
      }
      const payload = (await res.json()) as { message?: string; user: AuthUser };
      setAuthNotice(
        `${payload.message || "Account created successfully."} Dedicated folder: ${payload.user.storageFolder ?? `users/${payload.user.id}`}.`
      );
    },
    [apiBaseUrl]
  );

  const downloadPhoto = useCallback((photo: Photo) => {
    const a = document.createElement("a");
    a.href = photo.downloadUrl;
    a.download = photo.name;
    a.click();
  }, []);

  return {
    photos,
    authUser,
    isAuthenticated: Boolean(authToken),
    authError,
    authErrorCode,
    authNotice,
    isDatabaseDown,
    refreshPhotos,
    login,
    register,
    logout: () => {
      clearAuth();
    },
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

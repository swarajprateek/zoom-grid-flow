interface RuntimeConfig {
  apiBaseUrl?: string;
}

const fallbackApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  `${window.location.protocol}//${window.location.hostname}:4001`;

let cachedApiBaseUrl: string | null = null;

const normalizeBaseUrl = (value: string | undefined) =>
  value ? value.replace(/\/+$/, "") : "";

export const getApiBaseUrlSync = () => cachedApiBaseUrl ?? fallbackApiBaseUrl;

export const loadApiBaseUrl = async () => {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}runtime-config.json`, {
      cache: "no-store",
    });
    if (!response.ok) {
      cachedApiBaseUrl = fallbackApiBaseUrl;
      return cachedApiBaseUrl;
    }

    const config = (await response.json()) as RuntimeConfig;
    cachedApiBaseUrl = normalizeBaseUrl(config.apiBaseUrl) || fallbackApiBaseUrl;
    return cachedApiBaseUrl;
  } catch {
    cachedApiBaseUrl = fallbackApiBaseUrl;
    return cachedApiBaseUrl;
  }
};

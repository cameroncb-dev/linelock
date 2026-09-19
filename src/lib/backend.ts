export function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_ORIGIN ?? "").replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiOrigin()}${normalized}`;
}

export function liveSocketUrl(): string {
  const origin = apiOrigin();
  if (origin && typeof window !== "undefined") {
    const url = new URL(origin);
    const proto = url.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${url.host}/ws`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

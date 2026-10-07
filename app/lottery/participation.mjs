export function participationUrl(config) {
  if (config?.verified !== true || typeof config.participationUrl !== "string") return null;
  try {
    const url = new URL(config.participationUrl);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com" || url.port ||
        url.username || url.password || url.search || url.hash || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null;
    return url.href;
  } catch (_) { return null; }
}

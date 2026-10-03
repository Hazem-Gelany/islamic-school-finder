/** Only same-site relative paths may be used as a post-login destination (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/en'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n\t]/.test(next)) return fallback;
  try { return new URL(next, 'http://x.invalid').host === 'x.invalid' ? next : fallback; } catch { return fallback; }
}

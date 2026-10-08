import 'server-only';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/admin';

export type Rule = [key: string, limit: number, windowSeconds: number];
const memory = new Map<string, { hits: number; resetAt: number }>();

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim().slice(0, 64);
}

function hitMemory(key: string, limit: number, windowSeconds: number) {
  const now = Date.now(), e = memory.get(key);
  if (!e || e.resetAt < now) {
    if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
    memory.set(key, { hits: 1, resetAt: now + windowSeconds * 1000 }); return true;
  }
  return ++e.hits <= limit;
}

/** True when the request is allowed. Uses the shared database counter when the service key is configured (works across servers),
 *  otherwise a per-instance counter. If the counter itself fails we let the request through and log it: availability beats strictness here. */
export async function allow(key: string, limit: number, windowSeconds: number, opts: { memoryOnly?: boolean } = {}): Promise<boolean> {
  const svc = opts.memoryOnly ? null : createServiceClient();
  if (svc) {
    try {
      const { data, error } = await svc.rpc('rate_limit_hit', { p_key: key.slice(0, 200), p_limit: limit, p_window_seconds: windowSeconds });
      if (!error) return data === true;
      console.error(JSON.stringify({ level: 'error', msg: 'rate limiter unavailable', code: error.code }));
      return true;
    } catch (e) { console.error(JSON.stringify({ level: 'error', msg: 'rate limiter failed', err: String(e) })); return true; }
  }
  return hitMemory(key, limit, windowSeconds);
}

/** True when ANY rule is exceeded. All rules are counted so repeated attempts keep counting. */
export async function isLimited(rules: Rule[], opts: { memoryOnly?: boolean } = {}) {
  const results = await Promise.all(rules.map(([k, l, w]) => allow(k, l, w, opts)));
  return results.some((ok) => !ok);
}

import { NextResponse } from 'next/server';
import { allow, clientIp } from '@/lib/rateLimit';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
export const options = () => new NextResponse(null, { status: 204, headers: CORS });

export const ok = (data: unknown, meta?: Record<string, unknown>, cache = 'public, s-maxage=60, stale-while-revalidate=300') =>
  NextResponse.json(meta ? { data, meta } : { data }, { headers: { ...CORS, 'Cache-Control': cache } });
export const fail = (status: number, code: string, message: string, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra } });

/** Public API limit: 120 requests per minute per address (per server instance; put a CDN or WAF rule in front for strict limits). */
export async function guard(): Promise<NextResponse | null> {
  const ip = await clientIp();
  return (await allow(`api:${ip}`, 120, 60, { memoryOnly: true })) ? null : fail(429, 'rate_limited', 'Too many requests. Please slow down.', { 'Retry-After': '60' });
}
export const localeOf = (v: string | null) => (v === 'ar' || v === 'ms' ? v : 'en');

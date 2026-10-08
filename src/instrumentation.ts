/** Every unhandled server error is written as one JSON line, which log services (Vercel, Datadog, Sentry's log drain) can index.
 *  To send them to Sentry instead, install @sentry/nextjs and call Sentry.captureRequestError here (see docs/DEPLOYMENT.md). */
export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routerKind: string; routePath: string; routeType: string }) {
  const e = error as { message?: string; digest?: string };
  console.error(JSON.stringify({ level: 'error', msg: e?.message ?? 'unknown error', digest: e?.digest, method: request.method, path: request.path.split('?')[0], route: context.routePath, type: context.routeType, ts: new Date().toISOString() }));
}

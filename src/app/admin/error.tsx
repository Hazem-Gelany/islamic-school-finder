'use client';
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl p-10 text-center">
      <h1 className="text-2xl font-semibold text-forest-900">Something went wrong</h1>
      <p className="mt-2 text-muted">Your data has not been changed. Please try again; if it keeps happening, contact the developer{error.digest ? ` and quote reference ${error.digest}` : ''}.</p>
      <button onClick={reset} className="mt-6 h-12 rounded-xl bg-forest-900 px-6 font-semibold text-cream-50">Try again</button>
    </main>
  );
}

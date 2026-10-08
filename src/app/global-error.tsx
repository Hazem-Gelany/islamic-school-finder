'use client';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en"><body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '6rem 1.5rem' }}>
      <h1>Something went wrong</h1><p>Please try again in a moment.</p>
      <button onClick={reset} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>Try again</button>
    </body></html>
  );
}

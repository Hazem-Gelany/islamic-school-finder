export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse space-y-4 motion-reduce:animate-none">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-1/3 rounded bg-[#E9EEEA]" /><div className="h-5 w-2/3 rounded bg-[#E9EEEA]" /><div className="h-72 rounded-2xl bg-[#E9EEEA]" />
    </div>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse space-y-4 rounded-2xl border border-line bg-white p-5 motion-reduce:animate-none">
          <div className="flex gap-4"><div className="size-14 rounded-xl bg-[#E9EEEA]" /><div className="flex-1 space-y-2"><div className="h-5 w-3/4 rounded bg-[#E9EEEA]" /><div className="h-4 w-1/2 rounded bg-[#E9EEEA]" /></div></div>
          <div className="h-7 w-32 rounded-full bg-[#E9EEEA]" /><div className="h-4 rounded bg-[#E9EEEA]" /><div className="h-4 w-5/6 rounded bg-[#E9EEEA]" />
        </div>))}
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mx-auto max-w-7xl animate-pulse px-6 py-10 motion-reduce:animate-none lg:px-16">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 h-10 w-1/2 rounded bg-[#E9EEEA]" /><div className="mb-4 h-5 w-3/4 rounded bg-[#E9EEEA]" /><div className="h-64 rounded-2xl bg-[#E9EEEA]" />
    </div>
  );
}

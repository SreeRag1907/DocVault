export function DocumentCardSkeleton() {
  return (
    <div className="rounded-xl border border-vault-700/50 bg-vault-900/60 p-4">
      <div className="h-32 w-full animate-pulse rounded-lg bg-vault-800" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-vault-800" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-vault-800" />
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-12 animate-pulse rounded-full bg-vault-800" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-vault-800" />
      </div>
    </div>
  );
}

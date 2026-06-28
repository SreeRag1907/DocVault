interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-vault-700 px-3 py-1.5 text-zinc-300 disabled:opacity-30"
      >
        ← Prev
      </button>
      <span className="font-mono text-xs text-zinc-500">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-vault-700 px-3 py-1.5 text-zinc-300 disabled:opacity-30"
      >
        Next →
      </button>
    </div>
  );
}

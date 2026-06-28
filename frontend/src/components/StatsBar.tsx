import { DocumentStats } from "../lib/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StatsBar({ stats }: { stats: DocumentStats | null }) {
  if (!stats) {
    return (
      <div className="mb-5 flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-40 animate-pulse rounded-xl bg-vault-800" />
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Documents",
      value: stats.totalDocuments,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      color: "text-zinc-300",
    },
    {
      label: "Favorites",
      value: stats.totalFavorites,
      icon: <span className="text-sm">★</span>,
      color: "text-brass",
    },
    {
      label: "Storage",
      value: formatBytes(stats.totalSizeBytes),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
        </svg>
      ),
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="mb-5 flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass-card flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ transform: "none" }}
        >
          <div className={`${item.color} opacity-60`}>{item.icon}</div>
          <div>
            <p className="font-display text-base font-bold text-zinc-100">{item.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

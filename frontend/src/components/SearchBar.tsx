interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
}

export function SearchBar({ search, onSearchChange, favoriteOnly, onFavoriteOnlyChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[280px] flex-1">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search filenames, text, summaries..."
          className="w-full rounded-xl border border-vault-700 bg-vault-900/80 py-2.5 pl-10 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-brass/50 focus:ring-1 focus:ring-brass/20 transition-all"
        />
      </div>
      <button
        onClick={() => onFavoriteOnlyChange(!favoriteOnly)}
        className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
          favoriteOnly
            ? "border-brass/50 bg-brass/10 text-brass shadow-sm shadow-brass/10"
            : "border-vault-700 text-zinc-400 hover:border-vault-600 hover:text-zinc-200"
        }`}
      >
        ★ Favorites
      </button>
    </div>
  );
}

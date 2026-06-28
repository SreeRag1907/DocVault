import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api, Document, DocumentStats, SortOption } from "../lib/api";
import { UploadCard } from "../components/UploadCard";
import { SearchBar } from "../components/SearchBar";
import { Toolbar, ViewMode } from "../components/Toolbar";
import { DocumentCard } from "../components/DocumentCard";
import { DocumentRow } from "../components/DocumentRow";
import { DocumentCardSkeleton } from "../components/DocumentCardSkeleton";
import { StatsBar } from "../components/StatsBar";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 24;

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<DocumentStats | null>(null);

  const [search, setSearch] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("date");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listDocuments({
        search: search || undefined,
        favorite: favoriteOnly || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      });
      setDocuments(result.documents);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [search, favoriteOnly, sort, page]);

  const loadStats = useCallback(async () => {
    const result = await api.getStats();
    setStats(result);
  }, []);

  // Reset to page 1 whenever a filter changes - staying on page 4 of a
  // now-3-page result set would just show an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, favoriteOnly, sort]);

  useEffect(() => {
    const timeout = setTimeout(loadDocuments, 250);
    return () => clearTimeout(timeout);
  }, [loadDocuments]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  function handleUploaded(doc: Document) {
    setDocuments((prev) => [doc, ...prev]);
    setTotal((t) => t + 1);
    loadStats();
  }

  function handleChanged(doc: Document) {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
    loadStats();
  }

  function handleDeleted(id: number) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    loadStats();
  }

  return (
    <div className="min-h-screen bg-vault-950 text-zinc-200">
      {/* ─── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-vault-700/50 bg-vault-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brass to-brass-light shadow-lg shadow-brass/20">
              <svg className="h-5 w-5 text-vault-950" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-zinc-100">DocVault</p>
              <p className="text-[11px] text-zinc-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-vault-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-danger/50 hover:text-danger hover:bg-danger/5"
          >
            Log out
          </button>
        </div>
      </header>

      {/* ─── Main ────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        <StatsBar stats={stats} />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <SearchBar
            search={search}
            onSearchChange={setSearch}
            favoriteOnly={favoriteOnly}
            onFavoriteOnlyChange={setFavoriteOnly}
          />
          <Toolbar sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
        </div>

        {loading && documents.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 card-stagger">
            {/* Upload card placeholder */}
            <div className="rounded-xl border-2 border-dashed border-vault-700 p-6 opacity-40 animate-pulse" />
            {Array.from({ length: 6 }).map((_, i) => (
              <DocumentCardSkeleton key={i} />
            ))}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 card-stagger">
            {/* Upload card as the first item in the grid */}
            <UploadCard onUploaded={handleUploaded} />

            {documents.length === 0 && !search && !favoriteOnly ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-vault-700 py-16 text-center sm:col-span-2 lg:col-span-3">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-vault-700/40 animate-float">
                  <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500">
                  No documents yet — upload a PDF or image to get started.
                </p>
              </div>
            ) : documents.length === 0 ? (
              <div className="col-span-full flex items-center justify-center rounded-xl border border-dashed border-vault-700 py-16 sm:col-span-2 lg:col-span-3">
                <p className="text-sm text-zinc-500">No documents match your filters.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} onChanged={handleChanged} onDeleted={handleDeleted} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2 card-stagger">
            {/* Upload card as a row in list view */}
            <UploadCard onUploaded={handleUploaded} />
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-vault-700 py-12 text-center">
                <p className="text-sm text-zinc-500">
                  {search || favoriteOnly ? "No documents match your filters." : "No documents yet."}
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <DocumentRow key={doc.id} document={doc} onChanged={handleChanged} onDeleted={handleDeleted} />
              ))
            )}
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </main>
    </div>
  );
}

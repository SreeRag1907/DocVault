import { useNavigate } from "react-router-dom";
import { Document } from "../lib/api";
import { Thumbnail } from "./Thumbnail";
import { TagEditor } from "./TagEditor";
import { ShareModal } from "./ShareModal";
import { useDocumentActions } from "../hooks/useDocumentActions";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  document: Document;
  onChanged: (doc: Document) => void;
  onDeleted: (id: number) => void;
}

export function DocumentCard({ document, onChanged, onDeleted }: Props) {
  const navigate = useNavigate();
  const {
    busy, shareUrl,
    toggleFavorite, updateTags, summarize, share, remove,
    closeShare,
  } = useDocumentActions(document, onChanged, onDeleted);

  function handleCardClick(e: React.MouseEvent) {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;
    navigate(`/documents/${document.id}`);
  }

  return (
    <div
      className="glass-card group cursor-pointer rounded-xl p-4 transition-all duration-300"
      onClick={handleCardClick}
    >
      <Thumbnail document={document} />

      <div className="mt-3 mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-zinc-100 group-hover:text-brass transition-colors">
            {document.original_filename}
          </p>
          <p className="font-mono text-[11px] text-zinc-500">
            {document.file_type.toUpperCase()} · {formatSize(document.size_bytes)} ·{" "}
            {formatDate(document.created_at)}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
          disabled={busy === "favorite"}
          aria-label={document.is_favorite ? "Remove from favorites" : "Add to favorites"}
          className={`text-lg transition ${document.is_favorite ? "text-brass" : "text-zinc-600 hover:text-brass"}`}
        >
          {document.is_favorite ? "★" : "☆"}
        </button>
      </div>

      <div className="mb-3" onClick={(e) => e.stopPropagation()}>
        <TagEditor tags={document.tags} onChange={updateTags} />
      </div>

      {document.ai_summary ? (
        <p className="mb-3 line-clamp-2 text-xs text-zinc-400 leading-relaxed">
          {document.ai_summary.replace(/[#*_`>]/g, "").slice(0, 120)}...
        </p>
      ) : (document.file_type === "pdf" || document.file_type === "image") ? (
        <button
          onClick={(e) => { e.stopPropagation(); summarize(); }}
          disabled={busy === "summarize"}
          className="mb-3 flex items-center gap-1 text-xs text-brass hover:underline disabled:opacity-50"
        >
          {busy === "summarize" ? (
            <>
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Summarizing...
            </>
          ) : (
            "✦ Generate AI summary"
          )}
        </button>
      ) : null}

      <div className="flex gap-3 border-t border-vault-700/50 pt-3 text-xs">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/documents/${document.id}`); }}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          View
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); share(); }}
          disabled={busy === "share"}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          {document.share_token ? "Revoke" : "Share"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); remove(); }}
          disabled={busy === "delete"}
          className="flex items-center gap-1 text-danger hover:text-red-400 transition-colors ml-auto"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete
        </button>
      </div>

      {shareUrl && <ShareModal shareUrl={shareUrl} onClose={closeShare} />}
    </div>
  );
}

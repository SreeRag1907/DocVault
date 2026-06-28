import { useNavigate } from "react-router-dom";
import { Document } from "../lib/api";
import { FileIcon } from "./FileIcon";
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

export function DocumentRow({ document, onChanged, onDeleted }: Props) {
  const navigate = useNavigate();
  const {
    busy, shareUrl,
    toggleFavorite, updateTags, summarize, share, remove,
    closeShare,
  } = useDocumentActions(document, onChanged, onDeleted);

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;
    navigate(`/documents/${document.id}`);
  }

  return (
    <div
      className="glass-card group flex cursor-pointer flex-wrap items-center gap-4 rounded-xl px-4 py-3"
      onClick={handleRowClick}
    >
      <span className="text-zinc-500 group-hover:text-brass transition-colors">
        <FileIcon fileType={document.file_type} className="h-5 w-5" />
      </span>

      <div className="min-w-[160px] flex-1">
        <p className="truncate font-display text-sm font-medium text-zinc-100 group-hover:text-brass transition-colors">
          {document.original_filename}
        </p>
        <p className="font-mono text-xs text-zinc-500">
          {formatSize(document.size_bytes)} · {formatDate(document.created_at)}
        </p>
      </div>

      <div className="min-w-[120px]" onClick={(e) => e.stopPropagation()}>
        <TagEditor tags={document.tags} onChange={updateTags} />
      </div>

      {(document.file_type === "pdf" || document.file_type === "image") && !document.ai_summary && (
        <button
          onClick={(e) => { e.stopPropagation(); summarize(); }}
          disabled={busy === "summarize"}
          className="whitespace-nowrap text-xs text-brass hover:underline disabled:opacity-50"
        >
          {busy === "summarize" ? "Summarizing..." : "✦ Summarize"}
        </button>
      )}

      {document.ai_summary && (
        <span className="text-xs text-emerald-400 font-mono">✓ Summary</span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
        disabled={busy === "favorite"}
        aria-label="Toggle favorite"
        className={`text-lg ${document.is_favorite ? "text-brass" : "text-zinc-600 hover:text-brass"}`}
      >
        {document.is_favorite ? "★" : "☆"}
      </button>

      <div className="flex gap-3 text-xs">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/documents/${document.id}`); }}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          View
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); share(); }}
          disabled={busy === "share"}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          {document.share_token ? "Revoke" : "Share"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); remove(); }}
          disabled={busy === "delete"}
          className="text-danger hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </div>

      {shareUrl && <ShareModal shareUrl={shareUrl} onClose={closeShare} />}
    </div>
  );
}

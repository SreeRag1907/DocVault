import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, Document, ApiError } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { TagEditor } from "../components/TagEditor";
import { ShareModal } from "../components/ShareModal";
import { FileIcon } from "../components/FileIcon";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const confirm = useConfirm();

  const [doc, setDoc] = useState<Document | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"summary" | "chat">("summary");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [chatMessages, activeTab]);

  async function handleSendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!doc || !chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");

    const newMessages = [...chatMessages, { role: "user" as const, content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await api.chat(doc.id, userMsg, chatMessages);
      setChatMessages([...newMessages, { role: "assistant" as const, content: res.answer }]);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Failed to get answer", "error");
      setChatMessages([
        ...newMessages,
        {
          role: "assistant" as const,
          content: "❌ Sorry, I encountered an error communicating with the chat service. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  const loadDocument = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [docRes, urlRes] = await Promise.all([
        api.getDocument(Number(id)),
        api.getDownloadUrl(Number(id)),
      ]);
      setDoc(docRes.document);
      setDownloadUrl(urlRes.downloadUrl);
    } catch (err) {
      show("Document not found", "error");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, show]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  async function handleSummarize() {
    if (!doc) return;
    setSummarizing(true);
    try {
      const updated = await api.summarize(doc.id);
      setDoc(updated.document);
      show("Summary generated successfully", "success");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Summarization failed.", "error");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleRegenerateSummary() {
    if (!doc) return;
    const ok = await confirm({
      title: "Regenerate AI Summary?",
      description:
        "This will re-analyze the document and create a fresh summary, replacing the current one. " +
        "The AI will extract text and produce a new structured analysis.",
      confirmLabel: "Regenerate",
    });
    if (!ok) return;
    setSummarizing(true);
    try {
      const updated = await api.summarize(doc.id);
      setDoc(updated.document);
      show("Summary regenerated successfully", "success");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Summarization failed.", "error");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleToggleFavorite() {
    if (!doc) return;
    setBusy("favorite");
    try {
      const updated = await api.updateDocument(doc.id, { isFavorite: !doc.is_favorite });
      setDoc(updated.document);
    } catch {
      show("Couldn't update favorite status", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdateTags(tags: string[]) {
    if (!doc) return;
    try {
      const updated = await api.updateDocument(doc.id, { tags });
      setDoc(updated.document);
    } catch {
      show("Couldn't update tags", "error");
    }
  }

  async function handleShare() {
    if (!doc) return;
    setBusy("share");
    try {
      if (doc.share_token) {
        await api.revokeShareLink(doc.id);
        setDoc({ ...doc, share_token: null });
        show("Share link revoked", "info");
      } else {
        const updated = await api.createShareLink(doc.id);
        setDoc(updated.document);
        setShareUrl(`${window.location.origin}/s/${updated.document.share_token}`);
      }
    } catch {
      show("Couldn't update share link", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    const ok = await confirm({
      title: `Delete "${doc.original_filename}"?`,
      description: "This permanently removes the file and cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteDocument(doc.id);
      show("Document deleted", "info");
      navigate("/");
    } catch {
      show("Couldn't delete document", "error");
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-vault-950 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-vault-800" />
          <div className="flex gap-6">
            <div className="flex-1 space-y-4">
              <div className="h-10 w-3/4 animate-pulse rounded-lg bg-vault-800" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-vault-800" />
              <div className="mt-8 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-vault-800" style={{ width: `${85 - i * 5}%` }} />
                ))}
              </div>
            </div>
            <div className="h-[75vh] w-1/2 animate-pulse rounded-xl bg-vault-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="min-h-screen bg-vault-950 text-zinc-200">
      {/* ─── Top Bar ───────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-vault-700/50 bg-vault-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-vault-800 hover:text-zinc-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </button>
            <span className="text-zinc-700">/</span>
            <span className="font-display text-sm font-medium text-zinc-300 truncate max-w-[300px]">
              {doc.original_filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              disabled={busy === "favorite"}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                doc.is_favorite
                  ? "bg-brass/10 text-brass"
                  : "text-zinc-400 hover:bg-vault-800 hover:text-brass"
              }`}
            >
              {doc.is_favorite ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button
              onClick={handleShare}
              disabled={busy === "share"}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-vault-800 hover:text-zinc-200"
            >
              {doc.share_token ? "🔗 Revoke link" : "🔗 Share"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-danger/10 hover:text-danger"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* ─── Left: Document Info & Summary ──── */}
          <div className="flex-1 animate-slide-up">

            {/* Document Metadata Card */}
            <div className="glass-card rounded-xl p-6 mb-6" style={{ transform: "none" }}>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-vault-700/60">
                  <FileIcon fileType={doc.file_type} className="h-7 w-7 text-brass" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-xl font-bold text-zinc-100 mb-1">
                    {doc.original_filename}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-zinc-500">
                    <span>{doc.file_type.toUpperCase()}</span>
                    <span>{formatSize(doc.size_bytes)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-4 border-t border-vault-700/50 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Tags</p>
                <TagEditor tags={doc.tags} onChange={handleUpdateTags} />
              </div>
            </div>

            {/* ─── AI Analysis Section ──────────── */}
            <div className="glass-card rounded-xl p-6" style={{ transform: "none" }}>
              {summarizing ? (
                <SummaryLoadingAnimation />
              ) : !doc.ai_summary ? (
                (doc.file_type === "pdf" || doc.file_type === "image") ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-vault-700/40 animate-float">
                      <span className="text-3xl">✦</span>
                    </div>
                    <p className="mb-2 font-display text-sm font-medium text-zinc-300">
                      No summary yet
                    </p>
                    <p className="mb-5 max-w-xs text-xs text-zinc-500">
                      Generate an AI-powered analysis of this document. This enables structured summaries 
                      and activates the interactive chat.
                    </p>
                    <button
                      onClick={handleSummarize}
                      className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brass to-brass-light px-5 py-2.5 text-sm font-semibold text-vault-950 shadow-lg shadow-brass/20 transition hover:shadow-brass/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span className="text-base transition-transform group-hover:rotate-90">✦</span>
                      Generate AI Summary
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-zinc-500">
                      AI analysis and chat are available for PDF and image documents only.
                    </p>
                  </div>
                )
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-vault-700/40 pb-3 mb-5">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => setActiveTab("summary")}
                        className={`font-display text-sm font-semibold transition-colors pb-3 -mb-[13px] border-b-2 ${
                          activeTab === "summary"
                            ? "text-brass border-brass"
                            : "text-zinc-400 border-transparent hover:text-zinc-200"
                        }`}
                      >
                        ✦ Summary
                      </button>
                      <button
                        onClick={() => setActiveTab("chat")}
                        className={`font-display text-sm font-semibold transition-colors pb-3 -mb-[13px] border-b-2 flex items-center gap-1.5 ${
                          activeTab === "chat"
                            ? "text-brass border-brass"
                            : "text-zinc-400 border-transparent hover:text-zinc-200"
                        }`}
                      >
                        💬 Ask AI
                        <span className="rounded bg-brass/10 px-1 py-0.5 text-[10px] text-brass font-medium">New</span>
                      </button>
                    </div>

                    {activeTab === "summary" && (
                      <button
                        onClick={handleRegenerateSummary}
                        disabled={summarizing}
                        className="flex items-center gap-1.5 rounded-lg border border-vault-600 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-brass hover:text-brass disabled:opacity-50"
                      >
                        <svg className={`h-3.5 w-3.5 ${summarizing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                        </svg>
                        {summarizing ? "Regenerating..." : "Regenerate"}
                      </button>
                    )}
                  </div>

                  {activeTab === "summary" ? (
                    <div className="animate-fade-in">
                      <MarkdownRenderer content={doc.ai_summary} />
                    </div>
                  ) : (
                    <div className="flex flex-col h-[420px] bg-vault-950/40 rounded-xl border border-vault-700/50 overflow-hidden animate-fade-in">
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center py-6">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brass/10 text-brass text-xl">
                              💬
                            </div>
                            <p className="font-display text-sm font-medium text-zinc-300">
                              Chat with this document
                            </p>
                            <p className="max-w-[280px] text-xs text-zinc-500 mt-1 leading-normal">
                              Ask questions about terms, figures, key findings, or details present in this file.
                            </p>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                                  msg.role === "user"
                                    ? "bg-gradient-to-r from-brass to-brass-light text-vault-950 font-medium rounded-tr-none"
                                    : "bg-vault-800/80 text-zinc-200 rounded-tl-none border border-vault-700/30"
                                }`}
                              >
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                              </div>
                            </div>
                          ))
                        )}
                        
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-vault-800/80 text-zinc-400 rounded-2xl rounded-tl-none border border-vault-700/30 px-4 py-3 text-xs flex items-center gap-1.5">
                              <span className="flex gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </span>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <form onSubmit={handleSendChatMessage} className="border-t border-vault-700/50 p-3 bg-vault-900/30 flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask a question about this document..."
                          disabled={chatLoading}
                          className="flex-1 rounded-xl bg-vault-950 border border-vault-700/80 px-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-brass focus:outline-none disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || chatLoading}
                          className="flex items-center justify-center rounded-xl bg-brass px-4 text-xs font-semibold text-vault-950 hover:bg-brass-light transition disabled:opacity-50"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ─── Right: PDF/Image Preview ──────── */}
          <div className="w-full lg:w-1/2 animate-slide-in-right">
            <div className="glass-card sticky top-20 overflow-hidden rounded-xl" style={{ transform: "none" }}>
              <div className="flex items-center justify-between border-b border-vault-700/50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Document Preview
                </p>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-brass hover:underline"
                  >
                    Open in new tab
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="bg-vault-950">
                {downloadUrl ? (
                  doc.file_type === "image" ? (
                    <img
                      src={downloadUrl}
                      alt={doc.original_filename}
                      className="max-h-[75vh] w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={downloadUrl}
                      title={doc.original_filename}
                      className="h-[75vh] w-full"
                    />
                  )
                ) : (
                  <div className="flex h-[75vh] items-center justify-center">
                    <p className="text-sm text-zinc-500">Loading preview...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareUrl && <ShareModal shareUrl={shareUrl} onClose={() => setShareUrl(null)} />}
    </div>
  );
}

/** Animated skeleton for the loading state while AI generates a summary */
function SummaryLoadingAnimation() {
  return (
    <div className="space-y-4 py-4">
      {/* Pulsing header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass/10">
          <svg className="h-4 w-4 text-brass animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="font-display text-sm font-medium text-brass animate-pulse">
          Analyzing document...
        </p>
      </div>

      {/* Shimmer lines */}
      <div className="space-y-3">
        <div className="ai-shimmer h-6 w-3/4 rounded-md" />
        <div className="ai-shimmer h-4 w-full rounded" style={{ animationDelay: "0.1s" }} />
        <div className="ai-shimmer h-4 w-5/6 rounded" style={{ animationDelay: "0.2s" }} />
        <div className="ai-shimmer h-4 w-4/5 rounded" style={{ animationDelay: "0.3s" }} />
        <div className="mt-4 ai-shimmer h-5 w-1/3 rounded-md" style={{ animationDelay: "0.4s" }} />
        <div className="ai-shimmer h-4 w-full rounded" style={{ animationDelay: "0.5s" }} />
        <div className="ai-shimmer h-4 w-3/4 rounded" style={{ animationDelay: "0.6s" }} />
        <div className="ai-shimmer h-4 w-2/3 rounded" style={{ animationDelay: "0.7s" }} />
        <div className="mt-4 ai-shimmer h-5 w-1/4 rounded-md" style={{ animationDelay: "0.8s" }} />
        <div className="ai-shimmer h-4 w-full rounded" style={{ animationDelay: "0.9s" }} />
        <div className="ai-shimmer h-4 w-5/6 rounded" style={{ animationDelay: "1.0s" }} />
      </div>

      <p className="mt-3 text-xs text-zinc-600 text-center">
        Extracting text and generating structured analysis...
      </p>
    </div>
  );
}

import { useState } from "react";
import { Document, api, ApiError } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

export function useDocumentActions(
  document: Document,
  onChanged: (doc: Document) => void,
  onDeleted: (id: number) => void
) {
  const { show } = useToast();
  const confirm = useConfirm();

  const [busy, setBusy] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function toggleFavorite() {
    setBusy("favorite");
    try {
      const updated = await api.updateDocument(document.id, { isFavorite: !document.is_favorite });
      onChanged(updated.document);
    } catch {
      show("Couldn't update favorite status", "error");
    } finally {
      setBusy(null);
    }
  }

  async function updateTags(tags: string[]) {
    try {
      const updated = await api.updateDocument(document.id, { tags });
      onChanged(updated.document);
    } catch {
      show("Couldn't update tags", "error");
    }
  }

  async function open() {
    setBusy("open");
    try {
      const { downloadUrl } = await api.getDownloadUrl(document.id);
      setPreview(downloadUrl);
    } catch {
      show("Couldn't open file", "error");
    } finally {
      setBusy(null);
    }
  }

  async function summarize() {
    setBusy("summarize");
    try {
      const updated = await api.summarize(document.id);
      onChanged(updated.document);
      show("Summary generated", "success");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Summarization failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      if (document.share_token) {
        await api.revokeShareLink(document.id);
        onChanged({ ...document, share_token: null });
        show("Share link revoked", "info");
      } else {
        const updated = await api.createShareLink(document.id);
        onChanged(updated.document);
        setShareUrl(`${window.location.origin}/s/${updated.document.share_token}`);
      }
    } catch {
      show("Couldn't update share link", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete "${document.original_filename}"?`,
      description: "This permanently removes the file and cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    setBusy("delete");
    try {
      await api.deleteDocument(document.id);
      onDeleted(document.id);
      show("Document deleted", "info");
    } catch {
      show("Couldn't delete document", "error");
      setBusy(null);
    }
  }

  return {
    busy,
    shareUrl,
    preview,
    toggleFavorite,
    updateTags,
    open,
    summarize,
    share,
    remove,
    closeShare: () => setShareUrl(null),
    closePreview: () => setPreview(null),
  };
}

import { useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "../context/ToastContext";

export function ShareModal({ shareUrl, onClose }: { shareUrl: string; onClose: () => void }) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      show("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show("Couldn't copy automatically - select and copy manually", "error");
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 font-display text-base font-semibold text-zinc-100">Share link</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Anyone with this link can view this one document. Revoke it any time from the document card.
      </p>

      <div className="flex gap-2">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.target.select()}
          className="flex-1 truncate rounded-md border border-vault-600 bg-vault-800 px-3 py-2 font-mono text-xs text-zinc-300"
        />
        <button
          onClick={handleCopy}
          className="rounded-md bg-brass px-3 py-2 text-sm font-medium text-vault-950 hover:opacity-90"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </Modal>
  );
}

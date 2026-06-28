import { Document } from "../lib/api";
import { Modal } from "./Modal";

interface Props {
  document: Document;
  downloadUrl: string;
  onClose: () => void;
}

export function PreviewModal({ document, downloadUrl, onClose }: Props) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="truncate font-display text-sm font-medium text-zinc-100">
          {document.original_filename}
        </p>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brass hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>

      <div className="overflow-hidden rounded-md bg-vault-950">
        {document.file_type === "image" ? (
          <img src={downloadUrl} alt={document.original_filename} className="max-h-[70vh] w-full object-contain" />
        ) : (
          <iframe src={downloadUrl} title={document.original_filename} className="h-[70vh] w-full" />
        )}
      </div>
    </Modal>
  );
}

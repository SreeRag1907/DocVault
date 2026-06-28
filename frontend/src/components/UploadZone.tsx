import { useCallback, useRef, useState, DragEvent } from "react";
import { api, Document, ApiError } from "../lib/api";
import { useToast } from "../context/ToastContext";

interface QueueItem {
  id: string;
  filename: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export function UploadZone({ onUploaded }: { onUploaded: (doc: Document) => void }) {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const accepted = files.filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
      const rejected = files.length - accepted.length;
      if (rejected > 0) {
        show(`${rejected} file(s) skipped - only PDF and image files are supported`, "error");
      }

      for (const file of accepted) {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;
        setQueue((prev) => [...prev, { id, filename: file.name, progress: 0, status: "uploading" }]);

        try {
          const doc = await api.uploadDocument(file, (percent) => {
            setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, progress: percent } : q)));
          });
          setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: "done", progress: 100 } : q)));
          onUploaded(doc);
          show(`Uploaded ${file.name}`, "success");
        } catch (err) {
          const message = err instanceof ApiError ? err.message : "Upload failed";
          setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: "error", error: message } : q)));
          show(`Failed to upload ${file.name}`, "error");
        }

        // Clear completed entries after a moment so the queue doesn't grow forever.
        setTimeout(() => {
          setQueue((prev) => prev.filter((q) => q.id !== id));
        }, 3000);
      }
    },
    [onUploaded, show]
  );

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFiles(Array.from(e.target.files));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-2 text-center text-sm transition ${
          dragActive
            ? "border-brass bg-brass/5 text-brass"
            : "border-vault-700 text-zinc-400 hover:border-vault-600 hover:text-zinc-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
        + Upload, or drag files here
      </div>

      {queue.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {queue.map((item) => (
            <div key={item.id} className="rounded-md bg-vault-900 px-3 py-2 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="truncate text-zinc-300">{item.filename}</span>
                <span
                  className={
                    item.status === "error" ? "text-danger" : item.status === "done" ? "text-brass" : "text-zinc-500"
                  }
                >
                  {item.status === "error" ? "Failed" : item.status === "done" ? "Done" : `${item.progress}%`}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-vault-700">
                <div
                  className={`h-1 rounded-full transition-all ${item.status === "error" ? "bg-danger" : "bg-brass"}`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

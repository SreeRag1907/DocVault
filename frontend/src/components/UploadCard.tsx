import { useCallback, useRef, useState, DragEvent } from "react";
import { api, Document, ApiError } from "../lib/api";
import { useToast } from "../context/ToastContext";

interface QueueItem {
  id: string;
  filename: string;
  progress: number;
  status: "uploading" | "done" | "error";
}

export function UploadCard({ onUploaded }: { onUploaded: (doc: Document) => void }) {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const accepted = files.filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
      const rejected = files.length - accepted.length;
      if (rejected > 0) {
        show(`${rejected} file(s) skipped — only PDF and image files are supported`, "error");
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
          setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: "error" } : q)));
          show(`Failed to upload ${file.name}: ${message}`, "error");
        }

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

  const isUploading = queue.some((q) => q.status === "uploading");

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`upload-glow group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-6 transition-all duration-300 ${
        dragActive
          ? "drag-active border-brass bg-brass/5"
          : "border-vault-600 hover:border-vault-500"
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

      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle, #c9a14a 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }} />

      <div className="relative flex flex-col items-center justify-center text-center">
        {/* Icon */}
        <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
          dragActive ? "bg-brass/20 scale-110" : "bg-vault-700/50 group-hover:bg-vault-700 group-hover:scale-105"
        }`}>
          {isUploading ? (
            <svg className="h-7 w-7 text-brass animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className={`h-7 w-7 transition-colors duration-300 ${dragActive ? "text-brass" : "text-zinc-500 group-hover:text-brass"}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          )}
        </div>

        <p className={`mb-1 font-display text-sm font-semibold transition-colors duration-300 ${
          dragActive ? "text-brass" : "text-zinc-300 group-hover:text-zinc-100"
        }`}>
          {dragActive ? "Drop files here" : "Upload Documents"}
        </p>
        <p className="text-xs text-zinc-500">
          Drag & drop or click to browse · PDF, PNG, JPG
        </p>

        {/* Upload progress */}
        {queue.length > 0 && (
          <div className="mt-4 w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            {queue.map((item) => (
              <div key={item.id} className="rounded-lg bg-vault-800/80 px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate text-zinc-300">{item.filename}</span>
                  <span className={
                    item.status === "error" ? "text-danger" : item.status === "done" ? "text-emerald-400" : "text-brass"
                  }>
                    {item.status === "error" ? "Failed" : item.status === "done" ? "Done ✓" : `${item.progress}%`}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-vault-700">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      item.status === "error" ? "bg-danger" : item.status === "done" ? "bg-emerald-400" : "bg-brass"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

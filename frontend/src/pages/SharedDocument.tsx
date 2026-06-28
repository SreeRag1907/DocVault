import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

interface SharedDoc {
  originalFilename: string;
  mimeType: string;
  fileType: string;
  aiSummary: string | null;
}

export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getSharedDocument(token)
      .then((res) => {
        setDoc(res.document);
        setDownloadUrl(res.downloadUrl);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Link not found."));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-vault-950 px-4">
      <div className="w-full max-w-md rounded-lg border border-vault-700 bg-vault-900 p-6 text-center">
        <p className="mb-4 font-display text-lg font-semibold text-brass">DocVault</p>

        {error && <p className="text-sm text-danger">{error}</p>}

        {doc && (
          <>
            <p className="mb-1 font-display text-base text-zinc-100">{doc.originalFilename}</p>
            <p className="mb-4 text-xs uppercase tracking-wide text-zinc-500">
              Shared {doc.fileType} document
            </p>

            {doc.aiSummary && (
              <p className="mb-4 rounded-md bg-vault-800 p-3 text-left text-sm text-zinc-400">
                {doc.aiSummary}
              </p>
            )}

            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-brass px-4 py-2 text-sm font-medium text-vault-950 hover:opacity-90"
              >
                Open document
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

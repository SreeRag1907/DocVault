import { useEffect, useState } from "react";
import { Document, api } from "../lib/api";
import { FileIcon } from "./FileIcon";

export function Thumbnail({ document }: { document: Document }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (document.file_type !== "image") return;
    let cancelled = false;

    api
      .getDownloadUrl(document.id)
      .then((res) => {
        if (!cancelled) setUrl(res.downloadUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [document.id, document.file_type]);

  if (document.file_type !== "image" || failed) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-md bg-vault-800 text-zinc-600">
        <FileIcon fileType={document.file_type} className="h-8 w-8" />
      </div>
    );
  }

  if (!url) {
    return <div className="h-32 w-full animate-pulse rounded-md bg-vault-800" />;
  }

  return (
    <div className="h-32 w-full overflow-hidden rounded-md bg-vault-800">
      <img src={url} alt={document.original_filename} className="h-full w-full object-cover" />
    </div>
  );
}

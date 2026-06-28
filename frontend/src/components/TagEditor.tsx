import { useState, KeyboardEvent } from "react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagEditor({ tags, onChange, disabled }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  function commitDraft() {
    const value = draft.trim().toLowerCase();
    if (value && !tags.includes(value)) {
      onChange([...tags, value]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Escape") {
      setDraft("");
      setEditing(false);
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="group flex items-center gap-1 rounded-full bg-vault-700 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
        >
          {tag}
          {!disabled && (
            <button
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-zinc-500 group-hover:text-danger"
            >
              ×
            </button>
          )}
        </span>
      ))}

      {!disabled && editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            commitDraft();
            setEditing(false);
          }}
          placeholder="tag + Enter"
          className="w-20 rounded-full bg-vault-800 px-2 py-0.5 font-mono text-[11px] text-zinc-200 outline-none ring-1 ring-brass/40"
        />
      ) : !disabled ? (
        <button
          onClick={() => setEditing(true)}
          className="rounded-full border border-dashed border-vault-600 px-2 py-0.5 font-mono text-[11px] text-zinc-500 hover:border-brass hover:text-brass"
        >
          + tag
        </button>
      ) : null}
    </div>
  );
}

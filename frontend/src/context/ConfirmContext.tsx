import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Modal } from "../components/Modal";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function respond(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <Modal onClose={() => respond(false)}>
          <h2 className="mb-2 font-display text-base font-semibold text-zinc-100">{pending.title}</h2>
          {pending.description && <p className="mb-4 text-sm text-zinc-400">{pending.description}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => respond(false)}
              className="rounded-md border border-vault-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-vault-800"
            >
              Cancel
            </button>
            <button
              onClick={() => respond(true)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                pending.danger ? "bg-danger text-white hover:opacity-90" : "bg-brass text-vault-950 hover:opacity-90"
              }`}
            >
              {pending.confirmLabel || "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside a ConfirmProvider");
  return ctx.confirm;
}

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type LockState = "locked" | "unlocked";

interface SessionValue {
  lockState: LockState;
  /** The derived AES key. null when locked. */
  key: ArrayBuffer | null;
  setKey: (k: ArrayBuffer) => void;
  lock: () => void;
  /** Cached decrypted rows — cleared on lock. */
  rows: import("../lib/types").VaultRow[] | null;
  setRows: (r: import("../lib/types").VaultRow[] | null) => void;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<ArrayBuffer | null>(null);
  const [rows, setRows] = useState<import("../lib/types").VaultRow[] | null>(null);

  const setKey = useCallback((k: ArrayBuffer) => setKeyState(k), []);

  const lock = useCallback(() => {
    // Best-effort scrub: overwrite the buffer.
    if (key) {
      const view = new Uint8Array(key);
      view.fill(0);
    }
    setKeyState(null);
    setRows(null);
  }, [key]);

  const value: SessionValue = {
    lockState: key ? "unlocked" : "locked",
    key,
    setKey,
    lock,
    rows,
    setRows,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used within SessionProvider");
  return v;
}

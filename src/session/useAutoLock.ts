import { useEffect } from "react";
import { useSession } from "./SessionContext";

const IDLE_MS = 5 * 60 * 1000;

export function useAutoLock() {
  const { lockState, lock } = useSession();

  useEffect(() => {
    if (lockState !== "unlocked") return;
    let timer = window.setTimeout(lock, IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = window.setTimeout(lock, IDLE_MS);
    };
    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    const onVis = () => { if (document.hidden) lock(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [lockState, lock]);
}

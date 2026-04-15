import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { deviceLabel } from "../session/useDeviceLabel";

export interface PresenceEntry {
  device_label: string;
  joined_at: number; // ms epoch
  presence_ref: string;
}

export function usePresence() {
  const [others, setOthers] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const channel = supabase.channel(`presence:${userId}`, {
        config: { presence: { key: crypto.randomUUID() } },
      });

      const myPayload = { device_label: deviceLabel(), joined_at: Date.now() };

      channel.on("presence", { event: "sync" }, () => {
        if (!mounted) return;
        const state = channel.presenceState() as Record<string, PresenceEntry[]>;
        const flat: PresenceEntry[] = [];
        for (const [ref, arr] of Object.entries(state)) {
          for (const p of arr) flat.push({ ...p, presence_ref: ref });
        }
        // Filter out our own presence by join time + label match (best-effort).
        setOthers(flat.filter(p =>
          !(p.device_label === myPayload.device_label && p.joined_at === myPayload.joined_at)
        ));
      });

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track(myPayload);
      });

      return () => {
        mounted = false;
        channel.untrack();
        supabase.removeChannel(channel);
      };
    };
    const cleanup = init();
    return () => { cleanup.then(fn => fn?.()); };
  }, []);

  return others;
}

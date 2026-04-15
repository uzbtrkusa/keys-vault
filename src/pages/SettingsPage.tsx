import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { encryptJson, randomIv } from "../lib/crypto";
import { parseXlsxBuffer, exportDecryptedXlsx } from "../io/xlsx";
import { useSession } from "../session/SessionContext";
import { useVaultRows } from "../vault/useVaultRows";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const { key } = useSession();
  const { data: rows } = useVaultRows();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setStatus("Reading file…");
    try {
      const buf = await file.arrayBuffer();
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const parsed = parseXlsxBuffer(buf);
        if (!confirm(`Found ${parsed.length} rows. Import now?`)) { setBusy(false); return; }
        setStatus(`Encrypting ${parsed.length} rows…`);

        const toInsert: { ciphertext: Uint8Array; iv: Uint8Array }[] = [];
        for (const p of parsed) {
          const iv = randomIv();
          const ct = await encryptJson(key!, iv, p);
          toInsert.push({ ciphertext: new Uint8Array(ct), iv });
        }

        const BATCH = 100;
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const chunk = toInsert.slice(i, i + BATCH);
          setStatus(`Uploading ${i + chunk.length}/${toInsert.length}…`);
          const { error } = await supabase.from("vault_rows").insert(chunk);
          if (error) throw error;
        }
        setStatus(`Imported ${parsed.length} rows.`);
        qc.invalidateQueries({ queryKey: ["vault_rows"] });
      } else {
        setStatus("Unsupported file type (expected .xlsx).");
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function onExportDecrypted() {
    const pw = prompt("Re-type master password to confirm decrypted export:");
    // This is a friction check, not a crypto check — we already have the key.
    if (pw === null || pw.length < 1) return;
    const buf = exportDecryptedXlsx(rows ?? []);
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    triggerDownload(blob, `keys-vault-${dateStr()}.xlsx`);
  }

  return (
    <div className="mx-auto max-w-xl p-4 space-y-4">
      <div><Link to="/" className="text-sm underline">← Back</Link></div>
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="space-y-2">
        <h2 className="font-medium">Import</h2>
        <p className="text-xs text-slate-600">
          Accepts `.xlsx` (one-time migration) and `.vault` (encrypted backup restore — coming in a later task).
        </p>
        <input type="file" accept=".xlsx,.vault" onChange={onPickFile} disabled={busy} />
        {status && <div className="text-sm text-slate-700">{status}</div>}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Export</h2>
        <button onClick={onExportDecrypted} className="rounded border px-3 py-1 text-sm">
          Download decrypted .xlsx
        </button>
      </section>
    </div>
  );
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}
function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

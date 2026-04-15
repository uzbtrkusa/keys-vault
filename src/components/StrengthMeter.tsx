import zxcvbn from "zxcvbn";

export function StrengthMeter({ password }: { password: string }) {
  const s = password ? zxcvbn(password).score : 0;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-600"];
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full rounded bg-slate-200">
        <div
          className={`h-1.5 rounded transition-all ${colors[s]}`}
          style={{ width: `${(s + 1) * 20}%` }}
        />
      </div>
      <div className="mt-0.5 text-xs text-slate-600">{password ? labels[s] : ""}</div>
    </div>
  );
}

export function strengthScore(password: string): number {
  return password ? zxcvbn(password).score : 0;
}

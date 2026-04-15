import { useState } from "react";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={"w-full rounded border border-slate-300 p-2 pr-14 " + (props.className ?? "")}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
        onClick={() => setShow(s => !s)}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

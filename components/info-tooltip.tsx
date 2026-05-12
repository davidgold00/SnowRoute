import type { ReactNode } from "react";

type InfoTooltipProps = {
  label: string;
  children: ReactNode;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  return (
    <details className="group relative inline-block">
      <summary
        className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-white/14 bg-white/[0.06] text-xs font-bold text-slate-100 transition hover:border-cyan-100/35 hover:bg-cyan-200/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
        aria-label={label}
      >
        i
      </summary>
      <div className="absolute right-0 z-[120] mt-2 w-72 rounded-xl border border-white/12 bg-[#0c1725] p-3 text-left text-xs leading-5 text-slate-100 shadow-[0_18px_60px_rgba(3,8,18,0.62)]">
        {children}
      </div>
    </details>
  );
}

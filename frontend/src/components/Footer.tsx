import type { Meta } from "../types/stock";
import { fmtDate } from "../lib/format";

export function Footer({ meta }: { meta?: Meta }) {
  const updated = fmtDate(meta?.last_updated);
  return (
    <footer className="mx-auto w-full max-w-[1400px] border-t border-white/[0.06] px-4 py-6 text-xs text-slate-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Fundamentals from Yahoo Finance, refreshed every weekday
          {updated ? ` (last updated ${updated})` : ""}. For research only, not investment advice.
        </p>
        <a href="https://github.com/Jenak26/nse-screener" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-300">
          Source on GitHub ↗
        </a>
      </div>
    </footer>
  );
}

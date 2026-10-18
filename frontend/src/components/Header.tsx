import { useEffect, useRef } from "react";
import type { Meta } from "../types/stock";
import type { Tab } from "../hooks/useUrlState";
import { fmtDate } from "../lib/format";

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  query: string;
  onQuery: (q: string) => void;
  meta?: Meta;
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere, like GitHub and most data tools.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="relative w-full">
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
        <path fill="currentColor" d="M8.5 3a5.5 5.5 0 014.38 8.83l3.65 3.64a.75.75 0 11-1.06 1.06l-3.64-3.65A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            e.currentTarget.blur();
          }
        }}
        placeholder="Search symbol or company"
        aria-label="Search stocks by symbol or company name"
        maxLength={50}
        className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-emerald-400/50 focus:bg-white/[0.08] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 text-slate-400 hover:text-slate-100"
        >
          ✕
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-[10px] text-slate-500 sm:block">/</kbd>
      )}
    </div>
  );
}

export function Header({ tab, onTab, query, onQuery, meta }: Props) {
  const updated = fmtDate(meta?.last_updated);
  return (
    <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b1120]/85 backdrop-blur-xl">
      <header className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3">
        <a href="/" className="flex items-center gap-2.5" aria-label="NSE Screener home">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold tracking-tight text-white">NSE Screener</h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">NIFTY 500 fundamentals</p>
          </div>
        </a>

        <nav aria-label="Views" className="flex rounded-xl border border-white/[0.06] bg-white/[0.05] p-[3px]">
          {(["screener", "sectors"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === t ? "bg-white/[0.12] text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="order-last w-full md:order-none md:ml-auto md:w-80">
          <SearchBox value={query} onChange={onQuery} />
        </div>

        <div className="ml-auto hidden items-center text-[11px] text-slate-400 sm:flex md:ml-0">
          {meta?.pipeline_status === "empty" ? (
            <span className="text-amber-300">No data loaded yet</span>
          ) : updated ? (
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Updated {updated}
            </span>
          ) : null}
        </div>
      </header>
    </div>
  );
}

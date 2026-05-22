# NSE Stock Screener — Phase 2 Depth Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Differentiate from Screener.in — sector comparison view, saved screener presets, historical metric sparklines, PostgreSQL migration, demo GIF for README.

**Prerequisite:** Phase 1 deployed and live at a public URL.

**Architecture:** Adds `metric_history` table for sparkline data. Pipeline extended to save quarterly snapshots. Frontend adds SectorView page, preset save/load via localStorage, Recharts sparklines in StockDetailModal.

**Tech Stack:** Adds Recharts to frontend. PostgreSQL (Railway managed) replaces SQLite. No new backend services.

---

## File Map

| File | Change |
|---|---|
| `backend/database/models.py` | Add `MetricHistory` model |
| `backend/database/queries.py` | Add `get_metric_history()` |
| `backend/api/schemas.py` | Add `MetricHistoryOut`, `StockDetailOut.history` field |
| `backend/pipeline/scheduler.py` | Snapshot 4 metrics to `metric_history` after each run |
| `backend/api/routes/stocks.py` | Return history in `/api/stocks/{symbol}` |
| `frontend/src/components/SectorView.tsx` | Sector comparison table |
| `frontend/src/components/PresetBar.tsx` | Save/load named filter presets |
| `frontend/src/components/Sparkline.tsx` | Recharts line for metric trend |
| `frontend/src/components/StockDetailModal.tsx` | Add sparklines |
| `frontend/src/App.tsx` | Add SectorView tab, PresetBar |

---

### Task 1: MetricHistory table and pipeline snapshot

**Files:**
- Modify: `backend/database/models.py`
- Modify: `backend/pipeline/scheduler.py`
- Modify: `backend/database/queries.py`

- [ ] **Step 1: Add `MetricHistory` to `backend/database/models.py`**

Append to the existing file after the `Stock` class:

```python
from sqlalchemy import Integer, ForeignKey

class MetricHistory(Base):
    __tablename__ = "metric_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text, nullable=False)
    metric = Column(Text, nullable=False)   # "roe", "pe_ratio", "revenue_growth_yoy", "debt_to_equity"
    value = Column(Float, nullable=False)
    quarter = Column(Text, nullable=False)  # "Q1FY26"
    recorded_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 2: Add `get_metric_history` to `backend/database/queries.py`**

Append to the file:

```python
from backend.database.models import MetricHistory

def get_metric_history(session: Session, symbol: str, metrics: list[str]) -> dict[str, list[dict]]:
    """Return {metric: [{quarter, value}, ...]} sorted oldest-first, last 8 quarters."""
    result = {}
    for metric in metrics:
        rows = list(session.execute(
            select(MetricHistory.quarter, MetricHistory.value)
            .where(MetricHistory.symbol == symbol, MetricHistory.metric == metric)
            .order_by(MetricHistory.recorded_at.asc())
            .limit(8)
        ).all())
        result[metric] = [{"quarter": r.quarter, "value": r.value} for r in rows]
    return result
```

- [ ] **Step 3: Add snapshot logic to `run_pipeline` in `backend/pipeline/scheduler.py`**

Inside `run_pipeline`, after the upsert loop, add before `session.commit()`:

```python
from backend.database.models import MetricHistory
from datetime import datetime

# Determine current quarter label
now = datetime.utcnow()
quarter_map = {1: "Q3", 2: "Q3", 3: "Q4", 4: "Q4", 5: "Q4", 6: "Q1", 7: "Q1", 8: "Q1", 9: "Q2", 10: "Q2", 11: "Q2", 12: "Q3"}
fy = now.year + 1 if now.month >= 4 else now.year
quarter_label = f"{quarter_map[now.month]}FY{str(fy)[2:]}"

snapshot_metrics = ["pe_ratio", "roe", "revenue_growth_yoy", "debt_to_equity"]
for data in stocks_data:
    for metric in snapshot_metrics:
        val = data.get(metric)
        if val is not None:
            session.add(MetricHistory(
                symbol=data["symbol"],
                metric=metric,
                value=val,
                quarter=quarter_label,
                recorded_at=datetime.utcnow(),
            ))
```

- [ ] **Step 4: Run DB migration (create new table)**

```powershell
python -c "from backend.database.db import init_db; init_db(); print('MetricHistory table created')"
```

Expected: `MetricHistory table created`

- [ ] **Step 5: Commit**

```bash
git add backend/database/models.py backend/database/queries.py backend/pipeline/scheduler.py
git commit -m "feat: MetricHistory model + quarterly snapshot in pipeline"
```

---

### Task 2: Return history in stock detail API

**Files:**
- Modify: `backend/api/schemas.py`
- Modify: `backend/api/routes/stocks.py`

- [ ] **Step 1: Add history to schemas in `backend/api/schemas.py`**

Replace `StockDetailOut`:

```python
class MetricPointOut(BaseModel):
    quarter: str
    value: float

class StockDetailOut(StockOut):
    sector_rank: dict = {}
    history: dict[str, list[MetricPointOut]] = {}
```

- [ ] **Step 2: Update `/api/stocks/{symbol}` in `backend/api/routes/stocks.py`**

Add import at top:
```python
from backend.database.queries import get_metric_history
```

Replace the `get_stock` function:

```python
@router.get("/stocks/{symbol}", response_model=StockDetailOut)
def get_stock(symbol: str, session: Session = Depends(get_session)):
    stock = get_stock_by_symbol(session, symbol.upper())
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    rank = get_sector_percentiles(session, symbol.upper())
    history = get_metric_history(
        session, symbol.upper(),
        ["pe_ratio", "roe", "revenue_growth_yoy", "debt_to_equity"],
    )
    return StockDetailOut(
        **{c.key: getattr(stock, c.key) for c in stock.__table__.columns},
        sector_rank=rank,
        history=history,
    )
```

- [ ] **Step 3: Verify API still passes tests**

```powershell
pytest tests/test_api.py -v
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/api/schemas.py backend/api/routes/stocks.py
git commit -m "feat: include metric history in stock detail API response"
```

---

### Task 3: Sparkline component and StockDetailModal update

**Files:**
- Create: `frontend/src/components/Sparkline.tsx`
- Modify: `frontend/src/components/StockDetailModal.tsx`
- Modify: `frontend/src/types/stock.ts`

- [ ] **Step 1: Install Recharts**

```powershell
cd frontend && npm install recharts
```

- [ ] **Step 2: Add history types to `frontend/src/types/stock.ts`**

Add to the file:

```typescript
export interface MetricPoint {
  quarter: string;
  value: number;
}

// Update StockDetail
export interface StockDetail extends Stock {
  sector_rank: {
    pe_percentile?: number | null;
    roe_percentile?: number | null;
    debt_percentile?: number | null;
    revenue_growth_percentile?: number | null;
    promoter_percentile?: number | null;
  };
  history: Record<string, MetricPoint[]>;
}
```

- [ ] **Step 3: Write `frontend/src/components/Sparkline.tsx`**

```tsx
import { LineChart, Line, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { MetricPoint } from "../types/stock";

interface Props { data: MetricPoint[]; color?: string; label: string; suffix?: string; }

export function Sparkline({ data, color = "#3b82f6", label, suffix = "" }: Props) {
  if (!data || data.length < 2) return null;
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label} trend</p>
      <ResponsiveContainer width="100%" height={64}>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}${suffix}`, label]}
            labelFormatter={(l) => String(l)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{data[0].quarter}</span>
        <span>{data[data.length - 1].quarter}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add sparklines to `frontend/src/components/StockDetailModal.tsx`**

Add import at top:
```tsx
import { Sparkline } from "./Sparkline";
```

After the last `<Row />` inside the `data ? (` branch, add:

```tsx
{data.history?.roe?.length >= 2 && (
  <Sparkline data={data.history.roe} label="ROE" suffix="%" color="#16a34a" />
)}
{data.history?.pe_ratio?.length >= 2 && (
  <Sparkline data={data.history.pe_ratio} label="P/E" color="#3b82f6" />
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/components/Sparkline.tsx frontend/src/components/StockDetailModal.tsx frontend/src/types/stock.ts
git commit -m "feat: Recharts sparklines for ROE and P/E trend in stock detail modal"
```

---

### Task 4: Sector comparison view

**Files:**
- Create: `frontend/src/components/SectorView.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/hooks/useStocks.ts`

- [ ] **Step 1: Write `frontend/src/components/SectorView.tsx`**

```tsx
import { useSectors } from "../hooks/useStocks";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectorView() {
  const { data: sectors, isLoading } = useSectors();

  if (isLoading) return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  const maxRoe = Math.max(...(sectors ?? []).map((s) => s.avg_roe ?? 0));
  const maxPe = Math.max(...(sectors ?? []).map((s) => s.avg_pe ?? 0));

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Sector Overview</h2>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Sector</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Stocks</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-48">Avg ROE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-48">Avg P/E</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Avg D/E</th>
            </tr>
          </thead>
          <tbody>
            {(sectors ?? []).map((s) => (
              <tr key={s.sector} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{s.sector}</td>
                <td className="px-4 py-3 text-slate-500">{s.stock_count}</td>
                <td className="px-4 py-3">
                  <span className="text-emerald-600 font-medium">{s.avg_roe?.toFixed(1) ?? "—"}%</span>
                  {s.avg_roe != null && <Bar value={s.avg_roe} max={maxRoe} color="bg-emerald-400" />}
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-700 font-medium">{s.avg_pe?.toFixed(1) ?? "—"}</span>
                  {s.avg_pe != null && <Bar value={s.avg_pe} max={maxPe} color="bg-blue-400" />}
                </td>
                <td className="px-4 py-3 text-slate-500">{s.avg_debt_to_equity?.toFixed(2) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add tab navigation to `frontend/src/App.tsx`**

Add `tab` state and tab bar to `Screener()`:

Replace the `return (` JSX in `Screener` with:

```tsx
const [tab, setTab] = useState<"screener" | "sectors">("screener");

return (
  <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-[57px] flex items-center px-6 gap-3">
      <div className="flex items-baseline gap-2">
        <h1 className="text-base font-bold text-slate-900 tracking-tight">NSE Screener</h1>
        <span className="text-xs text-slate-400 font-medium">NIFTY 500</span>
      </div>
      {/* Tabs */}
      <nav className="flex gap-1 ml-6">
        {(["screener", "sectors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              tab === t ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
        {meta?.total_stocks ? <span>{meta.total_stocks.toLocaleString()} stocks</span> : null}
        {meta?.last_updated ? (
          <span>Updated {new Date(meta.last_updated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        ) : null}
      </div>
    </header>

    {tab === "screener" ? (
      <div className="flex">
        <FilterPanel
          filters={filters}
          sectors={(sectors ?? []).map((s) => s.sector)}
          onChange={handleFilters}
          onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
        />
        <main className="flex-1 p-6 min-w-0">
          <StockTable
            stocks={data?.stocks ?? []}
            total={data?.total ?? 0}
            page={page}
            pageSize={20}
            sortBy={sortBy}
            sortDir={sortDir}
            isLoading={isLoading}
            onSort={handleSort}
            onPage={setPage}
            onRowClick={setSelected}
          />
        </main>
      </div>
    ) : (
      <SectorView />
    )}

    {selected && <StockDetailModal symbol={selected} onClose={() => setSelected(null)} />}
  </div>
);
```

Add import at top: `import { SectorView } from "./components/SectorView";`

- [ ] **Step 3: Compile check**

```powershell
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/components/SectorView.tsx frontend/src/App.tsx
git commit -m "feat: Sector Overview tab with avg ROE, P/E, D/E bar chart per sector"
```

---

### Task 5: Preset bar (save/load filter presets)

**Files:**
- Create: `frontend/src/components/PresetBar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write `frontend/src/components/PresetBar.tsx`**

```tsx
import { useState, useEffect } from "react";
import type { Filters } from "../types/stock";

const STORAGE_KEY = "nse_screener_presets";
const BUILT_IN: { name: string; filters: Partial<Filters> }[] = [
  { name: "High ROE", filters: { roe_min: "20" } },
  { name: "Low Debt", filters: { debt_max: "0.5" } },
  { name: "Strong Promoters", filters: { promoter_min: "60" } },
  { name: "Growth", filters: { revenue_growth_min: "15", roe_min: "15" } },
  { name: "Value", filters: { pe_max: "15", roe_min: "12" } },
];

interface Preset { name: string; filters: Partial<Filters>; }

interface Props {
  currentFilters: Filters;
  defaultFilters: Filters;
  onApply: (f: Filters) => void;
}

export function PresetBar({ currentFilters, defaultFilters, onApply }: Props) {
  const [custom, setCustom] = useState<Preset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  });
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const savePreset = () => {
    if (!name.trim()) return;
    const next = [...custom, { name: name.trim(), filters: { ...currentFilters } }];
    setCustom(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setName("");
    setSaving(false);
  };

  const deletePreset = (i: number) => {
    const next = custom.filter((_, idx) => idx !== i);
    setCustom(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const apply = (filters: Partial<Filters>) =>
    onApply({ ...defaultFilters, ...filters });

  return (
    <div className="flex items-center gap-2 px-6 py-2 bg-white border-b border-slate-100 overflow-x-auto">
      <span className="text-xs text-slate-400 font-medium shrink-0">Presets:</span>
      {BUILT_IN.map((p) => (
        <button key={p.name} onClick={() => apply(p.filters)}
          className="px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 whitespace-nowrap transition-colors">
          {p.name}
        </button>
      ))}
      {custom.map((p, i) => (
        <div key={i} className="flex items-center gap-0.5 group">
          <button onClick={() => apply(p.filters)}
            className="px-3 py-1 text-xs rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap">
            {p.name}
          </button>
          <button onClick={() => deletePreset(i)}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs px-1">
            ×
          </button>
        </div>
      ))}
      {saving ? (
        <div className="flex items-center gap-1 shrink-0">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && savePreset()}
            placeholder="Preset name" className="px-2 py-1 text-xs border border-slate-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={savePreset} className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg">Save</button>
          <button onClick={() => setSaving(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setSaving(true)}
          className="px-3 py-1 text-xs text-slate-400 hover:text-blue-600 whitespace-nowrap">
          + Save current
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add PresetBar to `frontend/src/App.tsx`**

Add import: `import { PresetBar } from "./components/PresetBar";`

Insert `<PresetBar>` between `<header>` and the tab content (inside `return`, after the closing `</header>` tag):

```tsx
{tab === "screener" && (
  <PresetBar
    currentFilters={filters}
    defaultFilters={DEFAULT_FILTERS}
    onApply={handleFilters}
  />
)}
```

- [ ] **Step 3: Compile check + visual test**

```powershell
cd frontend && npx tsc --noEmit && npm run dev
```

Confirm preset chips appear below the header. Click "High ROE" — ROE min field in FilterPanel should fill with `20`. Click "Save current" — enter a name — preset persists on page refresh.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/components/PresetBar.tsx frontend/src/App.tsx
git commit -m "feat: filter preset bar with built-in presets and localStorage save/load"
```

---

### Task 6: PostgreSQL migration and README demo GIF

**Files:**
- Update: `.env.example` (Railway PostgreSQL URL format)
- Update: `requirements.txt` (add psycopg2)
- Update: `README.md` (add demo GIF)

- [ ] **Step 1: Add psycopg2 to `requirements.txt`**

```
psycopg2-binary>=2.9.0
```

- [ ] **Step 2: Install**

```powershell
pip install psycopg2-binary
```

- [ ] **Step 3: Set up Railway PostgreSQL**

In Railway dashboard:
1. Open your backend service → Add Plugin → PostgreSQL
2. Copy the `DATABASE_URL` value from the PostgreSQL plugin
3. Set it as an env var on your backend service: `DATABASE_URL=postgresql://...`

On first deploy with the new URL, `init_db()` runs in lifespan and creates all tables automatically.

- [ ] **Step 4: Record demo GIF**

Use any screen recorder (ShareX on Windows is free). Record:
1. Open the live URL
2. Set ROE min = 15, Debt max = 0.5
3. Click a stock row — modal opens with metrics + sparklines
4. Switch to Sectors tab
5. Click a built-in preset

Save as `docs/demo.gif` (keep under 5MB — record at 720p, 10fps).

- [ ] **Step 5: Update README to reference demo GIF**

Add after the first paragraph in `README.md`:

```markdown
![NSE Screener demo](docs/demo.gif)
```

- [ ] **Step 6: Run full test suite**

```powershell
pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 7: Final commit**

```bash
git add requirements.txt docs/demo.gif README.md
git commit -m "feat: PostgreSQL support + demo GIF in README"
```

---

**Phase 2 complete.** The project now has sector comparison, preset filtering, historical sparklines, and PostgreSQL in production — ready for the resume.

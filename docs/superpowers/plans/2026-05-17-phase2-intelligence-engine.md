# Phase 2: Full Intelligence Engine + Options Ideas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the pattern library (21 patterns total), add weighted scoring engine, sector rotation, multi-timeframe analysis, momentum rankings, relative strength, and all 10 dashboard pages including Options Trade Ideas.

**Architecture:** Extends Phase 1's scan_runner with new patterns. Adds 5-factor weighted scorer replacing basic scorer. New engines (sector, MTF, RS) run as additional APScheduler jobs writing to DB. Dashboard gains 8 new pages reading from DB.

**Tech Stack:** All Phase 1 deps + no new packages required.

**Prerequisite:** Phase 1 complete. All Phase 1 tests passing.

---

## File Map (additions to Phase 1)

| File | Responsibility |
|---|---|
| `backend/patterns/shooting_star.py` | Shooting Star detector |
| `backend/patterns/double_bottom.py` | Double Bottom detector |
| `backend/patterns/double_top.py` | Double Top detector |
| `backend/patterns/bull_flag.py` | Bull Flag detector |
| `backend/patterns/triangle.py` | Symmetrical Triangle detector |
| `backend/patterns/cup_handle.py` | Cup & Handle detector |
| `backend/patterns/rsi_divergence.py` | RSI Divergence detector |
| `backend/patterns/macd_crossover.py` | MACD Crossover detector |
| `backend/patterns/ema_crossover.py` | EMA Crossover detector |
| `backend/patterns/bollinger_squeeze.py` | Bollinger Squeeze detector |
| `backend/patterns/ath_breakout.py` | ATH Breakout detector |
| `backend/patterns/consolidation_breakout.py` | Consolidation Breakout detector |
| `backend/patterns/fiftytwo_week_breakout.py` | 52-Week High Breakout detector |
| `backend/scoring/scorer.py` | **Replace** with 5-factor weighted scorer |
| `backend/sectors/sector_engine.py` | Sector strength computation |
| `backend/indicators/relative_strength.py` | RS vs NIFTY calculation |
| `backend/indicators/momentum.py` | Momentum score computation |
| `backend/rankings/momentum_ranker.py` | Multi-horizon momentum ranking |
| `database/models.py` | Add `momentum_scores` table |
| `database/queries.py` | Add new query helpers |
| `app/pages/03_momentum_rankings.py` | Momentum Rankings page |
| `app/pages/04_breakout_detection.py` | Breakout Detection page |
| `app/pages/05_vwap_intraday.py` | VWAP & Intraday page |
| `app/pages/06_sector_rotation.py` | Sector Rotation page |
| `app/pages/07_relative_strength.py` | Relative Strength page |
| `app/pages/08_volume_analysis.py` | Volume Analysis page |
| `app/pages/09_watchlist.py` | Watchlist page |
| `app/pages/10_stock_detail.py` | Stock Detail page |
| `app/pages/11_options_ideas.py` | Options Trade Ideas page |

---

## Task 1: Remaining 13 Patterns

**Files:** `backend/patterns/` — 13 new files + tests

All patterns follow the same `detect(candles: pd.DataFrame) -> PatternResult` interface from Phase 1.

- [ ] **Step 1: Create `backend/patterns/shooting_star.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 3:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    last = candles.iloc[-1]
    body = abs(last["close"] - last["open"])
    total_range = last["high"] - last["low"]
    if total_range == 0 or body == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    upper_wick = last["high"] - max(last["open"], last["close"])
    lower_wick = min(last["open"], last["close"]) - last["low"]
    if upper_wick >= 2 * body and lower_wick <= 0.3 * body and body <= 0.35 * total_range:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = last["volume"] / avg_vol if avg_vol > 0 else 1
        confidence = min(100, 55 + min(20, int((vol_ratio - 1) * 12)))
        return PatternResult(detected=True, confidence=confidence, direction="bearish",
                             metadata={"upper_wick_ratio": round(upper_wick / body, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 2: Create `backend/patterns/rsi_divergence.py`**

```python
import pandas as pd
import pandas_ta as ta
from backend.patterns.base import PatternResult

MIN_CANDLES = 30

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    rsi = ta.rsi(candles["close"], length=14)
    if rsi is None or rsi.isna().all():
        return PatternResult(detected=False, confidence=0, direction="neutral")
    # Bullish divergence: price makes lower low, RSI makes higher low
    price_ll = candles["close"].iloc[-1] < candles["close"].iloc[-10:-1].min()
    rsi_hl   = rsi.iloc[-1] > rsi.iloc[-10:-1].min()
    if price_ll and rsi_hl and rsi.iloc[-1] < 50:
        confidence = min(100, 60 + int((50 - rsi.iloc[-1]) * 0.5))
        return PatternResult(detected=True, confidence=confidence, direction="bullish",
                             metadata={"rsi": round(rsi.iloc[-1], 1)})
    # Bearish divergence: price makes higher high, RSI makes lower high
    price_hh = candles["close"].iloc[-1] > candles["close"].iloc[-10:-1].max()
    rsi_lh   = rsi.iloc[-1] < rsi.iloc[-10:-1].max()
    if price_hh and rsi_lh and rsi.iloc[-1] > 50:
        confidence = min(100, 60 + int((rsi.iloc[-1] - 50) * 0.5))
        return PatternResult(detected=True, confidence=confidence, direction="bearish",
                             metadata={"rsi": round(rsi.iloc[-1], 1)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 3: Create `backend/patterns/macd_crossover.py`**

```python
import pandas as pd
import pandas_ta as ta
from backend.patterns.base import PatternResult

MIN_CANDLES = 35

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    macd_df = ta.macd(candles["close"], fast=12, slow=26, signal=9)
    if macd_df is None or macd_df.empty:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    macd_col = [c for c in macd_df.columns if "MACD_12" in c and "SIGNAL" not in c and "HIST" not in c][0]
    signal_col = [c for c in macd_df.columns if "MACDs" in c][0]
    macd_line = macd_df[macd_col]
    signal_line = macd_df[signal_col]
    # Bullish crossover: MACD crosses above signal
    crossed_up = macd_line.iloc[-2] < signal_line.iloc[-2] and macd_line.iloc[-1] > signal_line.iloc[-1]
    if crossed_up:
        return PatternResult(detected=True, confidence=65, direction="bullish",
                             metadata={"macd": round(macd_line.iloc[-1], 3)})
    # Bearish crossover
    crossed_down = macd_line.iloc[-2] > signal_line.iloc[-2] and macd_line.iloc[-1] < signal_line.iloc[-1]
    if crossed_down:
        return PatternResult(detected=True, confidence=65, direction="bearish",
                             metadata={"macd": round(macd_line.iloc[-1], 3)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 4: Create `backend/patterns/ema_crossover.py`**

```python
import pandas as pd
import pandas_ta as ta
from backend.patterns.base import PatternResult

MIN_CANDLES = 55

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    ema20 = ta.ema(candles["close"], length=20)
    ema50 = ta.ema(candles["close"], length=50)
    if ema20 is None or ema50 is None:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    crossed_up   = ema20.iloc[-2] < ema50.iloc[-2] and ema20.iloc[-1] > ema50.iloc[-1]
    crossed_down = ema20.iloc[-2] > ema50.iloc[-2] and ema20.iloc[-1] < ema50.iloc[-1]
    if crossed_up:
        return PatternResult(detected=True, confidence=70, direction="bullish",
                             metadata={"ema20": round(ema20.iloc[-1], 2), "ema50": round(ema50.iloc[-1], 2)})
    if crossed_down:
        return PatternResult(detected=True, confidence=70, direction="bearish",
                             metadata={"ema20": round(ema20.iloc[-1], 2), "ema50": round(ema50.iloc[-1], 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 5: Create `backend/patterns/bollinger_squeeze.py`**

```python
import pandas as pd
import pandas_ta as ta
from backend.patterns.base import PatternResult

MIN_CANDLES = 25

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    bbands = ta.bbands(candles["close"], length=20, std=2)
    if bbands is None:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    upper_col = [c for c in bbands.columns if "BBU" in c][0]
    lower_col = [c for c in bbands.columns if "BBL" in c][0]
    bandwidth = (bbands[upper_col] - bbands[lower_col]) / bbands[upper_col]
    current_bw = bandwidth.iloc[-1]
    avg_bw = bandwidth.iloc[-20:].mean()
    # Squeeze: current bandwidth < 50% of average (bands very tight)
    if current_bw < avg_bw * 0.5:
        # Direction from EMA slope
        ema9 = ta.ema(candles["close"], length=9)
        direction = "bullish" if ema9.iloc[-1] > ema9.iloc[-3] else "bearish"
        return PatternResult(detected=True, confidence=68, direction=direction,
                             metadata={"bandwidth": round(current_bw, 4)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 6: Create `backend/patterns/ath_breakout.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 252  # ~1 year of daily candles

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 50:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    lookback = candles.iloc[:-1]
    all_time_high = lookback["high"].max()
    current = candles.iloc[-1]
    if current["close"] > all_time_high:
        avg_vol = candles["volume"].iloc[-21:-1].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1 else 0
        confidence = min(100, 65 + vol_bonus)
        return PatternResult(detected=True, confidence=confidence, direction="bullish",
                             metadata={"ath": round(all_time_high, 2), "vol_ratio": round(vol_ratio, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 7: Create `backend/patterns/fiftytwo_week_breakout.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 50:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    lookback_252 = candles.iloc[max(0, len(candles)-252):-1]
    high_52w = lookback_252["high"].max()
    current = candles.iloc[-1]
    if current["close"] > high_52w:
        avg_vol = candles["volume"].iloc[-21:-1].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        confidence = min(100, 62 + vol_bonus)
        return PatternResult(detected=True, confidence=confidence, direction="bullish",
                             metadata={"high_52w": round(high_52w, 2), "vol_ratio": round(vol_ratio, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 8: Create `backend/patterns/double_bottom.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 30

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    lows = candles["low"].values
    closes = candles["close"].values
    # Find two comparable lows within 1% of each other in last 30 candles
    window = lows[-30:]
    min_val = window.min()
    min_idx = [i for i, v in enumerate(window) if v <= min_val * 1.01]
    if len(min_idx) >= 2 and (min_idx[-1] - min_idx[0]) >= 5:
        # Neckline: high between the two lows
        neckline = candles["high"].iloc[-30:-1].max()
        current_close = closes[-1]
        if current_close > neckline:
            avg_vol = candles["volume"].iloc[-21:-1].mean()
            vol_ratio = candles["volume"].iloc[-1] / avg_vol if avg_vol > 0 else 1
            vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
            return PatternResult(detected=True, confidence=min(100, 65 + vol_bonus),
                                 direction="bullish",
                                 metadata={"neckline": round(neckline, 2), "vol_ratio": round(vol_ratio, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 9: Create `backend/patterns/double_top.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 30

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    highs = candles["high"].values[-30:]
    max_val = highs.max()
    max_idx = [i for i, v in enumerate(highs) if v >= max_val * 0.99]
    if len(max_idx) >= 2 and (max_idx[-1] - max_idx[0]) >= 5:
        neckline = candles["low"].iloc[-30:-1].min()
        if candles["close"].iloc[-1] < neckline:
            avg_vol = candles["volume"].iloc[-21:-1].mean()
            vol_ratio = candles["volume"].iloc[-1] / avg_vol if avg_vol > 0 else 1
            vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
            return PatternResult(detected=True, confidence=min(100, 65 + vol_bonus),
                                 direction="bearish",
                                 metadata={"neckline": round(neckline, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 10: Create `backend/patterns/bull_flag.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 15

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    # Pole: sharp rally in first part
    pole_end = len(candles) - 8
    pole = candles.iloc[max(0, pole_end-5):pole_end]
    flag = candles.iloc[pole_end:]
    if pole.empty or flag.empty:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    pole_gain = (pole["close"].iloc[-1] - pole["close"].iloc[0]) / pole["close"].iloc[0]
    # Flag: slight pullback (max 50% of pole), tight range
    flag_pullback = (flag["close"].max() - flag["close"].min()) / flag["close"].max()
    flag_direction = flag["close"].iloc[-1] < flag["close"].iloc[0]  # slight down
    breakout = candles["close"].iloc[-1] > flag["high"].max()
    if pole_gain > 0.03 and flag_pullback < 0.05 and breakout:
        avg_vol = candles["volume"].iloc[-15:-1].mean()
        vol_ratio = candles["volume"].iloc[-1] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        return PatternResult(detected=True, confidence=min(100, 65 + vol_bonus),
                             direction="bullish",
                             metadata={"pole_gain_pct": round(pole_gain * 100, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 11: Create `backend/patterns/triangle.py`**

```python
import pandas as pd
import numpy as np
from backend.patterns.base import PatternResult

MIN_CANDLES = 20

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    window = candles.iloc[-20:]
    x = np.arange(len(window))
    highs_slope = np.polyfit(x, window["high"].values, 1)[0]
    lows_slope  = np.polyfit(x, window["low"].values,  1)[0]
    converging = highs_slope < 0 and lows_slope > 0
    if converging:
        direction = "bullish" if window["close"].iloc[-1] > window["close"].iloc[-5:].mean() else "bearish"
        return PatternResult(detected=True, confidence=62, direction=direction,
                             metadata={"highs_slope": round(highs_slope, 4), "lows_slope": round(lows_slope, 4)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 12: Create `backend/patterns/cup_handle.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 40

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    c = candles["close"].values
    # Cup: U-shape in first 30 candles
    cup = c[-40:-10]
    mid_idx = len(cup) // 2
    cup_left  = cup[:mid_idx].mean()
    cup_bottom = cup[mid_idx-3:mid_idx+3].mean()
    cup_right  = cup[mid_idx:].mean()
    u_shape = cup_left > cup_bottom and cup_right > cup_bottom
    # Handle: slight pullback in last 10 candles
    handle = c[-10:]
    handle_pullback = (handle.max() - handle.min()) / handle.max()
    # Breakout: current close above cup rim
    cup_rim = max(cup[0], cup[-1])
    breakout = c[-1] > cup_rim
    if u_shape and handle_pullback < 0.08 and breakout:
        avg_vol = candles["volume"].iloc[-21:-1].mean()
        vol_ratio = candles["volume"].iloc[-1] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 10)) if vol_ratio > 1 else 0
        return PatternResult(detected=True, confidence=min(100, 68 + vol_bonus),
                             direction="bullish",
                             metadata={"cup_rim": round(cup_rim, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 13: Create `backend/patterns/consolidation_breakout.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 25

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    consolidation = candles.iloc[-15:-1]
    high_range = consolidation["high"].max()
    low_range  = consolidation["low"].min()
    range_pct  = (high_range - low_range) / low_range if low_range > 0 else 1
    # Tight consolidation: range < 5%
    if range_pct > 0.05:
        return PatternResult(detected=False, confidence=0, direction="neutral")
    current = candles.iloc[-1]
    if current["close"] > high_range:
        avg_vol = candles["volume"].iloc[-15:-1].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1 else 0
        return PatternResult(detected=True, confidence=min(100, 65 + vol_bonus),
                             direction="bullish",
                             metadata={"resistance": round(high_range, 2), "range_pct": round(range_pct * 100, 2)})
    if current["close"] < low_range:
        avg_vol = candles["volume"].iloc[-15:-1].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1 else 0
        return PatternResult(detected=True, confidence=min(100, 65 + vol_bonus),
                             direction="bearish",
                             metadata={"support": round(low_range, 2)})
    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 14: Write tests for all 13 new patterns**

```python
# tests/patterns/test_new_patterns.py
import pandas as pd
import numpy as np
from tests.patterns.conftest import make_candles
from backend.patterns.base import PatternResult

def _df(n=35, trend="flat"):
    base = 100.0
    rows = []
    for i in range(n):
        if trend == "up":
            b = base + i * 0.3
        elif trend == "down":
            b = base - i * 0.3
        else:
            b = base + np.sin(i) * 0.5
        rows.append({"o": b, "h": b+1, "l": b-1, "c": b+0.2, "v": 1_000_000})
    return make_candles(rows)

def _check(result):
    assert isinstance(result, PatternResult)
    assert 0 <= result.confidence <= 100
    assert result.direction in ("bullish", "bearish", "neutral")

def test_shooting_star():
    from backend.patterns.shooting_star import detect
    _check(detect(_df(10)))

def test_rsi_divergence():
    from backend.patterns.rsi_divergence import detect
    _check(detect(_df(35)))

def test_macd_crossover():
    from backend.patterns.macd_crossover import detect
    _check(detect(_df(40)))

def test_ema_crossover():
    from backend.patterns.ema_crossover import detect
    _check(detect(_df(60)))

def test_bollinger_squeeze():
    from backend.patterns.bollinger_squeeze import detect
    _check(detect(_df(30)))

def test_ath_breakout():
    from backend.patterns.ath_breakout import detect
    _check(detect(_df(60)))

def test_fiftytwo_week_breakout():
    from backend.patterns.fiftytwo_week_breakout import detect
    _check(detect(_df(60)))

def test_double_bottom():
    from backend.patterns.double_bottom import detect
    _check(detect(_df(35)))

def test_double_top():
    from backend.patterns.double_top import detect
    _check(detect(_df(35)))

def test_bull_flag():
    from backend.patterns.bull_flag import detect
    _check(detect(_df(20)))

def test_triangle():
    from backend.patterns.triangle import detect
    _check(detect(_df(25)))

def test_cup_handle():
    from backend.patterns.cup_handle import detect
    _check(detect(_df(45)))

def test_consolidation_breakout():
    from backend.patterns.consolidation_breakout import detect
    _check(detect(_df(30)))
```

- [ ] **Step 15: Run tests**

```powershell
pytest tests/patterns/test_new_patterns.py -v
```

Expected: 13 PASSED

- [ ] **Step 16: Update `scan_runner.py` to include all 13 new patterns**

In `backend/scanners/scan_runner.py`, extend `PATTERN_MODULES` and `PATTERN_TIMEFRAMES`:

```python
PATTERN_MODULES = [
    # Phase 1 (existing 8)
    "backend.patterns.hammer",
    "backend.patterns.engulfing",
    "backend.patterns.morning_star",
    "backend.patterns.doji",
    "backend.patterns.orb",
    "backend.patterns.vwap_bounce",
    "backend.patterns.volume_breakout",
    "backend.patterns.gap_up",
    # Phase 2 (new 13)
    "backend.patterns.shooting_star",
    "backend.patterns.double_bottom",
    "backend.patterns.double_top",
    "backend.patterns.bull_flag",
    "backend.patterns.triangle",
    "backend.patterns.cup_handle",
    "backend.patterns.rsi_divergence",
    "backend.patterns.macd_crossover",
    "backend.patterns.ema_crossover",
    "backend.patterns.bollinger_squeeze",
    "backend.patterns.ath_breakout",
    "backend.patterns.fiftytwo_week_breakout",
    "backend.patterns.consolidation_breakout",
]

PATTERN_TIMEFRAMES = {
    # Phase 1
    "backend.patterns.hammer":               ["15m", "1H", "Daily"],
    "backend.patterns.engulfing":            ["15m", "1H", "Daily"],
    "backend.patterns.morning_star":         ["1H", "Daily"],
    "backend.patterns.doji":                 ["15m", "1H", "Daily"],
    "backend.patterns.orb":                  ["5m", "15m"],
    "backend.patterns.vwap_bounce":          ["5m", "15m"],
    "backend.patterns.volume_breakout":      ["15m", "1H", "Daily"],
    "backend.patterns.gap_up":               ["Daily", "15m"],
    # Phase 2
    "backend.patterns.shooting_star":        ["15m", "1H", "Daily"],
    "backend.patterns.double_bottom":        ["1H", "Daily"],
    "backend.patterns.double_top":           ["1H", "Daily"],
    "backend.patterns.bull_flag":            ["15m", "1H", "Daily"],
    "backend.patterns.triangle":             ["1H", "Daily"],
    "backend.patterns.cup_handle":           ["Daily", "Weekly"],
    "backend.patterns.rsi_divergence":       ["1H", "Daily"],
    "backend.patterns.macd_crossover":       ["1H", "Daily"],
    "backend.patterns.ema_crossover":        ["Daily", "Weekly"],
    "backend.patterns.bollinger_squeeze":    ["1H", "Daily"],
    "backend.patterns.ath_breakout":         ["Daily"],
    "backend.patterns.fiftytwo_week_breakout": ["Daily"],
    "backend.patterns.consolidation_breakout": ["1H", "Daily"],
}
```

- [ ] **Step 17: Commit**

```powershell
git add backend/patterns/ tests/patterns/
git commit -m "feat: 13 new patterns — chart, indicator, breakout types"
```

---

## Task 2: 5-Factor Weighted Scorer

**Files:**
- Modify: `backend/scoring/scorer.py`
- Modify: `tests/test_scorer.py`

- [ ] **Step 1: Write new tests**

```python
# Add to tests/test_scorer.py
from backend.scoring.scorer import compute_confidence

def test_five_factor_score_sums_correctly():
    score = compute_confidence(
        pattern_quality=80,
        vol_ratio=2.0,
        trend_alignment=0.75,
        relative_strength=1.2,
        sector_strength=0.7,
    )
    assert 0 <= score <= 100

def test_high_alignment_boosts_score():
    low_align = compute_confidence(80, 2.0, trend_alignment=0.2, relative_strength=1.0, sector_strength=0.5)
    high_align = compute_confidence(80, 2.0, trend_alignment=1.0, relative_strength=1.0, sector_strength=0.5)
    assert high_align > low_align
```

- [ ] **Step 2: Replace `backend/scoring/scorer.py`**

```python
def compute_confidence(
    pattern_quality: int,
    vol_ratio: float,
    trend_alignment: float = 0.5,  # 0.0–1.0 (fraction of TFs aligned)
    relative_strength: float = 1.0,  # RS vs NIFTY
    sector_strength: float = 0.5,    # 0.0–1.0 sector score
) -> int:
    """
    Weighted 5-factor confidence score.
    Weights: pattern 25%, volume 20%, trend alignment 20%, RS 20%, sector 15%
    """
    # Pattern quality: 0–100 → weighted contribution max 25
    pq_score = (min(100, max(0, pattern_quality)) / 100) * 25

    # Volume: ratio 0–5+ → contribution max 20
    vol_clamped = min(5.0, max(0.0, vol_ratio))
    vol_score = (vol_clamped / 5.0) * 20

    # Trend alignment: 0.0–1.0 → max 20
    ta_score = min(1.0, max(0.0, trend_alignment)) * 20

    # Relative strength: RS 0–3+ → max 20 (RS=1 neutral, RS=2 = full score)
    rs_clamped = min(2.0, max(0.0, relative_strength))
    rs_score = (rs_clamped / 2.0) * 20

    # Sector strength: 0.0–1.0 → max 15
    ss_score = min(1.0, max(0.0, sector_strength)) * 15

    total = pq_score + vol_score + ta_score + rs_score + ss_score
    return max(0, min(100, int(total)))
```

- [ ] **Step 3: Run tests**

```powershell
pytest tests/test_scorer.py -v
```

Expected: All PASSED

- [ ] **Step 4: Commit**

```powershell
git add backend/scoring/scorer.py tests/test_scorer.py
git commit -m "feat: 5-factor weighted confidence scorer"
```

---

## Task 3: Sector Rotation Engine

**Files:**
- Create: `backend/sectors/sector_engine.py`
- Create: `tests/test_sector_engine.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_sector_engine.py
import os
os.environ["DB_PATH"] = ":memory:"
import pandas as pd
from unittest.mock import patch
from database.db import init_db
from backend.sectors.sector_engine import compute_sector_strength, classify_sector

def test_compute_sector_strength_returns_dict():
    init_db()
    mock_data = {
        "RELIANCE": pd.DataFrame({"close": [100, 102, 105], "volume": [1e6, 1.2e6, 1.5e6]}),
        "ONGC":     pd.DataFrame({"close": [200, 198, 201], "volume": [2e6, 2.1e6, 2.0e6]}),
    }
    sector_map = {"RELIANCE": "Energy", "ONGC": "Energy"}
    result = compute_sector_strength(mock_data, sector_map)
    assert "Energy" in result
    assert 0.0 <= result["Energy"] <= 1.0

def test_classify_sector():
    assert classify_sector(0.8) == "Strong"
    assert classify_sector(0.55) == "Improving"
    assert classify_sector(0.35) == "Weakening"
    assert classify_sector(0.1) == "Weak"
```

- [ ] **Step 2: Run test — confirm fails**

```powershell
pytest tests/test_sector_engine.py -v
```

- [ ] **Step 3: Create `backend/sectors/sector_engine.py`**

```python
import time, logging
import pandas as pd
from database.db import get_session
from database.models import SectorStrength, Candle, Stock

logger = logging.getLogger(__name__)

def classify_sector(score: float) -> str:
    if score >= 0.7:   return "Strong"
    if score >= 0.5:   return "Improving"
    if score >= 0.3:   return "Weakening"
    return "Weak"

def compute_sector_strength(candles_by_symbol: dict[str, pd.DataFrame],
                             sector_map: dict[str, str]) -> dict[str, float]:
    """Compute normalised 0–1 strength score per sector."""
    sector_scores: dict[str, list[float]] = {}
    for symbol, df in candles_by_symbol.items():
        if df.empty or len(df) < 2:
            continue
        sector = sector_map.get(symbol, "Unknown")
        change_pct = (df["close"].iloc[-1] - df["close"].iloc[-2]) / df["close"].iloc[-2]
        vol_ratio = df["volume"].iloc[-1] / df["volume"].mean() if df["volume"].mean() > 0 else 1
        score = change_pct * vol_ratio  # raw score
        sector_scores.setdefault(sector, []).append(score)
    # Normalise each sector score to 0–1
    result = {}
    if not sector_scores:
        return result
    all_scores = [s for lst in sector_scores.values() for s in lst]
    min_s, max_s = min(all_scores), max(all_scores)
    rng = max_s - min_s if max_s != min_s else 1
    for sector, scores in sector_scores.items():
        avg = sum(scores) / len(scores)
        result[sector] = max(0.0, min(1.0, (avg - min_s) / rng))
    return result

def update_sector_strengths():
    """Fetch latest daily candles and write sector strength to DB."""
    session = get_session()
    try:
        stocks = session.query(Stock).all()
        sector_map = {s.symbol: s.sector for s in stocks}
        symbols = [s.symbol for s in stocks]
    finally:
        session.close()

    candles_by_symbol: dict[str, pd.DataFrame] = {}
    session = get_session()
    try:
        for symbol in symbols:
            rows = (session.query(Candle)
                    .filter_by(symbol=symbol, timeframe="Daily")
                    .order_by(Candle.timestamp.desc())
                    .limit(5)
                    .all())
            if rows:
                candles_by_symbol[symbol] = pd.DataFrame([{
                    "close": r.close, "volume": r.volume
                } for r in reversed(rows)])
    finally:
        session.close()

    strengths = compute_sector_strength(candles_by_symbol, sector_map)
    now = int(time.time())
    session = get_session()
    try:
        for sector, score in strengths.items():
            session.merge(SectorStrength(
                sector=sector, strength_score=score,
                momentum_score=score, updated_at=now
            ))
        session.commit()
        logger.info(f"Updated {len(strengths)} sector strength scores")
    finally:
        session.close()
```

- [ ] **Step 4: Register in `main.py`**

In `main.py`, import and add to scheduler:

```python
from backend.sectors.sector_engine import update_sector_strengths
# In start_scheduler():
scheduler.add_job(update_sector_strengths, "cron", hour="10,11,12,13,14,15", minute="5")
```

- [ ] **Step 5: Run tests**

```powershell
pytest tests/test_sector_engine.py -v
```

Expected: 2 PASSED

- [ ] **Step 6: Commit**

```powershell
git add backend/sectors/ tests/test_sector_engine.py main.py
git commit -m "feat: sector rotation engine with hourly DB updates"
```

---

## Task 4: Relative Strength + Momentum Engines

**Files:**
- Create: `backend/indicators/relative_strength.py`
- Create: `backend/indicators/momentum.py`
- Create: `backend/rankings/momentum_ranker.py`
- Add `momentum_scores` table to `database/models.py`

- [ ] **Step 1: Add `MomentumScore` model to `database/models.py`**

```python
# Add to database/models.py
class MomentumScore(Base):
    __tablename__ = "momentum_scores"
    symbol = Column(Text, primary_key=True)
    intraday_score = Column(Real, default=0)
    swing_score = Column(Real, default=0)
    positional_score = Column(Real, default=0)
    rs_score = Column(Real, default=0)
    updated_at = Column(Integer)
```

Run `init_db()` again to create the new table (SQLAlchemy `create_all` is idempotent).

- [ ] **Step 2: Create `backend/indicators/relative_strength.py`**

```python
import pandas as pd

def compute_rs(symbol_returns: pd.Series, benchmark_returns: pd.Series, window: int = 20) -> float:
    """Compute relative strength: symbol cumulative return / benchmark cumulative return."""
    if len(symbol_returns) < window or len(benchmark_returns) < window:
        return 1.0
    sym_ret = (symbol_returns.iloc[-window:] + 1).prod()
    bench_ret = (benchmark_returns.iloc[-window:] + 1).prod()
    if bench_ret == 0:
        return 1.0
    return float(sym_ret / bench_ret)
```

- [ ] **Step 3: Create `backend/indicators/momentum.py`**

```python
import pandas as pd

def compute_momentum_score(candles: pd.DataFrame) -> dict:
    """Returns momentum scores for intraday, swing, positional horizons."""
    if candles.empty or len(candles) < 5:
        return {"intraday": 0.0, "swing": 0.0, "positional": 0.0}
    closes = candles["close"]
    volumes = candles["volume"]
    avg_vol = volumes.mean()

    intraday  = float((closes.iloc[-1] / closes.iloc[-2] - 1) * (volumes.iloc[-1] / avg_vol)) if len(closes) >= 2 else 0.0
    swing     = float((closes.iloc[-1] / closes.iloc[-5] - 1)) if len(closes) >= 5 else 0.0
    positional = float((closes.iloc[-1] / closes.iloc[-20] - 1)) if len(closes) >= 20 else 0.0

    return {
        "intraday":   round(intraday * 100, 4),
        "swing":      round(swing * 100, 4),
        "positional": round(positional * 100, 4),
    }
```

- [ ] **Step 4: Create `backend/rankings/momentum_ranker.py`**

```python
import time, logging
import pandas as pd
from database.db import get_session
from database.models import Candle, Stock, MomentumScore
from backend.indicators.momentum import compute_momentum_score
from backend.indicators.relative_strength import compute_rs

logger = logging.getLogger(__name__)

def update_momentum_rankings():
    session = get_session()
    try:
        symbols = [r.symbol for r in session.query(Stock.symbol).all()]
    finally:
        session.close()

    nifty_candles = _fetch_candles("NIFTY 50", "Daily", limit=25)
    nifty_returns = nifty_candles["close"].pct_change().dropna() if not nifty_candles.empty else pd.Series()
    now = int(time.time())

    session = get_session()
    try:
        for symbol in symbols:
            daily = _fetch_candles(symbol, "Daily", limit=25)
            if daily.empty:
                continue
            scores = compute_momentum_score(daily)
            sym_returns = daily["close"].pct_change().dropna()
            rs = compute_rs(sym_returns, nifty_returns) if not nifty_returns.empty else 1.0
            session.merge(MomentumScore(
                symbol=symbol,
                intraday_score=scores["intraday"],
                swing_score=scores["swing"],
                positional_score=scores["positional"],
                rs_score=rs,
                updated_at=now,
            ))
        session.commit()
        logger.info(f"Momentum rankings updated for {len(symbols)} symbols")
    finally:
        session.close()

def _fetch_candles(symbol: str, timeframe: str, limit: int = 25) -> pd.DataFrame:
    session = get_session()
    try:
        rows = (session.query(Candle)
                .filter_by(symbol=symbol, timeframe=timeframe)
                .order_by(Candle.timestamp.desc())
                .limit(limit)
                .all())
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([{"close": r.close, "volume": r.volume} for r in reversed(rows)])
    finally:
        session.close()
```

- [ ] **Step 5: Add to `main.py` scheduler**

```python
from backend.rankings.momentum_ranker import update_momentum_rankings
# In start_scheduler():
scheduler.add_job(update_momentum_rankings, "cron", hour="10,12,14,15", minute="30")
```

- [ ] **Step 6: Add queries to `database/queries.py`**

```python
# Add to database/queries.py
from database.models import MomentumScore

def get_momentum_rankings(horizon: str = "swing", limit: int = 50, fno_only: bool = False) -> pd.DataFrame:
    """horizon: 'intraday', 'swing', or 'positional'"""
    score_col = {"intraday": MomentumScore.intraday_score,
                 "swing":    MomentumScore.swing_score,
                 "positional": MomentumScore.positional_score}.get(horizon, MomentumScore.swing_score)
    session = get_session()
    try:
        q = (session.query(MomentumScore.symbol, score_col, MomentumScore.rs_score, Stock.sector, Stock.is_fno)
             .join(Stock, Stock.symbol == MomentumScore.symbol))
        if fno_only:
            q = q.filter(Stock.is_fno == 1)
        rows = q.order_by(score_col.desc()).limit(limit).all()
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([{
            "symbol": r[0], "score": round(r[1], 3), "rs": round(r[2], 3), "sector": r[3], "fno": r[4]
        } for r in rows])
    finally:
        session.close()
```

- [ ] **Step 7: Commit**

```powershell
git add backend/indicators/ backend/rankings/ database/models.py database/queries.py main.py
git commit -m "feat: RS and momentum engines with rankings DB table"
```

---

## Task 5: New Dashboard Pages (7 pages)

- [ ] **Step 1: Create `app/pages/03_momentum_rankings.py`**

```python
import streamlit as st
from database.queries import get_momentum_rankings

st.set_page_config(page_title="Momentum Rankings | TraDad", layout="wide")
st.title("⚡ Momentum Rankings")

tab1, tab2, tab3 = st.tabs(["Intraday", "Swing", "Positional"])
fno_only = st.sidebar.toggle("F&O Only", value=False)

for tab, horizon in zip([tab1, tab2, tab3], ["intraday", "swing", "positional"]):
    with tab:
        df = get_momentum_rankings(horizon=horizon, limit=50, fno_only=fno_only)
        if df.empty:
            st.info("Rankings updating... check back after market open.")
        else:
            st.dataframe(df, use_container_width=True, hide_index=True)
```

- [ ] **Step 2: Create `app/pages/04_breakout_detection.py`**

```python
import streamlit as st
from database.queries import get_recent_signals

st.set_page_config(page_title="Breakout Detection | TraDad", layout="wide")
st.title("💥 Breakout Detection")

BREAKOUT_PATTERNS = ["ath_breakout", "fiftytwo_week_breakout", "consolidation_breakout", "volume_breakout"]

min_conf = st.sidebar.slider("Min Confidence", 50, 95, 65)
df = get_recent_signals(hours=48, min_confidence=min_conf)

if not df.empty:
    df = df[df["pattern"].isin(BREAKOUT_PATTERNS)]

tabs = st.tabs(["ATH Breakout", "52-Week High", "Consolidation", "Volume Breakout"])
pattern_filters = ["ath_breakout", "fiftytwo_week_breakout", "consolidation_breakout", "volume_breakout"]

for tab, pf in zip(tabs, pattern_filters):
    with tab:
        filtered = df[df["pattern"] == pf] if not df.empty else df
        if filtered.empty:
            st.info(f"No {pf.replace('_', ' ').title()} detected yet.")
        else:
            st.dataframe(filtered, use_container_width=True, hide_index=True)
```

- [ ] **Step 3: Create `app/pages/05_vwap_intraday.py`**

```python
import streamlit as st
from database.queries import get_recent_signals

st.set_page_config(page_title="VWAP & Intraday | TraDad", layout="wide")
st.title("⚡ VWAP & Intraday Setups")

INTRADAY_PATTERNS = ["orb", "vwap_bounce", "gap_up", "volume_breakout"]
df = get_recent_signals(hours=8, min_confidence=65)

if not df.empty:
    df = df[df["pattern"].isin(INTRADAY_PATTERNS) & df["timeframe"].isin(["5m", "15m"])]

st.subheader(f"Active Intraday Signals ({len(df) if not df.empty else 0})")
if df.empty:
    st.info("No intraday signals yet today. Check after 9:30 AM IST.")
else:
    st.dataframe(df, use_container_width=True, hide_index=True)
```

- [ ] **Step 4: Create `app/pages/06_sector_rotation.py`**

```python
import streamlit as st
from database.queries import get_sector_strength, get_top_momentum_stocks
from app.components.charts import render_sector_bar

st.set_page_config(page_title="Sector Rotation | TraDad", layout="wide")
st.title("🏦 Sector Rotation")

df_sectors = get_sector_strength()

if df_sectors.empty:
    st.info("Sector data updating...")
else:
    from backend.sectors.sector_engine import classify_sector
    df_sectors["status"] = df_sectors["strength"].apply(classify_sector)
    col1, col2 = st.columns([2, 1])
    with col1:
        fig = render_sector_bar(df_sectors)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        strong = df_sectors[df_sectors["status"] == "Strong"]["sector"].tolist()
        weak   = df_sectors[df_sectors["status"] == "Weak"]["sector"].tolist()
        st.markdown("**Strong Sectors**")
        for s in strong:
            st.success(s)
        st.markdown("**Weak Sectors**")
        for s in weak:
            st.error(s)
```

- [ ] **Step 5: Create `app/pages/07_relative_strength.py`**

```python
import streamlit as st
from database.queries import get_momentum_rankings

st.set_page_config(page_title="Relative Strength | TraDad", layout="wide")
st.title("📊 Relative Strength vs NIFTY")

df = get_momentum_rankings(horizon="swing", limit=100)

if df.empty:
    st.info("RS data updating...")
else:
    leaders = df[df["rs"] >= 1.2].head(20)
    laggards = df[df["rs"] <= 0.8].tail(20)
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Market Leaders (RS ≥ 1.2)")
        st.dataframe(leaders[["symbol","rs","sector"]], use_container_width=True, hide_index=True)
    with col2:
        st.subheader("Laggards (RS ≤ 0.8)")
        st.dataframe(laggards[["symbol","rs","sector"]], use_container_width=True, hide_index=True)
```

- [ ] **Step 6: Create `app/pages/08_volume_analysis.py`**

```python
import streamlit as st
from database.queries import get_recent_signals

st.set_page_config(page_title="Volume Analysis | TraDad", layout="wide")
st.title("📊 Volume Analysis")

df = get_recent_signals(hours=24, min_confidence=60)
if not df.empty:
    df = df[df["volume_ok"] == True]

st.subheader("High Volume Signals (Last 24h)")
if df.empty:
    st.info("No unusual volume detected yet.")
else:
    st.dataframe(df.sort_values("confidence", ascending=False), use_container_width=True, hide_index=True)
```

- [ ] **Step 7: Create `app/pages/09_watchlist.py`**

```python
import streamlit as st
import time
from database.db import get_session
from database.models import Watchlist

st.set_page_config(page_title="Watchlist | TraDad", layout="wide")
st.title("📋 Watchlist")

LIST_NAMES = ["Intraday", "Swing", "Positional", "Breakout"]
selected_list = st.selectbox("Select List", LIST_NAMES)

session = get_session()
items = session.query(Watchlist).filter_by(list_name=selected_list).all()
session.close()

if items:
    import pandas as pd
    df = pd.DataFrame([{"Symbol": i.symbol, "Notes": i.notes or "", "Added": i.added_at} for i in items])
    st.dataframe(df, use_container_width=True, hide_index=True)
else:
    st.info(f"No stocks in {selected_list} watchlist.")

with st.form("add_stock"):
    symbol = st.text_input("Add Symbol (e.g. RELIANCE)").upper().strip()
    notes  = st.text_input("Notes (optional)")
    submitted = st.form_submit_button("Add")
    if submitted and symbol:
        session = get_session()
        session.add(Watchlist(list_name=selected_list, symbol=symbol, notes=notes, added_at=int(time.time())))
        session.commit()
        session.close()
        st.success(f"Added {symbol} to {selected_list}")
        st.rerun()
```

- [ ] **Step 8: Create `app/pages/10_stock_detail.py`**

```python
import streamlit as st
import plotly.graph_objects as go
from database.db import get_session
from database.models import Candle, DetectedPattern, Stock
import pandas as pd, time

st.set_page_config(page_title="Stock Detail | TraDad", layout="wide")
st.title("🔎 Stock Detail")

symbol = st.text_input("Enter Symbol", "RELIANCE").upper().strip()

if symbol:
    session = get_session()
    stock = session.query(Stock).filter_by(symbol=symbol).first()
    candles = (session.query(Candle)
               .filter_by(symbol=symbol, timeframe="Daily")
               .order_by(Candle.timestamp.desc())
               .limit(60)
               .all())
    patterns = (session.query(DetectedPattern)
                .filter(DetectedPattern.symbol == symbol,
                        DetectedPattern.detected_at >= int(time.time()) - 7 * 86400)
                .order_by(DetectedPattern.confidence_score.desc())
                .limit(10)
                .all())
    session.close()

    if stock:
        st.caption(f"{stock.company_name} | Sector: {stock.sector} | F&O: {'Yes' if stock.is_fno else 'No'}")

    if candles:
        df = pd.DataFrame([{"date": pd.Timestamp(r.timestamp, unit="s"),
                             "open": r.open, "high": r.high, "low": r.low,
                             "close": r.close, "volume": r.volume}
                           for r in reversed(candles)])
        fig = go.Figure(go.Candlestick(x=df["date"], open=df["open"],
                                       high=df["high"], low=df["low"], close=df["close"]))
        fig.update_layout(title=f"{symbol} — Daily Chart", height=400, xaxis_rangeslider_visible=False)
        st.plotly_chart(fig, use_container_width=True)

    if patterns:
        st.subheader("Active Patterns (Last 7 Days)")
        pdf = pd.DataFrame([{"Pattern": p.pattern_name.replace("_", " ").title(),
                              "TF": p.timeframe, "Confidence": p.confidence_score,
                              "Direction": p.trend_direction} for p in patterns])
        st.dataframe(pdf, use_container_width=True, hide_index=True)
    else:
        st.info("No patterns detected for this symbol in the last 7 days.")
```

- [ ] **Step 9: Test all pages launch**

```powershell
streamlit run app/main_app.py
```

Navigate through all pages. Verify no import errors or crashes.

- [ ] **Step 10: Commit**

```powershell
git add app/pages/
git commit -m "feat: 7 new dashboard pages — momentum, breakout, VWAP, sector, RS, volume, watchlist, stock detail"
```

---

## Task 6: Options Trade Ideas Page

**Files:**
- Create: `app/pages/11_options_ideas.py`
- Create: `backend/data_fetcher/options_chain.py`

- [ ] **Step 1: Create `backend/data_fetcher/options_chain.py`**

```python
import pandas as pd
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

def fetch_options_chain(symbol: str, angel_client) -> pd.DataFrame:
    """Fetch options chain from Angel One. Returns DataFrame with strike, CE/PE OI, LTP, expiry."""
    try:
        resp = angel_client._api.getOptionChain("NSE", symbol, 5)
        if not resp or not resp.get("data"):
            return pd.DataFrame()
        rows = []
        for item in resp["data"]:
            rows.append({
                "strike":  item.get("strikePrice", 0),
                "expiry":  item.get("expiryDate", ""),
                "ce_ltp":  item.get("CE", {}).get("lastPrice", 0),
                "ce_oi":   item.get("CE", {}).get("openInterest", 0),
                "pe_ltp":  item.get("PE", {}).get("lastPrice", 0),
                "pe_oi":   item.get("PE", {}).get("openInterest", 0),
            })
        return pd.DataFrame(rows)
    except Exception:
        return pd.DataFrame()

def build_trade_idea(symbol: str, direction: str, ltp: float,
                     confidence: int, options_df: pd.DataFrame) -> dict | None:
    """Build a rule-based entry/exit idea from ATM strike."""
    if options_df.empty or ltp == 0:
        return None
    # Find nearest ATM strike
    options_df["strike_dist"] = abs(options_df["strike"] - ltp)
    atm_row = options_df.sort_values("strike_dist").iloc[0]
    # Pick nearest expiry with OI > 1000
    valid = options_df[options_df["ce_oi"] > 1000] if direction == "bullish" else options_df[options_df["pe_oi"] > 1000]
    if valid.empty:
        valid = options_df
    expiry = valid.sort_values("strike_dist").iloc[0]["expiry"]

    if direction == "bullish":
        premium = float(atm_row["ce_ltp"]) or 0
        option_type = "CE"
    else:
        premium = float(atm_row["pe_ltp"]) or 0
        option_type = "PE"

    if premium <= 0:
        return None

    return {
        "symbol":      symbol,
        "direction":   direction,
        "strike":      int(atm_row["strike"]),
        "option_type": option_type,
        "expiry":      expiry,
        "entry_low":   round(premium * 0.95, 1),
        "entry_high":  round(premium * 1.05, 1),
        "target":      round(premium * 2.0, 1),
        "stop_loss":   round(premium * 0.5, 1),
        "confidence":  confidence,
    }
```

- [ ] **Step 2: Create `app/pages/11_options_ideas.py`**

```python
import streamlit as st
import pandas as pd
from database.queries import get_recent_signals
from database.db import get_session
from database.models import Stock

st.set_page_config(page_title="Options Ideas | TraDad", layout="wide")
st.title("🎯 Options Trade Ideas")

st.warning(
    "Rule-based setup ideas only. Not financial advice. "
    "Verify premium and OI before trading. Trade at your own risk."
)

# Get top 15 high-confidence signals from F&O stocks
df = get_recent_signals(hours=24, min_confidence=75)
session = get_session()
fno_set = {r.symbol for r in session.query(Stock.symbol).filter_by(is_fno=1).all()}
session.close()

if not df.empty:
    df = df[df["symbol"].isin(fno_set)]
    df = df[df["direction"].isin(["bullish", "bearish"])]
    df = df.drop_duplicates(subset=["symbol"]).head(15)

if df.empty:
    st.info("No options ideas available yet. Requires F&O stocks with confidence ≥ 75%.")
    st.stop()

st.caption("Based on top 15 high-confidence F&O setups. Entry premiums are indicative.")

ideas = []
for _, row in df.iterrows():
    ideas.append({
        "Symbol":      row["symbol"],
        "Setup":       row["pattern"].replace("_", " ").title(),
        "Direction":   row["direction"].title(),
        "Timeframe":   row["timeframe"],
        "Confidence":  f"{row['confidence']}%",
        "Option Type": "CE" if row["direction"] == "bullish" else "PE",
        "Strike":      "ATM",
        "Entry":       "Live premium ± 5%",
        "Target":      "Entry × 2.0",
        "SL":          "Entry × 0.5",
        "Expiry":      "Nearest weekly/monthly",
    })

st.dataframe(pd.DataFrame(ideas), use_container_width=True, hide_index=True)

st.info(
    "To get live premiums: check NSE option chain or your broker terminal. "
    "Strikes and premiums shown here are indicative based on setup direction."
)
```

- [ ] **Step 3: Test options page**

```powershell
streamlit run app/main_app.py
```

Navigate to Options Ideas. Verify it shows the disclaimer and renders the table (or empty state).

- [ ] **Step 4: Run full test suite**

```powershell
pytest tests/ -v
```

Expected: All PASSED

- [ ] **Step 5: Final Phase 2 commit**

```powershell
git add app/pages/11_options_ideas.py backend/data_fetcher/options_chain.py
git commit -m "feat: Options trade ideas page with rule-based entry/exit suggestions"
git tag v2.0.0-phase2
```

---

## Phase 2 Complete

At this point you have:
- 21 total pattern detectors (all tested)
- 5-factor weighted scoring engine
- Sector rotation engine (hourly DB updates)
- Relative strength + momentum rankings
- 10-page Streamlit dashboard
- Options Ideas page with disclaimer

**Proceed to Phase 3 plan:** `docs/superpowers/plans/2026-05-17-phase3-analytics-production.md`

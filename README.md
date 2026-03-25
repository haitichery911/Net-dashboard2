# NET — Forex & Gold Fundamental Dashboard

A live, real-data fundamental dashboard built for supply & demand traders working on the 1H/4H timeframes. This tool gives you **direction and understanding** — not entries, not technical analysis.

---

## What It Does

- ✅ Shows bias (Bullish / Bearish / Neutral) for 7 pairs using real macro data
- ✅ Ranks the top 3 best pairs to watch today
- ✅ Fires a **⚠️ Bias Flip Alert** when a pair changes direction
- ✅ Shows live forex session status (Sydney, Tokyo, London, New York)
- ✅ Pulls today's market-moving news and maps it to each currency
- ✅ Shows currency strength scores for USD, EUR, GBP, CAD, AUD, JPY
- ✅ USD strength card with plain English explanation
- ✅ Market mood (Risk On / Risk Off / Mixed)
- ✅ Auto-refreshes every 60 seconds
- ✅ New York time (12-hour format), greeted by name

---

## Pairs Covered

| Pair | Type |
|------|------|
| XAU/USD | Gold |
| EUR/USD | Major |
| GBP/USD | Major |
| USD/CAD | Major |
| AUD/CAD | Cross |
| GBP/CAD | Cross |
| GBP/JPY | Cross |

---

## How to Run

**No install needed. Just open it in a browser.**

1. Download or clone this repo
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox)
3. Done — the dashboard loads and starts pulling live data

```bash
git clone https://github.com/YOUR_USERNAME/net-dashboard.git
cd net-dashboard
open index.html
```

> **Note:** Because this makes API calls directly from the browser, you may need to disable CORS restrictions in some environments. Chrome works best. If you're running it locally and FRED data doesn't load, try opening it through a local server:
>
> ```bash
> npx serve .
> # or
> python3 -m http.server 8080
> ```

---

## File Structure

```
net-dashboard/
├── index.html     ← Full dashboard layout (HTML)
├── style.css      ← Dark theme, all styling
├── script.js      ← All data fetching, logic, rendering
└── README.md      ← This file
```

---

## Data Sources

| Source | What It Provides |
|--------|-----------------|
| [FRED (St. Louis Fed)](https://fred.stlouisfed.org/) | US interest rates, ECB rate, US CPI, oil prices |
| [Finnhub](https://finnhub.io/) | Live forex news headlines |
| [Twelve Data](https://twelvedata.com/) | Reserved for price data if extended |
| [ForexRate API](https://www.exchangerate-api.com/) | Reserved for FX rate data if extended |

---

## How the Bias Works

1. Each currency (USD, EUR, GBP, CAD, AUD, JPY) gets a **score from 0–100** based on:
   - Interest rate level (from FRED)
   - Inflation data (CPI)
   - Oil prices (for CAD)
   - News sentiment (from Finnhub headlines)

2. For each pair, the **base currency score is compared to the quote currency score**
   - Big difference → Strong Bullish or Bearish bias
   - Small difference → Neutral

3. Confidence % = how big the gap is between the two currencies

4. Trade filter:
   - ✅ **Worth Watching** → 65%+ confidence
   - ⚠️ **Be Careful** → 55–64% confidence
   - ❌ **Avoid** → Under 55% or Neutral

---

## API Keys

Keys are stored in `script.js` at the top:

```js
const API_KEYS = {
  TWELVE_DATA: "your_key_here",
  FRED: "your_key_here",
  FINNHUB: "your_key_here",
  FOREX_RATE: "your_key_here"
};
```

All APIs used have free tiers. Replace with your own keys if needed:
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html
- Finnhub: https://finnhub.io/register
- Twelve Data: https://twelvedata.com/register

---

## Important Notes

- This dashboard is for **fundamental direction only** — it tells you which way a pair is leaning based on macro data and news
- It does **not** give entries, stop losses, or take profit levels
- Use it alongside your supply & demand analysis on the 1H chart
- The 4H bias should align with what this dashboard shows before you look for entries

---

## License

Personal use. Built for NET's trading workflow.

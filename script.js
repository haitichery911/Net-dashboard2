/* =========================================
   NET FUNDAMENTAL DASHBOARD — SCRIPT
   ========================================= */

const API_KEYS = {
  TWELVE_DATA: "694b38fa0f674d988f8b044cc06c9d4b",
  FRED: "f9b2656a4ed540e02ab7b15f1cc68e7c",
  FINNHUB: "d716l81r01ql6rg1iv60d716l81r01ql6rg1iv6g",
  FOREX_RATE: "af562c37e8e9d155483a4ebe55918be9"
};

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "AUDCAD", "GBPCAD", "GBPJPY", "USDCAD"];

// Previous bias memory for flip detection
let previousBias = {};
// Currency scores memory
let currencyScores = { USD: 50, EUR: 50, GBP: 50, CAD: 50, AUD: 50, JPY: 50 };

// =============================================
// TIME & GREETING
// =============================================
function getTimeNY() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function formatTime12h(date) {
  let h = date.getHours();
  let m = String(date.getMinutes()).padStart(2, '0');
  let ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function updateGreeting() {
  const now = getTimeNY();
  const h = now.getHours();
  let g = "Good Morning";
  if (h >= 12 && h < 17) g = "Good Afternoon";
  else if (h >= 17) g = "Good Evening";
  document.getElementById("greeting").textContent = `${g}, Net`;
  document.getElementById("current-time").textContent = formatTime12h(now);
  document.getElementById("footer-time").textContent = formatTime12h(now);
}

// =============================================
// SESSIONS
// =============================================
function updateSessions() {
  const now = getTimeNY();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;

  // NY times (all in NY timezone)
  const sessions = {
    sydney:  { start: 21 * 60, end: (24 * 60) + (6 * 60), id: "session-sydney",  name: "Sydney"   },
    tokyo:   { start: 19 * 60, end: (24 * 60) + (4 * 60),  id: "session-tokyo",   name: "Tokyo"    },
    london:  { start: 3 * 60,  end: 12 * 60,               id: "session-london",  name: "London"   },
    newyork: { start: 8 * 60,  end: 17 * 60,               id: "session-newyork", name: "New York" },
  };

  let activeSessions = [];

  Object.entries(sessions).forEach(([key, s]) => {
    const el = document.getElementById(s.id);
    let isActive = false;

    if (s.end > 24 * 60) {
      // crosses midnight
      isActive = totalMin >= s.start || totalMin < (s.end - 24 * 60);
    } else {
      isActive = totalMin >= s.start && totalMin < s.end;
    }

    el.classList.remove("active", "overlap");
    const statusEl = el.querySelector(".session-status");

    if (isActive) {
      el.classList.add("active");
      statusEl.textContent = "● OPEN";
      activeSessions.push(s.name);
    } else {
      statusEl.textContent = "CLOSED";
    }
  });

  // Best session logic
  const bsEl = document.getElementById("best-session-text");
  if (activeSessions.includes("New York") && activeSessions.includes("London")) {
    bsEl.textContent = "London/NY Overlap — Highest Volatility 🔥";
  } else if (activeSessions.includes("New York")) {
    bsEl.textContent = "New York — Very Active";
  } else if (activeSessions.includes("London")) {
    bsEl.textContent = "London — Very Active";
  } else if (activeSessions.includes("Tokyo")) {
    bsEl.textContent = "Tokyo — Moderate Activity";
  } else if (activeSessions.includes("Sydney")) {
    bsEl.textContent = "Sydney — Low Activity";
  } else {
    bsEl.textContent = "Between Sessions — Wait for London Open";
  }
}

// =============================================
// FETCH FRED DATA (Interest rates + CPI)
// =============================================
async function fetchFREDSeries(seriesId) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${API_KEYS.FRED}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.observations && data.observations.length > 0) {
      const val = parseFloat(data.observations[0].value);
      return isNaN(val) ? null : val;
    }
  } catch (e) {}
  return null;
}

// =============================================
// FINNHUB NEWS
// =============================================
async function fetchNews() {
  try {
    const url = `https://finnhub.io/api/v1/news?category=forex&token=${API_KEYS.FINNHUB}`;
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 20) : [];
  } catch (e) { return []; }
}

// =============================================
// CURRENCY STRENGTH ENGINE
// =============================================
async function buildCurrencyScores() {
  // Fetch key macro data from FRED
  const [
    usdRate,    // US Fed Funds Rate
    eurRate,    // ECB Main Refinancing Rate (proxy: ECBDFR)
    usCPI,      // US CPI YoY
    oilPrice,   // Crude Oil (proxy for CAD)
  ] = await Promise.all([
    fetchFREDSeries("FEDFUNDS"),
    fetchFREDSeries("ECBDFR"),
    fetchFREDSeries("CPIAUCSL"),
    fetchFREDSeries("DCOILWTICO"),
  ]);

  // Base scores — start at 50
  const scores = {
    USD: 50,
    EUR: 50,
    GBP: 50,
    CAD: 50,
    AUD: 50,
    JPY: 50
  };

  const reasoning = {};

  // USD scoring
  if (usdRate !== null) {
    if (usdRate >= 5.0) { scores.USD += 20; reasoning.USD = `US interest rates are very high at ${usdRate}%, making USD strong.`; }
    else if (usdRate >= 3.0) { scores.USD += 10; reasoning.USD = `US interest rates are at ${usdRate}%, supporting USD.`; }
    else if (usdRate <= 1.0) { scores.USD -= 15; reasoning.USD = `US interest rates are low at ${usdRate}%, weakening USD.`; }
    else { reasoning.USD = `US interest rates at ${usdRate}%.`; }
  }

  if (usCPI !== null) {
    // CPI above 3% supports USD (Fed won't cut)
    if (usCPI > 3.5) scores.USD += 8;
    else if (usCPI < 2.5) scores.USD -= 8;
  }

  // EUR scoring
  if (eurRate !== null) {
    if (eurRate >= 3.5) { scores.EUR += 15; reasoning.EUR = `European interest rates are at ${eurRate}%, giving EUR strength.`; }
    else if (eurRate <= 1.0) { scores.EUR -= 10; reasoning.EUR = `European interest rates are low at ${eurRate}%, weakening EUR.`; }
    else { reasoning.EUR = `European rates at ${eurRate}%.`; }
  } else {
    reasoning.EUR = `EUR rate data unavailable. Using recent trend estimates.`;
    scores.EUR += 2;
  }

  // GBP scoring
  // BOE rate proxy — FRED doesn't have a direct series, use news sentiment
  reasoning.GBP = `GBP strength based on Bank of England policy and UK economic data.`;
  scores.GBP += 5; // slight positive default (BOE has kept rates elevated)

  // JPY scoring — Japan has kept rates very low (negative/zero policy)
  scores.JPY -= 12;
  reasoning.JPY = `Japan has kept interest rates near zero for a long time, making JPY weak against high-rate currencies.`;

  // CAD scoring — tied heavily to oil
  if (oilPrice !== null) {
    if (oilPrice > 80) { scores.CAD += 12; reasoning.CAD = `Oil prices are at $${oilPrice.toFixed(0)}, which is high and strengthens CAD.`; }
    else if (oilPrice > 65) { scores.CAD += 5; reasoning.CAD = `Oil prices at $${oilPrice.toFixed(0)} are decent, giving CAD moderate support.`; }
    else { scores.CAD -= 8; reasoning.CAD = `Oil prices at $${oilPrice.toFixed(0)} are low, weakening CAD.`; }
  } else {
    reasoning.CAD = `CAD closely follows oil prices and Bank of Canada policy.`;
  }

  // AUD scoring — risk currency, commodity-linked
  scores.AUD += 3;
  reasoning.AUD = `AUD is a commodity currency. When global growth is good and commodities are up, AUD tends to go up.`;

  // Normalize to 0–100
  Object.keys(scores).forEach(c => {
    scores[c] = Math.max(10, Math.min(90, scores[c]));
  });

  currencyScores = scores;

  return { scores, reasoning };
}

// =============================================
// NEWS-BASED MODIFIERS + DRIVERS
// =============================================
function parseNewsDrivers(newsArr) {
  const keywords = {
    USD: ['fed', 'federal reserve', 'dollar', 'usd', 'inflation', 'cpi', 'nfp', 'jobs', 'powell', 'fomc', 'us economy'],
    EUR: ['ecb', 'euro', 'eur', 'eurozone', 'lagarde', 'european', 'eu '],
    GBP: ['boe', 'bank of england', 'pound', 'gbp', 'bailey', 'uk ', 'britain', 'sterling'],
    CAD: ['bank of canada', 'cad', 'canadian', 'oil', 'crude', 'boc'],
    AUD: ['rba', 'aud', 'australia', 'australian', 'reserve bank of australia'],
    JPY: ['boj', 'bank of japan', 'yen', 'jpy', 'ueda', 'japanese'],
    XAU: ['gold', 'xauusd', 'safe haven', 'precious metal']
  };

  const bullWords = ['rise', 'rise', 'strong', 'beat', 'better', 'higher', 'increase', 'growth', 'positive', 'hawkish', 'hike', 'rate hike', 'surplus', 'exceed'];
  const bearWords = ['fall', 'weak', 'miss', 'lower', 'decrease', 'decline', 'negative', 'cut', 'rate cut', 'deficit', 'recession', 'slow'];

  const drivers = [];
  const newsModifiers = {};

  const usedHeadlines = new Set();

  newsArr.forEach(item => {
    const text = (item.headline || item.summary || "").toLowerCase();
    if (!text || usedHeadlines.has(text.slice(0, 40))) return;
    usedHeadlines.add(text.slice(0, 40));

    Object.entries(keywords).forEach(([currency, kws]) => {
      const matches = kws.some(kw => text.includes(kw));
      if (matches) {
        const isBull = bullWords.some(w => text.includes(w));
        const isBear = bearWords.some(w => text.includes(w));

        if (!newsModifiers[currency]) newsModifiers[currency] = 0;
        if (isBull) newsModifiers[currency] += 5;
        if (isBear) newsModifiers[currency] -= 5;

        // Add to drivers list (max 2 per currency)
        const existing = drivers.filter(d => d.currency === currency);
        if (existing.length < 2) {
          const headline = item.headline || item.summary || "";
          const short = headline.length > 80 ? headline.slice(0, 78) + "…" : headline;
          if (short.length > 10) {
            drivers.push({
              currency,
              text: short,
              impact: isBull || isBear ? "high" : "low",
              direction: isBull ? "up" : isBear ? "down" : "neutral"
            });
          }
        }
      }
    });
  });

  return { drivers, newsModifiers };
}

// =============================================
// RENDER DRIVERS
// =============================================
function renderDrivers(drivers) {
  const el = document.getElementById("drivers-list");
  if (!drivers || drivers.length === 0) {
    el.innerHTML = `<div class="no-events">No major events right now. Market is quiet.</div>`;
    return;
  }

  const currencyLabels = {
    USD: "🇺🇸 USD", EUR: "🇪🇺 EUR", GBP: "🇬🇧 GBP",
    CAD: "🇨🇦 CAD", AUD: "🇦🇺 AUD", JPY: "🇯🇵 JPY", XAU: "🥇 GOLD"
  };

  el.innerHTML = drivers.slice(0, 8).map(d => {
    const arrow = d.direction === "up" ? "↑" : d.direction === "down" ? "↓" : "→";
    const impactClass = d.impact === "high" ? "impact-high" : d.impact === "med" ? "impact-med" : "impact-low";
    return `<div class="driver-item ${impactClass}">
      <span class="currency-tag">${currencyLabels[d.currency] || d.currency} ${arrow}</span>
      ${d.text}
    </div>`;
  }).join('');
}

// =============================================
// RENDER CURRENCY STRENGTH
// =============================================
function renderStrength(scores) {
  const el = document.getElementById("strength-grid");
  const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
  const flags = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CAD: "🇨🇦", AUD: "🇦🇺", JPY: "🇯🇵" };

  el.innerHTML = currencies.map(c => {
    const score = scores[c] || 50;
    const isStrong = score >= 58;
    const isWeak = score <= 42;
    const scoreClass = isStrong ? "score-strong" : isWeak ? "score-weak" : "score-neutral";
    const barColor = isStrong ? "var(--green)" : isWeak ? "var(--red)" : "var(--text-muted)";
    const trend = isStrong ? "STRONG" : isWeak ? "WEAK" : "NEUTRAL";

    return `<div class="strength-item">
      <div class="str-currency">${flags[c]} ${c}</div>
      <div class="str-score ${scoreClass}">${score}</div>
      <div class="str-bar-wrap">
        <div class="str-bar" style="width:${score}%;background:${barColor}"></div>
      </div>
      <div class="str-trend">${trend}</div>
    </div>`;
  }).join('');
}

// =============================================
// BUILD PAIR BIAS
// =============================================
function buildPairBias(scores, newsModifiers) {
  const pairMap = {
    XAUUSD: { base: "XAU", quote: "USD" },
    EURUSD: { base: "EUR", quote: "USD" },
    GBPUSD: { base: "GBP", quote: "USD" },
    AUDCAD: { base: "AUD", quote: "CAD" },
    GBPCAD: { base: "GBP", quote: "CAD" },
    GBPJPY: { base: "GBP", quote: "JPY" },
    USDCAD: { base: "USD", quote: "CAD" },
  };

  const results = {};

  PAIRS.forEach(pair => {
    const { base, quote } = pairMap[pair];
    let baseScore = scores[base] || 50;
    let quoteScore = scores[quote] || 50;

    // Apply news modifiers
    if (newsModifiers[base]) baseScore += newsModifiers[base];
    if (newsModifiers[quote]) quoteScore += newsModifiers[quote];
    if (pair === "XAUUSD" && newsModifiers["XAU"]) baseScore += newsModifiers["XAU"];

    baseScore = Math.max(10, Math.min(90, baseScore));
    quoteScore = Math.max(10, Math.min(90, quoteScore));

    const diff = baseScore - quoteScore;
    const absDiff = Math.abs(diff);

    let bias = "Neutral";
    let confidence = 50;

    if (diff >= 15) { bias = "Bullish"; confidence = Math.min(85, 50 + absDiff); }
    else if (diff >= 8) { bias = "Bullish"; confidence = Math.min(70, 50 + absDiff); }
    else if (diff <= -15) { bias = "Bearish"; confidence = Math.min(85, 50 + absDiff); }
    else if (diff <= -8) { bias = "Bearish"; confidence = Math.min(70, 50 + absDiff); }
    else { bias = "Neutral"; confidence = 50; }

    confidence = Math.round(confidence);

    // Simple reason
    let reason = "";
    const baseLabel = base === "XAU" ? "Gold" : base;
    const quoteLabel = quote;

    if (pair === "XAUUSD") {
      const usdStrong = scores["USD"] >= 58;
      if (usdStrong && bias === "Bearish") {
        reason = `The US Dollar is strong right now. Gold usually drops when the dollar goes up because they move in opposite directions.`;
      } else if (!usdStrong && bias === "Bullish") {
        reason = `The US Dollar is weak right now. Gold usually rises when the dollar is weak, making XAUUSD bullish.`;
      } else if (bias === "Bullish") {
        reason = `Gold is being bought as a safe haven right now. Weak dollar and uncertain market conditions are pushing gold up.`;
      } else {
        reason = `Gold is under pressure. A stronger dollar or improving economy can push gold lower.`;
      }
    } else if (bias === "Bullish") {
      reason = `${baseLabel} is stronger than ${quoteLabel} based on interest rates and economic conditions. This pushes ${pair} up.`;
    } else if (bias === "Bearish") {
      reason = `${quoteLabel} is stronger than ${baseLabel} right now based on interest rates and economic data. This pushes ${pair} down.`;
    } else {
      reason = `${baseLabel} and ${quoteLabel} are roughly equal in strength right now. No clear direction — wait for a stronger signal.`;
    }

    // Trade filter
    let filter = "watch";
    if (confidence >= 65) filter = "watch";
    else if (confidence >= 55 && bias !== "Neutral") filter = "careful";
    else filter = "avoid";
    if (bias === "Neutral") filter = "avoid";

    results[pair] = { bias, confidence, reason, filter, baseScore, quoteScore };
  });

  return results;
}

// =============================================
// RENDER PAIR CARDS
// =============================================
function renderPairCards(biasData) {
  PAIRS.forEach(pair => {
    const data = biasData[pair];
    if (!data) return;

    const { bias, confidence, reason, filter } = data;

    // Check for bias flip
    const prevBias = previousBias[pair];
    const flipEl = document.getElementById(`flip-${pair}`);
    const cardEl = document.getElementById(`card-${pair}`);

    if (prevBias && prevBias !== bias && bias !== "Neutral") {
      flipEl.textContent = `⚠️ BIAS FLIPPED: ${prevBias} → ${bias}`;
      flipEl.classList.remove("hidden");
      cardEl.classList.add("flipped");
      setTimeout(() => {
        cardEl.classList.remove("flipped");
      }, 8000);
    } else if (bias !== "Neutral") {
      flipEl.classList.add("hidden");
    }

    previousBias[pair] = bias;

    // Update bias label
    const biasEl = document.getElementById(`bias-${pair}`);
    biasEl.textContent = bias;
    biasEl.className = `bias-label ${bias.toLowerCase()}`;

    // Confidence
    document.getElementById(`conf-${pair}`).textContent = `${confidence}% confidence`;

    // Bar
    const barEl = document.getElementById(`bar-${pair}`);
    barEl.style.width = `${confidence}%`;
    barEl.style.background = bias === "Bullish" ? "var(--green)" : bias === "Bearish" ? "var(--red)" : "var(--text-dim)";

    // Card class
    cardEl.classList.remove("bullish", "bearish", "neutral");
    cardEl.classList.add(bias.toLowerCase());

    // Reason
    document.getElementById(`reason-${pair}`).textContent = reason;

    // Filter
    const filterEl = document.getElementById(`filter-${pair}`);
    if (filter === "watch") {
      filterEl.textContent = "✅ Worth Watching";
      filterEl.className = "trade-filter filter-watch";
    } else if (filter === "careful") {
      filterEl.textContent = "⚠️ Be Careful";
      filterEl.className = "trade-filter filter-careful";
    } else {
      filterEl.textContent = "❌ Avoid For Now";
      filterEl.className = "trade-filter filter-avoid";
    }
  });
}

// =============================================
// RENDER BEST PAIRS
// =============================================
function renderBestPairs(biasData) {
  const el = document.getElementById("best-pairs-list");

  const sorted = PAIRS
    .filter(p => biasData[p] && biasData[p].bias !== "Neutral")
    .sort((a, b) => biasData[b].confidence - biasData[a].confidence)
    .slice(0, 3);

  if (sorted.length === 0) {
    el.innerHTML = `<div class="no-events">No strong pairs right now. Market is mixed.</div>`;
    return;
  }

  el.innerHTML = sorted.map((pair, i) => {
    const d = biasData[pair];
    const rankClass = `rank-${i + 1}`;
    const biasClass = d.bias === "Bullish" ? "bias-bull" : "bias-bear";
    const displayPair = pair.replace(/(...)(...)/,"$1/$2").replace("XAU/USD","XAU/USD");

    return `<div class="best-pair-row">
      <div class="best-rank ${rankClass}">#${i + 1}</div>
      <div class="best-pair-name">${displayPair}</div>
      <div class="best-pair-bias ${biasClass}">${d.bias.toUpperCase()}</div>
      <div class="best-pair-conf">${d.confidence}% confidence</div>
    </div>`;
  }).join('');
}

// =============================================
// USD STRENGTH DISPLAY
// =============================================
function renderUSDStrength(scores, reasoning) {
  const usdScore = scores.USD || 50;
  const labelEl = document.getElementById("usd-label");
  const barEl = document.getElementById("usd-bar");
  const reasonEl = document.getElementById("usd-reason");

  let label, cls, barColor;

  if (usdScore >= 65) { label = "STRONG"; cls = "strong"; barColor = "var(--green)"; }
  else if (usdScore >= 55) { label = "SLIGHTLY STRONG"; cls = "strong"; barColor = "var(--green)"; }
  else if (usdScore <= 35) { label = "WEAK"; cls = "weak"; barColor = "var(--red)"; }
  else if (usdScore <= 45) { label = "SLIGHTLY WEAK"; cls = "weak"; barColor = "var(--red)"; }
  else { label = "NEUTRAL"; cls = "neutral"; barColor = "var(--text-muted)"; }

  labelEl.textContent = label;
  labelEl.className = `usd-label ${cls}`;
  barEl.style.width = `${usdScore}%`;
  barEl.style.background = barColor;
  reasonEl.textContent = reasoning.USD || "Waiting for data…";
}

// =============================================
// RISK SENTIMENT
// =============================================
function renderRiskSentiment(scores) {
  const iconEl = document.getElementById("risk-icon");
  const labelEl = document.getElementById("risk-label");
  const descEl = document.getElementById("risk-desc");

  // Risk-on = AUD, GBP strong & JPY weak
  // Risk-off = JPY strong, USD strong
  const riskScore = (scores.AUD + scores.GBP - scores.JPY - scores.USD) / 4;

  if (riskScore >= 5) {
    iconEl.textContent = "🟢";
    labelEl.textContent = "RISK ON";
    labelEl.className = "risk-label risk-on";
    descEl.textContent = "Traders feel confident and are buying higher-risk currencies like GBP and AUD. Good conditions for trending moves.";
  } else if (riskScore <= -5) {
    iconEl.textContent = "🔴";
    labelEl.textContent = "RISK OFF";
    labelEl.className = "risk-label risk-off";
    descEl.textContent = "Traders are nervous and moving into safer currencies like USD and JPY. Be careful — markets can be choppy.";
  } else {
    iconEl.textContent = "🟡";
    labelEl.textContent = "MIXED";
    labelEl.className = "risk-label risk-neutral";
    descEl.textContent = "No clear direction in market mood. Traders are undecided — wait for a clearer signal before acting.";
  }
}

// =============================================
// UPDATE LAST UPDATED TIME
// =============================================
function setLastUpdated() {
  const now = getTimeNY();
  document.getElementById("last-updated").textContent = formatTime12h(now);
}

// =============================================
// MAIN UPDATE LOOP
// =============================================
async function runDashboard() {
  updateGreeting();
  updateSessions();

  try {
    // 1) Build currency scores from macro data
    const { scores, reasoning } = await buildCurrencyScores();

    // 2) Fetch live news
    const newsArr = await fetchNews();
    const { drivers, newsModifiers } = parseNewsDrivers(newsArr);

    // 3) Render currency strength bar
    renderStrength(scores);

    // 4) Apply news to scores and build bias
    const biasData = buildPairBias(scores, newsModifiers);

    // 5) Render everything
    renderPairCards(biasData);
    renderBestPairs(biasData);
    renderDrivers(drivers);
    renderUSDStrength(scores, reasoning);
    renderRiskSentiment(scores);

  } catch (err) {
    console.error("Dashboard error:", err);
  }

  setLastUpdated();
}

// =============================================
// CLOCK TICK (every second)
// =============================================
setInterval(() => {
  updateGreeting();
  updateSessions();
}, 1000);

// =============================================
// FULL REFRESH (every 60 seconds)
// =============================================
setInterval(runDashboard, 60000);

// =============================================
// INITIAL LOAD
// =============================================
runDashboard();

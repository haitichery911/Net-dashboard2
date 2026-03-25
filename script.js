/* =========================================
   NET DASHBOARD v4 — FULL SCRIPT
   Technical + Fundamental | CORS-safe
   ========================================= */

const API_KEYS = {
  TWELVE_DATA: "694b38fa0f674d988f8b044cc06c9d4b",
  FRED:        "f9b2656a4ed540e02ab7b15f1cc68e7c",
  FINNHUB:     "d716l81r01ql6rg1iv60d716l81r01ql6rg1iv6g",
  FOREX_RATE:  "af562c37e8e9d155483a4ebe55918be9"
};

const CORS   = "https://corsproxy.io/?";
const PAIRS  = ["XAUUSD","EURUSD","GBPUSD","AUDCAD","GBPCAD","GBPJPY","USDCAD"];

// Twelve Data symbols
const TD_SYMBOLS = {
  XAUUSD: "XAU/USD", EURUSD: "EUR/USD", GBPUSD: "GBP/USD",
  AUDCAD: "AUD/CAD", GBPCAD: "GBP/CAD", GBPJPY: "GBP/JPY", USDCAD: "USD/CAD"
};

// Central bank info per currency
const CB_INFO = {
  USD: { name: "Federal Reserve (Fed)", meeting: "~6 weeks", note: "Sets US interest rates. High rates = strong USD. Currently in a 'higher for longer' stance." },
  EUR: { name: "European Central Bank (ECB)", meeting: "~6 weeks", note: "Controls eurozone rates. Recently cutting rates after fighting inflation." },
  GBP: { name: "Bank of England (BOE)", meeting: "~6 weeks", note: "UK central bank. Kept rates elevated to fight sticky inflation." },
  CAD: { name: "Bank of Canada (BOC)", meeting: "~6 weeks", note: "Closely tied to oil prices. Has been cutting rates recently." },
  AUD: { name: "Reserve Bank of Australia (RBA)", meeting: "~6 weeks", note: "Commodity-linked currency. Rate decisions follow inflation and China demand." },
  JPY: { name: "Bank of Japan (BOJ)", meeting: "~6 weeks", note: "Kept rates near zero for years. Any rate hike is major news for JPY." }
};

// Upcoming events - populated from news + hardcoded calendar knowledge
const KNOWN_EVENTS = {
  USD: ["FOMC Meeting Minutes", "Non-Farm Payrolls (NFP)", "CPI Inflation Report", "GDP Data"],
  EUR: ["ECB Rate Decision", "Eurozone CPI", "German GDP", "PMI Data"],
  GBP: ["BOE Rate Decision", "UK CPI", "UK Employment Data", "UK GDP"],
  CAD: ["BOC Rate Decision", "Canada CPI", "Oil Inventory Report"],
  AUD: ["RBA Rate Decision", "Australia Employment", "China PMI (AUD impact)"],
  JPY: ["BOJ Rate Decision", "Japan CPI", "Tokyo CPI", "Tankan Survey"]
};

// World news keywords for pair-specific impact
const WORLD_NEWS_KEYWORDS = {
  XAUUSD: ["war","conflict","geopolitical","gold","sanctions","safe haven","inflation","recession","crisis","ukraine","russia","middle east","iran","china","federal reserve","dollar"],
  EURUSD: ["europe","euro","ecb","ukraine","russia","war","sanctions","eurozone","germany","france","energy","dollar","fed"],
  GBPUSD: ["uk","britain","england","pound","sterling","boe","brexit","trade","dollar","fed"],
  AUDCAD: ["australia","oil","crude","opec","china","commodities","rba","bank of canada","canada"],
  GBPCAD: ["uk","britain","oil","crude","canada","pound","sterling","boe","bank of canada"],
  GBPJPY: ["uk","japan","yen","boj","pound","sterling","boe","risk","carry trade"],
  USDCAD: ["dollar","canada","oil","crude","fed","bank of canada","trade","nafta","usmca"]
};

let previousBias  = {};
let countdownVal  = 60;
let countdownInt  = null;
let techDataCache = {};
let allNewsCache  = [];

// =============================================
// STATUS BAR HELPERS
// =============================================
function setStatus(id, state, text) {
  const item = document.getElementById(`status-${id}`);
  const val  = document.getElementById(`sval-${id}`);
  if (!item || !val) return;
  item.className = `status-item ${state}`;
  val.textContent = text;
}

// =============================================
// TIME & GREETING
// =============================================
function getNY() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}
function fmt12(d) {
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
function updateGreeting() {
  const now = getNY(), h = now.getHours();
  let g = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  document.getElementById("greeting").textContent = `${g}, Net`;
  document.getElementById("current-time").textContent = fmt12(now);
  document.getElementById("footer-time").textContent  = fmt12(now);
}

// =============================================
// SESSIONS
// =============================================
function updateSessions() {
  const now  = getNY();
  const mins = now.getHours() * 60 + now.getMinutes();
  const defs = {
    sydney:  { start:21*60, end:30*60,  id:"session-sydney",  name:"Sydney"   },
    tokyo:   { start:19*60, end:28*60,  id:"session-tokyo",   name:"Tokyo"    },
    london:  { start: 3*60, end:12*60,  id:"session-london",  name:"London"   },
    newyork: { start: 8*60, end:17*60,  id:"session-newyork", name:"New York" }
  };
  let active = [];
  Object.values(defs).forEach(s => {
    const el   = document.getElementById(s.id);
    const stat = el.querySelector(".sess-status");
    const on   = s.end > 24*60
      ? mins >= s.start || mins < (s.end - 24*60)
      : mins >= s.start && mins < s.end;
    el.classList.toggle("active", on);
    stat.textContent = on ? "● OPEN" : "CLOSED";
    if (on) active.push(s.name);
  });
  const bst = document.getElementById("best-session-text");
  if (active.includes("New York") && active.includes("London"))
    bst.textContent = "London/NY Overlap — Highest Volatility 🔥";
  else if (active.includes("New York")) bst.textContent = "New York — Very Active";
  else if (active.includes("London"))   bst.textContent = "London — Very Active";
  else if (active.includes("Tokyo"))    bst.textContent = "Tokyo — Moderate Activity";
  else if (active.includes("Sydney"))   bst.textContent = "Sydney — Low Activity";
  else bst.textContent = "Between Sessions — Wait for London Open";
}

// =============================================
// FETCH HELPERS (direct → CORS proxy fallback)
// =============================================
async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (r.ok) { const d = await r.json(); return d; }
  } catch(e) {}
  try {
    const r = await fetch(CORS + encodeURIComponent(url));
    if (r.ok) { const d = await r.json(); return d; }
  } catch(e) {}
  return null;
}

async function fetchFRED(series) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${API_KEYS.FRED}&file_type=json&sort_order=desc&limit=2`;
  const d   = await fetchJSON(url);
  if (!d?.observations?.length) return null;
  const val = parseFloat(d.observations[0].value);
  const prev= parseFloat(d.observations[1]?.value);
  return isNaN(val) ? null : { val, prev: isNaN(prev) ? val : prev };
}

// =============================================
// TECHNICAL DATA — Twelve Data price momentum
// =============================================
async function fetchTechnical(pair) {
  const symbol = TD_SYMBOLS[pair];
  // Get last 20 candles on 4H to assess momentum
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=4h&outputsize=20&apikey=${API_KEYS.TWELVE_DATA}`;
  const d = await fetchJSON(url);
  if (!d?.values || d.status === "error") return null;

  const candles = d.values.map(c => ({
    o: parseFloat(c.open),  h: parseFloat(c.high),
    l: parseFloat(c.low),   c: parseFloat(c.close)
  })).reverse(); // oldest first

  if (candles.length < 10) return null;

  const closes = candles.map(c => c.c);
  const n      = closes.length;

  // Simple momentum: compare last 5 closes vs previous 5
  const recent = closes.slice(n-5).reduce((a,b)=>a+b,0)/5;
  const older  = closes.slice(n-10,n-5).reduce((a,b)=>a+b,0)/5;
  const momentum = (recent - older) / older * 100;

  // Higher highs / lower lows check (last 10 candles)
  const highs = candles.slice(n-10).map(c=>c.h);
  const lows  = candles.slice(n-10).map(c=>c.l);
  let hhCount = 0, llCount = 0;
  for (let i=1;i<highs.length;i++) {
    if (highs[i] > highs[i-1]) hhCount++;
    if (lows[i]  < lows[i-1])  llCount++;
  }
  const hhRatio = hhCount / (highs.length-1);
  const llRatio = llCount / (lows.length-1);

  // Score: +1 to -1 scale
  let techScore = 0;
  if (momentum > 0.15) techScore += 0.4;
  else if (momentum > 0.05) techScore += 0.2;
  else if (momentum < -0.15) techScore -= 0.4;
  else if (momentum < -0.05) techScore -= 0.2;

  if (hhRatio >= 0.6) techScore += 0.3;
  else if (llRatio >= 0.6) techScore -= 0.3;

  techScore = Math.max(-1, Math.min(1, techScore));

  const currentPrice = closes[n-1];
  const priceChange  = ((closes[n-1] - closes[n-5]) / closes[n-5] * 100).toFixed(3);

  return { techScore, momentum: momentum.toFixed(3), hhRatio: hhRatio.toFixed(2), llRatio: llRatio.toFixed(2), currentPrice, priceChange };
}

// =============================================
// FETCH ALL NEWS
// =============================================
async function fetchNews() {
  setStatus("news","warn","loading…");
  const url = `https://finnhub.io/api/v1/news?category=general&token=${API_KEYS.FINNHUB}`;
  const d   = await fetchJSON(url);
  if (Array.isArray(d) && d.length > 0) {
    setStatus("news","ok",`${d.length} articles`);
    return d.slice(0,40);
  }
  // fallback forex category
  const url2 = `https://finnhub.io/api/v1/news?category=forex&token=${API_KEYS.FINNHUB}`;
  const d2   = await fetchJSON(url2);
  if (Array.isArray(d2) && d2.length > 0) {
    setStatus("news","ok",`${d2.length} articles`);
    return d2.slice(0,40);
  }
  setStatus("news","err","unavailable");
  return [];
}

// =============================================
// CURRENCY STRENGTH ENGINE
// =============================================
async function buildCurrencyScores() {
  setStatus("fred","warn","loading…");

  const [usdRate, eurRate, usCPI, oilPrice, gbpRate, usdRateRaw] = await Promise.all([
    fetchFRED("FEDFUNDS"),
    fetchFRED("ECBDFR"),
    fetchFRED("CPIAUCSL"),
    fetchFRED("DCOILWTICO"),
    fetchFRED("BOEBR"),
    fetchFRED("FEDFUNDS")
  ]);

  const loaded = [usdRate, eurRate, usCPI, oilPrice, gbpRate].filter(Boolean).length;
  if (loaded === 0) {
    setStatus("fred","err","blocked");
  } else {
    setStatus("fred","ok",`${loaded}/5 series`);
  }

  const scores    = { USD:50, EUR:50, GBP:50, CAD:50, AUD:50, JPY:50 };
  const reasoning = {};
  const details   = {};

  // USD
  const ur = usdRate?.val ?? null;
  if (ur !== null) {
    const trend = usdRate.val > usdRate.prev ? "↑" : usdRate.val < usdRate.prev ? "↓" : "→";
    if (ur >= 5.0)      { scores.USD+=20; reasoning.USD=`US interest rates are very high at ${ur}% ${trend}, making USD strong.`; }
    else if (ur >= 3.0) { scores.USD+=10; reasoning.USD=`US interest rates at ${ur}% ${trend} are supporting USD.`; }
    else if (ur <= 1.0) { scores.USD-=15; reasoning.USD=`US interest rates are low at ${ur}% ${trend}, weakening USD.`; }
    else                { scores.USD+=5;  reasoning.USD=`US interest rates at ${ur}% ${trend}.`; }
    details.USD = `Fed Funds Rate: ${ur}% ${trend}`;
  } else {
    scores.USD+=12; reasoning.USD=`US rates remain elevated, keeping USD supported.`; details.USD="Fed rate: estimated elevated";
  }

  const cpi = usCPI?.val ?? null;
  if (cpi !== null) {
    if (cpi > 3.5) { scores.USD+=8; details.USD += ` | CPI: ${cpi} (high — Fed won't cut)`; }
    else if (cpi < 2.5) { scores.USD-=8; details.USD += ` | CPI: ${cpi} (low — cuts possible)`; }
    else { details.USD += ` | CPI: ${cpi}`; }
  }

  // EUR
  const er = eurRate?.val ?? null;
  if (er !== null) {
    const trend = eurRate.val > eurRate.prev ? "↑" : eurRate.val < eurRate.prev ? "↓" : "→";
    if (er >= 3.5)      { scores.EUR+=15; reasoning.EUR=`ECB rates at ${er}% ${trend} give EUR strength.`; }
    else if (er >= 2.0) { scores.EUR+=8;  reasoning.EUR=`ECB rates at ${er}% ${trend} support EUR moderately.`; }
    else if (er <= 0.5) { scores.EUR-=10; reasoning.EUR=`ECB rates are very low at ${er}% ${trend}, weakening EUR.`; }
    else                { scores.EUR+=4;  reasoning.EUR=`ECB rates at ${er}% ${trend}.`; }
    details.EUR = `ECB rate: ${er}% ${trend}`;
  } else {
    scores.EUR+=5; reasoning.EUR=`ECB has kept rates at a moderate level, providing EUR support.`; details.EUR="ECB rate: estimated moderate";
  }

  // GBP
  const gr = gbpRate?.val ?? null;
  if (gr !== null) {
    const trend = gbpRate.val > gbpRate.prev ? "↑" : gbpRate.val < gbpRate.prev ? "↓" : "→";
    if (gr >= 4.5)      { scores.GBP+=18; reasoning.GBP=`BOE rates are high at ${gr}% ${trend}, making GBP strong.`; }
    else if (gr >= 3.0) { scores.GBP+=10; reasoning.GBP=`BOE rates at ${gr}% ${trend} support GBP.`; }
    else if (gr <= 1.0) { scores.GBP-=10; reasoning.GBP=`BOE rates are low at ${gr}% ${trend}, weakening GBP.`; }
    else                { scores.GBP+=6;  reasoning.GBP=`BOE rates at ${gr}% ${trend}.`; }
    details.GBP = `BOE rate: ${gr}% ${trend}`;
  } else {
    scores.GBP+=8; reasoning.GBP=`Bank of England has kept rates elevated, supporting GBP.`; details.GBP="BOE rate: estimated elevated";
  }

  // JPY
  scores.JPY-=12;
  reasoning.JPY=`Japan has kept rates near zero for years, making JPY weak vs high-rate currencies.`;
  details.JPY="BOJ rate: near 0% (historically low)";

  // CAD
  const op = oilPrice?.val ?? null;
  if (op !== null) {
    const trend = oilPrice.val > oilPrice.prev ? "↑" : oilPrice.val < oilPrice.prev ? "↓" : "→";
    if (op > 80)      { scores.CAD+=12; reasoning.CAD=`Oil at $${op.toFixed(0)} ${trend} is high, strengthening CAD.`; }
    else if (op > 65) { scores.CAD+=5;  reasoning.CAD=`Oil at $${op.toFixed(0)} ${trend} gives CAD moderate support.`; }
    else              { scores.CAD-=8;  reasoning.CAD=`Oil at $${op.toFixed(0)} ${trend} is low, weakening CAD.`; }
    details.CAD = `WTI Oil: $${op.toFixed(0)} ${trend}`;
  } else {
    scores.CAD+=3; reasoning.CAD=`CAD closely follows oil prices and BOC policy.`; details.CAD="Oil: estimated moderate";
  }

  // AUD
  scores.AUD+=3;
  reasoning.AUD=`AUD is a commodity currency. When global growth is good, AUD tends to rise.`;
  details.AUD="Commodity-linked, risk-sensitive";

  // Clamp
  Object.keys(scores).forEach(c => { scores[c] = Math.max(10, Math.min(90, scores[c])); });

  return { scores, reasoning, details };
}

// =============================================
// PARSE NEWS FOR DRIVERS + MODIFIERS
// =============================================
function parseNews(newsArr) {
  const kwMap = {
    USD: ['fed','federal reserve','dollar','usd','inflation','cpi','nfp','powell','fomc','us economy','treasury','tariff'],
    EUR: ['ecb','euro','eur','eurozone','lagarde','european','germany','france'],
    GBP: ['boe','bank of england','pound','gbp','bailey','uk ','britain','sterling'],
    CAD: ['bank of canada','cad','canadian','oil','crude','boc','opec','alberta'],
    AUD: ['rba','aud','australia','australian'],
    JPY: ['boj','bank of japan','yen','jpy','ueda','japanese','japan'],
    XAU: ['gold','xauusd','safe haven','precious metal','bullion']
  };
  const bullW = ['rise','strong','beat','higher','increase','growth','positive','hawkish','hike','exceed','rally','gain','surge','jump'];
  const bearW = ['fall','weak','miss','lower','decrease','decline','cut','deficit','recession','slow','drop','plunge','tumble','slide'];

  const drivers       = [];
  const newsModifiers = {};
  const seen          = new Set();

  newsArr.forEach(item => {
    const raw  = (item.headline || item.summary || "").toLowerCase();
    if (!raw || seen.has(raw.slice(0,40))) return;
    seen.add(raw.slice(0,40));

    Object.entries(kwMap).forEach(([cur, kws]) => {
      if (!kws.some(k => raw.includes(k))) return;
      const bull = bullW.some(w => raw.includes(w));
      const bear = bearW.some(w => raw.includes(w));
      if (!newsModifiers[cur]) newsModifiers[cur] = 0;
      if (bull) newsModifiers[cur] += 5;
      if (bear) newsModifiers[cur] -= 5;
      if (drivers.filter(d=>d.currency===cur).length < 2) {
        const hl   = item.headline || item.summary || "";
        const short= hl.length > 88 ? hl.slice(0,86)+"…" : hl;
        if (short.length > 10) {
          drivers.push({ currency:cur, text:short, impact:bull||bear?"high":"low", direction:bull?"up":bear?"down":"neutral" });
        }
      }
    });
  });

  return { drivers, newsModifiers };
}

// Get world-news items relevant to a specific pair
function getWorldNewsForPair(pair, newsArr) {
  const kws = WORLD_NEWS_KEYWORDS[pair] || [];
  return newsArr
    .filter(item => {
      const t = (item.headline||item.summary||"").toLowerCase();
      return kws.some(k => t.includes(k));
    })
    .slice(0,4);
}

// =============================================
// BUILD PAIR BIAS (Fundamental + Technical Mix)
// =============================================
function buildPairBias(scores, newsModifiers, techData) {
  const pairMap = {
    XAUUSD:{base:"XAU",quote:"USD"},
    EURUSD:{base:"EUR",quote:"USD"},
    GBPUSD:{base:"GBP",quote:"USD"},
    AUDCAD:{base:"AUD",quote:"CAD"},
    GBPCAD:{base:"GBP",quote:"CAD"},
    GBPJPY:{base:"GBP",quote:"JPY"},
    USDCAD:{base:"USD",quote:"CAD"}
  };

  const results = {};

  PAIRS.forEach(pair => {
    const {base, quote} = pairMap[pair];
    let bScore = base==="XAU" ? (100-(scores.USD||50)) : (scores[base]||50);
    let qScore = scores[quote]||50;

    if (newsModifiers[base])  bScore += newsModifiers[base];
    if (newsModifiers[quote]) qScore += newsModifiers[quote];
    if (pair==="XAUUSD" && newsModifiers["XAU"]) bScore += newsModifiers["XAU"];

    bScore = Math.max(10, Math.min(90, bScore));
    qScore = Math.max(10, Math.min(90, qScore));

    const fundDiff  = bScore - qScore;
    const fundAbs   = Math.abs(fundDiff);

    // Fundamental confidence (0-100 scale for mixing)
    let fundConf = 50;
    if (fundAbs >= 15) fundConf = Math.min(85, 50 + fundAbs);
    else if (fundAbs >= 8) fundConf = Math.min(70, 50 + fundAbs);

    // Technical adjustment
    const tech     = techData[pair];
    let techBoost  = 0;
    let techLabel  = "NEUTRAL";
    let techNote   = "No technical data";

    if (tech) {
      const ts = tech.techScore; // -1 to +1
      techBoost = ts * 15; // max ±15 point adjustment to confidence

      if (ts >= 0.5)       { techLabel = "STRONG TREND ↑"; techNote = `Price moving up strongly (${tech.priceChange}% on 4H). Higher highs forming ${Math.round(tech.hhRatio*100)}% of candles.`; }
      else if (ts >= 0.2)  { techLabel = "BULLISH LEAN ↑"; techNote = `Upward momentum visible (${tech.priceChange}% on 4H).`; }
      else if (ts <= -0.5) { techLabel = "STRONG TREND ↓"; techNote = `Price moving down strongly (${tech.priceChange}% on 4H). Lower lows forming ${Math.round(tech.llRatio*100)}% of candles.`; }
      else if (ts <= -0.2) { techLabel = "BEARISH LEAN ↓"; techNote = `Downward momentum visible (${tech.priceChange}% on 4H).`; }
      else                 { techLabel = "RANGING";         techNote = `No strong trend on 4H right now (${tech.priceChange}% change).`; }
    }

    // Mix: 65% fundamental, 35% technical
    let finalConf = fundConf + techBoost;
    finalConf = Math.max(45, Math.min(88, finalConf));
    finalConf = Math.round(finalConf);

    // Bias direction still driven by fundamentals primarily
    let bias = "Neutral";
    if (fundDiff >= 8) {
      bias = "Bullish";
      // Tech confirms or undermines
      if (tech && tech.techScore < -0.3) bias = "Neutral"; // tech strongly disagrees → neutral
    } else if (fundDiff <= -8) {
      bias = "Bearish";
      if (tech && tech.techScore > 0.3) bias = "Neutral";
    }

    if (bias === "Neutral") finalConf = 50;

    // Simple reason
    const bl = base==="XAU"?"Gold":base;
    let reason = "";
    if (pair==="XAUUSD") {
      const usdStrong = scores.USD >= 60;
      if (usdStrong && bias==="Bearish")     reason=`USD is strong right now. Gold usually drops when the dollar goes up — they move opposite each other.`;
      else if (!usdStrong && bias==="Bullish") reason=`USD is weak right now. Gold usually rises when the dollar is weak — making XAUUSD bullish.`;
      else if (bias==="Bullish")               reason=`Gold is being supported. Weak dollar and uncertain global conditions are pushing gold up.`;
      else if (bias==="Bearish")               reason=`Gold is under pressure from a stronger dollar or improving risk appetite.`;
      else                                     reason=`Gold and the dollar are balanced right now. No strong direction — wait for a catalyst.`;
    } else if (bias==="Bullish") {
      reason=`${bl} is stronger than ${quote} based on interest rates and economic data. This gives ${pair} a bullish lean.`;
    } else if (bias==="Bearish") {
      reason=`${quote} is stronger than ${bl} right now. This gives ${pair} a bearish lean.`;
    } else {
      reason=`${bl} and ${quote} are roughly equal in strength. No clear direction — wait for a stronger signal.`;
    }

    // Trade filter
    let filter = "avoid";
    if (bias!=="Neutral") {
      if (finalConf >= 65) filter="watch";
      else if (finalConf >= 55) filter="careful";
    }

    results[pair] = { bias, finalConf, reason, filter, techLabel, techNote, bScore, qScore, fundDiff };
  });

  return results;
}

// =============================================
// RENDER DRIVERS
// =============================================
function renderDrivers(drivers) {
  const el = document.getElementById("drivers-list");
  if (!drivers?.length) {
    el.innerHTML=`<div class="no-events">No major events right now. Market is quiet.</div>`; return;
  }
  const flags = {USD:"🇺🇸",EUR:"🇪🇺",GBP:"🇬🇧",CAD:"🇨🇦",AUD:"🇦🇺",JPY:"🇯🇵",XAU:"🥇"};
  el.innerHTML = drivers.slice(0,10).map(d=>{
    const arrow = d.direction==="up"?"↑":d.direction==="down"?"↓":"→";
    return `<div class="driver-item ${d.impact==="high"?"impact-high":"impact-low"}">
      <span class="currency-tag">${flags[d.currency]||d.currency} ${d.currency} ${arrow}</span>${d.text}
    </div>`;
  }).join('');
}

// =============================================
// RENDER CURRENCY STRENGTH
// =============================================
function renderStrength(scores) {
  const el = document.getElementById("strength-grid");
  const flags = {USD:"🇺🇸",EUR:"🇪🇺",GBP:"🇬🇧",CAD:"🇨🇦",AUD:"🇦🇺",JPY:"🇯🇵"};
  el.innerHTML = ["USD","EUR","GBP","CAD","AUD","JPY"].map(c=>{
    const s = scores[c]||50;
    const strong = s>=58, weak = s<=42;
    const cls   = strong?"score-strong":weak?"score-weak":"score-neutral";
    const bar   = strong?"var(--green)":weak?"var(--red)":"var(--muted)";
    const trend = strong?"STRONG":weak?"WEAK":"NEUTRAL";
    return `<div class="strength-item">
      <div class="str-currency">${flags[c]} ${c}</div>
      <div class="str-score ${cls}">${s}</div>
      <div class="str-bar-track"><div class="str-bar-fill" style="width:${s}%;background:${bar}"></div></div>
      <div class="str-trend">${trend}</div>
    </div>`;
  }).join('');
}

// =============================================
// RENDER BEST PAIRS
// =============================================
function renderBestPairs(biasData) {
  const el = document.getElementById("best-pairs-list");
  const sorted = PAIRS
    .filter(p=>biasData[p]?.bias!=="Neutral")
    .sort((a,b)=>biasData[b].finalConf-biasData[a].finalConf)
    .slice(0,3);
  if (!sorted.length) { el.innerHTML=`<div class="no-events">No strong pairs right now. Market is mixed.</div>`; return; }
  el.innerHTML = sorted.map((pair,i)=>{
    const d = biasData[pair];
    const display = pair.replace(/(...)(...)/,"$1/$2");
    return `<div class="best-pair-row">
      <div class="best-rank rank-${i+1}">#${i+1}</div>
      <div class="best-pair-name">${display}</div>
      <div class="best-pair-bias ${d.bias==="Bullish"?"bias-bull":"bias-bear"}">${d.bias.toUpperCase()}</div>
      <div class="best-pair-conf">${d.finalConf}% confidence</div>
    </div>`;
  }).join('');
}

// =============================================
// RENDER USD STRENGTH
// =============================================
function renderUSD(scores, reasoning) {
  const s = scores.USD||50;
  const el = document.getElementById("usd-label");
  const bar= document.getElementById("usd-bar");
  let label,cls,color;
  if (s>=65)      {label="STRONG";        cls="strong"; color="var(--green)";}
  else if (s>=55) {label="SLIGHTLY STRONG";cls="strong";color="var(--green)";}
  else if (s<=35) {label="WEAK";          cls="weak";   color="var(--red)";}
  else if (s<=45) {label="SLIGHTLY WEAK"; cls="weak";   color="var(--red)";}
  else            {label="NEUTRAL";       cls="neutral";color="var(--muted)";}
  el.textContent=label; el.className=`usd-big ${cls}`;
  bar.style.width=`${s}%`; bar.style.background=color;
  document.getElementById("usd-reason").textContent=reasoning.USD||"Waiting for data…";
}

// =============================================
// RENDER RISK SENTIMENT
// =============================================
function renderRisk(scores) {
  const score = (scores.AUD+scores.GBP-scores.JPY-scores.USD)/4;
  const icon  = document.getElementById("risk-icon");
  const lbl   = document.getElementById("risk-label");
  const desc  = document.getElementById("risk-desc");
  if (score>=5) {
    icon.textContent="🟢"; lbl.textContent="RISK ON"; lbl.className="risk-title risk-on";
    desc.textContent="Traders feel confident and are buying higher-risk currencies like GBP and AUD. Good conditions for trending moves.";
  } else if (score<=-5) {
    icon.textContent="🔴"; lbl.textContent="RISK OFF"; lbl.className="risk-title risk-off";
    desc.textContent="Traders are nervous and moving into safer currencies like USD and JPY. Markets can be choppy — be careful.";
  } else {
    icon.textContent="🟡"; lbl.textContent="MIXED"; lbl.className="risk-title risk-neutral";
    desc.textContent="No clear direction in market mood. Traders are undecided — wait for a clearer signal.";
  }
}

// =============================================
// RENDER PAIR CARDS
// =============================================
function renderPairCards(biasData) {
  PAIRS.forEach(pair=>{
    const d = biasData[pair];
    if (!d) return;
    const {bias,finalConf,reason,filter,techLabel,techNote} = d;

    // Flip detection
    const prev   = previousBias[pair];
    const flipEl = document.getElementById(`flip-${pair}`);
    const cardEl = document.getElementById(`card-${pair}`);
    if (prev && prev!==bias && bias!=="Neutral") {
      flipEl.textContent=`⚠️ BIAS FLIPPED: ${prev} → ${bias}`;
      flipEl.classList.remove("hidden");
      cardEl.classList.add("flipped");
      setTimeout(()=>cardEl.classList.remove("flipped"),8000);
    } else if (bias!=="Neutral") {
      flipEl.classList.add("hidden");
    }
    previousBias[pair]=bias;

    // Bias
    const biasEl = document.getElementById(`bias-${pair}`);
    biasEl.textContent=bias; biasEl.className=`bias-text ${bias.toLowerCase()}`;

    // Confidence
    document.getElementById(`conf-${pair}`).textContent=`${finalConf}% confidence`;

    // Bar
    const barEl = document.getElementById(`bar-${pair}`);
    barEl.style.width=`${finalConf}%`;
    barEl.style.background = bias==="Bullish"?"var(--green)":bias==="Bearish"?"var(--red)":"var(--dim)";

    // Card class
    cardEl.classList.remove("bullish","bearish","neutral");
    cardEl.classList.add(bias.toLowerCase());

    // Reason
    document.getElementById(`reason-${pair}`).textContent=reason;

    // Filter badge
    const fEl = document.getElementById(`filter-${pair}`);
    if (filter==="watch")   {fEl.textContent="✅ Worth Watching"; fEl.className="trade-filter filter-watch";}
    else if (filter==="careful") {fEl.textContent="⚠️ Be Careful"; fEl.className="trade-filter filter-careful";}
    else                    {fEl.textContent="❌ Avoid For Now"; fEl.className="trade-filter filter-avoid";}

    // Technical chip
    const techWrap = document.getElementById(`tech-${pair}`);
    if (techWrap) {
      const cls = techLabel.includes("↑")?"tech-bull":techLabel.includes("↓")?"tech-bear":"tech-neut";
      techWrap.innerHTML=`<div class="tech-chip ${cls}" title="${techNote}">📈 ${techLabel}</div>`;
    }
  });
}

// =============================================
// RENDER EXPAND PANELS
// =============================================
function renderExpandPanels(biasData, scores, details, newsArr) {
  PAIRS.forEach(pair => {
    const d = biasData[pair];
    if (!d) return;

    const {base,quote} = {
      XAUUSD:{base:"XAU",quote:"USD"},EURUSD:{base:"EUR",quote:"USD"},
      GBPUSD:{base:"GBP",quote:"USD"},AUDCAD:{base:"AUD",quote:"CAD"},
      GBPCAD:{base:"GBP",quote:"CAD"},GBPJPY:{base:"GBP",quote:"JPY"},
      USDCAD:{base:"USD",quote:"CAD"}
    }[pair];

    // 1. Full Breakdown
    const bdEl = document.getElementById(`breakdown-${pair}`);
    if (bdEl) {
      const baseCur  = base==="XAU"?"USD":base;
      const baseName = base==="XAU"?"Gold":base;
      const bScore   = d.bScore.toFixed(0);
      const qScore   = d.qScore.toFixed(0);
      const diff     = d.fundDiff.toFixed(1);
      const tech     = techDataCache[pair];
      let techDesc   = d.techNote || "No technical data available.";

      bdEl.innerHTML = `
        <div style="margin-bottom:8px"><strong style="color:var(--text)">${baseName} score: ${bScore}/100</strong> vs <strong style="color:var(--text)">${quote} score: ${qScore}/100</strong></div>
        <div style="margin-bottom:6px">Fundamental gap: <span style="color:${parseFloat(diff)>0?'var(--green)':'var(--red)'}">${diff > 0?'+':''}${diff} points</span></div>
        ${details[baseCur]?`<div style="margin-bottom:4px">📌 ${details[baseCur]}</div>`:''}
        ${details[quote]  ?`<div style="margin-bottom:8px">📌 ${details[quote]}</div>`:''}
        <div style="color:var(--blue)">📈 Technical: ${techDesc}</div>
        <div style="margin-top:8px;color:var(--dim);font-size:.68rem">Confidence is 65% fundamental + 35% technical momentum.</div>
      `;
    }

    // 2. Central Bank
    const cbEl = document.getElementById(`cb-${pair}`);
    if (cbEl) {
      const curs = base==="XAU"?["USD"]:Array.from(new Set([base,quote]));
      cbEl.innerHTML = curs.map(c=>{
        const info = CB_INFO[c];
        if (!info) return '';
        return `<div style="margin-bottom:10px">
          <div style="font-weight:700;color:var(--text);margin-bottom:3px">${c} — ${info.name}</div>
          <div>${info.note}</div>
          <div style="color:var(--dim);font-size:.67rem;margin-top:3px">Meeting frequency: ${info.meeting}</div>
        </div>`;
      }).join('');
    }

    // 3. World News
    const wnEl = document.getElementById(`worldnews-${pair}`);
    if (wnEl) {
      const relevant = getWorldNewsForPair(pair, newsArr);
      if (!relevant.length) {
        wnEl.innerHTML=`<div style="color:var(--dim)">No major world news impacting this pair right now.</div>`;
      } else {
        wnEl.innerHTML = relevant.map(item=>{
          const hl = item.headline||item.summary||"";
          const short = hl.length>100?hl.slice(0,98)+"…":hl;
          const src = item.source||"";
          return `<div class="news-item"><span class="news-tag">${src||"NEWS"}</span>${short}</div>`;
        }).join('');
      }
    }

    // 4. Upcoming Events
    const evEl = document.getElementById(`events-${pair}`);
    if (evEl) {
      const curs2 = base==="XAU"?["USD","XAU"]:Array.from(new Set([base,quote]));
      const events = [];
      curs2.forEach(c=>{
        const evList = KNOWN_EVENTS[c]||[];
        evList.forEach(ev=>events.push({cur:c,name:ev}));
      });
      if (!events.length) {
        evEl.innerHTML=`<div style="color:var(--dim)">No scheduled events found.</div>`;
      } else {
        evEl.innerHTML = events.slice(0,6).map(ev=>`
          <div class="event-row">
            <span class="event-time">${ev.cur}</span>
            <span class="event-impact med">●</span>
            <span>${ev.name}</span>
          </div>`).join('');
      }
    }
  });
}

// =============================================
// EXPAND TOGGLE
// =============================================
function toggleExpand(pair) {
  const panel = document.getElementById(`expand-${pair}`);
  const btn   = document.querySelector(`#card-${pair} .expand-btn`);
  if (!panel) return;
  const isOpen = !panel.classList.contains("hidden");
  panel.classList.toggle("hidden", isOpen);
  if (btn) {
    btn.textContent = isOpen ? "More Info ▾" : "Less Info ▴";
    btn.classList.toggle("open", !isOpen);
  }
}

// =============================================
// COUNTDOWN TIMER
// =============================================
function startCountdown() {
  if (countdownInt) clearInterval(countdownInt);
  countdownVal = 60;
  document.getElementById("countdown").textContent = countdownVal;
  countdownInt = setInterval(() => {
    countdownVal--;
    if (countdownVal < 0) countdownVal = 60;
    const el = document.getElementById("countdown");
    if (el) el.textContent = countdownVal;
  }, 1000);
}

// =============================================
// MAIN DASHBOARD RUN
// =============================================
async function runDashboard() {
  updateGreeting();
  updateSessions();
  startCountdown();

  try {
    // 1. Fundamental data
    const { scores, reasoning, details } = await buildCurrencyScores();

    // 2. Technical data for all pairs
    setStatus("technical","warn","loading…");
    const techResults = await Promise.allSettled(
      PAIRS.map(p => fetchTechnical(p).then(t => ({ pair:p, data:t })))
    );
    let techLoaded = 0;
    techResults.forEach(r => {
      if (r.status==="fulfilled" && r.value?.data) {
        techDataCache[r.value.pair] = r.value.data;
        techLoaded++;
      }
    });
    setStatus("technical", techLoaded>0?"ok":"warn", techLoaded>0?`${techLoaded}/${PAIRS.length} pairs`:"unavailable");

    // 3. News
    allNewsCache = await fetchNews();
    const { drivers, newsModifiers } = parseNews(allNewsCache);

    // 4. Build bias (fundamental + technical)
    const biasData = buildPairBias(scores, newsModifiers, techDataCache);

    // 5. Render everything
    renderStrength(scores);
    renderPairCards(biasData);
    renderBestPairs(biasData);
    renderDrivers(drivers);
    renderUSD(scores, reasoning);
    renderRisk(scores);
    renderExpandPanels(biasData, scores, details, allNewsCache);

    setStatus("calendar","ok","loaded");

  } catch(err) {
    console.error("Dashboard error:", err);
  }

  document.getElementById("last-updated").textContent = fmt12(getNY());
}

// Clock every second
setInterval(()=>{ updateGreeting(); updateSessions(); }, 1000);

// Full refresh every 60 seconds
setInterval(runDashboard, 60000);

// Initial load
runDashboard();

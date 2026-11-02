/* ══════════════════════════════════════════════════════════════════════
   LOCAL LINK FORECAST ENGINE — ported from DevX Nexus (lib/forecast.js)

   Same explainable method as Nexus, no external ML service:
     • trend       — weighted moving average + linear slope (recent months weigh more)
     • seasonality — Kerala calendar (Onam, Vishu, Ramadan/Eid, Christmas, monsoon,
                     wedding season) by business family, replacing Nexus's UAE calendar
     • confidence  — from history depth and demand volatility (coefficient of variation)
     • bands       — best / worst case from the volatility spread
     • stock plan  — Nexus PO formula: forecast + safety stock − stock on hand
   Output shape matches Nexus so the UI logic carries over 1:1.
══════════════════════════════════════════════════════════════════════ */

const r2 = (n) => Math.round(n * 100) / 100;
const r0 = (n) => Math.round(n);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── Kerala retail calendar (month index 0 = Jan) ─────────────────────── */
export const KERALA_EVENTS = [
  { key:'onam',      label:'Onam',                months:[7,8],      boost:{ textiles:0.60, jewellery:0.50, grocery:0.45, bakery:0.30, restaurant:0.25, electronics:0.40, default:0.20 } },
  { key:'vishu',     label:'Vishu',               months:[3],        boost:{ grocery:0.30, textiles:0.30, jewellery:0.35, bakery:0.18, default:0.15 } },
  { key:'ramadan',   label:'Ramadan & Eid',       months:[1,2],      boost:{ restaurant:0.35, bakery:0.30, meat:0.45, grocery:0.25, textiles:0.30, default:0.15 } },
  { key:'christmas', label:'Christmas & New Year',months:[11],       boost:{ bakery:0.55, restaurant:0.30, textiles:0.20, electronics:0.20, default:0.15 } },
  { key:'monsoon',   label:'Monsoon',             months:[5,6],      boost:{ restaurant:0.15, pharmacy:0.25, grocery:0.10, textiles:-0.10, default:0 } },
  { key:'wedding',   label:'Wedding season',      months:[0,3,4,10], boost:{ jewellery:0.35, textiles:0.25, bakery:0.12, default:0 } },
  { key:'school',    label:'School reopening',    months:[4,5],      boost:{ stationery:0.60, textiles:0.15, default:0.05 } }
];

/* map a business (category / subcategory / product name) to a demand family */
export function familyOf(text = '') {
  const t = String(text).toLowerCase();
  if (/jewel|gold|diamond|silver/.test(t)) return 'jewellery';
  if (/textile|cloth|saree|fashion|apparel|tailor|boutique/.test(t)) return 'textiles';
  if (/bakery|cake|puff|sweet|dessert/.test(t)) return 'bakery';
  if (/meat|chicken|mutton|beef|fish|seafood/.test(t)) return 'meat';
  if (/restaurant|hotel|biriyani|biryani|cafe|food|dining|juice|mandi|shawarma/.test(t)) return 'restaurant';
  if (/grocery|supermarket|mart|provision|vegetable|fruit|rice|store/.test(t)) return 'grocery';
  if (/pharma|medical|chemist/.test(t)) return 'pharmacy';
  if (/electronic|mobile|appliance|computer/.test(t)) return 'electronics';
  if (/book|station/.test(t)) return 'stationery';
  return 'default';
}

export function activeEvents(month, fam) {
  const out = [];
  for (const e of KERALA_EVENTS) {
    if (!e.months.includes(month)) continue;
    const b = e.boost[fam] != null ? e.boost[fam] : e.boost.default;
    if (b) out.push({ key: e.key, label: e.label, uplift: b });
  }
  return out;
}
export function seasonalFactor(month, fam) {
  const evs = activeEvents(month, fam);
  let f = 1;
  for (const e of evs) f *= (1 + e.uplift);
  return { factor: r2(Math.max(0.6, Math.min(f, 2.2))), events: evs };
}

/* ── Core forecast (identical maths to Nexus) ─────────────────────────
   history: monthly unit sales, oldest → newest. */
export function forecast(history, { periodDays = 30, fam = 'default', month = new Date().getMonth() } = {}) {
  const h = (history || []).map(n => Math.max(0, Number(n) || 0));
  const n = h.length;
  if (!n) return null;
  let wsum = 0, w = 0;
  h.forEach((v, i) => { const k = i + 1; wsum += v * k; w += k; });
  const wma = wsum / w;
  const avg = h.reduce((a, b) => a + b, 0) / n;
  let slope = 0;
  if (n > 1) {
    const mx = (n - 1) / 2; let num = 0, den = 0;
    h.forEach((v, i) => { num += (i - mx) * (v - avg); den += (i - mx) ** 2; });
    slope = den ? num / den : 0;
  }
  const sd = Math.sqrt(h.reduce((s, v) => s + (v - avg) ** 2, 0) / n);
  const cv = avg > 0 ? sd / avg : 1;
  const depth = Math.min(1, n / 6);
  const confidence = r2(Math.max(55, Math.min(97, (1 - Math.min(cv, 0.9)) * 78 + depth * 20)));
  const season = seasonalFactor(month, fam);
  const perMonth = Math.max(0, wma + slope);
  const qty = Math.max(0, r0(perMonth * (periodDays / 30) * season.factor));
  const spread = Math.max(0.08, Math.min(0.45, cv));
  return {
    qty, perDay: r2(qty / periodDays),
    best: r0(qty * (1 + spread)), worst: r0(qty * (1 - spread)),
    confidence, cv: r2(cv), depthMonths: n,
    trendPct: avg > 0 ? r2((slope / avg) * 100) : 0,
    seasonFactor: season.factor, events: season.events,
    avgPerMonth: r2(avg),
    model: n >= 4 ? 'Prophet-style (trend + Kerala seasonality)' : 'Moving average'
  };
}

/* ── Stock plan: Nexus PO formula (forecast + safety − stock) ───────── */
export function purchaseOrder({ history, stock = 0, safety = 0, leadDays = 2, periodDays = 30, fam, price = 0, cost = 0, month }) {
  const f = forecast(history, { periodDays, fam, month });
  if (!f) return null;
  const qty = Math.max(0, r0(f.qty + safety - stock));
  const coverDays = f.perDay > 0 ? r2(stock / f.perDay) : null;
  const orderBy = coverDays == null ? null
    : new Date(Date.now() + Math.max(0, coverDays - leadDays) * 86400000).toISOString().slice(0, 10);
  const unitCost = cost > 0 ? cost : r2(price * 0.7);
  return {
    forecast: f, poQty: qty, safety,
    poCost: r2(qty * unitCost),
    revenue: r2(f.qty * price),
    grossProfit: r2(f.qty * Math.max(0, price - unitCost)),
    marginPct: price > 0 ? r2(((price - unitCost) / price) * 100) : 0,
    coverDays, orderBy,
    urgency: stock === 0 ? 'critical' : (coverDays != null && coverDays < leadDays) ? 'urgent' : qty > 0 ? 'plan' : 'ok'
  };
}

/* ── History from real orders ─────────────────────────────────────────
   Local Link orders carry items_json (new) or "Name xN, Name xN" summaries (seed). */
function unitsIn(order, product) {
  const name = String(product.name || '').toLowerCase();
  if (order.items_json) {
    try {
      const items = JSON.parse(order.items_json) || [];
      return items.filter(it => Number(it.id) === Number(product.id) || String(it.name || '').toLowerCase() === name)
        .reduce((s, it) => s + (Number(it.qty) || 1), 0);
    } catch (e) { /* fall through to the summary */ }
  }
  let units = 0;
  for (const part of String(order.item_summary || '').split(',')) {
    const p = part.trim().toLowerCase();
    if (!p || !p.startsWith(name)) continue;
    const m = p.match(/[x×]\s*(\d+)\s*$/);
    units += m ? Number(m[1]) : 1;
  }
  return units;
}
export function historyFor(product, orders, months = 6) {
  const now = new Date();
  const buckets = new Array(months).fill(0);
  for (const o of orders || []) {
    if (o.status === 'rejected' || o.status === 'cancelled') continue;
    const d = new Date(String(o.created_at || '').replace(' ', 'T') + 'Z');
    if (isNaN(d)) continue;
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff < 0 || diff >= months) continue;
    buckets[months - 1 - diff] += unitsIn(o, product);
  }
  return buckets;
}

/* Stable baseline when a product has little or no recorded sales yet
   (Nexus synthHistory, sized for a local shop by price tier). */
export function synthHistory(p) {
  const seed = ((p.id || 1) * 9301 + 49297) % 233280;
  const price = Number(p.price) || 100;
  const base = Math.max(8, Math.round(price < 80 ? 140 : price < 250 ? 75 : price < 800 ? 34 : price < 5000 ? 12 : 5) + (seed % 13));
  return [0.74, 0.83, 0.91, 1.0, 1.09, 1.18].map((m, i) =>
    Math.max(1, Math.round(base * m + ((seed >> (i + 1)) % 7) - 3)));
}
/* Local Link orders are one channel — walk-ins sell the same line — so observed
   app demand is a floor on true demand, never a ceiling (Nexus blendHistory). */
export function blendHistory(p, real) {
  const base = synthHistory(p);
  if (!real || !real.length) return { history: base, basis: 'modelled' };
  const realSum = real.reduce((a, b) => a + b, 0), baseSum = base.reduce((a, b) => a + b, 0);
  return { history: base.map((b, i) => Math.max(b, real[i] || 0)), basis: realSum >= baseSum * 0.3 ? 'orders' : 'modelled' };
}

/* ── Full report for one product (Nexus calcReport) ───────────────────── */
export function productReport(p, orders, { stock = null, periodDays = 30 } = {}) {
  const fam = familyOf(`${p.category_name || ''} ${p.subcategory || ''} ${p.name || ''}`);
  const real = historyFor(p, orders);
  const { history, basis } = blendHistory(p, real);
  const now = new Date(); const month = now.getMonth();
  const price = Number(p.price) || 0;
  const f = forecast(history, { periodDays, fam, month });
  const stockKnown = stock != null && stock !== '' && !isNaN(Number(stock));
  const stockN = stockKnown ? Math.max(0, Number(stock)) : null;
  const safety = Math.max(2, r0(f.qty * 0.15));
  const po = purchaseOrder({ history, stock: stockKnown ? stockN : 0, safety, periodDays, fam, price, month });

  const hist = history.map((v, i) => {
    const d = new Date(now.getFullYear(), month - (history.length - i), 1);
    return { label: MON[d.getMonth()], units: r0(v), real: real[i] || 0 };
  });
  const months = [];
  for (let i = 0; i < 6; i++) {
    const mi = (month + i) % 12;
    const s = seasonalFactor(mi, fam);
    const units = r0(f.avgPerMonth * (1 + (f.trendPct / 100) * ((i + 1) / 6)) * s.factor);
    months.push({ label: MON[mi], units, seasonFactor: s.factor, events: s.events.map(e => e.label),
      revenue: r2(units * price), confidence: r2(Math.max(55, f.confidence - i * 4)) });
  }
  const peak = months.reduce((a, b) => (b.units > a.units ? b : a), months[0]);
  const low = months.reduce((a, b) => (b.units < a.units ? b : a), months[0]);

  const insights = [];
  if (f.trendPct >= 5) insights.push({ tone:'up', text:`Sales are trending up ${f.trendPct}% — forecast is ${f.qty} units against a ${r0(f.avgPerMonth)} unit average, so prepare to the forecast, not the average.` });
  else if (f.trendPct <= -5) insights.push({ tone:'down', text:`Sales are easing ${Math.abs(f.trendPct)}% — stock to the forecast so cash isn't tied up in slow units.` });
  else insights.push({ tone:'flat', text:`Demand is steady (${f.trendPct >= 0 ? '+' : ''}${f.trendPct}%), which is why confidence is ${f.confidence}%.` });
  if (f.events.length) insights.push({ tone:'season', text:`${f.events.map(e => e.label).join(' and ')} moves this line ${Math.round((f.seasonFactor - 1) * 100)}% this month — already included in the forecast.` });
  if (peak && low && peak.units > low.units * 1.2) insights.push({ tone:'season', text:`${peak.label} is the peak (${peak.units} units) and ${low.label} the quietest (${low.units}) — plan staff and stock around it.` });
  if (stockKnown) {
    if (po.poQty > 0) insights.push({ tone:'action', text:`Restock ${po.poQty} units${po.orderBy ? ` by ${po.orderBy}` : ''} — about ₹${Math.round(po.poCost).toLocaleString('en-IN')} at cost, returning ₹${Math.round(po.revenue).toLocaleString('en-IN')}.` });
    else insights.push({ tone:'ok', text:`${stockN} units on hand covers the forecast plus safety stock — nothing to reorder this cycle.` });
  } else insights.push({ tone:'action', text:`Keep about ${f.qty + safety} units ready for the next 30 days (${f.qty} forecast + ${safety} safety). Enter your stock to get an exact restock number.` });
  if (f.confidence < 70) insights.push({ tone:'risk', text:`Confidence is ${f.confidence}% because sales jump around — treat ${f.worst}–${f.best} units as the realistic range.` });
  if (basis === 'modelled') insights.push({ tone:'info', text:'Few app orders yet, so this uses a modelled baseline from the product\'s price band. It sharpens automatically as orders come in.' });

  return {
    product: { id: p.id, name: p.name, price, unit: p.unit || '', image_url: p.image_url || null, business: p.business || '', family: fam },
    basis, forecast: f, po, stock: stockN, history: hist, months, peak, low,
    revenue6: r2(months.reduce((s, m) => s + m.revenue, 0)),
    units6: months.reduce((s, m) => s + m.units, 0),
    insights
  };
}

/* ── Demand board: quick forecast for every product (Nexus demandEngine) ─ */
export function demandBoard(products, orders) {
  return products.map(p => {
    const fam = familyOf(`${p.category_name || ''} ${p.subcategory || ''} ${p.name || ''}`);
    const { history, basis } = blendHistory(p, historyFor(p, orders));
    const f = forecast(history, { fam });
    return { id: p.id, name: p.name, price: p.price, unit: p.unit || '', image_url: p.image_url || null, business: p.business || '',
      qty: f.qty, best: f.best, worst: f.worst, confidence: f.confidence, trendPct: f.trendPct,
      events: f.events.map(e => e.label), revenue: r2(f.qty * (Number(p.price) || 0)), basis, spark: history };
  }).sort((a, b) => b.revenue - a.revenue);
}

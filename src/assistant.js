import { db } from './db.js';
import { geminiKey, geminiJSON } from './voice.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Build a compact catalogue the model (or local search) can reason over.
function catalogue() {
  const businesses = db.prepare(`
    SELECT b.id, b.name, b.subcategory, c.name AS category, a.name AS area,
           b.rating, b.price_level, b.phone, b.whatsapp
    FROM businesses b JOIN categories c ON c.id=b.category_id
    LEFT JOIN areas a ON a.id=b.area_id WHERE b.status='approved'`).all();
  const products = db.prepare(`SELECT p.id, p.name, p.price, b.name AS business, b.id AS business_id
    FROM products p JOIN businesses b ON b.id=p.business_id`).all();
  const services = db.prepare(`SELECT s.id, s.name, s.starting_price, b.name AS business, b.id AS business_id
    FROM services s JOIN businesses b ON b.id=s.business_id`).all();
  const workers = db.prepare(`SELECT w.id, w.name, w.skills, w.rate, w.phone FROM workers w`).all();
  const drivers = db.prepare(`SELECT d.id, d.name, d.service_type, d.fare_note, d.phone FROM drivers d`).all();
  return { businesses, products, services, workers, drivers };
}

// ---- Local fallback: keyword + intent matching (works with no API key) ----
const STOP = new Set(['i','need','a','an','the','me','my','for','to','near','find','want','looking','get','some','can','you','is','are','where','how','of','in','on','and','today','please','with','best','good','cheap','under','below','₹','rs']);

const ML_WORDS={'പ്ലംബർ':'plumber','പ്ലംബിംഗ്':'plumber','ഇലക്ട്രീഷ്യൻ':'electrician','ബിരിയാണി':'biriyani','ഭക്ഷണം':'food','ഹോട്ടൽ':'restaurant','റെസ്റ്റോറന്റ്':'restaurant',
  'പച്ചക്കറി':'vegetable','പലചരക്ക്':'grocery','ഗ്രോസറി':'grocery','പാൽ':'milk','മീൻ':'fish','ചിക്കൻ':'chicken','കേക്ക്':'cake','ബേക്കറി':'bakery','മരുന്ന്':'medicine','ഫാർമസി':'pharmacy',
  'ഡോക്ടർ':'doctor','ഓട്ടോ':'auto','ടാക്സി':'taxi','സ്വർണം':'gold','ആഭരണം':'jewellery','തുണി':'clothes','ഡ്രസ്സ്':'clothes','മൊബൈൽ':'mobile','എസി':'ac','ആശാരി':'carpenter','പെയിന്റർ':'painter','ക്ലീനിംഗ്':'cleaning','സലൂൺ':'salon','മേസ്തിരി':'mason'};
function tokens(q){ for(const [m,e] of Object.entries(ML_WORDS)) if(q.includes(m)) q+=' '+e;return q.toLowerCase().replace(/[^a-z0-9ഀ-ൿ\s]/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w));}

function localSearch(query, lang) {
  const cat = catalogue();
  const ks = tokens(query);
  const priceMatch = query.match(/(?:under|below|less than)\s*₹?\s*(\d+)/i);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : null;

  const stem = (w) => w.replace(/(ers|er|ing|ians|ian|es|s)$/,'');
  // synonym expansion so casual words match the catalogue vocabulary
  const SYN = {
    plumber:['plumb','pipe','tank'], plumbing:['plumb','pipe','tank'],
    electrician:['electric','wiring'], electric:['wiring','electrician'], electrical:['wiring','electrician'],
    ac:['air','cool','refriger','snow'], cooling:['ac','air','refriger'], fridge:['refriger','appliance'],
    salon:['beauty','hair','barber','makeup'], barber:['salon','hair'], haircut:['salon','hair','barber'], parlour:['salon','beauty'],
    mechanic:['auto','car','garage','tyre','tire','denting'], garage:['auto','car','mechanic'],
    grocery:['supermarket','provision','mart','store','vegetable'], provisions:['grocery','supermarket'],
    biriyani:['biriyani','biryani','restaurant','hotel','meals'], biryani:['biriyani','restaurant','hotel'],
    food:['restaurant','hotel','meals','biriyani'], meals:['restaurant','hotel','food'],
    cake:['bakery','bake','puff'], bakery:['bake','cake','puff'], bread:['bakery','bake'],
    medicine:['pharma','medical','chemist','medicines'], pharmacy:['pharma','medical','medicine'], medicines:['pharma','medical'],
    doctor:['clinic','hospital','medical'], clinic:['medical','doctor','hospital','dental'], dentist:['dental','clinic'],
    taxi:['cab','car','taxi'], cab:['taxi','car'], auto:['auto','rickshaw','ride'], ride:['auto','taxi','cab'],
    carpenter:['wood','furniture','carpentry'], painter:['paint','painting'], painting:['paint'],
    cleaning:['clean','maid','domestic','housekeep'], maid:['domestic','cleaning'], mason:['masonry','construction'],
    jewellery:['gold','diamond','jewel'], gold:['jewellery','diamond'], clothes:['cloth','fashion','apparel'], clothing:['cloth','fashion'],
    mobile:['electronic','phone'], phone:['mobile','electronic'], electronics:['electronic','mobile','gadget'],
    hardware:['hardware','tools','paint'], school:['school','education'], college:['college','education'], bank:['bank','atm'],
  };
  const variants = (k) => {
    const set = new Set([k, stem(k), ...(SYN[k]||[]), ...(SYN[stem(k)]||[])]);
    return [...set].filter(v => v && v.length >= 3);
  };
  const score = (text) => {
    const hay = (text || '').toLowerCase();
    return ks.reduce((s,k)=> s + (variants(k).some(v => hay.includes(v)) ? 1 : 0), 0);
  };
  const results = [];
  cat.businesses.forEach(b => { const s = score(`${b.name} ${b.subcategory} ${b.category} ${b.area}`); if (s) results.push({ type:'business', score:s+ (b.rating||0)/10, ...b }); });
  cat.services.forEach(s => { const sc = score(`${s.name} ${s.business}`); if (sc) results.push({ type:'service', score:sc, ...s }); });
  cat.products.forEach(p => { let sc = score(`${p.name} ${p.business}`); if (maxPrice && p.price<=maxPrice) sc+=1; if (sc && (!maxPrice || p.price<=maxPrice)) results.push({ type:'product', score:sc, ...p }); });
  cat.workers.forEach(w => { const sc = score(`${w.name} ${w.skills}`); if (sc) results.push({ type:'worker', score:sc, ...w }); });
  cat.drivers.forEach(d => { const sc = score(`${d.name} ${d.service_type} auto taxi cab ride`); const rideWords = ks.some(k=>['auto','taxi','cab','ride','drop','pickup','airport','travel'].includes(k)); if (sc || rideWords) results.push({ type:'driver', score:sc + (rideWords?1:0), ...d }); });

  results.sort((a,b)=>b.score-a.score);
  const top = results.filter(r=>r.score>0).slice(0,6);
  let answer;
  const best = top[0];
  const detail = (r, ml) => r.type==='product' ? `₹${r.price}${r.business?(ml?`, ${r.business}-ൽ`:` at ${r.business}`):''}`
    : r.type==='service' ? `${ml?'':'from '}₹${r.starting_price}${ml?' മുതൽ':''}${r.business?(ml?`, ${r.business}`:` by ${r.business}`):''}`
    : r.type==='business' ? [r.subcategory, r.area, r.rating?(ml?`${r.rating} റേറ്റിംഗ്`:`rated ${r.rating}`):''].filter(Boolean).join(', ')
    : r.type==='worker' ? [r.skills, r.rate].filter(Boolean).join(', ') : (r.fare_note || r.service_type || '');
  if (lang === 'ml') {
    answer = !top.length
      ? `ക്ഷമിക്കണം, “${query}” അടുത്ത് കണ്ടെത്താനായില്ല. “പ്ലംബർ”, “ബിരിയാണി”, “ഗ്രോസറി” അല്ലെങ്കിൽ “ഓട്ടോ” എന്ന് ചോദിച്ചു നോക്കൂ.`
      : `${best.name} നല്ല ഓപ്ഷനാണ് — ${detail(best, true)}.${top.length>1?` വേറെ ${top.length-1} ഓപ്ഷനുകളും താഴെ ഉണ്ട്.`:''} ${best.type==='product'?'കാർട്ടിൽ ചേർക്കട്ടെ?':best.type==='service'?'ഒരു സമയം ബുക്ക് ചെയ്യട്ടെ?':'വിളിക്കാനോ കൂടുതൽ അറിയാനോ ടാപ്പ് ചെയ്യൂ.'}`;
  } else {
    answer = !top.length
      ? `Sorry, I couldn't find “${query}” nearby. Try asking for a plumber, biriyani, groceries or an auto.`
      : `${best.name} looks like a good pick — ${detail(best, false)}.${top.length>1?` I've listed ${top.length-1} more option${top.length>2?'s':''} below.`:''} ${best.type==='product'?'Shall I add it to your cart?':best.type==='service'?'Want me to book a time?':'Tap to call or see more.'}`;
  }
  return { answer, results: top, source: 'local' };
}

// ---- OpenAI-powered assistant (used when OPENAI_API_KEY is set) ----
function promptFor(query, lang) {
  const cat = catalogue();
  const compact = {
    businesses: cat.businesses.map(b=>({id:b.id,name:b.name,type:b.subcategory,category:b.category,area:b.area,rating:b.rating})),
    services: cat.services.map(s=>({id:s.id,name:s.name,from:s.starting_price,business:s.business})),
    products: cat.products.map(p=>({id:p.id,name:p.name,price:p.price,business:p.business})),
    workers: cat.workers.map(w=>({id:w.id,name:w.name,skills:w.skills,rate:w.rate})),
    drivers: cat.drivers.map(d=>({id:d.id,name:d.name,type:d.service_type,fare:d.fare_note})),
  };
  const ML = lang === 'ml';
  const style = ML
    ? `Write the "answer" in natural, everyday spoken Malayalam (Malayalam script), the way a friendly shopkeeper in Kozhikode talks — warm, simple and polite ("ഉണ്ട്", "കിട്ടും", "നോക്കാം"), never stiff textbook Malayalam. ` +
      `Keep shop names, dish names and common English words (biriyani, AC, auto, plumber, offer) as people in Kerala say them, written in English letters. Say prices as "₹250" and ratings as "4.7 റേറ്റിംഗ്". `
    : `Write the "answer" in clear, friendly Indian English — short sentences, no jargon, the way a helpful local shop assistant would speak. `;
  const sys = `You are "Ask Local Link", the voice assistant of Local Link — a local marketplace for Kunnamangalam and nearby areas in Kozhikode, Kerala. ` +
    `You help people find shops, food, groceries, home services, local workers and rides, ONLY from the catalogue provided. Never invent shops, prices, timings or delivery times. ` +
    `The user may write or speak in Malayalam, English or a mix (Manglish); understand all of them, including spelling mistakes and transcription errors. ` +
    style +
    `The answer is read aloud, so: 1–3 short sentences, at most 40 words; no lists, bullet points, emoji, markdown or URLs. ` +
    `Lead with the best match by name and one useful detail (price, rating, area or "from ₹…"), mention a second option only if it helps, and end with a short next step or question ` +
    `(for example "Shall I add it to your cart?" / "കാർട്ടിൽ ചേർക്കട്ടെ?" or "Want me to book a time?" / "ഒരു സമയം ബുക്ക് ചെയ്യട്ടെ?"). ` +
    `If the request is vague, pick sensible matches and ask one short clarifying question. If nothing fits, say so honestly and suggest the closest category. ` +
    `For greetings or thanks, reply briefly and say what you can help with. ` +
    `Reply with STRICT JSON only: {"answer": string, "results": [{"type":"business|service|product|worker|driver","id":number}]}. Choose up to 6 results, best first, and make sure the answer talks about the first result.`;
  return { cat, sys, user: `Catalogue:\n${JSON.stringify(compact)}\n\nUser query: "${query}"` };
}
function hydrate(cat, parsed, source) {
  const byId = {
    business: Object.fromEntries(cat.businesses.map(b=>[b.id,{type:'business',...b}])),
    service: Object.fromEntries(cat.services.map(s=>[s.id,{type:'service',...s}])),
    product: Object.fromEntries(cat.products.map(p=>[p.id,{type:'product',...p}])),
    worker: Object.fromEntries(cat.workers.map(w=>[w.id,{type:'worker',...w}])),
    driver: Object.fromEntries(cat.drivers.map(d=>[d.id,{type:'driver',...d}])),
  };
  const results = (parsed.results||[]).map(r => byId[r.type]?.[r.id]).filter(Boolean).slice(0,6);
  return { answer: parsed.answer || 'Here are some local matches.', results, source };
}
async function geminiSearch(query, lang) {
  const local = localSearch(query, lang);
  const { cat, sys } = promptFor(query, lang);
  // shortlist: local matches first, then top-rated places, so the prompt stays small and fast
  const pick = (arr, type) => arr.filter(x => local.results.some(r => r.type === type && r.id === x.id));
  const topBiz = cat.businesses.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 25);
  const short = {
    businesses: [...new Map([...pick(cat.businesses, 'business'), ...topBiz].map(b => [b.id, { id: b.id, name: b.name, type: b.subcategory, area: b.area, rating: b.rating }])).values()],
    services: pick(cat.services, 'service').concat(cat.services.slice(0, 15)).map(s => ({ id: s.id, name: s.name, from: s.starting_price, business: s.business })),
    products: pick(cat.products, 'product').map(p => ({ id: p.id, name: p.name, price: p.price, business: p.business })),
    workers: cat.workers.map(w => ({ id: w.id, name: w.name, skills: w.skills, rate: w.rate })),
    drivers: cat.drivers.map(d => ({ id: d.id, name: d.name, type: d.service_type, fare: d.fare_note })),
  };
  const hint = local.results.length ? `Likely matches (best first): ${local.results.map(r => `${r.type}:${r.id} ${r.name}`).join('; ')}.` : 'No keyword matches; infer intent.';
  const out = hydrate(cat, await geminiJSON(sys, `Catalogue:\n${JSON.stringify(short)}\n\n${hint}\n\nUser query: "${query}"`), 'gemini');
  if (!out.results.length && local.results.length) return { ...local, answer: out.answer && out.answer.length > 20 ? out.answer : local.answer };
  if (!out.answer || out.answer.length < 8) out.answer = local.answer;
  return out;
}
async function openaiSearch(query, lang) {
  const { cat, sys, user } = promptFor(query, lang);
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('OpenAI request failed: ' + resp.status);
  const data = await resp.json();
  return hydrate(cat, JSON.parse(data.choices[0].message.content), 'openai');
}

let openaiCoolUntil = 0;
const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout ' + ms + 'ms')), ms))]);
export async function ask(query, lang, fast) {
  lang = lang === 'en' ? 'en' : 'ml';
  if (!query || !query.trim()) return { answer: lang==='ml' ? 'എന്തും ചോദിക്കാം — “ഒരു പ്ലംബറെ വേണം”, “250 രൂപയിൽ താഴെ ബിരിയാണി”.' : 'Ask me anything — “find a plumber”, “biriyani under ₹250”.', results: [], source: 'local' };
  if (fast) return localSearch(query, lang);
  // AI gets at most ~5 s in total; otherwise answer instantly from the local catalogue
  if (geminiKey()) { try { return await within(geminiSearch(query, lang), 3000); } catch (e) { console.warn('Gemini fallback →', e.message.slice(0,300)); } }
  else if (process.env.OPENAI_API_KEY && Date.now() > openaiCoolUntil) { try { return await within(openaiSearch(query, lang), 5000); } catch (e) { if (/429/.test(e.message)) openaiCoolUntil = Date.now() + 10 * 60e3; console.warn('OpenAI fallback →', e.message); } }
  return localSearch(query, lang);
}

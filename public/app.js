/* Local Link — SPA frontend (vanilla JS). Talks to the Express API. */
(() => {
'use strict';

/* ---------------- state ---------------- */
let token = localStorage.getItem('ll_token') || null;
let me = safeParse(localStorage.getItem('ll_user'));
const state = {
  view: 'customer',
  lang: localStorage.getItem('ll_lang') || 'en',
  theme: localStorage.getItem('ll_theme') || 'light',
  custTheme: localStorage.getItem('ll_ctheme') || 'light',   // customer app: light (default) / dark
  areaId: Number(localStorage.getItem('ll_area')) || 1,
  areaName: localStorage.getItem('ll_area_name') || 'Kunnamangalam',
  onboarded: localStorage.getItem('ll_onboarded') === '1',
  introSeen: localStorage.getItem('ll_intro') === '1',
  aiStatus: { openai: false, model: 'gpt-4o-mini' },
};
let ref = { categories: [], areas: [], panchayaths: [], districts: [], plans: [] };
const nav = { customer: [], partner: [], admin: [] };

/* ---------------- utils ---------------- */
function safeParse(s){ try { return JSON.parse(s); } catch { return null; } }
const $ = (sel, root=document) => root.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const grad = (a,b) => `linear-gradient(135deg,${a},${b||a})`;
const money = (n) => '₹' + Number(n||0).toLocaleString('en-IN');
/* Real photos: permanent, fast Unsplash CDN images mapped by keyword (verified,
   never 404). Falls back to a guaranteed-loading seeded photo, then to the
   gradient tile beneath (onerror removes the img). */
const _PH_POOLS = {
  biryani:['1563379091339-03b21ab4a4f8','1633945274405-b6c8069047b0','1701579231305-d84d8af9a3fd','1631515243349-e0cb75fb8d3a'],
  grilled:['1598515214211-89d3c73ae83b','1567620832903-9fc6debc209f'],
  fish:['1519708227418-c8fd9a32b7a2','1580476262798-bddd9f4b7369'],
  cake:['1578985545062-69928b1d9587','1535141192574-5d4897c12636','1558961363-fa8fdf82db35'],
  bakery:['1509440159596-0249088772ff','1608198093002-ad4e005484ec'],
  rice:['1586201375761-83865001e31c'], oil:['1474979266404-7eaacbcd87c5'], eggs:['1518569656558-1f25e69d93d7'],
  grocery:['1542838132-92c53300491e','1604719312566-8912e9227c6a'],
  vegetables:['1540420773420-3366772f4999','1518843875459-f738682238a6'],
  jewellery:['1515562141207-7a88fb7ce338','1599643478518-a784e5dc4c8f'],
  necklace:['1611591437281-460bfbe1220a'], ring:['1605100804763-247f67b3557e'],
  shirt:['1602810318383-e386cc2a3ccf'], kurti:['1610030469983-98e550d6193c'],
  jeans:['1542272604-787c3835535d'], shoes:['1542291026-7eec264c27ff'], handbag:['1584917865442-de89df76afd3'],
  clothing:['1489987707025-afc232f7ea0f'], smartphone:['1511707171634-5f897ff02aa9'], earbuds:['1590658268037-6bf12165a8df'],
  laptop:['1496181133206-80ce9b88a853'], tv:['1593359677879-a4bb92f829d1'], mixer:['1585515320310-259814833e62'],
  medicine:['1584308666744-24d5c474f2ae'], sanitizer:['1584744982491-665216d95f8b'],
  restaurant:['1517248135467-4c7edcad34c4'], supermarket:['1578916171728-46686eac8d58'], salon:['1560066984-138dadb4c035'],
};
const _PH_RULES = [
  [['sanitizer'],'sanitizer'],[['first','aid','medicine','tablet','vitamin','paracetamol','pharma','strip'],'medicine'],
  [['earbud','airdopes','wireless','headphone'],'earbuds'],[['laptop','computer'],'laptop'],[['television','led tv',' tv'],'tv'],
  [['mixer','grinder','appliance'],'mixer'],[['smartphone','phone','mobile'],'smartphone'],
  [['necklace','bangle','bridal','jhumka'],'necklace'],[['ring','diamond'],'ring'],[['earring','gold','jewel'],'jewellery'],
  [['jeans','denim'],'jeans'],[['shoe','sneaker','footwear'],'shoes'],[['handbag','tote'],'handbag'],[['bag'],'handbag'],
  [['shirt','formal'],'shirt'],[['kurti','gown','dress','women','saree','silk','kanchipuram'],'kurti'],
  [['kids','tshirt','tee','jacket','fashion','clothing','apparel'],'clothing'],
  [['grill','arabic','faham','kebab','tandoor','mandi','shawa'],'grilled'],[['biryani','biriyani','pulao'],'biryani'],
  [['fish','prawn','seafood','meat','pollichathu'],'fish'],[['halwa','cake','sweet','dessert'],'cake'],
  [['puff','bun','pastry','bakery','cookie','bread','paratha','porotta','pathiri','kuboos','pita','dilkush','nankhatai','snack'],'bakery'],
  [['tomato','onion','banana','chilli','vegetable','fruit','plantain','veg'],'vegetables'],[['egg'],'eggs'],[['oil'],'oil'],
  [['rice','atta','flour','dal','lentil','gram','sugar','matta','basmati','wheat'],'rice'],
  [['milk','butter','dairy','tea','detergent','biscuit','provision','combo'],'grocery'],
  [['restaurant','hotel','dining','meals'],'restaurant'],[['supermarket','hypermarket','grocery','store','mart','market'],'supermarket'],
  [['salon','beauty','spa','makeup'],'salon'],
];
function _phHash(s){ s=String(s); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
const pic = (kw, seed, w=640, h=520) => {
  const k=String(kw||'').toLowerCase(); let bucket=null;
  for(const [words,b] of _PH_RULES){ if(words.some(x=>k.includes(x))){ bucket=b; break; } }
  const pool=bucket&&_PH_POOLS[bucket];
  if(pool&&pool.length) return `https://images.unsplash.com/photo-${pool[_phHash(seed)%pool.length]}?w=${w}&h=${h}&q=70&auto=format&fit=crop`;
  return `https://picsum.photos/seed/ll${_phHash(kw+'|'+seed)%100000}/${w}/${h}`;
};
function coverKw(b){ const s=((b&&(b.subcategory||b.category_name))||'').toLowerCase();
  if(/restaurant|hotel|biriyani|food/.test(s)) return 'restaurant,food';
  if(/bakery|cake|bake|puff|bun/.test(s)) return 'bakery,cakes';
  if(/grocery|supermarket|hypermarket|provision/.test(s)) return 'supermarket,grocery';
  if(/meat|seafood|fish/.test(s)) return 'seafood,market';
  if(/vegetable|fruit/.test(s)) return 'vegetables,market';
  if(/jewel|gold/.test(s)) return 'jewellery,gold,shop';
  if(/cloth|fashion|apparel/.test(s)) return 'clothing,boutique';
  if(/electronic|mobile|phone/.test(s)) return 'electronics,store';
  if(/pharma|medical|clinic|dental/.test(s)) return 'pharmacy,clinic';
  if(/ac|appliance|refriger/.test(s)) return 'air,conditioner';
  if(/electric/.test(s)) return 'electrician,tools';
  if(/salon|beauty/.test(s)) return 'salon,beauty';
  if(/auto|car|tyre|garage/.test(s)) return 'car,garage';
  if(/hardware|paint/.test(s)) return 'hardware,tools';
  return 'local,shop,storefront';
}
/* <img> overlaying a gradient tile — real photo when it loads, graceful gradient if not */
function photoLayer(src){ return `<img class="ph" src="${src}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()"/>`; }
/* Read an uploaded image file, downscale, return a compact JPEG data URL (no external storage needed) */
function readImageFile(file, max=760){ return new Promise((resolve,reject)=>{
  if(!file) return reject(new Error('no file'));
  const fr=new FileReader(); fr.onerror=()=>reject(fr.error);
  fr.onload=()=>{ const img=new Image(); img.onerror=()=>reject(new Error('bad image'));
    img.onload=()=>{ let w=img.naturalWidth, h=img.naturalHeight; const s=Math.min(1,max/Math.max(w,h)); w=Math.round(w*s); h=Math.round(h*s);
      const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
      try{ resolve(c.toDataURL('image/jpeg',0.82)); }catch(e){ reject(e); } };
    img.src=fr.result; };
  fr.readAsDataURL(file); }); }
function toast(msg){ const t = h(`<div class="toast">${esc(msg)}</div>`); $('#toast-host').appendChild(t); setTimeout(()=>{ t.style.opacity='0'; t.style.transition='.3s'; setTimeout(()=>t.remove(),300); }, 2200); }

async function api(pathname, opts={}) {
  const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const isGet = !opts.method || opts.method==='GET'; const ck='llc:'+pathname;
  let res;
  try{ res = await fetch('/api' + pathname, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
  catch(netErr){ const c = isGet && safeParse(localStorage.getItem(ck)); if(c){ if(!api._offlineToast){ api._offlineToast=1; toast('You\'re offline — showing saved results'); setTimeout(()=>api._offlineToast=0,8000); } return c; } throw new Error('You\'re offline. Check your connection and try again.'); }
  const data = await res.json().catch(()=>({}));
  if(res.ok && isGet && /^\/(bootstrap|offers|businesses|products|services|news|events|places|categories)/.test(pathname)){ try{ localStorage.setItem(ck, JSON.stringify(data)); }catch(e){} }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

/* ---------------- i18n ---------------- */
const DICT = {
  en: { shopByCat:'Shop by category', openNear:'Open near you', topOffers:'Top offers', voiceT:'Just say what you need', voiceS:'English or Malayalam — I\'ll find it', yourCart:'Your cart', needsAction:'Needs action today', newOrders:'new orders', unreadChats:'unread chats', outStock:'out of stock', recent:'Recent searches', trending:'Trending near you', introT:'New to Local Link?', introS:'Shops, food, services and rides near you — order, chat or call in a tap.', gotIt:'Got it', viewAll:'View all', greetM:'Good morning', greetA:'Good afternoon', greetE:'Good evening', search:'Search businesses, products, services…',
    nearYou:'Near You', offersNear:'Offers Near You', popularServices:'Popular Services', localUpdates:"What's Happening Locally",
    seeAll:'See all', explore:'Explore Local', categories:'Categories', home:'Home', orders:'Orders', notifications:'Alerts', profile:'Profile',
    call:'Call', whatsapp:'WhatsApp', directions:'Directions', share:'Share', about:'About', products:'Products', services:'Services',
    reviews:'Reviews', offers:'Offers', openNow:'Open now', rating:'Rating', nearby:'Nearby', askTitle:'Ask Local Link',
    askPh:'Try “find a plumber” or “biriyani under ₹250”', enquire:'Send enquiry', requestService:'Request service',
    login:'Log in', continue:'Continue', workers:'Workers', transport:'Transport', localInfo:'Local Info', news:'News', events:'Events',
    askHi:'Hi! Ask me to find local businesses, services, workers or rides — type or tap the mic to speak in English or Malayalam.',
    askOffline:'(Offline smart-search — add an OpenAI key on the server for full AI.)',
    chipPlumber:'Find a plumber', chipBiriyani:'Biriyani under ₹250', chipAuto:'Auto to the station', chipGrocery:'Grocery near me', chipAC:'AC repair today' },
  ml: { shopByCat:'വിഭാഗങ്ങൾ', openNear:'സമീപത്ത് തുറന്നവ', topOffers:'മികച്ച ഓഫറുകൾ', voiceT:'വേണ്ടത് പറഞ്ഞാൽ മതി', voiceS:'ഇംഗ്ലീഷിലോ മലയാളത്തിലോ — ഞാൻ കണ്ടെത്താം', yourCart:'നിങ്ങളുടെ കാർട്ട്', needsAction:'ഇന്ന് ശ്രദ്ധിക്കേണ്ടത്', newOrders:'പുതിയ ഓർഡറുകൾ', unreadChats:'വായിക്കാത്ത ചാറ്റുകൾ', outStock:'സ്റ്റോക്കില്ല', recent:'സമീപകാല തിരയലുകൾ', trending:'സമീപത്ത് ട്രെൻഡിംഗ്', introT:'ലോക്കൽ ലിങ്കിൽ പുതിയതാണോ?', introS:'സമീപത്തെ കടകൾ, ഭക്ഷണം, സേവനങ്ങൾ — ഒറ്റ ടാപ്പിൽ ഓർഡർ ചെയ്യൂ, ചാറ്റ് ചെയ്യൂ.', gotIt:'ശരി', viewAll:'എല്ലാം', greetM:'സുപ്രഭാതം', greetA:'ഉച്ചവന്ദനം', greetE:'ശുഭ സന്ധ്യ', search:'സ്ഥാപനങ്ങൾ, ഉൽപ്പന്നങ്ങൾ, സേവനങ്ങൾ തിരയുക…',
    nearYou:'അടുത്തുള്ളവ', offersNear:'അടുത്തുള്ള ഓഫറുകൾ', popularServices:'ജനപ്രിയ സേവനങ്ങൾ', localUpdates:'പ്രാദേശിക വാർത്തകൾ',
    seeAll:'എല്ലാം', explore:'പ്രാദേശികം കണ്ടെത്തുക', categories:'വിഭാഗങ്ങൾ', home:'ഹോം', orders:'ഓർഡറുകൾ', notifications:'അറിയിപ്പുകൾ', profile:'പ്രൊഫൈൽ',
    call:'വിളിക്കുക', whatsapp:'വാട്ട്‌സ്ആപ്പ്', directions:'വഴി', share:'പങ്കിടുക', about:'വിവരം', products:'ഉൽപ്പന്നങ്ങൾ', services:'സേവനങ്ങൾ',
    reviews:'അവലോകനങ്ങൾ', offers:'ഓഫറുകൾ', openNow:'തുറന്നിരിക്കുന്നു', rating:'റേറ്റിംഗ്', nearby:'സമീപം', askTitle:'ലോക്കൽ ലിങ്കിനോട് ചോദിക്കൂ',
    askPh:'“പ്ലംബറെ കണ്ടെത്തൂ” അല്ലെങ്കിൽ “₹250-ൽ താഴെ ബിരിയാണി”', enquire:'അന്വേഷണം അയയ്ക്കുക', requestService:'സേവനം അഭ്യർത്ഥിക്കുക',
    login:'ലോഗിൻ', continue:'തുടരുക', workers:'തൊഴിലാളികൾ', transport:'ഗതാഗതം', localInfo:'പ്രാദേശിക വിവരം', news:'വാർത്ത', events:'പരിപാടികൾ',
    askHi:'നമസ്കാരം! പ്രാദേശിക ബിസിനസ്സുകൾ, സേവനങ്ങൾ, തൊഴിലാളികൾ, യാത്ര എന്നിവ കണ്ടെത്താൻ ചോദിക്കൂ — ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ മൈക്ക് അമർത്തി സംസാരിക്കുക.',
    askOffline:'(ഓഫ്‌ലൈൻ സ്മാർട്ട് സെർച്ച് — പൂർണ്ണ AI-ക്ക് സെർവറിൽ OpenAI കീ ചേർക്കുക.)',
    chipPlumber:'പ്ലംബറെ കണ്ടെത്തൂ', chipBiriyani:'₹250-ൽ താഴെ ബിരിയാണി', chipAuto:'സ്റ്റേഷനിലേക്ക് ഓട്ടോ', chipGrocery:'അടുത്തുള്ള പലചരക്ക്', chipAC:'എസി റിപ്പയർ ഇന്ന്' },
};
const t = (k) => (DICT[state.lang] && DICT[state.lang][k]) || DICT.en[k] || k;
const catLabel = (c) => state.lang==='ml' && c.name_ml ? c.name_ml : c.name;

/* ---------------- icons ---------------- */
const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  explore:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-3.6 1.4L10 14l3.6-1.4L15 9Z"/></svg>',
  bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  ai:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 4.5L18 9.2l-4.3 1.7L12 15.5l-1.7-4.6L6 9.2l4.3-1.7L12 3Z"/><path d="M18.5 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.5 21 3 13.5 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.2 2.2Z"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.1.3.7 1.1 1.4 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.2.1.7-.1 1.2Z"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-3.9 0-7 3-7 6.9 0 4.6 5.5 10.4 6.4 11.3.3.3.9.3 1.2 0 .9-.9 6.4-6.7 6.4-11.3C19 5 15.9 2 12 2Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
  dir:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.6 10.6 19.3C5.6 14.8 2.3 11.8 2.3 8.1 2.3 5.1 4.6 2.8 7.6 2.8c1.7 0 3.3.8 4.4 2.1 1.1-1.3 2.7-2.1 4.4-2.1 3 0 5.3 2.3 5.3 5.3 0 3.7-3.3 6.7-8.3 11.2L12 20.6Z"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16l-5.9 3.4L7.6 13l-5-4.3L9.1 8 12 2Z"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16l-1-5H5L4 9Z"/><path d="M5 9v11h14V9"/><path d="M9 20v-5h6v5"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 12 3h8v8l-9 9-8-8Z"/><circle cx="16" cy="8" r="1.4"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c1-3.5 4-5 6-5s5 1.5 6 5"/><path d="M17 5a3 3 0 0 1 0 6"/></svg>',
  cog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M10 12h9M13 8l-4 4 4 4"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
};
const ic = (name) => `<span class="ic-svg">${I[name]||''}</span>`;

/* ---------- premium line-icon set (lucide-style, replaces all emoji) ---------- */
const _s='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
const GI = {
  store:_s+'<path d="M4 9h16l-1-4H5L4 9Z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/></svg>',
  fork:_s+'<path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 3c-1.7 0-3 2-3 5s1 4 3 4.5V21"/></svg>',
  cart:_s+'<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M2 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19 8H5.5"/></svg>',
  download:_s+'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
  send:_s+'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>',
  sparkles:_s+'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  bread:_s+'<path d="M5 12a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v0H5Z"/><path d="M5 12h14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4Z"/></svg>',
  fish:_s+'<path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z"/><circle cx="9" cy="12" r=".7" fill="currentColor"/><path d="M18 9.5c1 1 1 4 0 5"/></svg>',
  leaf:_s+'<path d="M20 4C9 4 4 9 4 18c0 0 8 1.5 12-4 3-4 4-10 4-10Z"/><path d="M5 19c3.5-7 9-10.5 13-11.5"/></svg>',
  diamond:_s+'<path d="M6 4h12l3 5-9 11L3 9l3-5Z"/><path d="M3 9h18M9 4l-1.5 5L12 20l4.5-11L15 4"/></svg>',
  shirt:_s+'<path d="M6 4l3-1a3 3 0 0 0 6 0l3 1 2 4-3 1v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9L4 8l2-4Z"/></svg>',
  device:_s+'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
  cross:_s+'<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z"/></svg>',
  snow:_s+'<path d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5 4.9 17.5"/><path d="M12 5 9.5 7.5 12 5l2.5 2.5M12 19l-2.5-2.5M12 19l2.5-2.5M5 9l.7 3.2L3 11M19 9l-.7 3.2L21 11M5 15l.7-3.2M19 15l-.7-3.2"/></svg>',
  bolt:_s+'<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  wrench:_s+'<path d="M20 5a4 4 0 0 1-5.3 5.3L7 18l-2-2 7.7-7.7A4 4 0 0 1 18 3l-2.3 2.3 1.5 1.5L20 5Z"/></svg>',
  scissors:_s+'<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8 8l12 8M8 16 20 8"/></svg>',
  car:_s+'<path d="M5 11l1.4-4.2A2 2 0 0 1 8.3 5.5h7.4a2 2 0 0 1 1.9 1.3L19 11"/><path d="M4 16v-3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3h-2M6 16H4M20 16h-2M6 16v1.5M18 16v1.5"/><circle cx="7.5" cy="16" r="1.2"/><circle cx="16.5" cy="16" r="1.2"/></svg>',
  package:_s+'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
  nut:_s+'<path d="M8 3.5h8l4 8.5-4 8.5H8l-4-8.5L8 3.5Z"/><circle cx="12" cy="12" r="3"/></svg>',
  helmet:_s+'<path d="M3 14a9 9 0 0 1 18 0"/><path d="M3 14h18v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2ZM9 14V7h2M13 14V8"/></svg>',
  bank:_s+'<path d="M3 10 12 4l9 6M4 10v8M20 10v8M8 10v8M16 10v8M3 20h18"/></svg>',
  cap:_s+'<path d="M2 8l10-4 10 4-10 4L2 8Z"/><path d="M6 10v5c0 1 3 2.5 6 2.5s6-1.5 6-2.5v-5M22 8v5"/></svg>',
  shield:_s+'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/></svg>',
  flame:_s+'<path d="M12 3c1 3 5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 2 2 2 2 0 0-2-1-3-1-5Z"/></svg>',
  building:_s+'<path d="M4 21V6l8-3 8 3v15M3 21h18M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"/></svg>',
  calendar:_s+'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
  news:_s+'<rect x="3" y="4" width="14" height="16" rx="1.5"/><path d="M17 8h4v10a2 2 0 0 1-2 2M6 8h5M6 12h5M6 16h4"/></svg>',
  percent:_s+'<path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/></svg>',
  inbox:_s+'<path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5 5Z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
  lock:_s+'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  compass:_s+'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 1 2-5 4-1Z"/></svg>',
  megaphone:_s+'<path d="M3 11v2a1 1 0 0 0 1 1h2l6 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M16 8a4 4 0 0 1 0 8"/></svg>',
  card:_s+'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>',
  chat:_s+'<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>',
  clock:_s+'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  warning:_s+'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v5M12 18h.01"/></svg>',
  mic:_s+'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
  send:_s+'<path d="M4.5 12 20 5l-6.5 15-2.2-6.3L4.5 12Z"/></svg>',
};
Object.assign(GI, { search:I.search, heart:I.heart, star:I.star, bell:I.bell, bag:I.bag, tag:I.tag, users:I.users, user:I.user, pin:I.pin, cog:I.cog });
const CAT_ICON = { 'food-grocery':'fork','shopping':'shirt','services':'wrench','workers':'helmet','transport':'car','healthcare':'cross','local-info':'building','news':'news','events':'calendar','classifieds':'percent' };
const SUB_ICON = [
  [/restaurant|hotel|biriyani|meals|cafe|café|dining|food/,'fork'],
  [/grocery|supermarket|super ?market|hypermarket|provision|mart/,'cart'],
  [/bakery|bake|cake|puff/,'bread'],
  [/meat|seafood|fish|chicken|butcher/,'fish'],
  [/vegetable|fruit|\bveg\b/,'leaf'],
  [/jewel|gold|diamond/,'diamond'],
  [/cloth|fashion|boutique|apparel|footwear|textile/,'shirt'],
  [/electronic|mobile|laptop|digital|gadget/,'device'],
  [/pharma|medical|medicine|chemist|clinic|dental|hospital|doctor|health/,'cross'],
  [/\bac\b|air ?condition|fridge|refriger|washing|appliance/,'snow'],
  [/electric|wiring|electrician/,'bolt'],
  [/plumb|carpenter|wood|furniture|repair|fitting/,'wrench'],
  [/salon|beauty|barber|hair|makeup|spa/,'scissors'],
  [/tyre|tire|auto ?care|automotive|garage|denting|car ?wash/,'car'],
  [/hardware|paint|tools|building material/,'nut'],
  [/taxi|cab/,'car'],[/courier|delivery|parcel/,'package'],
  [/bank|atm/,'bank'],[/school|college|\bnit\b|education|tuition|academy/,'cap'],
  [/police/,'shield'],[/fire/,'flame'],[/ambulance|blood/,'cross'],
  [/govern|panchayath|village office|municipal|corporation/,'building'],
];
function iconKeyFor(o, fallback){
  const s = ((o.subcategory||'')+' '+(o.name||'')+' '+(o.category||'')+' '+(o.skills||'')+' '+(o.service_type||'')).toLowerCase();
  for (const [re,ic2] of SUB_ICON) if (re.test(s)) return ic2;
  if (o.category_slug && CAT_ICON[o.category_slug]) return CAT_ICON[o.category_slug];
  return fallback || 'store';
}
function gi(name){ return `<span class="gi">${GI[name]||GI.store}</span>`; }
function catIcon(slug){ return `<span class="gi">${GI[CAT_ICON[slug]||'store']}</span>`; }
function dIcon(o, fallback){ return `<span class="gi">${GI[iconKeyFor(o,fallback)]||GI.store}</span>`; }
function driverIcon(t){ return gi(t==='delivery'?'package':'car'); }

/* ---------------- shell ---------------- */
function applyTheme(){
  const root = document.documentElement;
  const th = state.view==='customer' ? 'light' : state.theme;  // customer app = Noon-style light
  if (th==='system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', th);
}

/* ---------------- cart (client-side, persisted) ---------------- */
let cart = safeParse(localStorage.getItem('ll_cart')) || [];
function saveCart(){ localStorage.setItem('ll_cart', JSON.stringify(cart)); }
function cartCount(){ return cart.reduce((n,i)=>n+i.qty,0); }
function cartTotal(){ return cart.reduce((n,i)=>n+i.qty*i.price,0); }
function cartBizId(){ return cart.length ? cart[0].bizId : null; }
/* Themed confirm dialog (replaces the browser's confirm()) → resolves true/false */
function confirmDialog({title, message, ok='Yes', cancel='Cancel', danger=false, icon}){
  return new Promise(resolve=>{
    const host = document.querySelector('.phone') || document.body;
    const back = document.createElement('div'); back.className='cd-back';
    back.innerHTML = `<div class="cd-card">
      ${icon?`<div class="cd-ic">${icon}</div>`:''}
      <h3 class="cd-title">${esc(title)}</h3>
      <p class="cd-msg">${esc(message)}</p>
      <div class="cd-acts"><button class="btn ghost cd-cancel">${esc(cancel)}</button><button class="btn ${danger?'cd-danger':''} cd-ok">${esc(ok)}</button></div>
    </div>`;
    host.appendChild(back);
    requestAnimationFrame(()=>back.classList.add('on'));
    const done=(v)=>{ back.classList.remove('on'); setTimeout(()=>back.remove(),200); resolve(v); };
    back.querySelector('.cd-ok').onclick=()=>done(true);
    back.querySelector('.cd-cancel').onclick=()=>done(false);
    back.onclick=(e)=>{ if(e.target===back) done(false); };
  });
}
async function addToCart(item){
  // One-store cart: items must all come from the same business
  const cur = cartBizId();
  if(cart.length && cur && item.bizId && Number(cur)!==Number(item.bizId)){
    const ok = await confirmDialog({
      title: 'Start a new cart?',
      message: `Your cart has items from ${cart[0].biz||'another store'}. You can only order from one store at a time. Clear it and add ${item.name} from ${item.biz||'this store'}?`,
      ok: 'Start new cart', cancel: 'Keep current', icon: GI.cart });
    if(!ok) return false;
    cart = []; // clear the old store's cart
  }
  const ex=cart.find(i=>i.id===item.id); if(ex) ex.qty++; else cart.push({...item,qty:1});
  saveCart(); buzz(); track('add_to_cart',{id:item.id}); updateCartBadge(); return true;
}
function setQty(id,d){ const it=cart.find(i=>i.id===id); if(!it)return; it.qty+=d; if(it.qty<=0) cart=cart.filter(i=>i.id!==id); saveCart(); updateCartBadge(); }
function syncCartUI(){
  document.querySelectorAll('[data-ctl-pid]').forEach(el=>{ const pid=Number(el.dataset.ctlPid); const it=cart.find(i=>i.id===pid);
    if(it && el.classList.contains('qc-step')){ el.querySelector('b').textContent=it.qty; return; }
    if(!!it === el.classList.contains('qc-step')) return;
    const p={ id:pid, name:el.dataset.pname||(it&&it.name)||'', price:Number(el.dataset.pprice||(it&&it.price)||0), mrp:Number(el.dataset.pmrp||(it&&it.mrp)||0), unit:el.dataset.punit||(it&&it.unit)||'', business:el.dataset.pbiz||(it&&it.biz)||'', business_id:Number(el.dataset.pbizid||(it&&it.bizId)||0) };
    const keep={pname:p.name,pprice:p.price,pmrp:p.mrp,punit:p.unit,pbiz:p.business,pbizid:p.business_id,pimg:el.dataset.pimg||(it&&it.image)||''};
    const n=h(addCtl(p, keep.pimg)); Object.entries(keep).forEach(([k,v])=>{ if(!n.dataset[k]) n.dataset[k]=v; }); el.replaceWith(n); });
  renderCartBar();
}
function renderCartBar(){
  const host=document.getElementById('qcCartBar'); if(!host) return;
  const n=cartCount(), tot=cartTotal(), FREE=499;
  if(!n){ host.innerHTML=''; host.hidden=true; return; }
  host.hidden=false;
  const left=Math.max(0,FREE-tot), pct=Math.min(100,Math.round(tot/FREE*100));
  host.innerHTML=`<button class="qc-cartbar" id="qcGoCart" aria-label="View cart, ${n} items, ${money(tot)}">
    <span class="qc-thumbs">${cart.slice(-3).map(i=>`<i>${i.image?`<img src="${esc(i.image)}" alt="" onerror="this.remove()">`:''}</i>`).join('')}</span>
    <span class="qc-cbt"><b>${n} item${n>1?'s':''} · ${money(tot)}</b><small>${left?`Add ${money(left)} for FREE delivery`:'🎉 FREE delivery unlocked'}</small></span>
    <span class="qc-cgo">View cart ${I.chev}</span><span class="qc-prog" style="--p:${pct}%"></span></button>`;
  $('#qcGoCart').onclick=()=>{ track('view_cart'); go('cart'); };
}
function buzz(ms=12){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }
function track(evt, data){ try{ let sid=sessionStorage.getItem('ll_sid'); if(!sid){ sid=Math.random().toString(36).slice(2,12); sessionStorage.setItem('ll_sid',sid); } fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({name:evt,session:sid,meta:data||null})}).catch(()=>{}); }catch(e){} try{ const k='ll_events'; const a=safeParse(localStorage.getItem(k))||[]; a.push({e:evt,d:data||null,t:Date.now(),v:state.view}); localStorage.setItem(k,JSON.stringify(a.slice(-200))); }catch(e){} }
function updateCartBadge(){ const b=document.querySelector('.bnav .cartbadge:not(.pchatbadge)'); const n=cartCount(); if(b){ b.textContent=n; b.hidden=!n; } syncCartUI(); }
function setPartnerChatBadge(n){ const b=document.querySelector('.pchatbadge'); if(b){ b.textContent=n||0; b.hidden=!n; } }

/* ---------------- wishlist / saved items (persisted) ---------------- */
let saved = safeParse(localStorage.getItem('ll_saved')) || [];
function saveSaved(){ localStorage.setItem('ll_saved', JSON.stringify(saved)); }
function isSaved(type,id){ return saved.some(s=>s.type===type && String(s.id)===String(id)); }
function toggleSaved(item){ const i=saved.findIndex(s=>s.type===item.type && String(s.id)===String(item.id));
  if(i>=0){ saved.splice(i,1); toast('Removed from wishlist'); } else { saved.unshift(item); toast('Saved to wishlist'); }
  saveSaved(); }
function stars(r){ return `<span class="stars">${I.star}${Number(r||0).toFixed(1)}</span>`; }

function miniControls(){
  return `<div class="mini-ctrl">
    <div class="lang-toggle" data-mini-lang><button data-l="en" class="${state.lang==='en'?'on':''}">EN</button><button data-l="ml" class="${state.lang==='ml'?'on':''}">മ</button></div>
    <button class="tb-btn" data-mini-theme title="Theme">${I.sun}</button></div>`;
}
// Swap the PWA manifest/icon/title to match the current surface, so installing
// from anywhere (even after switching apps in-session) adds the right app.
const LL_MANIFEST = {
  customer: { manifest:'/manifest.webmanifest', icon:'/icon-192.png', title:'Local Link — Everything Local. One Place.', appleTitle:'Local Link', theme:'#0D9488' },
  launcher: { manifest:'/manifest.webmanifest', icon:'/icon-192.png', title:'Local Link — Everything Local. One Place.', appleTitle:'Local Link', theme:'#0D9488' },
  partner:  { manifest:'/manifest-partner.webmanifest', icon:'/icon-partner-192.png', title:'Local Link Partner', appleTitle:'LL Partner', theme:'#B45309' },
  admin:    { manifest:'/manifest-admin.webmanifest', icon:'/icon-admin-192.png', title:'Local Link Admin', appleTitle:'LL Admin', theme:'#0F172A' },
};
function applyManifest(view){
  const m = LL_MANIFEST[view] || LL_MANIFEST.customer;
  const set=(sel,attr,val)=>{ const el=document.querySelector(sel); if(el) el.setAttribute(attr,val); };
  set('link[rel="manifest"]','href',m.manifest);
  set('link[rel="apple-touch-icon"]','href',m.icon);
  set('meta[name="theme-color"]','content',m.theme);
  set('meta[name="apple-mobile-web-app-title"]','content',m.appleTitle);
  document.title = m.title;
}
function renderShell(){
  applyManifest(state.view);
  applyTheme();
  document.body.classList.toggle('ml', state.lang==='ml');
  document.body.classList.toggle('cdark', state.view==='customer' && state.custTheme==='dark');
  document.body.dataset.app = state.view;
  const stage = $('#stage');
  if (state.view==='admin'){ stage.innerHTML = `<div class="admin-shell" id="adminshell"></div>`; renderAdmin($('#adminshell')); return; }
  if (state.view==='launcher'){ renderLauncher(stage); return; }
  // customer / partner render as a standalone full-screen mobile app
  stage.innerHTML = `<div class="appwrap vb-stage"><div class="atmo" aria-hidden="true"><i></i><i></i><i></i></div><div class="phone vb-app"><div class="atmo" aria-hidden="true"><i></i><i></i><i></i></div><div class="screen" id="screen"></div><div id="navholder"></div></div></div>`;
  if (!nav[state.view].length) nav[state.view].push(state.view==='customer'
    ? {name: localStorage.getItem('ll_seen') ? 'home' : 'splash'}   // branded opening only on the very first visit
    : {name: token && me && me.role==='business_partner' ? 'p_dash' : 'p_login'});
  routeRender();
}
function cycleTheme(){ state.theme = state.theme==='system'?'light':state.theme==='light'?'dark':'system'; localStorage.setItem('ll_theme',state.theme); applyTheme(); const b=document.querySelector('[data-mini-theme]'); toast('Theme: '+state.theme); }
function toggleCustTheme(){ state.custTheme = state.custTheme==='dark'?'light':'dark'; localStorage.setItem('ll_ctheme', state.custTheme); document.body.classList.toggle('cdark', state.custTheme==='dark'); toast(state.custTheme==='dark'?'Dark mode on':'Light mode on'); }

function openView(view){
  state.view = view;
  const path = view==='partner'?'/partner':view==='admin'?'/admin':view==='launcher'?'/apps':'/';
  try{ history.pushState({view}, '', path); }catch(e){}
  renderShell();
}
function renderLauncher(stage){
  stage.innerHTML = `<div class="launcher">
    <div class="launch-hero">${logoMark(76)}<h1>Local Link</h1><p>Everything Local. One Place.</p></div>
    <div class="launch-grid">
      ${[['customer','Customer App','Discover shops, services, offers & more near you',GI.compass,'/'],
         ['partner','Partner App','Manage your business, products & orders',GI.store,'/partner'],
         ['admin','Admin Panel','CRM to run the whole platform',GI.wrench,'/admin']].map(([v,t2,d,e,p])=>`
        <button class="launch-card" data-view="${v}">
          <div class="lc-ic">${e}</div><h3>${t2}</h3><p>${d}</p><span class="lc-link">Open ${p} ${I.chev}</span></button>`).join('')}
    </div>
    <p class="faint" style="text-align:center;margin-top:26px;font-size:12.5px">Three separate apps · one backend · one login system</p></div>`;
  stage.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openView(b.dataset.view));
}

function wordmark(){ return `<span class="vb-word"><span class="w1">Local</span><span class="w2">Link</span></span>`; }
function greetWord(){ const h=new Date().getHours(); return h<12?t('greetM'):h<17?t('greetA'):t('greetE'); }
function logoMark(size=26){
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 44" fill="none" aria-hidden="true">
    <path d="M20 2c8 0 14 6.5 14 14.5C34 27 24 37 20 42 16 37 6 27 6 16.5 6 8.5 12 2 20 2Z" fill="url(#lg${size})"/>
    <g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round">
      <circle cx="24" cy="20" r="5.6"/><circle cx="16.5" cy="14.5" r="5.6"/>
      <path d="M20.6 18.6a5.6 5.6 0 0 1-8 0" stroke="#fff"/></g>
    <circle cx="16.5" cy="14.5" r="1.7" fill="#FF7A59"/>
    <defs><linearGradient id="lg${size}" x1="6" y1="2" x2="34" y2="42" gradientUnits="userSpaceOnUse">
      <stop stop-color="#14B8A6"/><stop offset="1" stop-color="#0B5A55"/></linearGradient></defs></svg>`;
}


/* ---------------- customer router ---------------- */
function stack(){ return nav[state.view]; }
let NAV_DIR='tab';
function go(routeName, params){ NAV_DIR='fwd'; stack().push({name:routeName, params:params||{}}); try{ history.pushState({ll:1, view:state.view}, ''); }catch(e){} routeRender(); const s=$('#screen'); if(s) s.scrollTop=0; }
function back(){ NAV_DIR='back'; if(stack().length>1){ if(history.state && history.state.ll){ history.back(); return; } stack().pop(); routeRender(); } }
function setTab(routeName){ NAV_DIR='tab'; nav[state.view]=[{name:routeName}]; routeRender(); }

const SCREENS = {};
function wirePullToRefresh(){
  const sc=document.getElementById('screen'); if(!sc || sc.__ptr) return; sc.__ptr=true;
  const ok=()=>['p_dash','p_orders','p_chats','p_products','home','orders'].includes((stack()[stack().length-1]||{}).name);
  const ind=document.createElement('div'); ind.className='ptr'; ind.innerHTML=I.dir; sc.parentNode.appendChild(ind);
  let y0=null, dy=0;
  sc.addEventListener('touchstart',e=>{ if(sc.scrollTop<=0 && ok()){ y0=e.touches[0].clientY; dy=0; } },{passive:true});
  sc.addEventListener('touchmove',e=>{ if(y0===null) return; dy=Math.max(0,e.touches[0].clientY-y0); const k=Math.min(1,dy/80); ind.style.opacity=k; ind.style.transform=`translate(-50%,${Math.min(70,dy*.6)}px) rotate(${dy*3}deg)`; ind.classList.toggle('ready',dy>80); },{passive:true});
  sc.addEventListener('touchend',()=>{ if(y0===null) return; y0=null; if(dy>80){ ind.classList.add('spin'); buzz(); Promise.resolve(routeRender()).finally(()=>setTimeout(()=>{ ind.classList.remove('spin','ready'); ind.style.opacity=0; ind.style.transform=''; },400)); } else { ind.style.opacity=0; ind.style.transform=''; } });
}
async function routeRender(){
  const cur = stack()[stack().length-1];
  const screen = $('#screen');
  if (!screen) return;
  screen.scrollTop = 0;                 // always start a screen at the top (fixes "stuck in middle")
  wirePullToRefresh();
  const fn = SCREENS[cur.name];
  if (!fn){ screen.innerHTML = emptyState('compass','Screen not found',''); return; }
  if(state.view==='customer'){ screen.classList.remove('cx-fwd','cx-back','cx-tab'); void screen.offsetWidth; screen.classList.add('cx-'+NAV_DIR); NAV_DIR='tab'; }
  try { await fn(screen, cur.params||{}); }
  catch(e){ screen.innerHTML = errorState(e.message, ()=>routeRender()); }
  screen.scrollTop = 0;                 // and again after async data loads
  renderBottomNav();
  if(state.view==='customer') try{ cxMotion(screen); }catch(e){}
}

/* ---------------- reusable components ---------------- */
function skeletonRow(n=3){ return `<div class="stack" style="gap:12px">${Array(n).fill(`<div class="sk" style="height:92px;border-radius:16px"></div>`).join('')}</div>`; }
function skeletonCards(n=3){ return `<div class="row" style="gap:13px;overflow:hidden">${Array(n).fill(`<div class="sk" style="height:180px;width:220px;flex:0 0 auto;border-radius:16px"></div>`).join('')}</div>`; }
function emptyState(icon,title,sub,cta){ const g = GI[icon]?`<span class="gi">${GI[icon]}</span>`:(String(icon).startsWith('<')?icon:`<span class="gi">${GI.inbox}</span>`); return `<div class="empty"><div class="eic">${g}</div><h4 style="font-size:16px;color:var(--ink)">${esc(title)}</h4><p style="max-width:230px">${esc(sub||'')}</p>${cta||''}</div>`; }
function errorState(msg,retry){ const id='rt'+Math.random().toString(36).slice(2); setTimeout(()=>{const b=document.getElementById(id); if(b&&retry)b.onclick=retry;},0);
  return `<div class="empty"><div class="eic">${gi('warning')}</div><h4 style="font-size:16px;color:var(--ink)">Something went wrong</h4><p>${esc(msg||'')}</p><button id="${id}" class="btn ghost sm">Try again</button></div>`; }

function businessCard(b){
  const off = b.offer_label ? `<span class="badge accent off">${esc(b.offer_label)}</span>` : '';
  const cover = b.cover_url || pic(coverKw(b), b.id, 480, 300);
  const navr = b.source==='google' ? 'place' : 'business';
  return `<button class="bcard" data-nav="${navr}" data-id="${b.id}">
    <div class="banner" style="background:${grad(b.color1,b.color2)}">${photoLayer(cover)}${off}
      <span class="emoji">${dIcon(b)}</span>
      <span class="fav ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||b.category_name||'')}" data-fimg="${esc(cover)}">${I.heart}</span></div>
    <div class="body"><h4>${esc(b.name)}</h4>
      <div class="meta">${stars(b.rating)}<span class="dot"></span><span>${esc(b.subcategory||b.category_name||'')}</span></div>
      <div class="meta"><span class="badge ${b.is_open?'open':'closed'}">${b.is_open?'Open now':'Closed'}</span>${b.hours_label?`<span class="bc-hrs">${esc(b.hours_label)}</span>`:''}</div>
      <div class="meta bc-foot"><span>${I.pin}${esc(b.area_name||'')}</span>${b.phone?`<span class="bc-call" role="button" tabindex="0" data-callbiz="${esc(b.phone)}" aria-label="Call ${esc(b.name)}">${I.phone}</span>`:''}</div>
    </div></button>`;
}
function catCard(c){ return `<button class="cat" data-nav="category" data-slug="${c.slug}">
  <span class="ic" style="background:${grad(c.color1,c.color2)}">${catIcon(c.slug)}</span><span>${esc(catLabel(c))}</span></button>`; }
function offerCard(o){ return `<button class="ocard" data-nav="business" data-id="${o.business_id}" style="background:${grad(o.color1,o.color2)}">
  <span class="badge tag">${esc(o.discount_label||'OFFER')}</span>
  <div><h4>${esc(o.title)}</h4><div class="biz">${esc(o.business||'')}</div></div>
  <span class="disc">%</span></button>`; }
function addCtl(p, src, biz){
  const inCart = cart.find(i=>i.id===p.id);
  if(inCart) return `<span class="qc-step" data-ctl-pid="${p.id}" role="group" aria-label="Quantity of ${esc(p.name)}"><button data-qdec="${p.id}" aria-label="Remove one">−</button><b aria-live="polite">${inCart.qty}</b><button data-qinc="${p.id}" aria-label="Add one">+</button></span>`;
  return `<button class="qc-add" data-ctl-pid="${p.id}" data-add="1" data-pid="${p.id}" data-pname="${esc(p.name)}" data-pprice="${p.price}" data-pmrp="${p.mrp||''}" data-punit="${esc(p.unit||'')}" data-pimg="${esc(src)}" data-pbiz="${esc(p.business||(biz&&biz.name)||'')}" data-pbizid="${p.business_id||(biz&&biz.id)||''}" aria-label="Add ${esc(p.name)} to cart">ADD</button>`;
}
function productCard(p, biz, opts={}){ const disc = p.mrp && p.mrp>p.price;
  const src = p.image_url || pic((p.name||'product').toLowerCase(), 500+(p.id||0));
  const pct = disc ? Math.round((1-p.price/p.mrp)*100) : 0;
  const oos = p.stock_status==='out_of_stock';
  const rating = p.rating ? Number(p.rating).toFixed(1) : null;
  const rib = p.promo_label ? `<span class="qc-rib">${esc(p.promo_label)}</span>` : disc ? `<span class="qc-rib">${pct}%<br>OFF</span>` : (opts.best ? `<span class="qc-rib best">BEST<br>SELLER</span>` : '');
  const fav = `<button class="fav2 ${isSaved('product',p.id)?'on':''}" data-fav data-ftype="product" data-fid="${p.id}" data-fname="${esc(p.name)}" data-fprice="${p.price}" data-fimg="${esc(src)}" aria-label="Save ${esc(p.name)}">${I.heart}</button>`;
  return `<div class="pcard qc-card${oos?' oos-card':''}" data-nav="product" data-id="${p.id}" role="link" tabindex="0" aria-label="${esc(p.name)}, ${money(p.price)}">
    <div class="pimg">${photoLayer(src)}${dIcon({name:p.name, category_slug: biz&&biz.category_slug},'cart')}${rib}${fav}${oos?'<span class="qc-oos">Out of stock</span>':addCtl(p,src,biz)}</div>
    <div class="pb"><span class="qc-time">${gi('clock')} 15 MINS</span>
      <h4>${esc(p.name)}</h4>
      <div class="punit">${esc(p.unit||'1 unit')} · ${rating?`<span class="prate">${I.star}${rating}</span>`:'<span class="qc-new">New</span>'}</div>
      <div class="price">${money(p.price)}${disc?`<span class="old">${money(p.mrp)}</span>`:''}</div></div></div>`; }
function serviceCard(s){ return `<button class="brow" data-nav="business" data-id="${s.business_id||s.id}" style="text-align:left">
  <div class="thumb" style="background:${grad('#6366F1','#4338CA')}">${dIcon(s,'wrench')}</div>
  <div class="info"><h4>${esc(s.name)}</h4><div class="muted" style="font-size:12.5px;margin-top:2px">${esc(s.business||'')}</div>
    <div class="row" style="gap:8px;margin-top:7px">${stars(s.rating)}<span class="badge primary">from ${money(s.starting_price)}</span></div></div>
  <span class="chev" style="align-self:center;color:var(--faint);width:18px">${I.chev}</span></button>`; }
function newsCard(n){ return `<button class="ncard" data-nav="newsDetail" data-id="${n.id}" style="text-align:left">
  <div class="nimg" style="background:${grad(n.color1,n.color2)}">${gi('news')}</div>
  <div class="nb"><span class="badge neutral">${esc(n.category)}</span><h4 style="margin-top:7px">${esc(n.title)}</h4></div></button>`; }
function eventCard(e){ const d=new Date(e.start_date); const day=isNaN(d)?'--':d.getDate(); const mon=isNaN(d)?'':d.toLocaleString('en',{month:'short'}).toUpperCase();
  return `<div class="ecard"><div class="date"><b>${day}</b><span>${mon}</span></div>
    <div class="info" style="flex:1"><h4 style="font-size:14.5px">${esc(e.title)}</h4>
      <div class="muted" style="font-size:12px;margin-top:4px">${I.pin.replace('viewBox','style="width:12px;height:12px;vertical-align:-2px;fill:var(--muted)" viewBox')} ${esc(e.venue)}</div>
      <div class="muted" style="font-size:12px;margin-top:2px">${gi('clock')} ${esc(e.time_label||'')}</div></div></div>`; }

function sectionHead(title, action){ return `<div class="sec-head px"><h3>${esc(title)}</h3>${action?`<button class="see" data-nav="${action.route}" ${action.slug?`data-slug="${action.slug}"`:''}>${t('seeAll')}</button>`:''}</div>`; }

/* ---------- Noon-style components ---------- */
function nsecHead(title, route, slug){ return `<div class="nsec"><h3>${esc(title)}</h3>${route?`<button class="viewall" data-nav="${route}" ${slug?`data-slug="${slug}"`:''}>${t('seeAll')} ${I.chev}</button>`:''}</div>`; }
function heroCard(o){ const img=o.image_url||pic(coverKw({subcategory:o.business||'sale'})+',sale,offer', 700+(o.id||0), 900, 460);
  return `<button class="hcard" data-nav="business" data-id="${o.business_id}" style="background:${grad(o.color1,o.color2)}">${photoLayer(img)}
    <span class="htag">${esc(o.discount_label||'OFFER')}</span>
    <h3>${esc(o.title)}</h3><div class="hsub">${esc(o.business||'')}${o.description?' · '+esc(o.description):''}</div></button>`; }
function promoCard(o){ const code=o.code||('SAVE'+(o.id||1));
  const img=o.image_url||pic(coverKw({subcategory:o.business||'',category_name:o.business||''})+','+(o.title||'offer'),700+(o.id||0),600,400);
  return `<button class="offcard" data-nav="business" data-id="${o.business_id}">
    <div class="offcard-img">${photoLayer(img)}<span class="offcard-tag">${esc(o.discount_label||'OFFER')}</span></div>
    <div class="offcard-body">
      <h4>${esc(o.title)}</h4>
      <p>${esc(o.description||'Limited time offer')}</p>
      <div class="offcard-foot">
        <div class="offcard-brand"><span class="offcard-logo" style="background:${grad(o.color1||'#12A594',o.color2||'#0C6E64')}">${(o.business||'L')[0]}</span>
          <div><div class="offcard-bname">${esc(o.business||'Local Link')}</div><div class="offcard-code">${gi('tag')} ${esc(code)}</div></div></div>
        <span class="offcard-arrow">${I.chev}</span>
      </div></div></button>`; }
/* Stacked offer carousel (3D card stack) with swipe + prev/next + dots + paused auto-advance */
function renderOfferStack(el, offers){
  const items = (offers||[]).slice(0,5);
  if(!items.length){ el.innerHTML = emptyState('percent','No offers yet',''); return; }
  el.innerHTML = `<div class="ostack" id="ostk">${items.map((o,i)=>{
    const code=o.code||('SAVE'+(o.id||1));
    const img=o.image_url||pic(coverKw({subcategory:o.business||'',category_name:o.business||''})+','+(o.title||'offer'),700+(o.id||0),700,460);
    return `<div class="ostack-card" data-i="${i}" data-bid="${o.business_id}">
      <div class="os-img">${photoLayer(img)}</div><div class="os-shade"></div>
      <span class="os-tag">${esc(o.discount_label||'OFFER')}</span>
      <div class="os-body"><h4>${esc(o.title)}</h4><p>${esc(o.description||o.business||'')}</p>
        <div class="os-foot"><span class="os-code">${gi('tag')} ${esc(code)}</span><span class="os-go">Shop now ${I.chev}</span></div>
      </div></div>`; }).join('')}</div>
    <div class="ostack-ctrls"><button class="cnav prev" id="ostkPrev" aria-label="Previous">${I.chev}</button>
      <div class="ostack-dots" id="ostkDots">${items.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('')}</div>
      <button class="cnav next" id="ostkNext" aria-label="Next">${I.chev}</button></div>`;
  const cards=[...el.querySelectorAll('.ostack-card')]; let idx=0; let timer=null;
  const place=()=>{ cards.forEach((c,i)=>{ const off=i-idx; let tf,op,z,pe;
      if(off===0){ tf='translateX(-50%) translateY(0) scale(1)'; op=1; z=30; pe='auto'; }
      else if(off>0){ tf=`translateX(-50%) translateY(${Math.min(off,3)*16}px) scale(${1-Math.min(off,3)*0.055})`; op=off<=2?1:0; z=30-off; pe='none'; }
      else { tf='translateX(-50%) translateY(-34px) scale(0.94)'; op=0; z=1; pe='none'; }
      c.style.transform=tf; c.style.opacity=op; c.style.zIndex=z; c.style.pointerEvents=pe; });
    el.querySelectorAll('#ostkDots i').forEach((d,i)=>d.classList.toggle('on',i===idx));
    const pv=$('#ostkPrev'), nx=$('#ostkNext'); if(pv) pv.disabled=idx===0; if(nx) nx.disabled=idx===cards.length-1;
  };
  const go2=(n)=>{ idx=Math.max(0,Math.min(cards.length-1,n)); place(); };
  const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } };
  const auto=()=>{ stop(); timer=setInterval(()=>{ if(!document.getElementById('ostk')){ stop(); return; } idx=(idx+1)%cards.length; place(); },3000); };
  const bump=(n)=>{ stop(); go2(n); setTimeout(auto,3000); };
  place(); auto();
  $('#ostkPrev').onclick=()=>bump(idx-1);
  $('#ostkNext').onclick=()=>bump(idx+1);
  const stk=$('#ostk'); let sx=null;
  stk.addEventListener('pointerdown',e=>{ sx=e.clientX; stop(); });
  stk.addEventListener('pointerup',e=>{ if(sx===null) return; const dx=e.clientX-sx; sx=null;
    if(Math.abs(dx)>40){ if(dx<0) bump(idx+1); else bump(idx-1); }
    else { const top=cards[idx]; if(top&&top.dataset.bid) go('business',{id:Number(top.dataset.bid)}); setTimeout(auto,3000); }
  });
  stk.addEventListener('pointercancel',()=>{ sx=null; setTimeout(auto,3000); });
}
/* Wrap a horizontal scroll-row with prev/next arrows (desktop); swipe works everywhere */
function wireRowArrows(rowEl){
  if(!rowEl || rowEl._arrowed) return; rowEl._arrowed=true;
  const wrap=document.createElement('div'); wrap.className='crow-wrap';
  rowEl.parentNode.insertBefore(wrap, rowEl); wrap.appendChild(rowEl);
  const mk=(dir,cls)=>{ const b=document.createElement('button'); b.className='crow-arrow '+cls; b.setAttribute('aria-label',dir<0?'Previous':'Next'); b.innerHTML=I.chev;
    b.onclick=()=>rowEl.scrollBy({left:dir*rowEl.clientWidth*0.8,behavior:'smooth'}); return b; };
  const prev=mk(-1,'left prev'), next=mk(1,'right'); wrap.appendChild(prev); wrap.appendChild(next);
  const upd=()=>{ prev.disabled=rowEl.scrollLeft<8; next.disabled=rowEl.scrollLeft+rowEl.clientWidth>=rowEl.scrollWidth-8; };
  rowEl.addEventListener('scroll',upd,{passive:true}); setTimeout(upd,120); window.addEventListener('resize',upd);
}
/* Auto-advance a horizontal scroll-row one card every 3s; loop back to start at the end.
   Pauses while the user is interacting, then resumes. */
function autoAdvanceRow(rowEl, count){
  if(!rowEl || rowEl._auto) return; rowEl._auto=true;
  let paused=false, resumeT=null;
  const pause=()=>{ paused=true; if(resumeT) clearTimeout(resumeT); resumeT=setTimeout(()=>paused=false, 5000); };
  ['pointerdown','touchstart','wheel'].forEach(ev=>rowEl.addEventListener(ev,pause,{passive:true}));
  const step=()=>rowEl.clientWidth*0.86+12;
  const timer=setInterval(()=>{
    if(!document.body.contains(rowEl)){ clearInterval(timer); return; }
    if(paused) return;
    const atEnd = rowEl.scrollLeft + rowEl.clientWidth >= rowEl.scrollWidth - 10;
    rowEl.scrollTo({ left: atEnd ? 0 : rowEl.scrollLeft + step(), behavior:'smooth' });
  }, 3000);
}
/* demo cover photos for category tiles (icon tile shows if a photo can't load) */
const CAT_PHOTO = {
  'food-grocery':'1542838132-92c53300491e', 'shopping':'1489987707025-afc232f7ea0f', 'services':'1581578731548-c64695cc6952',
  'workers':'1504307651254-35680f356dfd', 'transport':'1449965408869-eaa3f722e40d', 'healthcare':'1576091160399-112ba8d25d1d',
  'local-info':'1477959858617-67f85cf4f1df', 'news':'1504711434969-e33886168f5c', 'events':'1492684223066-81342ee5ff30',
  'classifieds':'1556742049-0cfed4f6a45d', 'offers':'1607083206869-4c7672e72a8a', 'deals':'1607083206869-4c7672e72a8a'
};
function catPhoto(slug, label){ const id=CAT_PHOTO[slug]; return id ? `https://images.unsplash.com/photo-${id}?w=360&h=360&q=70&auto=format&fit=crop` : pic(label||slug, slug, 360, 360); }
function ncatCard(c){ const cc=c.color1||'#12A594';
  return `<button class="ncat" data-nav="category" data-slug="${c.slug}">
    <span class="tile catico" style="--cc:${cc}">${photoLayer(catPhoto(c.slug, c.name))}${catIcon(c.slug)}</span>
    <span>${esc(catLabel(c))}</span></button>`; }
function tileCard(label, kw, seed, route, slug){
  return `<button class="ncat" data-nav="${route}" ${slug?`data-slug="${slug}"`:''}>
    <span class="tile catico" style="--cc:#12A594">${photoLayer(catPhoto(slug||route, kw||label))}${catIcon(slug||route)}</span><span>${esc(label)}</span></button>`; }
/* live countdown for mega-deals */
let _cdTimer=null;
function startCountdown(){ if(_cdTimer) clearInterval(_cdTimer);
  const tick=()=>{ const el=document.getElementById('megacd'); if(!el){ clearInterval(_cdTimer); _cdTimer=null; return; }
    const end=new Date(); end.setHours(23,59,59,999); let s=Math.max(0,Math.floor((end-new Date())/1000));
    const hh=String(Math.floor(s/3600)).padStart(2,'0'), mm=String(Math.floor(s%3600/60)).padStart(2,'0'), ss=String(s%60).padStart(2,'0');
    el.innerHTML=`${gi('clock')}<span class="cbox">${hh}</span>:<span class="cbox">${mm}</span>:<span class="cbox">${ss}</span>`; };
  tick(); _cdTimer=setInterval(tick,1000);
}
/* vertical pills (Local Link verticals — Noon sub-brand row) */
const VERTICALS=[['all','store','All'],['food','fork','Food'],['grocery','cart','Grocery'],['services','wrench','Services'],['quick','bolt','Quick'],['workers','helmet','Workers'],['transport','car','Transport']];
function vpillsHtml(active){ return `<div class="vbar"><div class="vpills">${VERTICALS.map(([k,icn,lab])=>`<button class="vpill ${active===k?'on':''}" data-vert="${k}"><span class="gi">${GI[icn]}</span>${esc(lab)}</button>`).join('')}</div></div>`; }
function wireVerticals(el){ el.querySelectorAll('[data-vert]').forEach(b=>b.onclick=()=>{ const k=b.dataset.vert;
  const hd=b.closest('.qc-head'); if(hd && k!=='all'){ hd.style.setProperty('--tone',QC_TONES[k]); el.querySelectorAll('.qc-tab').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-selected',x===b); }); return setTimeout(()=>vertGo(k),220); }
  vertGo(k); }); }
function vertGo(k){
  if(k==='all'){ setTab('home'); return; }
  if(k==='food'){ go('category',{slug:'food-grocery',vfilter:'food',vlabel:'Food & Dining'}); return; }
  if(k==='grocery'){ go('category',{slug:'food-grocery',vfilter:'grocery',vlabel:'Grocery & Essentials'}); return; }
  if(k==='quick'){ go('category',{slug:'food-grocery',vfilter:'quick',vlabel:'Quick delivery'}); return; }
  const map={services:'services',workers:'workers',transport:'transport'};
  go('category',{slug:map[k]||'food-grocery'}); }
// which subcategories belong to each vertical filter
const VFILTERS={
  food:/restaurant|hotel|bakery|cake|meat|seafood|fish|cafe|biriyani|biryani|juice|dining|food/i,
  grocery:/grocery|supermarket|hypermarket|provision|mart|fruits|vegetable|store/i,
  quick:/grocery|supermarket|bakery|pharmac|meat|restaurant/i,
};
const ROTATE=['Search "biriyani"','Search "plumber"','Search "grocery"','Search "AC repair"','Search "gold necklace"','Search "salon"'];
const MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
function custControls(){ const dark=state.custTheme==='dark';
  return `<button class="hicon" data-ctheme title="Toggle theme">${dark?I.sun:MOON}</button>
    <div class="clang" data-mini-lang><button data-l="en" class="${state.lang==='en'?'on':''}">EN</button><button data-l="ml" class="${state.lang==='ml'?'on':''}">മ</button></div>`; }
function wireCustControls(el){ const th=el.querySelector('[data-ctheme]'); if(th) th.onclick=()=>{ toggleCustTheme(); routeRender(); };
  el.querySelectorAll('[data-mini-lang] [data-l]').forEach(b=>b.onclick=()=>{ if(state.lang===b.dataset.l)return; state.lang=b.dataset.l; localStorage.setItem('ll_lang',state.lang); renderShell(); }); }

/* delegate add-to-cart clicks */
document.addEventListener('click', (e) => {
  const ab = e.target.closest('[data-add]'); if(!ab) return;
  e.stopPropagation(); e.preventDefault();
  addToCart({ id:Number(ab.dataset.pid), name:ab.dataset.pname, price:Number(ab.dataset.pprice), mrp:Number(ab.dataset.pmrp)||0, unit:ab.dataset.punit||'', image:ab.dataset.pimg||'', biz:ab.dataset.pbiz||'', bizId:Number(ab.dataset.pbizid)||1 });
});
/* delegate inline steppers on product cards */
document.addEventListener('click', (e) => {
  const d=e.target.closest('[data-qdec],[data-qinc]'); if(!d) return;
  e.stopPropagation(); e.preventDefault();
  if(d.dataset.qinc) setQty(Number(d.dataset.qinc),1); else setQty(Number(d.dataset.qdec),-1);
  const cur=stack()[stack().length-1]; if(cur && cur.name==='cart') routeRender();
});
/* keyboard: Enter/Space opens role=link cards */
document.addEventListener('keydown', (e) => { if((e.key==='Enter'||e.key===' ') && e.target.matches && e.target.matches('[role="link"][data-nav]')){ e.preventDefault(); e.target.click(); } });
/* call button on business cards (login-gated like the store page) */
document.addEventListener('click', (e) => { const c=e.target.closest('[data-callbiz]'); if(!c) return; e.stopPropagation(); e.preventDefault(); e.stopImmediatePropagation();
  gateAction('call this business',()=>{ window.location.href='tel:'+c.dataset.callbiz; }); }, true);
/* delegate wishlist (heart) clicks */
document.addEventListener('click', (e) => {
  const fb = e.target.closest('[data-fav]'); if(!fb) return;
  e.stopPropagation(); e.preventDefault();
  toggleSaved({ type:fb.dataset.ftype||'product', id:fb.dataset.fid, name:fb.dataset.fname||'', price:Number(fb.dataset.fprice)||0, image:fb.dataset.fimg||'', sub:fb.dataset.fsub||'' });
  fb.classList.toggle('on', isSaved(fb.dataset.ftype||'product', fb.dataset.fid));
});
/* delegate nav clicks */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-add],[data-qdec],[data-qinc],[data-fav]')) return;
  const nb = e.target.closest('[data-nav]'); if (!nb) return;
  const r = nb.dataset.nav;
  if (r==='business') go('business',{id:Number(nb.dataset.id)});
  else if (r==='place') go('place',{id:nb.dataset.id});
  else if (r==='product') go('product',{id:Number(nb.dataset.id)});
  else if (r==='category') go('category',{slug:nb.dataset.slug});
  else if (r==='newsDetail') go('newsDetail',{id:Number(nb.dataset.id)});
  else if (r==='catlist') go('category',{slug:nb.dataset.slug});
  else go(r, nb.dataset.slug?{slug:nb.dataset.slug}:{});
});

/* ---------------- bottom nav ---------------- */
function renderBottomNav(){
  const holder = $('#navholder'); if(!holder) return;
  const cur = stack()[stack().length-1].name;
  if (cur==='chat' || cur==='p_chatThread'){ holder.innerHTML=''; return; }  // full-screen chat thread
  const tab=(r,icon,lab,extra='')=>`<button class="vtab ${cur===r?'on':''}" data-tabnav="${r}" ${cur===r?'aria-current="page"':''}><span class="vico">${icon}${extra}</span><span>${esc(lab)}</span></button>`;
  const talk=(lab,icon)=>`<button class="vtalk" data-tabnav="__talk" aria-label="${esc(lab)}"><span class="t-glow"></span><span class="t-ring"></span><span class="t-core">${icon}</span><span class="t-lab">${esc(lab)}</span></button>`;
  if (state.view==='customer'){
    if (['splash','location','intro','register','login','cart','checkout','orderDone','assistant'].includes(cur)){ holder.innerHTML=''; return; }
    const cb=`<span class="cartbadge" ${cartCount()?'':'hidden'}>${cartCount()}</span>`;
    if (cur==='product'){ holder.innerHTML='<div id="qcCartBar" class="qc-cartwrap onpd" aria-live="polite" hidden></div>'; renderCartBar(); return; }
    const hideBar=['cart','checkout','chat'].includes(cur);
    const askBtn=`<button class="lv-askt" data-tabnav="__talk" aria-label="Ask Local Link by voice"><span class="lv-askb"><i></i>${GI.mic}</span><span>Ask</span></button>`;
    holder.innerHTML = `${hideBar?'':'<div id="qcCartBar" class="qc-cartwrap" aria-live="polite" hidden></div>'}<nav class="bnav lvdock" aria-label="Main"><i class="cx-ind"></i>${tab('home',I.home,'Home')}${tab('categories',I.grid,'Categories')}${askBtn}${tab('orders',GI.package,'Orders')}${tab('account',I.user,'Account')}</nav>`;
    renderCartBar();
  } else if (state.view==='partner'){
    if (cur==='p_login'){ holder.innerHTML=''; return; }
    const addBtn=`<button class="vtab pd-addtab" data-tabnav="__talk" aria-label="Add product"><span class="vico pd-add">${I.plus}</span><span>Add</span></button>`;
    holder.innerHTML = `<nav class="bnav pdock" aria-label="Partner">${tab('p_dash',I.home,'Home')}${tab('p_products',I.store,'Products')}${addBtn}${tab('p_orders',I.bag,'Orders')}${tab('p_chats',GI.chat,'Chats','<span class="cartbadge pchatbadge" hidden></span>')}</nav>`;
    setTimeout(()=>{ try{ api('/partner/overview').then(d=>setPartnerChatBadge(d.usage&&d.usage.unreadChats)).catch(()=>{}); }catch(e){} }, 50);
  }
  holder.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=async()=>{ const r=b.dataset.tabnav;
    if(r==='__talk'){
      b.classList.remove('boing'); void b.offsetWidth; b.classList.add('boing');
      if(state.view==='customer') return openAsk('', {voice:true});
      try{ const d=await api('/partner/overview');
        if(d.plan && !d.plan.products) return setTab('p_plans');
        openAddProduct(d.businesses[0]); }catch(e){ toast(e.message); }
      return; }
    if(r==='ask'){ openAsk(); } else setTab(r); });
}

/* ==================== CUSTOMER SCREENS ==================== */
SCREENS.splash = (el) => {
  el.innerHTML = `<div class="splash splash-anim">
    <div class="splash-rings"><span></span><span></span><span></span></div>
    <div class="splash-logo">${logoMark(104)}</div>
    <h1 class="splash-title"><span class="w1">Local</span> <span class="w2">Link</span></h1><p class="splash-tag">Everything Local. One Place.</p>
    <div class="splash-load"><span></span></div></div>`;
  localStorage.setItem('ll_seen','1');
  if(!state.onboarded){ // default the area instead of asking; refine silently from GPS (demo maps to Kunnamangalam)
    state.areaId=state.areaId||1; state.areaName=state.areaName||'Kunnamangalam'; state.onboarded=true;
    localStorage.setItem('ll_area',state.areaId); localStorage.setItem('ll_area_name',state.areaName); localStorage.setItem('ll_onboarded','1');
    try{ navigator.geolocation && navigator.geolocation.getCurrentPosition(()=>{}, ()=>{}, {timeout:4000, maximumAge:600000}); }catch(e){}
  }
  const next = 'home';
  setTimeout(()=>{ if(stack()[stack().length-1].name==='splash'){ nav.customer=[{name: next}]; routeRender(); } }, 1200);
};

/* ---- onboarding flashcards (auto-advancing, skippable) ---- */
const INTRO_CARDS = [
  { icon:'compass', kw:'restaurant', title:'Your whole neighbourhood, in one app', text:'Restaurants, groceries, services, workers and rides near you — everything local, discovered in seconds.' },
  { icon:'cart', kw:'biryani', title:'Order in just a few taps', text:'Browse local menus and products, add to your cart and check out from the stores you love — fast.' },
  { icon:'chat', kw:'grocery', title:'Get the best local price', text:'Chat directly with stores, or post what you need and let local businesses come to you with offers.' },
  { icon:'star', kw:'cake', title:'Save with deals near you', text:'Grab exclusive offers and promo codes — and support the businesses in your own neighbourhood.' },
];
SCREENS.intro = (el) => {
  let idx=0; let timer=null; let manual=false;
  el.innerHTML = `<div class="intro-wrap">
    <button class="intro-skip" id="skip">Skip</button>
    <div class="intro-stack" id="stackc"></div>
    <div class="intro-foot">
      <div class="intro-dots" id="dots"></div>
      <div class="intro-btns">
        <button class="cnav prev" id="iprev" aria-label="Back">${I.chev}</button>
        <button class="btn intro-cta shine" id="cta"><span>Next</span></button>
        <button class="cnav next" id="inext" aria-label="Next">${I.chev}</button>
      </div>
    </div></div>`;
  const draw=()=>{
    $('#stackc').innerHTML = INTRO_CARDS.map((c,i)=>{
      const off=i-idx; const on=i===idx;
      return `<div class="intro-card ${on?'on':''}" style="transform:translate(-50%,${off*14}px) scale(${on?1:1-Math.abs(off)*0.05});opacity:${off<0?0:(Math.abs(off)>2?0:1)};z-index:${20-Math.abs(off)}">
        <div class="intro-img">${photoLayer(pic(c.kw,700+i,600,600))}<span class="intro-ic">${GI[c.icon]||I.star}</span></div>
        <div class="intro-body"><h2>${esc(c.title)}</h2><p>${esc(c.text)}</p></div></div>`;
    }).join('');
    $('#dots').innerHTML = INTRO_CARDS.map((_,i)=>`<i class="${i===idx?'on':''}" data-i="${i}"></i>`).join('');
    $('#cta').querySelector('span').textContent = idx>=INTRO_CARDS.length-1 ? 'Get started' : 'Next';
    const pv=$('#iprev'); if(pv) pv.disabled=idx===0;
    const nx=$('#inext'); if(nx) nx.disabled=idx>=INTRO_CARDS.length-1;
    el.querySelectorAll('#dots i').forEach(d=>d.onclick=()=>{ manual=true; stop(); idx=Number(d.dataset.i); draw(); });
  };
  const finish=()=>{ stop(); state.introSeen=true; localStorage.setItem('ll_intro','1'); nav.customer=[{name:'home'}]; routeRender(); };
  const go2=(n)=>{ idx=Math.max(0,Math.min(INTRO_CARDS.length-1,n)); draw(); };
  const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } };
  draw();
  $('#cta').onclick=()=>{ manual=true; stop(); if(idx>=INTRO_CARDS.length-1) finish(); else go2(idx+1); };
  $('#iprev').onclick=()=>{ manual=true; stop(); go2(idx-1); };
  $('#inext').onclick=()=>{ manual=true; stop(); go2(idx+1); };
  $('#skip').onclick=finish;
  // swipe left/right on the card stack
  const stk=$('#stackc'); let sx=null;
  stk.addEventListener('pointerdown',e=>{ sx=e.clientX; });
  stk.addEventListener('pointerup',e=>{ if(sx===null) return; const dx=e.clientX-sx; sx=null; if(Math.abs(dx)>40){ manual=true; stop(); go2(idx+(dx<0?1:-1)); } });
  // gentle auto-advance every 3s until the user takes control
  timer=setInterval(()=>{ const box=document.getElementById('stackc'); if(!box||manual){ stop(); return; } if(idx>=INTRO_CARDS.length-1){ stop(); return; } idx++; draw(); }, 3000);
};

SCREENS.location = (el) => {
  el.innerHTML = `<div class="auth-wrap">
    <div class="auth-hero">${logoMark(64)}<h2 style="font-size:22px">Discover what's around you</h2>
      <p class="muted" style="font-size:14px;max-width:280px">Find nearby businesses, services, offers, transport and local information — instantly.</p></div>
    <div class="card" style="padding:6px;margin-bottom:16px">
      <div class="plist" style="border:none">
        <button id="gps"><span class="ic">${I.pin}</span><div><div style="font-weight:600">Use my location</div><div class="muted" style="font-size:12px">Detect automatically (demo → Kunnamangalam)</div></div><span class="chev">${I.chev}</span></button>
      </div></div>
    <div class="muted" style="font-size:12px;font-weight:600;margin:6px 4px 10px">OR CHOOSE YOUR AREA</div>
    <div id="arealist" class="stack" style="gap:8px"></div>
    <div style="flex:1"></div></div>`;
  $('#gps').onclick = ()=>{
    const btn=$('#gps'); const sub=btn.querySelector('.muted');
    if(navigator.geolocation){ if(sub) sub.textContent='Detecting your location…';
      navigator.geolocation.getCurrentPosition(
        ()=>pickArea(1,'Kunnamangalam'),        // demo: map any coords to nearest seeded area
        ()=>pickArea(1,'Kunnamangalam'),        // denied/unavailable → sensible default
        { timeout:4000, maximumAge:600000 });
    } else pickArea(1,'Kunnamangalam');
  };
  const areasByP = {};
  ref.areas.forEach(a=>{ const p=ref.panchayaths.find(x=>x.id===a.panchayath_id); (areasByP[p?p.name:'Other']=areasByP[p?p.name:'Other']||[]).push(a); });
  $('#arealist').innerHTML = ref.areas.slice(0,8).map(a=>{ const p=ref.panchayaths.find(x=>x.id===a.panchayath_id);
    return `<button class="brow" data-area="${a.id}" data-name="${esc(a.name)}" style="padding:12px 14px">
      <div class="thumb" style="width:40px;height:40px;font-size:18px;background:${grad('#14B8A6','#0B5A55')}">${I.pin.replace('fill="currentColor"','fill="#fff"')}</div>
      <div class="info"><h4 style="font-size:14px">${esc(a.name)}</h4><div class="muted" style="font-size:12px">${esc(p?p.name:'')}, Kozhikode</div></div>
      <span class="chev" style="align-self:center;color:var(--faint);width:18px">${I.chev}</span></button>`; }).join('');
  el.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>pickArea(Number(b.dataset.area), b.dataset.name));
};
function pickArea(id,name){ state.areaId=id; state.areaName=name; state.onboarded=true;
  localStorage.setItem('ll_area',id); localStorage.setItem('ll_area_name',name); localStorage.setItem('ll_onboarded','1');
  const dest = state.introSeen ? 'home' : 'intro';
  nav.customer=[{name:dest}]; routeRender(); toast('Location set to '+name); }

const QC_TONES={all:'#0C8F82',food:'#E0573E',grocery:'#2E9D5B',services:'#3D6FD8',quick:'#C98A00',workers:'#8A55D6',transport:'#0B7FA8'};
function qcHeader(active){
  return `<header class="qc-head" style="--tone:${QC_TONES[active]||QC_TONES.all}">
    <div class="qc-top">
      <button class="qc-eta" data-tabnav-loc aria-label="Delivering to ${esc(state.areaName)}. Change area">
        <small>Local Link in</small><b>15 minutes</b>
        <span>${I.pin}<em>${esc(state.areaName)}, Kozhikode</em>${I.chev.replace('m9 6 6 6-6 6','m6 9 6 6 6-6')}</span></button>
      <div class="qc-acts">${custControls()}<button class="qc-ico" data-nav="saved" aria-label="Saved items">${I.heart}</button></div>
    </div>
    <div class="qc-search"><span aria-hidden="true">${I.search}</span>
      <button class="qc-stxt" data-nav="searchScreen" aria-label="Search"><span class="sq" id="rotsq">Search "biriyani"</span></button>
      <i class="qc-sdiv" aria-hidden="true"></i>
      <button class="qc-smic" id="askHome" aria-label="Ask Local Link by voice">${GI.mic}</button></div>
    <nav class="qc-tabs" role="tablist" aria-label="Browse">${VERTICALS.map(([k,icn,lab])=>`<button role="tab" aria-selected="${active===k}" class="qc-tab ${active===k?'on':''}" data-vert="${k}" style="--t:${QC_TONES[k]}"><span class="gi">${GI[icn]}</span>${esc(lab)}</button>`).join('')}</nav>
  </header>`;
}
SCREENS.home = async (el) => {
  el.innerHTML = `
    ${qcHeader('all')}
    <div id="orderPill"></div>
    ${state.introSeen?'':`<div class="qc-intro" id="introCard"><span class="qc-ii">${logoMark(34)}</span><div><b>${t('introT')}</b><small>${t('introS')}</small></div><button id="introOk" class="btn sm">${t('gotIt')}</button></div>`}
    <div id="near"></div>
    <div class="qc-greet"><b>${greetWord()}${token&&me?', '+esc(me.name.split(' ')[0]):''} 👋</b><span>Shops, food & services around ${esc(state.areaName)} — delivered fast.</span></div>
    <div class="qc-voice" role="button" tabindex="0" data-talk aria-label="Ask Local Link by voice">
      <span class="qc-vorb">${GI.mic}</span><span><b>${t('voiceT')}</b><small>${t('voiceS')}</small></span>
      <span class="wave" aria-hidden="true">${Array.from({length:7},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</span></div>
    <div class="nsec"><h3>${t('shopByCat')}</h3><button class="viewall" data-nav="categories">${t('seeAll')} ${I.chev}</button></div>
    <div class="qc-catgrid">${(ref.categories||[]).slice(0,8).map((c,i)=>`<button class="qc-cat" data-nav="category" data-slug="${c.slug}" style="--n:${i}"><span class="qc-catpic">${catIcon(c.slug)}</span><b>${esc(catLabel(c))}</b></button>`).join('')}</div>
    <div class="nsec"><h3>${t('topOffers')}</h3><button class="viewall" data-nav="offers">${t('seeAll')} ${I.chev}</button></div>
    <div class="hero" id="hero">${skeletonCards(1)}</div><div class="dots" id="dots"></div>
    <div id="promo"></div>
    <div id="deals"></div>
    
    <div id="prodsecs"></div>
    <div id="svcs"></div>
    <div id="updates"></div>
    <div style="height:96px"></div>`;
  wireVerticals(el); wireCustControls(el);
  const ask=$('#askHome'); if(ask) ask.onclick=()=>openAsk('', {voice:true});
  el.querySelectorAll('[data-talk]').forEach(b=>b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openAsk('',{voice:true}); } }));
  el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); openAsk('', {voice:true}); });
  const loc=el.querySelector('[data-tabnav-loc]'); if(loc) loc.onclick=()=>go('location');
  // rotating search placeholder
  const rot=$('#rotsq'); let ri=0; if(rot){ setInterval(()=>{ ri=(ri+1)%ROTATE.length; rot.textContent=ROTATE[ri]; },2600); }
  // skeleton section frames
  $('#promo').innerHTML = nsecHead('Offers for you','offers') + `<div id="promow"><div class="ostack">${skeletonCards(1)}</div></div>`;
  $('#deals').innerHTML = `<div class="nsec"><h3>Mega deals</h3><span class="countdown" id="megacd">${gi('clock')} --:--:--</span></div><div class="dealrow" id="dealw">${skeletonCards(3)}</div>`;
  $('#near').innerHTML = nsecHead(t('openNear'),'categories') + `<div class="hero" style="padding-top:2px" id="nearw">${skeletonCards(2)}</div>`;
  const iok=$('#introOk'); if(iok) iok.onclick=()=>{ state.introSeen=true; localStorage.setItem('ll_intro','1'); const c=$('#introCard'); c.classList.add('bye'); setTimeout(()=>c.remove(),350); };
  if(token) api('/orders').then(os=>{ const live=(os||[]).find(o=>!['completed','rejected','cancelled'].includes(o.status)); const el2=$('#orderPill'); if(!live||!el2) return;
    const MSG={pending:'is waiting for the store to accept',accepted:'was accepted',preparing:'is being prepared',ready:'is ready',out_for_delivery:'is on the way'};
    el2.innerHTML=`<button class="qc-pill" id="opGo"><span class="qc-pdot"></span><span><b>Your order from ${esc(live.business)}</b> ${MSG[live.status]||live.status.replace(/_/g,' ')}</span>${I.chev}</button>`;
    $('#opGo').onclick=()=>setTab('orders'); }).catch(()=>{});
  $('#svcs').innerHTML = nsecHead(t('popularServices'),'categories','services') + `<div class="px stack" id="svcw" style="gap:10px">${skeletonRow(2)}</div>`;
  $('#updates').innerHTML = nsecHead(t('localUpdates'),'news') + `<div class="hero" style="padding-top:2px" id="newsw">${skeletonCards(2)}</div><div class="px stack" id="evw" style="gap:10px;margin-top:8px"></div>`;
  const [offers, biz, deals, svcs, news, events, grocery, places] = await Promise.all([
    api('/offers'), api('/businesses?featured=1'), api('/products?deal=1&limit=10'),
    api('/services'), api('/news'), api('/events'), api('/products?category=food-grocery&limit=10'),
    api('/places?area_id='+state.areaId).catch(()=>[])
  ]);
  // real Google places (when a key is set) lead the Near You row, then featured seeded
  const near=[]; const seen=new Set();
  (places||[]).concat(biz).forEach(b=>{ const k=(b.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); near.push(b); } });
  // hero from offers
  $('#hero').innerHTML = offers.slice(0,5).map(heroCard).join('');
  $('#dots').innerHTML = offers.slice(0,5).map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('');
  const hero=$('#hero'); if(hero){ hero.addEventListener('scroll',()=>{ const i=Math.round(hero.scrollLeft/(hero.clientWidth*0.86+12)); $('#dots').querySelectorAll('i').forEach((d,x)=>d.classList.toggle('on',x===i)); },{passive:true}); if(offers.length>1){ wireRowArrows(hero); autoAdvanceRow(hero, Math.min(5,offers.length)); } }
  // offers for you — stacked card carousel (swipe / prev-next)
  renderOfferStack($('#promow'), offers);
  // mega deals — horizontal carousel with arrows
  $('#dealw').innerHTML = deals.slice(0,10).map((p,i)=>productCard(p,null,{best:i<2})).join('') || `<div class="px muted" style="font-size:13px">No deals right now.</div>`;
  if(deals.length) wireRowArrows($('#dealw'));
  startCountdown();
  // near you (real + seeded)
  near.sort((a,b)=>(b.is_open?1:0)-(a.is_open?1:0));
  $('#nearw').innerHTML = near.slice(0,10).map(businessCard).join('');
  // a category product row (grocery)
  if(grocery && grocery.length){ $('#prodsecs').innerHTML = nsecHead('Grocery & essentials','categories','food-grocery') + `<div class="dealrow" id="grocw">${grocery.slice(0,10).map(p=>productCard(p)).join('')}</div>`; wireRowArrows($('#grocw')); }
  // services
  $('#svcw').innerHTML = svcs.slice(0,4).map(serviceCard).join('');
  // updates
  $('#newsw').innerHTML = news.slice(0,5).map(newsCard).join('');
  $('#evw').innerHTML = (events.length?`<div class="nsec" style="padding-left:0;padding-right:0"><h3 style="font-size:15px">${t('events')}</h3></div>`:'') + events.slice(0,3).map(eventCard).join('');
};

SCREENS.categories = async (el) => {
  el.innerHTML = `<div class="addrbar" style="padding-top:16px"><div class="atext"><div class="atop">${t('categories')}</div></div></div>
    <button class="nsearch" data-nav="searchScreen">${I.search}<span class="sq">${esc(t('search'))}</span><span class="cambtn">${I.ai}</span></button>
    <div class="ncatgrid big" id="cg"></div><div style="height:96px"></div>`;
  $('#cg').innerHTML = ref.categories.map(ncatCard).join('');
};
SCREENS.explore = SCREENS.categories;  // alias

SCREENS.deals = async (el) => {
  el.innerHTML = `<div class="addrbar" style="padding-top:16px"><div class="atext"><div class="atop">Deals</div>
      <div class="asub">Best local discounts, ending soon</div></div>
      <span class="countdown" id="megacd">${gi('clock')} --:--:--</span></div>
    <div id="promo"></div>
    <div class="nsec"><h3>Mega deals</h3></div>
    <div class="pgrid2" id="dg">${skeletonRow(4)}</div><div style="height:96px"></div>`;
  const [offers, deals] = await Promise.all([api('/offers'), api('/products?deal=1&limit=40')]);
  $('#promo').innerHTML = nsecHead('Offers for you') + `<div id="dpromow"></div>`;
  renderOfferStack($('#dpromow'), offers);
  $('#dg').innerHTML = deals.map((p,i)=>productCard(p,null,{best:i<2})).join('') || emptyState('percent','No deals right now','Check back soon.');
  startCountdown();
};

SCREENS.cart = async (el) => {
  if(!cart.length){
    el.innerHTML = `${topbarBack('Your cart')}
      <div class="cart-empty"><div class="ce-ic">${GI.cart}</div>
        <h3>Your cart is empty</h3><p>What are you waiting for? Start adding local products.</p>
        <button class="btn" data-tabnav="home">Start shopping</button>
        <div class="promo" style="margin-top:20px;width:100%;max-width:320px;background:${grad('#12A594','#0C6E64')}"><h4>New here?</h4><div class="psub">Use code below on your first order</div><span class="pcode">${gi('tag')} COMBO249</span></div>
      </div>
      <div id="best"></div><div style="height:96px"></div>`;
    backWire(el); el.querySelector('[data-tabnav="home"]').onclick=()=>setTab('home');
    const biz = await api('/products?limit=8');
    $('#best').innerHTML = nsecHead('Bestsellers for you') + `<div class="dealrow">${biz.slice(0,8).map((p,i)=>productCard(p,null,{best:i<2})).join('')}</div>`;
    return;
  }
  const FREE=499, sub=cartTotal(), delivery = sub>=FREE?0:29, handling=0;
  const mrpSave = cart.reduce((t,i)=>t+(i.mrp&&i.mrp>i.price?(i.mrp-i.price)*i.qty:0),0);
  const saved = mrpSave + (delivery===0?29:0);
  const rows = cart.map(it=>`<div class="qc-line"><div class="cimg">${photoLayer(it.image||pic((it.name||'x').toLowerCase(),500+it.id,120,120))}</div>
    <div class="cinfo"><h4>${esc(it.name)}</h4><small>${esc(it.unit||'1 unit')}</small></div>
    <span class="qc-step sm" role="group" aria-label="Quantity of ${esc(it.name)}"><button data-dec="${it.id}" aria-label="Remove one">−</button><b>${it.qty}</b><button data-inc="${it.id}" aria-label="Add one">+</button></span>
    <div class="qc-lp"><b>${money(it.price*it.qty)}</b>${it.mrp&&it.mrp>it.price?`<s>${money(it.mrp*it.qty)}</s>`:''}</div></div>`).join('');
  el.innerHTML = `${topbarBack('Your cart')}
    <div class="qc-cart px">
      ${saved>0?`<div class="qc-save" role="status">${gi('percent')}<span>You're saving <b>${money(saved)}</b> on this order</span></div>`:''}
      <section class="qc-ship"><div class="qc-shiph"><span class="qc-clock">${gi('clock')}</span><div><b>Delivery in 15 minutes</b><small>Shipment of ${cartCount()} item${cartCount()>1?'s':''} from ${esc(cart[0].biz||'your store')}</small></div></div>
        ${rows}
        <button class="qc-more" data-nav="business" data-id="${cartBizId()||1}">${I.plus} Add more items</button></section>
      <div id="qcSugg"></div>
      <section class="qc-billc"><h4>Bill details</h4>
        <div class="bill-row"><span>${gi('news')} Items total ${mrpSave?`<em class="qc-savetag">Saved ${money(mrpSave)}</em>`:''}</span><span>${mrpSave?`<s>${money(sub+mrpSave)}</s> `:''}${money(sub)}</span></div>
        <div class="bill-row"><span>${GI.car} Delivery charge</span><span>${delivery===0?`<s>₹29</s> <b class="qc-free">FREE</b>`:money(delivery)}</span></div>
        <div class="bill-row"><span>${gi('package')} Handling charge</span><span><b class="qc-free">FREE</b></span></div>
        <div class="bill-row total"><span>Grand total</span><span>${money(sub+delivery+handling)}</span></div>
        ${delivery>0?`<div class="qc-freebar"><span>Add <b>${money(FREE-sub)}</b> more for FREE delivery</span><i style="--p:${Math.min(100,Math.round(sub/FREE*100))}%"></i></div>`:''}</section>
      <section class="qc-policy"><b>Cancellation policy</b><p>Orders can't be cancelled once the store starts packing. Refunds for missing or damaged items go back to your original payment method.</p></section>
    </div>
    <div style="height:150px"></div>
    <div class="qc-paybar"><div class="qc-addr">${I.pin}<span>Delivering to <b>${esc(state.areaName)}</b></span><button data-tabnav-loc2 aria-label="Change area">Change</button></div>
      <button class="qc-pay" id="checkout"><span><b>${money(sub+delivery)}</b><small>TOTAL</small></span><span>Proceed to pay ${I.chev}</span></button></div>`;
  backWire(el);
  el.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.inc),1); routeRender(); });
  el.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.dec),-1); routeRender(); });
  const ch=el.querySelector('[data-tabnav-loc2]'); if(ch) ch.onclick=()=>go('location');
  $('#checkout').onclick=()=>{ track('checkout_start'); gateAction('place your order',()=>go('checkout')); };
  api('/products?limit=10').then(ps=>{ const s=$('#qcSugg'); if(!s) return; const ids=new Set(cart.map(i=>i.id)); const list=(ps||[]).filter(p=>!ids.has(p.id)).slice(0,8);
    if(list.length) s.innerHTML=`<div class="qc-ph" style="margin-top:6px"><h3>You might also like</h3></div><div class="dealrow qc-sugg">${list.map(p=>productCard(p)).join('')}</div>`; }).catch(()=>{});
};

SCREENS.checkout = async (el) => {
  if(!cart.length){ setTab('cart'); return; }
  if(!token){ toast('Please log in'); return go('login'); }
  const a = safeParse(localStorage.getItem('ll_addr')) || { name: me?me.name:'', phone: me?me.phone:'', line:'', area: state.areaName };
  const delivery = cartTotal()>=499?0:29; const pay = cartTotal()+delivery;
  // single-store cart → fetch that store's accepted payment methods
  const bizId = cartBizId() || 1; let bizPay=['cash'], upiId=null, bizName=cart[0]?.biz||'';
  try{ const b=await api('/businesses/'+bizId); bizPay=(b.payment_methods&&b.payment_methods.length)?b.payment_methods:['cash']; upiId=b.upi_id; bizName=b.name||bizName; }catch(e){}
  const PM={ cash:['Cash on delivery',GI.card], card:['Card on delivery',GI.card], upi:['UPI'+(upiId?' · '+upiId:''),GI.chat] };
  const methods=bizPay.filter(m=>PM[m]);
  if(!methods.length) methods.push('cash');
  el.innerHTML = `${topbarBack('Checkout')}
    <div class="px" style="margin-top:8px">
      <div class="muted" style="font-size:12.5px;margin-bottom:8px">Ordering from <b style="color:var(--ink)">${esc(bizName)}</b></div>
      <div class="sec-lbl">Delivery address</div>
      <div class="field"><label>Full name</label><div class="input"><input id="cn" value="${esc(a.name||'')}"/></div></div>
      <div class="field"><label>Phone</label><div class="input"><input id="cp" value="${esc(a.phone||'')}" placeholder="+91…"/></div></div>
      <div class="field"><label>Address</label><div class="input"><textarea id="cl" rows="2" placeholder="House / building, street, landmark">${esc(a.line||'')}</textarea></div></div>
      <div class="field"><label>Area</label><div class="input"><input id="ca" value="${esc(a.area||state.areaName)}"/></div></div>
      <div class="sec-lbl" style="margin-top:16px">Payment method <span class="faint" style="font-weight:500;text-transform:none;letter-spacing:0">· accepted by this store</span></div>
      <div class="pay-opts" id="payopts">
        ${methods.map((m,i)=>`<button class="pay-opt ${i===0?'on':''}" data-pay="${m}"><span class="gi">${PM[m][1]}</span><span>${esc(PM[m][0])}</span><span class="tick">${I.chev}</span></button>`).join('')}
      </div>
      ${methods.includes('upi')&&upiId?`<div class="muted" style="font-size:12px;margin-top:8px">Pay to UPI ID <b style="color:var(--primary)">${esc(upiId)}</b> and pay the balance on delivery.</div>`:''}
      <div class="bill" style="margin-top:16px">
        <div class="bill-row"><span>Item total</span><span>${money(cartTotal())}</span></div>
        <div class="bill-row"><span>Delivery</span><span>${delivery===0?'FREE':money(delivery)}</span></div>
        <div class="bill-row total"><span>To pay</span><span>${money(pay)}</span></div></div>
      <div style="height:110px"></div>
    </div>
    <div class="cartbar"><div class="ct"><div class="lbl">To pay</div><div class="tot">${money(pay)}</div></div>
      <button class="btn" id="place">Place order</button></div>`;
  backWire(el);
  let payMethod=methods[0];
  el.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{ el.querySelectorAll('[data-pay]').forEach(x=>x.classList.remove('on')); b.classList.add('on'); payMethod=b.dataset.pay; });
  $('#place').onclick=async()=>{
    const name=$('#cn').value.trim(), phone=$('#cp').value.trim(), line=$('#cl').value.trim(), area=$('#ca').value.trim();
    if(!name||!phone||!line){ return toast('Please fill name, phone and address'); }
    localStorage.setItem('ll_addr', JSON.stringify({name,phone,line,area}));
    const summary=cart.map(i=>`${i.qty}× ${i.name}`).join(', ');
    // group items by business → one order per business
    const groups={}; cart.forEach(i=>{ (groups[i.bizId||1]=groups[i.bizId||1]||[]).push(i); });
    try{
      for(const [bizId,items] of Object.entries(groups)){
        const tot=items.reduce((n,i)=>n+i.qty*i.price,0)+(cartTotal()>=499?0:29);
        await api('/orders',{method:'POST',body:{business_id:Number(bizId),total:tot,
          item_summary:items.map(i=>`${i.qty}× ${i.name}`).join(', '),payment_method:payMethod,
          items_json:items.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,image:i.image||''}))}}).catch(()=>{});
      }
      track('order_placed',{total:pay}); cart=[]; saveCart(); toast('Order placed! 🎉'); nav.customer=[{name:'orders'}]; routeRender();
    }catch(e){ toast(e.message); }
  };
};

SCREENS.account = async (el) => {
  const loggedIn=!!token; const nm=loggedIn?me.name:'Guest';
  el.innerHTML = `<div class="cbrand" style="padding-top:16px"><span class="cbrand-logo">${logoMark(28)}</span><span class="cbrand-name">Account</span><div style="flex:1"></div>${custControls()}</div>
    <div class="acard"><h4>${loggedIn?esc(nm):'Welcome to Local Link'}</h4>
      <div class="asub">${loggedIn?esc(me.email||me.phone||''):'Log in to order, save favourites, enquire & review'}</div>
      ${loggedIn?'':`<span class="abtn" id="lg">Log in / Sign up</span>`}</div>
    <div class="qc-tiles"><button data-tabnav="orders"><span>${GI.package}</span>Orders</button><button data-nav="saved"><span>${I.heart}</span>Saved</button><button data-nav="offers"><span>${GI.percent}</span>Offers</button><button id="helpTile"><span>${GI.chat}</span>Help</button></div>
    <button class="btn block" id="installapp" style="margin:0 0 14px;display:${window.__llInstall?'inline-flex':'none'};gap:8px;align-items:center;justify-content:center">${GI.download||I.plus} Install Local Link app</button>
    <div class="acct-list">
      <button data-tabnav="orders"><span class="ic">${GI.package}</span> My Orders <span class="rt">${I.chev}</span></button>
      <button data-nav="saved"><span class="ic">${I.heart}</span> Saved / Wishlist <span class="rt">${I.chev}</span></button>
      <button id="bulkreq"><span class="ic">${GI.megaphone||I.tag}</span> Post a requirement <span class="rt">${I.chev}</span></button>
      <button data-nav="offers"><span class="ic">${GI.percent}</span> Offers & Deals <span class="rt">${I.chev}</span></button>
      <button data-nav="localinfo"><span class="ic">${GI.building}</span> ${t('localInfo')} <span class="rt">${I.chev}</span></button>
      <button data-nav="events"><span class="ic">${GI.calendar}</span> ${t('events')} <span class="rt">${I.chev}</span></button>
    </div>
    <div class="acct-list">
      <button id="langrow"><span class="ic">${I.globe}</span> Language <span class="rt">${state.lang==='ml'?'മലയാളം':'English'} ${I.chev}</span></button>
      <button><span class="ic">${I.pin}</span> Country / Region <span class="rt">Kozhikode, India ${I.chev}</span></button>
      <button data-tabnav="notifications"><span class="ic">${I.bell}</span> Notifications <span class="rt">${I.chev}</span></button>
      <button><span class="ic">${GI.shield}</span> Account security <span class="rt">${I.chev}</span></button>
    </div>
    <div class="acct-list">
      <a href="/partner"><span class="ic">${GI.store}</span> Sell on Local Link <span class="rt">${I.chev}</span></a>
      <button><span class="ic">${GI.chat}</span> Help & Support <span class="rt">${I.chev}</span></button>
      ${loggedIn?`<button id="out"><span class="ic" style="color:var(--error)">${I.logout}</span> Log out <span class="rt">${I.chev}</span></button>`:''}
    </div>
    <div class="acct-foot"><div class="socials"><span>${GI.chat}</span><span>${GI.megaphone}</span><span>${GI.news}</span></div>
      Local Link · Everything Local. One Place.<br>Version 21.0 · Kozhikode, Kerala</div>
    <div style="height:96px"></div>`;
  wireCustControls(el);
  const inst=$('#installapp');
  if(inst){ const reveal=()=>{ if(window.__llInstall) inst.style.display='inline-flex'; };
    document.addEventListener('ll-installable', reveal); reveal();
    inst.onclick=async()=>{ const p=window.__llInstall; if(!p){ toast('Open the browser menu → “Add to Home screen”'); return; }
      p.prompt(); try{ await p.userChoice; }catch(e){} window.__llInstall=null; inst.style.display='none'; }; }
  const lg=$('#lg'); if(lg) lg.onclick=()=>go('login');
  const ht=$('#helpTile'); if(ht) ht.onclick=()=>openAsk('');
  const br=$('#bulkreq'); if(br) br.onclick=()=>{ if(!token){ toast('Please log in to post a requirement'); return go('login'); } openBulkEnquiry(); };
  const out=$('#out'); if(out) out.onclick=()=>{ token=null; me=null; localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); toast('Logged out'); routeRender(); };
  const lang=$('#langrow'); if(lang) lang.onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};
SCREENS.profile = SCREENS.account;  // alias

SCREENS.saved = async (el) => {
  el.innerHTML = `${topbarBack('Saved / Wishlist')}<div class="px" id="l" style="margin-top:8px"></div><div style="height:90px"></div>`;
  backWire(el);
  if(!saved.length){ $('#l').innerHTML = emptyState('heart','No saved items yet','Tap the heart on any shop or product to save it here.'); return; }
  $('#l').innerHTML = `<div class="pgrid2" style="padding:0">${saved.map(s=>{
    const src=s.image||pic((s.name||'x').toLowerCase(),400+String(s.id).length,320,320);
    const nav = s.type==='business'?`data-nav="business" data-id="${s.id}"`:`data-nav="product" data-id="${s.id}"`;
    return `<div class="pcard" ${nav}><div class="pimg">${photoLayer(src)}<span class="fav2 on" data-fav data-ftype="${s.type}" data-fid="${s.id}" data-fname="${esc(s.name)}" data-fprice="${s.price||0}" data-fimg="${esc(src)}">${I.heart}</span></div>
      <div class="pb"><h4>${esc(s.name)}</h4>${s.type==='business'?`<div class="punit">${esc(s.sub||'Local shop')}</div>`:`<div class="price">${money(s.price)}</div>`}</div></div>`;
  }).join('')}</div>`;
};

SCREENS.product = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:340px;border-radius:0 0 30px 30px"></div>`;
  let p; try{ p = await api('/products/'+id); }catch(e){ el.innerHTML=`${topbarBack('Product')}<div class="px">${emptyState('bag','Product unavailable','')}</div>`; backWire(el); return; }
  const src = p.image_url || pic((p.name||'product').toLowerCase(), 500+(p.id||0), 800, 800);
  const disc = p.mrp && p.mrp>p.price; const pct = disc?Math.round((1-p.price/p.mrp)*100):0;
  const rating = p.rating ? Number(p.rating).toFixed(1) : null;
  const oos = p.stock_status==='out_of_stock';
  const prod = {...p, business:p.business, business_id:p.business_id};
  el.innerHTML = `
    <div class="pd-hero">${photoLayer(src)}${dIcon({name:p.name},'cart')}
      <div class="st-bar"><button class="st-ib" id="bk" aria-label="Back">${I.back}</button><span style="flex:1"></span>
        <button class="st-ib fav ${isSaved('product',p.id)?'on':''}" data-fav data-ftype="product" data-fid="${p.id}" data-fname="${esc(p.name)}" data-fprice="${p.price}" data-fimg="${esc(src)}" aria-label="Save">${I.heart}</button></div>
      ${p.promo_label?`<span class="pd-tag">${esc(p.promo_label)}</span>`:(disc?`<span class="pd-tag">${pct}% OFF</span>`:'')}</div>
    <section class="pd-sheet">
      <span class="qc-time">${gi('clock')} 15 MINS</span>
      <h1>${esc(p.name)}</h1>
      <p class="pd-unit">${esc(p.unit||'1 unit')} · ${rating?`<span class="prate">${I.star}${rating}</span>${p.review_count?` <small>(${p.review_count})</small>`:''}`:'<span class="qc-new">New</span>'}</p>
      <div class="pd-price"><b>${money(p.price)}</b>${disc?`<s>MRP ${money(p.mrp)}</s><em>Save ${money(p.mrp-p.price)}</em>`:''}</div>
      <p class="pd-tax">Inclusive of all taxes</p>
      <button class="pd-store" data-nav="business" data-id="${p.business_id}"><span>${GI.store}</span><div><small>Sold by</small><b>${esc(p.business)}</b></div>${I.chev}</button>
      <div class="pd-perks"><div>${gi('pin')}<b>Local shop</b><small>right in your area</small></div><div>${gi('shield')}<b>${oos?'Out of stock':'In stock'}</b><small>${esc(p.category_name||'Local')}</small></div><div>${gi('chat')}<b>Ask the store</b><small>chat or call</small></div></div>
      ${p.description?`<h3 class="pd-h">About this item</h3><p class="pd-desc">${esc(p.description)}</p>`:''}
      <div id="related"></div><div style="height:120px"></div></section>
    <div class="pd-bar">${oos?`<button class="btn block" disabled style="opacity:.6">Out of stock</button>`:`
      <div><b>${money(p.price)}</b>${disc?`<s>${money(p.mrp)}</s>`:''}<small>${esc(p.unit||'1 unit')}</small></div>
      <span class="pd-ctl">${addCtl(prod,src)}</span>`}</div>`;
  $('#bk').onclick=back;
  if(p.related && p.related.length){ $('#related').innerHTML = `<h3 class="pd-h">You may also like</h3><div class="dealrow" style="margin:0 -16px">${p.related.map(r=>productCard(r)).join('')}</div>`; }
};

SCREENS.category = async (el, {slug, vfilter, vlabel}) => {
  const cat = ref.categories.find(c=>c.slug===slug) || {name:'Category', slug:'', kind:'business'};
  const vre = vfilter && VFILTERS[vfilter];
  const pageTitle = vlabel || catLabel(cat);
  // Non-business kinds keep their focused list
  if (cat.kind==='worker' || cat.kind==='driver' || cat.kind==='info' || slug==='news' || slug==='events'){
    el.innerHTML = `${topbarBack(catLabel(cat))}<div class="px stack" id="list" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
    backWire(el);
    if (cat.kind==='worker'){ renderWorkers($('#list'), await api('/workers')); }
    else if (cat.kind==='driver'){ renderDrivers($('#list'), await api('/drivers')); }
    else if (cat.kind==='info'){ renderLocalInfo($('#list'), await api('/local-info')); }
    else if (slug==='news'){ setTab('news'); }
    else if (slug==='events'){ $('#list').innerHTML = (await api('/events')).map(eventCard).join(''); }
    return;
  }
  // Business categories → rich Noon-style landing page
  const kw = vfilter ? vfilter : coverKw({subcategory:cat.name, category_name:cat.name});
  el.innerHTML = `${topbarBack(pageTitle)}
    <div class="qc-split">
      <aside class="qc-rail subchips" id="subchips" role="tablist" aria-label="Sub-categories"></aside>
      <main class="qc-pane">
        <div class="cathero">${photoLayer(pic(kw,900+(cat.id||0),900,360))}<h2>${esc(pageTitle)}</h2></div>
        <div id="catitems"></div>
        <div id="catoffers"></div>
        <div id="cattop"></div>
        <div class="qc-ph"><h3>All ${esc(catLabel(cat))}</h3><span class="muted" id="qcCount"></span></div>
        <div class="stack" id="list" style="gap:10px">${skeletonRow(4)}</div></main></div><div style="height:90px"></div>`;
  backWire(el);
  const [biz, prods, offers, places] = await Promise.all([
    api(`/businesses?category=${slug}`), api(`/products?category=${slug}&limit=12`),
    api('/offers'), api(`/places?category=${slug}&area_id=${state.areaId}`).catch(()=>[])
  ]);
  // Merge live Google places (if any) ahead of seeded, de-duped by name
  const seen=new Set(); let merged=[];
  (places||[]).forEach(p=>{ if(!seen.has(p.name.toLowerCase())){ seen.add(p.name.toLowerCase()); merged.push(p); } });
  biz.forEach(b=>{ if(!seen.has((b.name||'').toLowerCase())){ seen.add((b.name||'').toLowerCase()); merged.push(b); } });
  // vertical filter (Food vs Grocery vs Quick) → keep only matching subcategories
  let prodsF = prods;
  if(vre){ merged = merged.filter(b=>vre.test((b.subcategory||'')+' '+(b.name||''))); }
  // sub-category chips
  const subs=[...new Set(merged.map(b=>b.subcategory).filter(Boolean))].slice(0,10);
  const subIc=(t)=>`<i>${GI[iconKeyFor({subcategory:t,name:t},'store')]||GI.store}</i>`;
  $('#subchips').innerHTML = `<button class="subchip on" role="tab" aria-selected="true" data-sub=""><i>${catIcon(slug)}</i><span>All</span></button>` + subs.map(s=>`<button class="subchip" role="tab" aria-selected="false" data-sub="${esc(s)}">${subIc(s)}<span>${esc(s)}</span></button>`).join('');
  // category offers
  const catBizIds=new Set(biz.map(b=>b.id));
  const catOffers=(offers||[]).filter(o=>catBizIds.has(o.business_id));
  if(catOffers.length) $('#catoffers').innerHTML = `<div class="qc-ph"><h3>Offers</h3></div><div class="promorow">${catOffers.map(promoCard).join('')}</div>`;
  // top rated
  const top=[...merged].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,8);
  if(top.length) $('#cattop').innerHTML = `<div class="qc-ph"><h3>${slug==='food-grocery'?'Top restaurants & stores':'Top rated'}</h3></div><div class="hero qc-toprail">${top.map(b=>`<button class="qc-store" data-nav="${b.source==='google'?'place':'business'}" data-id="${b.id}"><span class="qc-sl" style="background:${grad(b.color1||'#0EA5A4',b.color2||'#0B5A55')}">${dIcon(b)}</span><b>${esc(b.name)}</b><small>${I.star}${Number(b.rating||4.2).toFixed(1)}</small></button>`).join('')}</div>`;
  // popular items / dishes (respect the vertical filter)
  if(vre){ const ids=new Set(merged.map(b=>b.id)); prodsF=(prods||[]).filter(p=>ids.has(p.business_id)); }
  if(prodsF && prodsF.length) $('#catitems').innerHTML = `<div class="qc-ph"><h3>${vfilter==='grocery'?'Popular products':'Popular items'}</h3></div><div class="pgrid2 qc-grid">${prodsF.map((p,i)=>productCard(p,null,{best:i<1})).join('')}</div>`;
  // full list + subcategory filter
  const draw=(items)=>{ const c=$('#qcCount'); if(c) c.textContent=items.length+' places'; $('#list').innerHTML = items.length? items.map(b=>bizRow(b)).join('') : emptyState('search','Nothing here yet','Try another area.'); };
  draw(merged);
  $('#subchips').addEventListener('click', e=>{ const b=e.target.closest('.subchip'); if(!b)return;
    el.querySelectorAll('#subchips .subchip').forEach(x=>{ x.classList.remove('on'); x.setAttribute('aria-selected','false'); }); b.classList.add('on'); b.setAttribute('aria-selected','true');
    const s=b.dataset.sub; draw(s? merged.filter(x=>x.subcategory===s) : merged); });
};
function bizRow(b){ const navr=b.source==='google'?'place':'business';
  return `<button class="brow" data-nav="${navr}" data-id="${b.id}" style="text-align:left">
  <div class="thumb" style="background:${grad(b.color1,b.color2)};overflow:hidden;position:relative">${b.cover_url?photoLayer(b.cover_url):''}${dIcon(b)}</div>
  <div class="info"><div class="row" style="justify-content:space-between"><h4>${esc(b.name)}</h4>${stars(b.rating)}</div>
    <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(b.subcategory||'')} · ${esc(b.area_name||'')}</div>
    <div class="row" style="gap:7px;margin-top:7px"><span class="badge ${b.is_open?'open':'closed'}">${b.is_open?t('openNow'):'Closed'}</span>
      <span class="muted" style="font-size:11.5px">${esc(b.hours_label||'')}</span></div></div></button>`; }

/* Google-place detail (real place from Google, no local products) */
SCREENS.place = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:190px;border-radius:0"></div>`;
  let p; try { p = await api('/places/'+id); } catch(e){ el.innerHTML = `${topbarBack('Place')}<div class="px">${emptyState('search','Place unavailable','Open it again from the list.')}</div>`; backWire(el); return; }
  const wa=(p.whatsapp||'').replace(/[^0-9]/g,'');
  el.innerHTML = `
    <div class="detail-cover" style="background:${grad('#12A594','#0C7A6E')}">${p.cover_url?photoLayer(p.cover_url):''}
      <button class="back" id="bk">${I.back}</button><span class="logo">${dIcon({name:p.name})}</span></div>
    <div class="px" style="margin-top:-26px;position:relative">
      <div class="card" style="padding:15px">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div><h2 style="font-size:20px">${esc(p.name)}</h2>
            <div class="muted" style="font-size:13px;margin-top:3px">${esc(p.subcategory||'Local place')} · ${esc(p.area_name||'')}</div></div>
          ${p.rating?stars(p.rating):''}</div>
        <div class="row" style="gap:8px;margin-top:10px">${p.is_open?'<span class="badge open">Open now</span>':''}
          <span class="muted" style="font-size:12px">${p.review_count?p.review_count+' Google reviews':''}</span>
          <span class="badge neutral">${gi('pin')} Google</span></div>
        <div class="muted" style="font-size:12.5px;margin-top:8px;display:flex;gap:6px">${I.pin.replace('fill="currentColor"','fill="var(--faint)" style="width:14px;height:14px;flex:0 0 auto"')} ${esc(p.address||'')}</div>
        <div class="actionbar" style="display:flex;gap:8px;margin-top:14px">
          ${p.phone?`<a class="btn sm" href="tel:${p.phone}">${I.phone} Call</a>`:''}
          ${wa?`<a class="btn sm accent" href="https://wa.me/${wa}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>`:''}
          <a class="btn sm ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name+' '+(p.address||''))}${p.place_id?'&query_place_id='+p.place_id:''}" target="_blank" rel="noopener">${I.dir} Directions</a>
        </div>
      </div>
      ${(p.photos&&p.photos.length>1)?`<div class="hero" style="padding:14px 0">${p.photos.map(u=>`<div class="hcard" style="flex:0 0 70%;background:var(--surface-2)">${photoLayer(u)}</div>`).join('')}</div>`:''}
      <div style="height:90px"></div></div>`;
  $('#bk').onclick=back;
};

function renderWorkers(elm,data){ elm.innerHTML = data.map(w=>`
  <div class="brow"><div class="thumb" style="background:${grad(w.color1,w.color2)}">${dIcon(w,'helmet')}</div>
    <div class="info"><div class="row" style="justify-content:space-between"><h4>${esc(w.name)}</h4>${stars(w.rating)}</div>
      <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(w.skills)}</div>
      <div class="row" style="gap:7px;margin-top:7px"><span class="badge primary">${esc(w.rate)}</span><span class="badge ${w.available?'open':'neutral'}">${w.available?'Available':'Busy'}</span>
        <span class="muted" style="font-size:11.5px">${w.experience_years}y exp · ${esc(w.area_name||'')}</span></div>
      <div class="row" style="gap:8px;margin-top:9px">
        <a class="btn sm" href="tel:${w.phone}">${I.phone} Call</a>
        <a class="btn sm accent" href="https://wa.me/${(w.whatsapp||'').replace(/[^0-9]/g,'')}" target="_blank" rel="noopener">${I.wa} WhatsApp</a></div>
    </div></div>`).join(''); }
function renderDrivers(elm,data){ elm.innerHTML = data.map(d=>`
  <div class="brow"><div class="thumb" style="background:${grad('#0EA5E9','#0369A1')}">${driverIcon(d.service_type)}</div>
    <div class="info"><div class="row" style="justify-content:space-between"><h4>${esc(d.name)}</h4>${stars(d.rating)}</div>
      <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(d.vehicle_model)} · ${esc(d.vehicle_number)}</div>
      <div class="row" style="gap:7px;margin-top:7px"><span class="badge accent">${esc(d.fare_note)}</span><span class="badge ${d.available?'open':'neutral'}">${d.available?'Available':'Offline'}</span></div>
      <div class="row" style="gap:8px;margin-top:9px"><a class="btn sm" href="tel:${d.phone}">${I.phone} Call</a>
        <a class="btn sm accent" href="https://wa.me/${(d.whatsapp||'').replace(/[^0-9]/g,'')}" target="_blank" rel="noopener">${I.wa} Book</a></div>
    </div></div>`).join(''); }
function renderLocalInfo(elm,data){ const groups={}; data.forEach(i=>(groups[i.category]=groups[i.category]||[]).push(i));
  elm.innerHTML = Object.entries(groups).map(([g,items])=>`
    <div class="sec-head" style="margin:6px 0 8px"><h3 style="font-size:15px">${esc(g)}</h3></div>
    ${items.map(i=>`<div class="brow" style="margin-bottom:10px"><div class="thumb" style="width:56px;height:56px;font-size:24px;background:${i.emergency?grad('#EF4444','#B91C1C'):grad('#14B8A6','#0F766E')}">${dIcon({name:i.name,category:i.category},'building')}</div>
      <div class="info"><h4 style="font-size:14.5px">${esc(i.name)}</h4><div class="muted" style="font-size:12px;margin-top:3px">${esc(i.description)}</div>
        <div class="muted" style="font-size:11.5px;margin-top:3px">${esc(i.hours||'')}</div></div>
      <a class="btn sm" style="align-self:center" href="tel:${i.phone}">${I.phone}</a></div>`).join('')}`).join(''); }

SCREENS.business = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:220px;border-radius:0 0 30px 30px"></div><div class="px" style="margin-top:14px">${skeletonRow(3)}</div>`;
  const b = await api(`/businesses/${id}`); track('shop_view',{id});
  const wa = (b.whatsapp||'').replace(/[^0-9]/g,'');
  const cover = b.cover_url || pic(coverKw(b), b.id, 900, 480);
  const first = b.products.length ? 'products' : b.services.length ? 'services' : 'about';
  el.innerHTML = `
    <div class="st-hero" style="--c1:${b.color1||'#0C8F82'};--c2:${b.color2||'#0A5C55'}">${photoLayer(cover)}<span class="st-shade"></span>
      <div class="st-bar"><button class="st-ib" id="bk" aria-label="Back">${I.back}</button><span style="flex:1"></span>
        <button class="st-ib" data-nav="searchScreen" aria-label="Search">${I.search}</button><button class="st-ib" id="shareb" aria-label="Share">${I.share}</button>
        <button class="st-ib fav ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}" aria-label="Save store">${I.heart}</button></div></div>
    <section class="st-card">
      <div class="st-logo" style="background:${grad(b.color1||'#0EA5A4',b.color2||'#0B5A55')}">${dIcon(b)}</div>
      <h1>${esc(b.name)}</h1>
      <p class="st-sub">${esc(b.subcategory||b.category_name||'')} · ${esc(b.area_name||'')}</p>
      <div class="st-meta">
        <span class="st-rate">${I.star}${Number(b.rating||0).toFixed(1)}<small>${b.review_count} ratings</small></span>
        <span class="st-open ${b.is_open?'on':''}">${b.is_open?'Open now':'Closed'}<small>${esc(b.hours_label||'')}</small></span>
        <span class="st-cat">${dIcon(b)}<small>${esc(b.category_name||'')}</small></span></div>
      <p class="st-addr">${I.pin}<span>${esc(b.address||'')}</span></p>
      <div class="st-acts">
        <button id="callb">${I.phone}<span>${t('call')}</span></button>
        <button id="wab">${I.wa}<span>${t('whatsapp')}</span></button>
        <a href="https://maps.google.com/?q=${encodeURIComponent(b.name+' '+(b.address||''))}" target="_blank" rel="noopener">${I.dir}<span>${t('directions')}</span></a>
        ${b.can_chat?`<button id="chatbtn" class="hot">${GI.chat}<span>Chat</span></button>`:`<button id="enqtop">${GI.megaphone}<span>${t('enquire')}</span></button>`}</div>
    </section>
    ${b.offers.length?`<div class="st-coupons">${b.offers.map(o=>`<div class="st-coupon"><span class="st-cpi">${GI.percent}</span><div><b>${esc(o.discount_label)}</b><small>${esc(o.title)}</small></div></div>`).join('')}</div>`:''}
    <nav class="st-tabs" id="tabs" role="tablist">
      ${b.products.length?`<button role="tab" data-t="products">${t('products')} <i>${b.products.length}</i></button>`:''}
      ${b.services.length?`<button role="tab" data-t="services">${t('services')} <i>${b.services.length}</i></button>`:''}
      ${b.offers.length?`<button role="tab" data-t="offers">${t('offers')}</button>`:''}
      <button role="tab" data-t="about">${t('about')}</button>
      <button role="tab" data-t="reviews">${t('reviews')} <i>${b.reviews.length}</i></button></nav>
    <div id="tabbody" class="st-body"></div><div style="height:110px"></div>`;
  $('#bk').onclick=back; $('#shareb').onclick=(e)=>{e.preventDefault(); toast('Link copied to share');};
  const chatb=$('#chatbtn'); if(chatb) chatb.onclick=()=>gateAction('chat with this store',()=>go('chat',{id:b.id,name:b.name}));
  const enqt=$('#enqtop'); if(enqt) enqt.onclick=()=>openEnquiry(b);
  const callb=$('#callb'); if(callb) callb.onclick=()=>gateAction('call this business',()=>{ window.location.href='tel:'+b.phone; });
  const wab=$('#wab'); if(wab) wab.onclick=()=>gateAction('message this business on WhatsApp',()=>{ window.open('https://wa.me/'+wa,'_blank','noopener'); });
  const avg = b.reviews.length ? b.reviews.reduce((a,r)=>a+(r.rating||0),0)/b.reviews.length : (b.rating||0);
  const bodies = {
    products: ()=>`<div class="st-menu">${b.products.map(p=>{ const src=p.image_url||pic((p.name||'product').toLowerCase(),500+(p.id||0)); const disc=p.mrp&&p.mrp>p.price;
      return `<article class="st-item" data-nav="product" data-id="${p.id}" role="link" tabindex="0">
        <div class="st-it"><span class="st-veg"></span><h4>${esc(p.name)}</h4>
          <div class="st-price"><b>${money(p.price)}</b>${disc?`<s>${money(p.mrp)}</s><em>${Math.round((1-p.price/p.mrp)*100)}% off</em>`:''}</div>
          ${p.unit?`<small>${esc(p.unit)}</small>`:''}${p.description?`<p>${esc(p.description)}</p>`:''}</div>
        <div class="st-ip">${photoLayer(src)}${dIcon({name:p.name},'cart')}${p.stock_status==='out_of_stock'?'<span class="qc-oos">Out of stock</span>':addCtl({...p,business:b.name,business_id:b.id},src,b)}</div></article>`; }).join('')}</div>`,
    services: ()=>`<div class="st-menu">${b.services.map(sv=>`<article class="st-item svc"><div class="st-it"><h4>${esc(sv.name)}</h4>
        <div class="st-price"><b>from ${money(sv.starting_price)}</b></div>${sv.description?`<p>${esc(sv.description)}</p>`:''}</div>
        <div class="st-ip svc">${dIcon(sv,'wrench')}<button class="qc-add" data-req="${esc(sv.name)}">REQUEST</button></div></article>`).join('')}</div>`,
    offers: ()=>`<div class="stack" style="gap:11px">${b.offers.map(o=>`<div class="ocard" style="width:auto;background:${grad(o.color1,o.color2)}"><span class="badge tag">${esc(o.discount_label)}</span><div><h4>${esc(o.title)}</h4><div class="biz">${esc(o.description||'')}</div></div><span class="disc">%</span></div>`).join('')}</div>`,
    about: ()=>`<p class="st-desc">${esc(b.description||'')}</p>
      <div class="st-info"><div><span>Category</span><b>${esc(b.category_name)}</b></div><div><span>Hours</span><b>${esc(b.hours_label)}</b></div>
        <div><span>Phone</span>${token?`<b>${esc(b.phone)}</b>`:`<button id="revealph">Sign up to view</button>`}</div></div>
      <button class="btn block" style="margin-top:14px" id="enqbtn">${t('enquire')}</button>`,
    reviews: ()=>`<div class="st-rsum"><div><b>${Number(avg).toFixed(1)}</b>${stars(avg)}<small>${b.reviews.length} review${b.reviews.length===1?'':'s'}</small></div>
        <div class="st-bars">${[5,4,3,2,1].map(n=>{ const c=b.reviews.filter(r=>Math.round(r.rating)===n).length; return `<p><span>${n}★</span><i style="--w:${b.reviews.length?Math.round(c/b.reviews.length*100):0}%"></i><span>${c}</span></p>`; }).join('')}</div></div>
      <button class="btn ghost block sm" id="addrev" style="margin:12px 0">${I.star} Write a review</button>
      <div class="stack" style="gap:10px">${b.reviews.length?b.reviews.map(r=>`<div class="st-rev"><div class="row" style="justify-content:space-between"><b>${esc(r.author_name)}</b>${stars(r.rating)}</div><p>${esc(r.comment)}</p></div>`).join(''):emptyState('star','No reviews yet','Be the first to review.')}</div>`,
  };
  const showTab = (name)=>{ $('#tabbody').innerHTML = bodies[name](); wireTabBody(b);
    $('#tabs').querySelectorAll('button').forEach(x=>{ const on=x.dataset.t===name; x.classList.toggle('on',on); x.setAttribute('aria-selected',on); }); };
  showTab(first);
  $('#tabs').addEventListener('click', e=>{ const btn=e.target.closest('button'); if(btn) showTab(btn.dataset.t); });
};
function wireTabBody(b){
  const enq=$('#enqbtn'); if(enq) enq.onclick=()=>openEnquiry(b);
  const rev=$('#addrev'); if(rev) rev.onclick=()=>openReview(b);
  const rp=$('#revealph'); if(rp) rp.onclick=()=>gateAction('view contact details',()=>{});
  document.querySelectorAll('[data-req]').forEach(x=>x.onclick=()=>{ if(!token) return openLoginPrompt(); toast('Service request sent to '+b.name); });
}

SCREENS.searchScreen = async (el) => {
  const recent = safeParse(localStorage.getItem('ll_recent'))||[];
  el.innerHTML = `<div class="sr-top"><button class="st-ib flat" id="__back" aria-label="Back">${I.back}</button>
      <div class="sr-box">${I.search}<input id="sq" placeholder="${t('search')}" autofocus aria-label="Search"/><button class="qc-smic" id="srMic" aria-label="Ask by voice">${GI.mic}</button></div></div>
    <div class="px" id="sres">
      ${recent.length?`<div class="sr-h"><b>Recent searches</b><button id="srClr">Clear</button></div><div class="sr-chips">${recent.map(x=>`<button class="sr-chip" data-q="${esc(x)}">${I.search}${esc(x)}</button>`).join('')}</div>`:''}
      <div class="sr-h"><b>Trending near you</b></div>
      <div class="sr-trend" id="pop">${[['Biriyani','fork'],['Plumber','wrench'],['Grocery','cart'],['AC repair','snow'],['Auto','car'],['Salon','scissors'],['Pharmacy','cross'],['Cake','bread']].map(([x,ic],i)=>`<button data-q="${x}" style="--n:${i}"><span>${GI[ic]||GI.store}</span>${x}</button>`).join('')}</div>
      <button class="qc-voice sr-ask" id="askfromsearch" role="button"><span class="qc-vorb">${GI.mic}</span><span><b>${t('askTitle')}</b><small>Describe what you need — we'll find it</small></span></button>
    </div><div style="height:90px"></div>`;
  backWire(el);
  const clr=$('#srClr'); if(clr) clr.onclick=()=>{ localStorage.removeItem('ll_recent'); routeRender(); };
  $('#srMic').onclick=()=>openAsk('',{voice:true});
  const input=$('#sq'); let tmr; let last=null;
  const state2={sort:'relevance', openNow:false};
  const filterBar=()=>`<div class="hscroll srchfilt" style="padding:0;margin-bottom:12px">
    ${[['relevance','Relevance'],['price','Price ↑'],['rating','Top rated']].map(s=>`<button class="chip ${state2.sort===s[0]?'on':''}" data-sort="${s[0]}">${s[1]}</button>`).join('')}
    <button class="chip ${state2.openNow?'on':''}" data-open="1">Open now</button></div>`;
  const draw=()=>{ const r=last; if(!r) return;
    let biz=r.businesses.slice(), prods=r.products.slice();
    if(state2.openNow) biz=biz.filter(b=>b.is_open);
    if(state2.sort==='rating') biz.sort((a,b)=>(b.rating||0)-(a.rating||0));
    if(state2.sort==='price') prods.sort((a,b)=>(a.price||0)-(b.price||0));
    const total=biz.length+prods.length+r.services.length+r.workers.length+r.drivers.length;
    if(!total){ $('#sres').innerHTML=filterBar()+emptyState('search','No results','Try a different term or turn off filters.'); wireFilters(); return; }
    let html=filterBar();
    if(biz.length) html+=`<div class="sec-head" style="margin:4px 0 8px"><h3 style="font-size:14px">Businesses</h3></div>`+biz.map(bizRow).join('');
    if(r.services.length) html+=`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:14px">Services</h3></div>`+r.services.map(serviceCard).join('');
    if(prods.length) html+=`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:14px">Products</h3></div><div class="grid2">`+prods.map(p=>productCard(p)).join('')+`</div>`;
    if(r.workers.length){ html+=`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:14px">Workers</h3></div><div class="stack" id="wl" style="gap:11px"></div>`; }
    $('#sres').innerHTML=html; if(r.workers.length) renderWorkers($('#wl'),r.workers); wireFilters();
  };
  const wireFilters=()=>{ document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{state2.sort=b.dataset.sort;draw();});
    const o=document.querySelector('[data-open]'); if(o) o.onclick=()=>{state2.openNow=!state2.openNow;draw();}; };
  const run=async(q)=>{ if(!q.trim()){ return; } $('#sres').innerHTML=skeletonRow(3);
    try{ const rc=(safeParse(localStorage.getItem('ll_recent'))||[]).filter(x=>x.toLowerCase()!==q.trim().toLowerCase()); rc.unshift(q.trim()); localStorage.setItem('ll_recent',JSON.stringify(rc.slice(0,6))); }catch(e){}
    last=await api('/search?q='+encodeURIComponent(q)); draw(); track('search');
    // a logged-in customer's search becomes a lead for Premium businesses (server de-dupes)
    if(token && q.trim().length>=3){ api('/leads/search',{method:'POST',body:{query:q.trim(),area_id:state.areaId||null}}).catch(()=>{}); }
  };
  input.oninput=()=>{ clearTimeout(tmr); tmr=setTimeout(()=>run(input.value),260); };
  el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ input.value=b.dataset.q; run(b.dataset.q); });
  $('#askfromsearch').onclick=()=>openAsk(input.value);
};

SCREENS.offers = async (el) => {
  el.innerHTML = `${topbarBack(t('offers'))}<div class="px stack" id="l" style="gap:12px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
  backWire(el);
  const offers = await api('/offers');
  $('#l').innerHTML = offers.map(o=>`<button class="ocard" data-nav="business" data-id="${o.business_id}" style="width:auto;background:${grad(o.color1,o.color2)}">
    <span class="badge tag">${esc(o.discount_label)}</span><div><h4>${esc(o.title)}</h4><div class="biz">${esc(o.business)} · ${esc(o.description||'')}</div></div><span class="disc">%</span></button>`).join('');
};

SCREENS.news = async (el) => {
  el.innerHTML = `${topbarBack(t('news'))}<div class="px stack" id="l" style="gap:12px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
  backWire(el);
  const news = await api('/news');
  $('#l').innerHTML = news.map(n=>`<button class="brow" data-nav="newsDetail" data-id="${n.id}" style="text-align:left">
    <div class="thumb" style="background:${grad(n.color1,n.color2)}">${gi('news')}</div>
    <div class="info"><span class="badge neutral">${esc(n.category)}</span><h4 style="font-size:14.5px;margin-top:6px">${esc(n.title)}</h4>
    <div class="muted" style="font-size:12px;margin-top:4px">${esc(n.summary)}</div></div></button>`).join('');
};
SCREENS.newsDetail = async (el, {id}) => {
  const n = await api('/news/'+id);
  el.innerHTML = `<div class="detail-cover" style="height:150px;background:${grad(n.color1,n.color2)}"><button class="back" id="bk">${I.back}</button><span class="logo" style="font-size:44px">${gi('news')}</span></div>
    <div class="px" style="margin-top:16px"><span class="badge neutral">${esc(n.category)}</span>
      <h2 style="font-size:22px;margin-top:10px;line-height:1.25">${esc(n.title)}</h2>
      <div class="muted" style="font-size:12px;margin-top:8px">${new Date(n.published_at).toDateString()}</div>
      <p style="color:var(--body);font-size:14.5px;line-height:1.7;margin-top:14px">${esc(n.body)}</p><div style="height:90px"></div></div>`;
  $('#bk').onclick=back;
};

const ORDER_STEPS = [['pending','Placed'],['accepted','Accepted'],['preparing','Preparing'],['ready','Ready'],['out_for_delivery','On the way'],['completed','Delivered']];
function orderTimeline(status){
  if(status==='rejected'||status==='cancelled'){
    return `<div class="otl-bad">✕ Order ${status}</div>`;
  }
  const idx = Math.max(0, ORDER_STEPS.findIndex(s=>s[0]===status));
  return `<div class="otl">${ORDER_STEPS.map((s,i)=>`
    <div class="ostep ${i<idx?'done':''} ${i===idx?'now':''}"><span class="odot">${i<=idx?(I.check2||'✓'):''}</span><span class="olab">${s[1]}</span></div>
    ${i<ORDER_STEPS.length-1?`<span class="oline ${i<idx?'done':''}"></span>`:''}`).join('')}</div>`;
}
SCREENS.orders = async (el) => {
  if(!token) return openLoginInline(el, 'Log in to see your orders');
  el.innerHTML = `<div class="chead"><h2 style="font-size:21px">${t('orders')}</h2></div><div class="px stack" id="l" style="gap:12px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const orders = await api('/orders');
  const badge=(s)=>({pending:'warn',accepted:'primary',preparing:'primary',ready:'primary',completed:'open',cancelled:'closed',rejected:'closed',out_for_delivery:'primary'}[s]||'neutral');
  $('#l').innerHTML = orders.length? orders.map(o=>`<div class="card" style="padding:14px">
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:9px"><span class="gi" style="font-size:22px;color:var(--primary)">${GI.package}</span><div><b style="font-size:14px">${esc(o.business)}</b><div class="muted" style="font-size:12px">#${1000+o.id} · ${new Date(o.created_at).toLocaleDateString()}</div></div></div>
      <span class="badge ${badge(o.status)}">${o.status.replace(/_/g,' ')}</span></div>
    ${orderTimeline(o.status)}
    <div class="muted" style="font-size:12.5px;margin-top:10px">${esc(o.item_summary)}</div>
    <div class="row" style="justify-content:space-between;margin-top:10px"><b class="price">${money(o.total)}</b>
      <button class="btn ghost sm" data-reorder='${esc(JSON.stringify({items:o.items_json,biz:o.business,bizId:o.business_id}))}'>Order again</button></div></div>`).join('')
    : emptyState('bag','No orders yet','Browse local shops and place your first order.');
  el.querySelectorAll('[data-reorder]').forEach(b=>b.onclick=()=>{
    let d={}; try{ d=JSON.parse(b.dataset.reorder); }catch(e){}
    const items = d.items ? (typeof d.items==='string'?safeParse(d.items):d.items) : null;
    if(items && items.length){ cart=[]; items.forEach(it=>{ for(let n=0;n<(it.qty||1);n++){ const ex=cart.find(x=>x.id===it.id); if(ex)ex.qty++; else cart.push({id:it.id,name:it.name,price:it.price,image:it.image||'',biz:d.biz,bizId:Number(d.bizId),qty:1}); } }); saveCart(); updateCartBadge(); toast('Added to cart'); go('cart'); }
    else if(d.bizId){ go('business',{id:d.bizId}); }
    else toast('Nothing to reorder');
  });
};

SCREENS.notifications = async (el) => {
  if(!token) return openLoginInline(el, 'Log in to see notifications');
  el.innerHTML = `<div class="chead"><h2 style="font-size:21px">${t('notifications')}</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const items = await api('/notifications');
  const emojiMap={order:'package',offer:'percent',news:'news',event:'calendar',system:'bell',emergency:'cross'};
  $('#l').innerHTML = items.length? items.map(n=>`<div class="brow" style="${n.read?'':'border-left:3px solid var(--primary)'}">
    <div class="thumb" style="width:44px;height:44px;font-size:20px;background:var(--surface-2);color:var(--primary)">${gi(emojiMap[n.type]||'bell')}</div>
    <div class="info"><h4 style="font-size:14px">${esc(n.title)}</h4><div class="muted" style="font-size:12.5px;margin-top:3px">${esc(n.body)}</div>
    <div class="faint" style="font-size:11px;margin-top:4px">${new Date(n.created_at).toLocaleString()}</div></div></div>`).join('')
    : emptyState('bell','No notifications','You are all caught up.');
};

SCREENS.profile = async (el) => {
  const loggedIn = !!token;
  el.innerHTML = `<div class="chead"><h2 style="font-size:21px">${t('profile')}</h2></div>
    <div class="px" style="margin-top:8px">
      <div class="card" style="padding:16px;display:flex;gap:13px;align-items:center">
        <div class="avatar" style="width:54px;height:54px;font-size:20px;background:${grad(loggedIn?me.avatar_color:'#0D9488','#0B5A55')}">${loggedIn?me.name[0].toUpperCase():'<span class="gi" style="color:#fff">'+GI.user+'</span>'}</div>
        <div style="flex:1"><b style="font-size:16px">${loggedIn?esc(me.name):'Guest'}</b><div class="muted" style="font-size:12.5px">${loggedIn?esc(me.email||me.phone):'Log in to order, enquire & review'}</div></div>
        ${loggedIn?'':`<button class="btn sm" id="lg">${t('login')}</button>`}
      </div>
      <div style="height:16px"></div>
      <div class="plist">
        <button data-tabnav="orders"><span class="ic">${gi('package')}</span> My Orders <span class="chev">${I.chev}</span></button>
        <button data-nav="offers"><span class="ic">${gi('percent')}</span> ${t('offers')} <span class="chev">${I.chev}</span></button>
        <button data-nav="localinfo"><span class="ic">${gi('building')}</span> ${t('localInfo')} <span class="chev">${I.chev}</span></button>
        <button data-nav="events"><span class="ic">${gi('calendar')}</span> ${t('events')} <span class="chev">${I.chev}</span></button>
      </div>
      <div style="height:14px"></div>
      <div class="plist">
        <button id="langrow"><span class="ic">${I.globe}</span> Language — ${state.lang==='ml'?'മലയാളം':'English'} <span class="chev">${I.chev}</span></button>
        <button id="themerow"><span class="ic">${I.sun}</span> Theme — ${state.theme} <span class="chev">${I.chev}</span></button>
      </div>
      ${loggedIn?`<button class="btn ghost block" style="margin-top:16px;color:var(--error);border-color:var(--error)" id="out">${I.logout} Log out</button>`:''}
      <div style="height:90px"></div>
    </div>`;
  const lg=$('#lg'); if(lg) lg.onclick=()=>go('login');
  const out=$('#out'); if(out) out.onclick=()=>{ token=null; me=null; localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); toast('Logged out'); routeRender(); };
  $('#langrow').onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  $('#themerow').onclick=cycleTheme;
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};
SCREENS.localinfo = async (el)=>{ el.innerHTML=`${topbarBack(t('localInfo'))}<div class="px stack" id="l" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`; backWire(el); renderLocalInfo($('#l'), await api('/local-info')); };
SCREENS.events = async (el)=>{ el.innerHTML=`${topbarBack(t('events'))}<div class="px stack" id="l" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`; backWire(el); $('#l').innerHTML=(await api('/events')).map(eventCard).join(''); };

SCREENS.login = (el) => renderLogin(el, 'customer');

/* ---------------- shared bits ---------------- */
function topbarBack(title){ return `<div class="row px" style="gap:12px;padding-top:16px;padding-bottom:10px;position:sticky;top:0;background:var(--bg);z-index:6">
  <button class="tb-btn" id="__back">${I.back}</button><h3 style="font-size:17px">${esc(title)}</h3></div>`; }
function backWire(el){ const b=el.querySelector('#__back'); if(b) b.onclick=back; }

function openLoginInline(el, msg){ el.innerHTML=`<div class="center-min px" style="flex-direction:column;gap:14px;text-align:center">
  <div class="eic" style="width:64px;height:64px;border-radius:50%;background:var(--surface-2);display:grid;place-items:center;font-size:28px;color:var(--muted)">${gi('lock')}</div>
  <h3 style="font-size:17px">${esc(msg)}</h3><button class="btn" id="li">${t('login')}</button></div>`;
  $('#li').onclick=()=>go('login'); }
function openLoginPrompt(){ toast('Please log in first'); go('login'); }
/* Guest gate: ask a guest to sign up before ordering / seeing contact details */
async function gateAction(actionText, cb){
  if(token){ cb(); return; }
  const ok = await confirmDialog({ title:'Log in to continue',
    message:`Log in or create a free Local Link account to ${actionText}. It only takes a moment.`,
    ok:'Continue', cancel:'Not now', icon: GI.user||I.user });
  if(ok){ window.__llAfter=cb; go('login'); }
}

function openEnquiry(b){
  if(!token) return openLoginPrompt();
  showSheet(`${t('enquire')} — ${esc(b.name)}`, `
    <div class="field"><label>Your message</label><div class="input"><textarea id="emsg" rows="4" placeholder="e.g. Is this available now? Do you deliver to Kunnamangalam?"></textarea></div></div>
    <button class="btn block" id="esend">${t('enquire')}</button>`, ()=>{
      $('#esend').onclick=async()=>{ const msg=$('#emsg').value.trim(); if(!msg)return; try{ await api('/enquiries',{method:'POST',body:{business_id:b.id,message:msg}}); closeSheet(); toast('Enquiry sent to '+b.name);}catch(e){toast(e.message);} };
    });
}
function openBulkEnquiry(){
  if(!token) return openLoginPrompt();
  const cats=(ref.categories||[]).filter(c=>c.kind==='business');
  showSheet('Post a requirement', `
    <p class="faint" style="font-size:12.5px;margin:0 0 12px">Have a bulk order or a specific need? Post it once and matching local businesses will reach out to you.</p>
    <div class="field"><label>Category</label><div class="input"><select id="bcat">${cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label>What do you need?</label><div class="input"><input id="bq" placeholder="e.g. 100 biriyani plates for a wedding"/></div></div>
    <div class="field"><label>Details</label><div class="input"><textarea id="bmsg" rows="3" placeholder="Quantity, date, delivery location…"></textarea></div></div>
    <div class="field"><label>Budget <span class="faint" style="font-weight:500">(optional)</span></label><div class="input"><input id="bbud" placeholder="e.g. ₹15,000–20,000"/></div></div>
    <button class="btn block" id="bsend">Post requirement</button>`, ()=>{
      $('#bsend').onclick=async()=>{ const query=$('#bq').value.trim(); if(!query) return toast('Tell us what you need');
        try{ await api('/leads',{method:'POST',body:{ type:'bulk', category_id:Number($('#bcat').value)||null, area_id:state.areaId||null,
          query, message:$('#bmsg').value.trim()||null, budget:$('#bbud').value.trim()||null }});
          closeSheet(); toast('Requirement posted — businesses will contact you'); }catch(e){ toast(e.message); } };
    });
}
function openReview(b){
  if(!token) return openLoginPrompt();
  let rating=5;
  showSheet(`Rate ${esc(b.name)}`, `
    <div id="rstars" style="display:flex;gap:6px;justify-content:center;margin:6px 0 14px">${[1,2,3,4,5].map(i=>`<button data-s="${i}" style="font-size:30px;color:${i<=5?'#F5A524':'var(--border-strong)'}">★</button>`).join('')}</div>
    <div class="field"><label>Your review</label><div class="input"><textarea id="rc" rows="3" placeholder="Share your experience"></textarea></div></div>
    <button class="btn block" id="rsend">Submit review</button>`, ()=>{
      const sync=()=>document.querySelectorAll('#rstars button').forEach(x=>x.style.color=Number(x.dataset.s)<=rating?'#F5A524':'var(--border-strong)');
      document.querySelectorAll('#rstars button').forEach(x=>x.onclick=()=>{rating=Number(x.dataset.s);sync();});
      $('#rsend').onclick=async()=>{ try{ await api('/reviews',{method:'POST',body:{business_id:b.id,rating,comment:$('#rc').value.trim()}}); closeSheet(); toast('Thanks for your review!'); back(); go('business',{id:b.id}); }catch(e){toast(e.message);} };
    });
}

/* ---- customer ↔ store live chat (Premium stores) ---- */
function chatBubbles(messages, mine){
  if(!messages.length) return `<div class="chat-empty">${GI.chat}<p>Start the conversation — ask about products, delivery or offers.</p></div>`;
  return messages.map(m=>{ const own = m.sender===mine;
    return `<div class="cmsg ${own?'me':'them'}"><div class="cbub">${esc(m.body)}<span class="ctime">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div></div>`;
  }).join('');
}
SCREENS.chat = async (el, {id, name}) => {
  if(!token){ toast('Please log in to chat'); return go('login'); }
  el.innerHTML = `${topbarBack(name||'Chat')}
    <div class="chat-wrap"><div class="chat-scroll" id="chatmsgs">${skeletonRow(2)}</div>
      <div class="chat-input"><input id="cin" placeholder="Type a message…" autocomplete="off"/><button id="csend" class="chat-send">${GI.send||I.chev}</button></div>
    </div>`;
  backWire(el);
  const load = async(scroll)=>{ const box=$('#chatmsgs'); if(!box) return false;
    try{ const d=await api('/chat/'+id); box.innerHTML=chatBubbles(d.messages,'user');
      if(scroll){ box.scrollTop=box.scrollHeight; } return true; }catch(e){ return false; } };
  await load(true);
  const send=async()=>{ const inp=$('#cin'); const v=(inp.value||'').trim(); if(!v) return; inp.value='';
    try{ await api('/chat/'+id,{method:'POST',body:{body:v}}); await load(true); }catch(e){ toast(e.message); inp.value=v; } };
  $('#csend').onclick=send;
  $('#cin').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } });
  // poll for the partner's replies; auto-stops when the user navigates away
  const timer=setInterval(async()=>{ const box=document.getElementById('chatmsgs'); if(!box){ clearInterval(timer); return; }
    const nearBottom = box.scrollHeight-box.scrollTop-box.clientHeight < 60; await load(nearBottom); }, 4000);
};

/* ---------------- Ask Local Link — chat panel with voice ---------------- */
let aiVoiceLang = localStorage.getItem('ll_voicelang') || 'en-IN';
function openAsk(prefill, opts={}){
  closeSheet();
  const phone = $('.phone') || document.body;
  const aiOn = state.aiStatus.openai;
  const chips = [t('chipPlumber'),t('chipBiriyani'),t('chipAuto'),t('chipGrocery'),t('chipAC')];
  const panel = h(`<div class="sheet vvoice-wrap" id="sheet"><div class="ai-panel vvoice"><div class="vbg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="rip"></span><span class="rip r2"></span><span class="rip r3"></span><span class="vwave"></span></div>
    <div class="ai-head">
      <div class="row" style="gap:9px"><span class="ai-badge">${logoMark(26)}</span><b style="font-size:16px">${t('askTitle')}</b>
        <span class="badge ${aiOn?'primary':'warn'}" style="font-size:10px">${aiOn?'AI':'Basic search'}</span></div>
      <button class="tb-btn" id="ai-close" aria-label="Close">✕</button>
    </div>
    <div class="vorb-zone">
      <div class="vorb" id="vorb"><span class="o-halo"></span><span class="o-halo h2"></span><span class="o-core">${GI.mic}</span></div>
      <div class="vstate" id="vstate">${opts.voice?'Tap the orb and speak':'Ask me anything local'}</div>
      <div class="vbars" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</div>
    </div>
    <div class="ai-msgs" id="ai-msgs">
      <div class="ai-bubble bot">${t('askHi')} ${aiOn?'':`<span class="ai-limit">I'm in basic mode: I match keywords like “plumber”, “biriyani” or “auto”. Short phrases work best.</span>`}</div>
      <div class="ai-chips" id="ai-chips">${chips.map(x=>`<button class="chip" data-aq="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    </div>
    <div class="ai-inputbar">
      <div class="ai-langtg" id="ai-lang"><button data-vl="en-IN" class="${aiVoiceLang==='en-IN'?'on':''}">EN</button><button data-vl="ml-IN" class="${aiVoiceLang==='ml-IN'?'on':''}">മ</button></div>
      <button class="ai-mic" id="ai-mic" title="Speak">${GI.mic}</button>
      <input id="aq" placeholder="${t('askPh')}" value="${esc(prefill||'')}" autocomplete="off"/>
      <button class="ai-sendbtn" id="asend" title="Send">${GI.send}</button>
    </div>
    <button class="vend" id="ai-end">End</button>
  </div></div>`);
  phone.appendChild(panel);
  const msgs=$('#ai-msgs'), input=$('#aq');
  const scrollDown=()=>{ msgs.scrollTop = msgs.scrollHeight; };
  const addUser=(txt)=>{ msgs.insertAdjacentHTML('beforeend', `<div class="ai-bubble user">${esc(txt)}</div>`); scrollDown(); };
  const addBot=(html)=>{ const d=h(`<div class="ai-turn">${html}</div>`); msgs.appendChild(d); scrollDown(); return d; };

  const run=async(q)=>{ q=(q||input.value).trim(); if(!q) return;
    input.value=''; const chipsEl=$('#ai-chips'); if(chipsEl) chipsEl.remove();
    addUser(q);
    const loading=addBot(`<div class="ai-bubble bot"><span class="ai-typing"><i></i><i></i><i></i></span></div>`);
    panel.classList.add('thinking'); const vs0=$('#vstate'); if(vs0) vs0.textContent='Finding the best local match…';
    try{
      const r=await api('/ask',{method:'POST',body:{query:q, lang: state.lang}}); track('ask_used');
      loading.innerHTML = `<div class="ai-bubble bot">${esc(r.answer)}</div>` + (r.results||[]).map(x=>aiResultRow(x)).join('');
      loading.querySelectorAll('[data-go-biz]').forEach(b=>b.onclick=(e)=>{ if(e.target.closest('.ai-acts')) return; track('ask_result_tap'); closeSheet(); go('business',{id:Number(b.dataset.goBiz)}); });
      scrollDown();
    }catch(e){ loading.innerHTML=`<div class="ai-bubble bot">${esc(e.message)}</div>`; }
    panel.classList.remove('thinking'); panel.classList.add('answered'); const vs1=$('#vstate'); if(vs1) vs1.textContent='Here’s what I found';
  };
  $('#ai-close').onclick=closeSheet;
  panel.addEventListener('click', e=>{ if(e.target===panel) closeSheet(); });
  $('#asend').onclick=()=>run();
  input.onkeydown=e=>{ if(e.key==='Enter') run(); };
  $('#ai-chips').querySelectorAll('[data-aq]').forEach(b=>b.onclick=()=>run(b.dataset.aq));
  $('#ai-lang').querySelectorAll('[data-vl]').forEach(b=>b.onclick=()=>{ aiVoiceLang=b.dataset.vl; localStorage.setItem('ll_voicelang',aiVoiceLang); $('#ai-lang').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.vl===aiVoiceLang)); });
  setupVoice($('#ai-mic'), input, run);
  $('#ai-end').onclick=closeSheet;
  const orb=$('#vorb'), vst=$('#vstate'), micB=$('#ai-mic');
  orb.onclick=()=>micB.click();
  new MutationObserver(()=>{ const on=micB.classList.contains('listening'); panel.classList.toggle('listening',on);
    if(vst) vst.textContent = on ? (aiVoiceLang==='ml-IN'?'കേൾക്കുന്നു…':'Listening…') : 'Tap the orb and speak'; }).observe(micB,{attributes:true,attributeFilter:['class']});
  if(prefill) run(prefill); else if(opts.voice && (window.SpeechRecognition||window.webkitSpeechRecognition)) setTimeout(()=>micB.click(),350); else setTimeout(()=>input.focus(),200);
}

/* voice input (English + Malayalam) via Web Speech API */
let _recog=null;
function setupVoice(micBtn, input, run){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ micBtn.classList.add('disabled'); micBtn.title='Voice not supported on this device'; micBtn.onclick=()=>toast('Voice input isn’t supported on this browser'); return; }
  let listening=false;
  micBtn.onclick=async()=>{
    if(listening){ try{_recog.stop();}catch(e){} return; }
    if(!localStorage.getItem('ll_micok')){
      const ok=await confirmDialog({title:'Use your microphone?',message:'Local Link listens only while the orb is active, to turn what you say into a search. Nothing is recorded or stored. Your browser will ask for permission next.',ok:'Allow mic',cancel:'Type instead',icon:GI.mic});
      if(!ok){ input.focus(); return; } localStorage.setItem('ll_micok','1'); }
    try{ _recog = new SR(); }catch(e){ toast('Voice unavailable'); return; }
    _recog.lang = aiVoiceLang; _recog.interimResults = true; _recog.maxAlternatives = 1; _recog.continuous=false;
    listening=true; micBtn.classList.add('listening'); input.placeholder = aiVoiceLang==='ml-IN'?'കേൾക്കുന്നു…':'Listening…';
    let finalText='';
    _recog.onresult=(ev)=>{ let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const tr=ev.results[i]; if(tr.isFinal) finalText+=tr[0].transcript; else interim+=tr[0].transcript; } input.value = (finalText+interim).trim(); };
    _recog.onerror=(ev)=>{ if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){ localStorage.removeItem('ll_micok'); toast('Mic is blocked — you can type your question instead'); input.focus(); } else if(ev.error!=='no-speech' && ev.error!=='aborted') toast('Didn\'t catch that — try again or type'); };
    _recog.onend=()=>{ listening=false; micBtn.classList.remove('listening'); input.placeholder=t('askPh');
      const said=finalText.trim(); if(!said) return;
      input.value=said; const bar=input.closest('.ai-inputbar'); if(bar) bar.classList.add('heard');
      const hint=document.createElement('div'); hint.className='ai-heard'; hint.innerHTML=`Heard: “<b>${esc(said)}</b>” — sending… <button>Edit</button>`;
      bar && bar.parentNode.insertBefore(hint, bar);
      let tm=setTimeout(()=>{ hint.remove(); bar&&bar.classList.remove('heard'); run(input.value.trim()); }, 1800);
      const cancel=()=>{ clearTimeout(tm); hint.innerHTML='Fix any word, then press send'; bar&&bar.classList.remove('heard'); input.focus(); input.select(); };
      hint.querySelector('button').onclick=cancel; input.addEventListener('focus', cancel, {once:true}); };
    try{ _recog.start(); }catch(e){ listening=false; micBtn.classList.remove('listening'); }
  };
}
function aiResultRow(x){
  const map={business:['store','#0EA5A4','Business',x.id],service:['wrench','#6366F1','Service',x.business_id],product:['cart','#F97362','Product',x.business_id],worker:['helmet','#F59E0B','Worker',null],driver:['car','#0EA5E9','Ride',null]};
  const [emoji,color,label,bizId]=map[x.type]||['pin','#0D9488','Result',null];
  const sub = x.type==='business'?`${esc(x.subcategory||'')}${x.rating?` · ★ ${x.rating}`:''}`: x.type==='product'?`${money(x.price)} · ${esc(x.business||'')}`: x.type==='service'?`from ${money(x.starting_price)} · ${esc(x.business||'')}`: x.type==='worker'?esc(x.skills||''):esc(x.fare_note||x.service_type||'');
  const dir = (x.type==='business'||x.type==='service'||x.type==='product') ? `https://maps.google.com/?q=${encodeURIComponent((x.type==='business'?x.name:(x.business||x.name))+' Kozhikode')}` : null;
  const acts = [
    x.phone?`<a class="ai-act" href="tel:${esc(x.phone)}" onclick="event.stopPropagation()">${I.phone}Call</a>`:'',
    dir?`<a class="ai-act" href="${dir}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${I.dir}Directions</a>`:'',
    x.type==='product'?`<button class="ai-act hot" data-add="1" data-pid="${x.id}" data-pname="${esc(x.name)}" data-pprice="${x.price}" data-pmrp="${x.mrp||''}" data-pimg="${esc(x.image_url||'')}" data-pbiz="${esc(x.business||'')}" data-pbizid="${x.business_id||''}">${I.plus}Add to cart</button>`:'',
    bizId?`<span class="ai-act ghost">${I.chev}Open</span>`:''].join('');
  return `<div class="airow" ${bizId?`data-go-biz="${bizId}" role="button" tabindex="0"`:''}>
    <div class="ai-ic" style="background:${grad(color,color)}">${gi(emoji)}</div>
    <div style="flex:1;min-width:0"><div class="rt">${label}</div><b style="font-size:14px">${esc(x.name)}</b><div class="muted" style="font-size:12px">${sub}</div>
      ${acts?`<div class="ai-acts">${acts}</div>`:''}</div></div>`;
}

/* ---------------- bottom sheet ---------------- */
function showSheet(title, bodyHtml, wire){
  closeSheet(); try{ history.pushState({llsheet:1}, ''); }catch(e){}
  const phone = $('.phone') || document.body;
  const s = h(`<div class="sheet" id="sheet"><div class="panel-s"><div class="grab"></div>
    <div class="sh-head"><h3 style="font-size:16px;flex:1">${title}</h3><button class="tb-btn" id="sclose">✕</button></div>
    <div class="sh-body">${bodyHtml}</div></div></div>`);
  phone.appendChild(s);
  s.addEventListener('click', e=>{ if(e.target===s) closeSheet(); });
  $('#sclose').onclick=closeSheet;
  if(wire) wire();
}
function closeSheet(){ const s=$('#sheet'); if(s){ s.classList.add('closing'); setTimeout(()=>s.remove(),180); if(history.state && history.state.llsheet){ try{ history.replaceState(null,''); }catch(e){} } } }

/* ---------------- auth (customer/partner/admin shared) ---------------- */
function renderLogin(el, kind){
  const demo = kind==='admin'? {id:'admin@locallink.app'} : kind==='partner'? {id:'partner@locallink.app'} : {id:'customer@locallink.app'};
  const title = kind==='admin'?'Admin sign in':kind==='partner'?'Partner sign in':'Welcome back';
  el.innerHTML = `<div class="auth-wrap">
    ${kind!=='customer'?'':`<button class="tb-btn" id="ab" style="align-self:flex-start">${I.back}</button>`}
    <div class="auth-hero">${logoMark(58)}<h2 style="font-size:22px">${title}</h2>
      <p class="muted" style="font-size:13.5px">Local Link · Everything Local. One Place.</p></div>
    <div class="field"><label>Email or phone</label><div class="input">${I.user.replace('viewBox','style="width:18px;height:18px;stroke:var(--muted)" viewBox')}<input id="lid" value="${demo.id}" /></div></div>
    <div class="field"><label>Password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="lpw" type="password" value="password" /></div></div>
    <button class="btn block" id="lsubmit">${t('login')}</button>
    <div class="demo-pill"><span class="faint" style="font-size:11.5px;align-self:center">Demo:</span>
      <button data-d="customer@locallink.app">Customer</button>
      <button data-d="partner@locallink.app">Partner</button>
      <button data-d="admin@locallink.app">Admin</button></div>
    <p class="faint" style="font-size:11.5px;text-align:center;margin-top:14px">All demo accounts use password <b>password</b></p>
    ${kind==='customer'?`<p style="font-size:13px;text-align:center;margin-top:14px;color:var(--body)">New to Local Link? <a href="#" id="goreg" style="color:var(--primary);font-weight:700">Create an account</a></p>`:''}
    <div style="flex:1"></div></div>`;
  const ab=$('#ab'); if(ab) ab.onclick=back;
  const gr=$('#goreg'); if(gr) gr.onclick=(e)=>{ e.preventDefault(); go('register'); };
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ $('#lid').value=b.dataset.d; $('#lpw').value='password'; });
  $('#lsubmit').onclick=async()=>{
    try{ const r=await api('/auth/login',{method:'POST',body:{identifier:$('#lid').value.trim(),password:$('#lpw').value}});
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me));
      toast('Welcome, '+me.name.split(' ')[0]);
      routeAfterLogin();
    }catch(e){ toast(e.message); }
  };
}
/* customer sign-up — name, email, phone, password (x2) */
SCREENS.register = (el) => {
  el.innerHTML = `<div class="auth-wrap">
    <button class="tb-btn" id="rb" style="align-self:flex-start">${I.back}</button>
    <div class="auth-hero">${logoMark(52)}<h2 style="font-size:22px">Create your account</h2>
      <p class="muted" style="font-size:13px;max-width:280px">Join Local Link to order, save favourites, chat with stores and post requirements.</p></div>
    <div class="field"><label>Full name</label><div class="input"><input id="rn" placeholder="Your name" autocomplete="name"/></div></div>
    <div class="field"><label>Email</label><div class="input"><input id="re" type="email" placeholder="you@email.com" autocomplete="email"/></div></div>
    <div class="field"><label>Phone</label><div class="input"><input id="rp" type="tel" placeholder="+91…" autocomplete="tel"/></div></div>
    <div class="field"><label>Password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="rpw" type="password" placeholder="At least 6 characters"/></div></div>
    <div class="field"><label>Confirm password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="rpw2" type="password" placeholder="Re-enter password"/></div></div>
    <button class="btn block" id="rsubmit">Create account</button>
    <p style="font-size:13px;text-align:center;margin-top:14px;color:var(--body)">Already have an account? <a href="#" id="gologin" style="color:var(--primary);font-weight:700">Log in</a></p>
    <div style="flex:1"></div></div>`;
  $('#rb').onclick=back;
  $('#gologin').onclick=(e)=>{ e.preventDefault(); go('login'); };
  $('#rsubmit').onclick=async()=>{
    const name=$('#rn').value.trim(), email=$('#re').value.trim(), phone=$('#rp').value.trim(), pw=$('#rpw').value, pw2=$('#rpw2').value;
    if(!name||!email||!phone||!pw) return toast('Please fill in all fields');
    if(pw.length<6) return toast('Password must be at least 6 characters');
    if(pw!==pw2) return toast('Passwords do not match');
    try{ const r=await api('/auth/register',{method:'POST',body:{name,email,phone,password:pw}});
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me));
      toast('Welcome to Local Link, '+me.name.split(' ')[0]+'!');
      if(stack().length>1){ back(); } else { nav.customer=[{name:'home'}]; } routeRender();
    }catch(e){ toast(e.message); }
  };
};
function routeAfterLogin(){
  if (me.role==='super_admin'||me.role==='admin'){ openView('admin'); return; }
  if (me.role==='business_partner'){ nav.partner=[{name:'p_dash'}]; openView('partner'); return; }
  if (state.view==='customer'){
    // leave the auth screens and continue what the user was doing
    const st=nav.customer; while(st.length>1 && ['login','register'].includes(st[st.length-1].name)) st.pop();
    const after=window.__llAfter; window.__llAfter=null;
    renderShell(); if(typeof after==='function') setTimeout(()=>{ try{ after(); }catch(e){} },350); return; }
  renderShell();
}

/* ==================== PARTNER SCREENS ==================== */
SCREENS.p_login = (el) => renderLogin(el, 'partner');
/* lightweight inline-SVG bar chart (single teal series) */
function barChartSVG(data){
  const d=(data||[]).map(x=>({label:x.label||'',value:Math.max(0,x.value||0)}));
  if(!d.length) return '<p class="muted" style="font-size:12.5px">No data yet.</p>';
  const max=Math.max(...d.map(x=>x.value),1);
  const bw=30, gap=14, pad=8, topPad=16, chartH=92, base=topPad+chartH, W=d.length*(bw+gap)+pad*2, H=base+34;
  const bars=d.map((x,i)=>{ const bh=Math.round(x.value/max*chartH); const bx=pad+i*(bw+gap); const by=base-bh;
    const lbl = x.value>=1000 ? '₹'+(x.value/1000).toFixed(x.value>=10000?0:1)+'k' : (x.value>0?'₹'+x.value:'');
    return `<g>${x.value>0?`<text x="${bx+bw/2}" y="${by-5}" text-anchor="middle" style="font:700 9px var(--font-body);fill:var(--ink)">${lbl}</text>`:''}
      <rect x="${bx}" y="${by}" width="${bw}" height="${Math.max(bh,2)}" rx="5" fill="var(--primary)" opacity="${x.value>0?1:.25}"/>
      <text x="${bx+bw/2}" y="${base+16}" text-anchor="middle" style="font:600 10px var(--font-body);fill:var(--muted)">${esc(x.label)}</text></g>`;
  }).join('');
  return `<div style="overflow-x:auto;margin-top:10px"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:${W}px;max-width:${Math.max(W,320)}px;display:block">
    <line x1="${pad}" y1="${base+1}" x2="${W-pad}" y2="${base+1}" stroke="var(--border-strong)" stroke-width="1"/>${bars}</svg></div>`;
}

/* ==================== AI DEMAND FORECAST (DevX Nexus logic) ==================== */
const FC_STEPS = ['Reading 6 months of orders','Weighting recent demand & trend','Applying the Kerala festival calendar','Scoring confidence & best / worst range'];
function fcCount(el, to, fmt){ if(!el) return; const t0=performance.now(), dur=900; const f=fmt||(v=>Math.round(v).toLocaleString('en-IN'));
  (function tick(now){ const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,3); el.textContent=f(to*e); if(k<1) requestAnimationFrame(tick); })(t0); }
function fcConfLabel(c){ return c>=85?'High':c>=70?'Good':'Low'; }
function fcSpark(vals, w=84, hgt=26){ const mx=Math.max(...vals,1), mn=Math.min(...vals,0);
  const pts=vals.map((v,i)=>[ (i/(vals.length-1||1))*w, hgt-2-((v-mn)/((mx-mn)||1))*(hgt-4) ]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  return `<svg class="fc-spark" viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none"><path d="${d} L${w} ${hgt} L0 ${hgt}Z" class="a"/><path d="${d}" class="l"/></svg>`; }
function fcChart(r){
  const hist=r.history, fut=r.months, all=[...hist.map(x=>x.units),...fut.map(x=>x.units)], mx=Math.max(...all,1);
  const W=320, H=150, n=all.length, bw=W/n;
  const bars=hist.map((x,i)=>{ const hh=(x.units/mx)*(H-34); return `<rect class="fc-hb" x="${(i*bw+4).toFixed(1)}" y="${(H-18-hh).toFixed(1)}" width="${(bw-8).toFixed(1)}" height="${hh.toFixed(1)}" rx="5" style="--d:${i*60}ms"/>`; }).join('');
  const pts=fut.map((x,i)=>{ const j=hist.length+i; return [j*bw+bw/2, H-18-(x.units/mx)*(H-34)]; });
  const lastH=[(hist.length-1)*bw+bw/2, H-18-(hist[hist.length-1].units/mx)*(H-34)];
  const line=[lastH,...pts].map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L${pts[pts.length-1][0].toFixed(1)} ${H-18} L${lastH[0].toFixed(1)} ${H-18}Z`;
  const dots=pts.map((p,i)=>`<g class="fc-pt" style="--d:${700+i*90}ms"><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${fut[i].events.length?5:3.6}" class="${fut[i].events.length?'ev':''}"/>${fut[i].events.length?`<text x="${p[0].toFixed(1)}" y="${(p[1]-10).toFixed(1)}" text-anchor="middle" class="evl">${esc(fut[i].events[0].split(' ')[0])}</text>`:''}</g>`).join('');
  const labels=[...hist,...fut].map((x,i)=>`<text x="${(i*bw+bw/2).toFixed(1)}" y="${H-3}" text-anchor="middle" class="${i>=hist.length?'f':''}">${x.label}</text>`).join('');
  const split=hist.length*bw;
  return `<svg class="fc-chart" viewBox="0 0 ${W} ${H}"><rect x="${split}" y="0" width="${W-split}" height="${H-16}" rx="10" class="fc-zone"/>
    <text x="${split+8}" y="13" class="fc-zl">FORECAST</text><text x="6" y="13" class="fc-zl h">LAST 6 MONTHS</text>
    ${bars}<path d="${area}" class="fc-area"/><path d="${line}" class="fc-line" pathLength="1"/>${dots}${labels}</svg>`;
}
/* compact entry on the dashboard → full forecast lives on its own screen */
async function renderForecastEntry(host){
  if(!host) return;
  host.innerHTML=`<button class="fc-entry" id="fcGo" aria-label="Open AI demand forecast"><span class="fc-eic">${GI.sparkles}</span>
    <span class="fc-et"><small>AI demand forecast</small><b id="fcEb">See what will sell in the next 30 days</b></span><span class="fc-ego">${I.chev}</span></button>`;
  $('#fcGo').onclick=()=>go('p_forecast');
  try{ const d=await api('/partner/forecast'); const S=d.summary; const b=$('#fcEb');
    if(b && d.products && d.products.length) b.innerHTML=`${S.units.toLocaleString('en-IN')} units · ${money(S.revenue)} expected <em>${S.confidence}% confidence</em>`; }catch(e){}
}
SCREENS.p_forecast = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML = `${topbarBack('Demand forecast')}<div id="fcHub"></div><div style="height:100px"></div>`;
  backWire(el); renderForecastHub($('#fcHub'));
};
async function renderForecastHub(host){
  host.innerHTML = `<section class="fc-hub">
    <div class="fc-hero"><div class="fc-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="fc-eyebrow"><span class="fc-live"></span>AI Demand Forecast · Nexus engine</div>
      <h2 class="fc-title">Know what sells<br>before it sells</h2>
      <div class="fc-sum" id="fcSum"><div class="sk" style="height:66px;border-radius:18px;background:rgba(255,255,255,.12)"></div></div></div>
    <div class="fc-pickh"><b>Select a product</b><span class="muted">Forecast generates instantly</span></div>
    <div class="fc-picks" id="fcPicks">${skeletonCards(3)}</div>
    <div id="fcOut"></div></section>`;
  let data; try{ data = await api('/partner/forecast'); }catch(e){ host.innerHTML=''; return; }
  const S=data.summary, P=data.products||[];
  if(!P.length){ $('#fcSum').innerHTML=`<p class="fc-empty">Add your first product and its forecast appears here automatically.</p>`; $('#fcPicks').innerHTML=''; return; }
  $('#fcSum').innerHTML = `<div class="fc-kpi"><b id="fcU">0</b><span>units · next 30 days</span></div>
    <div class="fc-kpi"><b id="fcR">₹0</b><span>expected revenue</span></div>
    <div class="fc-ring" style="--p:${S.confidence}"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="t"/><circle cx="22" cy="22" r="18" class="v" pathLength="100"/></svg><b>${S.confidence}%</b><span>confidence</span></div>
    ${S.events.length?`<div class="fc-evs">${S.events.slice(0,3).map(e=>`<span>${GI.calendar}${esc(e)}</span>`).join('')}</div>`:''}`;
  fcCount($('#fcU'), S.units); fcCount($('#fcR'), S.revenue, v=>money(Math.round(v)));
  $('#fcPicks').innerHTML = P.map((p,i)=>`<button class="fc-pick" data-fp="${p.id}" style="--n:${i}">
      <span class="fc-pimg">${photoLayer(p.image_url||pic((p.name||'product').toLowerCase(),500+p.id,160,160))}</span>
      <span class="fc-pn">${esc(p.name)}</span>
      <span class="fc-pq"><b>${p.qty}</b> units ${p.trendPct>=5?'<em class="up">▲</em>':p.trendPct<=-5?'<em class="dn">▼</em>':''}</span>
      ${fcSpark(p.spark)}
      <span class="fc-pc c-${fcConfLabel(p.confidence).toLowerCase()}">${Math.round(p.confidence)}% conf.</span></button>`).join('');
  const pick = async (id, auto) => {
    host.querySelectorAll('.fc-pick').forEach(b=>b.classList.toggle('on', Number(b.dataset.fp)===id));
    const out=$('#fcOut');
    out.innerHTML = `<div class="fc-scan"><div class="fc-radar"><i></i><i></i><span>${GI.sparkles}</span></div>
      <ol>${FC_STEPS.map((t,i)=>`<li style="--d:${i*260}ms">${t}</li>`).join('')}</ol></div>`;
    if(!auto) setTimeout(()=>{ const sc=$('#screen'); const top=out.offsetTop-90; if(sc) sc.scrollTo({top, behavior:'smooth'}); },60);
    const t0=Date.now(); let r;
    try{ r = await api('/partner/forecast/'+id); }catch(e){ out.innerHTML=errorState(e.message,()=>pick(id)); return; }
    await new Promise(ok=>setTimeout(ok, Math.max(0, 1150-(Date.now()-t0))));
    renderReport(out, r, id);
  };
  const renderReport = (out, r, id, quiet) => {
    const f=r.forecast, cl=fcConfLabel(f.confidence), po=r.po;
    const lo=Math.min(f.worst,f.qty), span=Math.max(1,f.best-lo);
    out.innerHTML = `<article class="fc-rep${quiet?' quiet':''}">
      <header class="fc-rh"><span class="fc-rimg">${photoLayer(r.product.image_url||pic((r.product.name||'p').toLowerCase(),500+r.product.id,160,160))}</span>
        <div><small>${esc(r.product.business||'')}</small><h3>${esc(r.product.name)}</h3>
        <span class="fc-basis ${r.basis}">${r.basis==='orders'?'Learned from your orders':'Modelled baseline'} · ${esc(f.model)}</span></div></header>
      <div class="fc-main">
        <div class="fc-big"><small>Forecast · next 30 days</small><b id="fcBig">0</b><span>units · ≈ ${f.perDay}/day</span>
          <div class="fc-band"><i style="left:${((f.worst-lo)/span*100).toFixed(0)}%;width:${((f.best-f.worst)/span*100).toFixed(0)}%"></i><em style="left:${((f.qty-lo)/span*100).toFixed(0)}%"></em></div>
          <div class="fc-bandl"><span>Worst ${f.worst}</span><span>Best ${f.best}</span></div></div>
        <div class="fc-gauge c-${cl.toLowerCase()}" style="--p:${f.confidence}"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="t"/><circle cx="60" cy="60" r="50" class="v" pathLength="100"/></svg>
          <div><b id="fcConf">0%</b><span>${cl} confidence</span></div></div></div>
      <div class="fc-why"><span>${f.depthMonths} months of data</span><span>Volatility ${Math.round(f.cv*100)}%</span><span>${f.trendPct>=0?'+':''}${f.trendPct}% trend</span><span>Season ×${f.seasonFactor}</span></div>
      <div class="fc-card"><div class="fc-ch"><b>6-month outlook</b><span class="muted">${r.units6} units · ${money(Math.round(r.revenue6))}</span></div>${fcChart(r)}
        <div class="fc-mrow">${r.months.map((m,i)=>`<div style="--d:${i*70}ms"><small>${m.label}</small><b>${m.units}</b><i style="--c:${m.confidence}">${Math.round(m.confidence)}%</i></div>`).join('')}</div></div>
      <div class="fc-card fc-stock"><div class="fc-ch"><b>Restock plan</b><span class="muted">forecast + safety − stock</span></div>
        <div class="fc-sin"><label for="fcStock">Units in stock now</label><div class="input"><input id="fcStock" type="number" min="0" inputmode="numeric" placeholder="e.g. 20" value="${r.stock==null?'':r.stock}"/></div></div>
        <div class="fc-po">
          <div><small>Restock</small><b>${r.stock==null? f.qty+po.safety : po.poQty}</b><span>units</span></div>
          <div><small>${r.stock==null?'Keep ready':'Order by'}</small><b>${r.stock==null?'30 days':(po.orderBy?new Date(po.orderBy).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'—')}</b><span>${r.stock==null?'incl. '+po.safety+' safety':(po.coverDays!=null?po.coverDays+' days cover':'')}</span></div>
          <div><small>Revenue</small><b>${money(Math.round(po.revenue))}</b><span>${po.marginPct}% margin</span></div></div>
        ${r.stock!=null?`<span class="fc-urg u-${po.urgency}">${{critical:'Out of stock — restock now',urgent:'Runs out before restock arrives',plan:'Plan this restock',ok:'Stock covers demand'}[po.urgency]}</span>`:''}</div>
      <div class="fc-ins">${r.insights.map((x,i)=>`<p class="t-${x.tone}" style="--d:${i*110}ms"><i></i>${esc(x.text)}</p>`).join('')}</div>
    </article>`;
    if(quiet){ $('#fcBig').textContent=f.qty; $('#fcConf').textContent=Math.round(f.confidence)+'%'; } else { fcCount($('#fcBig'), f.qty); fcCount($('#fcConf'), f.confidence, v=>Math.round(v)+'%'); }
    const si=$('#fcStock'); let tm=null;
    si.addEventListener('input',()=>{ clearTimeout(tm); tm=setTimeout(async()=>{ try{ const v=si.value.trim(); const r2=await api('/partner/forecast/'+id+(v!==''?'?stock='+encodeURIComponent(v):'')); const pos=si.selectionStart; renderReport(out,r2,id,true); const n=$('#fcStock'); n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){} }catch(e){ toast(e.message); } },450); });
  };
  host.querySelectorAll('[data-fp]').forEach(b=>b.onclick=()=>pick(Number(b.dataset.fp)));
  pick(P[0].id, true);
}
/* ---- partner: what needs action today + new-order alerts ---- */
async function renderPartnerToday(host){
  if(!host) return;
  try{
    const [orders, prods, ov] = await Promise.all([api('/partner/orders'), api('/partner/products'), api('/partner/overview')]);
    const pending=orders.filter(o=>o.status==='pending'), active=orders.filter(o=>['accepted','preparing','ready','out_for_delivery'].includes(o.status));
    const oos=prods.filter(p=>p.stock_status==='out_of_stock'), unread=(ov.usage&&ov.usage.unreadChats)||0;
    const canAlert = 'Notification' in window && Notification.permission==='default';
    const item=(n,label,ic,tab,tone)=>`<button class="pt-do ${n?tone:'zero'}" data-tabnav="${tab}"><span>${ic}</span><b>${n}</b><small>${label}</small></button>`;
    host.innerHTML=`<div class="pt-th"><b>${t('needsAction')}</b>${canAlert?`<button id="alertOn">${I.bell} Turn on order alerts</button>`:''}</div>
      <div class="pt-dos">${item(pending.length,t('newOrders'),GI.package,'p_orders','hot')}${item(active.length,'in progress',GI.clock,'p_orders','sun')}${item(unread,t('unreadChats'),GI.chat,'p_chats','brand')}${item(oos.length,t('outStock'),GI.warning,'p_products','warn')}</div>
      ${pending.length?`<div class="pt-quick">${pending.slice(0,3).map(o=>`<div class="pt-q"><div><b>#${1000+o.id}</b><small>${esc(o.item_summary)}</small></div><b>${money(o.total)}</b><button class="btn sm" data-qacc="${o.id}">Accept</button></div>`).join('')}</div>`:''}`;
    host.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
    host.querySelectorAll('[data-qacc]').forEach(b=>b.onclick=async()=>{ try{ await api(`/partner/orders/${b.dataset.qacc}/status`,{method:'POST',body:{status:'accepted'}}); toast('Order accepted'); renderPartnerToday(host); }catch(e){ toast(e.message); } });
    const al=$('#alertOn'); if(al) al.onclick=async()=>{ try{ const r=await Notification.requestPermission(); toast(r==='granted'?'Order alerts on':'Alerts stay off — new orders still show here'); renderPartnerToday(host); }catch(e){} };
    pollPartnerOrders(true);
  }catch(e){ host.innerHTML=''; }
}
let _pPoll=null;
function pollPartnerOrders(start){
  if(start && _pPoll) return;
  const tick=async()=>{ if(state.view!=='partner'||!token||!me||me.role!=='business_partner'){ clearInterval(_pPoll); _pPoll=null; return; }
    try{ const orders=await api('/partner/orders'); const seen=new Set(safeParse(localStorage.getItem('ll_seen_orders'))||[]); const first=!localStorage.getItem('ll_seen_orders');
      const fresh=orders.filter(o=>o.status==='pending' && !seen.has(o.id));
      orders.forEach(o=>seen.add(o.id)); localStorage.setItem('ll_seen_orders', JSON.stringify([...seen].slice(-300)));
      if(first || !fresh.length) return;
      const msg = fresh.length===1 ? `New order #${1000+fresh[0].id} · ${money(fresh[0].total)}` : `${fresh.length} new orders`;
      toast('🛎️ '+msg);
      if('Notification' in window && Notification.permission==='granted' && document.hidden){ try{ new Notification('Local Link Partner', { body: msg, icon:'/icon-partner-192.png' }); }catch(e){} }
      const td=$('#todo'); if(td) renderPartnerToday(td);
    }catch(e){} };
  tick(); _pPoll=setInterval(tick, 30000);
}
SCREENS.p_dash = async (el) => {
  if(!token || (me.role!=='business_partner')) return renderLogin(el,'partner');
  el.innerHTML = `<header class="vhd"><div class="vhd-brand"><span class="cbrand-logo">${logoMark(30)}</span>${wordmark()}<span class="vhd-tag">Partner</span><div style="flex:1"></div>${miniControls()}
      <button class="avatar vav" data-tabnav="p_profile" aria-label="Profile" style="background:${grad(me.avatar_color,'#0B5A55')}">${me.name[0]}</button></div>
    <div class="vgreet" style="margin:12px 2px 0"><b>${greetWord()}, ${esc(me.name.split(' ')[0])}</b><span>Here’s how your shop is doing today</span></div></header>
    <section class="pt-today" id="todo" aria-live="polite"></section>
    <div id="fcEntry" class="px"></div>
    <div class="px" id="body" style="margin-top:12px">${skeletonRow(2)}</div><div style="height:90px"></div>`;
  renderForecastEntry($('#fcEntry')); renderPartnerToday($('#todo'));
  const [d, an] = await Promise.all([api('/partner/overview'), api('/partner/analytics').catch(()=>null)]);
  const stat=(lab,val,emoji)=>`<div class="pt-kpi"><span>${gi(emoji)}</span><div><b>${val}</b><small>${lab}</small></div></div>`;
  $('#body').innerHTML = `
    <div class="pt-sh"><b>Your shop at a glance</b><small>All time</small></div>
    <div class="pt-kpis">${stat('Orders', d.stats.orders, 'package')}${stat('Revenue', money(d.stats.revenue), 'card')}${stat('Enquiries', d.stats.enquiries, 'chat')}${stat('Profile views', d.stats.views, 'compass')}</div>
    ${an ? `<div class="card" style="padding:15px;margin-top:14px">
      <div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="font-size:15px">Sales — last 7 days</h3><span class="muted" style="font-size:12px">Avg order ${money(an.avgOrder)}</span></div>
      ${barChartSVG(an.revenue7)}
      ${an.topProducts && an.topProducts.length?`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:13.5px">Top products</h3></div>
        <div class="stack" style="gap:7px">${an.topProducts.map(p=>`<div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(p.name)}</span><b class="tabnums">${p.count} order${p.count>1?'s':''}</b></div>`).join('')}</div>`:''}
    </div>` : ''}
    <div class="card" style="padding:13px;margin-top:14px">
      <div class="row" style="justify-content:space-between;align-items:center"><div class="row" style="gap:8px"><span class="badge ${d.plan.id===3?'primary':'neutral'}">${esc(d.plan.name)} plan</span></div>
        <button class="btn sm ghost" data-tabnav="p_plans">${d.plan.id<3?'Upgrade':'Manage'}</button></div>
      ${d.plan.offers||d.plan.leads?`<div class="row" style="gap:16px;margin-top:10px;font-size:12px" class="muted">
        ${d.plan.offers?`<span class="muted">Promotions <b style="color:var(--ink)">${d.usage.offersUsed}/${d.usage.offersLimit}</b></span>`:''}
        ${d.plan.leads?`<span class="muted">Leads <b style="color:var(--ink)">${d.usage.leadsUsed}/${d.usage.leadsLimit}</b></span>`:''}</div>`:
        `<div class="muted" style="font-size:12px;margin-top:8px">Upgrade to Premium for promotions, customer leads & live chat.</div>`}</div>
    <div class="sec-head" style="margin:20px 0 10px"><h3 style="font-size:16px">Quick actions</h3></div>
    <div class="grid2 vqa" style="gap:10px">
      ${d.plan.products?`<button class="btn ghost" id="qa-prod">${I.plus} Add product</button>`:`<button class="btn ghost" data-tabnav="p_plans" style="opacity:.7">${I.plus} Add product 🔒</button>`}
      ${d.plan.offers?`<button class="btn ghost" id="qa-offer">${I.tag} Create offer</button>`:`<button class="btn ghost" data-tabnav="p_plans" style="opacity:.7">${I.tag} Promotions 🔒</button>`}
      <button class="btn ghost" data-tabnav="p_orders">${I.bag} View orders</button>
      <button class="btn ghost" data-tabnav="p_chats">${GI.chat} Chats</button>
      <button class="btn ghost" data-tabnav="p_leads">${gi('star')} Leads${d.plan.leads?'':' 🔒'}</button>
      <button class="btn ghost" data-tabnav="p_products">${I.store} Catalogue</button></div>
    <div class="sec-head" style="margin:20px 0 10px"><h3 style="font-size:16px">Recent orders</h3></div>
    <div class="stack" style="gap:10px">${d.recentOrders.length?d.recentOrders.map(o=>`<div class="card" style="padding:13px"><div class="row" style="justify-content:space-between"><b style="font-size:13.5px">#${1000+o.id} · ${esc(o.business)}</b><span class="badge ${o.status==='completed'?'open':'warn'}">${o.status.replace('_',' ')}</span></div><div class="muted" style="font-size:12.5px;margin-top:6px">${esc(o.item_summary)}</div><b class="price" style="font-size:14px">${money(o.total)}</b></div>`).join(''):emptyState('package','No orders yet','')}</div>
    <div class="sec-head" style="margin:20px 0 10px"><h3 style="font-size:16px">Your businesses</h3></div>
    <div class="stack" style="gap:10px">${d.businesses.map(b=>`<div class="brow"><div class="thumb" style="background:${grad(b.color1,b.color2)}">${dIcon(b)}</div><div class="info"><h4 style="font-size:14.5px">${esc(b.name)}</h4><div class="muted" style="font-size:12px;margin-top:3px">${esc(b.category_name)} · ${stars(b.rating)}</div><span class="badge open" style="margin-top:6px">${b.status}</span></div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  const qp=$('#qa-prod'); if(qp) qp.onclick=()=>openAddProduct(d.businesses[0]);
  const qo=$('#qa-offer'); if(qo) qo.onclick=()=>openAddOffer(d.businesses);
  setPartnerChatBadge(d.usage && d.usage.unreadChats);
};
function openAddOffer(businesses){
  if(!businesses || !businesses.length) return toast('No business found');
  const bizOpts = businesses.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  showSheet('Create offer / promotion', `
    ${businesses.length>1?`<div class="field"><label>Business</label><div class="input"><select id="ob">${bizOpts}</select></div></div>`:`<input type="hidden" id="ob" value="${businesses[0].id}"/>`}
    <div class="field"><label>Offer title</label><div class="input"><input id="ot" placeholder="e.g. Weekend Special"/></div></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Discount label</label><div class="input"><input id="od" placeholder="20% OFF / ₹100 OFF / B1G1"/></div></div>
      <div class="field" style="flex:1"><label>Promo code <span class="faint" style="font-weight:500">(optional)</span></label><div class="input"><input id="oc" placeholder="SAVE20"/></div></div></div>
    <div class="field"><label>Short description <span class="faint" style="font-weight:500">(optional)</span></label><div class="input"><input id="ode" placeholder="On all 1kg cakes this weekend"/></div></div>
    <button class="btn block" id="osave" style="margin-top:6px">Publish offer</button>`, ()=>{
      $('#osave').onclick=async()=>{ const business_id=Number($('#ob').value), title=$('#ot').value.trim(), discount_label=$('#od').value.trim();
        if(!title||!discount_label) return toast('Title and discount are required');
        try{ await api('/partner/offers',{method:'POST',body:{business_id,title,discount_label,code:$('#oc').value.trim()||null,description:$('#ode').value.trim()||null}});
          closeSheet(); toast('Offer published — now live for customers'); setTab('p_offers'); }catch(e){toast(e.message);} };
    });
}
SCREENS.p_offers = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">Offers & promotions</h2><span id="addslot"></span></div></div><div class="px" id="usage"></div><div class="px stack" id="l" style="gap:11px;margin-top:12px">${skeletonRow(2)}</div><div style="height:90px"></div>`;
  const [offers, ov] = await Promise.all([api('/partner/offers'), api('/partner/overview')]);
  const canOffer = ov.plan && ov.plan.offers>0;
  if(canOffer){ $('#addslot').innerHTML=`<button class="btn sm" id="add">${I.plus} New</button>`; $('#add').onclick=()=>openAddOffer(ov.businesses);
    $('#usage').innerHTML=`<div class="card" style="padding:11px 13px;margin-top:8px"><div class="row" style="justify-content:space-between;font-size:12.5px"><span class="muted">Promotions this month</span><b>${ov.usage.offersUsed} / ${ov.usage.offersLimit}</b></div></div>`;
  } else {
    $('#usage').innerHTML=`<div class="card" style="padding:16px;margin-top:8px;text-align:center"><h3 style="font-size:15px">Promotions are a Premium feature</h3><p class="muted" style="font-size:12.5px;margin:6px auto 12px;max-width:280px">Upgrade to Premium to run promotions and highlight your products.</p><button class="btn sm" data-tabnav="p_plans">See plans</button></div>`;
    el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  }
  const draw=(items)=> $('#l').innerHTML = items.length ? items.map(o=>`<div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 15px;color:#fff;background:${grad(o.color1||'#12A594',o.color2||'#0C6E64')}">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><div><div style="font-size:11px;font-weight:800;opacity:.9">${esc(o.discount_label||'OFFER')}</div><h4 style="color:#fff;font-size:17px;margin-top:3px">${esc(o.title)}</h4></div>
          ${o.code?`<span class="badge" style="background:rgba(255,255,255,.9);color:#111">${esc(o.code)}</span>`:''}</div>
        <div style="font-size:12px;opacity:.92;margin-top:4px">${esc(o.business)}${o.description?' · '+esc(o.description):''}</div></div>
      <div class="row" style="justify-content:space-between;padding:10px 14px"><span class="badge open">Active</span><button class="btn sm ghost danger" data-del="${o.id}">Delete</button></div></div>`).join('')
    : emptyState('percent','No offers yet','Create a promotion to attract more customers.', `<button class="btn sm" id="e3">${I.plus} Create offer</button>`);
  draw(offers);
  const e3=$('#e3'); if(e3) e3.onclick=()=>openAddOffer(ov.businesses);
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ try{ await api('/partner/offers/'+b.dataset.del,{method:'DELETE'}); toast('Offer removed'); setTab('p_offers'); }catch(e){toast(e.message);} });
};
/* Add product — 3 quick steps (photo → name & price → stock) with a live
   preview of the card customers will see. Same API and fields as before. */
function openAddProduct(biz){
  if(!biz) return toast('No business found');
  const d={ img:null, name:'', price:'', unit:'', mrp:'', promo:'', offer:false, stock:'in_stock' };
  let step=1;
  const preview=()=>{ const price=Number(d.price)||0, mrp=Number(d.mrp)||0, disc=d.offer&&mrp>price&&price>0;
    return `<div class="ap-prev"><small>Customers will see</small><div class="pcard qc-card ap-card">
      <div class="pimg">${d.img?`<img class="ph on" src="${d.img}" alt=""/>`:`<span class="gi">${GI.package}</span>`}${d.offer&&d.promo?`<span class="qc-rib">${esc(d.promo)}</span>`:disc?`<span class="qc-rib">${Math.round((1-price/mrp)*100)}%<br>OFF</span>`:''}${d.stock==='out_of_stock'?'<span class="qc-oos">Out of stock</span>':'<span class="qc-add" aria-hidden="true">ADD</span>'}</div>
      <div class="pb"><span class="qc-time">${gi('store')} ${esc(String(biz.name||'').split(' ').slice(0,2).join(' '))}</span><h4>${esc(d.name||'Product name')}</h4><div class="punit">${esc(d.unit||'1 unit')} · <span class="qc-new">New</span></div>
        <div class="price">${price?money(price):'₹—'}${disc?`<span class="old">${money(mrp)}</span>`:''}</div></div></div></div>`; };
  const body=()=>{
    const dots=`<div class="ap-steps" aria-label="Step ${step} of 3">${['Photo','Details','Stock'].map((l,i)=>`<span class="${i+1<step?'done':i+1===step?'on':''}"><i>${i+1<step?'✓':i+1}</i>${l}</span>`).join('<b></b>')}</div>`;
    if(step===1) return dots+`<div class="ap-photo">
        <input type="file" id="pcam" accept="image/*" capture="environment" hidden/><input type="file" id="pfile" accept="image/*" hidden/>
        ${d.img?`<div class="ap-shot"><img src="${d.img}" alt="Product photo preview"/><button type="button" class="pu-x" id="puClear" aria-label="Remove photo">✕</button></div>`
          :`<button type="button" class="ap-cam" id="apCam"><span>${GI.package}</span><b>Take a photo</b><small>Opens your camera</small></button>
            <button type="button" class="ap-gal" id="apGal">Choose from gallery</button>`}
        <details class="ap-url"><summary>Or paste a photo link</summary><div class="input" style="margin-top:8px"><input id="pimg" placeholder="https://…" value=""/></div></details></div>
      <div class="ap-nav"><button class="btn ghost" id="apSkip">${d.img?'':'Skip photo'}</button><button class="btn" id="apNext">Next</button></div>`;
    if(step===2) return dots+`<div class="ap-two">
        <div class="field"><label for="pn">Product name</label><div class="input"><input id="pn" value="${esc(d.name)}" placeholder="e.g. Chicken Biriyani" autocomplete="off"/></div></div>
        <div class="row" style="gap:8px"><div class="field" style="flex:1"><label for="pp">Price ₹</label><div class="input"><input id="pp" type="number" inputmode="decimal" value="${esc(d.price)}" placeholder="210"/></div></div>
          <div class="field" style="flex:1"><label for="pu">Unit</label><div class="input"><input id="pu" value="${esc(d.unit)}" placeholder="plate, kg, piece"/></div></div></div>
        <div class="ap-units">${['1 plate','1 kg','500 g','1 piece','1 L','1 pack'].map(u=>`<button type="button" data-u="${u}" class="${d.unit===u?'on':''}">${u}</button>`).join('')}</div>
        <div class="promo-box"><label class="promo-toggle"><input type="checkbox" id="pofferOn" ${d.offer?'checked':''}/> <span>Add an offer / promotion</span></label>
          <div id="pofferFields" ${d.offer?'':'hidden'}><div class="row" style="gap:8px;margin-top:8px"><div class="field" style="flex:1"><label for="pm">Original price ₹</label><div class="input"><input id="pm" type="number" inputmode="decimal" value="${esc(d.mrp)}" placeholder="240"/></div></div>
            <div class="field" style="flex:1"><label for="ppromo">Promo tag</label><div class="input"><input id="ppromo" value="${esc(d.promo)}" placeholder="Combo"/></div></div></div></div></div>
        <div id="apPrev">${preview()}</div></div>
      <div class="ap-nav"><button class="btn ghost" id="apBack">Back</button><button class="btn" id="apNext">Next</button></div>`;
    return dots+`<div class="ap-stock">
        <button type="button" class="ap-opt ${d.stock==='in_stock'?'on':''}" data-st="in_stock"><span class="ok">●</span><div><b>In stock</b><small>Customers can order it now</small></div></button>
        <button type="button" class="ap-opt ${d.stock==='out_of_stock'?'on':''}" data-st="out_of_stock"><span class="no">●</span><div><b>Out of stock</b><small>Listed, but can't be ordered yet</small></div></button></div>
      ${preview()}
      <div class="ap-nav"><button class="btn ghost" id="apBack">Back</button><button class="btn" id="psave">Publish product</button></div>`;
  };
  const read=()=>{ const v=id=>{ const e=document.getElementById(id); return e?e.value.trim():null; };
    if(step===1){ const u=v('pimg'); if(u) d.img=u; }
    if(step===2){ d.name=v('pn')??d.name; d.price=v('pp')??d.price; d.unit=v('pu')??d.unit; d.mrp=v('pm')??d.mrp; d.promo=v('ppromo')??d.promo; const o=$('#pofferOn'); if(o) d.offer=o.checked; } };
  const render=()=>{ const sb=document.querySelector('#sheet .sh-body'); if(!sb) return; sb.innerHTML=body(); wire(); sb.scrollTop=0; };
  const wire=()=>{
    const cam=$('#pcam'), file=$('#pfile');
    const take=async(inp)=>{ const f=inp.files[0]; if(!f) return; try{ toast('Processing photo…'); d.img=await readImageFile(f); buzz(); render(); }catch(e){ toast('Could not read that image'); } };
    if(cam){ cam.onchange=()=>take(cam); } if(file){ file.onchange=()=>take(file); }
    const ac=$('#apCam'); if(ac) ac.onclick=()=>cam.click();
    const ag=$('#apGal'); if(ag) ag.onclick=()=>file.click();
    const pc=$('#puClear'); if(pc) pc.onclick=()=>{ d.img=null; render(); };
    const sk=$('#apSkip'); if(sk) sk.onclick=()=>{ read(); step=2; render(); };
    const nx=$('#apNext'); if(nx) nx.onclick=()=>{ read();
      if(step===2){ if(!d.name) { toast('Add a product name'); $('#pn').focus(); return; } if(!(Number(d.price)>0)){ toast('Add a price'); $('#pp').focus(); return; } }
      step++; render(); };
    const bk=$('#apBack'); if(bk) bk.onclick=()=>{ read(); step--; render(); };
    document.querySelectorAll('#sheet [data-u]').forEach(b=>b.onclick=()=>{ $('#pu').value=b.dataset.u; read(); render(); });
    const of=$('#pofferOn'); if(of) of.onchange=()=>{ $('#pofferFields').hidden=!of.checked; read(); $('#apPrev').innerHTML=preview(); };
    ['pn','pp','pu','pm','ppromo'].forEach(id=>{ const e=document.getElementById(id); if(e) e.oninput=()=>{ read(); const pv=$('#apPrev'); if(pv) pv.innerHTML=preview(); }; });
    document.querySelectorAll('#sheet [data-st]').forEach(b=>b.onclick=()=>{ d.stock=b.dataset.st; render(); });
    const sv=$('#psave'); if(sv) sv.onclick=async()=>{ sv.disabled=true;
      try{ const r=await api('/partner/products',{method:'POST',body:{business_id:biz.id,name:d.name,price:Number(d.price),
          mrp: d.offer ? (Number(d.mrp)||null) : null, promo_label: d.offer ? (d.promo||null) : null,
          unit:d.unit||null, image_url:d.img||null, emoji:null}});
        if(d.stock==='out_of_stock' && r && r.id){ try{ await api('/partner/products/'+r.id,{method:'PATCH',body:{stock_status:'out_of_stock'}}); }catch(e){} }
        buzz(20); closeSheet(); toast('Product published'); setTab('p_products'); }catch(e){ sv.disabled=false; toast(e.message); } };
  };
  showSheet('Add product', body(), wire);
}
SCREENS.p_products = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<header class="pt-head"><div><small>Catalogue</small><h2>Products</h2></div><span id="addslot"></span></header>
    <div class="pt-tools"><div class="sr-box sm">${I.search}<input id="pq" placeholder="Search your products" aria-label="Search products"/></div>
      <div class="pt-filt" id="pf"><button class="on" data-f="all">All</button><button data-f="in">In stock</button><button data-f="out">Out of stock</button><button data-f="promo">On offer</button></div></div>
    <div class="pt-grid" id="l">${skeletonCards(2)}</div><div style="height:100px"></div>`;
  const [prods, ov] = await Promise.all([api('/partner/products'), api('/partner/overview')]);
  const canProd = ov.plan && ov.plan.products;
  const addBiz = (ov.businesses||[]).find(b=>b.plan_id>=2) || ov.businesses[0];
  if(canProd){ $('#addslot').innerHTML=`<button class="btn sm" id="add">${I.plus} Add</button>`; $('#add').onclick=()=>openAddProduct(addBiz); }
  else $('#addslot').innerHTML=`<button class="btn sm ghost" data-tabnav="p_plans">Upgrade to add</button>`;
  let f='all', q='';
  const draw=()=>{ const list=prods.filter(p=>{ const oos=p.stock_status==='out_of_stock';
      if(f==='in'&&oos) return false; if(f==='out'&&!oos) return false; if(f==='promo'&&!(p.promo_label||(p.mrp&&p.mrp>p.price))) return false;
      return !q || (p.name||'').toLowerCase().includes(q); });
    $('#l').innerHTML = !prods.length ? emptyState('bag','No products yet','Add your first product to start selling.', `<button class="btn sm" id="e2">${I.plus} Add product</button>`)
      : !list.length ? emptyState('search','Nothing matches','Try another filter.')
      : list.map((p,i)=>{ const oos=p.stock_status==='out_of_stock'; const src=p.image_url||pic((p.name||'product').toLowerCase(),500+(p.id||0),300,300);
      return `<article class="pt-card ${oos?'oos':''}" style="--n:${i}">
        <div class="pt-img">${photoLayer(src)}${dIcon({name:p.name},'cart')}${p.promo_label?`<span class="qc-rib">${esc(p.promo_label)}</span>`:(p.mrp&&p.mrp>p.price?`<span class="qc-rib">${Math.round((1-p.price/p.mrp)*100)}%<br>OFF</span>`:'')}</div>
        <h4>${esc(p.name)}</h4><small>${esc(p.business)}${p.unit?' · '+esc(p.unit):''}</small>
        <div class="pt-price"><b>${money(p.price)}</b>${p.mrp&&p.mrp>p.price?`<s>${money(p.mrp)}</s>`:''}</div>
        <label class="pt-sw"><input type="checkbox" data-poos="${p.id}" data-cur="${p.stock_status||'in_stock'}" ${oos?'':'checked'} aria-label="${esc(p.name)} in stock"/><i></i><span>${oos?'Out of stock':'In stock'}</span></label>
        <div class="pt-acts"><button class="pmbtn" data-pedit="${p.id}">${I.edit||I.cog} Edit</button><button class="pmbtn danger" data-pdel="${p.id}" data-pname="${esc(p.name)}" aria-label="Delete ${esc(p.name)}">${I.trash||'✕'}</button></div></article>`; }).join('');
    const e2=$('#e2'); if(e2) e2.onclick=()=>openAddProduct(ov.businesses[0]);
    wire(); };
  const refresh=()=>setTab('p_products');
  const wire=()=>{
    el.querySelectorAll('[data-pedit]').forEach(b=>b.onclick=()=>{ const p=prods.find(x=>String(x.id)===b.dataset.pedit); if(p) openEditProduct(p); });
    el.querySelectorAll('[data-poos]').forEach(b=>b.onchange=async()=>{ const next=b.dataset.cur==='out_of_stock'?'in_stock':'out_of_stock';
      try{ await api('/partner/products/'+b.dataset.poos,{method:'PATCH',body:{stock_status:next}}); buzz(); toast(next==='out_of_stock'?'Marked out of stock':'Marked in stock'); refresh(); }catch(e){toast(e.message); b.checked=!b.checked;} });
    el.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async()=>{ const ok=await confirmDialog({title:'Delete product?',message:'Delete "'+b.dataset.pname+'"? This cannot be undone.',ok:'Delete',cancel:'Keep',icon:I.trash||GI.warning,danger:true}); if(!ok)return;
      try{ await api('/partner/products/'+b.dataset.pdel,{method:'DELETE'}); toast('Product deleted'); refresh(); }catch(e){toast(e.message);} });
  };
  $('#pf').onclick=e=>{ const b=e.target.closest('[data-f]'); if(!b) return; f=b.dataset.f; $('#pf').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); draw(); };
  $('#pq').oninput=e=>{ q=e.target.value.trim().toLowerCase(); draw(); };
  draw();
};
function openEditProduct(p){
  let uploaded=null; const cur=p.image_url||'';
  showSheet('Edit product', `
    <div class="field"><label>Product photo</label>
      <div class="photo-up"><input type="file" id="efile" accept="image/*" hidden/>
        <button type="button" class="pu-drop" id="eDrop"${cur?' hidden':''}><span class="gi">${GI.package}</span><span>Tap to upload a new photo</span></button>
        <div class="pu-prevwrap" id="eWrap"${cur?'':' hidden'}><img id="ePrev" class="pu-prev" src="${esc(cur)}"/><button type="button" class="pu-x" id="eClear">${I.back.replace('m15 18-6-6 6-6','M6 6l12 12M18 6 6 18')}</button></div>
      </div></div>
    <div class="field"><label>Product name</label><div class="input"><input id="en" value="${esc(p.name||'')}"/></div></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Selling price ₹</label><div class="input"><input id="ep" type="number" value="${p.price||''}"/></div></div>
      <div class="field" style="flex:1"><label>Unit</label><div class="input"><input id="eu" value="${esc(p.unit||'')}" placeholder="plate, kg"/></div></div></div>
    <div class="promo-box">
      <label class="promo-toggle"><input type="checkbox" id="eofferOn" ${(p.mrp||p.promo_label)?'checked':''}/> <span>Offer / promotion</span></label>
      <div id="eofferFields" ${(p.mrp||p.promo_label)?'':'hidden'}>
        <div class="row" style="gap:10px;margin-top:8px"><div class="field" style="flex:1"><label>Original price ₹</label><div class="input"><input id="em" type="number" value="${p.mrp||''}" placeholder="240"/></div></div>
          <div class="field" style="flex:1"><label>Promo tag</label><div class="input"><input id="epromo" value="${esc(p.promo_label||'')}" placeholder="Combo"/></div></div></div>
      </div>
    </div>
    <div class="field" style="margin-top:6px"><label>Description</label><div class="input"><textarea id="edesc" rows="2" placeholder="Short description">${esc(p.description||'')}</textarea></div></div>
    <button class="btn block" id="esave" style="margin-top:14px">Save changes</button>`, ()=>{
      const drop=$('#eDrop'), file=$('#efile'), wrap=$('#eWrap'), prev=$('#ePrev');
      drop.onclick=()=>file.click();
      file.onchange=async()=>{ const f=file.files[0]; if(!f)return; try{ toast('Processing photo…'); uploaded=await readImageFile(f); prev.src=uploaded; wrap.hidden=false; drop.hidden=true; }catch(e){ toast('Could not read that image'); } };
      $('#eClear').onclick=()=>{ uploaded=''; file.value=''; wrap.hidden=true; drop.hidden=false; };
      $('#eofferOn').onchange=(e)=>{ $('#eofferFields').hidden=!e.target.checked; };
      $('#esave').onclick=async()=>{ const name=$('#en').value.trim(), price=Number($('#ep').value); if(!name||!price)return toast('Name & price required');
        const offerOn=$('#eofferOn').checked;
        const body={ name, price, unit:$('#eu').value.trim()||null, description:$('#edesc').value.trim()||null,
          mrp: offerOn?(Number($('#em').value)||null):null, promo_label: offerOn?($('#epromo').value.trim()||null):null };
        if(uploaded!==null) body.image_url = uploaded || null;
        try{ await api('/partner/products/'+p.id,{method:'PATCH',body}); closeSheet(); toast('Product updated'); setTab('p_products'); }catch(e){toast(e.message);} };
    });
}
SCREENS.p_orders = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<header class="pt-head"><div><small>Live</small><h2>Orders</h2></div><button class="pt-live" id="oref" aria-label="Refresh orders">${I.dir} Refresh</button></header>
    <div class="pt-filt lanes" id="of"></div><div class="px stack" id="l" style="gap:12px;margin-top:6px">${skeletonRow(3)}</div><div style="height:100px"></div>`;
  const LANES=[['new','New',['pending']],['active','In progress',['accepted','preparing','ready','out_for_delivery']],['done','Completed',['completed']],['closed','Rejected',['rejected','cancelled']]];
  const nextActs={pending:[['accepted','Accept'],['rejected','Reject']],accepted:[['preparing','Start preparing']],preparing:[['ready','Mark ready']],ready:[['completed','Complete']],out_for_delivery:[['completed','Complete']]};
  let lane=null;
  const draw = async()=>{ const orders=await api('/partner/orders');
    if(lane===null) lane = orders.some(o=>o.status==='pending') ? 'new' : 'active';
    $('#of').innerHTML = LANES.map(([k,l,st])=>{ const n=orders.filter(o=>st.includes(o.status)).length; return `<button class="${lane===k?'on':''}" data-lane="${k}">${l}<i>${n}</i></button>`; }).join('');
    const cur=LANES.find(x=>x[0]===lane)[2]; const list=orders.filter(o=>cur.includes(o.status));
    $('#l').innerHTML = list.length? list.map((o,i)=>`<article class="pt-ticket s-${o.status}" style="--n:${i}">
      <header><div><b>#${1000+o.id}</b><small>${esc(o.customer||'Customer')} · ${o.created_at?new Date(String(o.created_at).replace(' ','T')+'Z').toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}):''}</small></div><span class="badge ${o.status==='completed'?'open':o.status==='rejected'?'closed':'warn'}">${o.status.replace(/_/g,' ')}</span></header>
      <p class="pt-items">${esc(o.item_summary)}</p>
      ${['rejected','cancelled'].includes(o.status)?'':orderTimeline(o.status)}
      <footer><b>${money(o.total)}</b><div class="row" style="gap:7px">${(nextActs[o.status]||[]).map(([s,l])=>`<button class="btn sm ${s==='rejected'?'ghost':''}" data-oid="${o.id}" data-st="${s}">${l}</button>`).join('')}</div></footer></article>`).join('')
      : emptyState('package', lane==='new'?'No new orders right now':'Nothing here', lane==='new'?'Share your shop so nearby customers can order.':'Orders in this stage will show up here.', lane==='new'?`<button class="btn sm" id="shareShop">${I.share} Share your shop</button>`:'');
    const setStatus=async(oid,st,card)=>{ try{ await api(`/partner/orders/${oid}/status`,{method:'POST',body:{status:st}}); buzz(st==='rejected'?[10,40,10]:18); if(card){ card.classList.add(st==='rejected'?'gone-l':'gone-r'); await new Promise(r=>setTimeout(r,260)); } toast(st==='rejected'?'Order rejected':'Order updated'); draw(); }catch(e){toast(e.message);} };
    $('#l').querySelectorAll('[data-oid]').forEach(b=>b.onclick=()=>setStatus(b.dataset.oid,b.dataset.st,b.closest('.pt-ticket')));
    // swipe: right = next step (accept / advance), left = reject (only where allowed)
    $('#l').querySelectorAll('.pt-ticket').forEach(card=>{ const btns=[...card.querySelectorAll('[data-oid]')]; if(!btns.length) return;
      const fwd=btns.find(b=>b.dataset.st!=='rejected'), rej=btns.find(b=>b.dataset.st==='rejected');
      card.insertAdjacentHTML('afterbegin',`<span class="sw-hint r">${I.chev} ${fwd?esc(fwd.textContent):''}</span>${rej?`<span class="sw-hint l">Reject</span>`:''}`);
      let x0=null, dx=0; card.addEventListener('pointerdown',e=>{ if(e.target.closest('button')) return; x0=e.clientX; dx=0; card.setPointerCapture(e.pointerId); });
      card.addEventListener('pointermove',e=>{ if(x0===null) return; dx=e.clientX-x0; if(!rej&&dx<0) dx=0; card.style.transform=`translateX(${dx}px) rotate(${dx/40}deg)`; card.classList.toggle('sw-r',dx>40); card.classList.toggle('sw-l',dx<-40); });
      const end=()=>{ if(x0===null) return; x0=null; card.style.transform=''; card.classList.remove('sw-r','sw-l');
        if(dx>90 && fwd) setStatus(fwd.dataset.oid,fwd.dataset.st,card); else if(dx<-90 && rej) setStatus(rej.dataset.oid,'rejected',card); };
      card.addEventListener('pointerup',end); card.addEventListener('pointercancel',end); });
    const es=$('#shareShop'); if(es) es.onclick=async()=>{ const url=location.origin+'/'; try{ if(navigator.share) await navigator.share({title:'Order from my shop on Local Link',url}); else { await navigator.clipboard.writeText(url); toast('Link copied'); } }catch(e){} };
    $('#of').querySelectorAll('[data-lane]').forEach(b=>b.onclick=()=>{ lane=b.dataset.lane; draw(); });
  };
  $('#oref').onclick=()=>draw();
  draw();
};
SCREENS.p_enquiries = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Enquiries</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const items = await api('/partner/enquiries');
  $('#l').innerHTML = items.length? items.map(e=>`<div class="card" style="padding:13px">
    <div class="row" style="justify-content:space-between"><b style="font-size:13.5px">${esc(e.customer_name)}</b><span class="badge ${e.status==='new'?'warn':'primary'}">${e.status}</span></div>
    <div class="muted" style="font-size:12px;margin-top:2px">${esc(e.business)} · ${new Date(e.created_at).toLocaleString()}</div>
    <p style="font-size:13.5px;color:var(--body);margin:8px 0 10px">${esc(e.message)}</p>
    <div class="row" style="gap:8px"><button class="btn sm">Reply</button><button class="btn sm ghost">${I.phone} Call</button></div></div>`).join('')
    : emptyState('chat','No enquiries yet','');
};

/* ---- partner chat inbox + thread ---- */
SCREENS.p_chats = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Chats</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const rows = await api('/partner/chats');
  const totalUnread = rows.reduce((n,r)=>n+(r.unread||0),0); setPartnerChatBadge(totalUnread);
  $('#l').innerHTML = rows.length ? rows.map(r=>`<button class="card chatrow" style="padding:13px;text-align:left;width:100%" data-uid="${r.user_id}" data-bid="${r.business_id}" data-name="${esc(r.customer||'Customer')}">
    <div class="row" style="justify-content:space-between;align-items:flex-start"><div style="flex:1;min-width:0">
      <b style="font-size:14px">${esc(r.customer||'Customer')}</b>
      <div class="muted" style="font-size:11.5px;margin:1px 0 5px">${esc(r.business)}</div>
      <div class="muted" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.last?(r.last.sender==='partner'?'You: ':'')+esc(r.last.body):''}</div>
    </div>${r.unread?`<span class="badge warn" style="flex:0 0 auto">${r.unread} new</span>`:''}</div></button>`).join('')
    : emptyState('chat','No chats yet','When customers message your store, conversations appear here.');
  el.querySelectorAll('[data-uid]').forEach(b=>b.onclick=()=>go('p_chatThread',{uid:b.dataset.uid,bid:b.dataset.bid,name:b.dataset.name}));
};
SCREENS.p_chatThread = async (el,{uid,bid,name}) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`${topbarBack(name||'Chat')}
    <div class="chat-wrap"><div class="chat-scroll" id="chatmsgs">${skeletonRow(2)}</div>
      <div class="chat-input"><input id="cin" placeholder="Reply to ${esc(name||'customer')}…" autocomplete="off"/><button id="csend" class="chat-send">${GI.send}</button></div></div>`;
  backWire(el);
  const load=async(scroll)=>{ const box=$('#chatmsgs'); if(!box) return; try{ const d=await api('/partner/chats/'+uid+'?business_id='+bid);
    box.innerHTML=chatBubbles(d.messages,'partner'); if(scroll) box.scrollTop=box.scrollHeight; }catch(e){} };
  await load(true);
  const send=async()=>{ const inp=$('#cin'); const v=(inp.value||'').trim(); if(!v)return; inp.value='';
    try{ await api('/partner/chats/'+uid,{method:'POST',body:{business_id:Number(bid),body:v}}); await load(true); }catch(e){ toast(e.message); inp.value=v; } };
  $('#csend').onclick=send;
  $('#cin').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } });
  const timer=setInterval(async()=>{ const box=document.getElementById('chatmsgs'); if(!box){ clearInterval(timer); return; }
    const nb=box.scrollHeight-box.scrollTop-box.clientHeight<60; await load(nb); },4000);
};

/* ---- partner leads inbox (Premium) ---- */
SCREENS.p_leads = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Leads</h2></div><div class="px" id="l" style="margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const d = await api('/partner/leads');
  if(d.locked){ $('#l').innerHTML = `<div class="card" style="padding:22px;text-align:center">
    <div class="eic" style="margin:0 auto 12px">${gi('star')}</div>
    <h3 style="font-size:16px">Leads are a Premium feature</h3>
    <p class="muted" style="font-size:13px;margin:8px auto 16px;max-width:280px">Upgrade to Premium to receive customer enquiries and bulk requirements in your area — up to 10 qualified leads a month.</p>
    <button class="btn" data-tabnav="p_profile">See plans</button></div>`;
    el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav)); return; }
  const typeBadge={search:'neutral',bulk:'warn',enquiry:'primary'};
  const head = `<div class="card" style="padding:13px;margin-bottom:12px"><div class="row" style="justify-content:space-between"><span class="muted" style="font-size:12.5px">Leads used this month</span><b>${d.used} / ${d.limit}</b></div>
    <div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:${Math.round((d.used/Math.max(d.limit,1))*100)}%"></div></div></div>`;
  $('#l').innerHTML = head + (d.leads.length ? `<div class="stack" style="gap:11px">${d.leads.map(l=>`<div class="card" style="padding:14px">
    <div class="row" style="justify-content:space-between"><span class="badge ${typeBadge[l.type]||'neutral'}">${l.type==='bulk'?'Bulk requirement':l.type==='search'?'Search intent':'Enquiry'}</span><span class="muted" style="font-size:11.5px">${new Date(l.created_at).toLocaleDateString()}</span></div>
    <h4 style="font-size:14.5px;margin-top:8px">${esc(l.query||l.message||'Requirement')}</h4>
    ${l.message&&l.query?`<p class="muted" style="font-size:12.5px;margin-top:4px">${esc(l.message)}</p>`:''}
    ${l.budget?`<div style="font-size:12.5px;margin-top:6px">Budget: <b>${esc(l.budget)}</b></div>`:''}
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div style="font-size:12.5px">${l.locked?`<span class="muted">${esc(l.user_name)}</span> · <span class="faint">contact hidden</span>`:`<b>${esc(l.user_name)}</b> · <a href="tel:${esc(l.user_phone||'')}" style="color:var(--primary)">${esc(l.user_phone||'')}</a>`}</div>
      ${l.locked?`<button class="btn sm" data-claim="${l.id}">Unlock lead</button>`:`<span class="badge open">Unlocked</span>`}</div></div>`).join('')}</div>`
    : emptyState('inbox','No leads yet','New customer requirements in your categories will appear here.'));
  el.querySelectorAll('[data-claim]').forEach(b=>b.onclick=async()=>{ try{ await api('/partner/leads/'+b.dataset.claim+'/claim',{method:'POST'}); toast('Lead unlocked'); setTab('p_leads'); }catch(e){ toast(e.message); } });
};
SCREENS.p_profile = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML = `<div class="chead"><h2 style="font-size:20px">${t('profile')}</h2></div>
    <div class="px" style="margin-top:8px"><div class="card" style="padding:16px;display:flex;gap:13px;align-items:center">
      <div class="avatar" style="width:54px;height:54px;font-size:20px;background:${grad(me.avatar_color,'#0B5A55')}">${me.name[0]}</div>
      <div style="flex:1"><b style="font-size:16px">${esc(me.name)}</b><div class="muted" style="font-size:12.5px">Business Partner · ${esc(me.email)}</div></div></div>
      <div style="height:14px"></div>
      <div class="plist">
        <button data-tabnav="p_products"><span class="ic">${I.store}</span> Manage catalogue <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_offers"><span class="ic">${I.tag}</span> Offers & promotions <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_leads"><span class="ic">${gi('star')}</span> Leads <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_enquiries"><span class="ic">${GI.chat}</span> Enquiries <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_settings"><span class="ic">${gi('card')}</span> Payments & business settings <span class="chev">${I.chev}</span></button>
      </div>
      <div class="plist" style="margin-top:12px"><button data-tabnav="p_plans"><span class="ic">${I.chart}</span> Subscription plan <span class="rt" id="planlab">…</span></button></div>
      <button class="btn ghost block pt-logout" id="out">${I.logout} Log out</button></div>`;
  $('#out').onclick=async()=>{ const ok=await confirmDialog({title:'Log out?',message:'You will stop getting new-order alerts on this device until you log in again.',ok:'Log out',cancel:'Stay',danger:true,icon:I.logout}); if(!ok) return;
    token=null;me=null;localStorage.removeItem('ll_token');localStorage.removeItem('ll_user'); nav.partner=[{name:'p_login'}]; toast('Logged out'); routeRender(); };
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  api('/partner/overview').then(d=>{ const p=$('#planlab'); if(p&&d.plan) p.innerHTML=`${esc(d.plan.name)} ${I.chev}`; }).catch(()=>{});
};

/* ---- partner business settings: payments, UPI, contact, hours ---- */
SCREENS.p_settings = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`${topbarBack('Payments & settings')}<div class="px" id="l" style="margin-top:8px">${skeletonRow(3)}</div><div style="height:96px"></div>`;
  backWire(el);
  const biz = await api('/partner/businesses');
  if(!biz.length){ $('#l').innerHTML=emptyState('store','No business found',''); return; }
  const bizOpts = biz.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const render=(b)=>{ const pm=(b.payment_methods||'cash').split(','); const mins=(m)=>{const h=String(Math.floor(m/60)).padStart(2,'0'),mm=String(m%60).padStart(2,'0');return h+':'+mm;};
    $('#form').innerHTML=`
      <div class="sec-lbl">Payments you accept</div>
      <div class="pay-set">
        ${[['cash','Cash'],['card','Card'],['upi','UPI / Online']].map(([v,l])=>`<label class="paychk"><input type="checkbox" value="${v}" ${pm.includes(v)?'checked':''}/> <span>${l}</span></label>`).join('')}
      </div>
      <div class="field" id="upiwrap" style="margin-top:10px;${pm.includes('upi')?'':'display:none'}"><label>UPI ID</label><div class="input"><input id="upi" value="${esc(b.upi_id||'')}" placeholder="yourstore@okhdfc"/></div></div>
      <div class="sec-lbl" style="margin-top:16px">Contact</div>
      <div class="field"><label>Phone</label><div class="input"><input id="ph" value="${esc(b.phone||'')}"/></div></div>
      <div class="field"><label>WhatsApp</label><div class="input"><input id="wa" value="${esc(b.whatsapp||'')}"/></div></div>
      <div class="field"><label>Address</label><div class="input"><input id="addr" value="${esc(b.address||'')}"/></div></div>
      <div class="field"><label>About</label><div class="input"><textarea id="desc" rows="2">${esc(b.description||'')}</textarea></div></div>
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Opens</label><div class="input"><input id="om" type="time" value="${mins(b.open_min||540)}"/></div></div>
        <div class="field" style="flex:1"><label>Closes</label><div class="input"><input id="cm" type="time" value="${mins(b.close_min||1290)}"/></div></div></div>
      <button class="btn block" id="save" style="margin-top:14px">Save settings</button>`;
    const toMin=(v)=>{ const [h,m]=(v||'0:0').split(':').map(Number); return h*60+(m||0); };
    el.querySelectorAll('.paychk input').forEach(c=>c.onchange=()=>{ $('#upiwrap').style.display = el.querySelector('.paychk input[value="upi"]').checked?'':'none'; });
    $('#save').onclick=async()=>{ const methods=[...el.querySelectorAll('.paychk input:checked')].map(c=>c.value); if(!methods.length){ return toast('Pick at least one payment method'); }
      try{ await api('/partner/businesses/'+b.id,{method:'PATCH',body:{ payment_methods:methods.join(','), upi_id:methods.includes('upi')?($('#upi').value.trim()||null):null,
        phone:$('#ph').value.trim(), whatsapp:$('#wa').value.trim(), address:$('#addr').value.trim(), description:$('#desc').value.trim(), open_min:toMin($('#om').value), close_min:toMin($('#cm').value) }});
        toast('Settings saved'); }catch(e){ toast(e.message); } };
  };
  $('#l').innerHTML = `${biz.length>1?`<div class="field"><label>Business</label><div class="input"><select id="bizsel">${bizOpts}</select></div></div>`:''}<div id="form"></div>`;
  render(biz[0]);
  const sel=$('#bizsel'); if(sel) sel.onchange=()=>render(biz.find(b=>String(b.id)===sel.value));
};

/* ---- partner subscription plans ---- */
SCREENS.p_plans = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`${topbarBack('Subscription plans')}<div class="px" id="l" style="margin-top:10px">${skeletonRow(3)}</div><div style="height:96px"></div>`;
  backWire(el);
  const [plans, ov] = await Promise.all([api('/subscription-plans'), api('/partner/overview').catch(()=>({}))]);
  const curId = ov.plan ? ov.plan.id : 1;
  $('#l').innerHTML = `${ov.usage?`<div class="card" style="padding:13px;margin-bottom:12px"><div class="row" style="justify-content:space-between;font-size:12.5px"><span class="muted">Promotions this month</span><b>${ov.usage.offersUsed} / ${ov.usage.offersLimit}</b></div>
      <div class="row" style="justify-content:space-between;font-size:12.5px;margin-top:6px"><span class="muted">Leads this month</span><b>${ov.usage.leadsUsed} / ${ov.usage.leadsLimit}</b></div></div>`:''}
    <div class="stack" style="gap:12px">${plans.map(p=>`<div class="card plan-card ${p.id===curId?'current':''}" style="padding:16px">
      <div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="font-size:17px">${esc(p.name)}${p.popular?' <span class="badge primary" style="vertical-align:middle">Popular</span>':''}</h3><div><b style="font-size:19px">₹${p.price}</b><span class="muted" style="font-size:12px">/${esc(p.period)}</span></div></div>
      <p class="muted" style="font-size:12.5px;margin:4px 0 10px">${esc(p.tagline)}</p>
      <div class="stack" style="gap:6px">${p.features.map(f=>`<div class="row" style="gap:8px;font-size:13px"><span style="color:var(--primary)">✓</span> ${esc(f)}</div>`).join('')}</div>
      <button class="btn ${p.id===curId?'ghost':''} block" style="margin-top:14px" ${p.id===curId?'disabled':''} data-plan="${p.id}">${p.id===curId?'Current plan':(p.id>curId?'Upgrade':'Switch')}</button>
    </div>`).join('')}</div>`;
  el.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>toast('Plan change requests are handled by the Local Link team.'));
};

/* ==================== ADMIN ==================== */
let adminRoute = 'dashboard';
let adminBiz = null;
function renderAdminLogin(body){
  body.innerHTML = `<div class="crm-login">
    <div class="crm-brand">
      <div class="crm-brand-in">
        <div class="crm-logo">${logoMark(40)}${wordmark()}</div>
        <h1>Admin console</h1><p class="crm-sub">Run your whole marketplace from one place.</p>
        <p>Businesses, products, orders, leads, offers, community content, advertisements and platform settings — all in a single control panel.</p>
        <ul class="crm-feats">
          <li>${gi('store')}<span>Approve & manage every business and partner</span></li>
          <li>${gi('star')}<span>Capture and route leads to premium partners</span></li>
          <li>${gi('chart')}<span>Live dashboards for orders, revenue & growth</span></li>
          <li>${gi('bell')}<span>Broadcast notifications & run ad campaigns</span></li>
        </ul>
      </div>
      <div class="crm-brand-foot">Everything Local. One Place. · Kozhikode, Kerala</div>
    </div>
    <div class="crm-form-side">
      <div class="crm-card">
        <div class="crm-card-head"><h2>Sign in to Admin</h2><p>Use your administrator account to continue.</p></div>
        <div class="field"><label>Email or phone</label><div class="input">${I.user.replace('viewBox','style="width:18px;height:18px;stroke:var(--muted)" viewBox')}<input id="al_id" value="admin@locallink.app" autocomplete="username"/></div></div>
        <div class="field"><label>Password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="al_pw" type="password" value="password" autocomplete="current-password"/></div></div>
        <button class="btn block" id="al_go" style="margin-top:4px">Sign in to CRM</button>
        <div id="al_err" class="crm-err" hidden></div>
        <div class="crm-demo"><span>Demo admin</span> admin@locallink.app · password <b>password</b></div>
        <div class="crm-back"><a href="#" id="al_home">${I.chev.replace('m9 18 6-6-6-6','m15 18-6-6 6-6')} Back to customer app</a></div>
      </div>
    </div></div>`;
  const submit=async()=>{
    const err=$('#al_err'); err.hidden=true;
    try{ const r=await api('/auth/login',{method:'POST',body:{identifier:$('#al_id').value.trim(),password:$('#al_pw').value}});
      if(r.user.role!=='admin' && r.user.role!=='super_admin'){ err.textContent='That account is not an administrator.'; err.hidden=false; return; }
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me));
      toast('Welcome, '+me.name.split(' ')[0]); renderAdmin(body);
    }catch(e){ err.textContent=e.message||'Sign-in failed'; err.hidden=false; }
  };
  $('#al_go').onclick=submit;
  $('#al_pw').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  $('#al_id').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  $('#al_home').onclick=(e)=>{ e.preventDefault(); openView('customer'); };
}
function renderAdmin(body){
  if(!token || (me && me.role!=='admin' && me.role!=='super_admin')){
    return renderAdminLogin(body);
  }
  const groups = [
    ['Overview', [['dashboard','Dashboard',I.chart]]],
    ['Marketplace', [['businesses','Businesses',I.store],['products','Products',I.bag],['services','Services',I.tag],['offers','Offers',I.tag],['workers','Workers',GI.helmet],['drivers','Drivers',GI.car],['reviews','Reviews',I.star]]],
    ['Community', [['news','News',GI.news],['events','Events',GI.calendar],['local_info','Local Info',GI.building]]],
    ['Operations', [['orders','Orders',I.bag],['leads','Leads',gi('star')],['users','Users',I.users],['categories','Categories',I.grid]]],
    ['System', [['locations','Locations',I.pin],['subscription_plans','Subscriptions',GI.card],['advertisements','Advertisements',GI.megaphone],['notifications','Notifications',I.bell],['settings','Settings',I.cog]]],
  ];
  body.innerHTML = `<div class="desk">
    <aside class="side">
      <div class="lg">${logoMark(30)}${wordmark()}</div><span class="side-tag">Admin console</span>
      ${groups.map(([g,items])=>`<div class="grp">${g}</div>${items.map(([r,l,icn])=>`<a data-r="${r}" class="${adminRoute===r?'on':''}">${icn.startsWith('<')?icn:`<span style="width:18px;text-align:center">${icn}</span>`}<span>${l}</span></a>`).join('')}`).join('')}
      <div style="flex:1"></div>
      <div class="who"><b>${esc(me.name)}</b><span>${me.role==='super_admin'?'Super admin':'Administrator'}</span></div>
      <a id="a-out" class="out">${I.logout}<span>Sign out</span></a>
    </aside>
    <main class="admain"><div class="adtop"><button class="menubtn" id="a-menu" aria-label="Open navigation">☰</button><h2 id="adtitle">Dashboard</h2><div class="spacer" style="flex:1"></div>
      <div class="searchbar" style="padding:9px 14px;max-width:220px">${I.search}<input placeholder="Search…" style="font-size:13px"/></div>
      ${miniControls()}
      <div class="avatar" style="width:36px;height:36px;font-size:14px;background:${grad(me.avatar_color,'#0B5A55')}">${me.name[0]}</div></div>
      <div class="adbody" id="adbody"></div></main></div>`;
  const am=$('#a-menu'); if(am) am.onclick=()=>body.querySelector('.side').classList.toggle('show');
  const sbar=body.querySelector('.adtop .searchbar'); const sin=sbar&&sbar.querySelector('input');
  if(sin){ sin.setAttribute('aria-label','Search businesses, users and orders'); sin.placeholder='Search businesses, users, orders…'; sbar.style.position='relative';
    const dd=document.createElement('div'); dd.className='ad-sdd'; dd.hidden=true; sbar.appendChild(dd); let tm=null;
    sin.oninput=()=>{ clearTimeout(tm); const q=sin.value.trim(); if(q.length<2){ dd.hidden=true; return; } tm=setTimeout(async()=>{ try{ const r=await api('/admin/search?q='+encodeURIComponent(q));
      const sec=(title,items,fn)=>items.length?`<div class="ad-sh">${title}</div>`+items.map(fn).join(''):'';
      const html=sec('Businesses',r.businesses,b=>`<button data-go="biz" data-id="${b.id}"><b>${esc(b.name)}</b><small>${esc(b.subcategory||'')} · ${esc(b.status)}</small></button>`)
        + sec('Users',r.users,u=>`<button data-go="users"><b>${esc(u.name)}</b><small>${esc(u.email||u.phone||'')} · ${esc(u.role)}</small></button>`)
        + sec('Orders',r.orders,o=>`<button data-go="orders"><b>#${1000+o.id} · ${esc(o.business)}</b><small>${money(o.total)} · ${esc(o.status)}</small></button>`);
      dd.innerHTML = html || '<p class="ad-sh">No matches</p>'; dd.hidden=false;
      dd.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>{ dd.hidden=true; sin.value=''; if(x.dataset.go==='biz'){ adminRoute='businesses'; adminBiz=Number(x.dataset.id); } else { adminRoute=x.dataset.go; adminBiz=null; } renderAdmin(body); });
    }catch(e){} },220); };
    sin.onkeydown=e=>{ if(e.key==='Escape'){ dd.hidden=true; sin.blur(); } };
    document.addEventListener('click',e=>{ if(!sbar.contains(e.target)) dd.hidden=true; });
  }
  body.querySelectorAll('.side a[data-r]').forEach(a=>a.onclick=()=>{ adminRoute=a.dataset.r; adminBiz=null; renderAdmin(body); });
  $('#a-out').onclick=()=>{ token=null;me=null;localStorage.removeItem('ll_token');localStorage.removeItem('ll_user'); openView('customer'); };
  renderAdminRoute();
}

async function renderAdminRoute(){
  const el = $('#adbody'); const title=$('#adtitle');
  const NICE = { local_info:'Local Info', subscription_plans:'Subscriptions' };
  const nice = NICE[adminRoute] || (adminRoute.charAt(0).toUpperCase()+adminRoute.slice(1));
  if(title) title.textContent = nice;
  if(!el) return;
  el.innerHTML = `<div class="stat-grid">${Array(4).fill('<div class="sk" style="height:96px"></div>').join('')}</div>`;
  try{
    if(adminRoute==='businesses' && adminBiz){ if(title) title.textContent='Business'; return renderAdminBusinessDetail(el, adminBiz); }
    if(adminRoute==='dashboard') return renderAdminDashboard(el);
    if(adminRoute==='locations') return renderAdminLocations(el);
    if(adminRoute==='notifications') return renderAdminNotifications(el);
    if(adminRoute==='settings') return renderAdminSettings(el);
    if(['businesses','users','categories','products','services','reviews','orders','news','events','offers','workers','drivers','local_info','subscription_plans','leads','advertisements'].includes(adminRoute)) return renderAdminTable(el, adminRoute, nice);
    // placeholders
    el.innerHTML = adminPlaceholder(nice);
  }catch(e){ el.innerHTML = errorState(e.message); }
}

async function renderAdminLocations(el){
  const { areas, googleEnabled } = await api('/admin/areas');
  const banner = googleEnabled
    ? `<div class="ai-bubble" style="margin-bottom:14px">Google Places is connected. Click <b>Import from Google</b> on any area to fetch real shops (restaurants, groceries, pharmacies, salons and more) live into that area.</div>`
    : `<div class="ai-bubble" style="margin-bottom:14px;background:var(--warning-bg);border-color:var(--warning)">To pull <b>real shops live from Google</b>, add a <code>GOOGLE_PLACES_API_KEY</code> environment variable (Render → your service → Environment) and redeploy. The import buttons below then populate each area automatically — no manual entry.</div>`;
  el.innerHTML = banner + `<div class="panel"><div class="ph"><h3>${areas.length} areas</h3><span class="badge ${googleEnabled?'open':'warn'}">${googleEnabled?'Google connected':'Demo data'}</span></div>
    <div style="overflow-x:auto"><table><thead><tr><th>Area</th><th>Panchayath / Municipality</th><th>Shops</th><th>Actions</th></tr></thead><tbody>
    ${areas.map(a=>`<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.panchayath||'')}</td><td class="tabnums">${a.business_count}</td>
      <td><button class="btn sm" data-imp="${a.id}" data-name="${esc(a.name)}">Import from Google</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  el.querySelectorAll('[data-imp]').forEach(b=>b.onclick=async()=>{
    b.disabled=true; b.textContent='Importing…';
    try{ const r=await api('/admin/import-google',{method:'POST',body:{area_id:Number(b.dataset.imp)}});
      if(r.needsKey){ toast('Add GOOGLE_PLACES_API_KEY to enable live import'); }
      else { toast(`Imported ${r.imported} shops into ${r.area} (${r.skipped} already existed)`); renderAdminRoute(); }
    }catch(e){ toast(e.message); }
    finally{ b.disabled=false; if(b.textContent==='Importing…') b.textContent='Import from Google'; }
  });
}

function fmtWhen(s){ if(!s) return ''; const d=new Date(String(s).replace(' ','T')+(String(s).includes('T')||String(s).includes('Z')?'':'Z')); return isNaN(d)?String(s):d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }
async function renderAdminNotifications(el){
  const [data, opts] = await Promise.all([ api('/admin/notifications'), getAdminOptions() ]);
  const areaOpts = (opts.areas||[]).map(a=>`<option value="${a.id}">${esc(a.name)}${a.panchayath?` (${esc(a.panchayath)})`:''}</option>`).join('');
  el.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,420px) 1fr;gap:16px;align-items:start">
    <div class="panel"><div class="ph"><h3>Compose broadcast</h3></div>
      <div style="padding:16px">
        <div class="field"><label>Title *</label><div class="input"><input id="nb_title" placeholder="e.g. Onam offers are live!"/></div></div>
        <div class="field"><label>Message *</label><div class="input"><textarea id="nb_body" rows="3" placeholder="Write the notification message…"></textarea></div></div>
        <div class="field"><label>Type</label><div class="input"><select id="nb_type">
          <option value="announcement">Announcement</option><option value="offer">Offer</option><option value="news">News</option><option value="event">Event</option><option value="order">Order</option></select></div></div>
        <div class="field"><label>Audience</label><div class="input"><select id="nb_aud">
          <option value="all">All users (${data.totalUsers})</option>
          <option value="role">By role</option>
          <option value="area">By area</option></select></div></div>
        <div class="field" id="nb_rolewrap" hidden><label>Role</label><div class="input"><select id="nb_role">
          <option value="customer">Customers</option><option value="business_partner">Business partners</option></select></div></div>
        <div class="field" id="nb_areawrap" hidden><label>Area</label><div class="input"><select id="nb_area">${areaOpts}</select></div></div>
        <button class="btn block" id="nb_send">Send broadcast</button>
      </div></div>
    <div class="panel"><div class="ph"><h3>Recent broadcasts</h3><span class="badge neutral">${data.sent.length}</span></div>
      <div style="overflow-x:auto"><table><thead><tr><th>Title</th><th>Message</th><th>Type</th><th>Recipients</th><th>Sent</th></tr></thead><tbody id="nb_list">
      ${data.sent.length? data.sent.map(s=>`<tr><td><b>${esc(s.title)}</b></td><td>${esc(String(s.body).slice(0,60))}${String(s.body).length>60?'…':''}</td><td><span class="badge primary">${esc(s.type||'')}</span></td><td class="tabnums">${s.recipients}</td><td class="faint">${esc(fmtWhen(s.sent_at))}</td></tr>`).join('')
        : `<tr><td colspan="5"><div class="empty" style="padding:36px"><p class="muted">No broadcasts yet. Compose one on the left.</p></div></td></tr>`}
      </tbody></table></div></div></div>`;
  const aud=$('#nb_aud');
  aud.onchange=()=>{ $('#nb_rolewrap').hidden = aud.value!=='role'; $('#nb_areawrap').hidden = aud.value!=='area'; };
  $('#nb_send').onclick=async()=>{
    const title=$('#nb_title').value.trim(), body=$('#nb_body').value.trim();
    if(!title||!body) return toast('Title and message are required');
    const payload={ title, body, type:$('#nb_type').value, audience:aud.value };
    if(aud.value==='role') payload.role=$('#nb_role').value;
    if(aud.value==='area') payload.area_id=$('#nb_area').value;
    const btn=$('#nb_send'); btn.disabled=true; btn.textContent='Sending…';
    try{ const r=await api('/admin/notifications/broadcast',{method:'POST',body:payload});
      toast(`Broadcast sent to ${r.sent} user${r.sent===1?'':'s'}`); renderAdminNotifications(el);
    }catch(e){ toast(e.message); btn.disabled=false; btn.textContent='Send broadcast'; }
  };
}

const SETTINGS_SCHEMA = [
  ['Brand', [
    ['platform_name','Platform name','text'],
    ['tagline','Tagline','text'],
    ['city','City / region','text'],
  ]],
  ['Contact', [
    ['support_email','Support email','text'],
    ['support_phone','Support phone','text'],
  ]],
  ['Defaults', [
    ['default_language','Default language','sel:lang2'],
    ['currency','Currency symbol','text'],
  ]],
  ['Features', [
    ['allow_signups','Allow new customer sign-ups','bool'],
    ['require_verification','Require business verification','bool'],
    ['enable_chat','Enable store chat (premium)','bool'],
    ['enable_leads','Enable leads engine','bool'],
  ]],
  ['Plan limits', [
    ['leads_per_month','Leads per month (premium)','number'],
    ['promos_per_month','Promotions per month (premium)','number'],
  ]],
];
async function renderAdminSettings(el){
  const s = await api('/admin/settings');
  const langO=[['en','English'],['ml','Malayalam']];
  const fieldFor=(k,label,type)=>{
    const v = s[k];
    if(type==='bool') return `<label class="checkrow" style="margin:0"><input type="checkbox" data-sk="${k}" ${String(v)==='1'?'checked':''}/> <span>${label}</span></label>`;
    if(type==='number') return `<div class="field"><label>${label}</label><div class="input"><input data-sk="${k}" type="number" value="${esc(v??'')}"/></div></div>`;
    if(type==='sel:lang2') return `<div class="field"><label>${label}</label><div class="input"><select data-sk="${k}">${langO.map(([vv,ll])=>`<option value="${vv}" ${String(v)===vv?'selected':''}>${ll}</option>`).join('')}</select></div></div>`;
    return `<div class="field"><label>${label}</label><div class="input"><input data-sk="${k}" value="${esc(v??'')}"/></div></div>`;
  };
  el.innerHTML = `<div style="max-width:760px">
    ${SETTINGS_SCHEMA.map(([grp,fields])=>`<div class="panel" style="margin-bottom:16px"><div class="ph"><h3>${grp}</h3></div>
      <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px 18px">${fields.map(f=>fieldFor(...f)).join('')}</div></div>`).join('')}
    <div style="display:flex;gap:10px;align-items:center"><button class="btn" id="set_save">Save settings</button>
      <span class="faint" id="set_msg" style="font-size:12.5px"></span></div></div>`;
  $('#set_save').onclick=async()=>{
    const payload={};
    el.querySelectorAll('[data-sk]').forEach(inp=>{ payload[inp.dataset.sk] = inp.type==='checkbox' ? (inp.checked?'1':'0') : inp.value; });
    const btn=$('#set_save'); btn.disabled=true; btn.textContent='Saving…';
    try{ await api('/admin/settings',{method:'PUT',body:payload});
      $('#set_msg').textContent='✓ Saved'; toast('Settings saved');
    }catch(e){ toast(e.message); }
    finally{ btn.disabled=false; btn.textContent='Save settings'; }
  };
}

function adminPlaceholder(name){
  const info = {
    Locations:['pin','Manage districts, panchayaths and areas so Local Link can expand to new towns.'],
    Subscriptions:['card','Create and price partner plans (Free / Business / Premium) and manage active subscriptions.'],
    Advertisements:['megaphone','Sell banners, featured placement and sponsored products with impression & click analytics.'],
    Notifications:['bell','Broadcast push notifications to all users, or target by district, panchayath or category.'],
    Settings:['cog','Platform settings — languages, payments, verification rules, feature flags and privacy.'],
  }[name] || ['store','Module'];
  return `<div class="panel" style="padding:0"><div class="ph"><h3>${name}</h3><span class="badge primary">Ready to build</span></div>
    <div class="empty" style="padding:56px"><div class="eic">${gi(info[0])}</div><h4 style="color:var(--ink);font-size:16px">${name}</h4><p style="max-width:420px">${info[1]}</p></div></div>`;
}

async function renderAdminDashboard(el){
  const d = await api('/admin/overview');
  const S=d.stats;
  const card=(lab,val,emoji,tone)=>`<div class="kpi"><div class="kpi-top"><span>${lab}</span><i class="kic">${gi(emoji)}</i></div><b class="tabnums">${val}</b><svg class="spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24 C15 20 22 26 36 18 S58 8 72 14 S98 4 120 8 L120 30 L0 30Z" class="sa"/><path d="M0 24 C15 20 22 26 36 18 S58 8 72 14 S98 4 120 8" class="sl"/></svg></div>`;
  const donutColors=['#0EA5A4','#F97362','#6366F1','#F59E0B','#EC4899','#0EA5E9','#22C55E','#8B5CF6'];
  el.innerHTML = `
    <div class="kpis">
      ${card('Total users', S.users, 'users')}
      ${card('Active businesses', S.businesses, 'store')}
      ${card('Total orders', S.orders, 'package')}
      ${card('Revenue (completed)', money(S.revenue), 'card','var(--success-bg)')}
    </div>
    <div class="kpis">
      ${card('Pending approvals', S.pending, 'store','var(--warning-bg)')}
      ${card('Leads captured', S.leads||0, 'star')}
      ${card('Premium businesses', S.premium||0, 'card','var(--primary-50)')}
      ${card('Reviews', S.reviews, 'star')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px" id="charts">
      <div class="panel"><div class="ph"><h3>Businesses by category</h3></div><div style="padding:18px;display:flex;gap:20px;align-items:center" id="donut"></div></div>
      <div class="panel"><div class="ph"><h3>Orders by status</h3></div><div style="padding:18px" id="bars"></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;margin-top:14px" class="ad-row2">
      <div class="panel"><div class="ph"><h3>Approvals queue</h3><span class="badge ${d.pendingList&&d.pendingList.length?'warn':'open'}">${(d.pendingList||[]).length} waiting</span></div>
        <div id="apq" class="ad-apq">${(d.pendingList||[]).length? d.pendingList.map(b=>`<div class="ad-ap" data-apid="${b.id}"><label><input type="checkbox" value="${b.id}" aria-label="Select ${esc(b.name)}"/></label><div><b>${esc(b.name)}</b><small>${esc(b.subcategory||'')}${b.area?' · '+esc(b.area):''}</small></div>
          <button class="btn sm" data-apst="approved">Approve</button><button class="btn sm ghost" data-apst="rejected">Reject</button></div>`).join('')
          + `<div class="ad-bulk"><label><input type="checkbox" id="apAll"/> Select all</label><button class="btn sm" data-bulk="approved">Approve selected</button><button class="btn sm ghost" data-bulk="rejected">Reject selected</button></div>`
          : `<div class="empty" style="padding:26px"><div class="eic">${gi('shield')}</div><p>Nothing waiting — all businesses reviewed.</p></div>`}</div></div>
      <div class="panel"><div class="ph"><h3>Customer funnel</h3><span class="muted" style="font-size:12px">last 30 days · sessions</span></div><div id="funnel" class="ad-fun">${skeletonRow(2)}</div></div>
    </div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Top rated businesses</h3></div>
      <table><thead><tr><th>Business</th><th>Rating</th><th>Reviews</th></tr></thead><tbody>
      ${d.topRated.map(b=>`<tr><td><b>${esc(b.name)}</b></td><td>${stars(b.rating)}</td><td class="tabnums">${b.review_count}</td></tr>`).join('')}
      </tbody></table></div>`;
  // approvals queue
  const setSt=async(ids,st)=>{ try{ for(const id of ids) await api(`/admin/businesses/${id}/status`,{method:'POST',body:{status:st}}); toast(`${ids.length} business${ids.length>1?'es':''} ${st}`); renderAdminRoute(); }catch(e){ toast(e.message); } };
  el.querySelectorAll('[data-apst]').forEach(b=>b.onclick=()=>setSt([b.closest('[data-apid]').dataset.apid], b.dataset.apst));
  const apAll=$('#apAll'); if(apAll) apAll.onchange=()=>el.querySelectorAll('#apq .ad-ap input').forEach(c=>c.checked=apAll.checked);
  el.querySelectorAll('[data-bulk]').forEach(b=>b.onclick=()=>{ const ids=[...el.querySelectorAll('#apq .ad-ap input:checked')].map(c=>c.value); if(!ids.length) return toast('Select at least one'); setSt(ids,b.dataset.bulk); });
  // funnel
  api('/admin/funnel').then(f=>{ const draw=(steps)=>{ const top=Math.max(1,steps[0].sessions); return steps.map((x,i)=>{ const pct=Math.round(x.sessions/top*100); const drop=i?Math.round(100-(x.sessions/Math.max(1,steps[i-1].sessions))*100):0;
      return `<div class="ad-fs"><span>${esc(x.label)}</span><div class="ad-fb"><i style="width:${Math.max(2,pct)}%"></i></div><b>${x.sessions}</b>${i&&steps[i-1].sessions?`<em>${drop>0?'−'+drop+'%':'—'}</em>`:'<em></em>'}</div>`; }).join(''); };
    const fn=$('#funnel'); if(fn) fn.innerHTML = draw(f.shopping) + `<div class="ad-fsep">Ask Local Link</div>` + draw(f.ask) + `<p class="muted" style="font-size:11.5px;margin-top:8px">Counts unique app sessions. Fills in as people use the customer app.</p>`; }).catch(()=>{ const fn=$('#funnel'); if(fn) fn.innerHTML='<p class="muted">Funnel unavailable.</p>'; });
  // donut
  const total=d.byCategory.reduce((s,x)=>s+x.value,0)||1; let acc=0; const R=54,C=2*Math.PI*R;
  const segs=d.byCategory.map((x,i)=>{ const frac=x.value/total; const dash=frac*C; const seg=`<circle cx="70" cy="70" r="${R}" fill="none" stroke="${donutColors[i%donutColors.length]}" stroke-width="20" stroke-dasharray="${dash} ${C-dash}" stroke-dashoffset="${-acc*C}" transform="rotate(-90 70 70)"/>`; acc+=frac; return seg; }).join('');
  $('#donut').innerHTML = `<svg width="140" height="140" viewBox="0 0 140 140" style="flex:0 0 auto">${segs}<text x="70" y="66" text-anchor="middle" style="font:700 22px var(--font-display);fill:var(--ink)">${total}</text><text x="70" y="84" text-anchor="middle" style="font:600 10px var(--font-body);fill:var(--muted)">BUSINESSES</text></svg>
    <div class="legend">${d.byCategory.map((x,i)=>`<div class="li"><span class="sw" style="background:${donutColors[i%donutColors.length]}"></span>${esc(x.label)} <b style="margin-left:auto;color:var(--ink)">${x.value}</b></div>`).join('')}</div>`;
  // bars
  const maxV=Math.max(...d.ordersByStatus.map(x=>x.value),1);
  $('#bars').innerHTML = d.ordersByStatus.map(x=>`<div class="bar-row"><span class="bl">${esc(x.label.replace('_',' '))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(x.value/maxV*100)}%"></div></div><span class="bv tabnums">${x.value}</span></div>`).join('') || '<p class="muted">No orders yet.</p>';
}

const SINGULAR = { businesses:'Business', users:'User', categories:'Category', products:'Product', services:'Service', news:'News', event:'Event', events:'Event', offers:'Offer', workers:'Worker', drivers:'Driver', local_info:'Local Info', subscription_plans:'Plan', advertisements:'Advertisement' };
const CREATABLE = ['businesses','products','services','offers','news','events','workers','drivers','local_info','categories','subscription_plans','users','advertisements'];
let adminOptions = null;
async function getAdminOptions(){ if(!adminOptions) adminOptions = await api('/admin/options'); return adminOptions; }

// ---- form field schemas ----
const O = {
  status_biz:[['approved','Approved'],['pending','Pending'],['suspended','Suspended'],['rejected','Rejected']],
  status_news:[['published','Published'],['draft','Draft'],['scheduled','Scheduled'],['archived','Archived']],
  status_offer:[['active','Active'],['expired','Expired']],
  price_level:[[1,'₹ Budget'],[2,'₹₹ Mid'],[3,'₹₹₹ Premium']],
  stock:[['in_stock','In stock'],['low_stock','Low stock'],['out_of_stock','Out of stock']],
  news_cat:[['Local','Local'],['Government','Government'],['Education','Education'],['Business','Business'],['Community','Community'],['Health','Health']],
  info_cat:[['Emergency','Emergency'],['Government','Government'],['Healthcare','Healthcare'],['Bank','Bank'],['Education','Education'],['Community','Community'],['Tourism','Tourism']],
  cat_kind:[['business','Business'],['service','Service'],['worker','Worker'],['driver','Driver'],['info','Info'],['content','Content']],
  driver_type:[['auto','Auto'],['taxi','Taxi'],['delivery','Delivery']],
  roles:[['customer','Customer'],['business_partner','Business Partner'],['service_provider','Service Provider'],['worker','Worker'],['driver','Driver'],['admin','Admin']],
  ad_placement:[['home_banner','Home banner'],['search_top','Search top'],['category_top','Category top'],['sponsored_card','Sponsored card']],
  status_ad:[['active','Active'],['paused','Paused'],['expired','Expired']],
};
const ADMIN_FORMS = {
  businesses:[ ['name','Name','text',{req:1}],['category_id','Category','ref-categories',{req:1}],['area_id','Area','ref-areas',{req:1}],['subcategory','Type / subcategory','text'],['phone','Phone','text'],['whatsapp','WhatsApp','text'],['address','Address','text'],['description','Description','textarea'],['price_level','Price level','sel:price_level'],['rating','Rating','number'],['status','Status','sel:status_biz'],['featured','Featured on home','check'],['cover_url','Cover photo','image'],['open_min','Opens','time'],['close_min','Closes','time'],['plan_id','Plan','ref-plans'] ],
  products:[ ['business_id','Business','ref-businesses',{req:1}],['name','Product name','text',{req:1}],['price','Price ₹','number',{req:1}],['mrp','MRP ₹','number'],['unit','Unit','text'],['stock_status','Stock','sel:stock'],['image_url','Product photo','image'],['description','Description','textarea'] ],
  services:[ ['business_id','Business','ref-businesses',{req:1}],['category_id','Category','ref-categories'],['name','Service name','text',{req:1}],['starting_price','Starting price ₹','number'],['rating','Rating','number'],['available','Available','check'],['description','Description','textarea'] ],
  offers:[ ['business_id','Business','ref-businesses',{req:1}],['title','Offer title','text',{req:1}],['discount_label','Badge (e.g. 20% OFF)','text'],['description','Description','text'],['start_date','Start date','date'],['end_date','End date','date'],['status','Status','sel:status_offer'] ],
  news:[ ['title','Headline','text',{req:1}],['category','Category','sel:news_cat'],['summary','Summary','text'],['body','Full article','textarea'],['area_id','Area','ref-areas'],['status','Status','sel:status_news'] ],
  events:[ ['title','Event name','text',{req:1}],['description','Description','textarea'],['venue','Venue','text'],['area_id','Area','ref-areas'],['start_date','Date','date'],['time_label','Time (e.g. 5 PM onwards)','text'],['organizer','Organizer','text'],['contact','Contact','text'] ],
  workers:[ ['name','Name','text',{req:1}],['category_id','Category','ref-categories'],['area_id','Area','ref-areas'],['skills','Skills','text'],['experience_years','Experience (years)','number'],['rate','Rate (e.g. ₹1200/day)','text'],['phone','Phone','text'],['whatsapp','WhatsApp','text'],['rating','Rating','number'],['available','Available','check'] ],
  drivers:[ ['name','Name','text',{req:1}],['service_type','Type','sel:driver_type'],['vehicle_model','Vehicle model','text'],['vehicle_number','Vehicle number','text'],['area_id','Area','ref-areas'],['fare_note','Fare note','text'],['phone','Phone','text'],['whatsapp','WhatsApp','text'],['rating','Rating','number'],['available','Available','check'] ],
  local_info:[ ['name','Name','text',{req:1}],['category','Category','sel:info_cat'],['description','Description','text'],['phone','Phone','text'],['address','Address','text'],['area_id','Area','ref-areas'],['emergency','Emergency service','check'],['hours','Hours','text'] ],
  categories:[ ['name','Name','text',{req:1}],['name_ml','Malayalam name','text'],['slug','Slug','text'],['kind','Kind','sel:cat_kind'],['active','Active','check'] ],
  subscription_plans:[ ['name','Plan name','text',{req:1}],['price','Price ₹','number'],['period','Period (month/year/forever)','text'],['tagline','Tagline','text'],['popular','Mark as popular','check'] ],
  users:[ ['name','Name','text',{req:1}],['email','Email','text'],['phone','Phone','text'],['role','Role','sel:roles'],['area_id','Area','ref-areas'] ],
  advertisements:[ ['title','Ad title','text',{req:1}],['placement','Placement','sel:ad_placement'],['business_id','Sponsor business','ref-businesses'],['image_url','Banner image','image'],['target_url','Target link (optional)','text'],['start_date','Start date','date'],['end_date','End date','date'],['status','Status','sel:status_ad'] ],
};
function minToTime(m){ if(m==null||m==='')return''; m=Number(m); return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function timeToMin(v){ if(!v)return null; const [h,m]=v.split(':').map(Number); return h*60+(m||0); }

function fieldHtml(spec, val, opts){
  const [k,label,type,extra={}] = spec;
  const id='f_'+k;
  const wrap=(inner)=>`<div class="field"><label>${label}${extra.req?' *':''}</label>${inner}</div>`;
  if(type==='textarea') return wrap(`<div class="input"><textarea id="${id}" rows="3">${esc(val??'')}</textarea></div>`);
  if(type==='number') return wrap(`<div class="input"><input id="${id}" type="number" value="${val??''}"/></div>`);
  if(type==='date') return wrap(`<div class="input"><input id="${id}" type="date" value="${(val||'').slice(0,10)}"/></div>`);
  if(type==='time') return wrap(`<div class="input"><input id="${id}" type="time" value="${minToTime(val)}"/></div>`);
  if(type==='check') return `<label class="checkrow"><input id="${id}" type="checkbox" ${val?'checked':''}/> <span>${label}</span></label>`;
  if(type==='image'){ const cur=val||''; return wrap(`
    <input type="hidden" id="${id}" value="${esc(cur)}"/>
    <div class="photo-up" data-imgfield="${k}"><input type="file" id="${id}_file" accept="image/*" hidden/>
      <button type="button" class="pu-drop" id="${id}_drop"${cur?' hidden':''}><span class="gi">${GI.package}</span><span>Tap to upload a photo</span></button>
      <div class="pu-prevwrap" id="${id}_wrap"${cur?'':' hidden'}><img id="${id}_prev" class="pu-prev" src="${esc(cur)}"/><button type="button" class="pu-x" id="${id}_clear">${I.back.replace('m15 18-6-6 6-6','M6 6l12 12M18 6 6 18')}</button></div>
      <details style="margin-top:6px"><summary class="faint" style="font-size:11.5px;cursor:pointer">Or paste a photo URL</summary>
        <div class="input" style="margin-top:6px"><input id="${id}_url" value="${esc(cur)}" placeholder="https://…"/></div></details>
    </div>`); }
  if(type.startsWith('sel:')){ const arr=O[type.slice(4)]||[]; return wrap(`<div class="input"><select id="${id}">${arr.map(([v,l])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select></div>`); }
  if(type.startsWith('ref-')){ const key=type.slice(4); const list=(opts[key]||[]); return wrap(`<div class="input"><select id="${id}"><option value="">—</option>${list.map(o=>`<option value="${o.id}" ${String(val)===String(o.id)?'selected':''}>${esc(o.name)}${o.panchayath?` (${esc(o.panchayath)})`:''}</option>`).join('')}</select></div>`); }
  return wrap(`<div class="input"><input id="${id}" value="${esc(val??'')}" ${extra.max?`maxlength="${extra.max}"`:''}/></div>`);
}

async function openPartnerForm(){
  const opts = await getAdminOptions();
  const bizOpts = (opts.businesses||[]).map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const planOpts = (opts.plans||[]).map(p=>`<option value="${p.id}" ${p.id===2?'selected':''}>${esc(p.name)}</option>`).join('');
  const genpw = 'LL' + Math.random().toString(36).slice(2,8);
  showSheetAdmin('Create partner login', `
    <p class="muted" style="font-size:12.5px;margin:0 0 12px">Generate login credentials for a business partner and link them to their business.</p>
    <div class="field"><label>Partner name *</label><div class="input"><input id="pf_n" placeholder="e.g. Ramesh Kumar"/></div></div>
    <div class="field"><label>Email *</label><div class="input"><input id="pf_e" type="email" placeholder="owner@business.com"/></div></div>
    <div class="field"><label>Phone *</label><div class="input"><input id="pf_p" type="tel" placeholder="+91…"/></div></div>
    <div class="field"><label>Temporary password *</label><div class="input"><input id="pf_pw" value="${genpw}"/></div></div>
    <div class="row" style="gap:10px">
      <div class="field" style="flex:1"><label>Link to business</label><div class="input"><select id="pf_biz"><option value="">— None —</option>${bizOpts}</select></div></div>
      <div class="field" style="flex:1"><label>Plan</label><div class="input"><select id="pf_plan">${planOpts}</select></div></div></div>
    <button class="btn block" id="pf_save" type="button" style="margin-top:6px">Create partner login</button>
    <div id="pf_out"></div>`, ()=>{
    $('#pf_save').onclick=async()=>{
      const name=$('#pf_n').value.trim(), email=$('#pf_e').value.trim(), phone=$('#pf_p').value.trim(), password=$('#pf_pw').value.trim();
      if(!name||!email||!phone||!password) return toast('Name, email, phone and password are required');
      try{ const r=await api('/admin/partners',{method:'POST',body:{name,email,phone,password,business_id:$('#pf_biz').value||null,plan_id:$('#pf_plan').value||null}});
        $('#pf_out').innerHTML=`<div class="card" style="padding:14px;margin-top:14px;background:var(--success-bg)">
          <b style="font-size:13.5px">✓ Partner login created</b>
          <div style="font-size:12.5px;margin-top:8px;line-height:1.7">Login: <b>${esc(r.credentials.email)}</b><br>Phone: <b>${esc(r.credentials.phone)}</b><br>Password: <b>${esc(r.credentials.password)}</b></div>
          <p class="faint" style="font-size:11px;margin-top:8px">Share these with the partner. They can sign in at /partner.</p></div>`;
        toast('Partner login created'); adminOptions=null;
      }catch(e){ toast(e.message); }
    };
  });
}
async function openAdminForm(entity, id, prefill){
  const schema = ADMIN_FORMS[entity]; if(!schema) return toast('No form for '+entity);
  const opts = await getAdminOptions();
  let row = {};
  if(id){ try{ row = await api(`/admin/${entity}/${id}`); }catch(e){ return toast(e.message); } }
  if(prefill) row = { ...prefill, ...row };
  const title = (id?'Edit ':'Add ')+(SINGULAR[entity]||entity);
  const body = `<form id="adminform" onsubmit="return false">${schema.map(s=>fieldHtml(s, row[s[0]], opts)).join('')}
    <button class="btn block" id="afsave" type="submit">${id?'Save changes':'Create'}</button></form>`;
  showSheetAdmin(title, body, ()=>{
    // wire image-upload fields
    schema.filter(s=>s[2]==='image').forEach(s=>{ const id='f_'+s[0];
      const hid=document.getElementById(id), file=document.getElementById(id+'_file'),
            drop=document.getElementById(id+'_drop'), wrap=document.getElementById(id+'_wrap'),
            prev=document.getElementById(id+'_prev'), clr=document.getElementById(id+'_clear'), url=document.getElementById(id+'_url');
      if(drop) drop.onclick=()=>file.click();
      if(file) file.onchange=async()=>{ const f=file.files[0]; if(!f)return; try{ toast('Processing photo…'); const d=await readImageFile(f); hid.value=d; if(url)url.value=''; prev.src=d; wrap.hidden=false; drop.hidden=true; }catch(e){ toast('Could not read image'); } };
      if(clr) clr.onclick=()=>{ hid.value=''; if(url)url.value=''; file.value=''; wrap.hidden=true; drop.hidden=false; };
      if(url) url.oninput=()=>{ hid.value=url.value.trim(); };
    });
    $('#afsave').onclick=async()=>{
      const payload={};
      for(const s of schema){ const [k,,type,extra={}]=s; const elx=document.getElementById('f_'+k); if(!elx)continue;
        let v;
        if(type==='check') v=elx.checked?1:0;
        else if(type==='time') v=timeToMin(elx.value);
        else if(type==='number') v=elx.value===''?null:Number(elx.value);
        else if(type==='image') v=elx.value||null;
        else v=elx.value;
        if(extra.req && (v===''||v==null)) { toast(s[1]+' is required'); return; }
        payload[k]=v;
      }
      try{
        if(id) await api(`/admin/${entity}/${id}`,{method:'PATCH',body:payload});
        else await api(`/admin/${entity}`,{method:'POST',body:payload});
        closeSheet(); toast((SINGULAR[entity]||'Record')+(id?' updated':' created'));
        adminOptions=null; if(entity==='categories') await loadRef();
        renderAdminRoute();
      }catch(e){ toast(e.message); }
    };
  });
}

async function renderAdminTable(el, name, nice){
  const rows = await api('/admin/table/'+name);
  const data = Array.isArray(rows)?rows:(rows||[]);
  const cols = data.length? Object.keys(data[0]).filter(k=>k!=='id') : [];
  const canApprove = name==='businesses'; const canModerate=name==='reviews'; const canCat=name==='categories';
  const canEdit = !!ADMIN_FORMS[name]; const canDelete = name!=='orders';
  const canAdd = CREATABLE.includes(name);
  const badgeFor=(k,v)=>{ if(['status','verification_status','stock_status','service_type','period'].includes(k)){ const tone=/approv|publish|in_stock|verified|active|completed/i.test(v)?'open':/pending|new/i.test(v)?'warn':/reject|suspend|hidden|cancel|out_of/i.test(v)?'closed':'neutral'; return `<span class="badge ${tone}">${esc(String(v).replace(/_/g,' '))}</span>`; } if(k==='rating') return stars(v); if(k==='role') return `<span class="badge primary">${esc(String(v).replace(/_/g,' '))}</span>`; if(k==='price'||k==='total') return money(v); if(['active','emergency','popular','available','featured'].includes(k)) return `<span class="badge ${v?'open':'neutral'}">${v?'yes':'no'}</span>`; return esc(v==null?'':String(v).length>54?String(v).slice(0,54)+'…':v); };
  const canView = name==='businesses';
  const hasActions = canView||canApprove||canModerate||canCat||canEdit||canDelete;
  el.innerHTML = `<div class="panel"><div class="ph"><h3>${data.length} ${(nice||name).toLowerCase()}</h3>
      <div class="row" style="gap:8px">
        ${name==='businesses'?`<button class="btn sm ghost" data-goloc="1">${I.pin} Import from Google</button><button class="btn sm ghost" id="addpartner">${I.users} Add partner login</button>`:''}
        ${canAdd?`<button class="btn sm" id="addnew">${I.plus} Add ${SINGULAR[name]||name}</button>`:''}</div></div>
    <div style="overflow-x:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c.replace(/_/g,' '))}</th>`).join('')}${hasActions?'<th style="text-align:right">Actions</th>':''}</tr></thead>
      <tbody>${data.length?data.map(r=>`<tr>${cols.map(c=>`<td>${badgeFor(c,r[c])}</td>`).join('')}
        ${hasActions?`<td class="tbn" style="justify-content:flex-end">
          ${canView?`<button class="btn sm" data-viewbiz="${r.id}">Open</button>`:''}
          ${canApprove?`<button class="btn sm ghost" data-act="approve" data-id="${r.id}">Approve</button><button class="btn sm ghost" data-act="suspend" data-id="${r.id}">Suspend</button>`:''}
          ${canModerate?`<button class="btn sm ghost" data-act="hide" data-id="${r.id}">Hide</button><button class="btn sm" data-act="publish" data-id="${r.id}">Publish</button>`:''}
          ${canCat?`<button class="btn sm ghost" data-act="toggle" data-id="${r.id}">Toggle</button>`:''}
          ${canEdit?`<button class="btn sm ghost" data-edit="${r.id}">Edit</button>`:''}
          ${canDelete?`<button class="btn sm ghost danger" data-del="${r.id}">Delete</button>`:''}
        </td>`:''}
      </tr>`).join(''):`<tr><td colspan="${cols.length+1}"><div class="empty" style="padding:36px"><div class="eic">${gi('inbox')}</div><h4 style="color:var(--ink);font-size:15px">No ${(nice||name).toLowerCase()} yet</h4>${canAdd?'<p>Click Add to create the first one.</p>':''}</div></td></tr>`}</tbody></table></div></div>`;
  el.querySelectorAll('[data-act]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.id, act=b.dataset.act;
    try{
      if(act==='approve') await api(`/admin/businesses/${id}/status`,{method:'POST',body:{status:'approved'}});
      else if(act==='suspend') await api(`/admin/businesses/${id}/status`,{method:'POST',body:{status:'suspended'}});
      else if(act==='hide') await api(`/admin/reviews/${id}/status`,{method:'POST',body:{status:'hidden'}});
      else if(act==='publish') await api(`/admin/reviews/${id}/status`,{method:'POST',body:{status:'published'}});
      else if(act==='toggle') await api(`/admin/categories/${id}/toggle`,{method:'POST'});
      toast('Updated'); renderAdminRoute();
    }catch(e){ toast(e.message); }
  });
  el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openAdminForm(name, b.dataset.edit));
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ if(!confirm('Delete this '+(SINGULAR[name]||'record')+'? This cannot be undone.'))return;
    try{ await api(`/admin/${name}/${b.dataset.del}`,{method:'DELETE'}); toast('Deleted'); adminOptions=null; renderAdminRoute(); }catch(e){ toast(e.message); } });
  const an=$('#addnew'); if(an) an.onclick=()=>openAdminForm(name);
  const ap=$('#addpartner'); if(ap) ap.onclick=()=>openPartnerForm();
  el.querySelectorAll('[data-viewbiz]').forEach(b=>b.onclick=()=>{ adminBiz=Number(b.dataset.viewbiz); renderAdminRoute(); });
  const gl=el.querySelector('[data-goloc]'); if(gl) gl.onclick=()=>{ adminRoute='locations'; const sh=document.getElementById('adminshell'); if(sh) renderAdmin(sh); };
}

async function renderAdminBusinessDetail(el, id){
  const d = await api(`/admin/businesses/${id}/full`);
  const b = d.business;
  const money2 = (n)=>'₹'+Number(n||0).toLocaleString('en-IN');
  const statusTone = /approv/.test(b.status)?'open':/pending/.test(b.status)?'warn':'closed';
  const kv = (k,v)=>`<div class="kv"><span class="kk">${k}</span><span class="vv">${v||'—'}</span></div>`;
  const miniTable = (title, rows, addEntity, cols) => `
    <div class="panel" style="margin-top:16px"><div class="ph"><h3>${title} <span class="muted" style="font-weight:500">(${rows.length})</span></h3>
      ${addEntity?`<button class="btn sm" data-add-sub="${addEntity}">${I.plus} Add</button>`:''}</div>
      ${rows.length?`<div style="overflow-x:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}<th></th></tr></thead><tbody>
        ${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[1](r)}</td>`).join('')}
          <td class="tbn" style="justify-content:flex-end">${addEntity?`<button class="btn sm ghost" data-sub-edit="${addEntity}" data-sub-id="${r.id}">Edit</button><button class="btn sm ghost danger" data-sub-del="${addEntity}" data-sub-id="${r.id}">Delete</button>`:''}</td>
        </tr>`).join('')}</tbody></table></div>`
      :`<div class="empty" style="padding:30px"><div class="eic">${gi('inbox')}</div><p>No ${title.toLowerCase()} yet.</p></div>`}</div>`;

  el.innerHTML = `
    <button class="btn ghost sm" id="biz-back" style="margin-bottom:14px">${I.back} Back to businesses</button>
    <div class="panel" style="overflow:hidden">
      <div class="detail-cover" style="height:120px;border-radius:0;background:${grad(b.color1,b.color2)}"><span class="logo" style="font-size:44px">${dIcon(b)}</span></div>
      <div style="padding:18px">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div><h2 style="font-size:22px">${esc(b.name)}</h2>
            <div class="muted" style="margin-top:4px">${esc(b.subcategory||'')} · ${esc(b.category_name||'')} · ${esc(b.area_name||'')}</div>
            <div class="row" style="gap:8px;margin-top:10px">${stars(b.rating)}<span class="badge ${statusTone}">${esc(b.status)}</span><span class="badge primary">${esc(b.plan_name||'Free')}</span><span class="badge neutral">${esc(b.verification_status)}</span></div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn sm ghost" id="biz-edit">${I.plus} Edit</button>
            <button class="btn sm ghost danger" id="biz-del">Delete</button>
          </div>
        </div>
        <div class="kvgrid" style="margin-top:16px">
          ${kv('Phone', esc(b.phone))}${kv('WhatsApp', esc(b.whatsapp))}${kv('Address', esc(b.address))}
          ${kv('Owner', esc(b.owner_name||'—'))}${kv('Reviews', b.review_count)}${kv('Featured', b.featured?'Yes':'No')}
        </div>
        ${b.description?`<p style="color:var(--body);margin-top:14px;line-height:1.6">${esc(b.description)}</p>`:''}
      </div>
    </div>
    ${miniTable('Products', d.products, 'products', [['Name',r=>esc(r.name)],['Price',r=>money2(r.price)],['Stock',r=>`<span class="badge ${r.stock_status==='in_stock'?'open':'warn'}">${esc((r.stock_status||'').replace(/_/g,' '))}</span>`]])}
    ${miniTable('Services', d.services, 'services', [['Name',r=>esc(r.name)],['From',r=>money2(r.starting_price)],['Available',r=>`<span class="badge ${r.available?'open':'neutral'}">${r.available?'Yes':'No'}</span>`]])}
    ${miniTable('Offers', d.offers, 'offers', [['Title',r=>esc(r.title)],['Badge',r=>esc(r.discount_label||'')],['Status',r=>`<span class="badge ${r.status==='active'?'open':'neutral'}">${esc(r.status)}</span>`]])}
    ${miniTable('Reviews', d.reviews, null, [['By',r=>esc(r.author_name)],['Rating',r=>stars(r.rating)],['Comment',r=>esc((r.comment||'').slice(0,60))]])}
    ${miniTable('Orders', d.orders, null, [['#',r=>1000+r.id],['Total',r=>money2(r.total)],['Status',r=>`<span class="badge ${r.status==='completed'?'open':'warn'}">${esc(r.status.replace(/_/g,' '))}</span>`]])}
  `;
  $('#biz-back').onclick=()=>{ adminBiz=null; renderAdminRoute(); };
  $('#biz-edit').onclick=()=>openAdminForm('businesses', id);
  $('#biz-del').onclick=async()=>{ if(!confirm('Delete this business and all its products/offers?'))return; try{ await api(`/admin/businesses/${id}`,{method:'DELETE'}); toast('Business deleted'); adminBiz=null; renderAdminRoute(); }catch(e){toast(e.message);} };
  el.querySelectorAll('[data-add-sub]').forEach(x=>x.onclick=()=>openAdminForm(x.dataset.addSub, null, {business_id:id}));
  el.querySelectorAll('[data-sub-edit]').forEach(x=>x.onclick=()=>openAdminForm(x.dataset.subEdit, Number(x.dataset.subId)));
  el.querySelectorAll('[data-sub-del]').forEach(x=>x.onclick=async()=>{ if(!confirm('Delete this item?'))return; try{ await api(`/admin/${x.dataset.subDel}/${x.dataset.subId}`,{method:'DELETE'}); toast('Deleted'); renderAdminRoute(); }catch(e){toast(e.message);} });
}

function showSheetAdmin(title, body, wire){ // center modal for desktop
  closeSheet();
  const s=h(`<div class="sheet" id="sheet" style="align-items:center;justify-content:center"><div class="panel-s" style="max-width:440px;border-radius:20px;max-height:88%"><div class="sh-head"><h3 style="flex:1;font-size:16px">${title}</h3><button class="tb-btn" id="sclose">✕</button></div><div class="sh-body">${body}</div></div></div>`);
  document.body.appendChild(s); s.addEventListener('click',e=>{if(e.target===s)closeSheet();}); $('#sclose').onclick=closeSheet; if(wire)wire();
}

/* ==================== BOOT ==================== */
async function loadRef(){
  const b = await api('/bootstrap'); ref = b;
}
function viewFromPath(){
  const p = location.pathname;
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/partner')) return 'partner';
  if (p.startsWith('/apps')) return 'launcher';
  return 'customer';
}
// global mini-control + launcher popstate handlers (bound once)
document.addEventListener('click', (e) => {
  const lb = e.target.closest('[data-mini-lang] button');
  if (lb){ state.lang=lb.dataset.l; localStorage.setItem('ll_lang',state.lang); renderShell(); return; }
  if (e.target.closest('[data-mini-theme]')){ cycleTheme(); return; }
});
window.addEventListener('popstate', (e) => {
  // phone back button / swipe-back: close an open panel first, then step back inside the app
  const sh=document.getElementById('sheet'); const cd=document.querySelector('.cd-back');
  if(cd){ cd.querySelector('.cd-acts button')?.click(); return; }
  if(sh){ closeSheet(); return; }
  if(e.state && e.state.ll && nav[state.view] && nav[state.view].length>1){ nav[state.view].pop(); routeRender(); return; }
  if(nav[state.view] && nav[state.view].length>1){ nav[state.view].pop(); routeRender(); return; }
  const v=viewFromPath(); if(v!==state.view){ state.view=v; renderShell(); } });

async function boot(){
  try{
    const [_, ai] = await Promise.all([loadRef(), api('/ai-status').catch(()=>({openai:false}))]);
    state.aiStatus = ai;
    state.view = viewFromPath();
    renderShell();
  }catch(e){
    $('#stage').innerHTML = `<div style="padding:40px;text-align:center"><h3>Couldn't reach the server</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
}
/* ═══════════════════════════════════════════════════════════════════════
   CUSTOMER APP — HIGH-FIDELITY REBUILD (cx)
   Fresh screens, same capabilities and APIs. Partner-app scheme & logo:
   Local Link teal + coral, pin-and-rings logo, wordmark.
   ═══════════════════════════════════════════════════════════════════════ */
const CX = {};
function lxGo(row,i){ const el=row.children[i]; if(!el) return; const d=el.getBoundingClientRect().left-row.getBoundingClientRect().left; row.scrollBy({left:d-16,behavior:'smooth'}); }
function cxHead(title, opts={}){ return `<header class="cx-bar ${opts.tint?'tint':''}"><button class="cx-ib" id="__back" aria-label="Back">${I.back}</button><h1>${esc(title)}</h1>${opts.right||'<span class="cx-ib ghost" aria-hidden="true"></span>'}</header>`; }
function cxStoreCard(b){ const cover=b.cover_url||pic(coverKw(b),b.id,600,380); const navr=b.source==='google'?'place':'business';
  return `<button class="cx-store" data-nav="${navr}" data-id="${b.id}" aria-label="${esc(b.name)}">
    <span class="cx-sph">${photoLayer(cover)}${dIcon(b)}<span class="cx-sopen ${b.is_open?'on':''}">${b.is_open?t('openNow'):'Closed'}</span>
      <span class="fav ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}">${I.heart}</span></span>
    <span class="cx-sb"><b>${esc(b.name)}</b><small>${esc(b.subcategory||b.category_name||'')}${b.area_name?' · '+esc(b.area_name):''}</small>
      <span class="cx-smeta">${b.rating?`<em class="cx-rate">${I.star}${Number(b.rating).toFixed(1)}</em>`:'<em class="qc-new">New</em>'}${b.hours_label?`<em>${gi('clock')}${esc(b.hours_label)}</em>`:''}${b.phone?`<em class="cx-call" data-callbiz="${esc(b.phone)}" role="button" tabindex="0" aria-label="Call ${esc(b.name)}">${I.phone}</em>`:''}</span></span></button>`; }
function cxOffer(o,i){ const img=o.image_url||pic(coverKw({subcategory:o.business||'',category_name:o.business||''})+','+(o.title||'offer'),700+(o.id||0),400,400);
  return `<button class="cx-offer t${i%3}" data-nav="business" data-id="${o.business_id}">
    <span class="cx-ot"><small>${esc(o.business||'Local Link')}</small><b>${esc(o.title)}</b><em>${esc(o.discount_label||'OFFER')}</em><span class="cx-octa">Order now ${I.chev}</span></span>
    <span class="cx-oimg">${photoLayer(img)}${gi('percent')}</span></button>`; }

/* ---------- splash ---------- */
SCREENS.splash = (el) => {
  el.innerHTML = `<div class="cx-splash"><div class="cx-rings"><i></i><i></i><i></i></div>
    <div class="cx-logo">${logoMark(96)}</div><h1><span>Local</span> <span>Link</span></h1><p>Everything local. One place.</p><div class="cx-load"><i></i></div></div>`;
  localStorage.setItem('ll_seen','1');
  if(!state.onboarded){ state.areaId=state.areaId||1; state.areaName=state.areaName||'Kunnamangalam'; state.onboarded=true;
    localStorage.setItem('ll_area',state.areaId); localStorage.setItem('ll_area_name',state.areaName); localStorage.setItem('ll_onboarded','1'); }
  setTimeout(()=>{ if(stack()[stack().length-1].name==='splash'){ nav.customer=[{name: state.introSeen?'home':'intro'}]; routeRender(); } }, 1300);
};
/* ---------- onboarding (first visit only, skippable) ---------- */
SCREENS.intro = (el) => {
  const S=[{ic:'store',t:'Your whole neighbourhood',s:'Shops, food, services, workers and rides around you — in one app.'},
           {ic:'cart',t:'Order in a few taps',s:'Add from local stores, check out, and track your order live.'},
           {ic:'chat',t:'Talk to the shop',s:'Chat, call or just ask Local Link by voice in English or Malayalam.'}];
  let i=0;
  const draw=()=>{ el.innerHTML=`<div class="cx-intro"><button class="cx-skip" id="skip">Skip</button>
      <div class="cx-ill k${i}"><span class="cx-blob"></span><span class="cx-ic">${GI[S[i].ic]}</span><i class="o1"></i><i class="o2"></i><i class="o3"></i></div>
      <h2>${esc(S[i].t)}</h2><p>${esc(S[i].s)}</p>
      <div class="cx-idots">${S.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
      <button class="cx-next" id="nx" aria-label="${i===S.length-1?'Get started':'Next'}"><svg viewBox="0 0 44 44" class="cx-prog"><circle cx="22" cy="22" r="20" style="--p:${(i+1)/S.length*100}"/></svg>${I.chev}</button>
      <small class="cx-gs">${i===S.length-1?'Get started':'Next'}</small></div>`;
    const done=()=>{ state.introSeen=true; localStorage.setItem('ll_intro','1'); nav.customer=[{name:'home'}]; routeRender(); };
    $('#skip').onclick=done; $('#nx').onclick=()=>{ if(i<S.length-1){ i++; draw(); } else done(); }; };
  draw();
};

/* ---------- HOME ---------- */
SCREENS.home = async (el) => {
  const nm = token&&me ? me.name.split(' ')[0] : '';
  const hero = pic('kerala street market shops', 4242, 900, 600);
  el.innerHTML = `
  <header class="cx-hero">${photoLayer(hero)}<span class="cx-hshade"></span>
    <div class="cx-htop">
      <button class="cx-av" data-tabnav="account" aria-label="Account">${nm?esc(nm[0]):logoMark(26)}</button>
      <button class="cx-loc" data-tabnav-loc aria-label="Change area"><small>Your location</small><b>${I.pin}${esc(state.areaName)} ${I.chev.replace('m9 6 6 6-6 6','m6 9 6 6 6-6')}</b></button>
      <span style="flex:1"></span>${custControls()}
      <button class="cx-ib glass" data-nav="notifications" aria-label="Notifications">${I.bell}</button></div>
    <div class="cx-hello"><span class="cx-brandline">${logoMark(22)}<b>Local</b><b>Link</b></span><h1>${nm?`Hi ${esc(nm)}, `:''}what do you<br>need today?</h1></div>
    <div class="cx-search"><button class="cx-stxt" data-nav="searchScreen">${I.search}<span class="sq" id="rotsq">Search shops, food, services…</span></button><button class="cx-mic" id="askHome" aria-label="Ask by voice">${GI.mic}</button></div>
  </header>
  <div id="orderPill"></div>
  <section class="cx-sec"><div class="cx-sh"><h2>${t('shopByCat')}</h2><button class="cx-see" data-nav="categories">${t('seeAll')}</button></div>
    <div class="cx-cats">${(ref.categories||[]).map((c,i)=>`<button class="cx-cat" data-nav="category" data-slug="${c.slug}" style="--n:${i}"><span>${photoLayer(catPhoto(c.slug,c.name))}${catIcon(c.slug)}</span>${esc(catLabel(c))}</button>`).join('')}</div></section>
  <section class="cx-sec"><div class="cx-offers" id="cxOffers"><div class="sk" style="height:150px;flex:0 0 88%"></div></div><div class="cx-odots" id="cxOdots"></div></section>
  <section class="cx-sec"><div class="cx-sh"><h2>${t('openNear')}</h2><button class="cx-see" data-nav="categories">${t('seeAll')}</button></div><div class="cx-rail" id="cxNear">${skeletonCards(2)}</div></section>
  <button class="cx-ask" data-talk><span class="cx-aorb">${GI.mic}</span><span><b>${t('voiceT')}</b><small>${t('voiceS')}</small></span><span class="wave">${Array.from({length:6},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</span></button>
  <section class="cx-sec"><div class="cx-sh"><h2>Mega deals</h2><span class="countdown" id="megacd">${gi('clock')} --:--:--</span></div><div class="cx-rail" id="cxDeals">${skeletonCards(3)}</div></section>
  <section class="cx-sec" id="cxGroc"></section>
  <section class="cx-sec"><div class="cx-sh"><h2>${t('popularServices')}</h2><button class="cx-see" data-nav="category" data-slug="services">${t('seeAll')}</button></div><div class="px stack" id="cxSvc" style="gap:10px">${skeletonRow(2)}</div></section>
  <section class="cx-sec"><div class="cx-sh"><h2>${t('localUpdates')}</h2><button class="cx-see" data-nav="news">${t('seeAll')}</button></div><div class="cx-rail" id="cxNews"></div><div class="px stack" id="cxEv" style="gap:10px;margin-top:10px"></div></section>
  <div style="height:40px"></div>`;
  wireCustControls(el);
  $('#askHome').onclick=()=>openAsk('',{voice:true});
  el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>openAsk('',{voice:true}));
  el.querySelector('[data-tabnav-loc]').onclick=()=>go('location');
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  const rot=$('#rotsq'); let ri=0; const rtm=setInterval(()=>{ if(!document.body.contains(rot)) return clearInterval(rtm); ri=(ri+1)%ROTATE.length; rot.textContent=ROTATE[ri]; rot.classList.remove('fx-swap'); void rot.offsetWidth; rot.classList.add('fx-swap'); },2600);
  if(token) api('/orders').then(os=>{ const live=(os||[]).find(o=>!['completed','rejected','cancelled'].includes(o.status)); const p=$('#orderPill'); if(!live||!p) return;
    const MSG={pending:'is waiting for the store',accepted:'was accepted',preparing:'is being prepared',ready:'is ready',out_for_delivery:'is on the way'};
    p.innerHTML=`<button class="cx-pill" id="opGo"><span class="cx-pdot"></span><span><b>Order from ${esc(live.business)}</b> ${MSG[live.status]||live.status.replace(/_/g,' ')}</span><em>Track</em></button>`; $('#opGo').onclick=()=>setTab('orders'); }).catch(()=>{});
  const [offers, biz, deals, svcs, news, events, grocery, places] = await Promise.all([
    api('/offers'), api('/businesses?featured=1'), api('/products?deal=1&limit=10'), api('/services'), api('/news'), api('/events'),
    api('/products?category=food-grocery&limit=10'), api('/places?area_id='+state.areaId).catch(()=>[]) ]);
  // offers carousel
  const oc=$('#cxOffers'), od=$('#cxOdots'); const O=offers.slice(0,5);
  oc.innerHTML=O.map(cxOffer).join(''); od.innerHTML=O.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('');
  const mark=()=>{ const w=oc.firstElementChild?oc.firstElementChild.offsetWidth+12:1; const i=Math.round(oc.scrollLeft/w); od.querySelectorAll('i').forEach((d,x)=>d.classList.toggle('on',x===i)); [...oc.children].forEach((c,x)=>c.classList.toggle('on',x===i)); };
  oc.addEventListener('scroll',mark,{passive:true}); mark(); let paused=0; oc.addEventListener('pointerdown',()=>paused=Date.now(),{passive:true});
  if(O.length>1){ const tm=setInterval(()=>{ if(!document.body.contains(oc)) return clearInterval(tm); if(Date.now()-paused<5000||document.hidden) return; const w=oc.firstElementChild.offsetWidth+12; lxGo(oc,(Math.round(oc.scrollLeft/w)+1)%O.length); },3200); }
  // open near you
  const near=[]; const seen=new Set(); (places||[]).concat(biz).forEach(b=>{ const k=(b.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); near.push(b); } });
  near.sort((a,b)=>(b.is_open?1:0)-(a.is_open?1:0));
  $('#cxNear').innerHTML = near.slice(0,10).map(cxStoreCard).join('') || emptyState('store','No shops yet','');
  $('#cxDeals').innerHTML = deals.slice(0,10).map((p,i)=>productCard(p,null,{best:i<2})).join(''); startCountdown();
  if(grocery&&grocery.length) $('#cxGroc').innerHTML=`<div class="cx-sh"><h2>Grocery & essentials</h2><button class="cx-see" data-nav="category" data-slug="food-grocery">${t('seeAll')}</button></div><div class="cx-rail">${grocery.slice(0,10).map(p=>productCard(p)).join('')}</div>`;
  $('#cxSvc').innerHTML = svcs.slice(0,4).map(serviceCard).join('');
  $('#cxNews').innerHTML = news.slice(0,5).map(newsCard).join('');
  $('#cxEv').innerHTML = events.slice(0,3).map(eventCard).join('');
};

/* ---------- CATEGORIES ---------- */
SCREENS.categories = async (el) => {
  el.innerHTML = `<header class="cx-bar"><span class="cx-ib ghost"></span><h1>${t('categories')}</h1><button class="cx-ib" data-nav="searchScreen" aria-label="Search">${I.search}</button></header>
    <div class="cx-cgrid">${ref.categories.map((c,i)=>`<button class="cx-ccard" data-nav="category" data-slug="${c.slug}" style="--n:${i}"><span class="cx-cimg">${photoLayer(catPhoto(c.slug,c.name))}${catIcon(c.slug)}</span><b>${esc(catLabel(c))}</b></button>`).join('')}</div>`;
};
SCREENS.explore = SCREENS.categories;

/* ---------- CATEGORY (chips + grid, like the "My Order" reference) ---------- */
SCREENS.category = async (el, {slug, vfilter, vlabel}) => {
  const cat = ref.categories.find(c=>c.slug===slug) || {name:'Category', slug:'', kind:'business'};
  const vre = vfilter && VFILTERS[vfilter]; const title = vlabel || catLabel(cat);
  if (cat.kind==='worker' || cat.kind==='driver' || cat.kind==='info' || slug==='news' || slug==='events'){
    el.innerHTML = `${cxHead(title)}<div class="px stack" id="list" style="gap:10px">${skeletonRow(4)}</div>`; backWire(el);
    if (cat.kind==='worker') renderWorkers($('#list'), await api('/workers'));
    else if (cat.kind==='driver') renderDrivers($('#list'), await api('/drivers'));
    else if (cat.kind==='info') renderLocalInfo($('#list'), await api('/local-info'));
    else if (slug==='news') setTab('news');
    else $('#list').innerHTML=(await api('/events')).map(eventCard).join('');
    return; }
  el.innerHTML = `${cxHead(title,{right:`<button class="cx-ib" data-nav="searchScreen" aria-label="Search">${I.search}</button>`})}
    <nav class="cx-chips" id="subchips" role="tablist"></nav>
    <div id="catoffers"></div>
    <div class="cx-sh px2"><h2>Popular items</h2></div><div class="cx-grid" id="catitems">${skeletonCards(2)}</div>
    <div class="cx-sh px2"><h2>Shops</h2><small class="muted" id="qcCount"></small></div><div class="px stack" id="list" style="gap:10px">${skeletonRow(3)}</div>`;
  backWire(el);
  const [biz, prods, offers, places] = await Promise.all([api(`/businesses?category=${slug}`), api(`/products?category=${slug}&limit=12`), api('/offers'), api(`/places?category=${slug}&area_id=${state.areaId}`).catch(()=>[])]);
  const seen=new Set(); let merged=[];
  (places||[]).forEach(p=>{ if(!seen.has(p.name.toLowerCase())){ seen.add(p.name.toLowerCase()); merged.push(p); } });
  biz.forEach(b=>{ if(!seen.has((b.name||'').toLowerCase())){ seen.add((b.name||'').toLowerCase()); merged.push(b); } });
  if(vre) merged = merged.filter(b=>vre.test((b.subcategory||'')+' '+(b.name||'')));
  merged.sort((a,b)=>(b.rating||0)-(a.rating||0));
  let prodsF=prods; if(vre){ const ids=new Set(merged.map(b=>b.id)); prodsF=prods.filter(p=>ids.has(p.business_id)); }
  const subs=[...new Set(merged.map(b=>b.subcategory).filter(Boolean))].slice(0,10);
  $('#subchips').innerHTML = `<button class="cx-chip on" data-sub="" role="tab" aria-selected="true"><span>${catIcon(slug)}</span>All</button>`+subs.map(s=>`<button class="cx-chip" data-sub="${esc(s)}" role="tab" aria-selected="false"><span>${GI[iconKeyFor({subcategory:s,name:s},'store')]||GI.store}</span>${esc(s)}</button>`).join('');
  const ids=new Set(biz.map(b=>b.id)); const co=(offers||[]).filter(o=>ids.has(o.business_id));
  if(co.length) $('#catoffers').innerHTML=`<div class="cx-offers small">${co.map(cxOffer).join('')}</div>`;
  $('#catitems').innerHTML = prodsF.length? prodsF.map((p,i)=>productCard(p,null,{best:i<1})).join('') : `<p class="muted px2">No items listed yet.</p>`;
  const draw=(items)=>{ $('#qcCount').textContent=items.length+' places'; $('#list').innerHTML=items.length?items.map(bizRow).join(''):emptyState('search','Nothing here yet','Try another area.'); };
  draw(merged);
  $('#subchips').onclick=e=>{ const b=e.target.closest('[data-sub]'); if(!b) return; el.querySelectorAll('#subchips .cx-chip').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-selected',x===b); }); const s=b.dataset.sub; draw(s?merged.filter(x=>x.subcategory===s):merged); };
};

/* ---------- CART ---------- */
SCREENS.cart = async (el) => {
  if(!cart.length){
    el.innerHTML=`${cxHead(t('yourCart'))}<div class="cx-empty"><div class="cx-eill"><span class="cx-blob"></span>${GI.cart}</div><h2>Your cart is empty</h2><p>Add something from a shop near you and it'll show up here.</p><button class="btn" id="shop">Start shopping</button></div><div id="best"></div>`;
    backWire(el); $('#shop').onclick=()=>setTab('home');
    const ps=await api('/products?limit=8'); $('#best').innerHTML=`<div class="cx-sh px2"><h2>Bestsellers near you</h2></div><div class="cx-rail">${ps.map((p,i)=>productCard(p,null,{best:i<2})).join('')}</div>`; return; }
  const FREE=499, sub=cartTotal(), delivery=sub>=FREE?0:29;
  const save=cart.reduce((t,i)=>t+(i.mrp&&i.mrp>i.price?(i.mrp-i.price)*i.qty:0),0)+(delivery===0?29:0);
  el.innerHTML = `${cxHead(t('yourCart'),{right:`<span class="cx-cnt">${cartCount()}</span>`})}
    <p class="cx-from">${gi('store')} Ordering from <b>${esc(cart[0].biz||'your local store')}</b></p>
    <div class="cx-lines">${cart.map((it,i)=>`<div class="cx-line" style="--n:${i}"><span class="cx-limg">${photoLayer(it.image||pic((it.name||'x').toLowerCase(),500+it.id,160,160))}${dIcon({name:it.name},'cart')}</span>
      <div class="cx-lt"><b>${esc(it.name)}</b><small>${esc(it.unit||it.biz||'')}</small><em>${money(it.price*it.qty)}${it.mrp&&it.mrp>it.price?` <s>${money(it.mrp*it.qty)}</s>`:''}</em></div>
      <div class="cx-vstep" role="group" aria-label="Quantity of ${esc(it.name)}"><button data-inc="${it.id}" aria-label="Add one">+</button><b>${it.qty}</b><button data-dec="${it.id}" aria-label="Remove one">${it.qty>1?'−':I.trash||'×'}</button></div></div>`).join('')}</div>
    <button class="cx-more" data-nav="business" data-id="${cartBizId()||1}">${I.plus} Add more from this shop</button>
    ${save>0?`<div class="cx-save">${gi('percent')}<span>You're saving <b>${money(save)}</b> on this order</span></div>`:''}
    <div id="cxSugg"></div>
    <section class="cx-bill"><div><span>Subtotal</span><b>${money(sub)}</b></div><div><span>Delivery</span><b>${delivery?money(delivery):'<em>FREE</em>'}</b></div>
      ${delivery?`<div class="cx-free"><span>Add <b>${money(FREE-sub)}</b> for free delivery</span><i style="--p:${Math.min(100,Math.round(sub/FREE*100))}%"></i></div>`:''}
      <div class="tot"><span>Total</span><b>${money(sub+delivery)}</b></div></section>
    <div style="height:110px"></div>
    <div class="cx-paybar"><div><small>Total</small><b>${money(sub+delivery)}</b></div><button class="btn" id="checkout">Checkout ${I.chev}</button></div>`;
  backWire(el);
  el.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.inc),1); routeRender(); });
  el.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.dec),-1); routeRender(); });
  $('#checkout').onclick=()=>{ track('checkout_start'); gateAction('place your order',()=>go('checkout')); };
  api('/products?limit=10').then(ps=>{ const s=$('#cxSugg'); if(!s) return; const ids=new Set(cart.map(i=>i.id)); const l=(ps||[]).filter(p=>!ids.has(p.id)).slice(0,8);
    if(l.length) s.innerHTML=`<div class="cx-sh px2"><h2>You might also like</h2></div><div class="cx-rail">${l.map(p=>productCard(p)).join('')}</div>`; }).catch(()=>{});
};

/* ---------- CHECKOUT (same order logic, new UI) ---------- */
SCREENS.checkout = async (el) => {
  if(!cart.length){ setTab('home'); return; }
  if(!token){ toast('Please log in'); return go('login'); }
  const a = safeParse(localStorage.getItem('ll_addr')) || { name: me?me.name:'', phone: me?me.phone:'', line:'', area: state.areaName };
  const delivery = cartTotal()>=499?0:29; const pay = cartTotal()+delivery;
  const bizId = cartBizId() || 1; let bizPay=['cash'], upiId=null, bizName=cart[0]?.biz||'';
  try{ const b=await api('/businesses/'+bizId); bizPay=(b.payment_methods&&b.payment_methods.length)?b.payment_methods:['cash']; upiId=b.upi_id; bizName=b.name||bizName; }catch(e){}
  const PM={ cash:['Cash on delivery','Pay when it arrives',GI.card], card:['Card on delivery','Swipe at your door',GI.card], upi:['UPI'+(upiId?' · '+upiId:''),'Pay the shop directly',GI.chat] };
  const methods=bizPay.filter(m=>PM[m]); if(!methods.length) methods.push('cash');
  const hasAddr=!!(a.line&&a.phone);
  el.innerHTML = `${cxHead('Checkout')}
    <div class="cx-steps"><span class="done"><i>✓</i>Cart</span><b></b><span class="on"><i>2</i>Details</span><b></b><span><i>3</i>Done</span></div>
    <section class="cx-card"><div class="cx-ch"><h3>${I.pin} Delivery address</h3>${hasAddr?'<button id="edAddr">Edit</button>':''}</div>
      <div id="addrView" ${hasAddr?'':'hidden'}><div class="cx-addr"><span>${GI.building}</span><div><b>${esc(a.name||'')}</b><small>${esc(a.line||'')}, ${esc(a.area||'')}</small><small>${esc(a.phone||'')}</small></div></div></div>
      <div id="addrEdit" ${hasAddr?'hidden':''}>
        <div class="field"><label for="cn">Full name</label><div class="input"><input id="cn" value="${esc(a.name||'')}" autocomplete="name"/></div></div>
        <div class="field"><label for="cp">Phone</label><div class="input"><input id="cp" value="${esc(a.phone||'')}" placeholder="+91…" inputmode="tel" autocomplete="tel"/></div></div>
        <div class="field"><label for="cl">Address</label><div class="input"><textarea id="cl" rows="2" placeholder="House / building, street, landmark">${esc(a.line||'')}</textarea></div></div>
        <div class="field"><label for="ca">Area</label><div class="input"><input id="ca" value="${esc(a.area||state.areaName)}"/></div></div></div></section>
    <section class="cx-card"><div class="cx-ch"><h3>${GI.card} Payment</h3><small class="muted">accepted by ${esc(bizName)}</small></div>
      <div class="cx-pays" id="payopts">${methods.map((m,i)=>`<button class="cx-pay ${i===0?'on':''}" data-pay="${m}"><span>${PM[m][2]}</span><div><b>${esc(PM[m][0])}</b><small>${PM[m][1]}</small></div><i></i></button>`).join('')}</div></section>
    <section class="cx-bill"><div><span>${cartCount()} item${cartCount()>1?'s':''}</span><b>${money(cartTotal())}</b></div><div><span>Delivery</span><b>${delivery?money(delivery):'<em>FREE</em>'}</b></div><div class="tot"><span>To pay</span><b>${money(pay)}</b></div></section>
    <div style="height:110px"></div>
    <div class="cx-paybar"><div><small>To pay</small><b>${money(pay)}</b></div><button class="btn" id="place">Place order</button></div>`;
  backWire(el);
  const ed=$('#edAddr'); if(ed) ed.onclick=()=>{ $('#addrView').hidden=true; $('#addrEdit').hidden=false; ed.remove(); };
  let payMethod=methods[0];
  el.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{ el.querySelectorAll('[data-pay]').forEach(x=>x.classList.toggle('on',x===b)); payMethod=b.dataset.pay; buzz(); });
  $('#place').onclick=async()=>{
    const name=$('#cn').value.trim(), phone=$('#cp').value.trim(), line=$('#cl').value.trim(), area=$('#ca').value.trim();
    if(!name||!phone||!line){ $('#addrView').hidden=true; $('#addrEdit').hidden=false; return toast('Please fill name, phone and address'); }
    localStorage.setItem('ll_addr', JSON.stringify({name,phone,line,area}));
    const btn=$('#place'); btn.disabled=true; btn.textContent='Placing…';
    const groups={}; cart.forEach(i=>{ (groups[i.bizId||1]=groups[i.bizId||1]||[]).push(i); });
    try{
      for(const [bId,items] of Object.entries(groups)){
        const tot=items.reduce((n,i)=>n+i.qty*i.price,0)+(cartTotal()>=499?0:29);
        await api('/orders',{method:'POST',body:{business_id:Number(bId),total:tot,item_summary:items.map(i=>`${i.qty}× ${i.name}`).join(', '),payment_method:payMethod,
          items_json:items.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,image:i.image||''}))}});
      }
      track('order_placed',{total:pay}); const shop=cart[0]?.biz||''; cart=[]; saveCart(); updateCartBadge(); buzz(30);
      nav.customer=[{name:'orderDone',params:{shop,total:pay}}]; routeRender();
    }catch(e){ btn.disabled=false; btn.textContent='Place order'; toast(e.message); }
  };
};
SCREENS.orderDone = (el, {shop, total}) => {
  el.innerHTML = `<div class="cx-done"><div class="cx-burst">${Array.from({length:12},(_,i)=>`<i style="--a:${i*30}deg"></i>`).join('')}</div>
    <div class="cx-check"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36"/><path d="M24 41l11 11 21-23"/></svg></div>
    <h1>Order placed!</h1><p>${esc(shop||'The shop')} has your order${total?` for <b>${money(total)}</b>`:''}. You'll see each step as they accept and prepare it.</p>
    <button class="btn" id="trk">Track order</button><button class="cx-link" id="cont">Continue shopping</button></div>`;
  $('#trk').onclick=()=>setTab('orders'); $('#cont').onclick=()=>setTab('home');
};

/* ---------- ORDERS + tracking ---------- */
SCREENS.orders = async (el) => {
  if(!token) return openLoginInline(el, 'Log in to see your orders');
  el.innerHTML = `<header class="cx-bar"><span class="cx-ib ghost"></span><h1>${t('orders')}</h1><span class="cx-ib ghost"></span></header><div class="px stack" id="l" style="gap:14px">${skeletonRow(3)}</div>`;
  const orders = await api('/orders');
  const live = orders.find(o=>!['completed','rejected','cancelled'].includes(o.status));
  const STEP={pending:0,accepted:1,preparing:2,ready:3,out_for_delivery:4,completed:5};
  const track=(o)=>`<section class="cx-track"><div class="cx-map" aria-hidden="true">
      <svg viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice"><g class="st"><path d="M-10 40 H350 M-10 118 H350 M60 -10 V180 M175 -10 V180 M280 -10 V180 M-10 160 L120 -10 M210 180 L350 20"/></g>
        <path class="rt" d="M58 128 C110 128 120 60 175 62 S250 40 282 46" pathLength="1"/><circle class="a" cx="58" cy="128" r="7"/><circle class="b" cx="282" cy="46" r="9"/></svg>
      <span class="cx-mp s">${gi('store')}</span><span class="cx-mp h">${I.home}</span></div>
    <div class="cx-tb"><div><small>Order #${1000+o.id}</small><b>${esc(o.business)}</b></div><span class="badge warn">${o.status.replace(/_/g,' ')}</span></div>
    ${orderTimeline(o.status)}<p class="cx-titems">${esc(o.item_summary)}</p>
    <div class="cx-tf"><b>${money(o.total)}</b><button class="btn sm ghost" data-nav="business" data-id="${o.business_id}">${GI.chat} Contact shop</button></div></section>`;
  const past = orders.filter(o=>o!==live);
  $('#l').innerHTML = orders.length ? (live?track(live):'') + (past.length?`<div class="cx-sh"><h2>Past orders</h2></div>`:'') + past.map((o,i)=>`<article class="cx-po" style="--n:${i}">
      <span class="cx-poi">${GI.package}</span><div><b>${esc(o.business)}</b><small>${esc(o.item_summary)}</small><em>${money(o.total)} · <span class="st-${o.status}">${o.status.replace(/_/g,' ')}</span></em></div>
      <button class="cx-again" data-reorder='${esc(JSON.stringify({items:o.items_json,biz:o.business,bizId:o.business_id}))}'>Reorder</button></article>`).join('')
    : `<div class="cx-empty"><div class="cx-eill"><span class="cx-blob"></span>${GI.package}</div><h2>No orders yet</h2><p>Your orders and live tracking will appear here.</p><button class="btn" id="shop">Find a shop</button></div>`;
  const sh=$('#shop'); if(sh) sh.onclick=()=>setTab('home');
  el.querySelectorAll('[data-reorder]').forEach(b=>b.onclick=()=>{ let d={}; try{ d=JSON.parse(b.dataset.reorder); }catch(e){}
    const items = d.items ? (typeof d.items==='string'?safeParse(d.items):d.items) : null;
    if(items && items.length){ cart=[]; items.forEach(it=>{ cart.push({id:it.id,name:it.name,price:it.price,image:it.image||'',biz:d.biz,bizId:Number(d.bizId),qty:it.qty||1}); }); saveCart(); updateCartBadge(); toast('Added to cart'); go('cart'); }
    else if(d.bizId) go('business',{id:d.bizId}); else toast('Nothing to reorder'); });
};

/* ---------- ACCOUNT ---------- */
SCREENS.account = async (el) => {
  const loggedIn=!!token; const nm=loggedIn?me.name:'Guest';
  const row=(attr,ic,label,right='')=>`<button ${attr}><span class="cx-mi">${ic}</span><b>${label}</b>${right?`<small>${right}</small>`:''}${I.chev}</button>`;
  el.innerHTML = `<header class="cx-bar"><span class="cx-ib ghost"></span><h1>My profile</h1>${custControls()}</header>
    <section class="cx-me">${loggedIn?`<span class="cx-mav">${esc(nm[0])}</span><div><b>${esc(nm)}</b><small>${esc(me.email||me.phone||'')}</small></div><button class="cx-ib glass" data-tabnav="profile" aria-label="Edit profile">${I.edit||I.cog}</button>`
      :`<span class="cx-mav">${logoMark(30)}</span><div><b>Welcome to Local Link</b><small>Log in to order, save favourites and review</small></div><button class="btn sm" id="lg">Log in</button>`}</section>
    <button class="btn block" id="installapp" style="margin:0 16px 14px;width:calc(100% - 32px);display:${window.__llInstall?'inline-flex':'none'}">${GI.download||I.plus} Install Local Link</button>
    <div class="cx-menu">
      ${row('data-tabnav="orders"',GI.package,'Order history')}
      ${row('data-nav="saved"',I.heart,'My favourites')}
      ${row('id="bulkreq"',GI.megaphone||I.tag,'Post a requirement')}
      ${row('data-nav="offers"',GI.percent,'Offers & promo codes')}
      ${row('data-nav="location"',I.pin,'My location',esc(state.areaName))}</div>
    <div class="cx-menu">
      ${row('data-nav="localinfo"',GI.building,t('localInfo'))}
      ${row('data-nav="events"',GI.calendar,t('events'))}
      ${row('id="langrow"',I.globe,'Language',state.lang==='ml'?'മലയാളം':'English')}
      ${row('data-tabnav="notifications"',I.bell,'Notifications')}</div>
    <div class="cx-menu">
      <a href="/partner"><span class="cx-mi">${GI.store}</span><b>Sell on Local Link</b>${I.chev}</a>
      ${row('id="help"',GI.chat,'Help & support')}
      ${loggedIn?`<button id="out" class="danger"><span class="cx-mi">${I.logout}</span><b>Sign out</b>${I.chev}</button>`:''}</div>
    <p class="cx-ver">${logoMark(18)} Local Link · Everything local. One place.</p>`;
  wireCustControls(el);
  const inst=$('#installapp'); if(inst){ document.addEventListener('ll-installable',()=>{ if(window.__llInstall) inst.style.display='inline-flex'; });
    inst.onclick=async()=>{ const p=window.__llInstall; if(!p) return toast('Open the browser menu → “Add to Home screen”'); p.prompt(); try{ await p.userChoice; }catch(e){} window.__llInstall=null; inst.style.display='none'; }; }
  const lg=$('#lg'); if(lg) lg.onclick=()=>go('login');
  $('#bulkreq').onclick=()=>{ if(!token){ toast('Please log in to post a requirement'); return go('login'); } openBulkEnquiry(); };
  $('#help').onclick=()=>openAsk('');
  $('#langrow').onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  const out=$('#out'); if(out) out.onclick=async()=>{ const ok=await confirmDialog({title:'Sign out?',message:'Your cart stays on this phone.',ok:'Sign out',cancel:'Stay',danger:true,icon:I.logout}); if(!ok) return;
    token=null; me=null; localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); toast('Signed out'); routeRender(); };
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};

/* ---------- LOGIN (customer) — teal canvas + white card ---------- */
SCREENS.login = (el) => {
  el.innerHTML = `<div class="cx-auth"><div class="cx-aglow"><i></i><i></i></div>
    <button class="cx-ib glass" id="ab" aria-label="Back">${I.back}</button>
    <div class="cx-abrand">${logoMark(54)}<h1><span>Local</span> <span>Link</span></h1></div>
    <section class="cx-acard"><h2>Log in</h2><p>Welcome back — order from shops around ${esc(state.areaName)}.</p>
      <div class="field"><label for="lid">Email or phone</label><div class="input">${I.user}<input id="lid" value="customer@locallink.app" autocomplete="username"/></div></div>
      <div class="field"><label for="lpw">Password</label><div class="input"><span class="gi">${GI.lock}</span><input id="lpw" type="password" value="password" autocomplete="current-password"/></div></div>
      <button class="btn block" id="lsubmit">${t('login')}</button>
      <div class="cx-or"><span>demo accounts</span></div>
      <div class="demo-pill"><button data-d="customer@locallink.app">Customer</button><button data-d="partner@locallink.app">Partner</button><button data-d="admin@locallink.app">Admin</button></div>
      <p class="cx-alt">New to Local Link? <a href="#" id="goreg">Create an account</a></p></section></div>`;
  $('#ab').onclick=back; $('#goreg').onclick=(e)=>{ e.preventDefault(); go('register'); };
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ $('#lid').value=b.dataset.d; $('#lpw').value='password'; });
  const submit=async()=>{ const btn=$('#lsubmit'); btn.disabled=true;
    try{ const r=await api('/auth/login',{method:'POST',body:{identifier:$('#lid').value.trim(),password:$('#lpw').value}});
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me)); toast('Welcome, '+me.name.split(' ')[0]); routeAfterLogin(); }
    catch(e){ btn.disabled=false; const c=$('.cx-acard'); c.classList.remove('fx-shake'); void c.offsetWidth; c.classList.add('fx-shake'); toast(e.message||'Login failed'); } };
  $('#lsubmit').onclick=submit; $('#lpw').onkeydown=e=>{ if(e.key==='Enter') submit(); };
};


/* ═══════════════════════════════════════════════════════════════════════
   CUSTOMER APP v2 (lv) — rebuilt from the Local Link customer UI kit.
   Same APIs and capabilities. Teal + coral, pin-and-rings logo.
   No delivery-time claims: distance/area and hours instead of ETAs.
   ═══════════════════════════════════════════════════════════════════════ */
const LV_TAB_CATS=['food-grocery','restaurants','services','shopping','workers'];
function lvHead(title,right=''){ return `<header class="lv-bar"><button class="lv-ib" id="__back" aria-label="Back">${I.back}</button><h1>${esc(title)}</h1><span class="lv-right">${right}</span></header>`; }
function lvRate(r,c){ return r?`<span class="lv-rate">${I.star}<b>${Number(r).toFixed(1)}</b>${c?`<small>(${c})</small>`:''}</span>`:'<span class="lv-new">New</span>'; }
function lvOpen(b){ return `<span class="lv-open ${b.is_open?'on':''}">${b.is_open?'Open now':'Closed'}</span>`; }
function lvStoreCard(b,i=0){ const cover=b.cover_url||pic(coverKw(b),b.id,600,400); const navr=b.source==='google'?'place':'business';
  return `<button class="lv-scard" data-nav="${navr}" data-id="${b.id}" style="--n:${i}" aria-label="${esc(b.name)}">
    <span class="lv-sph">${photoLayer(cover)}${dIcon(b)}<span class="lv-heart ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}" role="button" aria-label="Save">${I.heart}</span></span>
    <span class="lv-sb"><b>${esc(b.name)}</b><span class="lv-sm">${lvRate(b.rating,b.review_count)}<i>·</i><span>${esc(b.subcategory||b.category_name||'')}</span></span>
      <span class="lv-sm">${lvOpen(b)}${b.area_name?`<span class="lv-dist">${I.pin}${esc(b.area_name)}</span>`:''}</span></span></button>`; }
function lvStoreRow(b,i=0){ const cover=b.cover_url||pic(coverKw(b),b.id,300,300); const navr=b.source==='google'?'place':'business';
  return `<button class="lv-srow" data-nav="${navr}" data-id="${b.id}" style="--n:${i}">
    <span class="lv-rimg">${photoLayer(cover)}${dIcon(b)}</span>
    <span class="lv-rt"><b>${esc(b.name)}</b><span class="lv-sm">${lvRate(b.rating,b.review_count)}<i>·</i><span>${esc(b.subcategory||b.category_name||'')}</span></span>
      <span class="lv-sm">${lvOpen(b)}${b.hours_label?`<span class="lv-dist">${gi('clock')}${esc(b.hours_label)}</span>`:''}</span></span>
    <span class="lv-heart flat ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}" role="button" aria-label="Save">${I.heart}</span></button>`; }
function lvProd(p,biz,i=0){ const src=p.image_url||pic((p.name||'product').toLowerCase(),500+(p.id||0)); const disc=p.mrp&&p.mrp>p.price; const pct=disc?Math.round((1-p.price/p.mrp)*100):0; const oos=p.stock_status==='out_of_stock';
  return `<div class="lv-pcard" data-nav="product" data-id="${p.id}" role="link" tabindex="0" style="--n:${i}">
    <span class="lv-pimg">${photoLayer(src)}${dIcon({name:p.name},'cart')}${p.promo_label?`<em class="lv-off">${esc(p.promo_label)}</em>`:disc?`<em class="lv-off">${pct}% OFF</em>`:''}</span>
    <b>${esc(p.name)}</b><small>${esc(p.unit||'1 unit')}</small>
    <span class="lv-pp"><b>${money(p.price)}</b>${disc?`<s>${money(p.mrp)}</s>`:''}</span>
    <span class="lv-pctl">${oos?'<span class="qc-oos">Out of stock</span>':addCtl(p,src,biz)}</span></div>`; }
function lvSkyline(){ return `<svg class="lv-sky" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path pathLength="1" d="M0 150V120h30V95h18v25h22V70l20-16 20 16v50h16V88h34v32h14V60h10V44h10v16h10v60h18V96l18-14 18 14v24h20V80h40v40h18V100h22v20h20V90h12v30h20v30"/><path pathLength="1" d="M60 104h6M60 112h6M100 82h6M100 94h6M100 106h6M150 98h8M150 108h8M190 70h6M190 82h6M190 94h6M260 92h8M260 104h8M300 92h8M300 104h8"/></svg>`; }
const lvGreet=()=>{ const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; };

/* ---------- splash ---------- */
SCREENS.splash = (el) => {
  el.innerHTML = `<div class="lv-splash"><div class="lv-spc"><div class="lv-slogo">${logoMark(86)}</div><h1><span>Local</span> <span>Link</span></h1><p>Your Neighbourhood.<br>One App.</p></div>${lvSkyline()}</div>`;
  localStorage.setItem('ll_seen','1');
  if(!state.onboarded){ state.areaId=state.areaId||1; state.areaName=state.areaName||'Kunnamangalam'; state.onboarded=true;
    localStorage.setItem('ll_area',state.areaId); localStorage.setItem('ll_area_name',state.areaName); localStorage.setItem('ll_onboarded','1'); }
  setTimeout(()=>{ if(stack()[stack().length-1].name==='splash'){ nav.customer=[{name: state.introSeen?'home':'intro'}]; routeRender(); } }, 1700);
};
/* ---------- onboarding ---------- */
SCREENS.intro = (el) => {
  const S=[{ic:'store',t:'Discover Local Businesses',s:'Shop, order, book services and support your neighbourhood — all in one place.'},
           {ic:'cart',t:'Shop · Eat · Book',s:'Groceries, food, home services and local workers from people you know.'},
           {ic:'mic',t:'Just ask Local Link',s:'Say what you need in English or Malayalam and we will find it nearby.'}];
  let i=0, dir=1;
  const draw=()=>{ el.innerHTML=`<div class="lv-intro">
      <div class="lv-ill k${i} ${dir>0?'in-r':'in-l'}"><span class="lv-halo"></span><span class="lv-halo h2"></span><span class="lv-iic">${GI[S[i].ic]}</span><i class="f1">${GI.pin}</i><i class="f2">${GI.cart}</i><i class="f3">${I.heart}</i></div>
      <div class="lv-itx ${dir>0?'in-r':'in-l'}"><h2>${esc(S[i].t)}</h2><p>${esc(S[i].s)}</p></div>
      <div class="lv-idots">${S.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
      <button class="lv-btn" id="nx">${i===S.length-1?'Get Started':'Next'} ${I.chev}</button>
      <button class="lv-skip" id="skip">Skip</button></div>`;
    const done=()=>{ state.introSeen=true; localStorage.setItem('ll_intro','1'); nav.customer=[{name:'home'}]; routeRender(); };
    $('#skip').onclick=done; $('#nx').onclick=()=>{ if(i<S.length-1){ i++; dir=1; draw(); } else done(); };
    let x0=null; const w=el.querySelector('.lv-intro'); w.addEventListener('touchstart',e=>x0=e.touches[0].clientX,{passive:true});
    w.addEventListener('touchend',e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0; x0=null; if(dx<-50&&i<S.length-1){ i++; dir=1; draw(); } else if(dx>50&&i>0){ i--; dir=-1; draw(); } },{passive:true}); };
  draw();
};

/* ---------- HOME ---------- */
SCREENS.home = async (el) => {
  const nm = token&&me ? me.name.split(' ')[0] : '';
  const cats=(ref.categories||[]); const tabs=[{slug:'',name:'All',ic:I.grid}].concat(LV_TAB_CATS.map(s=>cats.find(c=>c.slug===s)).filter(Boolean).map(c=>({slug:c.slug,name:catLabel(c),ic:GI[CAT_ICON[c.slug]||'store']})));
  if(tabs.length<4) cats.slice(0,5).forEach(c=>{ if(!tabs.find(t=>t.slug===c.slug)) tabs.push({slug:c.slug,name:catLabel(c),ic:GI[CAT_ICON[c.slug]||'store']}); });
  el.innerHTML = `
  <header class="lv-head">
    <div class="lv-htop"><span class="lv-brand">${logoMark(30)}<b>Local</b><b>Link</b></span><span style="flex:1"></span>
      ${custControls()}
      <button class="lv-hb" data-nav="notifications" aria-label="Notifications">${I.bell}<i class="lv-dot"></i></button>
      <button class="lv-av" data-tabnav="account" aria-label="Account">${nm?esc(nm[0]):I.user}</button></div>
    <button class="lv-loc" data-tabnav-loc>${I.pin}<b>${esc(state.areaName)}</b>${I.chev.replace('m9 6 6 6-6 6','m6 9 6 6 6-6')}</button>
    <div class="lv-search"><button class="lv-stxt" data-nav="searchScreen">${I.search}<span id="rotsq">Search shops, food, groceries…</span></button><button class="lv-mic" id="askHome" aria-label="Ask by voice">${GI.mic}</button></div>
    <nav class="lv-tabs" id="lvTabs" role="tablist"><i class="lv-tind"></i>${tabs.map((t,k)=>`<button role="tab" class="${k?'':'on'}" data-hs="${t.slug}" aria-selected="${!k}"><span>${t.ic}</span>${esc(t.name)}</button>`).join('')}</nav>
  </header>
  <div id="orderPill"></div>
  <section class="lv-sec"><div class="lv-banners" id="lvBan"><div class="sk" style="height:150px;flex:0 0 100%;border-radius:22px"></div></div><div class="lv-dots" id="lvDots"></div></section>
  <section class="lv-sec"><div class="lv-sh"><h2 id="nearT">Open near you</h2><button class="lv-see" data-nav="categories">See all ${I.chev}</button></div><div class="lv-rail" id="lvNear">${skeletonCards(2)}</div></section>
  <section class="lv-sec lv-greet"><h2>${lvGreet()}${nm?`, ${esc(nm)}`:''} <span class="lv-wave">👋</span></h2><p>Discover local shops, food, services &amp; more around you.</p></section>
  <button class="lv-ask" data-talk><span class="lv-aorb">${GI.mic}</span><span><b>Just say what you need</b><small>Groceries, food, services or anything local</small></span><span class="lv-wv">${Array.from({length:7},(_,k)=>`<i style="--n:${k}"></i>`).join('')}</span></button>
  <section class="lv-sec"><div class="lv-sh"><h2>Deals near you</h2><span class="lv-cd" id="megacd">${gi('clock')} --:--:--</span></div><div class="lv-rail" id="lvDeals">${skeletonCards(3)}</div></section>
  <section class="lv-sec"><div class="lv-sh"><h2>Shop by category</h2><button class="lv-see" data-nav="categories">See all ${I.chev}</button></div>
    <div class="lv-cmini">${cats.slice(0,8).map((c,k)=>`<button data-nav="category" data-slug="${c.slug}" style="--n:${k}"><span>${photoLayer(catPhoto(c.slug,c.name))}${catIcon(c.slug)}</span>${esc(catLabel(c))}</button>`).join('')}</div></section>
  <section class="lv-sec"><div class="lv-sh"><h2>Popular nearby stores</h2></div><div class="lv-list" id="lvPop">${skeletonRow(2)}</div></section>
  <section class="lv-sec"><div class="lv-sh"><h2>${t('localUpdates')}</h2><button class="lv-see" data-nav="news">See all ${I.chev}</button></div><div class="lv-rail" id="lvNews"></div></section>
  <div style="height:30px"></div>`;
  wireCustControls(el);
  $('#askHome').onclick=()=>openAsk('',{voice:true});
  el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>openAsk('',{voice:true}));
  el.querySelector('[data-tabnav-loc]').onclick=()=>go('location');
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  const rot=$('#rotsq'); let ri=0; const rtm=setInterval(()=>{ if(!document.body.contains(rot)) return clearInterval(rtm); ri=(ri+1)%ROTATE.length; rot.textContent=ROTATE[ri]; rot.classList.remove('fx-swap'); void rot.offsetWidth; rot.classList.add('fx-swap'); },2600);
  if(token) api('/orders').then(os=>{ const live=(os||[]).find(o=>!['completed','rejected','cancelled'].includes(o.status)); const p=$('#orderPill'); if(!live||!p) return;
    const MSG={pending:'Waiting for the store',accepted:'Accepted by the store',preparing:'Being prepared',ready:'Ready',out_for_delivery:'On the way'};
    p.innerHTML=`<button class="lv-pill" id="opGo"><span class="lv-pdot"></span><span><b>${esc(live.business)}</b><small>${MSG[live.status]||live.status.replace(/_/g,' ')}</small></span><em>Track ${I.chev}</em></button>`; $('#opGo').onclick=()=>setTab('orders'); }).catch(()=>{});
  const [offers, biz, deals, news, places] = await Promise.all([api('/offers'), api('/businesses?featured=1'), api('/products?deal=1&limit=10'), api('/news'), api('/places?area_id='+state.areaId).catch(()=>[])]);
  // banners: one brand card + offers
  const B=[{brand:1}].concat(offers.slice(0,4)); const ban=$('#lvBan'), dots=$('#lvDots');
  ban.innerHTML=B.map((o,k)=>o.brand?`<button class="lv-ban t0" data-nav="categories"><span class="lv-bt"><b>Shop Local,<br>Support Your<br>Neighbourhood</b><em>Explore Now ${I.chev}</em></span><span class="lv-bimg">${photoLayer(pic('vegetables grocery bag',77,400,400))}${GI.cart}</span><i class="lv-spark s1"></i><i class="lv-spark s2"></i></button>`
    :`<button class="lv-ban t${k%3}" data-nav="business" data-id="${o.business_id}"><span class="lv-bt"><small>${esc(o.business||'')}</small><b>${esc(o.title)}</b><strong>${esc(o.discount_label||'OFFER')}</strong><em>Order Now ${I.chev}</em></span><span class="lv-bimg">${photoLayer(o.image_url||pic(coverKw({subcategory:o.business||''})+','+(o.title||''),700+(o.id||0),400,400))}${GI.percent}</span></button>`).join('');
  dots.innerHTML=B.map((_,k)=>`<i class="${k?'':'on'}"></i>`).join('');
  lvCarousel(ban,dots,3600);
  const near=[]; const seen=new Set(); (places||[]).concat(biz).forEach(b=>{ const k=(b.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); near.push(b); } });
  near.sort((a,b)=>(b.is_open?1:0)-(a.is_open?1:0));
  const drawNear=(l)=>{ $('#lvNear').innerHTML = l.slice(0,10).map(lvStoreCard).join('') || `<p class="lv-empty-s">Nothing here yet — try another category.</p>`; };
  drawNear(near);
  $('#lvDeals').innerHTML = deals.slice(0,10).map((p,k)=>lvProd(p,null,k)).join(''); startCountdown();
  $('#lvPop').innerHTML = biz.slice().sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,4).map(lvStoreRow).join('');
  $('#lvNews').innerHTML = news.slice(0,5).map(newsCard).join('');
  // category tabs filter "Open near you" in place
  const tb=$('#lvTabs'); lvTabInd(tb);
  tb.onclick=async e=>{ const b=e.target.closest('[data-hs]'); if(!b) return; tb.querySelectorAll('button').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-selected',x===b); }); lvTabInd(tb); buzz();
    const s=b.dataset.hs; $('#nearT').textContent=s?`${b.textContent.trim()} near you`:'Open near you'; const r=$('#lvNear'); r.classList.add('lv-swap');
    const l = s ? await api(`/businesses?category=${s}`).catch(()=>[]) : near; drawNear(l); r.scrollLeft=0; requestAnimationFrame(()=>r.classList.remove('lv-swap')); };
};
function lvTabInd(tb){ const on=tb.querySelector('button.on'), ind=tb.querySelector('.lv-tind'); if(!on||!ind) return; ind.style.width=on.offsetWidth+'px'; ind.style.transform=`translateX(${on.offsetLeft}px)`; const l=on.offsetLeft-tb.clientWidth/2+on.offsetWidth/2; tb.scrollTo({left:l,behavior:'smooth'}); }
function lvCarousel(row,dots,ms){
  const n=row.children.length; let idx=0, paused=0;
  const mark=()=>{ const w=row.firstElementChild?row.firstElementChild.offsetWidth+12:1; idx=Math.round(row.scrollLeft/w); dots&&dots.querySelectorAll('i').forEach((d,x)=>{ const on=x===idx; if(on&&!d.classList.contains('on')){ d.classList.remove('on'); void d.offsetWidth; } d.classList.toggle('on',on); }); [...row.children].forEach((c,x)=>c.classList.toggle('on',x===idx)); };
  row.addEventListener('scroll',()=>requestAnimationFrame(mark),{passive:true}); mark();
  ['pointerdown','touchstart'].forEach(ev=>row.addEventListener(ev,()=>paused=Date.now(),{passive:true}));
  dots&&dots.addEventListener('click',e=>{ const k=[...dots.children].indexOf(e.target); if(k>=0){ paused=Date.now(); lxGo(row,k); } });
  if(n>1){ const tm=setInterval(()=>{ if(!document.body.contains(row)) return clearInterval(tm); if(Date.now()-paused<5000||document.hidden) return; lxGo(row,(idx+1)%n); },ms); }
}

/* ---------- CATEGORIES ---------- */
SCREENS.categories = async (el) => {
  const cats=ref.categories||[];
  el.innerHTML = `<header class="lv-tbar"><h1>Explore Categories</h1></header>
    <div class="lv-srch"><button class="lv-stxt in" data-nav="searchScreen">${I.search}<span>Search for stores, items or services…</span></button><button class="lv-filt" id="flt" aria-label="Filters">${GI.sliders||I.cog}</button></div>
    <nav class="lv-chips" id="fchips"><button class="on" data-f="near">${I.pin} Near you</button><button data-f="top">${I.star} Top rated</button><button data-f="offers">${GI.percent} Offers</button><button data-f="open">${gi('clock')} Open now</button></nav>
    <div class="lv-cgrid">${cats.map((c,k)=>`<button class="lv-ctile c${k%6}" data-nav="category" data-slug="${c.slug}" style="--n:${k}"><span class="lv-cph">${photoLayer(catPhoto(c.slug,c.name))}${catIcon(c.slug)}</span><b>${esc(catLabel(c))}</b><i>${I.chev}</i></button>`).join('')}</div>
    <div class="lv-sh"><h2>Popular nearby stores</h2></div><div class="lv-list" id="pop">${skeletonRow(3)}</div><div style="height:20px"></div>`;
  const [biz,offers]=await Promise.all([api('/businesses'),api('/offers').catch(()=>[])]); const oid=new Set((offers||[]).map(o=>o.business_id));
  const draw=f=>{ let l=biz.slice(); if(f==='top') l.sort((a,b)=>(b.rating||0)-(a.rating||0)); if(f==='offers') l=l.filter(b=>oid.has(b.id)); if(f==='open') l=l.filter(b=>b.is_open);
    $('#pop').innerHTML=l.slice(0,8).map(lvStoreRow).join('')||`<p class="lv-empty-s">No stores match this filter.</p>`; };
  draw('near'); $('#flt').onclick=()=>{ const c=$('#fchips'); c.classList.remove('lv-nudge'); void c.offsetWidth; c.classList.add('lv-nudge'); };
  $('#fchips').onclick=e=>{ const b=e.target.closest('[data-f]'); if(!b) return; el.querySelectorAll('#fchips button').forEach(x=>x.classList.toggle('on',x===b)); buzz(); draw(b.dataset.f); };
};
SCREENS.explore = SCREENS.categories;

/* ---------- CATEGORY → nearby stores ---------- */
SCREENS.category = async (el, {slug, vfilter, vlabel}) => {
  const cat = ref.categories.find(c=>c.slug===slug) || {name:'Category', slug:'', kind:'business'};
  const vre = vfilter && VFILTERS[vfilter]; const title = vlabel || catLabel(cat);
  if (cat.kind==='worker' || cat.kind==='driver' || cat.kind==='info' || slug==='news' || slug==='events'){
    el.innerHTML = `${lvHead(title)}<div class="px stack" id="list" style="gap:10px">${skeletonRow(4)}</div>`; backWire(el);
    if (cat.kind==='worker') renderWorkers($('#list'), await api('/workers'));
    else if (cat.kind==='driver') renderDrivers($('#list'), await api('/drivers'));
    else if (cat.kind==='info') renderLocalInfo($('#list'), await api('/local-info'));
    else if (slug==='news') setTab('news');
    else $('#list').innerHTML=(await api('/events')).map(eventCard).join('');
    return; }
  el.innerHTML = `${lvHead(title,`<button class="lv-ib" data-nav="searchScreen" aria-label="Search">${I.search}</button>`)}
    <nav class="lv-chips" id="fchips"><button class="on" data-f="">All</button><button data-f="top">${I.star} Top rated</button><button data-f="offers">${GI.percent} Offers</button><button data-f="open">${gi('clock')} Open now</button></nav>
    <nav class="lv-chips sub" id="subchips"></nav>
    <div class="lv-sh"><h2>Popular items</h2></div><div class="lv-rail" id="catitems">${skeletonCards(2)}</div>
    <div class="lv-sh"><h2>Nearby stores</h2><small id="qcCount"></small></div><div class="lv-list" id="list">${skeletonRow(3)}</div><div style="height:20px"></div>`;
  backWire(el);
  const [biz, prods, offers, places] = await Promise.all([api(`/businesses?category=${slug}`), api(`/products?category=${slug}&limit=12`), api('/offers'), api(`/places?category=${slug}&area_id=${state.areaId}`).catch(()=>[])]);
  const seen=new Set(); let merged=[];
  (places||[]).concat(biz).forEach(p=>{ const k=(p.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); merged.push(p); } });
  if(vre) merged = merged.filter(b=>vre.test((b.subcategory||'')+' '+(b.name||'')));
  let prodsF=prods; if(vre){ const ids=new Set(merged.map(b=>b.id)); prodsF=prods.filter(p=>ids.has(p.business_id)); }
  const oid=new Set((offers||[]).map(o=>o.business_id));
  const subs=[...new Set(merged.map(b=>b.subcategory).filter(Boolean))].slice(0,10);
  $('#subchips').innerHTML = subs.length>1 ? subs.map(s=>`<button data-sub="${esc(s)}">${esc(s)}</button>`).join('') : '';
  $('#catitems').innerHTML = prodsF.length? prodsF.map((p,k)=>lvProd(p,null,k)).join('') : `<p class="lv-empty-s">No items listed yet.</p>`;
  let f='', sub='';
  const draw=()=>{ let l=merged.slice(); if(sub) l=l.filter(b=>b.subcategory===sub); if(f==='top') l.sort((a,b)=>(b.rating||0)-(a.rating||0)); if(f==='offers') l=l.filter(b=>oid.has(b.id)); if(f==='open') l=l.filter(b=>b.is_open);
    $('#qcCount').textContent=l.length+' places'; $('#list').innerHTML=l.length?l.map(lvStoreRow).join(''):`<p class="lv-empty-s">Nothing here yet — try another filter.</p>`; };
  draw();
  $('#fchips').onclick=e=>{ const b=e.target.closest('[data-f]'); if(!b) return; el.querySelectorAll('#fchips button').forEach(x=>x.classList.toggle('on',x===b)); f=b.dataset.f; buzz(); draw(); };
  $('#subchips').onclick=e=>{ const b=e.target.closest('[data-sub]'); if(!b) return; const on=!b.classList.contains('on'); el.querySelectorAll('#subchips button').forEach(x=>x.classList.toggle('on',on&&x===b)); sub=on?b.dataset.sub:''; buzz(); draw(); };
};

/* ---------- STORE ---------- */
SCREENS.business = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:230px"></div><div class="px" style="margin-top:14px">${skeletonRow(3)}</div>`;
  const b = await api(`/businesses/${id}`); track('shop_view',{id});
  const wa = (b.whatsapp||'').replace(/[^0-9]/g,''); const cover = b.cover_url || pic(coverKw(b), b.id, 900, 520);
  const tabs=[]; if(b.products.length) tabs.push(['products','Products']); if(b.services.length) tabs.push(['services','Services']); if(b.offers.length) tabs.push(['offers','Offers']); tabs.push(['about','About'],['reviews','Reviews']);
  el.innerHTML = `
    <div class="lv-shero">${photoLayer(cover)}${dIcon(b)}<span class="lv-shade"></span>
      <div class="lv-hbar"><button class="lv-cb" id="bk" aria-label="Back">${I.back}</button><span style="flex:1"></span>
        <button class="lv-cb fav ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}" aria-label="Save store">${I.heart}</button>
        <button class="lv-cb" id="shareb" aria-label="Share">${I.share}</button></div></div>
    <section class="lv-scard2">
      <div class="lv-sid"><span class="lv-slogo">${dIcon(b)}</span><div><h1>${esc(b.name)}</h1>
        <p class="lv-sm">${lvRate(b.rating,b.review_count)}<i>·</i><span>${esc(b.subcategory||b.category_name||'')}</span></p>
        <p class="lv-sm">${lvOpen(b)}${b.hours_label?`<span class="lv-dist">${gi('clock')}${esc(b.hours_label)}</span>`:''}${b.area_name?`<span class="lv-dist">${I.pin}${esc(b.area_name)}</span>`:''}</p></div></div>
      <div class="lv-sacts"><button id="callb">${I.phone}<span>Call</span></button><button id="wab">${I.wa}<span>WhatsApp</span></button>
        <a href="https://maps.google.com/?q=${encodeURIComponent(b.name+' '+(b.address||''))}" target="_blank" rel="noopener">${I.dir}<span>Directions</span></a>
        ${b.can_chat?`<button id="chatbtn">${GI.chat}<span>Chat</span></button>`:`<button id="enqtop">${GI.megaphone}<span>Enquire</span></button>`}</div></section>
    ${b.products.length>3?`<div class="lv-srch st"><label class="lv-stxt in">${I.search}<input id="sq" placeholder="Search in ${esc(b.name)}…" aria-label="Search in store"/></label></div>`:''}
    ${b.offers.length?`<div class="lv-coupons">${b.offers.map(o=>`<div class="lv-coupon"><span>${GI.percent}</span><div><b>${esc(o.discount_label)}</b><small>${esc(o.title)}</small></div></div>`).join('')}</div>`:''}
    <nav class="lv-utabs" id="tabs" role="tablist"><i class="lv-uind"></i>${tabs.map(([k,l])=>`<button role="tab" data-t="${k}">${l}${k==='reviews'?` <small>${b.reviews.length}</small>`:''}</button>`).join('')}</nav>
    <div id="tabbody" class="lv-tbody"></div><div style="height:110px"></div>`;
  $('#bk').onclick=back; $('#shareb').onclick=(e)=>{e.preventDefault(); try{ navigator.share?navigator.share({title:b.name,url:location.href}):toast('Link copied to share'); }catch(_){} };
  const chatb=$('#chatbtn'); if(chatb) chatb.onclick=()=>gateAction('chat with this store',()=>go('chat',{id:b.id,name:b.name}));
  const enqt=$('#enqtop'); if(enqt) enqt.onclick=()=>openEnquiry(b);
  $('#callb').onclick=()=>gateAction('call this business',()=>{ window.location.href='tel:'+b.phone; });
  $('#wab').onclick=()=>gateAction('message this business on WhatsApp',()=>{ window.open('https://wa.me/'+wa,'_blank','noopener'); });
  const avg = b.reviews.length ? b.reviews.reduce((a,r)=>a+(r.rating||0),0)/b.reviews.length : (b.rating||0);
  const bz={...b};
  const bodies = {
    products: (q='')=>{ const l=b.products.filter(p=>!q||(p.name||'').toLowerCase().includes(q)); return l.length?`<div class="lv-pgrid">${l.map((p,k)=>lvProd({...p,business:b.name,business_id:b.id},bz,k)).join('')}</div>`:`<p class="lv-empty-s">No items match “${esc(q)}”.</p>`; },
    services: ()=>`<div class="lv-list">${b.services.map((sv,k)=>`<article class="lv-srow svc" style="--n:${k}"><span class="lv-rimg">${dIcon(sv,'wrench')}</span><span class="lv-rt"><b>${esc(sv.name)}</b><span class="lv-sm">from <b>${money(sv.starting_price)}</b></span>${sv.description?`<small>${esc(sv.description)}</small>`:''}</span><button class="lv-req" data-req="${esc(sv.name)}">Request</button></article>`).join('')}</div>`,
    offers: ()=>`<div class="lv-list">${b.offers.map(o=>`<div class="lv-coupon big"><span>${GI.percent}</span><div><b>${esc(o.discount_label)} · ${esc(o.title)}</b><small>${esc(o.description||'')}</small></div></div>`).join('')}</div>`,
    about: ()=>`<div class="lv-about"><p>${esc(b.description||'')}</p>
      <div class="lv-info"><div><span>Category</span><b>${esc(b.category_name)}</b></div><div><span>Hours</span><b>${esc(b.hours_label||'')}</b></div><div><span>Address</span><b>${esc(b.address||'')}</b></div>
        <div><span>Phone</span>${token?`<b>${esc(b.phone)}</b>`:`<button id="revealph">Sign up to view</button>`}</div></div>
      <button class="lv-btn" style="margin-top:16px" id="enqbtn">${t('enquire')}</button></div>`,
    reviews: ()=>`<div class="lv-rsum"><div><b>${Number(avg).toFixed(1)}</b>${stars(avg)}<small>${b.reviews.length} review${b.reviews.length===1?'':'s'}</small></div>
        <div class="lv-bars">${[5,4,3,2,1].map(n=>{ const c=b.reviews.filter(r=>Math.round(r.rating)===n).length; return `<p><span>${n}★</span><i style="--w:${b.reviews.length?Math.round(c/b.reviews.length*100):0}%"></i><span>${c}</span></p>`; }).join('')}</div></div>
      <button class="lv-btn ghost" id="addrev">${I.star} Write a review</button>
      <div class="lv-list">${b.reviews.length?b.reviews.map(r=>`<div class="lv-rev"><div><b>${esc(r.author_name)}</b>${stars(r.rating)}</div><p>${esc(r.comment)}</p></div>`).join(''):`<p class="lv-empty-s">No reviews yet — be the first.</p>`}</div>`,
  };
  const tbEl=$('#tabs');
  const showTab=(name)=>{ const body=$('#tabbody'); body.classList.remove('lv-tin'); void body.offsetWidth; body.innerHTML=bodies[name](); body.classList.add('lv-tin'); wireTabBody(b);
    tbEl.querySelectorAll('button').forEach(x=>{ const on=x.dataset.t===name; x.classList.toggle('on',on); x.setAttribute('aria-selected',on); });
    const on=tbEl.querySelector('button.on'), ind=tbEl.querySelector('.lv-uind'); ind.style.width=on.offsetWidth+'px'; ind.style.transform=`translateX(${on.offsetLeft}px)`; };
  showTab(tabs[0][0]);
  tbEl.addEventListener('click', e=>{ const btn=e.target.closest('button'); if(btn){ buzz(); showTab(btn.dataset.t); } });
  const sq=$('#sq'); if(sq) sq.oninput=()=>{ if(!tbEl.querySelector('[data-t="products"].on')) showTab('products'); $('#tabbody').innerHTML=bodies.products(sq.value.trim().toLowerCase()); };
  const hero=el.querySelector('.lv-shero'); el.addEventListener('scroll',()=>{ const y=el.scrollTop; hero.style.setProperty('--py',Math.min(1,y/230).toFixed(3)); },{passive:true});
};

/* ---------- PRODUCT ---------- */
SCREENS.product = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:320px"></div>`;
  let p; try{ p = await api('/products/'+id); }catch(e){ el.innerHTML=`${lvHead('Product')}<p class="lv-empty-s">This product is unavailable.</p>`; backWire(el); return; }
  const src = p.image_url || pic((p.name||'product').toLowerCase(), 500+(p.id||0), 800, 800);
  const disc = p.mrp && p.mrp>p.price; const pct = disc?Math.round((1-p.price/p.mrp)*100):0; const oos = p.stock_status==='out_of_stock';
  const prod = {...p, business:p.business, business_id:p.business_id};
  el.innerHTML = `
    <div class="lv-phero">${photoLayer(src)}${dIcon({name:p.name},'cart')}
      <div class="lv-hbar"><button class="lv-cb" id="bk" aria-label="Back">${I.back}</button><span style="flex:1"></span>
        <button class="lv-cb fav ${isSaved('product',p.id)?'on':''}" data-fav data-ftype="product" data-fid="${p.id}" data-fname="${esc(p.name)}" data-fprice="${p.price}" data-fimg="${esc(src)}" aria-label="Save">${I.heart}</button></div>
      <div class="lv-pdots"><i class="on"></i><i></i><i></i></div></div>
    <section class="lv-psheet">
      <h1>${esc(p.name)}</h1><p class="lv-unit">${esc(p.unit||'1 unit')} · ${lvRate(p.rating,p.review_count)}</p>
      <div class="lv-price"><b>${money(p.price)}</b>${disc?`<s>${money(p.mrp)}</s><em>${pct}% OFF</em>`:''}</div>
      ${p.description?`<p class="lv-desc">${esc(p.description)}</p>`:''}
      <div class="lv-perks"><div>${gi('pin')}<b>Local shop</b></div><div>${gi('shield')}<b>${oos?'Out of stock':'In stock'}</b></div><div>${gi('chat')}<b>Ask the store</b></div></div>
      <button class="lv-sold" data-nav="business" data-id="${p.business_id}"><span>${GI.store}</span><div><small>Sold by</small><b>${esc(p.business)}</b></div>${I.chev}</button>
      <div id="related"></div><div style="height:120px"></div></section>
    <div class="lv-pbar">${oos?`<button class="lv-btn" disabled>Out of stock</button>`:`<div><small>${esc(p.unit||'1 unit')}</small><b>${money(p.price)}</b></div><span class="lv-pctl big">${addCtl(prod,src)}</span>`}</div>`;
  $('#bk').onclick=back;
  if(p.related && p.related.length) $('#related').innerHTML = `<div class="lv-sh flush"><h2>You may also like</h2></div><div class="lv-rail flush">${p.related.map((r,k)=>lvProd(r,null,k)).join('')}</div>`;
  const hero=el.querySelector('.lv-phero'); el.addEventListener('scroll',()=>hero.style.setProperty('--py',Math.min(1,el.scrollTop/300).toFixed(3)),{passive:true});
};

/* ---------- CART ---------- */
SCREENS.cart = async (el) => {
  if(!cart.length){
    el.innerHTML=`${lvHead('Your Cart')}<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${GI.cart}</div><h2>Your cart is empty</h2><p>Add something from a shop near you and it will show up here.</p><button class="lv-btn" id="shop">Start shopping</button></div><div id="best"></div>`;
    backWire(el); $('#shop').onclick=()=>setTab('home');
    const ps=await api('/products?limit=8'); $('#best').innerHTML=`<div class="lv-sh"><h2>Popular near you</h2></div><div class="lv-rail">${ps.map((p,k)=>lvProd(p,null,k)).join('')}</div>`; return; }
  const FREE=499, sub=cartTotal(), delivery=sub>=FREE?0:29;
  const save=cart.reduce((t,i)=>t+(i.mrp&&i.mrp>i.price?(i.mrp-i.price)*i.qty:0),0);
  el.innerHTML = `${lvHead(`Your Cart (${cartCount()})`,`<span class="lv-cbag">${GI.cart}<i>${cartCount()}</i></span>`)}
    <p class="lv-from">${gi('store')} From <b>${esc(cart[0].biz||'your local store')}</b></p>
    <div class="lv-lines">${cart.map((it,k)=>`<div class="lv-line" style="--n:${k}"><span class="lv-limg">${photoLayer(it.image||pic((it.name||'x').toLowerCase(),500+it.id,160,160))}${dIcon({name:it.name},'cart')}</span>
      <div class="lv-lt"><b>${esc(it.name)}</b><small>${esc(it.unit||'')}</small><em>${money(it.price*it.qty)}${it.mrp&&it.mrp>it.price?` <s>${money(it.mrp*it.qty)}</s>`:''}</em></div>
      <div class="lv-step" role="group" aria-label="Quantity of ${esc(it.name)}"><button data-dec="${it.id}" aria-label="Remove one">${it.qty>1?'−':(I.trash||'×')}</button><b>${it.qty}</b><button data-inc="${it.id}" aria-label="Add one">+</button></div></div>`).join('')}</div>
    <button class="lv-more" data-nav="business" data-id="${cartBizId()||1}">${I.plus} Add more items</button>
    <div id="lvSugg"></div>
    <section class="lv-bill">${save>0?`<div class="lv-saved"><span>You saved</span><b>${money(save)}</b></div>`:''}
      <div><span>Item total</span><b>${money(sub)}</b></div><div><span>Delivery</span><b>${delivery?money(delivery):'<em>FREE</em>'}</b></div>
      ${delivery?`<div class="lv-free"><span>Add <b>${money(FREE-sub)}</b> more for free delivery</span><i style="--p:${Math.min(100,Math.round(sub/FREE*100))}%"></i></div>`:''}
      <div class="tot"><span>Total</span><b>${money(sub+delivery)}</b></div></section>
    <div style="height:110px"></div>
    <div class="lv-fbar"><button class="lv-gobar" id="checkout"><span><small>${cartCount()} item${cartCount()>1?'s':''}</small><b>${money(sub+delivery)}</b></span><em>Proceed to Checkout ${I.chev}</em></button></div>`;
  backWire(el);
  el.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.inc),1); buzz(); routeRender(); });
  el.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.dec),-1); buzz(); routeRender(); });
  $('#checkout').onclick=()=>{ track('checkout_start'); gateAction('place your order',()=>go('checkout')); };
  api('/products?limit=10').then(ps=>{ const s=$('#lvSugg'); if(!s) return; const ids=new Set(cart.map(i=>i.id)); const l=(ps||[]).filter(p=>!ids.has(p.id)).slice(0,8);
    if(l.length) s.innerHTML=`<div class="lv-sh"><h2>You might also like</h2></div><div class="lv-rail">${l.map((p,k)=>lvProd(p,null,k)).join('')}</div>`; }).catch(()=>{});
};

/* ---------- CHECKOUT ---------- */
SCREENS.checkout = async (el) => {
  if(!cart.length){ setTab('home'); return; }
  if(!token){ toast('Please log in'); return go('login'); }
  const a = safeParse(localStorage.getItem('ll_addr')) || { name: me?me.name:'', phone: me?me.phone:'', line:'', area: state.areaName };
  const delivery = cartTotal()>=499?0:29; const pay = cartTotal()+delivery;
  const bizId = cartBizId() || 1; let bizPay=['cash'], upiId=null, bizName=cart[0]?.biz||'';
  try{ const b=await api('/businesses/'+bizId); bizPay=(b.payment_methods&&b.payment_methods.length)?b.payment_methods:['cash']; upiId=b.upi_id; bizName=b.name||bizName; }catch(e){}
  const PM={ cash:['Cash on Delivery','Pay when it arrives',GI.card], card:['Card on Delivery','Swipe at your door',GI.card], upi:['UPI'+(upiId?' · '+upiId:''),'GPay, PhonePe, etc. — pay the shop directly',GI.chat] };
  const methods=bizPay.filter(m=>PM[m]); if(!methods.length) methods.push('cash');
  const hasAddr=!!(a.line&&a.phone);
  el.innerHTML = `${lvHead('Checkout')}
    <div class="lv-steps"><span class="done"><i>${I.check||'✓'}</i>Cart</span><b class="done"></b><span class="on"><i>2</i>Details</span><b></b><span><i>3</i>Placed</span></div>
    <button class="lv-row" id="addrRow" ${hasAddr?'':'hidden'}><span class="lv-ri">${I.pin}</span><div><small>Deliver to</small><b>${esc(a.name||'')}</b><span>${esc(a.line||'')}, ${esc(a.area||'')}</span></div>${I.chev}</button>
    <section class="lv-form" id="addrEdit" ${hasAddr?'hidden':''}><h3>${I.pin} Delivery address</h3>
      <div class="field"><label for="cn">Full name</label><div class="input"><input id="cn" value="${esc(a.name||'')}" autocomplete="name"/></div></div>
      <div class="field"><label for="cp">Phone</label><div class="input"><input id="cp" value="${esc(a.phone||'')}" placeholder="+91…" inputmode="tel" autocomplete="tel"/></div></div>
      <div class="field"><label for="cl">Address</label><div class="input"><textarea id="cl" rows="2" placeholder="House / building, street, landmark">${esc(a.line||'')}</textarea></div></div>
      <div class="field"><label for="ca">Area</label><div class="input"><input id="ca" value="${esc(a.area||state.areaName)}"/></div></div></section>
    <div class="lv-sh"><h2>Payment Method</h2><small>accepted by ${esc(bizName)}</small></div>
    <div class="lv-pays" id="payopts">${methods.map((m,k)=>`<button class="lv-pay ${k===0?'on':''}" data-pay="${m}" style="--n:${k}"><span>${PM[m][2]}</span><div><b>${esc(PM[m][0])}</b><small>${PM[m][1]}</small></div><i>${I.check||''}</i></button>`).join('')}</div>
    <section class="lv-bill" id="billd" hidden><div><span>${cartCount()} item${cartCount()>1?'s':''}</span><b>${money(cartTotal())}</b></div><div><span>Delivery</span><b>${delivery?money(delivery):'<em>FREE</em>'}</b></div><div class="tot"><span>To pay</span><b>${money(pay)}</b></div></section>
    <div style="height:110px"></div>
    <div class="lv-fbar split"><button class="lv-tot" id="vd"><b>${money(pay)}</b><small>View details ${I.chev.replace('m9 6 6 6-6 6','m6 9 6 6 6-6')}</small></button><button class="lv-btn" id="place">Place Order ${I.chev}</button></div>`;
  backWire(el);
  $('#addrRow').onclick=()=>{ $('#addrRow').hidden=true; const f=$('#addrEdit'); f.hidden=false; f.classList.add('lv-tin'); };
  $('#vd').onclick=()=>{ const d=$('#billd'); d.hidden=!d.hidden; if(!d.hidden){ d.classList.add('lv-tin'); d.scrollIntoView({behavior:'smooth',block:'center'}); } };
  let payMethod=methods[0];
  el.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{ el.querySelectorAll('[data-pay]').forEach(x=>x.classList.toggle('on',x===b)); payMethod=b.dataset.pay; buzz(); });
  $('#place').onclick=async()=>{
    const name=$('#cn').value.trim(), phone=$('#cp').value.trim(), line=$('#cl').value.trim(), area=$('#ca').value.trim();
    if(!name||!phone||!line){ $('#addrRow').hidden=true; $('#addrEdit').hidden=false; return toast('Please fill name, phone and address'); }
    localStorage.setItem('ll_addr', JSON.stringify({name,phone,line,area}));
    const btn=$('#place'); btn.disabled=true; btn.classList.add('busy'); btn.textContent='Placing…';
    const groups={}; cart.forEach(i=>{ (groups[i.bizId||1]=groups[i.bizId||1]||[]).push(i); });
    try{ let lastId=null;
      for(const [bId,items] of Object.entries(groups)){
        const tot=items.reduce((n,i)=>n+i.qty*i.price,0)+(cartTotal()>=499?0:29);
        const r=await api('/orders',{method:'POST',body:{business_id:Number(bId),total:tot,item_summary:items.map(i=>`${i.qty}× ${i.name}`).join(', '),payment_method:payMethod,
          items_json:items.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,image:i.image||''}))}}); lastId=r&&r.id; }
      track('order_placed',{total:pay}); const shop=cart[0]?.biz||''; cart=[]; saveCart(); updateCartBadge(); buzz(30);
      nav.customer=[{name:'orderDone',params:{shop,total:pay,oid:lastId}}]; routeRender();
    }catch(e){ btn.disabled=false; btn.classList.remove('busy'); btn.textContent='Place Order'; toast(e.message); }
  };
};
SCREENS.orderDone = (el, {shop, total, oid}) => {
  el.innerHTML = `<div class="lv-done"><button class="lv-x" id="cls" aria-label="Close">×</button>
    <div class="lv-conf">${Array.from({length:18},(_,k)=>`<i style="--a:${k*20}deg;--d:${(k%5)*60}ms"></i>`).join('')}</div>
    <div class="lv-bag"><span class="lv-halo"></span><span class="lv-bagb">${GI.bag||GI.cart}<span class="lv-tick"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18"/><path d="M12 21l6 6 11-12"/></svg></span></span></div>
    <h1>Order Placed<br>Successfully!</h1>
    ${oid?`<p class="lv-oid">Order ID: #LL-${10000+Number(oid)}</p>`:''}
    <p class="lv-dmsg">${esc(shop||'The shop')} has your order${total?` for <b>${money(total)}</b>`:''}. Follow each step in Orders.</p>
    <button class="lv-btn" id="trk">Track Order</button><button class="lv-btn ghost" id="cont">Continue Shopping</button></div>`;
  $('#trk').onclick=()=>setTab('orders'); $('#cont').onclick=()=>setTab('home'); $('#cls').onclick=()=>setTab('home');
};

/* ---------- ORDERS ---------- */
SCREENS.orders = async (el, params={}) => {
  if(!token) return openLoginInline(el, 'Log in to see your orders');
  el.innerHTML = `<header class="lv-tbar"><h1>My Orders</h1></header>
    <div class="lv-seg" id="seg"><i></i><button class="on" data-s="on">Ongoing</button><button data-s="past">Past Orders</button></div><div id="l" class="lv-olist">${skeletonRow(3)}</div>`;
  const orders = await api('/orders');
  const live = orders.filter(o=>!['completed','rejected','cancelled'].includes(o.status)); const past = orders.filter(o=>!live.includes(o));
  $('#seg').querySelector('[data-s="on"]').textContent=`Ongoing (${live.length})`;
  const ST=[['pending','Placed',GI.check||I.star],['accepted','Accepted',GI.store],['preparing','Preparing',GI.bag||GI.cart],['out_for_delivery','On the way',GI.package],['completed','Delivered',I.home]];
  const idx=s=>({pending:0,accepted:1,preparing:2,ready:2,out_for_delivery:3,completed:4})[s]??0;
  const MSG={pending:['Waiting for the store','The shop will accept your order shortly.'],accepted:['Order accepted','The shop has confirmed your order.'],preparing:['Your order is being prepared','The merchant is packing your items.'],ready:['Your order is ready','Packed and ready to go.'],out_for_delivery:['Your order is on the way','It has left the shop.']};
  const items=o=>{ const it=typeof o.items_json==='string'?safeParse(o.items_json):o.items_json; return Array.isArray(it)&&it.length?it:null; };
  const card=(o)=>{ const k=idx(o.status); const m=MSG[o.status]||[o.status.replace(/_/g,' '),'']; const it=items(o);
    return `<article class="lv-ocard"><div class="lv-ohead"><span class="lv-oimg">${GI.store}</span><div><b>Order #LL-${10000+o.id}</b><small>${esc(o.business)}</small><small><b>${money(o.total)}</b>${it?` · ${it.reduce((n,i)=>n+(i.qty||1),0)} items`:''}</small></div><span class="lv-ost">${k>=3?'On the way':k>=2?'Preparing':'Placed'}</span></div>
      <div class="lv-omsg"><span>${GI.bag||GI.cart}</span><div><b>${esc(m[0])}</b><small>${esc(m[1])}</small></div></div>
      <div class="lv-track" style="--k:${k}">${ST.map((s,x)=>`<span class="${x<k?'done':x===k?'on':''}"><i>${s[2]}</i><b>${s[1]}</b></span>`).join('')}<em></em></div>
      <div class="lv-map" aria-hidden="true"><svg viewBox="0 0 340 160" preserveAspectRatio="xMidYMid slice"><g class="st"><path d="M-10 36H350M-10 112H350M64 -10V180M178 -10V180M286 -10V180M-10 150L120 -10M210 180L350 20"/></g><g class="pk"><rect x="200" y="60" width="60" height="36" rx="8"/><rect x="20" y="10" width="34" height="20" rx="6"/></g>
        <path id="rt${o.id}" class="rt" d="M50 44 C90 44 100 112 178 110 S260 80 296 124" pathLength="1"/>
        ${k>=3?`<g class="rider"><circle r="13"/><text y="5" text-anchor="middle">🛵</text><animateMotion dur="6s" repeatCount="indefinite" rotate="0"><mpath href="#rt${o.id}"/></animateMotion></g>`:''}</svg>
        <span class="lv-mp s">${gi('store')}</span><span class="lv-mp h">${I.home}</span></div>
      ${it?`<details class="lv-oitems" open><summary>Order Items (${it.length})</summary>${it.map(i=>`<p><span>${esc(i.name)}${i.qty>1?` × ${i.qty}`:''}</span><b>${money((i.price||0)*(i.qty||1))}</b></p>`).join('')}</details>`:`<p class="lv-osum">${esc(o.item_summary||'')}</p>`}
      <div class="lv-oacts"><button class="lv-btn soft" data-chat="${o.business_id}" data-bn="${esc(o.business)}">${GI.chat} Chat with Merchant</button><button class="lv-btn ghost" data-nav="business" data-id="${o.business_id}">${I.phone} Call Merchant</button></div></article>`; };
  const pastRow=(o,k)=>`<article class="lv-prow" style="--n:${k}"><span class="lv-oimg">${GI.package}</span><div><b>${esc(o.business)}</b><small>${esc(o.item_summary)}</small><small class="st-${o.status}">${o.status==='completed'?'Delivered':o.status.replace(/_/g,' ')} · ${money(o.total)}</small></div>
      <button class="lv-reo" data-reorder='${esc(JSON.stringify({items:o.items_json,biz:o.business,bizId:o.business_id}))}'>Reorder</button></article>`;
  const empty=(t,s)=>`<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${GI.package}</div><h2>${t}</h2><p>${s}</p><button class="lv-btn" id="shop">Find a shop</button></div>`;
  const draw=s=>{ const l=$('#l'); l.classList.remove('lv-tin'); void l.offsetWidth; l.classList.add('lv-tin');
    l.innerHTML = s==='on' ? (live.length? live.map(card).join('') + (past.length?`<div class="lv-sh flush"><h2>Order Again</h2></div>${past.slice(0,3).map(pastRow).join('')}`:'') : empty('No ongoing orders','Your live orders and tracking will appear here.'))
      : (past.length? past.map(pastRow).join('') : empty('No past orders yet','Orders you complete will show up here.'));
    const sh=$('#shop'); if(sh) sh.onclick=()=>setTab('home');
    l.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>go('chat',{id:Number(b.dataset.chat),name:b.dataset.bn}));
    l.querySelectorAll('[data-reorder]').forEach(b=>b.onclick=()=>{ let d={}; try{ d=JSON.parse(b.dataset.reorder); }catch(e){}
      const its = d.items ? (typeof d.items==='string'?safeParse(d.items):d.items) : null;
      if(its && its.length){ cart=[]; its.forEach(it=>cart.push({id:it.id,name:it.name,price:it.price,image:it.image||'',biz:d.biz,bizId:Number(d.bizId),qty:it.qty||1})); saveCart(); updateCartBadge(); toast('Added to cart'); go('cart'); }
      else if(d.bizId) go('business',{id:d.bizId}); else toast('Nothing to reorder'); }); };
  const seg=$('#seg'); seg.onclick=e=>{ const b=e.target.closest('[data-s]'); if(!b) return; seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); seg.classList.toggle('r',b.dataset.s==='past'); buzz(); draw(b.dataset.s); };
  if(!live.length&&past.length){ seg.querySelector('[data-s="past"]').click(); } else draw('on');
};

/* ---------- ACCOUNT ---------- */
SCREENS.account = async (el) => {
  const loggedIn=!!token; const nm=loggedIn?me.name:'Guest';
  const row=(attr,ic,label,right='',k=0)=>`<button ${attr} style="--n:${k}"><span class="lv-mi">${ic}</span><b>${label}</b>${right?`<small>${right}</small>`:''}${I.chev}</button>`;
  el.innerHTML = `<header class="lv-tbar"><h1>My Account</h1>${custControls()}</header>
    <section class="lv-me">${loggedIn?`<span class="lv-mav">${esc(nm[0])}</span><div><b>${esc(nm)}</b><small>${esc(me.email||me.phone||'')}</small></div><button class="lv-ib" data-tabnav="profile" aria-label="Edit profile">${I.edit||I.cog}</button>`
      :`<span class="lv-mav">${logoMark(30)}</span><div><b>Welcome to Local Link</b><small>Log in to order, save favourites and review</small></div><button class="lv-btn sm" id="lg">Log in</button>`}</section>
    <button class="lv-btn" id="installapp" style="margin:0 16px 14px;width:calc(100% - 32px);display:${window.__llInstall?'flex':'none'}">${GI.download||I.plus} Install Local Link</button>
    <div class="lv-menu">
      ${row('data-tabnav="orders"',GI.package,'My Orders','',0)}${row('data-nav="location"',I.pin,'My Addresses',esc(state.areaName),1)}
      ${row('data-nav="saved"',I.heart,'Favourites','',2)}${row('data-nav="offers"',GI.percent,'Offers & promo codes','',3)}${row('id="bulkreq"',GI.megaphone||I.tag,'Post a requirement','',4)}</div>
    <div class="lv-menu">
      ${row('data-nav="localinfo"',GI.building,t('localInfo'),'',5)}${row('data-nav="events"',GI.calendar,t('events'),'',6)}
      ${row('id="langrow"',I.globe,'Language',state.lang==='ml'?'മലയാളം':'English',7)}${row('data-tabnav="notifications"',I.bell,'Notifications','',8)}
      <a href="/partner" style="--n:9"><span class="lv-mi">${GI.store}</span><b>Sell on Local Link</b>${I.chev}</a>${row('id="help"',GI.chat,'Help & Support','',10)}</div>
    ${loggedIn?`<button class="lv-logout" id="out">${I.logout} Log Out</button>`:''}
    <p class="lv-ver">${logoMark(18)} Local Link · Your Neighbourhood. One App.</p>`;
  wireCustControls(el);
  const inst=$('#installapp'); if(inst) inst.onclick=async()=>{ const p=window.__llInstall; if(!p) return; p.prompt(); try{ await p.userChoice; }catch(e){} window.__llInstall=null; inst.style.display='none'; };
  const lg=$('#lg'); if(lg) lg.onclick=()=>go('login');
  const br=$('#bulkreq'); if(br) br.onclick=()=>gateAction('post a requirement',()=>openBulkEnquiry());
  $('#help').onclick=()=>openAsk('',{voice:false});
  $('#langrow').onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  const out=$('#out'); if(out) out.onclick=async()=>{ const ok=await confirmDialog({title:'Log out?',message:'Your cart stays on this phone.',ok:'Log out',cancel:'Stay',danger:true,icon:I.logout}); if(!ok) return;
    token=null; me=null; localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); toast('Logged out'); routeRender(); };
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};

/* ---------- LOGIN ---------- */
SCREENS.login = (el) => {
  el.innerHTML = `<div class="lv-login"><button class="lv-ib" id="ab" aria-label="Back">${I.back}</button>
    <div class="lv-lbrand">${logoMark(40)}<b>Local</b><b>Link</b></div>
    <h2>Login or Sign up</h2><p>Order from shops around ${esc(state.areaName)}.</p>
    <div class="field"><label for="lid">Email or phone</label><div class="input">${I.user}<input id="lid" value="customer@locallink.app" autocomplete="username"/></div></div>
    <div class="field"><label for="lpw">Password</label><div class="input"><span class="gi">${GI.lock}</span><input id="lpw" type="password" value="password" autocomplete="current-password"/></div></div>
    <button class="lv-btn" id="lsubmit">Continue ${I.chev}</button>
    <div class="lv-or"><span>Demo accounts</span></div>
    <div class="lv-demo"><button data-d="customer@locallink.app">Customer</button><button data-d="partner@locallink.app">Partner</button><button data-d="admin@locallink.app">Admin</button></div>
    <p class="lv-alt">New to Local Link? <a href="#" id="goreg">Create an account</a></p>
    <p class="lv-terms">By continuing, you agree to our Terms &amp; Privacy Policy</p></div>`;
  $('#ab').onclick=back; $('#goreg').onclick=(e)=>{ e.preventDefault(); go('register'); };
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ $('#lid').value=b.dataset.d; $('#lpw').value='password'; buzz(); });
  const submit=async()=>{ const btn=$('#lsubmit'); btn.disabled=true; btn.classList.add('busy');
    try{ const r=await api('/auth/login',{method:'POST',body:{identifier:$('#lid').value.trim(),password:$('#lpw').value}});
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me)); toast('Welcome, '+me.name.split(' ')[0]); routeAfterLogin(); }
    catch(e){ btn.disabled=false; btn.classList.remove('busy'); const c=$('.lv-login'); c.classList.remove('fx-shake'); void c.offsetWidth; c.classList.add('fx-shake'); toast(e.message||'Login failed'); } };
  $('#lsubmit').onclick=submit; $('#lpw').onkeydown=e=>{ if(e.key==='Enter') submit(); };
};

/* ═══════════════════════════════════════════════════════════════════════
   CUSTOMER APP v3 (lw) — every remaining screen rebuilt + spec modules:
   assistant, search, location, notifications, wishlist, offers, community,
   support, profile/addresses/preferences, register, bookings, workers,
   rides, local info, recently viewed, map view, pickup, coupons, notes,
   cancel, rate, invoice.
   ═══════════════════════════════════════════════════════════════════════ */
const lwLS=(k,d)=>{ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } };
const lwSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
function lwRecent(b){ if(!b||!b.id) return; let r=lwLS('ll_recent',[]).filter(x=>x.id!==b.id); r.unshift({id:b.id,name:b.name,subcategory:b.subcategory||b.category_name||'',rating:b.rating,review_count:b.review_count,is_open:b.is_open,cover_url:b.cover_url,area_name:b.area_name,color1:b.color1,color2:b.color2}); lwSet('ll_recent',r.slice(0,10)); }
function lwPrefs(){ return Object.assign({orders:true,offers:true,stores:true,bookings:true},lwLS('ll_notif',{})); }
function lwPct(label){ const m=String(label||'').match(/(\d{1,2})\s*%/); return m?Number(m[1]):0; }
function lwField(id,label,val='',attrs=''){ return `<div class="field"><label for="${id}">${label}</label><div class="input"><input id="${id}" value="${esc(val||'')}" ${attrs}/></div></div>`; }

/* track recently viewed stores */
const _lvBiz=SCREENS.business;
SCREENS.business=async(el,p)=>{ await _lvBiz(el,p); try{ const b=await api('/businesses/'+p.id); lwRecent(b);
  // services: book with date + time instead of a bare request
  el.querySelectorAll('[data-req]').forEach(x=>x.onclick=()=>lwBook(b,x.dataset.req)); 
  const tabs=$('#tabs'); if(tabs) tabs.addEventListener('click',()=>setTimeout(()=>el.querySelectorAll('[data-req]').forEach(x=>x.onclick=()=>lwBook(b,x.dataset.req)),30)); }catch(e){} };

/* ---------- service booking (sent to the provider as an enquiry) ---------- */
function lwBook(b,svc){
  if(!token) return gateAction('book this service',()=>{});
  const d=new Date(); const days=Array.from({length:6},(_,i)=>{ const x=new Date(d); x.setDate(d.getDate()+i); return x; });
  const slots=['9:00 AM','11:00 AM','1:00 PM','3:00 PM','5:00 PM','7:00 PM'];
  showSheet(`Book ${esc(svc)}`,`<div class="lw-book"><p class="lw-bp">${GI.store} ${esc(b.name)}</p>
    <h4>Pick a day</h4><div class="lw-days" id="bd">${days.map((x,i)=>`<button class="${i?'':'on'}" data-d="${x.toDateString()}"><small>${i?x.toLocaleDateString('en-IN',{weekday:'short'}):'Today'}</small><b>${x.getDate()}</b></button>`).join('')}</div>
    <h4>Pick a time</h4><div class="lw-slots" id="bt">${slots.map((s,i)=>`<button class="${i?'':'on'}" data-t="${s}">${s}</button>`).join('')}</div>
    <div class="field"><label for="bn">Notes for ${esc(b.name)}</label><div class="input"><textarea id="bn" rows="2" placeholder="What needs doing? Any landmark?"></textarea></div></div>
    <button class="lv-btn" id="bgo">Send booking request</button><p class="lw-fine">${esc(b.name)} will confirm the slot by call or chat.</p></div>`,()=>{
    const pick=(id)=>$('#'+id).onclick=e=>{ const x=e.target.closest('button'); if(!x) return; $('#'+id).querySelectorAll('button').forEach(y=>y.classList.toggle('on',y===x)); buzz(); };
    pick('bd'); pick('bt');
    $('#bgo').onclick=async()=>{ const day=$('#bd .on').dataset.d, tm=$('#bt .on').dataset.t, note=$('#bn').value.trim(); const btn=$('#bgo'); btn.classList.add('busy'); btn.disabled=true;
      try{ await api('/enquiries',{method:'POST',body:{business_id:b.id,message:`Booking request: ${svc} on ${day} at ${tm}.${note?' Notes: '+note:''}`}});
        const bk=lwLS('ll_bookings',[]); bk.unshift({id:Date.now(),svc,biz:b.name,bizId:b.id,day,tm,note,status:'requested'}); lwSet('ll_bookings',bk.slice(0,30));
        closeSheet(); lwConfirm('Booking requested',`${esc(svc)} · ${esc(day)}, ${esc(tm)}<br>${esc(b.name)} will confirm with you.`); }
      catch(e){ btn.classList.remove('busy'); btn.disabled=false; toast(e.message); } };
  });
}
function lwConfirm(title,html){ showSheet('',`<div class="lw-ok"><div class="lw-okc"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18"/><path d="M12 21l6 6 11-12"/></svg></div><h3>${title}</h3><p>${html}</p><button class="lv-btn" id="okx">Done</button></div>`,()=>{ $('#okx').onclick=closeSheet; buzz(25); }); }

/* ---------- AI ASSISTANT (full screen) ---------- */
const _openAsk=openAsk;
openAsk=function(prefill,opts={}){ if(state.view!=='customer') return _openAsk(prefill,opts); closeSheet(); go('assistant',{q:prefill||'',voice:!!opts.voice}); };
SCREENS.assistant=(el,{q,voice})=>{
  const nm=token&&me?me.name.split(' ')[0]:'';
  const S=[[I.store,'Find a nearby restaurant','biriyani restaurant'],[GI.cart,'Get groceries','vegetables and milk'],[GI.wrench||I.cog,'Book a home service','electrician'],[GI.package,'Track my order','__track'],[GI.percent,'Discover local offers','__offers']];
  el.innerHTML=`<div class="lw-ai"><header class="lw-aih"><button class="lv-ib" id="__back" aria-label="Back">${I.back}</button><span class="lw-aiw">${Array.from({length:9},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</span><div class="lw-ailang" id="ail"><button data-vl="en-IN">EN</button><button data-vl="ml-IN">മ</button></div></header>
    <div class="lw-aititle"><h1>Ask Local Link</h1><p>Your local shopping assistant</p></div>
    <div class="lw-msgs" id="msgs"><div class="lw-b bot">Hi${nm?' '+esc(nm):''}! 👋<br>How can I help you today? You can ask for several things at once — like “vegetables, chicken biryani and an electrician”.</div>
      <div class="lw-sugg" id="sugg">${S.map((s,i)=>`<button data-s="${esc(s[2])}" style="--n:${i}"><span>${s[0]}</span>${esc(s[1])}</button>`).join('')}</div></div>
    <div class="lw-orbz" id="orbz"><button class="lw-orb" id="orb" aria-label="Speak"><span class="h1"></span><span class="h2"></span><span class="c">${GI.mic}</span></button><small id="ost">Tap to speak</small></div>
    <div class="lw-in"><input id="aq" placeholder="Type or speak…" autocomplete="off"/><button class="lw-mic" id="amic" aria-label="Voice">${GI.mic}</button><button class="lw-send" id="asend" aria-label="Send">${GI.send}</button></div></div>`;
  backWire(el);
  const msgs=$('#msgs'), inp=$('#aq'); const down=()=>msgs.scrollTo({top:msgs.scrollHeight,behavior:'smooth'});
  $('#ail').querySelectorAll('button').forEach(b=>{ b.classList.toggle('on',b.dataset.vl===aiVoiceLang); b.onclick=()=>{ aiVoiceLang=b.dataset.vl; localStorage.setItem('ll_voicelang',aiVoiceLang); $('#ail').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); }; });
  const card=x=>{ const bizId=x.type==='business'?x.id:x.business_id; const ic={business:I.store,product:GI.cart,service:GI.wrench||I.cog,worker:GI.helmet||I.user,driver:GI.car||I.pin}[x.type]||I.pin;
    const sub=x.type==='business'?`${esc(x.subcategory||'')}${x.rating?` · ★ ${Number(x.rating).toFixed(1)}`:''}`:x.type==='product'?`${money(x.price)} · ${esc(x.business||'')}`:x.type==='service'?`from ${money(x.starting_price)} · ${esc(x.business||'')}`:x.type==='worker'?`${esc(x.skills||'')}${x.rate?' · '+esc(x.rate):''}`:esc(x.fare_note||x.service_type||'');
    const acts=[x.type==='product'?`<button class="lw-ac hot" data-add="1" data-pid="${x.id}" data-pname="${esc(x.name)}" data-pprice="${x.price}" data-pmrp="${x.mrp||''}" data-pimg="${esc(x.image_url||'')}" data-pbiz="${esc(x.business||'')}" data-pbizid="${x.business_id||''}">${I.plus} Add to cart</button>`:'',
      x.type==='service'?`<button class="lw-ac hot" data-book="${bizId}" data-svc="${esc(x.name)}">${GI.calendar||I.plus} Book</button>`:'',
      x.phone?`<a class="lw-ac" href="tel:${esc(x.phone)}">${I.phone} Call</a>`:'',
      bizId?`<button class="lw-ac" data-open="${bizId}">Open ${I.chev}</button>`:''].join('');
    return `<div class="lw-rc t-${x.type}"><span class="lw-ri">${ic}</span><div><small>${esc(x.type)}</small><b>${esc(x.name)}</b><p>${sub}</p>${acts?`<div class="lw-acts">${acts}</div>`:''}</div></div>`; };
  const add=(cls,html)=>{ const d=document.createElement('div'); d.className=cls; d.innerHTML=html; msgs.appendChild(d); down(); return d; };
  const run=async(text)=>{ text=(text||inp.value).trim(); if(!text) return; inp.value=''; const sg=$('#sugg'); if(sg) sg.remove(); $('#orbz').classList.add('mini');
    add('lw-b me',esc(text)); const ld=add('lw-turn',`<div class="lw-b bot"><span class="ai-typing"><i></i><i></i><i></i></span></div>`); el.classList.add('thinking');
    try{
      if(text==='__track'||/\b(my order|track|where is)\b/i.test(text)){ if(!token){ ld.innerHTML=`<div class="lw-b bot">Log in to see your orders.</div><div class="lw-acts"><button class="lw-ac hot" data-login>Log in</button></div>`; }
        else { const os=await api('/orders'); const live=os.filter(o=>!['completed','rejected','cancelled'].includes(o.status));
          ld.innerHTML=`<div class="lw-b bot">${live.length?`You have ${live.length} active order${live.length>1?'s':''}:`:'You have no active orders right now.'}</div>`+live.map(o=>`<div class="lw-rc"><span class="lw-ri">${GI.package}</span><div><small>Order #LL-${10000+o.id}</small><b>${esc(o.business)}</b><p>${esc(o.status.replace(/_/g,' '))} · ${money(o.total)}</p><div class="lw-acts"><button class="lw-ac hot" data-tab="orders">Track ${I.chev}</button></div></div></div>`).join(''); } }
      else if(text==='__offers'){ const of=await api('/offers'); ld.innerHTML=`<div class="lw-b bot">Here are offers from shops near ${esc(state.areaName)}:</div>`+of.slice(0,5).map(o=>`<div class="lw-rc"><span class="lw-ri">${GI.percent}</span><div><small>${esc(o.business||'')}</small><b>${esc(o.discount_label)} · ${esc(o.title)}</b>${o.code?`<p>Code <b>${esc(o.code)}</b></p>`:''}<div class="lw-acts"><button class="lw-ac" data-open="${o.business_id}">Open ${I.chev}</button></div></div></div>`).join(''); }
      else { const parts=text.split(/\s*(?:,|\band\b|&|\+|\bplus\b|\balso\b)\s*/i).map(s=>s.trim()).filter(s=>s.length>1).slice(0,4); const qs=parts.length>1?parts:[text];
        const rs=await Promise.all(qs.map(x=>api('/ask',{method:'POST',body:{query:x,lang:state.lang}}).catch(()=>({answer:'',results:[]}))));
        ld.innerHTML = qs.length>1 ? `<div class="lw-b bot">I split that into ${qs.length} things — here's what I found nearby:</div>`+rs.map((r,i)=>`<div class="lw-grp"><h5>${esc(qs[i])}</h5>${(r.results||[]).slice(0,3).map(card).join('')||`<p class="lw-none">Nothing nearby for this yet.</p>`}</div>`).join('')
          : `<div class="lw-b bot">${esc(rs[0].answer||'Here is what I found.')}</div>`+(rs[0].results||[]).slice(0,6).map(card).join(''); track('ask_used'); }
    }catch(e){ ld.innerHTML=`<div class="lw-b bot">${esc(e.message||'Something went wrong')}</div>`; }
    el.classList.remove('thinking'); down();
    ld.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>go('business',{id:Number(b.dataset.open)}));
    ld.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
    ld.querySelectorAll('[data-login]').forEach(b=>b.onclick=()=>go('login'));
    ld.querySelectorAll('[data-book]').forEach(b=>b.onclick=async()=>{ try{ lwBook(await api('/businesses/'+b.dataset.book),b.dataset.svc); }catch(e){ toast(e.message); } }); };
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>run(b.dataset.s==='__track'||b.dataset.s==='__offers'?b.dataset.s:b.dataset.s));
  $('#asend').onclick=()=>run(); inp.onkeydown=e=>{ if(e.key==='Enter') run(); };
  setupVoice($('#amic'),inp,run); $('#orb').onclick=()=>$('#amic').click();
  new MutationObserver(()=>{ const on=$('#amic')&&$('#amic').classList.contains('listening'); el.classList.toggle('listening',!!on); const s=$('#ost'); if(s) s.textContent=on?(aiVoiceLang==='ml-IN'?'കേൾക്കുന്നു…':'Listening…'):'Tap to speak'; }).observe($('#amic'),{attributes:true,attributeFilter:['class']});
  if(q) run(q); else if(voice && (window.SpeechRecognition||window.webkitSpeechRecognition)) setTimeout(()=>$('#amic').click(),400);
};

/* ---------- SEARCH ---------- */
SCREENS.searchScreen=async(el)=>{
  const rec=lwLS('ll_srch',[]);
  el.innerHTML=`<header class="lw-sh"><button class="lv-ib" id="__back" aria-label="Back">${I.back}</button><label class="lw-sbox">${I.search}<input id="sq" placeholder="Search shops, food, services…" autocomplete="off"/><button id="sx" hidden aria-label="Clear">×</button></label><button class="lw-smic" id="smic" aria-label="Voice search">${GI.mic}</button></header>
    <div id="sbody"></div>`;
  backWire(el); const inp=$('#sq'), body=$('#sbody'); setTimeout(()=>inp.focus(),300);
  const idle=()=>{ const r=lwLS('ll_srch',[]); body.innerHTML=`${r.length?`<div class="lv-sh"><h2>Recent searches</h2><button class="lv-see" id="clr">Clear</button></div><div class="lw-recent">${r.map((x,i)=>`<button data-q="${esc(x)}" style="--n:${i}">${gi('clock')}${esc(x)}</button>`).join('')}</div>`:''}
    <div class="lv-sh"><h2>Trending near you</h2></div><div class="lw-trend">${ROTATE.map(x=>x.replace(/^Search\s*"?|"$/g,'')).concat(['electrician','pharmacy','cake']).slice(0,9).map((x,i)=>`<button data-q="${esc(x)}" style="--n:${i}">${I.search}<span>${esc(x)}</span></button>`).join('')}</div>
    <button class="lv-ask" data-ask><span class="lv-aorb">${GI.mic}</span><span><b>Not sure what to search?</b><small>Ask Local Link in your own words</small></span></button>`;
    const c=$('#clr'); if(c) c.onclick=()=>{ lwSet('ll_srch',[]); idle(); };
    body.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ inp.value=b.dataset.q; find(); });
    body.querySelector('[data-ask]').onclick=()=>openAsk('',{voice:false}); };
  let tm=null, seq=0;
  const find=async()=>{ const q=inp.value.trim(); $('#sx').hidden=!q; if(!q) return idle(); const my=++seq;
    body.innerHTML=`<div class="px">${skeletonRow(3)}</div>`;
    const r=await api('/search?q='+encodeURIComponent(q)).catch(()=>null); if(my!==seq||!r) return;
    const n=r.businesses.length+r.products.length+r.services.length+r.workers.length+r.drivers.length;
    if(n){ const s=lwLS('ll_srch',[]).filter(x=>x.toLowerCase()!==q.toLowerCase()); s.unshift(q); lwSet('ll_srch',s.slice(0,8)); }
    body.innerHTML = !n ? `<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${I.search}</div><h2>No match for “${esc(q)}”</h2><p>Try a different word, or ask the assistant to look for you.</p><button class="lv-btn" id="askq">Ask Local Link</button></div>`
      : `${r.businesses.length?`<div class="lv-sh"><h2>Stores</h2><small>${r.businesses.length}</small></div><div class="lv-list">${r.businesses.map(lvStoreRow).join('')}</div>`:''}
         ${r.products.length?`<div class="lv-sh"><h2>Products</h2><small>${r.products.length}</small></div><div class="lv-rail">${r.products.map((p,i)=>lvProd(p,null,i)).join('')}</div>`:''}
         ${r.services.length?`<div class="lv-sh"><h2>Services</h2></div><div class="lv-list">${r.services.map((s,i)=>`<button class="lv-srow" data-nav="business" data-id="${s.business_id}" style="--n:${i}"><span class="lv-rimg">${dIcon(s,'wrench')}</span><span class="lv-rt"><b>${esc(s.name)}</b><span class="lv-sm"><span>from <b>${money(s.starting_price)}</b> · ${esc(s.business)}</span></span></span></button>`).join('')}</div>`:''}
         ${r.workers.length?`<div class="lv-sh"><h2>Local workers</h2></div><div class="lv-list" id="sw"></div>`:''}${r.drivers.length?`<div class="lv-sh"><h2>Rides</h2></div><div class="lv-list" id="sd"></div>`:''}<div style="height:20px"></div>`;
    if(r.workers.length) renderWorkers($('#sw'),r.workers); if(r.drivers.length) renderDrivers($('#sd'),r.drivers);
    const aq=$('#askq'); if(aq) aq.onclick=()=>openAsk(q,{}); };
  inp.oninput=()=>{ clearTimeout(tm); tm=setTimeout(find,260); };
  $('#sx').onclick=()=>{ inp.value=''; find(); inp.focus(); };
  $('#smic').onclick=()=>openAsk('',{voice:true});
  idle();
};

/* ---------- LOCATION ---------- */
SCREENS.location=(el)=>{
  const first=!localStorage.getItem('ll_area_set');
  el.innerHTML=`<div class="lw-loc">${first?'':`<button class="lv-ib" id="__back" aria-label="Back">${I.back}</button>`}
    <div class="lw-lmap"><svg viewBox="0 0 260 200" aria-hidden="true"><g class="st"><path d="M0 60H260M0 140H260M70 0V200M180 0V200M0 190L120 0M150 200L260 40"/></g><g class="pk"><rect x="190" y="70" width="50" height="50" rx="10"/><rect x="10" y="150" width="40" height="30" rx="8"/></g></svg>
      <span class="lw-pin">${I.pin}</span><span class="lw-pr"></span><span class="lw-pr r2"></span></div>
    <h1>Find what's near you</h1><p>Allow location to explore local shops, restaurants, services and offers.</p>
    <button class="lv-btn" id="gps">${I.dir} Use my location</button>
    <div class="lv-or"><span>or choose your area</span></div>
    <label class="lw-sbox in">${I.search}<input id="af" placeholder="Search area or panchayath"/></label>
    <div class="lw-areas" id="al"></div></div>`;
  backWire(el);
  const draw=f=>{ const l=ref.areas.filter(a=>{ const p=ref.panchayaths.find(x=>x.id===a.panchayath_id); return !f||(a.name+' '+(p?p.name:'')).toLowerCase().includes(f); });
    $('#al').innerHTML=l.slice(0,30).map((a,i)=>{ const p=ref.panchayaths.find(x=>x.id===a.panchayath_id); return `<button data-area="${a.id}" data-name="${esc(a.name)}" style="--n:${Math.min(i,8)}" class="${a.id==state.areaId?'on':''}"><span>${I.pin}</span><div><b>${esc(a.name)}</b><small>${esc(p?p.name:'')}, Kozhikode</small></div>${a.id==state.areaId?`<em>Current</em>`:I.chev}</button>`; }).join('')||`<p class="lv-empty-s">No area matches that.</p>`;
    el.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{ localStorage.setItem('ll_area_set','1'); pickArea(Number(b.dataset.area),b.dataset.name); }); };
  draw(''); $('#af').oninput=e=>draw(e.target.value.trim().toLowerCase());
  $('#gps').onclick=()=>{ const b=$('#gps'); b.classList.add('busy'); b.disabled=true;
    const nearest=(lat,lng)=>{ let best=null,bd=1e9; ref.areas.forEach(a=>{ if(a.lat==null) return; const d=(a.lat-lat)**2+(a.lng-lng)**2; if(d<bd){bd=d;best=a;} }); return best; };
    const done=a=>{ localStorage.setItem('ll_area_set','1'); if(a) pickArea(a.id,a.name); else { b.classList.remove('busy'); b.disabled=false; toast('Could not match your location — please pick your area'); } };
    if(!navigator.geolocation) return done(null);
    navigator.geolocation.getCurrentPosition(p=>done(nearest(p.coords.latitude,p.coords.longitude)),()=>{ b.classList.remove('busy'); b.disabled=false; toast('Location is off — please pick your area below'); },{timeout:6000,maximumAge:600000}); };
};
// onboarding ends at location the first time
const _lvIntro=SCREENS.intro;
SCREENS.intro=(el)=>{ _lvIntro(el); const hook=()=>{ const nx=$('#nx'), sk=$('#skip'); if(!nx) return;
    const fin=()=>{ state.introSeen=true; localStorage.setItem('ll_intro','1'); nav.customer=[{name: localStorage.getItem('ll_area_set')?'home':'location'}]; routeRender(); };
    sk.onclick=fin; if(/Get Started/.test(nx.textContent)){ nx.onclick=fin; const lg=document.createElement('div'); lg.className='lw-lang'; lg.innerHTML=`<small>Choose your language</small><div><button data-l="en" class="${state.lang==='en'?'on':''}">English</button><button data-l="ml" class="${state.lang==='ml'?'on':''}">മലയാളം</button></div>`; nx.before(lg);
      lg.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ state.lang=b.dataset.l; localStorage.setItem('ll_lang',state.lang); lg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); buzz(); }); } };
  hook(); new MutationObserver(hook).observe(el,{childList:true}); };

/* ---------- NOTIFICATIONS ---------- */
SCREENS.notifications=async(el)=>{
  el.innerHTML=`${lvHead('Notifications',`<button class="lv-ib" data-nav="prefs" aria-label="Notification settings">${I.cog}</button>`)}<div class="lv-list" id="l">${skeletonRow(3)}</div>`; backWire(el);
  if(!token){ $('#l').innerHTML=`<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${I.bell}</div><h2>Stay in the loop</h2><p>Log in to get order updates, booking reminders and offers from shops you follow.</p><button class="lv-btn" id="lg">Log in</button></div>`; $('#lg').onclick=()=>go('login'); return; }
  const n=await api('/notifications').catch(()=>[]); const pr=lwPrefs();
  const ic=t=>({order:GI.package,offer:GI.percent,booking:GI.calendar||I.bell,store:I.store})[t]||I.bell;
  const show=n.filter(x=>x.type==='order'?pr.orders:x.type==='offer'?pr.offers:true);
  const ago=s=>{ const d=(Date.now()-new Date((s||'').replace(' ','T')+'Z'))/6e4; return isNaN(d)?'':d<60?Math.max(1,Math.round(d))+'m ago':d<1440?Math.round(d/60)+'h ago':Math.round(d/1440)+'d ago'; };
  $('#l').innerHTML=show.length?show.map((x,i)=>`<div class="lw-nt t-${esc(x.type||'info')} ${x.read?'':'new'}" style="--n:${Math.min(i,8)}"><span>${ic(x.type)}</span><div><b>${esc(x.title)}</b><p>${esc(x.body||'')}</p><small>${ago(x.created_at)}</small></div></div>`).join('')
    :`<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${I.bell}</div><h2>All caught up</h2><p>Order updates and offers from your favourite shops will show up here.</p></div>`;
};

/* ---------- WISHLIST ---------- */
SCREENS.saved=async(el)=>{
  el.innerHTML=`${lvHead('Wishlist')}<div class="lv-seg" id="seg"><i></i><button class="on" data-s="business">Stores</button><button data-s="product">Products</button></div><div id="l"></div>`; backWire(el);
  const draw=t=>{ const l=saved.filter(s=>s.type===t); const box=$('#l'); box.classList.remove('lv-tin'); void box.offsetWidth; box.classList.add('lv-tin');
    if(!l.length){ box.innerHTML=`<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${I.heart}</div><h2>Nothing saved yet</h2><p>Tap the heart on any ${t==='business'?'store':'product'} to keep it here.</p><button class="lv-btn" id="ex">Explore</button></div>`; $('#ex').onclick=()=>setTab('home'); return; }
    box.innerHTML = t==='business' ? `<div class="lv-list">${l.map((s,i)=>lvStoreRow({id:s.id,name:s.name,subcategory:s.sub,cover_url:s.image},i)).join('')}</div>`
      : `<div class="lv-pgrid">${l.map((s,i)=>lvProd({id:s.id,name:s.name,price:s.price,image_url:s.image},null,i)).join('')}</div>`; };
  const seg=$('#seg'); seg.onclick=e=>{ const b=e.target.closest('[data-s]'); if(!b) return; seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); seg.classList.toggle('r',b.dataset.s==='product'); draw(b.dataset.s); }; draw('business');
};

/* ---------- OFFERS & COUPONS ---------- */
SCREENS.offers=async(el)=>{
  el.innerHTML=`${lvHead('Offers & Coupons')}<div id="l" class="lv-list">${skeletonRow(3)}</div>`; backWire(el);
  const of=await api('/offers');
  $('#l').innerHTML=of.length?of.map((o,i)=>`<div class="lw-cpn" style="--n:${Math.min(i,8)}"><div class="lw-cl"><b>${esc(o.discount_label||'OFFER')}</b><small>${esc(o.business||'')}</small></div><div class="lw-cr"><b>${esc(o.title)}</b><p>${esc(o.description||'')}</p>
      <div class="lw-cact">${o.code?`<button class="lw-code" data-code="${esc(o.code)}">${esc(o.code)} <span>Copy</span></button>`:''}<button class="lv-btn sm" data-nav="business" data-id="${o.business_id}">Shop ${I.chev}</button></div></div></div>`).join('')
    :`<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${GI.percent}</div><h2>No offers right now</h2><p>Check back soon — local shops add deals every week.</p></div>`;
  el.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{ try{ const w=navigator.clipboard&&navigator.clipboard.writeText(b.dataset.code); if(w&&w.catch) w.catch(()=>{}); }catch(e){} b.classList.add('ok'); b.querySelector('span').textContent='Copied'; buzz(); toast('Code copied — apply it at checkout'); });
};

/* ---------- COMMUNITY ---------- */
SCREENS.community=async(el)=>{
  el.innerHTML=`${lvHead('Your Neighbourhood')}<div class="lw-chero"><h2>Shop local.<br>Grow local.</h2><p>Every order keeps a neighbourhood business going.</p><span class="lw-cb1"></span><span class="lw-cb2"></span></div>
    <div class="lv-sh"><h2>New in ${esc(state.areaName)}</h2></div><div class="lv-rail" id="nw">${skeletonCards(2)}</div>
    <div class="lv-sh"><h2>Neighbourhood favourites</h2></div><div class="lv-list" id="fav">${skeletonRow(2)}</div>
    <div class="lv-sh"><h2>Events &amp; announcements</h2><button class="lv-see" data-nav="events">See all ${I.chev}</button></div><div class="lv-list" id="ev"></div>
    <div class="lv-sh"><h2>Local news</h2><button class="lv-see" data-nav="news">See all ${I.chev}</button></div><div class="lv-rail" id="nwz"></div>
    <div class="lv-sh"><h2>Latest reviews</h2></div><div class="lv-list" id="rv"></div>
    <section class="lw-refer"><span>${I.store}</span><div><b>Know a great local business?</b><p>Refer them to Local Link and help them get found.</p></div><button class="lv-btn sm" id="ref">Refer</button></section><div style="height:24px"></div>`;
  backWire(el);
  const [biz,ev,news]=await Promise.all([api('/businesses'),api('/events'),api('/news')]);
  $('#nw').innerHTML=biz.slice().sort((a,b)=>b.id-a.id).slice(0,8).map((b,i)=>lvStoreCard(b,i).replace('lv-scard"','lv-scard" data-new="1"')).join('');
  $('#fav').innerHTML=biz.slice().sort((a,b)=>(b.review_count||0)-(a.review_count||0)).slice(0,4).map(lvStoreRow).join('');
  $('#ev').innerHTML=ev.slice(0,3).map(eventCard).join(''); $('#nwz').innerHTML=news.slice(0,5).map(newsCard).join('');
  const withRev=await Promise.all(biz.slice().sort((a,b)=>(b.review_count||0)-(a.review_count||0)).slice(0,3).map(b=>api('/businesses/'+b.id).catch(()=>null)));
  const rv=[]; withRev.forEach(b=>b&&(b.reviews||[]).slice(0,2).forEach(r=>rv.push({...r,biz:b.name,bizId:b.id})));
  $('#rv').innerHTML=rv.length?rv.slice(0,4).map(r=>`<button class="lw-rv" data-nav="business" data-id="${r.bizId}"><div><b>${esc(r.author_name)}</b>${stars(r.rating)}</div><p>“${esc(r.comment)}”</p><small>${esc(r.biz)}</small></button>`).join(''):`<p class="lv-empty-s">No reviews yet.</p>`;
  $('#ref').onclick=()=>gateAction('refer a business',()=>showSheet('Refer a local business',`<div class="lw-book">${lwField('rn','Business name')}${lwField('rp','Their phone (optional)','','inputmode="tel"')}<div class="field"><label for="rw">What do they do?</label><div class="input"><textarea id="rw" rows="2" placeholder="e.g. Home bakery near the temple"></textarea></div></div><button class="lv-btn" id="rgo">Send referral</button></div>`,()=>{
    $('#rgo').onclick=async()=>{ const n=$('#rn').value.trim(); if(!n) return toast('Please add the business name'); try{ await api('/leads',{method:'POST',body:{type:'enquiry',area_id:state.areaId,query:'Business referral: '+n,message:[$('#rw').value.trim(),$('#rp').value.trim()].filter(Boolean).join(' · ')}}); closeSheet(); lwConfirm('Thanks for the referral!',`We'll reach out to <b>${esc(n)}</b> about joining Local Link.`); }catch(e){ toast(e.message); } }; }));
};

/* ---------- HELP & SUPPORT ---------- */
SCREENS.support=async(el)=>{
  const F=[['How do I track my order?','Open Orders. Your live order shows each step — placed, accepted, preparing, on the way — and you can chat with or call the shop.'],
    ['Can I cancel an order?','Yes, until the shop accepts it. Open the order and tap Cancel order. After that, chat with the shop.'],
    ['How do I pay?','Each shop chooses what it accepts — usually cash on delivery, card on delivery or UPI directly to the shop. You will see the options at checkout.'],
    ['Can I pick up instead of delivery?','Yes. Choose Pickup at checkout and collect from the shop.'],
    ['How do coupons work?','Copy a code from Offers & Coupons and apply it at checkout for that shop.'],
    ['How do I book a service?','Open a service provider, pick a day and time, and send the request. The provider confirms by call or chat.']];
  el.innerHTML=`${lvHead('Help & Support')}<button class="lv-ask" data-ask><span class="lv-aorb">${GI.mic}</span><span><b>Ask Local Link</b><small>Get instant answers about orders and shops</small></span></button>
    <div class="lw-sgrid"><button data-k="order">${GI.package}<b>Order issue</b></button><button data-k="refund">${GI.card}<b>Refund / payment</b></button><button data-k="shop">${I.store}<b>Contact a shop</b></button><button data-k="complaint">${GI.megaphone||I.bell}<b>Raise a complaint</b></button></div>
    <div class="lv-sh"><h2>FAQs</h2></div><div class="lw-faq">${F.map((f,i)=>`<details style="--n:${i}"><summary>${esc(f[0])}<i>${I.plus}</i></summary><p>${esc(f[1])}</p></details>`).join('')}</div><div style="height:24px"></div>`;
  backWire(el); el.querySelector('[data-ask]').onclick=()=>openAsk('',{});
  el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>gateAction('get help',async()=>{ const os=await api('/orders').catch(()=>[]); const k=b.dataset.k;
    if(k==='shop'){ const seen=new Map(); os.forEach(o=>seen.set(o.business_id,o.business)); if(!seen.size) return toast('Order from a shop first, or open any store to call or chat');
      return showSheet('Contact a shop',`<div class="lv-list" style="padding:0">${[...seen].map(([id,n])=>`<button class="lv-row" style="width:100%;margin:0" data-sid="${id}" data-sn="${esc(n)}"><span class="lv-ri">${I.store}</span><div><b>${esc(n)}</b><small>Chat or call</small></div>${I.chev}</button>`).join('')}</div>`,()=>document.querySelectorAll('[data-sid]').forEach(x=>x.onclick=()=>{ closeSheet(); go('business',{id:Number(x.dataset.sid)}); })); }
    if(!os.length) return toast('You have no orders yet');
    const title={order:'Order issue',refund:'Refund or payment',complaint:'Raise a complaint'}[k];
    showSheet(title,`<div class="lw-book"><div class="field"><label for="so">Which order?</label><div class="input"><select id="so">${os.slice(0,12).map(o=>`<option value="${o.id}" data-b="${o.business_id}">#LL-${10000+o.id} · ${esc(o.business)} · ${money(o.total)}</option>`).join('')}</select></div></div>
      <div class="field"><label for="sm">Tell us what happened</label><div class="input"><textarea id="sm" rows="3" placeholder="Describe the issue"></textarea></div></div><button class="lv-btn" id="sgo">Send to the shop</button><p class="lw-fine">The shop receives this straight away and will reply in chat.</p></div>`,()=>{
      $('#sgo').onclick=async()=>{ const s=$('#so'), m=$('#sm').value.trim(); if(!m) return toast('Please describe the issue'); const bid=Number(s.selectedOptions[0].dataset.b);
        try{ await api('/enquiries',{method:'POST',body:{business_id:bid,message:`${title} — order #LL-${10000+Number(s.value)}: ${m}`}}); closeSheet(); lwConfirm('Sent to the shop','They will reply in chat. You can also call them from the store page.'); }catch(e){ toast(e.message); } }; }); }));
};

/* ---------- PROFILE / ADDRESSES / PREFERENCES / PAYMENTS ---------- */
SCREENS.profile=(el)=>{
  if(!token) return go('login');
  el.innerHTML=`${lvHead('Edit Profile')}<div class="lw-pf"><span class="lv-mav big">${esc((me.name||'?')[0])}</span>${lwField('pn','Full name',me.name,'autocomplete="name"')}${lwField('pp','Phone',me.phone,'inputmode="tel" autocomplete="tel"')}<div class="field"><label>Email</label><div class="input dis"><input value="${esc(me.email||'')}" disabled/></div></div><button class="lv-btn" id="psv">Save changes</button></div>`;
  backWire(el); $('#psv').onclick=async()=>{ const b=$('#psv'); b.classList.add('busy'); b.disabled=true;
    try{ const r=await api('/me',{method:'PATCH',body:{name:$('#pn').value,phone:$('#pp').value}}); me=r.user; localStorage.setItem('ll_user',JSON.stringify(me)); toast('Profile updated'); back(); }
    catch(e){ b.classList.remove('busy'); b.disabled=false; toast(e.message); } };
};
SCREENS.addresses=(el)=>{
  const list=()=>{ let l=lwLS('ll_addrs',null); if(!l){ const a=lwLS('ll_addr',null); l=a&&a.line?[{...a,label:'Home',id:1}]:[]; lwSet('ll_addrs',l); } return l; };
  const draw=()=>{ const l=list(); const def=lwLS('ll_addr',{});
    el.innerHTML=`${lvHead('My Addresses')}<div class="lv-list">${l.map((a,i)=>`<div class="lw-adr ${a.line===def.line?'on':''}" style="--n:${i}"><span>${a.label==='Work'?I.store:I.home}</span><div><b>${esc(a.label||'Address')}</b><p>${esc(a.name||'')} · ${esc(a.phone||'')}</p><p>${esc(a.line)}, ${esc(a.area||'')}</p>
      <div class="lw-aact">${a.line===def.line?'<em>Default</em>':`<button data-def="${a.id}">Set default</button>`}<button data-del="${a.id}">Remove</button></div></div></div>`).join('')||`<p class="lv-empty-s">No saved addresses yet.</p>`}</div>
      <button class="lv-btn ghost" id="addA" style="margin:16px;width:calc(100% - 32px)">${I.plus} Add new address</button>`;
    backWire(el);
    el.querySelectorAll('[data-def]').forEach(b=>b.onclick=()=>{ const a=l.find(x=>x.id==b.dataset.def); lwSet('ll_addr',a); buzz(); draw(); });
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ lwSet('ll_addrs',l.filter(x=>x.id!=b.dataset.del)); draw(); });
    $('#addA').onclick=()=>showSheet('New address',`<div class="lw-book"><div class="lw-slots" id="lb"><button class="on" data-t="Home">Home</button><button data-t="Work">Work</button><button data-t="Other">Other</button></div>${lwField('an','Full name',me?me.name:'')}${lwField('ap','Phone',me?me.phone:'','inputmode="tel"')}<div class="field"><label for="al2">Address</label><div class="input"><textarea id="al2" rows="2" placeholder="House / building, street, landmark"></textarea></div></div>${lwField('aa','Area',state.areaName)}<button class="lv-btn" id="asv">Save address</button></div>`,()=>{
      $('#lb').onclick=e=>{ const x=e.target.closest('button'); if(x) $('#lb').querySelectorAll('button').forEach(y=>y.classList.toggle('on',y===x)); };
      $('#asv').onclick=()=>{ const a={id:Date.now(),label:$('#lb .on').dataset.t,name:$('#an').value.trim(),phone:$('#ap').value.trim(),line:$('#al2').value.trim(),area:$('#aa').value.trim()}; if(!a.name||!a.phone||!a.line) return toast('Please fill name, phone and address');
        const l2=list(); l2.push(a); lwSet('ll_addrs',l2); if(!lwLS('ll_addr',{}).line) lwSet('ll_addr',a); closeSheet(); draw(); toast('Address saved'); }; }); };
  draw();
};
SCREENS.prefs=(el)=>{
  const p=lwPrefs(); const row=(k,t,s)=>`<label class="lw-tg"><div><b>${t}</b><small>${s}</small></div><input type="checkbox" data-k="${k}" ${p[k]?'checked':''}/><i></i></label>`;
  el.innerHTML=`${lvHead('Preferences')}<div class="lv-sh"><h2>Language</h2></div><div class="lw-langs"><button data-l="en" class="${state.lang==='en'?'on':''}"><b>English</b><small>English</small></button><button data-l="ml" class="${state.lang==='ml'?'on':''}"><b>മലയാളം</b><small>Malayalam</small></button></div>
    <div class="lv-sh"><h2>Notifications</h2></div><div class="lv-menu lw-tgs">${row('orders','Order updates','Accepted, preparing, on the way')}${row('bookings','Booking reminders','Service bookings you request')}${row('offers','New local offers','Deals from shops near you')}${row('stores','Favourite store updates','When saved stores post something new')}</div>
    <div class="lv-sh"><h2>Appearance</h2></div><div class="lv-menu lw-tgs"><label class="lw-tg"><div><b>Dark mode</b><small>Easier on the eyes at night</small></div><input type="checkbox" id="dk" ${state.custTheme==='dark'?'checked':''}/><i></i></label></div>`;
  backWire(el);
  el.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ state.lang=b.dataset.l; localStorage.setItem('ll_lang',state.lang); renderShell(); });
  el.querySelectorAll('[data-k]').forEach(c=>c.onchange=()=>{ const q=lwPrefs(); q[c.dataset.k]=c.checked; lwSet('ll_notif',q); buzz(); });
  $('#dk').onchange=()=>{ toggleCustTheme(); routeRender(); };
};
SCREENS.payments=(el)=>{
  el.innerHTML=`${lvHead('Payment Methods')}<div class="lw-pay-i"><span>${GI.card}</span><p>You pay the shop directly. Each shop chooses what it accepts, and you'll see the options at checkout.</p></div>
    <div class="lv-menu">${[['Cash on Delivery','Pay when your order arrives',GI.card],['Card on Delivery','Swipe at your door',GI.card],['UPI to the shop','GPay, PhonePe, Paytm and more',GI.chat]].map(m=>`<div class="lw-pm"><span class="lv-mi">${m[2]}</span><div><b>${m[0]}</b><small>${m[1]}</small></div></div>`).join('')}</div>`;
  backWire(el);
};

/* ---------- ACCOUNT (adds the new pages) ---------- */
const _lvAcct=SCREENS.account;
SCREENS.account=async(el)=>{ await _lvAcct(el);
  const m=el.querySelectorAll('.lv-menu');
  const row=(attr,ic,label,right='')=>`<button ${attr}><span class="lv-mi">${ic}</span><b>${label}</b>${right?`<small>${right}</small>`:''}${I.chev}</button>`;
  if(m[0]){ m[0].querySelector('[data-nav="location"]').outerHTML=row('data-nav="addresses"',I.pin,'My Addresses'); m[0].insertAdjacentHTML('beforeend',row('data-nav="payments"',GI.card,'Payment Methods')+row('data-nav="community"',I.users||I.heart,'Your Neighbourhood')); }
  if(m[1]){ const lr=m[1].querySelector('#langrow'); if(lr) lr.outerHTML=row('data-nav="prefs"',I.globe,'Language & notifications',state.lang==='ml'?'മലയാളം':'English'); const h=m[1].querySelector('#help'); if(h) h.outerHTML=row('data-nav="support"',GI.chat,'Help & Support'); }
  const pe=el.querySelector('.lv-me [data-tabnav="profile"]'); if(pe){ pe.removeAttribute('data-tabnav'); pe.onclick=()=>go('profile'); }
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};

/* ---------- REGISTER ---------- */
SCREENS.register=(el)=>{
  el.innerHTML=`<div class="lv-login"><button class="lv-ib" id="rb" aria-label="Back">${I.back}</button><div class="lv-lbrand">${logoMark(40)}<b>Local</b><b>Link</b></div>
    <h2>Create your account</h2><p>Order, book services and support your neighbourhood.</p>
    <div class="field"><label for="rn">Full name</label><div class="input">${I.user}<input id="rn" placeholder="Your name" autocomplete="name"/></div></div>
    <div class="field"><label for="rp">Mobile number</label><div class="input"><span class="lw-cc">+91</span><input id="rp" type="tel" inputmode="tel" placeholder="98765 43210" autocomplete="tel"/></div></div>
    <div class="field"><label for="re">Email</label><div class="input"><span class="gi">${GI.chat}</span><input id="re" type="email" placeholder="you@email.com" autocomplete="email"/></div></div>
    <div class="field"><label for="rpw">Password</label><div class="input"><span class="gi">${GI.lock}</span><input id="rpw" type="password" placeholder="At least 6 characters" autocomplete="new-password"/><button class="lw-eye" id="eye" type="button">Show</button></div><div class="lw-str" id="str"><i></i><i></i><i></i></div></div>
    <button class="lv-btn" id="rsubmit">Create account ${I.chev}</button><p class="lv-alt">Already have an account? <a href="#" id="gologin">Log in</a></p><p class="lv-terms">By continuing, you agree to our Terms &amp; Privacy Policy</p></div>`;
  $('#rb').onclick=back; $('#gologin').onclick=e=>{ e.preventDefault(); go('login'); };
  $('#eye').onclick=()=>{ const i=$('#rpw'); i.type=i.type==='password'?'text':'password'; $('#eye').textContent=i.type==='password'?'Show':'Hide'; };
  $('#rpw').oninput=e=>{ const v=e.target.value; const s=(v.length>=6)+(/[0-9]/.test(v)&&/[a-z]/i.test(v))+(v.length>=10); $('#str').dataset.s=s; };
  $('#rsubmit').onclick=async()=>{ const name=$('#rn').value.trim(), email=$('#re').value.trim(), ph=$('#rp').value.replace(/\s/g,''), pw=$('#rpw').value;
    if(!name||!email||!ph||!pw) return toast('Please fill in all fields'); if(pw.length<6) return toast('Password must be at least 6 characters');
    const btn=$('#rsubmit'); btn.classList.add('busy'); btn.disabled=true;
    try{ const r=await api('/auth/register',{method:'POST',body:{name,email,phone:ph.startsWith('+')?ph:'+91'+ph,password:pw}}); token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me)); toast('Welcome to Local Link, '+me.name.split(' ')[0]+'!'); routeAfterLogin(); }
    catch(e){ btn.classList.remove('busy'); btn.disabled=false; const c=$('.lv-login'); c.classList.remove('fx-shake'); void c.offsetWidth; c.classList.add('fx-shake'); toast(e.message); } };
};

/* ---------- workers / rides / local info ---------- */
renderWorkers=function(elm,data){ elm.innerHTML=data.map((w,i)=>`<div class="lw-pro" style="--n:${Math.min(i,8)}"><span class="lw-pav">${esc((w.name||'?')[0])}<i class="${w.available?'on':''}"></i></span><div class="lw-pt"><b>${esc(w.name)}</b><p>${esc(w.skills||'')}</p>
  <div class="lv-sm">${lvRate(w.rating)}<i>·</i><span>${w.experience_years||0} yrs exp</span>${w.area_name?`<i>·</i><span>${esc(w.area_name)}</span>`:''}</div><div class="lw-ptags"><em>${esc(w.rate||'')}</em><em class="${w.available?'ok':''}">${w.available?'Available':'Busy'}</em></div>
  <div class="lw-pact"><a class="lv-btn sm" href="tel:${esc(w.phone||'')}">${I.phone} Call</a><a class="lv-btn sm soft" href="https://wa.me/${(w.whatsapp||'').replace(/[^0-9]/g,'')}" target="_blank" rel="noopener">${I.wa} WhatsApp</a></div></div></div>`).join('')||`<p class="lv-empty-s">No workers listed here yet.</p>`; };
renderDrivers=function(elm,data){ elm.innerHTML=data.map((d,i)=>`<div class="lw-pro" style="--n:${Math.min(i,8)}"><span class="lw-pav car">${driverIcon(d.service_type)}<i class="${d.available?'on':''}"></i></span><div class="lw-pt"><b>${esc(d.name)}</b><p>${esc(d.vehicle_model||'')} · ${esc(d.vehicle_number||'')}</p>
  <div class="lv-sm">${lvRate(d.rating)}<i>·</i><span>${esc(d.service_type||'')}</span></div><div class="lw-ptags"><em>${esc(d.fare_note||'')}</em><em class="${d.available?'ok':''}">${d.available?'Available':'Offline'}</em></div>
  <div class="lw-pact"><a class="lv-btn sm" href="tel:${esc(d.phone||'')}">${I.phone} Call</a><a class="lv-btn sm soft" href="https://wa.me/${(d.whatsapp||'').replace(/[^0-9]/g,'')}" target="_blank" rel="noopener">${I.wa} Book</a></div></div></div>`).join('')||`<p class="lv-empty-s">No rides listed here yet.</p>`; };
renderLocalInfo=function(elm,data){ const g={}; data.forEach(i=>(g[i.category]=g[i.category]||[]).push(i));
  elm.innerHTML=Object.entries(g).map(([k,items])=>`<h3 class="lw-ig">${esc(k)}</h3>${items.map((i,x)=>`<div class="lw-li ${i.emergency?'sos':''}" style="--n:${Math.min(x,6)}"><span>${i.emergency?GI.warning||I.bell:GI.building}</span><div><b>${esc(i.name)}</b><p>${esc(i.description||'')}</p>${i.hours?`<small>${esc(i.hours)}</small>`:''}</div>${i.phone?`<a href="tel:${esc(i.phone)}" aria-label="Call ${esc(i.name)}">${I.phone}</a>`:''}</div>`).join('')}`).join(''); };
SCREENS.localinfo=async(el)=>{ el.innerHTML=`${lvHead('Local Info')}<div class="lv-list" id="l">${skeletonRow(3)}</div>`; backWire(el); renderLocalInfo($('#l'),await api('/local-info')); };
SCREENS.events=async(el)=>{ el.innerHTML=`${lvHead('Events')}<div class="lv-list" id="l">${skeletonRow(3)}</div>`; backWire(el); $('#l').innerHTML=(await api('/events')).map(eventCard).join('')||`<p class="lv-empty-s">No upcoming events.</p>`; };
SCREENS.news=async(el)=>{ el.innerHTML=`${lvHead('Local News')}<div class="lv-list" id="l">${skeletonRow(3)}</div>`; backWire(el); $('#l').innerHTML=(await api('/news')).map(n=>newsCard(n)).join(''); };

/* ---------- CATEGORY: map / list toggle ---------- */
const _lvCat=SCREENS.category;
SCREENS.category=async(el,p)=>{ await _lvCat(el,p); const list=$('#list'); if(!list||!el.querySelector('#qcCount')) return;
  const head=el.querySelector('#qcCount').parentNode; head.insertAdjacentHTML('beforeend',`<div class="lw-vt" id="vt"><i></i><button class="on" data-v="list" aria-label="List view">${I.grid}</button><button data-v="map" aria-label="Map view">${I.pin}</button></div>`);
  const mapBox=document.createElement('div'); mapBox.className='lw-mapv'; mapBox.hidden=true; list.before(mapBox);
  const drawMap=()=>{ const rows=[...list.querySelectorAll('.lv-srow')].slice(0,12);
    mapBox.innerHTML=`<svg viewBox="0 0 340 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="st"><path d="M-10 50H350M-10 130H350M-10 190H350M60 -10V230M170 -10V230M280 -10V230M-10 220L140 -10M200 230L350 30"/></g><g class="pk"><rect x="190" y="64" width="70" height="50" rx="10"/><rect x="18" y="146" width="36" height="30" rx="8"/></g></svg>
      <span class="lw-me">${I.user}</span>${rows.map((r,i)=>{ let h=0; const s=r.querySelector('b').textContent; for(const c of s) h=(h*31+c.charCodeAt(0))%9973; const x=10+(h%80), y=24+((h>>3)%58);
      return `<button class="lw-mpin" style="left:${x}%;top:${y}%;--n:${i}" data-i="${i}"><span>${i+1}</span></button>`; }).join('')}
      <p class="lw-mnote">Pins show stores in ${esc(state.areaName)} · tap a pin</p><div class="lw-mcard" id="mc"></div>`;
    mapBox.querySelectorAll('.lw-mpin').forEach(b=>b.onclick=()=>{ mapBox.querySelectorAll('.lw-mpin').forEach(x=>x.classList.toggle('on',x===b)); const c=$('#mc'); c.innerHTML=rows[b.dataset.i].outerHTML; c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); buzz(); }); };
  $('#vt').onclick=e=>{ const b=e.target.closest('[data-v]'); if(!b) return; const v=b.dataset.v; $('#vt').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); $('#vt').classList.toggle('r',v==='map');
    if(v==='map'){ drawMap(); mapBox.hidden=false; list.hidden=true; } else { mapBox.hidden=true; list.hidden=false; } buzz(); };
};

/* ---------- HOME: recently viewed, recommended services, community ---------- */
const _lvHome=SCREENS.home;
SCREENS.home=async(el)=>{ await _lvHome(el);
  const rec=lwLS('ll_recent',[]); const pop=$('#lvPop'); if(!pop) return; const anchor=pop.closest('.lv-sec');
  let html='';
  if(rec.length) html+=`<section class="lv-sec"><div class="lv-sh"><h2>Recently viewed</h2><button class="lv-see" id="rclr">Clear</button></div><div class="lv-rail">${rec.map(lvStoreCard).join('')}</div></section>`;
  html+=`<section class="lv-sec"><div class="lv-sh"><h2>Recommended services</h2><button class="lv-see" data-nav="category" data-slug="services">See all ${I.chev}</button></div><div class="lv-list" id="lwSvc">${skeletonRow(2)}</div></section>
    <button class="lw-comm" data-nav="community"><span class="lw-cav">${['A','R','S'].map(x=>`<i>${x}</i>`).join('')}</span><span><b>Your Neighbourhood</b><small>New shops, events, reviews &amp; local news</small></span>${I.chev}</button>`;
  anchor.insertAdjacentHTML('afterend',html);
  const rc=$('#rclr'); if(rc) rc.onclick=()=>{ lwSet('ll_recent',[]); rc.closest('.lv-sec').remove(); };
  const sv=await api('/services').catch(()=>[]); const box=$('#lwSvc'); if(box) box.innerHTML=sv.slice(0,3).map((s,i)=>`<div class="lv-srow" style="--n:${i}"><button class="lw-svcgo" data-nav="business" data-id="${s.business_id}"><span class="lv-rimg">${dIcon(s,'wrench')}</span><span class="lv-rt"><b>${esc(s.name)}</b><span class="lv-sm"><span>from <b>${money(s.starting_price)}</b>${s.business?' · '+esc(s.business):''}</span></span></span></button><button class="lv-req" data-svc="${esc(s.name)}" data-bid="${s.business_id}">Book</button></div>`).join('');
  el.querySelectorAll('.lv-req[data-svc]').forEach(b=>b.onclick=async()=>{ try{ lwBook(await api('/businesses/'+b.dataset.bid),b.dataset.svc); }catch(x){ toast(x.message); } });
};

/* ---------- CHECKOUT: pickup / delivery, coupon, note, per-store split ---------- */
const _lvChk=SCREENS.checkout;
SCREENS.checkout=async(el)=>{ await _lvChk(el); const place=$('#place'); if(!place) return;
  const groups={}; cart.forEach(i=>{ (groups[i.bizId||1]=groups[i.bizId||1]||{name:i.biz,items:[]}).items.push(i); });
  const offers=await api('/offers').catch(()=>[]); const bid=Number(cartBizId()||0); const avail=offers.filter(o=>o.business_id===bid);
  const steps=el.querySelector('.lv-steps');
  steps.insertAdjacentHTML('afterend',`<div class="lw-ful" id="ful"><i></i><button class="on" data-f="delivery">${GI.package} Delivery</button><button data-f="pickup">${I.store} Pickup</button></div><p class="lw-pick" id="pk" hidden>${I.store} Collect from <b>${esc(cart[0]?.biz||'the shop')}</b>. They'll tell you when it's ready.</p>`);
  const paySh=el.querySelector('.lv-pays').previousElementSibling;
  paySh.insertAdjacentHTML('beforebegin',`${Object.keys(groups).length>1?`<div class="lv-sh"><h2>${Object.keys(groups).length} separate orders</h2></div><div class="lv-list">${Object.values(groups).map(g=>`<div class="lw-split">${I.store}<b>${esc(g.name||'Shop')}</b><small>${g.items.length} item${g.items.length>1?'s':''} · delivered separately</small></div>`).join('')}</div>`:''}
    <div class="lv-sh"><h2>Coupon</h2></div><div class="lw-cpin"><label class="lv-stxt in">${GI.percent}<input id="cc" placeholder="Enter coupon code" autocapitalize="characters"/></label><button class="lv-btn sm" id="ccgo">Apply</button></div>
    ${avail.filter(o=>o.code).length?`<div class="lw-cpsug">${avail.filter(o=>o.code).map(o=>`<button data-cc="${esc(o.code)}">${esc(o.code)} · ${esc(o.discount_label)}</button>`).join('')}</div>`:''}
    <div class="lv-sh"><h2>Note for the shop</h2></div><div class="lw-note"><textarea id="note" rows="2" placeholder="e.g. less spicy, call on arrival"></textarea></div>`);
  let ful='delivery', disc=0, code='';
  const bill=$('#billd'), tot=el.querySelector('.lv-tot b'); const base=cartTotal(); const deliv=()=>ful==='pickup'?0:(base>=499?0:29);
  const redraw=()=>{ const pay=Math.max(0,base-disc+deliv()); tot.textContent=money(pay); tot.classList.remove('lw-tick'); void tot.offsetWidth; tot.classList.add('lw-tick');
    bill.innerHTML=`<div><span>Items</span><b>${money(base)}</b></div>${disc?`<div class="lw-dl"><span>Coupon ${esc(code)}</span><b>−${money(disc)}</b></div>`:''}<div><span>${ful==='pickup'?'Pickup':'Delivery'}</span><b>${deliv()?money(deliv()):'<em>FREE</em>'}</b></div><div class="tot"><span>To pay</span><b>${money(pay)}</b></div>`; };
  redraw();
  $('#ful').onclick=e=>{ const b=e.target.closest('[data-f]'); if(!b) return; ful=b.dataset.f; $('#ful').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); $('#ful').classList.toggle('r',ful==='pickup'); $('#pk').hidden=ful!=='pickup'; el.querySelectorAll('#addrRow,#addrEdit').forEach(x=>x.classList.toggle('lw-off',ful==='pickup')); buzz(); redraw(); };
  const apply=c=>{ c=(c||$('#cc').value).trim().toUpperCase(); const o=avail.find(x=>(x.code||'').toUpperCase()===c); if(!o){ disc=0; code=''; redraw(); const i=$('#cc').closest('.lv-stxt'); i.classList.remove('fx-shake'); void i.offsetWidth; i.classList.add('fx-shake'); return toast(c?'That code isn’t valid for this shop':'Enter a code'); }
    const pct=lwPct(o.discount_label); disc=pct?Math.round(base*pct/100):0; code=c; $('#cc').value=c; redraw(); buzz(20); toast(disc?`${c} applied — you save ${money(disc)}`:`${c} applied — the shop will apply this offer`); };
  $('#ccgo').onclick=()=>apply(); el.querySelectorAll('[data-cc]').forEach(b=>b.onclick=()=>apply(b.dataset.cc));
  // replace the order submit to include fulfilment, coupon and note
  const np=place.cloneNode(true); place.replaceWith(np);
  np.onclick=async()=>{ const name=$('#cn').value.trim(), phone=$('#cp').value.trim(), line=$('#cl').value.trim(), area=$('#ca').value.trim();
    if(ful==='delivery'&&(!name||!phone||!line)){ $('#addrRow').hidden=true; $('#addrEdit').hidden=false; return toast('Please fill name, phone and address'); }
    if(ful==='delivery') localStorage.setItem('ll_addr',JSON.stringify({name,phone,line,area}));
    const pm=(el.querySelector('.lv-pay.on')||{}).dataset?.pay||'cash'; np.disabled=true; np.classList.add('busy');
    try{ let last=null; const n=Object.keys(groups).length;
      for(const [b,g] of Object.entries(groups)){ const sub=g.items.reduce((s,i)=>s+i.qty*i.price,0); const d=Number(b)===bid?disc:0;
        const r=await api('/orders',{method:'POST',body:{business_id:Number(b),total:Math.max(0,sub-d+(ful==='pickup'?0:(sub>=499?0:29))),item_summary:g.items.map(i=>`${i.qty}× ${i.name}`).join(', ')+(ful==='pickup'?' · PICKUP':''),payment_method:pm,
          items_json:g.items.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,image:i.image||''})),fulfilment:ful,address:ful==='delivery'?`${name}, ${phone}, ${line}, ${area}`:null,note:$('#note').value.trim()||null,discount:d}}); last=r&&r.id; }
      const pay=Math.max(0,base-disc+deliv()); track('order_placed',{total:pay,fulfilment:ful}); const shop=n>1?`${n} shops`:(cart[0]?.biz||''); cart=[]; saveCart(); updateCartBadge(); buzz(30);
      nav.customer=[{name:'orderDone',params:{shop,total:pay,oid:last,pickup:ful==='pickup'}}]; routeRender(); }
    catch(e){ np.disabled=false; np.classList.remove('busy'); toast(e.message); } };
};

/* ---------- ORDERS: cancel, rate, invoice, bookings tab ---------- */
function lwInvoice(o){ const it=(typeof o.items_json==='string'?safeParse(o.items_json):o.items_json)||[]; const w=window.open('','_blank'); if(!w) return toast('Allow pop-ups to download the invoice');
  w.document.write(`<!doctype html><title>Invoice #LL-${10000+o.id}</title><style>body{font:14px system-ui;max-width:560px;margin:32px auto;color:#14161A}h1{color:#07594F;font-size:22px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}.t{font-weight:800;font-size:16px}small{color:#666}</style>
  <h1>Local Link</h1><p><b>Invoice #LL-${10000+o.id}</b><br><small>${esc(o.created_at||'')}</small></p><p>Sold by <b>${esc(o.business)}</b><br>${o.fulfilment==='pickup'?'Pickup from shop':'Delivery'}${o.address?'<br>'+esc(o.address):''}</p>
  <table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${it.length?it.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.qty||1}</td><td>₹${((i.price||0)*(i.qty||1)).toFixed(2)}</td></tr>`).join(''):`<tr><td colspan=3>${esc(o.item_summary||'')}</td></tr>`}
  ${o.discount?`<tr><td colspan=2>Discount</td><td>−₹${Number(o.discount).toFixed(2)}</td></tr>`:''}<tr class="t"><td colspan=2>Total</td><td>₹${Number(o.total).toFixed(2)}</td></tr></table>
  <p><small>Paid via ${esc(o.payment_method||'cash')} to the shop · Status: ${esc(o.status)}</small></p><script>setTimeout(()=>print(),300)<\/script>`); w.document.close(); }
const _lvOrders=SCREENS.orders;
SCREENS.orders=async(el,p)=>{ await _lvOrders(el,p); const seg=$('#seg'); if(!seg) return;
  const os=await api('/orders').catch(()=>[]); const byId=Object.fromEntries(os.map(o=>[o.id,o]));
  seg.style.gridTemplateColumns='1fr 1fr 1fr'; seg.querySelector('i').style.width='calc(33.3% - 3px)'; seg.insertAdjacentHTML('beforeend',`<button data-s="book">Bookings</button>`);
  const enhance=()=>{ const l=$('#l');
    l.querySelectorAll('.lv-ocard').forEach(c=>{ if(c.dataset.lw) return; c.dataset.lw=1; const id=Number((c.querySelector('.lv-ohead b').textContent.match(/\d+/)||[0])[0])-10000; const o=byId[id]; if(!o) return;
      const extra=[]; if(o.status==='pending') extra.push(`<button class="lw-x" data-cancel="${o.id}">Cancel order</button>`); extra.push(`<button class="lw-x g" data-inv="${o.id}">${GI.download||''} Invoice</button>`);
      if(o.fulfilment==='pickup') c.querySelector('.lv-ost').textContent='Pickup';
      c.insertAdjacentHTML('beforeend',`<div class="lw-oextra">${extra.join('')}</div>`); });
    l.querySelectorAll('.lv-prow').forEach(r=>{ if(r.dataset.lw) return; r.dataset.lw=1; const btn=r.querySelector('[data-reorder]'); let d={}; try{ d=JSON.parse(btn.dataset.reorder); }catch(e){}
      const o=os.find(x=>x.business_id===d.bizId&&x.item_summary===r.querySelector('small').textContent)||null; if(!o) return;
      r.insertAdjacentHTML('beforeend',`<div class="lw-prx">${o.status==='completed'?(o.rating?`<span class="lw-rated">${'★'.repeat(o.rating)}</span>`:`<span class="lw-stars" data-rate="${o.id}">${[1,2,3,4,5].map(n=>`<button data-n="${n}" aria-label="${n} stars">★</button>`).join('')}</span>`):''}<button class="lw-x g" data-inv="${o.id}">Invoice</button>${o.status==='cancelled'?'<small class="lw-ref">Cancelled · nothing was charged</small>':''}</div>`); });
    l.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{ const ok=await confirmDialog({title:'Cancel this order?',message:'The shop has not accepted it yet, so it will be cancelled straight away.',ok:'Cancel order',cancel:'Keep it',danger:true,icon:GI.package}); if(!ok) return;
      try{ await api(`/orders/${b.dataset.cancel}/cancel`,{method:'POST'}); toast('Order cancelled'); routeRender(); }catch(e){ toast(e.message); } });
    l.querySelectorAll('[data-inv]').forEach(b=>b.onclick=()=>lwInvoice(byId[b.dataset.inv]));
    l.querySelectorAll('[data-rate]').forEach(s=>s.onclick=async e=>{ const n=Number(e.target.dataset.n); if(!n) return; s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',Number(x.dataset.n)<=n)); buzz(20);
      try{ await api(`/orders/${s.dataset.rate}/rate`,{method:'POST',body:{rating:n}}); const o=byId[s.dataset.rate]; o.rating=n; setTimeout(()=>{ s.outerHTML=`<span class="lw-rated">${'★'.repeat(n)}</span>`; toast('Thanks for rating!'); },400);
        if(n>=4) setTimeout(async()=>{ try{ openReview(await api('/businesses/'+o.business_id)); }catch(_){} },700); }catch(x){ toast(x.message); } }); };
  enhance(); new MutationObserver(enhance).observe($('#l'),{childList:true});
  seg.addEventListener('click',e=>{ const b=e.target.closest('[data-s]'); if(!b) return; const k=['on','past','book'].indexOf(b.dataset.s); seg.querySelector('i').style.transform=`translateX(${k*100}%)`;
    if(b.dataset.s!=='book') return; e.stopImmediatePropagation(); seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
    const bk=lwLS('ll_bookings',[]); const l=$('#l'); l.classList.remove('lv-tin'); void l.offsetWidth; l.classList.add('lv-tin');
    l.innerHTML=bk.length?bk.map((x,i)=>`<article class="lv-prow" style="--n:${i}"><span class="lv-oimg">${GI.calendar||I.bell}</span><div><b>${esc(x.svc)}</b><small>${esc(x.biz)}</small><small>${esc(x.day)} · ${esc(x.tm)} · <span class="lw-req">Requested</span></small></div><button class="lv-reo" data-bk="${x.bizId}">Contact</button></article>`).join('')
      :`<div class="lv-empty"><div class="lv-eill"><span class="lv-halo"></span>${GI.calendar||I.bell}</div><h2>No bookings yet</h2><p>Book electricians, plumbers, cleaning and more from local providers.</p><button class="lv-btn" id="bs">Find a service</button></div>`;
    const bs=$('#bs'); if(bs) bs.onclick=()=>go('category',{slug:'services'}); l.querySelectorAll('[data-bk]').forEach(x=>x.onclick=()=>go('business',{id:Number(x.dataset.bk)})); },true);
};
const _lvDone=SCREENS.orderDone;
SCREENS.orderDone=(el,p)=>{ _lvDone(el,p); if(p&&p.pickup){ const m=el.querySelector('.lv-dmsg'); if(m) m.innerHTML=`${esc(p.shop||'The shop')} will tell you when it's ready to collect${p.total?` · <b>${money(p.total)}</b>`:''}.`; } };

/* ═══════════════════════════════════════════════════════════════════════
   CUSTOMER APP — TEMPLATE BUILD (lx): screens rebuilt to match the
   "Customer App – Animated UI/UX" template, screen by screen.
   Delivery-time claims from the template are replaced by real data
   (distance from your area, opening hours, live order status).
   ═══════════════════════════════════════════════════════════════════════ */
GI.check=GI.check||'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
I.check=I.check||GI.check;
GI.pharmacy=GI.pharmacy||'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="7" width="12" height="14" rx="3"/><path d="M8 3h8v4H8zM12 11v6M9 14h6"/></svg>';
GI.gem=GI.gem||'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16 3-16"/></svg>';
function lxKm(b){ const a=(ref.areas||[]).find(x=>x.id==b.area_id), m=(ref.areas||[]).find(x=>x.id==state.areaId); if(!a||!m||a.lat==null||m.lat==null) return '';
  const R=6371, r=Math.PI/180, d=2*R*Math.asin(Math.sqrt(Math.sin((a.lat-m.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(m.lat*r)*Math.sin((a.lng-m.lng)*r/2)**2)); return d<0.6?'Nearby':d.toFixed(1)+' km'; }
const lxRate=(b)=>b.rating?`<span class="lx-rt">${I.star}<b>${Number(b.rating).toFixed(1)}</b>${b.review_count?`<small>(${b.review_count>=1000?(b.review_count/1000).toFixed(1)+'K':b.review_count})</small>`:''}</span>`:'<span class="lv-new">New</span>';
/* store + product cards (template style) */
lvStoreCard=function(b,i=0){ const cover=b.cover_url||pic(coverKw(b),b.id,600,400); const navr=b.source==='google'?'place':'business'; const km=lxKm(b);
  return `<button class="lx-scard" data-nav="${navr}" data-id="${b.id}" style="--n:${i}" aria-label="${esc(b.name)}"><span class="lx-sph">${photoLayer(cover)}${dIcon(b)}<span class="lv-heart ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}" role="button" aria-label="Save">${I.heart}</span></span>
    <span class="lx-sb"><b>${esc(b.name)}</b><span class="lx-sm">${lxRate(b)}${km?`<i>·</i><span>${km}</span>`:''}</span></span></button>`; };
lvProd=function(p,biz,i=0){ const src=p.image_url||pic((p.name||'product').toLowerCase(),500+(p.id||0)); const disc=p.mrp&&p.mrp>p.price; const pct=disc?Math.round((1-p.price/p.mrp)*100):0; const oos=p.stock_status==='out_of_stock';
  return `<div class="lx-pcard" data-nav="product" data-id="${p.id}" role="link" tabindex="0" style="--n:${i}"><span class="lx-pimg">${photoLayer(src)}${dIcon({name:p.name},'cart')}${disc?`<em class="lx-off">${pct}% OFF</em>`:''}</span>
    <b>${esc(p.name)}</b><small>${esc(p.unit||'1 unit')}</small><span class="lx-pp"><b>${money(p.price)}</b>${disc?`<s>${money(p.mrp)}</s>`:''}</span>
    <span class="lx-plus">${oos?'<span class="qc-oos">Out</span>':addCtl(p,src,biz)}</span></div>`; };

/* ---------- 1. SPLASH: logo reveal + wave reveal + neighbourhood ---------- */
function lxTown(){ return `<svg class="lx-town" viewBox="0 0 400 210" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <path class="w1" d="M0 70 C80 30 160 110 240 70 S360 40 400 60 V210 H0Z"/><path class="w2" d="M0 110 C90 70 170 150 260 110 S370 90 400 100 V210 H0Z"/>
  <g class="tn"><rect x="22" y="120" width="44" height="60" rx="3" fill="#2FB39A"/><path d="M16 122 L44 98 L72 122Z" fill="#E86A4A"/><rect x="36" y="150" width="14" height="30" fill="#0B4F47"/><rect x="28" y="132" width="10" height="10" fill="#FFE7A8"/><rect x="50" y="132" width="10" height="10" fill="#FFE7A8"/>
  <rect x="84" y="104" width="62" height="76" rx="3" fill="#F5F0E1"/><rect x="84" y="104" width="62" height="12" fill="#F2B84B"/><text x="115" y="114" font-size="8" font-weight="800" text-anchor="middle" fill="#7A4A00">STORE</text><rect x="92" y="126" width="20" height="16" fill="#9ED9CF"/><rect x="118" y="126" width="20" height="16" fill="#9ED9CF"/><rect x="104" y="150" width="20" height="30" fill="#0E7468"/>
  <circle cx="166" cy="150" r="20" fill="#1E9C7E"/><circle cx="178" cy="140" r="16" fill="#2DBA94"/><rect x="168" y="160" width="6" height="22" fill="#6B4A2B"/>
  <rect x="196" y="92" width="50" height="88" rx="3" fill="#E9F7F2"/><path d="M190 94 L221 70 L252 94Z" fill="#0E7468"/>${[0,1,2].map(r=>`<rect x="204" y="${104+r*18}" width="10" height="10" fill="#FFD86B"/><rect x="228" y="${104+r*18}" width="10" height="10" fill="#FFD86B"/>`).join('')}
  <rect x="264" y="118" width="52" height="62" rx="3" fill="#FCE3D3"/><path d="M258 120h64l-6 12h-52z" fill="#E86A4A"/><path d="M258 120h64l-6 12h-52z" fill="url(#lxaw)"/><rect x="280" y="148" width="18" height="32" fill="#0B4F47"/>
  <circle cx="338" cy="148" r="22" fill="#1E9C7E"/><circle cx="352" cy="160" r="16" fill="#2DBA94"/><rect x="340" y="164" width="6" height="18" fill="#6B4A2B"/>
  <defs><pattern id="lxaw" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="6" height="12" fill="#fff" opacity=".85"/></pattern></defs></g>
  <path class="w3" d="M0 172 C100 150 200 192 300 168 S380 160 400 166 V210 H0Z"/></svg>`; }
SCREENS.splash=(el)=>{
  el.innerHTML=`<div class="lx-splash"><div class="lx-spc"><div class="lx-glow"></div><div class="lx-logo">${logoMark(92)}</div><h1><span>Local</span> <span>Link</span></h1><p>Your Neighbourhood.<br>One Marketplace.</p></div>${lxTown()}</div>`;
  localStorage.setItem('ll_seen','1');
  if(!state.onboarded){ state.areaId=state.areaId||1; state.areaName=state.areaName||'Kunnamangalam'; state.onboarded=true; localStorage.setItem('ll_area',state.areaId); localStorage.setItem('ll_area_name',state.areaName); localStorage.setItem('ll_onboarded','1'); }
  setTimeout(()=>{ if(stack()[stack().length-1].name==='splash'){ nav.customer=[{name: state.introSeen?'home':'intro'}]; routeRender(); } },2100);
};

/* ---------- 2. ONBOARDING: animated illustrations & slide ---------- */
function lxShop(k){ const roof=['#E86A4A','#13A58F','#F2B84B'][k];
  return `<svg class="lx-shop" viewBox="0 0 260 200" aria-hidden="true"><ellipse cx="130" cy="186" rx="118" ry="12" fill="#DFF7EF"/>
   <circle class="tr1" cx="40" cy="132" r="28" fill="#2DBA94"/><circle class="tr1" cx="56" cy="114" r="22" fill="#1E9C7E"/><rect x="44" y="150" width="8" height="34" fill="#6B4A2B"/>
   <circle class="tr2" cx="222" cy="138" r="24" fill="#2DBA94"/><circle class="tr2" cx="210" cy="122" r="18" fill="#1E9C7E"/><rect x="216" y="152" width="7" height="32" fill="#6B4A2B"/>
   <rect x="74" y="80" width="112" height="104" rx="6" fill="#F7F3E8"/><path d="M64 84 L130 40 L196 84Z" fill="${roof}"/>
   <g class="aw"><path d="M68 84h124l-8 22H76z" fill="#E86A4A"/>${[0,1,2,3,4,5].map(i=>`<path d="M${76+i*18} 84h9l-2 22h-9z" fill="#fff"/>`).join('')}</g>
   <rect x="86" y="118" width="30" height="26" rx="3" fill="#9ED9CF"/><rect x="144" y="118" width="30" height="26" rx="3" fill="#9ED9CF"/><rect x="116" y="146" width="28" height="38" rx="3" fill="#0E7468"/>
   <rect x="100" y="56" width="60" height="16" rx="8" fill="#0E7468"/><text x="130" y="68" font-size="9" font-weight="800" text-anchor="middle" fill="#fff">LOCAL</text></svg>`; }
SCREENS.intro=(el)=>{
  const S=[{t:'Shop • Eat • Book •<br>Support Local',s:'Everything you need from nearby businesses, in one app.',f:[GI.bag||GI.cart,GI.fork||I.store,GI.package]},
           {t:'Discover Local<br>Businesses',s:'Shops, restaurants, services and local workers around you.',f:[I.pin,GI.percent,I.heart]},
           {t:'Just ask<br>Local Link',s:'Say what you need in English or Malayalam and we’ll find it nearby.',f:[GI.mic,GI.chat,I.star]}];
  let i=0,dir=1;
  const draw=()=>{ const s=S[i]; el.innerHTML=`<div class="lx-intro"><button class="lx-skipt" id="skip">Skip</button>
      <div class="lx-ill ${dir>0?'in-r':'in-l'}"><span class="lx-halo"></span>${lxShop(i)}<i class="f1">${s.f[0]}</i><i class="f2">${s.f[1]}</i><i class="f3">${s.f[2]}</i><span class="lx-rider">🛵</span></div>
      <div class="lx-itx ${dir>0?'in-r':'in-l'}"><h2>${s.t}</h2><p>${esc(s.s)}</p></div>
      <div class="lx-dots">${S.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
      ${i===S.length-1?`<div class="lw-lang"><small>Choose your language</small><div><button data-l="en" class="${state.lang==='en'?'on':''}">English</button><button data-l="ml" class="${state.lang==='ml'?'on':''}">മലയാളം</button></div></div>`:''}
      <button class="lx-btn" id="nx">${i===S.length-1?'Get Started':'Next'} <span>→</span></button></div>`;
    const fin=()=>{ state.introSeen=true; localStorage.setItem('ll_intro','1'); nav.customer=[{name: localStorage.getItem('ll_area_set')?'home':'location'}]; routeRender(); };
    $('#skip').onclick=fin; $('#nx').onclick=()=>{ if(i<S.length-1){ i++; dir=1; draw(); } else fin(); };
    el.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ state.lang=b.dataset.l; localStorage.setItem('ll_lang',state.lang); el.querySelectorAll('[data-l]').forEach(x=>x.classList.toggle('on',x===b)); buzz(); });
    let x0=null; const w=el.querySelector('.lx-intro'); w.addEventListener('touchstart',e=>x0=e.touches[0].clientX,{passive:true});
    w.addEventListener('touchend',e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0; x0=null; if(dx<-50&&i<S.length-1){ i++; dir=1; draw(); } else if(dx>50&&i>0){ i--; dir=-1; draw(); } },{passive:true}); };
  draw();
};

/* ---------- 3. LOCATION ACCESS: pin animation, Use My Location / Enter Manually ---------- */
const _lwLoc=SCREENS.location;
SCREENS.location=(el)=>{ _lwLoc(el); const w=el.querySelector('.lw-loc'); if(!w) return; w.classList.add('lx-loc');
  const bk=w.querySelector('#__back'); if(bk){ bk.innerHTML='×'; bk.classList.add('lx-x'); } else if(localStorage.getItem('ll_area_set')) { w.insertAdjacentHTML('afterbegin',`<button class="lv-ib lx-x" id="lxx" aria-label="Close">×</button>`); $('#lxx').onclick=back; }
  const or=w.querySelector('.lv-or'), sb=w.querySelector('.lw-sbox'), al=$('#al');
  or.outerHTML=`<button class="lx-btn ghost" id="man">Enter Manually</button>`; const man=$('#man');
  const box=document.createElement('div'); box.className='lx-man'; box.hidden=true; sb.before(box); box.append(sb,al);
  man.onclick=()=>{ box.hidden=false; man.hidden=true; box.classList.add('lv-tin'); setTimeout(()=>{ $('#af').focus(); box.scrollIntoView({behavior:'smooth'}); },60); };
  w.querySelector('#gps').innerHTML=`${I.dir} Use My Location`; };

/* ---------- 4. HOME ---------- */
SCREENS.home=async(el)=>{
  const nm=token&&me?me.name.split(' ')[0]:''; const cats=ref.categories||[];
  const Q=[['Shops','🛍️','category',{slug:'shopping'}],['Food','🍔','category',{slug:'food-grocery',vfilter:'food',vlabel:'Food & Restaurants'}],['Grocery','🛒','category',{slug:'food-grocery',vfilter:'grocery',vlabel:'Grocery'}],['Services','🛠️','category',{slug:'services'}],['More','✨','categories',{}]];
  el.innerHTML=`<header class="lx-head"><div class="lx-htop"><span class="lx-brand">${logoMark(30)}<b>Local</b><b>Link</b></span><span style="flex:1"></span>
      <button class="lx-hb" data-nav="notifications" aria-label="Notifications">${I.bell}<i></i></button><button class="lx-av" data-tabnav="account" aria-label="Account">${nm?esc(nm[0]):I.user}</button></div>
    <button class="lx-loc2" data-tabnav-loc>${I.pin}<b>${esc(state.areaName)}, Kozhikode</b>${I.chev.replace('m9 6 6 6-6 6','m6 9 6 6 6-6')}</button>
    <div class="lx-search"><button class="lx-stxt" data-nav="searchScreen">${I.search}<span id="rotsq">Search for shops, food, services…</span></button><button class="lx-mic" id="askHome" aria-label="Voice search">${GI.mic}</button></div>
    <nav class="lx-quick">${Q.map((q,k)=>`<button data-q="${k}" style="--n:${k}"><span>${q[1]}</span>${q[0]}</button>`).join('')}</nav></header>
  <div id="orderPill"></div>
  <section class="lx-sec"><div class="lx-bans" id="ban"><div class="sk" style="height:150px;flex:0 0 100%;border-radius:24px"></div></div><div class="lx-dots" id="bdots"></div></section>
  <section class="lx-sec"><div class="lv-sh"><h2>Near You</h2><button class="lv-see" data-nav="categories">See all ${I.chev}</button></div><div class="lv-rail" id="near">${skeletonCards(2)}</div></section>
  <section class="lx-sec lv-greet"><h2>${lvGreet()}${nm?`, ${esc(nm)}`:''} <span class="lv-wave">👋</span></h2><p>Discover local shops, food, services &amp; more around you.</p></section>
  <button class="lv-ask" data-talk><span class="lv-aorb">${GI.mic}</span><span><b>Just say what you need</b><small>Groceries, food, services or anything local</small></span><span class="lv-wv">${Array.from({length:7},(_,k)=>`<i style="--n:${k}"></i>`).join('')}</span></button>
  <section class="lx-sec"><div class="lv-sh"><h2>Local Deals</h2><span class="lv-cd" id="megacd">${gi('clock')} --:--:--</span></div><div class="lv-rail" id="deals">${skeletonCards(3)}</div></section>
  <section class="lx-sec" id="recent"></section>
  <section class="lx-sec"><div class="lv-sh"><h2>Recommended services</h2><button class="lv-see" data-nav="category" data-slug="services">See all ${I.chev}</button></div><div class="lv-list" id="lwSvc">${skeletonRow(2)}</div></section>
  <section class="lx-sec"><div class="lv-sh"><h2>Popular nearby stores</h2></div><div class="lv-list" id="pop">${skeletonRow(2)}</div></section>
  <button class="lw-comm" data-nav="community"><span class="lw-cav">${['A','R','S'].map(x=>`<i>${x}</i>`).join('')}</span><span><b>Your Neighbourhood</b><small>New shops, events, reviews &amp; local news</small></span>${I.chev}</button>
  <div style="height:24px"></div>`;
  el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ const q=Q[b.dataset.q]; buzz(); q[2]==='categories'?setTab('categories'):go(q[2],q[3]); });
  $('#askHome').onclick=()=>openAsk('',{voice:true}); el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>openAsk('',{voice:true}));
  el.querySelector('[data-tabnav-loc]').onclick=()=>go('location'); el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  const rot=$('#rotsq'); let ri=0; const rtm=setInterval(()=>{ if(!document.body.contains(rot)) return clearInterval(rtm); ri=(ri+1)%ROTATE.length; rot.textContent=ROTATE[ri]; rot.classList.remove('fx-swap'); void rot.offsetWidth; rot.classList.add('fx-swap'); },2600);
  if(token) api('/orders').then(os=>{ const live=(os||[]).find(o=>!['completed','rejected','cancelled'].includes(o.status)); const p=$('#orderPill'); if(!live||!p) return; const MSG={pending:'Waiting for the store',accepted:'Accepted by the store',preparing:'Being prepared',ready:'Ready',out_for_delivery:'On the way'};
    p.innerHTML=`<button class="lv-pill" id="opGo"><span class="lv-pdot"></span><span><b>${esc(live.business)}</b><small>${MSG[live.status]||live.status.replace(/_/g,' ')}</small></span><em>Track ${I.chev}</em></button>`; $('#opGo').onclick=()=>setTab('orders'); }).catch(()=>{});
  const [offers,biz,deals,places,sv]=await Promise.all([api('/offers'),api('/businesses?featured=1'),api('/products?deal=1&limit=10'),api('/places?area_id='+state.areaId).catch(()=>[]),api('/services').catch(()=>[])]);
  const best=offers.reduce((m,o)=>Math.max(m,lwPct(o.discount_label)),0);
  const B=[{brand:1}].concat(offers.slice(0,4)); const ban=$('#ban');
  ban.innerHTML=B.map((o,k)=>o.brand?`<button class="lx-ban b0" data-nav="offers"><span class="lx-bt"><b>Discover<br>Local Deals</b>${best?`<em>Up to ${best}% Off</em>`:'<em>See offers</em>'}</span><span class="lx-bag"><span class="lx-emo">🛍️</span></span></button>`
    :`<button class="lx-ban b${k%3}" data-nav="business" data-id="${o.business_id}"><span class="lx-bt"><small>${esc(o.business||'')}</small><b>${esc(o.title)}</b><em>${esc(o.discount_label||'Offer')}</em></span><span class="lx-bimg">${photoLayer(o.image_url||pic(coverKw({subcategory:o.business||''})+','+(o.title||''),700+(o.id||0),400,400))}${GI.percent}</span></button>`).join('');
  $('#bdots').innerHTML=B.map((_,k)=>`<i class="${k?'':'on'}"></i>`).join(''); lvCarousel(ban,$('#bdots'),3400);
  const near=[]; const seen=new Set(); (places||[]).concat(biz).forEach(b=>{ const k=(b.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); near.push(b); } }); near.sort((a,b)=>(b.is_open?1:0)-(a.is_open?1:0));
  $('#near').innerHTML=near.slice(0,10).map(lvStoreCard).join('');
  $('#deals').innerHTML=deals.slice(0,10).map((p,k)=>lvProd(p,null,k)).join(''); startCountdown();
  const rec=lwLS('ll_recent',[]); if(rec.length){ $('#recent').innerHTML=`<div class="lv-sh"><h2>Recently viewed</h2><button class="lv-see" id="rclr">Clear</button></div><div class="lv-rail">${rec.map(lvStoreCard).join('')}</div>`; $('#rclr').onclick=()=>{ lwSet('ll_recent',[]); $('#recent').innerHTML=''; }; }
  $('#pop').innerHTML=biz.slice().sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,4).map(lvStoreRow).join('');
  $('#lwSvc').innerHTML=sv.slice(0,3).map((s,i)=>`<div class="lv-srow" style="--n:${i}"><button class="lw-svcgo" data-nav="business" data-id="${s.business_id}"><span class="lv-rimg">${dIcon(s,'wrench')}</span><span class="lv-rt"><b>${esc(s.name)}</b><span class="lv-sm"><span>from <b>${money(s.starting_price)}</b>${s.business?' · '+esc(s.business):''}</span></span></span></button><button class="lv-req" data-svc="${esc(s.name)}" data-bid="${s.business_id}">Book</button></div>`).join('');
  el.querySelectorAll('.lv-req[data-svc]').forEach(b=>b.onclick=async()=>{ try{ lwBook(await api('/businesses/'+b.dataset.bid),b.dataset.svc); }catch(x){ toast(x.message); } });
};

/* ---------- 5. CATEGORIES: staggered tiles with photos ---------- */
SCREENS.categories=async(el)=>{
  const T=[['Grocery','category',{slug:'food-grocery',vfilter:'grocery',vlabel:'Grocery'},'vegetables basket grocery',0],['Food & Restaurants','category',{slug:'food-grocery',vfilter:'food',vlabel:'Food & Restaurants'},'burger fries food',1],
    ['Pharmacy','category',{slug:'healthcare'},'pharmacy medicine bottles',2],['Services','category',{slug:'services'},'tools hammer wrench',3],['Local Workers','category',{slug:'workers'},'construction helmet worker',4],['Fashion & Jewellery','category',{slug:'shopping'},'gold jewellery necklace',5],
    ['Transport','category',{slug:'transport'},'auto rickshaw taxi',0],['Local Info','localinfo',{},'town hall building',2],['Events','events',{},'festival lights event',1],['News','news',{},'newspaper',3]];
  el.innerHTML=`<header class="lx-bar"><button class="lv-ib" id="__back" aria-label="Back">${I.back}</button><h1>Categories</h1><button class="lv-ib" data-nav="searchScreen" aria-label="Search">${I.search}</button></header>
    <div class="lx-cgrid">${T.map((c,k)=>`<button class="lx-ctile c${c[4]}" data-k="${k}" style="--n:${k}"><span class="lx-cimg"><span class="lx-emo">${['🧺','🍔','💊','🛠️','👷','💍','🛺','🏛️','🎉','📰'][k]}</span></span><b>${esc(c[0])}</b></button>`).join('')}</div>
    <div class="lv-sh"><h2>Popular nearby stores</h2></div><div class="lv-list" id="pop">${skeletonRow(3)}</div><div style="height:16px"></div>`;
  const bk=$('#__back'); if(stack().length>1) bk.onclick=back; else bk.onclick=()=>setTab('home');
  el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ const c=T[b.dataset.k]; buzz(); go(c[1],c[2]); });
  const biz=await api('/businesses'); $('#pop').innerHTML=biz.slice().sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,6).map(lvStoreRow).join('');
};
SCREENS.explore=SCREENS.categories;

/* ---------- 6. STORE: image parallax + fade-up content ---------- */
SCREENS.business=async(el,{id})=>{
  el.innerHTML=`<div class="sk" style="height:250px"></div><div class="px" style="margin-top:14px">${skeletonRow(3)}</div>`;
  const b=await api(`/businesses/${id}`); track('shop_view',{id}); try{ lwRecent(b); }catch(e){}
  const wa=(b.whatsapp||'').replace(/[^0-9]/g,''); const cover=b.cover_url||pic(coverKw(b),b.id,900,560); const km=lxKm(b);
  const groups={}; b.products.forEach(p=>{ const g=lxGroup(p,b); (groups[g]=groups[g]||[]).push(p); }); const gk=Object.keys(groups);
  el.innerHTML=`<div class="lx-shero">${photoLayer(cover)}${dIcon(b)}<span class="lv-shade"></span>
      <div class="lv-hbar"><button class="lv-cb" id="bk" aria-label="Back">${I.back}</button><span style="flex:1"></span>
        <button class="lv-cb fav ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||'')}" data-fimg="${esc(cover)}" aria-label="Save store">${I.heart}</button>
        <button class="lv-cb" id="shareb" aria-label="Share">${I.share}</button></div></div>
    <section class="lx-scard2"><div class="lx-sid"><span class="lx-slogo">${photoLayer(cover)}${dIcon(b)}</span><div><h1>${esc(b.name)}</h1><p class="lx-sm">${lxRate(b)}<i>·</i><span>${esc(b.subcategory||b.category_name||'')}</span></p></div></div>
      <p class="lx-sm2"><span class="lv-open ${b.is_open?'on':''}">${b.is_open?'Open now':'Closed'}</span>${b.hours_label?`<span>${esc(b.hours_label.replace(/^Open until /,'until '))}</span>`:''}</p>
      <div class="lx-chips2">${km?`<span>${I.pin} ${km}</span>`:''}${b.area_name?`<span>${GI.building||I.store} ${esc(b.area_name)}</span>`:''}${b.can_order?`<span>${GI.package} Order online</span>`:''}</div>
      <div class="lx-acts"><button id="callb" aria-label="Call">${I.phone}<small>Call</small></button><button id="wab" aria-label="WhatsApp">${I.wa}<small>WhatsApp</small></button><a href="https://maps.google.com/?q=${encodeURIComponent(b.name+' '+(b.address||''))}" target="_blank" rel="noopener">${I.dir}<small>Directions</small></a>${b.can_chat?`<button id="chatbtn">${GI.chat}<small>Chat</small></button>`:`<button id="enqtop">${GI.megaphone}<small>Enquire</small></button>`}</div></section>
    ${b.offers.length?`<div class="lv-coupons">${b.offers.map(o=>`<div class="lv-coupon"><span>${GI.percent}</span><div><b>${esc(o.discount_label)}</b><small>${esc(o.title)}${o.code?' · '+esc(o.code):''}</small></div></div>`).join('')}</div>`:''}
    <nav class="lx-fchips" id="fc"><button class="on" data-g="">All</button>${gk.length>1?gk.map(g=>`<button data-g="${esc(g)}">${esc(g)}</button>`).join(''):''}${b.services.length?`<button data-t="services">Services</button>`:''}<button data-t="about">About</button><button data-t="reviews">Reviews ${b.reviews.length?`<small>${b.reviews.length}</small>`:''}</button></nav>
    <div id="tabbody" class="lx-tbody"></div><div style="height:24px"></div>`;
  $('#bk').onclick=back; $('#shareb').onclick=(e)=>{ e.preventDefault(); try{ navigator.share?navigator.share({title:b.name,url:location.href}).catch(()=>{}):toast('Link copied to share'); }catch(_){} };
  const chatb=$('#chatbtn'); if(chatb) chatb.onclick=()=>gateAction('chat with this store',()=>go('chat',{id:b.id,name:b.name}));
  const enqt=$('#enqtop'); if(enqt) enqt.onclick=()=>openEnquiry(b);
  $('#callb').onclick=()=>gateAction('call this business',()=>{ window.location.href='tel:'+b.phone; }); $('#wab').onclick=()=>gateAction('message this business on WhatsApp',()=>{ window.open('https://wa.me/'+wa,'_blank','noopener'); });
  const avg=b.reviews.length?b.reviews.reduce((a,r)=>a+(r.rating||0),0)/b.reviews.length:(b.rating||0); const bz={...b};
  const prods=(g)=>{ const l=g?groups[g]:b.products; if(!l.length) return b.services.length?body.services():`<p class="lv-empty-s">No items listed yet.</p>`;
    return g||gk.length<2 ? `<div class="lx-pgrid">${l.map((p,k)=>lvProd({...p,business:b.name,business_id:b.id},bz,k)).join('')}</div>`
      : gk.map(k=>`<div class="lv-sh"><h2>${esc(k)}</h2><button class="lv-see" data-gs="${esc(k)}">See all ${I.chev}</button></div><div class="lv-rail">${groups[k].map((p,i)=>lvProd({...p,business:b.name,business_id:b.id},bz,i)).join('')}</div>`).join(''); };
  const body={ services:()=>`<div class="lv-list">${b.services.map((sv,k)=>`<article class="lv-srow svc" style="--n:${k}"><span class="lv-rimg">${dIcon(sv,'wrench')}</span><span class="lv-rt"><b>${esc(sv.name)}</b><span class="lv-sm"><span>from <b>${money(sv.starting_price)}</b></span></span>${sv.description?`<small>${esc(sv.description)}</small>`:''}</span><button class="lv-req" data-svc="${esc(sv.name)}">Book</button></article>`).join('')}</div>`,
    about:()=>`<div class="lv-about"><p>${esc(b.description||'')}</p><div class="lv-info"><div><span>Category</span><b>${esc(b.category_name)}</b></div><div><span>Hours</span><b>${esc(b.hours_label||'')}</b></div><div><span>Address</span><b>${esc(b.address||'')}</b></div><div><span>Phone</span>${token?`<b>${esc(b.phone)}</b>`:`<button id="revealph">Log in to view</button>`}</div></div><button class="lv-btn" style="margin-top:16px" id="enqbtn">${t('enquire')}</button></div>`,
    reviews:()=>`<div class="lv-rsum"><div><b>${Number(avg).toFixed(1)}</b>${stars(avg)}<small>${b.reviews.length} review${b.reviews.length===1?'':'s'}</small></div><div class="lv-bars">${[5,4,3,2,1].map(n=>{ const c=b.reviews.filter(r=>Math.round(r.rating)===n).length; return `<p><span>${n}★</span><i style="--w:${b.reviews.length?Math.round(c/b.reviews.length*100):0}%"></i><span>${c}</span></p>`; }).join('')}</div></div>
      <button class="lv-btn ghost" id="addrev" style="margin:0 16px 12px;width:calc(100% - 32px)">${I.star} Write a review</button><div class="lv-list">${b.reviews.length?b.reviews.map(r=>`<div class="lv-rev"><div><b>${esc(r.author_name)}</b>${stars(r.rating)}</div><p>${esc(r.comment)}</p></div>`).join(''):`<p class="lv-empty-s">No reviews yet — be the first.</p>`}</div>` };
  const show=(html)=>{ const tb=$('#tabbody'); tb.classList.remove('lv-tin'); void tb.offsetWidth; tb.innerHTML=html; tb.classList.add('lv-tin'); wireTabBody(b); tb.querySelectorAll('[data-svc]').forEach(x=>x.onclick=()=>lwBook(b,x.dataset.svc));
    tb.querySelectorAll('[data-gs]').forEach(x=>x.onclick=()=>{ const c=$('#fc').querySelector(`[data-g="${CSS.escape(x.dataset.gs)}"]`); c&&c.click(); }); };
  show(b.products.length?prods(''):b.services.length?body.services():body.about());
  $('#fc').onclick=e=>{ const x=e.target.closest('button'); if(!x) return; $('#fc').querySelectorAll('button').forEach(y=>y.classList.toggle('on',y===x)); buzz(); x.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); show(x.dataset.t?body[x.dataset.t]():prods(x.dataset.g||'')); };
  const hero=el.querySelector('.lx-shero'); el.addEventListener('scroll',()=>hero.style.setProperty('--py',Math.min(1,el.scrollTop/250).toFixed(3)),{passive:true});
};
function lxGroup(p,b){ const n=(p.name||'').toLowerCase();
  const G=[['Fruits & Veg',/tomato|onion|potato|banana|apple|fruit|veg|carrot|leaf|spinach/],['Dairy & Eggs',/milk|curd|paneer|butter|ghee|egg|cheese/],['Snacks',/chips|biscuit|snack|namkeen|mixture/],['Bakery',/cake|bread|bun|puff|cookie/],['Biriyani & Mains',/biriyani|biryani|curry|meal|rice|chicken|mutton|fish|porotta|beef/],['Beverages',/juice|tea|coffee|shake|soda|water/]];
  for(const [g,re] of G) if(re.test(n)) return g; return b.subcategory||'More'; }

/* ---------- 7. PRODUCT: quantity + Add to Cart with bounce & ripple ---------- */
SCREENS.product=async(el,{id})=>{
  el.innerHTML=`<div class="sk" style="height:340px"></div>`;
  let p; try{ p=await api('/products/'+id); }catch(e){ el.innerHTML=`${lvHead('Product')}<p class="lv-empty-s">This product is unavailable.</p>`; backWire(el); return; }
  const src=p.image_url||pic((p.name||'product').toLowerCase(),500+(p.id||0),800,800); const disc=p.mrp&&p.mrp>p.price; const pct=disc?Math.round((1-p.price/p.mrp)*100):0; const oos=p.stock_status==='out_of_stock';
  const inCart=()=>cart.find(i=>i.id===p.id); let qty=inCart()?inCart().qty:1;
  el.innerHTML=`<div class="lx-phero">${photoLayer(src)}${dIcon({name:p.name},'cart')}<div class="lv-hbar"><button class="lv-cb" id="bk" aria-label="Back">${I.back}</button><span style="flex:1"></span><button class="lv-cb fav ${isSaved('product',p.id)?'on':''}" data-fav data-ftype="product" data-fid="${p.id}" data-fname="${esc(p.name)}" data-fprice="${p.price}" data-fimg="${esc(src)}" aria-label="Save">${I.heart}</button></div></div>
    <section class="lx-psheet"><h1>${esc(p.name)}</h1><p class="lx-unit">${esc(p.unit||'1 unit')}${p.rating?` · ${lxRate(p)}`:''}</p>
      <div class="lx-price"><b>${money(p.price)}</b>${disc?`<s>${money(p.mrp)}</s><em>${pct}% OFF</em>`:''}</div>
      ${p.description?`<p class="lx-desc">${esc(p.description)}</p>`:''}
      <div class="lx-perks"><div>${gi('pin')}<small>Local<br>Shop</small></div><div>${gi('shield')}<small>${oos?'Out of<br>Stock':'In<br>Stock'}</small></div><div>${gi('check')}<small>Quality<br>Checked</small></div></div>
      ${oos?`<button class="lx-btn" disabled>Out of stock</button>`:`<div class="lx-qty"><button id="qm" aria-label="Less">−</button><b id="qv">${qty}</b><button id="qp" aria-label="More">+</button></div><button class="lx-btn lx-add" id="atc">${GI.cart} <span id="atcl">${inCart()?'Update Cart':'Add to Cart'}</span></button>`}
      <button class="lv-sold" data-nav="business" data-id="${p.business_id}"><span>${GI.store}</span><div><small>Sold by</small><b>${esc(p.business)}</b></div>${I.chev}</button>
      <div id="related"></div><div style="height:24px"></div></section>`;
  $('#bk').onclick=back;
  if(!oos){ const qv=$('#qv'); const set=n=>{ qty=Math.max(1,Math.min(99,n)); qv.textContent=qty; qv.classList.remove('lw-tick'); void qv.offsetWidth; qv.classList.add('lw-tick'); buzz(); };
    $('#qm').onclick=()=>set(qty-1); $('#qp').onclick=()=>set(qty+1);
    $('#atc').onclick=async(e)=>{ const btn=$('#atc'); const r=btn.getBoundingClientRect(); const rip=document.createElement('span'); rip.className='cx-rip'; const d=r.width*1.2; rip.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px;color:#fff`; btn.appendChild(rip); setTimeout(()=>rip.remove(),600);
      const item={id:p.id,name:p.name,price:p.price,mrp:p.mrp,unit:p.unit,image:src,biz:p.business,bizId:p.business_id};
      const cur=inCart(); if(!cur){ const ok=await addToCart(item); if(!ok) return; } const c=inCart(); if(c){ c.qty=qty; saveCart(); updateCartBadge(); }
      btn.classList.remove('lx-bounce'); void btn.offsetWidth; btn.classList.add('lx-bounce'); $('#atcl').textContent='Added ✓'; buzz(25);
      const hi=el.querySelector('.lx-phero img.ph'); const f=document.createElement('div'); f.className='cx-fly'; f.style.backgroundImage=`url("${src}")`; f.style.left=(r.left+r.width/2-22)+'px'; f.style.top=(r.top-10)+'px'; document.body.appendChild(f);
      setTimeout(()=>{ const t=document.querySelector('#qcCartBar:not([hidden]) .qc-cartbar'); const tr=t?t.getBoundingClientRect():{left:r.left,top:r.top-120,height:40}; requestAnimationFrame(()=>{ f.style.transform=`translate(${tr.left+30-(r.left+r.width/2)}px,${tr.top+tr.height/2-r.top}px) scale(.35)`; f.style.opacity=.3; }); setTimeout(()=>{ f.remove(); t&&(t.classList.remove('cx-bump'),void t.offsetWidth,t.classList.add('cx-bump')); },560); },80);
      setTimeout(()=>{ const l=$('#atcl'); if(l) l.textContent='Update Cart'; },1600); }; }
  if(p.related&&p.related.length) $('#related').innerHTML=`<div class="lv-sh flush"><h2>You may also like</h2></div><div class="lv-rail flush">${p.related.map((r,k)=>lvProd(r,null,k)).join('')}</div>`;
  const hero=el.querySelector('.lx-phero'); el.addEventListener('scroll',()=>hero.style.setProperty('--py',Math.min(1,el.scrollTop/320).toFixed(3)),{passive:true});
};

/* ---------- 8. CART: slide-up panel + floating badge ---------- */
const _lvCart=SCREENS.cart;
SCREENS.cart=async(el)=>{ await _lvCart(el); if(!cart.length) return;
  const save=cart.reduce((t,i)=>t+(i.mrp&&i.mrp>i.price?(i.mrp-i.price)*i.qty:0),0); const sub=cartTotal(), del=sub>=499?0:29;
  const fb=el.querySelector('.lv-fbar'); if(!fb) return;
  fb.className='lx-panel'; fb.innerHTML=`<div class="lx-pr"><div>${save>0?`<small class="lx-sv">You saved ${money(save)}</small>`:''}<small>Total</small></div><b>${money(sub+del)}</b></div><button class="lx-btn" id="checkout">Proceed to Checkout <span>→</span></button>`;
  $('#checkout').onclick=()=>{ track('checkout_start'); gateAction('place your order',()=>go('checkout')); };
  el.querySelectorAll('.lv-line').forEach(l=>{ const s=l.querySelector('.lv-step'); if(s) s.classList.add('lx-step'); });
  const cb=el.querySelector('.lv-cbag'); if(cb) cb.classList.add('lx-float'); };

/* ---------- 9. CHECKOUT: step progress, deliver-to + fulfilment rows ---------- */
const _lwChk=SCREENS.checkout;
SCREENS.checkout=async(el)=>{ await _lwChk(el); const ar=$('#addrRow'); if(!ar) return;
  const ful=$('#ful'); const card=document.createElement('section'); card.className='lx-ccard';
  ar.before(card); card.append(ar);
  const frow=document.createElement('div'); frow.className='lx-frow'; frow.innerHTML=`<span class="lv-ri">${gi('clock')}</span><div><small>Fulfilment</small><b id="flab">Delivery to your address</b></div>`; card.append(frow); frow.after(ful);
  ful.addEventListener('click',()=>setTimeout(()=>{ const pk=ful.classList.contains('r'); $('#flab').textContent=pk?'Pickup from the shop':'Delivery to your address'; },20));
  const sm=ar.querySelector('small'); if(sm) sm.textContent='Deliver to';
};

/* ---------- 10. ORDER TRACKING: vertical timeline + live map ---------- */
const _lwOrders=SCREENS.orders;
SCREENS.orders=async(el,p)=>{ await _lwOrders(el,p);
  const os=await api('/orders').catch(()=>[]); const byId=Object.fromEntries(os.map(o=>[o.id,o]));
  const tm=s=>{ const d=new Date((s||'').replace(' ','T')+'Z'); return isNaN(d)?'':d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}); };
  const STEPS=[['pending','Order Placed'],['accepted','Accepted by shop'],['preparing','Preparing'],['out_for_delivery','Out for Delivery'],['completed','Delivered']];
  const idx=s=>({pending:0,accepted:1,preparing:2,ready:2,out_for_delivery:3,completed:4})[s]??0;
  const HEAD={pending:'Waiting for the store',accepted:'Accepted by the shop',preparing:'Being prepared',ready:'Ready for you',out_for_delivery:'On the way'};
  const up=()=>{ document.querySelectorAll('.lv-ocard:not([data-lx])').forEach(c=>{ c.dataset.lx=1; const id=Number((c.querySelector('.lv-ohead b').textContent.match(/\d+/)||[0])[0])-10000; const o=byId[id]; if(!o) return; const k=idx(o.status); const pick=o.fulfilment==='pickup';
      const msg=c.querySelector('.lv-omsg'); msg.outerHTML=`<div class="lx-arr"><div><small>${pick?'Pickup order':'Order status'}</small><b>${esc(HEAD[o.status]||o.status.replace(/_/g,' '))}</b></div><span class="lx-scoot">${pick?'🛍️':'🛵'}</span></div>`;
      const tr=c.querySelector('.lv-track'); tr.outerHTML=`<ol class="lx-tl" style="--k:${k}">${STEPS.filter((s,x)=>!(pick&&x===3)).map((s,x)=>{ const xi=STEPS.indexOf(s); return `<li class="${xi<k?'done':xi===k?'on':''}" style="--n:${x}"><i>${xi<k||xi===k&&k===4?(I.check||'✓'):''}</i><div><b>${pick&&xi===4?'Collected':s[1]}</b><small>${xi===0?tm(o.created_at):xi===k?'Now':''}</small></div></li>`; }).join('')}</ol>`;
      const rb=c.querySelector('[data-chat]'); if(rb) rb.innerHTML=`${GI.chat} Chat with Shop`; const cm=c.querySelector('.lv-oacts .ghost'); if(cm) cm.innerHTML=`${I.phone} Call Shop`; }); };
  up(); const l=$('#l'); if(l) new MutationObserver(up).observe(l,{childList:true}); };

/* ---------- 11. AI ASSISTANT: orb with waveform, keyboard toggle ---------- */
const _lwAsk=SCREENS.assistant;
SCREENS.assistant=(el,p)=>{ _lwAsk(el,p); const z=$('#orbz'), inp=el.querySelector('.lw-in'); if(!z||!inp) return;
  z.innerHTML=`<span class="lx-wl">${Array.from({length:9},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</span>`+z.innerHTML+`<span class="lx-wl r">${Array.from({length:9},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</span><button class="lx-kb" id="kb" aria-label="Type instead">⌨</button>`;
  $('#orb').onclick=()=>$('#amic').click(); inp.classList.add('lx-hide');
  $('#kb').onclick=()=>{ inp.classList.toggle('lx-hide'); if(!inp.classList.contains('lx-hide')) setTimeout(()=>$('#aq').focus(),50); };
  if(p&&p.q) inp.classList.remove('lx-hide'); };

/* ---------- bottom nav: Home · Explore · Ask · Orders · Account ---------- */
const _lxRBN=renderBottomNav;
renderBottomNav=function(){ _lxRBN(); const n=document.querySelector('.lvdock'); if(!n) return; const c=n.querySelector('[data-tabnav="categories"] span:last-child'); if(c) c.textContent='Explore'; };

/* ═══════════════════════════════════════════════════════════════════════
   CUSTOMER APP — VOICEBITE PORT (vbx): VoiceBite's type, motion, carousel,
   header, search, moods, category row, atmosphere and nav, in Local Link teal.
   ═══════════════════════════════════════════════════════════════════════ */
function vbxAtmo(){ const ph=document.querySelector('.phone'); if(!ph||ph.querySelector('.vbx-atmo')||state.view!=='customer') return;
  const a=document.createElement('div'); a.className='vbx-atmo'; a.setAttribute('aria-hidden','true');
  a.innerHTML='<i></i><i></i><i></i>'+['🛒','🍛','🛠️','💊','🧺','🛍️','☕','🌿'].map((e,k)=>`<b class="vbx-fl" style="--x:${8+k*12}%;--d:${14+k%4*3}s;--dl:${-k*2.3}s;--s:${.8+(k%3)*.25}">${e}</b>`).join('');
  ph.prepend(a); }
const vbxGreet=()=>{ const h=new Date().getHours(); return h<5?['Late night','🌙']:h<11?['Good morning','☀️']:h<15?['Lunch o’clock','☀️']:h<18?['Good afternoon','🌤️']:h<22?['Good evening','🌆']:['Late night','🌙']; };
SCREENS.home=async(el)=>{
  vbxAtmo(); const nm=token&&me?me.name.split(' ')[0]:''; const [g,gi2]=vbxGreet();
  const M=[['🍛','Biriyani','biriyani'],['🥦','Fresh veggies','vegetables'],['❄️','Fix my AC','AC repair'],['💊','Medicines','pharmacy'],['🎂','Cakes','cake'],['💍','Gold & gifts','gold necklace'],['🛺','Need a ride','auto']];
  const C=[['🧺','Grocery','category',{slug:'food-grocery',vfilter:'grocery',vlabel:'Grocery'}],['🍔','Food','category',{slug:'food-grocery',vfilter:'food',vlabel:'Food & Restaurants'}],['🛍️','Shopping','category',{slug:'shopping'}],['🛠️','Services','category',{slug:'services'}],['👷','Workers','category',{slug:'workers'}],['💊','Health','category',{slug:'healthcare'}],['🛺','Rides','category',{slug:'transport'}],['✨','All','categories',{}]];
  el.innerHTML=`<header class="vbx-hd">
      <div class="vbx-row"><span class="vbx-brand">${logoMark(30)}<b>Local</b><b>Link</b></span><span class="vbx-tag">Shop it · Local it</span></div>
      <div class="vbx-row"><button class="vbx-loc" data-tabnav-loc><span class="vbx-lico">${I.pin}</span><span><small>Delivering in <em class="vbx-open">Open now</em></small><b>${esc(state.areaName)}, Kozhikode</b></span></button>
        <button class="vbx-lang" id="lng" aria-label="Language">${state.lang==='ml'?'EN':'മ'}</button><button class="vbx-lang" data-nav="notifications" aria-label="Notifications">${I.bell}</button></div>
      <div class="vbx-srch"><button class="vbx-stxt" data-nav="searchScreen">${I.search}<span id="rotsq">Try “biriyani near me”</span></button><button class="vbx-mic" id="askHome" aria-label="Ask by voice"><span class="w"></span><span class="w w2"></span>${GI.mic}</button></div></header>
    <div id="orderPill"></div>
    <section class="vbx-sec"><div class="vbx-promos" id="pr"><div class="sk" style="height:170px;flex:0 0 92%;border-radius:22px"></div></div><div class="vbx-dots" id="pd"></div></section>
    <section class="vbx-sec vbx-greet"><h2>${esc(nm?g+', '+nm:g)} <span class="vbx-sun">${gi2}</span></h2><p>Say it, get it — from shops around you.</p>
      <div class="vbx-moods">${M.map((m,k)=>`<button data-m="${esc(m[2])}" style="--n:${k}"><i>${m[0]}</i>${esc(m[1])}</button>`).join('')}</div></section>
    <section class="vbx-sec"><div class="vbx-sh"><h2>Categories</h2><button class="vbx-see" data-nav="categories">See all →</button></div>
      <div class="vbx-cats">${C.map((c,k)=>`<button data-c="${k}" style="--n:${k}"><span class="vbx-cpic c${k%4}"><b>${c[0]}</b></span>${esc(c[1])}</button>`).join('')}</div></section>
    <section class="vbx-sec"><div class="vbx-sh"><h2>Popular near you</h2><button class="vbx-see" data-nav="categories">See all →</button></div><div class="lv-rail" id="near">${skeletonCards(2)}</div></section>
    <button class="lv-ask vbx-ask" data-talk><span class="lv-aorb">${GI.mic}</span><span><b>Just say it</b><small>“Two biriyani and a plumber tomorrow”</small></span><span class="lv-wv">${Array.from({length:7},(_,k)=>`<i style="--n:${k}"></i>`).join('')}</span></button>
    <section class="vbx-sec"><div class="vbx-sh"><h2>Local deals</h2><span class="lv-cd" id="megacd">${gi('clock')} --:--:--</span></div><div class="lv-rail" id="deals">${skeletonCards(3)}</div></section>
    <section class="vbx-sec" id="recent"></section>
    <section class="vbx-sec"><div class="vbx-sh"><h2>Book a service</h2><button class="vbx-see" data-nav="category" data-slug="services">See all →</button></div><div class="lv-list" id="lwSvc">${skeletonRow(2)}</div></section>
    <section class="vbx-sec"><div class="vbx-sh"><h2>Top rated stores</h2></div><div class="lv-list" id="pop">${skeletonRow(2)}</div></section>
    <button class="lw-comm" data-nav="community"><span class="lw-cav">${['A','R','S'].map(x=>`<i>${x}</i>`).join('')}</span><span><b>Your Neighbourhood</b><small>New shops, events, reviews &amp; local news</small></span>${I.chev}</button><div style="height:24px"></div>`;
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ buzz(); openAsk(b.dataset.m,{}); });
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ const c=C[b.dataset.c]; buzz(); c[2]==='categories'?setTab('categories'):go(c[2],c[3]); });
  $('#lng').onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  $('#askHome').onclick=()=>openAsk('',{voice:true}); el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>openAsk('',{voice:true}));
  el.querySelector('[data-tabnav-loc]').onclick=()=>go('location');
  const RT=['Try “biriyani near me”','Try “plumber tomorrow”','Try “fresh fish”','Try “AC repair”','Try “gold necklace”','Try “cake for 10”'];
  const rot=$('#rotsq'); let ri=0; const rtm=setInterval(()=>{ if(!document.body.contains(rot)) return clearInterval(rtm); ri=(ri+1)%RT.length; rot.textContent=RT[ri]; rot.classList.remove('vbx-swap'); void rot.offsetWidth; rot.classList.add('vbx-swap'); },2600);
  if(token) api('/orders').then(os=>{ const live=(os||[]).find(o=>!['completed','rejected','cancelled'].includes(o.status)); const p=$('#orderPill'); if(!live||!p) return; const MSG={pending:'Waiting for the store',accepted:'Accepted by the store',preparing:'Being prepared',ready:'Ready',out_for_delivery:'On the way'};
    p.innerHTML=`<button class="lv-pill" id="opGo"><span class="lv-pdot"></span><span><b>${esc(live.business)}</b><small>${MSG[live.status]||live.status.replace(/_/g,' ')}</small></span><em>Track ${I.chev}</em></button>`; $('#opGo').onclick=()=>setTab('orders'); }).catch(()=>{});
  const [offers,biz,deals,places,sv]=await Promise.all([api('/offers'),api('/businesses?featured=1'),api('/products?deal=1&limit=10'),api('/places?area_id='+state.areaId).catch(()=>[]),api('/services').catch(()=>[])]);
  const best=offers.reduce((m,o)=>Math.max(m,lwPct(o.discount_label)),0);
  const P=[{k:'voice',tag:'Talk to order',h:'Just say<br>what you need',ch:['English','മലയാളം'],cta:'Start talking',emo:'🎙️',go:()=>openAsk('',{voice:true})},
           {k:'deals',tag:'Local deals',h:`Up to ${best||20}% off<br>near you`,ch:[`${offers.length} live offers`],cta:'See offers',emo:'🛍️',go:()=>go('offers')}]
    .concat(offers.slice(0,3).map(o=>({k:'o',tag:o.business||'Offer',h:esc(o.title),ch:[o.discount_label,o.code?'Code '+o.code:'In store'].filter(Boolean),cta:'Order now',img:o.image_url||pic(coverKw({subcategory:o.business||''})+','+(o.title||''),700+(o.id||0),400,400),go:()=>go('business',{id:o.business_id})})))
    .concat([{k:'book',tag:'Home services',h:'Book a pro<br>in two taps',ch:['Electricians','Plumbers','Cleaning'],cta:'Book now',emo:'🛠️',go:()=>go('category',{slug:'services'})}]);
  const pr=$('#pr'); pr.innerHTML=P.map((x,k)=>`<button class="vbx-promo t${k%4}" data-p="${k}"><span class="vbx-ptag">${esc(x.tag)}</span><h3>${x.h}</h3><span class="vbx-pch">${x.ch.map(c=>`<i>${esc(c)}</i>`).join('')}</span><span class="vbx-cta">${esc(x.cta)} <b>→</b></span>
      <span class="vbx-deco">${x.img?photoLayer(x.img):''}${x.emo?`<em>${x.emo}</em>`:'<em>🏷️</em>'}</span>${x.k==='voice'?`<span class="vbx-pwave">${Array.from({length:9},(_,i)=>`<i style="--n:${i}"></i>`).join('')}</span>`:''}</button>`).join('');
  pr.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ buzz(); P[b.dataset.p].go(); });
  $('#pd').innerHTML=P.map((_,k)=>`<i class="${k?'':'on'}"></i>`).join(''); lvCarousel(pr,$('#pd'),4000);
  const near=[]; const seen=new Set(); (places||[]).concat(biz).forEach(b=>{ const k=(b.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); near.push(b); } }); near.sort((a,b)=>(b.is_open?1:0)-(a.is_open?1:0));
  $('#near').innerHTML=near.slice(0,10).map(lvStoreCard).join('');
  $('#deals').innerHTML=deals.slice(0,10).map((p,k)=>lvProd(p,null,k)).join(''); startCountdown();
  const rec=lwLS('ll_recent',[]); if(rec.length){ $('#recent').innerHTML=`<div class="vbx-sh"><h2>Recently viewed</h2><button class="vbx-see" id="rclr">Clear</button></div><div class="lv-rail">${rec.map(lvStoreCard).join('')}</div>`; $('#rclr').onclick=()=>{ lwSet('ll_recent',[]); $('#recent').innerHTML=''; }; }
  $('#pop').innerHTML=biz.slice().sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,4).map(lvStoreRow).join('');
  $('#lwSvc').innerHTML=sv.slice(0,3).map((s,i)=>`<div class="lv-srow" style="--n:${i}"><button class="lw-svcgo" data-nav="business" data-id="${s.business_id}"><span class="lv-rimg">${dIcon(s,'wrench')}</span><span class="lv-rt"><b>${esc(s.name)}</b><span class="lv-sm"><span>from <b>${money(s.starting_price)}</b>${s.business?' · '+esc(s.business):''}</span></span></span></button><button class="lv-req" data-svc="${esc(s.name)}" data-bid="${s.business_id}">Book</button></div>`).join('');
  el.querySelectorAll('.lv-req[data-svc]').forEach(b=>b.onclick=async()=>{ try{ lwBook(await api('/businesses/'+b.dataset.bid),b.dataset.svc); }catch(x){ toast(x.message); } });
};
/* images fade + scale in when they load (VoiceBite .pic img.in) — photoLayer already adds .on */
/* atmosphere on every customer screen, header shrink, nav blob */
const _vbxRBN=renderBottomNav;
renderBottomNav=function(){ _vbxRBN(); if(state.view!=='customer') return; vbxAtmo(); const n=document.querySelector('.lvdock'); if(n) n.classList.add('vbx-nav'); };

/* ================= CUSTOMER MOTION LAYER ================= */
const CX_TABS=['home','categories','orders','account'];
let cxIndX=null;
function cxMotion(screen){
  if(state.view!=='customer') return;
  // 1. scroll reveal
  const rv=screen.querySelectorAll('.lv-sec,.lv-srow,.lv-ocard,.lv-prow,.lv-menu,.lv-bill,.lv-ask,.lv-sh,.lv-pays,.lv-row');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }),{root:screen,rootMargin:'0px 0px -6% 0px'});
    rv.forEach((n,i)=>{ n.classList.add('rv'); n.style.setProperty('--rd',(i%4)*60+'ms'); io.observe(n); });
  }
  // 2. depth on horizontal rails
  screen.querySelectorAll('.lv-banners,.lx-bans,.vbx-promos,.vbx-cats,.vbx-moods,.lv-rail,.lv-cmini').forEach(r=>{
    if(r.__d) return; r.__d=1;
    const f=()=>{ const rb=r.getBoundingClientRect(), c=rb.left+rb.width/2;
      [...r.children].forEach(ch=>{ const b=ch.getBoundingClientRect(); const d=Math.max(-1,Math.min(1,((b.left+b.width/2)-c)/rb.width)); ch.style.setProperty('--d',d.toFixed(3)); }); };
    r.addEventListener('scroll',()=>requestAnimationFrame(f),{passive:true}); setTimeout(f,60); new MutationObserver(()=>setTimeout(f,30)).observe(r,{childList:true});
  });
  // 3. home: compact sticky bar once the hero scrolls away
  const hero=screen.querySelector('.lv-head,.lx-head');
  if(hero && !screen.querySelector('.cx-mini')){
    const mini=document.createElement('div'); mini.className='cx-mini';
    mini.innerHTML=`<span class="cx-mlogo">${logoMark(26)}</span><button class="cx-msearch" aria-label="Search">${I.search||''}<span>Search shops, food, services…</span></button><button class="cx-mmic" aria-label="Ask by voice">${GI.mic}</button>`;
    screen.prepend(mini);
    mini.querySelector('.cx-msearch').onclick=()=>{ const t=screen.querySelector('.vbx-stxt,.lx-stxt,.lv-stxt'); t?t.click():go('search'); };
    mini.querySelector('.cx-mmic').onclick=()=>{ const m=screen.querySelector('#askHome'); m&&m.click(); };
    const onS=()=>{ const y=screen.scrollTop, h=hero.offsetHeight; hero.style.setProperty('--hs',Math.min(1,y/h).toFixed(3)); mini.classList.toggle('on',y>h-40); };
    screen.addEventListener('scroll',()=>requestAnimationFrame(onS),{passive:true});
  }
  cxDockInd();
}
function cxDockInd(){
  const nav=document.querySelector('.lvdock'); if(!nav) return;
  const on=nav.querySelector('.vtab.on'); let ind=nav.querySelector('.cx-ind');
  if(!ind){ ind=document.createElement('i'); ind.className='cx-ind'; nav.prepend(ind); }
  if(!on){ ind.style.opacity=0; return; }
  const x=on.offsetLeft+on.offsetWidth/2-30;
  ind.style.transition='none'; ind.style.transform=`translateX(${cxIndX==null?x:cxIndX}px)`; void ind.offsetWidth;
  ind.style.transition=''; ind.style.opacity=1; ind.style.transform=`translateX(${x}px)`; cxIndX=x;
}
// tap ripple + light haptic, fly-to-cart, edge-swipe back, swipe between tabs
(function(){
  document.addEventListener('pointerdown',e=>{
    if(state.view!=='customer') return;
    const b=e.target.closest('.vbx-promo,.vbx-moods button,.vbx-cats button,.lx-ctile,.lx-scard,.lx-quick button,.lx-fchips button,.lx-acts > *,.lv-ctile,.lv-scard,.lv-srow,.lv-ban,.lv-menu > *,.lv-pay,.lv-chips button,.lv-btn,.lv-tabs button,.vtab,.qc-add,.lv-reo,.lv-ask,.lv-row,.lv-cmini button');
    if(!b) return; const r=b.getBoundingClientRect(); const s=document.createElement('span'); s.className='cx-rip';
    const d=Math.max(r.width,r.height)*1.2; s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
    if(getComputedStyle(b).position==='static') b.style.position='relative'; b.style.overflow='hidden'; b.appendChild(s); setTimeout(()=>s.remove(),600);
  },{passive:true});
  document.addEventListener('click',e=>{
    if(state.view!=='customer') return;
    const a=e.target.closest('.qc-add[data-add]'); if(!a) return;
    try{ navigator.vibrate&&navigator.vibrate(12); }catch(_){}
    const card=a.closest('.lx-pcard,.lv-pcard,.qc-card,article,.lv-pbar'); const src=(card&&card.querySelector('.pimg,img'))||a;
    const r=src.getBoundingClientRect(); setTimeout(()=>{
      const t=document.querySelector('#qcCartBar:not([hidden]) .qc-cartbar, .lvdock [data-tabnav="orders"]'); if(!t) return;
      const tr=t.getBoundingClientRect(); const f=document.createElement('div'); f.className='cx-fly';
      const img=card&&card.querySelector('img'); if(img) f.style.backgroundImage=`url("${img.src}")`;
      f.style.left=(r.left+r.width/2-22)+'px'; f.style.top=(r.top+r.height/2-22)+'px'; document.body.appendChild(f);
      requestAnimationFrame(()=>{ f.style.transform=`translate(${tr.left+30-(r.left+r.width/2)}px,${tr.top+tr.height/2-(r.top+r.height/2)}px) scale(.35)`; f.style.opacity=.3; });
      setTimeout(()=>{ f.remove(); t.classList.remove('cx-bump'); void t.offsetWidth; t.classList.add('cx-bump'); },560);
    },60);
  },true);
  let sx=null, sy=0, edge=false, inRail=false;
  document.addEventListener('touchstart',e=>{ if(state.view!=='customer') return; const t=e.touches[0]; sx=t.clientX; sy=t.clientY;
    const ph=document.querySelector('.phone'); const pl=ph?ph.getBoundingClientRect().left:0; edge=(sx-pl)<24;
    inRail=!!e.target.closest('.vbx-promos,.vbx-cats,.vbx-moods,.lx-bans,.lx-fchips,.lv-banners,.lv-rail,.lv-tabs,.lv-chips,.lv-cmini,.lv-utabs,.pt-kpis,input,textarea,.sheet,[data-noswipe]'); },{passive:true});
  document.addEventListener('touchend',e=>{ if(sx===null||state.view!=='customer') return; const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; sx=null;
    if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*.6) return;
    const cur=(stack()[stack().length-1]||{}).name;
    if(edge && dx>0 && stack().length>1){ back(); return; }
    if(inRail||document.querySelector('.sheet')) return;
    const i=CX_TABS.indexOf(cur); if(i<0||stack().length>1) return;
    const n=i+(dx<0?1:-1); if(n>=0&&n<CX_TABS.length){ setTab(CX_TABS[n]); }
  },{passive:true});
})();

boot();
})();

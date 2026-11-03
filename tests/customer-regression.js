const { chromium, devices } = require('playwright');
const B=process.env.BASE_URL||'http://localhost:3000'; const out=[]; let step='start'; const shots=[];
const log=(t,m)=>{ out.push(`[${step}] ${t}: ${m}`); };
(async()=>{
  const br=await chromium.launch(); const ctx=await br.newContext({...devices['Pixel 7'], geolocation:{latitude:11.30,longitude:75.88}, permissions:['geolocation']});
  const p=await ctx.newPage();
  p.on('pageerror',e=>log('PAGEERROR',e.message));
  p.on('console',m=>{ if(m.type()==='error') log('CONSOLE',m.text().slice(0,200)); });
  p.on('response',r=>{ if(r.url().includes('/api/')&&r.status()>=400) log('HTTP '+r.status(),r.request().method()+' '+r.url().replace(B,'')); });
  p.on('dialog',d=>{ log('DIALOG',d.message()); d.dismiss(); });
  const S=async(n)=>{ await p.waitForTimeout(500); await p.screenshot({path:`s_${String(shots.length).padStart(2,'0')}_${n}.png`}); shots.push(n); };
  const T=async(name,fn)=>{ step=name; try{ await fn(); }catch(e){ log('FAIL',e.message.split('\n')[0]); await S('FAIL_'+name).catch(()=>{}); } };
  const c=async(sel,o={})=>{ await p.locator(sel).first().click({timeout:5000,...o}); await p.waitForTimeout(o.w||900); };
  const vis=async(sel,msg)=>{ if(!(await p.locator(sel).first().isVisible().catch(()=>false))) log('MISSING',msg||sel); };
  const txt=async(sel)=>(await p.locator(sel).first().textContent({timeout:3000}).catch(()=>''))||'';

  await T('splash',async()=>{ await p.goto(B); await p.waitForTimeout(600); await S('splash'); await p.waitForTimeout(2000); await S('after_splash'); });
  await T('intro',async()=>{ await vis('.lx-intro','onboarding'); await c('#nx'); await c('#nx'); await vis('.lw-lang','language picker'); await S('intro3'); await c('#nx',{w:1500}); await S('after_intro'); });
  await T('location',async()=>{ await vis('.lw-loc','location screen'); await c('#man'); await p.fill('#af','kunna'); await p.waitForTimeout(400); await S('loc_search'); await c('#al [data-area]',{w:2500}); await S('home'); });
  await T('home',async()=>{ await vis('.lx-head','home header'); await vis('.lx-ban','banners'); await vis('.lx-scard','near stores'); await vis('.lx-pcard','deals'); await c('.lx-quick button',{w:1500}); await S('quick_shops'); await c('#__back',{w:1200});
    
    await p.locator('#screen').evaluate(e=>e.scrollTo(0,900)); await p.waitForTimeout(900); await S('home_scrolled'); await vis('.cx-mini.on','compact sticky bar');
    await p.locator('#screen').evaluate(e=>e.scrollTo(0,2400)); await p.waitForTimeout(900); await S('home_bottom'); await p.locator('#screen').evaluate(e=>e.scrollTo(0,0)); });
  await T('search',async()=>{ await c('.lx-stxt',{w:1200}); await vis('#sq','search input'); await p.fill('#sq','biriyani'); await p.waitForTimeout(1500); await S('search_results'); await vis('.lv-srow, .lv-pcard','search results');
    await p.fill('#sq','zzzzqqq'); await p.waitForTimeout(1200); await S('search_empty'); await p.fill('#sq',''); await p.waitForTimeout(600); await vis('.lw-recent','recent searches'); await c('#__back'); });
  await T('store',async()=>{ await c('.lx-scard',{w:2000}); await S('store'); await vis('.lx-scard2','store card'); await vis('#fc','filter chips');
    const tabs=p.locator('#tabs button'); const n=await tabs.count(); for(let i=n-1;i>=0;i--){ await tabs.nth(i).click(); await p.waitForTimeout(500); } await S('store_tabs');
    const add=p.locator('#tabbody .qc-add'); if(await add.count()){ await add.first().click(); await p.waitForTimeout(1200); await S('store_added'); await vis('#qcCartBar:not([hidden])','cart bar after add'); } else log('MISSING','products with ADD in store'); });
  await T('product',async()=>{ await c('#tabbody .lx-pcard .lx-pimg',{w:1800}); await S('product'); await vis('.lx-phero','product hero'); await vis('.lx-qty','quantity');
    await c('#qp',{w:300}); await c('#atc',{w:1200}); await S('product_added'); await c('#bk'); await c('#bk',{w:1500}); });
  await T('categories',async()=>{ await c('.bnav [data-tabnav="categories"]',{w:1500}); await S('categories'); 
    await c('.lx-ctile',{w:2000}); await S('category'); await vis('#list .lv-srow','category store list'); await c('#vt [data-v="map"]'); await S('cat_map'); const pin=p.locator('.lw-mpin'); if(await pin.count()){ await pin.first().click(); await p.waitForTimeout(600); await S('cat_map_pin'); } await c('#vt [data-v="list"]'); await c('#__back'); });
  await T('workers',async()=>{ const w=p.locator('.lx-ctile',{hasText:/Worker/i}); if(await w.count()){ await w.first().click(); await p.waitForTimeout(1800); await S('workers'); await vis('.lw-pro','worker cards'); await c('#__back'); } else log('MISSING','Workers tile'); });
  await T('cart_guest',async()=>{ await c('.bnav [data-tabnav="home"]',{w:2500}); const cb=p.locator('#qcGoCart'); if(await cb.count()){ await cb.click(); await p.waitForTimeout(1500); } else { log('MISSING','cart bar on home'); return; } await S('cart'); await vis('.lv-line','cart lines');
    await c('[data-inc]'); await c('[data-dec]'); await S('cart_qty'); await c('#checkout',{w:1500}); await S('checkout_gate'); });
  await T('login',async()=>{ const g=p.locator('button',{hasText:/^Continue$/}); if(await g.count()){ await g.last().click(); await p.waitForTimeout(1500);}  await S('login'); await vis('#lid','login form');
    await p.fill('#lpw','wrong'); await c('#lsubmit',{w:1200}); await S('login_wrong'); await p.fill('#lpw','password'); await c('#lsubmit',{w:2500}); await S('after_login'); });
  await T('checkout',async()=>{ const s=await txt('#screen'); if(!/Checkout/.test(s)){ log('NOTE','after login not on checkout; navigating'); const cb=p.locator('#qcGoCart'); if(await cb.count()){ await cb.click(); await p.waitForTimeout(1300);} await c('#checkout',{w:1800}); }
    await S('checkout'); await vis('#ful','delivery/pickup'); await vis('#cc','coupon');
    await c('#ful [data-f="pickup"]'); await S('checkout_pickup'); await c('#ful [data-f="delivery"]');
    await p.fill('#cc','NOPE'); await c('#ccgo'); const sug=p.locator('[data-cc]'); if(await sug.count()){ await sug.first().click(); await p.waitForTimeout(800); } await S('checkout_coupon');
    if(await p.locator('#addrRow').isVisible()){ await c('#addrRow'); } await p.fill('#cn','Test User'); await p.fill('#cp','+919876500000'); await p.fill('#cl','12 Temple Road'); await p.fill('#note','Less spicy');
    await c('#vd'); await S('checkout_details'); await c('#place',{w:3000}); await S('order_done'); await vis('.lv-done','order placed screen'); });
  await T('orders',async()=>{ await c('#trk',{w:2500}); await S('orders'); await vis('.lv-ocard','live order card'); await vis('[data-cancel]','cancel button');
    await c('[data-inv]',{w:1500}); for(const pg of ctx.pages().slice(1)) await pg.close();
    p.once('dialog',d=>d.accept()); const cn=p.locator('[data-cancel]'); if(await cn.count()){ await cn.first().click(); await p.waitForTimeout(800); const ok=p.locator('button',{hasText:/^Cancel order$/}); if(await ok.count()){ await ok.last().click(); } await p.waitForTimeout(2000); await S('orders_cancelled'); }
    await c('#seg [data-s="past"]'); await S('orders_past'); await c('#seg [data-s="book"]'); await S('orders_book'); });
  await T('assistant',async()=>{ await c('.bnav [data-tabnav="__talk"]',{w:1500}); await S('assistant'); const dl=p.locator('button',{hasText:'Type instead'}); if(await dl.count()) { await dl.first().click(); await p.waitForTimeout(500); }
    if(!(await p.locator('#aq').isVisible())) await c('#kb',{w:400}); await p.fill('#aq','vegetables, chicken biriyani and an electrician'); await p.press('#aq','Enter'); await p.waitForTimeout(3000); await S('assistant_multi'); await vis('.lw-grp','grouped results');
    await p.fill('#aq','where is my order'); await p.press('#aq','Enter'); await p.waitForTimeout(2000); await S('assistant_track');
    const ad=p.locator('.lw-rc [data-add]'); if(await ad.count()){ await ad.first().click(); await p.waitForTimeout(800); } await c('#__back',{w:1500}); });
  await T('service_booking',async()=>{ await c('.bnav [data-tabnav="home"]',{w:2500}); await p.locator('#screen').evaluate(e=>e.scrollTo(0,1800)); await p.waitForTimeout(800); const bk=p.locator('#lwSvc .lv-req'); if(!(await bk.count())){ log('MISSING','recommended services book'); return; }
    await bk.first().click(); await p.waitForTimeout(1500); await S('booking_sheet'); await vis('#bd','booking days'); await p.locator('#bd button').nth(1).click(); await p.locator('#bt button').nth(2).click(); await p.fill('#bn','Fan not working'); await c('#bgo',{w:1500}); await S('booking_done'); await vis('.lw-ok','booking confirmation'); const ok=p.locator('#okx'); if(await ok.count()) await ok.click(); await p.waitForTimeout(600); });
  const acct=async(label,sel,shot,check)=>{ await T(shot,async()=>{ await c('.bnav [data-tabnav="account"]',{w:1500}); const r=p.locator('.lv-menu > *',{hasText:label}); if(!(await r.count())){ log('MISSING','account row '+label); return; } await r.first().click(); await p.waitForTimeout(1800); await S(shot); if(check) await check(); if(sel) await vis(sel,shot+' content'); }); };
  await acct('My Orders','.lv-seg','acct_orders');
  await acct('My Addresses','#addA','addresses',async()=>{ await c('#addA'); await p.fill('#an','Test'); await p.fill('#ap','9876500000'); await p.fill('#al2','Office, Main Rd'); await c('#asv',{w:1000}); await S('addresses_added'); });
  await acct('Favourites','.lv-seg','wishlist');
  await acct('Offers','.lw-cpn','offers',async()=>{ const cd=p.locator('[data-code]'); if(await cd.count()){ await cd.first().click(); await p.waitForTimeout(500);} });
  await acct('Post a requirement','#sheet','post_req',async()=>{ await p.evaluate(()=>document.querySelector('#sclose')&&document.querySelector('#sclose').click()); await p.waitForTimeout(500); });
  await acct('Payment Methods','.lw-pm','payments');
  await acct('Your Neighbourhood','.lw-chero','community',async()=>{ await p.waitForTimeout(1500); await p.locator('#screen').evaluate(e=>e.scrollTo(0,9999)); await p.waitForTimeout(800); await S('community_bottom'); await c('#ref',{w:1200}); await S('refer_sheet'); if(await p.locator('#rn').count()){ await p.fill('#rn','Amma Bakery'); await c('#rgo',{w:1500}); await S('refer_done'); const ok=p.locator('#okx'); if(await ok.count()) await ok.click(); } });
  await acct('Local Info','.lw-li','localinfo');
  await acct('Events',null,'events');
  await acct('Language','.lw-langs','prefs',async()=>{ await p.locator('.lw-tg i').first().click(); await p.waitForTimeout(300); });
  await T('notifications',async()=>{ await c('.bnav [data-tabnav="account"]',{w:1500}); await c('.lv-menu [data-tabnav="notifications"]',{w:1800}); await S('notifications'); await vis('.lw-nt, .lv-empty','notifications content'); });
  await acct('Help','.lw-faq','support',async()=>{ await p.locator('.lw-faq summary').first().click(); await p.waitForTimeout(400); await c('[data-k="complaint"]',{w:1500}); await S('support_complaint'); if(await p.locator('#sm').count()){ await p.fill('#sm','Item missing'); await c('#sgo',{w:1500}); await S('support_sent'); const ok=p.locator('#okx'); if(await ok.count()) await ok.click(); } });
  await T('profile_edit',async()=>{ await c('.bnav [data-tabnav="account"]',{w:1500}); await c('.lv-me .lv-ib',{w:1500}); await S('profile_edit'); await vis('#pn','profile name'); await p.fill('#pn','Mohammed Anan K'); await c('#psv',{w:1500}); await S('profile_saved'); const n=await txt('.lv-me b'); if(!/Anan K/.test(n)) log('BUG','profile name not updated in account: '+n); });
  await T('dark',async()=>{ await c('.lv-tbar [data-ctheme]',{w:1200}).catch(()=>log('MISSING','theme toggle')); await S('dark_account'); await c('.bnav [data-tabnav="home"]',{w:2500}); await S('dark_home'); await c('.lv-tbar [data-ctheme], .lv-htop [data-ctheme]',{w:1200}).catch(()=>{}); });
  await T('logout_register',async()=>{ await c('.bnav [data-tabnav="account"]',{w:1500}); p.once('dialog',d=>d.accept()); await c('#out',{w:800}); const ok=p.locator('button',{hasText:/^Log out$/}); if(await ok.count()) await ok.last().click(); await p.waitForTimeout(1200); await S('logged_out');
    await c('#lg',{w:1200}); await c('#goreg',{w:1200}); await S('register'); await p.fill('#rn','New Person'); await p.fill('#rp','98765'+String(Date.now()).slice(-5)); await p.fill('#re','np'+Date.now()+'@x.com'); await p.fill('#rpw','secret123'); await c('#rsubmit',{w:2500}); await S('registered'); });
  await T('swipe_back',async()=>{ await c('.bnav [data-tabnav="categories"]',{w:1200}); await c('.lx-ctile',{w:1500}); const vp=p.viewportSize(); await p.touchscreen.tap(5,vp.height/2).catch(()=>{});
    await p.evaluate(()=>{ const t=(type,x)=>{ const e=new TouchEvent(type,{touches:type==='touchend'?[]:[new Touch({identifier:1,target:document.body,clientX:x,clientY:400})],changedTouches:[new Touch({identifier:1,target:document.body,clientX:x,clientY:400})],bubbles:true}); document.body.dispatchEvent(e); }; t('touchstart',4); t('touchend',200); }); await p.waitForTimeout(1200); await S('after_swipe_back'); });
  require('fs').writeFileSync('report.txt',out.join('\n')); console.log(out.join('\n')||'NO ISSUES'); console.log('shots',shots.length); await br.close();
})();

/* =====================================================================
   VISUAREALM · CREATIVE HOUSE — SHARED HELPERS (v4, Phase 2)
   ===================================================================== */
(function () {
  const CFG = window.VISUAREALM_CONFIG || {};
  const configured = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
    !CFG.SUPABASE_URL.includes("PASTE_") && !CFG.SUPABASE_ANON_KEY.includes("PASTE_");
  let client = null;
  if (configured && window.supabase) client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  const SUPPORT_EMAIL = "support@visuarealmstudios.com";
  const MODE_SWITCH_COOLDOWN_DAYS = 0;   // approved hirers can move between workspaces freely
  const RENEW_WINDOW_DAYS = 4;           // renew only within last N days
  const MAX_EXPIRY_DAYS = 60;            // listings can run up to N days

  // broad disciplines drive the Cast/Crew visibility rule
  const DISCIPLINES = ["Filmmaker", "Crew", "Cast", "Photographer"];
  // progressive specializations revealed after the broad pick
  const ROLES_BY_DISCIPLINE = {
    Filmmaker: ["Director", "Producer", "Writer", "Assistant Director", "Production Assistant", "Development", "Showrunner"],
    Crew: ["Cinematographer", "Camera Department", "Lighting", "Grip", "Sound", "Production Design", "Art Department", "Costume", "Wardrobe", "Hair", "Makeup", "VFX", "Editor", "Colorist", "Composer", "Music Supervisor"],
    Cast: ["Lead Actor", "Supporting Actor", "Background / Extra", "Voice Actor", "Stunt"],
    Photographer: ["Photographer", "Behind The Scenes", "Stills", "Unit Photography"]
  };
  const ALL_ROLES = Object.values(ROLES_BY_DISCIPLINE).flat();
  const CITIES = ["Toronto"]; // Toronto-exclusive for now
  const WORK_STATUSES = ["Available for Work", "Busy", "On Set", "Looking for Crew", "Looking for Cast", "Open to Collaborate", "Custom"];
  const PAY_TYPES = ["paid", "unpaid", "deferred"];
  const PRODUCTION_TYPES = ["Short Film", "Feature Film", "Music Video", "Commercial", "Series / Episodic", "Documentary", "Photography", "Student Film", "Other"];
  const EXPERIENCE_LEVELS = ["Any", "Emerging", "Intermediate", "Experienced"];
  const WORK_MODES = ["On-site", "Remote", "Hybrid"];
  const CONTACT_PREFS = ["Email", "Instagram", "Website"];

  const CH = {
    cfg: CFG, configured, sb: client, routes: CFG.ROUTES || {},
    SUPPORT_EMAIL, MODE_SWITCH_COOLDOWN_DAYS, RENEW_WINDOW_DAYS, MAX_EXPIRY_DAYS,
    DISCIPLINES, ROLES_BY_DISCIPLINE, ALL_ROLES, CITIES, WORK_STATUSES,
    PAY_TYPES, PRODUCTION_TYPES, EXPERIENCE_LEVELS, WORK_MODES, CONTACT_PREFS,

    async requireAuth() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      if (!data.session) { window.location.href = this.routes.afterLogout || "/create-account/"; return null; }
      const meta=data.session.user.user_metadata||{},syncKey=`vr_legal_sync_${data.session.user.id}_${meta.terms_version||''}`;
      try{if(meta.birth_date&&meta.terms_version&&!sessionStorage.getItem(syncKey)){client.rpc('ch_record_legal_consent',{p_birth_date:meta.birth_date,p_guardian_acknowledged:!!meta.guardian_acknowledged,p_terms_version:meta.terms_version,p_privacy_version:meta.privacy_version,p_guidelines_version:meta.guidelines_version,p_marketing_consent:!!meta.marketing_consent,p_source:'signup_metadata'}).then(({error})=>{if(!error)sessionStorage.setItem(syncKey,'1');}).catch(()=>{});}}catch(e){}
      return data.session;
    },
    async getSession() { if (!client) return null; const { data } = await client.auth.getSession(); return data.session; },
    async profile() {
      if (!client) return null;
      const s = await this.getSession(); if (!s) return null;
      const { data, error } = await client.from("profiles").select("*").eq("id", s.user.id).single();
      if (error) return { id: s.user.id, email: s.user.email };
      return data;
    },
    async mountLegalReminder(){
      if(!client||location.pathname==='/settings.html'||document.getElementById('legal-reminder'))return;
      try{const {data,error}=await this.withTimeout(client.rpc('ch_my_legal_status'),2500);if(error||!data||data.complete)return;const bar=document.createElement('aside');bar.id='legal-reminder';bar.className='legal-reminder';bar.setAttribute('role','status');bar.innerHTML='<div><b>One account check remains.</b><span>Confirm age eligibility and the current community agreements.</span></div><a href="/settings.html?section=legal">Complete in Settings</a>';document.body.appendChild(bar);}catch(e){}
    },
    async signOut() { if (client) await client.auth.signOut(); window.location.href = this.routes.afterLogout || "/create-account/"; },

    // ---- membership: the database is the source of truth ----
    membershipFallback(audience,era='paid'){
      const hiring=audience==='hiring',open=era==='open_house';
      return {
        membership_era:era,source:open?'launch_access':'free',
        is_premium:open,name:hiring?(open?'Hiring Studio':'Hiring Free'):(open?'House+':'House Free'),
        badge:open?'OPEN HOUSE':'FREE',checkout_available:false,
        entitlements:{fit_notes:open,application_export:open,hiring_analytics:open,applicant_export:open,talent_lists_limit:open?100:0}
      };
    },
    async membership(audience){
      if(!client) return this.membershipFallback(audience,'paid');
      try{
        const {data,error}=await this.withTimeout(client.rpc('ch_my_entitlements',{p_audience:audience||null}),8000);
        if(error)throw error;
        if(data)return data;
      }catch(error){console.warn('Membership service unavailable:',error?.message||error);}
      // A failed entitlement call must not freeze the dashboard. Full access
      // is granted only when the public setting explicitly confirms Open House.
      try{
        const {data}=await this.withTimeout(client.from('app_settings').select('membership_era').eq('id',1).maybeSingle(),2500);
        return this.membershipFallback(audience,data?.membership_era==='open_house'?'open_house':'paid');
      }catch(error){return this.membershipFallback(audience,'paid');}
    },
    membershipLimit(access,key,fallback=0){
      const raw=access&&access.entitlements?access.entitlements[key]:undefined;
      const n=Number(raw);return Number.isFinite(n)?n:fallback;
    },
    hasMembershipFeature(access,key){return !!(access&&access.entitlements&&access.entitlements[key]);},
    paidMark(label='PAID'){return `<span class="paid-feature-mark"><i></i>${this.esc(label)}</span>`;},
    membershipCard(access,audience){
      if(!access)return '';
      const launch=access.source==='launch_access',roster=access.source==='founding_roster',trial=access.source==='trial';
      const label=roster?'Founding Roster':launch?'Launch access':trial?'7-day trial':(access.badge||'FREE');
      const copy=roster?'Chosen by VISUAREALM. Your full access does not expire.':launch?'You have the whole platform while Creative House is new. No card, no countdown.':trial?`Your trial is active${access.trial_end?' until '+this.fmtDate(access.trial_end):''}.`:(access.is_premium?'Your paid membership is active.':'The free House keeps opportunity, applications and safety open.');
      return `<section class="membership-card ${access.is_premium?'is-plus':'is-free'}"><div class="membership-card-copy"><span class="membership-overline">${this.esc(audience==='hiring'?'Hiring membership':'Creative House membership')}</span><h3>${this.esc(access.name||'House Free')} ${access.is_premium?this.paidMark():''}</h3><p>${this.esc(copy)}</p></div><div class="membership-state"><i></i><b>${this.esc(label)}</b><span>${access.membership_era==='open_house'?'The House is open':'Membership era live'}</span></div></section>`;
    },
    async startCheckout(plan,interval='month'){
      if(!client)return false;
      const prices={house_plus:{month:'$6.99 CAD each month',year:'$59 CAD each year'},hiring_studio:{month:'$19 CAD each month',year:'$190 CAD each year'}},price=prices[plan]?.[interval]||'the price shown in Stripe Checkout';
      const accepted=await this.confirm({title:'Review before Stripe',message:`You are choosing ${price}, plus applicable tax. The membership renews automatically until cancelled. Any trial and first charge date will appear in Checkout. Open House never converts automatically. By continuing, you accept the Membership & Billing Terms.`,ok:'Continue to Stripe'});if(!accepted)return false;
      try{const {error}=await client.rpc('ch_record_billing_acceptance',{p_version:'2026-07-21'});if(error){await this.alert({title:'Billing agreement not recorded',message:'We could not safely record the billing terms acceptance. Nothing was charged. Refresh and try again.'});return false;}}catch(e){await this.alert({title:'Billing agreement unavailable',message:'Nothing was charged. Install the launch legal migration before testing Checkout.'});return false;}
      const {data,error}=await client.functions.invoke('stripe-checkout',{body:{plan,interval}});
      const target=this.safePaymentUrl(data?.url,'checkout');
      if(error||!target){await this.alert({title:'Checkout is not ready',message:data?.error||this.friendlyError(error,'We could not open checkout. Nothing was charged.')});return false;}
      location.href=target;return true;
    },
    async openBillingPortal(){
      if(!client)return false;
      const {data,error}=await client.functions.invoke('stripe-portal');
      const target=this.safePaymentUrl(data?.url,'portal');
      if(error||!target){await this.alert({title:'Billing settings unavailable',message:data?.error||this.friendlyError(error,'We could not open billing settings.')});return false;}
      location.href=target;return true;
    },

    esc(v){ if(v==null) return ""; return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
    safeUrl(value,kind='link'){
      let raw=String(value||'').trim();if(!raw)return '';
      if(kind==='instagram'&&/^@?[a-z0-9._]{1,30}$/i.test(raw))raw='https://instagram.com/'+raw.replace(/^@/,'');
      try{
        const url=new URL(raw,location.origin),same=url.origin===location.origin;
        if(url.protocol==='https:'||(url.protocol==='http:'&&(same||['localhost','127.0.0.1'].includes(location.hostname))))return url.href;
        return '';
      }catch(e){return '';}
    },
    safeImageUrl(value){return this.safeUrl(value,'image');},
    safeAppPath(value,fallback='/dashboard/'){
      try{const url=new URL(String(value||''),location.origin);return url.origin===location.origin&&['http:','https:'].includes(url.protocol)?url.pathname+url.search+url.hash:fallback;}catch(e){return fallback;}
    },
    safePaymentUrl(value,kind){
      try{const url=new URL(String(value||''));const allowed=kind==='portal'?['billing.stripe.com']:['checkout.stripe.com'];return url.protocol==='https:'&&allowed.includes(url.hostname)?url.href:'';}catch(e){return '';}
    },
    withTimeout(promise,ms=20000,message='This is taking longer than expected. Check your connection and try again.'){
      let timer;
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);});
      return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
    },
    pill(s){ s=(s||"").toLowerCase(); return `<span class="pill ${s}">${this.esc(s.charAt(0).toUpperCase()+s.slice(1))}</span>`; },
    fmtDate(ts){ if(!ts) return "—"; try{return new Date(ts).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}catch(e){return "—";} },
    toast(el,msg,kind){ if(!el){alert(msg);return;} el.textContent=msg; el.className="alert show "+(kind==="ok"?"ok":"err"); },
    clearToast(el){ if(el) el.className="alert"; },
    guardConfig(sel){ if(configured) return true; const host=document.querySelector(sel)||document.body;
      const b=document.createElement("div"); b.className="alert err show"; b.style.cssText="margin:20px auto;max-width:560px";
      b.innerHTML="Setup needed: open <b>config.js</b> and paste your Supabase URL and key. See the README.";
      host.prepend(b); return false; },

    // ---- expiry / renewal ----
    timeLeft(expires){
      if(!expires) return {text:"No expiry",cls:"",days:999};
      const d=Math.ceil((new Date(expires)-new Date())/86400000);
      if(d<0) return {text:"Expired",cls:"dead",days:d};
      if(d===0) return {text:"Ends today",cls:"warn",days:0};
      if(d<=RENEW_WINDOW_DAYS+3) return {text:d+" day"+(d>1?"s":"")+" left",cls:"warn",days:d};
      return {text:d+" days left",cls:"",days:d};
    },
    canRenew(expires){ if(!expires) return false; const d=Math.ceil((new Date(expires)-new Date())/86400000); return d<=this.RENEW_WINDOW_DAYS; },
    maxExpiryISO(){ return new Date(Date.now()+this.MAX_EXPIRY_DAYS*864e5).toISOString().slice(0,10); },
    todayISO(){ return new Date().toISOString().slice(0,10); },

    // ---- workspace switching (#Role Switching) ----
    activeMode(profile){ return (profile.active_mode || profile.primary_mode || "applicant"); },
    cooldownLeft(){ return 0; },
    async setMode(profile, mode){
      if(!['applicant','hiring'].includes(mode)) return {ok:false,msg:'That workspace is not available.'};
      if(mode==='hiring' && !(profile.can_hire||profile.is_admin)) return {ok:false,msg:'Hiring tools are not enabled for this account.'};
      if(mode===this.activeMode(profile)) return {ok:true, mode};
      const patch={active_mode:mode};
      const { error }=await client.from("profiles").update(patch).eq("id",profile.id);
      if(error) return {ok:false,msg:this.friendlyError(error,'We could not switch workspaces. Please try again.')};
      profile.active_mode=mode;
      return {ok:true, mode};
    },

    // ---- account enforcement: gate for suspended/banned, banners for flagged/warned ----
    enforceAccount(profile){
      if(!profile) return true;
      if(profile.status==='banned'){ this.renderBlocked('banned'); return false; }
      if(profile.status==='suspended'){ this.renderBlocked('suspended'); return false; }
      if(profile.status==='flagged') this.showFlaggedBanner(profile);
      if(profile.warning_active) this.showWarningBanner(profile);
      return true;
    },
    renderBlocked(kind){
      const banned = kind==='banned';
      document.body.innerHTML = `
        <div class="account-state ${banned?'ended':'paused'}">
          <div class="state-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
          <main class="state-card">
            <div class="state-mark">${banned?'VR':'II'}</div>
            <span class="state-kicker">${banned?'Account closed':'Account paused'}</span>
            <h1>${banned?'This chapter has ended.':'Take a breath. Access is paused.'}</h1>
            <p>${banned
              ? 'Your Creative House account has been permanently closed following a serious breach of our Community Standards.'
              : 'Your Creative House account is currently suspended. Your work and profile are still here, but access is temporarily disabled.'}</p>
            <div class="state-note"><b>${banned?'Think we got it wrong?':'You still have a voice.'}</b><span>${banned?'You can request a careful review of this decision.':'If this feels like a mistake, send an appeal. A real person reads every message.'}</span></div>
            <div class="state-actions"><a class="btn solid" href="mailto:${SUPPORT_EMAIL}?subject=${banned?'Ban%20Review%20Request':'Account%20Suspension%20Appeal'}">${banned?'Request a review':'Start an appeal'}</a><button class="btn ghost" id="gate-out">Sign out</button></div>
            <a class="state-support" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
          </main>
        </div>`;
      const o=document.getElementById('gate-out'); if(o) o.addEventListener('click',()=>this.signOut());
    },
    renderSuspended(){ this.renderBlocked('suspended'); },
    renderDeleted(){
      document.body.innerHTML=`<div class="account-state deleted"><div class="state-orbit" aria-hidden="true"><span></span><span></span><span></span></div><main class="state-card"><div class="state-mark">VR</div><span class="state-kicker">Account deleted</span><h1>The door stays open.</h1><p>Your Creative House account and its data have been removed. Thank you for bringing part of yourself into this place.</p><div class="state-note"><b>This is goodbye for now.</b><span>If you return one day, you can begin again with a new account. You will still belong.</span></div><div class="state-actions"><a class="btn solid" href="/create-account/">Create a new account</a><a class="btn ghost" href="/creative-house">Visit Creative House</a></div></main></div>`;
    },
    showFlaggedBanner(profile){
      if(document.getElementById('flag-banner')) return;
      const b=document.createElement('div'); b.id='flag-banner'; b.className='review-banner review-banner-card';
      b.innerHTML=`<span class="rb-icon" aria-hidden="true">i</span><span class="rb-copy"><b>Your account is being reviewed.</b><small>You can keep moving through the house. A few actions may be limited while our team takes a careful look.</small></span><a href="mailto:${SUPPORT_EMAIL}">Ask us about it</a>`;
      document.body.prepend(b);
    },
    showWarningBanner(profile){
      if(document.getElementById('warn-banner')) return;
      const b=document.createElement('div'); b.id='warn-banner'; b.className='review-banner warn-banner';
      b.innerHTML=`<span><b>A note from the moderation team:</b> ${this.esc(profile.warning_note||'Please review our Community Standards.')} <button class="linkbtn" id="warn-ack" style="margin-left:8px;">I understand</button></span>`;
      document.body.prepend(b);
      const ack=document.getElementById('warn-ack');
      if(ack) ack.addEventListener('click', async ()=>{ await client.from('profiles').update({warning_active:false}).eq('id',profile.id); b.remove(); });
    },
    mentorStar(){ return '<span class="mentor-star" title="Community Mentor">&#9733;</span>'; },

    // ---- badges ----
    async badgesFor(userId){ if(!client) return []; const { data }=await client.from("user_badges").select("*, badges(label,description,kind,emoji)").eq("user_id",userId).order("awarded_at"); return data||[]; },
    async allBadges(){ if(!client) return []; const { data }=await client.from("badges").select("*"); return data||[]; },
    renderBadges(list){
      if(!list||!list.length) return '<span class="muted mono" style="font-size:.7rem;">No badges yet — they arrive as you take part.</span>';
      return '<div class="badge-grid">'+list.map(b=>{const m=b.badges||{};return `<span class="badge-chip ${m.kind==='special'?'special':''}" title="${this.esc(m.description||'')}"><span class="bx">${this.esc(m.emoji||'+')}</span>${this.esc(m.label||b.badge_code)}</span>`;}).join('')+'</div>';
    },

    // ---- share links ----
    listingUrl(slug){ return `${location.origin}/listing/?id=${encodeURIComponent(slug)}`; },
    async copyShare(slug, btn){
      const url=this.listingUrl(slug);
      const done=()=>{ if(btn){const t=btn.textContent; btn.textContent="Link copied ✓"; setTimeout(()=>btn.textContent=t,1500);} };
      try{ await navigator.clipboard.writeText(url); done(); return true; }
      catch(e){
        try{ const ta=document.createElement('textarea'); ta.value=url; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.top='-1000px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); return true; }
        catch(err){ if(btn){btn.textContent="Copy failed"; setTimeout(()=>btn.textContent="Share",1500);} return false; }
      }
    },

    // reopen window: a closed listing can reopen within 7 days of closing
    canReopen(closed_at){ if(!closed_at) return true; return (Date.now()-new Date(closed_at))/864e5 <= 7; },

    // ---- in-app text prompt ----
    prompt(opts){
      const o=typeof opts==='string'?{title:opts}:(opts||{});
      const title=o.title||'Quick one', message=o.message||'', ok=o.ok||'Save', ph=o.placeholder||'', val=o.value||'';
      return new Promise((res)=>{
        const bg=document.createElement('div'); bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog prompt-dialog" role="dialog" aria-modal="true"><span class="dialog-kicker">Save for later</span><h4>${this.esc(title)}</h4>${message?`<p>${this.esc(message)}</p>`:''}
          <label class="f"><span class="lab">Filter name</span><input id="cp-in" placeholder="${this.esc(ph)}" value="${this.esc(val)}"></label>
          <div class="cd-actions"><button class="btn ghost sm" data-x>Cancel</button><button class="btn solid sm" data-o>${this.esc(ok)}</button></div></div>`;
        document.body.appendChild(bg); requestAnimationFrame(()=>{bg.classList.add('show'); const i=bg.querySelector('#cp-in'); if(i) i.focus();});
        const done=(v)=>{ bg.classList.remove('show'); setTimeout(()=>bg.remove(),200); res(v); };
        bg.querySelector('[data-x]').addEventListener('click',()=>done(null));
        bg.querySelector('[data-o]').addEventListener('click',()=>done(bg.querySelector('#cp-in').value.trim()||null));
        bg.querySelector('#cp-in').addEventListener('keydown',(e)=>{ if(e.key==='Enter') done(bg.querySelector('#cp-in').value.trim()||null); });
        bg.addEventListener('click',(e)=>{ if(e.target===bg) done(null); });
      });
    },

    // ---- rewards ----
    // The database awards the badge (see sql/2026-07-15-tweaks.sql). This just
    // shows it off. Called right after a successful application.
    // maxAgeMins guards the backfill: members who already applied before this
    // shipped hold the badge with an old timestamp, so they never get a false
    // "your first application!" moment on their next apply.
    async checkReward(code, maxAgeMins){
      if(!client) return null;
      const s=await this.getSession(); if(!s) return null;
      const {data}=await client.from('user_badges').select('*, badges(label,description,kind,emoji)').eq('user_id',s.user.id).eq('badge_code',code).maybeSingle();
      if(!data) return null;
      const age=(Date.now()-new Date(data.awarded_at||0))/60000;
      if(maxAgeMins && (!data.awarded_at || age>maxAgeMins)) return null;
      const seen=this.lsGet('reward_seen',[]);
      if(seen.includes(code)) return null;           // only ever celebrate once
      this.lsSet('reward_seen',[...seen,code]);
      return data;
    },
    rewardPrompt(row){
      if(!row) return Promise.resolve(false);
      const b=row.badges||{};
      return new Promise((res)=>{
        const bg=document.createElement('div'); bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog reward-dialog" role="dialog" aria-modal="true">
          <div class="reward-burst" aria-hidden="true"><span></span><span></span><span></span></div>
          <span class="dialog-kicker">A first, and it counts</span>
          <div class="reward-medal"><span class="reward-emoji">${this.esc(b.emoji||'★')}</span></div>
          <h4>${this.esc(b.label||'New badge')}</h4>
          <p>${this.esc(b.description||'You earned something.')}</p>
          <div class="reward-chip">${this.renderBadges([row])}</div>
          <p class="reward-foot">It sits on your profile from now on. Everyone who opens your page sees where you started.</p>
          <div class="cd-actions"><button class="btn ghost sm" data-x>Nice</button><button class="btn solid sm" data-o>See my profile</button></div>
        </div>`;
        document.body.appendChild(bg); requestAnimationFrame(()=>bg.classList.add('show'));
        const done=(v)=>{ bg.classList.remove('show'); setTimeout(()=>bg.remove(),200); res(v); };
        bg.querySelector('[data-x]').addEventListener('click',()=>done(false));
        bg.querySelector('[data-o]').addEventListener('click',()=>{ done(true); location.href='/dashboard/?tab=Profile'; });
        bg.addEventListener('click',(e)=>{ if(e.target===bg) done(false); });
      });
    },
    // convenience: award check + showcase in one call
    async celebrateFirstApplication(){
      try{ const row=await this.checkReward('first_step', 5); if(row) await this.rewardPrompt(row); }catch(e){}
    },

    // Participation progress. This is intentionally not a popularity score:
    // profile care + real participation move it, and private hiring decisions
    // only count after the hiring team deliberately publishes them.
    progressLabels:{
      new_voice:{name:'New Voice',note:'You are in. Start shaping the profile people will remember.'},
      building:{name:'Building',note:'Your profile and first moves are beginning to tell a story.'},
      in_the_room:{name:'In the Room',note:'You are showing up, applying and building real momentum.'},
      trusted_collaborator:{name:'Trusted Collaborator',note:'Your participation is becoming part of the House.'},
      house_regular:{name:'House Regular',note:'You keep showing up and helping the House move.'}
    },
    async myProgress(){
      if(!client) return null;
      const {data,error}=await client.rpc('ch_my_progress');
      return error?null:data;
    },
    visibleApplicationStatus(application){
      if(!application) return 'submitted';
      return application.status==='submitted'||application.status_announced_at?application.status:'submitted';
    },
    async nextProgressReward(){
      if(!client) return null;
      const {data}=await client.from('ch_reward_events').select('*').is('seen_at',null).order('created_at',{ascending:true}).limit(1).maybeSingle();
      return data||null;
    },
    async showProgressReward(){
      const event=await this.nextProgressReward();if(!event)return;
      const meta=this.progressLabels[event.level_code]||{};
      const bg=document.createElement('div');bg.className='cdialog-bg';
      bg.innerHTML=`<div class="cdialog reward-dialog progress-reward" role="dialog" aria-modal="true"><span class="dialog-kicker">Your House journey</span><div class="reward-medal"><span class="reward-emoji">✦</span></div><h4>${this.esc(meta.name||event.title)}</h4><p>${this.esc(meta.note||event.message)}</p><div class="cd-actions"><button class="btn solid sm" data-o>Keep going</button></div></div>`;
      document.body.appendChild(bg);requestAnimationFrame(()=>bg.classList.add('show'));
      bg.querySelector('[data-o]').addEventListener('click',async()=>{await client.from('ch_reward_events').update({seen_at:new Date().toISOString()}).eq('id',event.id);bg.classList.remove('show');setTimeout(()=>bg.remove(),180);});
    },

    // ---- errors ----
    // Rate-limit trips come back from Postgres already written for humans.
    // This strips the plumbing so we never show "P0001" to a member.
    friendlyError(error, fallback){
      if(!error) return fallback||'Something went wrong. Try again in a moment.';
      let m=String(error.message||error.hint||'').trim();
      m=m.replace(/^ERROR:\s*/i,'').replace(/^P0001:\s*/i,'').split('\n')[0].trim();
      if(!m || /^(new row|permission denied|violates|duplicate key)/i.test(m)) return fallback||'That didn\u2019t go through. Try again in a moment.';
      return m;
    },
    go404(reason){
      const q=reason?'?reason='+encodeURIComponent(reason):'';
      window.location.replace('/404.html'+q);
    },
    isRateLimited(error){
      const m=String((error&&error.message)||'').toLowerCase();
      return /already reported|one at a time|limit|give it|already have that one|a few seconds/.test(m);
    },

    // ---- reporting ----
    REPORT_REASONS:[['safety','Safety concern'],['harassment','Harassment or abuse'],['discrimination','Discrimination'],['sexual','Sexual or predatory conduct'],['fraud','Scam or fraud'],['impersonation','Impersonation'],['inappropriate','Inappropriate content'],['misleading','Misleading or inaccurate'],['noshow','Unprofessional conduct'],['spam','Spam'],['other','Something else']],
    // Client-side speed bump. The real limit lives in the database — this
    // only saves a pointless round-trip and reads nicer.
    reportCooldownLeft(){
      const last=this.lsGet('last_report',0);
      return Math.max(0, Math.ceil((30000-(Date.now()-last))/1000));
    },
    async reportListing(opening){return this.reportTarget({kind:'listing',listing:opening&&opening.id,title:'Report this listing'});},
    async reportMember(memberId,contextApplication,label){return this.reportTarget({kind:'member',member:memberId,contextApplication,title:label||'Report this member'});},
    async reportTarget(opts){
      const s=await this.getSession();
      if(!s){ await this.alert({title:'Log in to report',message:'You need an account to send a report. It helps us follow up and protects the report process.'}); location.href='/create-account/'; return; }
      const cd=this.reportCooldownLeft();
      if(cd>0){ await this.alert({title:'One at a time',message:`Give it about ${cd} more second${cd===1?'':'s'}. Reports get read by a person, so a steady trickle beats a flood.`}); return; }
      const reasons=this.REPORT_REASONS.filter(([code])=>opts.kind==='listing'?code!=='noshow':code!=='misleading');
      return new Promise((res)=>{
        const bg=document.createElement('div'); bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog report-dialog" role="dialog" aria-modal="true">
          <div class="report-dialog-head"><span class="report-mark" aria-hidden="true">VR</span><div><span class="dialog-kicker">Safety desk · private</span><h4>${this.esc(opts.title)}</h4><p>A person reads every report.</p></div></div>
          <div class="report-trust"><span><i>1</i><b>Tell us what</b><small>Choose the closest concern</small></span><span><i>2</i><b>Add context</b><small>Give the reviewer a clear start</small></span><span><i>3</i><b>Human review</b><small>No automatic punishment</small></span></div>
          <fieldset class="report-reasons"><legend>What should we look at?</legend><div id="rp-reasons">${reasons.map(([code,label])=>`<button type="button" data-reason="${code}">${this.esc(label)}</button>`).join('')}</div></fieldset>
          <label class="f"><span class="lab">What happened?</span><textarea id="rp-details" minlength="15" maxlength="4000" placeholder="Share what happened, when it happened, and anything a reviewer should check."></textarea><span class="hint">Write plainly. Useful links can be included here. Up to 4,000 characters.</span></label>
          <div class="report-privacy"><b>Your name stays with the safety team.</b><span>The person you report is not shown who sent it. A report creates a case, not a penalty.</span></div>
          <div class="cd-actions"><button class="btn ghost sm" data-x>Not now</button><button class="btn solid sm" data-o disabled>Send privately</button></div>
        </div>`;
        document.body.appendChild(bg); requestAnimationFrame(()=>bg.classList.add('show'));
        const close=(v)=>{ bg.classList.remove('show'); setTimeout(()=>bg.remove(),200); res(v); };
        bg.querySelector('[data-x]').addEventListener('click',()=>close(false));
        bg.addEventListener('click',(e)=>{ if(e.target===bg) close(false); });
        let category=null;const send=bg.querySelector('[data-o]');
        bg.querySelectorAll('[data-reason]').forEach(b=>b.addEventListener('click',()=>{bg.querySelectorAll('[data-reason]').forEach(x=>x.classList.remove('on'));b.classList.add('on');category=b.dataset.reason;send.disabled=false;}));
        send.addEventListener('click',async(e)=>{
          const btn=e.target; btn.disabled=true; btn.innerHTML='<span class="loader"></span>';
          const details=bg.querySelector('#rp-details').value.trim();
          if(['safety','harassment','discrimination','sexual','fraud','impersonation','other'].includes(category)&&details.length<15){btn.disabled=false;btn.textContent='Send privately';this.alert({title:'A little more context',message:'Please add at least one clear sentence so a moderator has enough to act on.'});return;}
          let data,error;
          try{({data,error}=await this.withTimeout(this.sb.rpc('ch_file_report',{p_target_kind:opts.kind,p_category:category,p_details:details||null,p_listing:opts.listing||null,p_member:opts.member||null,p_evidence:[],p_context_application:opts.contextApplication||null}),20000));}
          catch(networkError){error=networkError;}
          close(!error);
          if(error){
            this.alert({
              title: this.isRateLimited(error)?'Hold on a second':'Could not send',
              message: this.friendlyError(error,'That report didn\u2019t go through. Try again shortly.')
            });
          } else {
            this.lsSet('last_report',Date.now());
            this.alert({title:'Report sent',message:`A moderator will take a look${data&&data.case_number?' under case '+data.case_number:''}. Thank you for helping protect the next person.`});
          }
        });
      });
    },

    // ---- public hirer / company profile ----
    async openHirerProfile(hirerId){
      if(!hirerId){this.alert({title:'Profile unavailable',message:'This hiring profile is missing its member reference.'});return;}
      let p=null;
      try{
        const rpc=await this.sb.rpc('hirer_public_profile',{hirer:hirerId});
        p=(rpc.data&&rpc.data[0])||null;
        if(rpc.error||!p){
          const fallback=await this.sb.from('profiles').select('id,full_name,city,company_name,company_about,company_logo,company_site,company_founded,company_size,id_verified,is_mentor').eq('id',hirerId).maybeSingle();
          p=fallback.data||null;
        }
      }catch(e){p=null;}
      if(!p){this.alert({title:'Profile unavailable',message:'This hiring profile is not viewable right now. The listing is still available.'});return;}
      const since=p.member_since?new Date(p.member_since):null;
      const months=since?Math.max(0,Math.floor((Date.now()-since)/2629800000)):0;
      const age=!since?'—':months<1?'New this month':months<12?`${months} month${months===1?'':'s'} on Creative House`:`${Math.floor(months/12)} year${months>=24?'s':''} on Creative House`;
      const bg=document.createElement('div'); bg.className='cdialog-bg';
      bg.innerHTML=`<div class="cdialog hirer-card" role="dialog" aria-modal="true">
        <div class="hp-cover"><span>VISUAREALM CASTING / HIRER PROFILE</span><b>The room behind the role.</b><i></i></div>
        <div class="hp-head">
          ${this.safeImageUrl(p.company_logo)?`<img class="hp-logo" src="${this.esc(this.safeImageUrl(p.company_logo))}" alt="${this.esc(p.company_name||p.full_name||'Hiring team')} logo">`:`<div class="hp-logo ph">${this.esc((p.company_name||p.full_name||'?').slice(0,1).toUpperCase())}</div>`}
          <div><span class="hp-kicker">Applicant-facing company profile</span><h4>${this.esc(p.company_name||p.full_name||'Hiring member')}</h4><div class="hp-sub">${this.esc([p.full_name&&p.company_name?p.full_name:null,p.city].filter(Boolean).join(' · '))||'Creative House'}</div></div>
        </div>
        <div class="hp-badges">${p.id_verified?'<span class="hp-b ok">Verified identity</span>':'<span class="hp-b">Verification pending</span>'}${p.is_mentor?'<span class="hp-b mentor">Mentor</span>':''}</div>
        <div class="hp-trust"><span><i>01</i><b>Real identity</b><small>${p.id_verified?'Verified by the House':'Verification in progress'}</small></span><span><i>02</i><b>Visible history</b><small>${p.listings_posted||0} listing${(p.listings_posted||0)===1?'':'s'} posted</small></span><span><i>03</i><b>Reportable</b><small>Safety tools stay available</small></span></div>
        <section class="hp-story"><span>ABOUT THIS ROOM</span><p class="hp-about">${this.esc(p.company_about||'This hirer has not added their full company story yet. Read the listing carefully and use the reporting tools if anything feels unclear.')}</p></section>
        <div class="hp-stats">
          <div><span class="n">${p.listings_posted||0}</span><span class="l">Listings posted</span></div>
          <div><span class="n">${p.people_hired||0}</span><span class="l">People hired</span></div>
          <div><span class="n">${p.company_founded?this.esc(p.company_founded):'—'}</span><span class="l">Founded</span></div>
          <div><span class="n">${p.company_size?this.esc(p.company_size):'—'}</span><span class="l">Team size</span></div>
        </div>
        <div class="hp-age"><i></i>${this.esc(age)}</div>
        <div class="hp-profile-actions">${this.safeUrl(p.company_site)?`<a class="btn solid" href="${this.esc(this.safeUrl(p.company_site))}" target="_blank" rel="noopener noreferrer">Visit their website</a>`:''}<button class="btn ghost" data-x>Return to the listing</button></div>
        <div class="cd-actions"><span>Something does not feel right?</span><button class="report-btn" data-report-hirer>Report this hirer privately</button></div>
      </div>`;
      document.body.appendChild(bg); requestAnimationFrame(()=>bg.classList.add('show'));
      const close=()=>{ bg.classList.remove('show'); setTimeout(()=>bg.remove(),200); };
      bg.querySelector('[data-x]').addEventListener('click',close);
      bg.querySelector('[data-report-hirer]').addEventListener('click',()=>{close();setTimeout(()=>this.reportMember(hirerId,null,'Report this hirer'),220);});
      bg.addEventListener('click',(e)=>{ if(e.target===bg) close(); });
    },

    // ---- google oauth ----
    async signInWithGoogle(mode,legal){
      const redirect=location.origin+(this.routes&&this.routes.afterLogin?this.routes.afterLogin:'/dashboard/');
      return this.sb.auth.signInWithOAuth({
        provider:'google',
        options:{ redirectTo:redirect, queryParams:{ access_type:'offline', prompt:'consent' }, data:(mode||legal)?{primary_mode:mode||'applicant',...(legal||{})}:undefined }
      });
    },

    // password rule (used at signup)
    passwordIssue(pw){
      if(!pw||pw.length<12) return "Use at least 12 characters. A short phrase works beautifully.";
      if(pw.length>72) return "Keep it to 72 characters or fewer.";
      if(/^\s|\s$/.test(pw)) return "Remove the space at the beginning or end.";
      const flat=pw.toLowerCase().replace(/[^a-z0-9]/g,'');
      if(['password','password123','qwerty123456','letmein123456','creativehouse','visuarealm'].includes(flat)) return "That one is too easy to guess. Make it more personal.";
      if(!/[a-z]/.test(pw)) return "Add at least one lowercase letter.";
      if(!/[A-Z]/.test(pw)) return "Add at least one capital letter.";
      if(!/[0-9]/.test(pw)) return "Add at least one number.";
      return null;
    },

    // maintenance gate — everyone except admins is held out
    enforceMaintenance(profile, settings){
      if(!settings || !settings.maintenance_active) return true;
      if(profile && profile.is_admin) return true;
      const custom=(settings.maintenance_message||'').trim();
      document.body.innerHTML=`<div class="gate maint"><div class="gate-card">
        <div class="maint-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <span class="eyebrow">Creative House</span>
        <h1 class="page" style="margin:8px 0 14px;">We\u2019ll Be Right Back</h1>
        <p class="lead" style="margin:0 auto 8px;">Creative House is currently under maintenance. We\u2019re making things better behind the curtain.</p>
        ${custom?`<p class="maint-when">${this.esc(custom)}</p>`:''}
        <div style="margin-top:24px;"><a class="btn ghost" href="mailto:${SUPPORT_EMAIL}">Contact Support</a></div>
        <div style="margin-top:14px;"><button class="linkbtn" id="mnt-out">Sign out</button></div>
      </div></div>`;
      const o=document.getElementById('mnt-out'); if(o) o.addEventListener('click',()=>this.signOut());
      return false;
    },

    // ---- in-app dialogs (never rely on browser confirm/alert/prompt) ----
    confirm(opts){
      const o=typeof opts==='string'?{message:opts}:(opts||{});
      const title=o.title||'Just checking', message=o.message||'', ok=o.ok||'Confirm', cancel=o.cancel||'Cancel', danger=!!o.danger;
      return new Promise((res)=>{
        const bg=document.createElement('div'); bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog" role="dialog" aria-modal="true"><h4>${this.esc(title)}</h4><p>${this.esc(message)}</p>
          <div class="cd-actions"><button class="btn ghost sm" data-x>${this.esc(cancel)}</button>
          <button class="btn ${danger?'':'solid'} sm" data-o ${danger?'style="background:var(--ember);color:var(--obsidian);"':''}>${this.esc(ok)}</button></div></div>`;
        document.body.appendChild(bg); requestAnimationFrame(()=>bg.classList.add('show'));
        const done=(v)=>{ bg.classList.remove('show'); setTimeout(()=>bg.remove(),200); res(v); };
        bg.querySelector('[data-x]').addEventListener('click',()=>done(false));
        bg.querySelector('[data-o]').addEventListener('click',()=>done(true));
        bg.addEventListener('click',(e)=>{ if(e.target===bg) done(false); });
      });
    },
    typeConfirm(opts){
      const o=opts||{}, title=o.title||'Confirm deletion', message=o.message||'', phrase=o.phrase||'DELETE', ok=o.ok||'Delete forever', cancel=o.cancel||'Cancel';
      return new Promise((res)=>{
        const bg=document.createElement('div'); bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog type-confirm" role="dialog" aria-modal="true" aria-labelledby="type-confirm-title">
          <span class="dialog-kicker">Permanent action</span><h4 id="type-confirm-title">${this.esc(title)}</h4><p>${this.esc(message)}</p>
          <label class="type-confirm-label">Type <strong>${this.esc(phrase)}</strong> to continue<input data-i autocomplete="off" spellcheck="false" placeholder="${this.esc(phrase)}"></label>
          <div class="cd-actions"><button class="btn ghost sm" data-x>${this.esc(cancel)}</button><button class="btn sm" data-o disabled>${this.esc(ok)}</button></div></div>`;
        document.body.appendChild(bg); requestAnimationFrame(()=>{bg.classList.add('show');bg.querySelector('[data-i]').focus();});
        const input=bg.querySelector('[data-i]'), submit=bg.querySelector('[data-o]');
        input.addEventListener('input',()=>{const ready=input.value.trim()===phrase;submit.disabled=!ready;submit.classList.toggle('type-ready',ready);});
        const done=(v)=>{bg.classList.remove('show');setTimeout(()=>bg.remove(),200);res(v);};
        bg.querySelector('[data-x]').addEventListener('click',()=>done(false));
        submit.addEventListener('click',()=>{if(!submit.disabled)done(true);});
        input.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!submit.disabled)done(true);if(e.key==='Escape')done(false);});
        bg.addEventListener('click',(e)=>{if(e.target===bg)done(false);});
      });
    },
    secretConfirm(opts){
      const o=opts||{},title=o.title||'Private confirmation',message=o.message||'',ok=o.ok||'Continue',label=o.label||'Private password';
      return new Promise((res)=>{
        const bg=document.createElement('div');bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog secret-confirm" role="dialog" aria-modal="true" aria-labelledby="secret-confirm-title"><span class="dialog-kicker">Administrator verification</span><h4 id="secret-confirm-title">${this.esc(title)}</h4><p>${this.esc(message)}</p><label class="type-confirm-label">${this.esc(label)}<span class="secret-input"><input data-i type="password" autocomplete="off" spellcheck="false" placeholder="Enter your private password"><button type="button" data-show aria-label="Show password">Show</button></span></label><div class="cd-actions"><button class="btn ghost sm" data-x>Not now</button><button class="btn sm" data-o disabled>${this.esc(ok)}</button></div></div>`;
        document.body.appendChild(bg);requestAnimationFrame(()=>{bg.classList.add('show');bg.querySelector('[data-i]').focus();});
        const input=bg.querySelector('[data-i]'),submit=bg.querySelector('[data-o]'),done=v=>{bg.classList.remove('show');setTimeout(()=>bg.remove(),200);res(v);};
        input.addEventListener('input',()=>{submit.disabled=input.value.length<8;submit.classList.toggle('type-ready',!submit.disabled);});
        bg.querySelector('[data-show]').addEventListener('click',e=>{const visible=input.type==='text';input.type=visible?'password':'text';e.currentTarget.textContent=visible?'Show':'Hide';input.focus();});
        bg.querySelector('[data-x]').addEventListener('click',()=>done(null));submit.addEventListener('click',()=>{if(!submit.disabled)done(input.value);});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!submit.disabled)done(input.value);if(e.key==='Escape')done(null);});bg.addEventListener('click',e=>{if(e.target===bg)done(null);});
      });
    },
    alert(opts){
      const o=typeof opts==='string'?{message:opts}:(opts||{});
      const title=o.title||'Heads up', message=o.message||'', ok=o.ok||'Got it';
      return new Promise((res)=>{
        const bg=document.createElement('div'); bg.className='cdialog-bg';
        bg.innerHTML=`<div class="cdialog" role="dialog" aria-modal="true"><h4>${this.esc(title)}</h4><p>${this.esc(message)}</p><div class="cd-actions"><button class="btn solid sm" data-o>${this.esc(ok)}</button></div></div>`;
        document.body.appendChild(bg); requestAnimationFrame(()=>bg.classList.add('show'));
        const done=()=>{ bg.classList.remove('show'); setTimeout(()=>bg.remove(),200); res(true); };
        bg.querySelector('[data-o]').addEventListener('click',done);
        bg.addEventListener('click',(e)=>{ if(e.target===bg) done(); });
      });
    },

    // ---- local convenience: saved filters + recent searches (#8) ----
    lsGet(k,def){ try{ return JSON.parse(localStorage.getItem("vr_"+k)) ?? def; }catch(e){ return def; } },
    lsSet(k,v){ try{ localStorage.setItem("vr_"+k, JSON.stringify(v)); }catch(e){} },
    pushRecentSearch(q){ if(!q) return; let r=this.lsGet("recent",[]); r=[q,...r.filter(x=>x!==q)].slice(0,6); this.lsSet("recent",r); return r; },

    // ---- floating report / feedback widget (#8, support #2) ----
    mountFeedback(){
      if(document.getElementById("vr-fab")) return;
      const fab=document.createElement("button"); fab.id="vr-fab"; fab.className="fab"; fab.setAttribute('aria-label','Open support, feedback or reporting'); fab.innerHTML='<span class="fab-mark" aria-hidden="true">?</span><span>Support</span>';
      const panel=document.createElement("div"); panel.className="fab-panel"; panel.id="vr-fabpanel";
      panel.innerHTML=`<div class="fab-head"><div><span class="fab-eyebrow">A direct line to the house</span><h4>How can we help?</h4></div><button class="fab-close" id="vr-fbclose" aria-label="Close">&times;</button></div>
        <p class="fab-intro">Share an idea, flag something that does not feel right, or tell us when the site gets in your way. Reports stay private with the team.</p>
        <div class="seg" aria-label="Message type"><button data-k="feedback" class="on">Idea</button><button data-k="report">Report</button><button data-k="bug">Site issue</button></div>
        <label class="fab-label" for="vr-fbmsg">Your note</label><textarea id="vr-fbmsg" maxlength="4000" placeholder="Give us the details that would help us understand."></textarea>
        <div class="alert" id="vr-fbalert"></div>
        <button class="btn solid full sm" id="vr-fbsend">Send privately</button>
        <p class="fab-email">Prefer email? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`;
      document.body.appendChild(fab); document.body.appendChild(panel);
      let kind="feedback";
      fab.addEventListener("click",()=>panel.classList.toggle("show"));
      panel.querySelector('#vr-fbclose').addEventListener('click',()=>panel.classList.remove('show'));
      panel.querySelectorAll(".seg button").forEach(b=>b.addEventListener("click",()=>{panel.querySelectorAll(".seg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");kind=b.dataset.k;}));
      document.getElementById("vr-fbsend").addEventListener("click", async ()=>{
        const msg=document.getElementById("vr-fbmsg").value.trim(); const al=document.getElementById("vr-fbalert");
        const btn=document.getElementById("vr-fbsend");
        if(!msg){ this.toast(al,"Write a short note first.","err"); return; }
        if(msg.length<8){ this.toast(al,"A few more words would help us actually fix it.","err"); return; }
        // client-side speed bump; the database holds the real line
        const wait=Math.ceil((20000-(Date.now()-this.lsGet("last_feedback",0)))/1000);
        if(wait>0){ this.toast(al,`Give it ${wait} more second${wait===1?"":"s"}. We got the last one.`,"err"); return; }
        const s=await this.getSession();if(!s){this.toast(al,"Sign in before sending. This protects the support line from spam.","err");return;}const user_id=s.user.id,email=s.user.email;
        btn.disabled=true; const label=btn.textContent; btn.innerHTML='<span class="loader"></span>';
        let error;try{({error}=await this.withTimeout(client.from("feedback").insert({user_id,email,kind,page:location.pathname,message:msg}),20000));}catch(x){error=x;}
        btn.disabled=false; btn.textContent=label;
        if(error){ this.toast(al,this.friendlyError(error,"That didn\u2019t send. Try again in a moment."),"err"); return; }
        this.lsSet("last_feedback",Date.now());
        this.toast(al,"Thank you. Sent.","ok"); document.getElementById("vr-fbmsg").value="";
        setTimeout(()=>panel.classList.remove("show"),1100);
      });
    },

    // ---- member changelog (uses the existing announcement field) ----
    parseChangelog(raw){
      const fallback={title:'A note from Creative House',version:'New update',intro:String(raw||''),points:[],closing:'You belong here.'};
      if(!raw) return fallback;
      if(!String(raw).startsWith('VR_UPDATE::')) return fallback;
      try{const parsed=JSON.parse(String(raw).slice(11));return {...fallback,...parsed,points:Array.isArray(parsed.points)?parsed.points:[]};}catch(e){return fallback;}
    },
    stringifyChangelog(update){return 'VR_UPDATE::'+JSON.stringify({title:update.title||'',version:update.version||'',intro:update.intro||'',points:(update.points||[]).slice(0,6),closing:update.closing||''});},
    changelogKey(update){
      const input=[update.title,update.version,update.intro,...(update.points||[])].join('|');let h=2166136261;
      for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}return 'vr-update-'+(h>>>0).toString(36);
    },
    showChangelog(update,opts={}){
      if(document.getElementById('vr-changelog')) return;
      const bg=document.createElement('div');bg.id='vr-changelog';bg.className='changelog-bg';
      const points=(update.points||[]).filter(Boolean);
      bg.innerHTML=`<section class="changelog-card" role="dialog" aria-modal="true" aria-labelledby="change-title"><div class="change-art" aria-hidden="true"><span>V</span><i></i><b>R</b></div><div class="change-content"><span class="change-kicker">${this.esc(update.version||'New update')}</span><h2 id="change-title">${this.esc(update.title||'What is new')}</h2><p class="change-intro">${this.esc(update.intro||'')}</p>${points.length?`<ul class="change-list">${points.map((p,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><b>${this.esc(p)}</b></li>`).join('')}</ul>`:''}<p class="change-close">${this.esc(update.closing||'You belong here.')}</p><div class="change-actions"><button class="btn solid" data-change-close>${opts.preview?'Close preview':'I understand'}</button>${opts.preview?'<span class="preview-label">Admin preview</span>':''}</div></div></section>`;
      document.body.appendChild(bg);requestAnimationFrame(()=>bg.classList.add('show'));
      const close=()=>{if(opts.seenKey){try{localStorage.setItem(opts.seenKey,'seen');}catch(e){}}bg.classList.remove('show');setTimeout(()=>bg.remove(),240);};
      bg.querySelector('[data-change-close]').addEventListener('click',close);
      return bg;
    },
    mountChangelog(settings){
      if(!settings||!settings.announcement_active||!settings.announcement) return;
      const update=this.parseChangelog(settings.announcement),key=this.changelogKey(update);
      try{if(localStorage.getItem(key)==='seen')return;}catch(e){}
      setTimeout(()=>this.showChangelog(update,{seenKey:key}),360);
    },

    // ---- warm status copy (client-side prettifier) ----
    STATUS_COPY:{
      submitted:{t:"Sent",m:"It's in their hands now."},
      shortlisted:{t:"Shortlisted",m:"They're interested. Stay ready."},
      hired:{t:"Hired",m:"You're in. Go make something."},
      reviewing:{t:"Being considered",m:"Someone's reading your application."},
      interview:{t:"Interview",m:"They want to talk. Big step."},
      accepted:{t:"Accepted",m:"You're in. Go make something."}
    },

    // ---- global footer on every page ----
    mountFooter(){
      if(document.querySelector('.site-foot')) return;
      const f=document.createElement('footer'); f.className='site-foot';
      f.innerHTML=`<div class="sf-inner">
        <span class="sf-brand">VISUA<b>REALM</b> · Creative House</span>
        <nav class="sf-links">
          <a href="/creative-house/">The House</a>
          <a href="/pricing/">Pricing</a>
          <a href="/community-guidelines.html">Community Standards</a>
          <a href="/terms.html">Terms</a>
          <a href="/billing-terms.html">Billing</a>
          <a href="/privacy.html">Privacy</a>
          <button type="button" data-privacy>Cookie choices</button>
          <a href="mailto:${SUPPORT_EMAIL}">Contact</a>
        </nav>
        <span class="sf-legal">© ${new Date().getFullYear()} VISUAREALM. Built together.</span>
      </div>`;
      document.body.appendChild(f);
      f.querySelector('[data-privacy]').addEventListener('click',()=>this.mountPrivacy(true));
    },

    // ---- privacy choice: remembered once per browser, analytics never assumed ----
    PRIVACY_KEY:'vr_privacy_v1',
    privacyChoice(){try{return JSON.parse(localStorage.getItem(this.PRIVACY_KEY)||'null');}catch(e){return null;}},
    applyPrivacy(choice){
      const analytics=!!(choice&&choice.analytics);document.documentElement.dataset.analyticsConsent=analytics?'granted':'denied';
      window.dispatchEvent(new CustomEvent('vr:privacy-consent',{detail:{analytics,essential:true}}));
    },
    mountPrivacy(force=false){
      const saved=this.privacyChoice();if(saved&&!force){this.applyPrivacy(saved);return;}document.getElementById('vr-privacy-bg')?.remove();
      const bg=document.createElement('div');bg.id='vr-privacy-bg';bg.className='privacy-bg';
      bg.innerHTML=`<section class="privacy-card" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <div class="privacy-sigil" aria-hidden="true"><i></i><span>VR</span></div>
        <div class="privacy-copy"><span class="dialog-kicker">Your visit, your choice</span><h2 id="privacy-title">A quieter kind of cookie notice.</h2><p>Essential storage keeps sign-in and security working. Optional analytics would help us understand which pages are useful. We do not need advertising cookies to build this House.</p>
          <button type="button" class="privacy-more" data-more>See exactly what this means <span>+</span></button>
          <div class="privacy-detail" hidden><div><span><b>Essential</b><small>Sign-in, safety, preferences</small></span><em>Always on</em></div><div><span><b>Analytics</b><small>Anonymous product-use signals</small></span><em>Optional</em></div><a href="/privacy.html">Read the Privacy Policy ↗</a></div>
        </div>
        <div class="privacy-actions"><button type="button" class="btn solid" data-accept>Allow analytics</button><button type="button" class="btn ghost" data-essential>Essential only</button>${force?'<button type="button" class="privacy-close" data-close>Keep current choice</button>':''}</div>
      </section>`;
      document.body.appendChild(bg);requestAnimationFrame(()=>bg.classList.add('show'));
      const close=()=>{bg.classList.remove('show');setTimeout(()=>bg.remove(),260);};
      const save=(analytics)=>{const choice={version:1,essential:true,analytics,decided_at:new Date().toISOString()};try{localStorage.setItem(this.PRIVACY_KEY,JSON.stringify(choice));}catch(e){}this.applyPrivacy(choice);close();};
      bg.querySelector('[data-accept]').addEventListener('click',()=>save(true));bg.querySelector('[data-essential]').addEventListener('click',()=>save(false));
      bg.querySelector('[data-more]').addEventListener('click',e=>{const d=bg.querySelector('.privacy-detail'),open=d.hidden;d.hidden=!open;e.currentTarget.classList.toggle('open',open);e.currentTarget.querySelector('span').textContent=open?'−':'+';});
      bg.querySelector('[data-close]')?.addEventListener('click',()=>{if(saved)this.applyPrivacy(saved);close();});
    },

    // ---- back control (browser back with a safe fallback) ----
    wireBack(fallback){
      document.querySelectorAll('.backbtn').forEach(b=>b.addEventListener('click',(e)=>{
        e.preventDefault();
        if(history.length>1) history.back(); else window.location.href=fallback||'/dashboard/';
      }));
    },

    // ---- rules acknowledgement gate (shown before first dashboard entry) ----
    async ensureRulesAccepted(profile){
      if(!profile || profile.agreed_guidelines_at) return true;
      return new Promise((resolve)=>{
        const bg=document.createElement('div'); bg.className='modal-bg show'; bg.style.zIndex='90';
        bg.innerHTML=`<div class="modal rules-gate-card" style="max-width:620px;">
          <div class="rules-gate-head"><span class="rules-mark" aria-hidden="true">VR</span><div><span class="eyebrow">Before you step in</span><h3>The house is shared.</h3></div></div>
          <p class="rules-intro">This is a space for people building their way in. The work only matters when the people making it feel respected, safe and taken seriously.</p>
          <div class="rules-promise"><strong>A promise to each other</strong><span>Five things every member agrees to before entering.</span></div>
          <ul class="rules-list">
            <li><b>Respect the room.</b><span>Treat people with care, on set, online and everywhere between.</span></li>
            <li><b>Protect one another.</b><span>No harassment, discrimination or predatory behaviour.</span></li>
            <li><b>Be real.</b><span>Be who you say you are and only present work that is yours.</span></li>
            <li><b>Keep opportunities honest.</b><span>No scams, fake productions, surprise fees or hidden expectations.</span></li>
            <li><b>Communicate.</b><span>If plans change, say so. People are making real decisions around you.</span></li>
          </ul>
          <p class="rules-links">Read the full <a href="/community-guidelines.html" target="_blank" rel="noopener noreferrer">Community Standards</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
          <label class="agree rules-agree">
            <input type="checkbox" id="rg-check" style="width:auto;margin-top:3px;flex:none;">
            <span>I understand what this community asks of me, and I agree to show up with care.</span>
          </label>
          <button class="btn solid full" id="rg-go" disabled>Enter the Creative House</button>
        </div>`;
        document.body.appendChild(bg);
        const chk=bg.querySelector('#rg-check'), go=bg.querySelector('#rg-go');
        chk.addEventListener('change',()=>{ go.disabled=!chk.checked; });
        go.addEventListener('click', async ()=>{
          go.disabled=true; go.innerHTML='<span class="loader"></span>';
          try{ await client.from('profiles').update({agreed_guidelines_at:new Date().toISOString()}).eq('id',profile.id); }catch(e){}
          profile.agreed_guidelines_at=new Date().toISOString();
          bg.remove(); resolve(true);
        });
      });
    },

    // ---- notifications: grouping + copy ----
    // Buckets the panel splits into, in the order they matter.
    NOTIF_GROUPS:[
      { key:'applicants',  label:'Your listings',  kinds:['application_new','application'] },
      { key:'status',      label:'Your applications', kinds:['status','application_status','hired','shortlisted'] },
      { key:'rewards',     label:'Rewards',        kinds:['badge','reward'] },
      { key:'house',       label:'From the house', kinds:['moderation','announcement','system','expiring','listing'] }
    ],
    notifGroup(n){
      const k=(n.kind||'').toLowerCase();
      const g=this.NOTIF_GROUPS.find(x=>x.kinds.includes(k));
      return g?g.key:'house';
    },
    // "3 new applicants" reads better than three rows that each say a name.
    notifCountChip(n){
      const c=Number(n.event_count||1);
      return c>1?`<span class="bell-count" aria-label="${c} updates">${c>99?'99+':c}</span>`:'';
    },
    notifWhen(ts){
      if(!ts) return '';
      const m=Math.floor((Date.now()-new Date(ts))/60000);
      if(m<1) return 'Just now';
      if(m<60) return m+'m ago';
      if(m<1440) return Math.floor(m/60)+'h ago';
      if(m<10080) return Math.floor(m/1440)+'d ago';
      return this.fmtDate(ts);
    },

    // ---- notifications bell ----
    async mountNotifications(){
      if(!client || document.getElementById('vr-bell')) return;
      const s=await this.getSession(); if(!s) return;
      const nav=document.querySelector('.appbar nav'); if(!nav) return;
      const wrap=document.createElement('div'); wrap.className='bell-wrap'; wrap.id='vr-bell';
      wrap.innerHTML=`<button class="bell" id="bell-btn" aria-label="Notifications"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg><span class="bell-dot" id="bell-dot" style="display:none;"></span></button>
        <div class="bell-panel" id="bell-panel"><div class="bell-head"><span>Notifications</span><button class="bell-readall" id="bell-readall" hidden>Mark all read</button></div><div id="bell-list"></div></div>`;
      nav.insertBefore(wrap, nav.firstChild);
      const btn=wrap.querySelector('#bell-btn'), panel=wrap.querySelector('#bell-panel'), dot=wrap.querySelector('#bell-dot'),
            list=wrap.querySelector('#bell-list'), readAll=wrap.querySelector('#bell-readall');

      const render=(rows)=>{
        if(!rows.length){ list.innerHTML='<div class="bell-empty">You\u2019re all caught up. Nice.</div>'; return; }
        // unread first, then newest — the panel should answer "what needs me?" immediately
        const sorted=[...rows].sort((a,b)=>(a.is_read===b.is_read?new Date(b.created_at)-new Date(a.created_at):(a.is_read?1:-1)));
        let html='';
        this.NOTIF_GROUPS.forEach(g=>{
          const items=sorted.filter(r=>this.notifGroup(r)===g.key);
          if(!items.length) return;
          const un=items.filter(r=>!r.is_read).length;
          html+=`<div class="bell-group"><div class="bell-group-head">${this.esc(g.label)}${un?`<span class="bell-count sm">${un}</span>`:''}</div>`;
          html+=items.map(r=>{
            const clickable=!!r.link;
            return `<div class="bell-item ${r.is_read?'':'unread'} ${clickable?'clickable':''}" data-id="${r.id}" ${clickable?`data-link="${this.esc(r.link)}"`:''} ${clickable?'role="link" tabindex="0"':''}>
              <button class="bell-dismiss" data-dismiss="${r.id}" aria-label="Dismiss" title="Dismiss">&times;</button>
              <div class="bi-t">${this.notifCountChip(r)}${this.esc(r.title||'Update')}</div>
              <div class="bi-b">${this.esc(r.body||'')}</div>
              <div class="bi-m">${this.esc(this.notifWhen(r.created_at))}</div>
            </div>`;
          }).join('');
          html+='</div>';
        });
        html+='<button class="bell-clear" id="bell-clear">Clear all</button>';
        list.innerHTML=html;
      };

      const load=async()=>{
        const {data}=await client.from('notifications').select('*').eq('user_id',s.user.id).order('created_at',{ascending:false}).limit(40);
        const rows=data||[]; const unread=rows.filter(r=>!r.is_read).length;
        dot.style.display=unread?'block':'none';
        readAll.hidden=!unread;
        render(rows);

        list.querySelectorAll('[data-dismiss]').forEach(x=>x.addEventListener('click',async(e)=>{
          e.stopPropagation(); await client.from('notifications').delete().eq('id',x.dataset.dismiss); load();
        }));
        // opening one marks that one read — not the whole panel
        list.querySelectorAll('.bell-item.clickable').forEach(x=>{
          const go=async()=>{ await client.from('notifications').update({is_read:true}).eq('id',x.dataset.id); location.href=this.safeAppPath(x.dataset.link); };
          x.addEventListener('click',go);
          x.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } });
        });
        const clr=list.querySelector('#bell-clear');
        if(clr) clr.addEventListener('click',async()=>{
          if(!(await this.confirm({title:'Clear everything?',message:'This empties your panel. Nothing else changes. Your applications and listings stay exactly where they are.',ok:'Clear all'}))) return;
          await client.from('notifications').delete().eq('user_id',s.user.id); load();
        });
        return {rows,unread};
      };

      const {unread}=await load();
      // gentle one-time toast for the newest unread update
      if(unread){ const {data}=await client.from('notifications').select('*').eq('user_id',s.user.id).eq('is_read',false).order('created_at',{ascending:false}).limit(1);
        if(data&&data[0]) this.notifyToast(data[0]); }

      // opening the panel no longer clears every unread flag — that was why
      // things vanished before you'd read them. Read is now deliberate.
      readAll.addEventListener('click', async (e)=>{
        e.stopPropagation();
        await client.from('notifications').update({is_read:true}).eq('user_id',s.user.id).eq('is_read',false);
        await load();
      });
      btn.addEventListener('click', async ()=>{ if(panel.classList.toggle('show')) await load(); });
      document.addEventListener('click',(e)=>{ if(!wrap.contains(e.target)) panel.classList.remove('show'); });
    },
    notifyToast(n){
      const t=document.createElement('div'); t.className='notif-toast';
      t.innerHTML=`<div class="nt-t">${this.esc(n.title||'Update')}</div><div class="nt-b">${this.esc(n.body||'')}</div>`;
      document.body.appendChild(t);
      requestAnimationFrame(()=>t.classList.add('show'));
      setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),400); }, 6500);
      t.addEventListener('click',()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),400); });
    }
  };
  window.CH = CH;
  const startPrivacy=()=>CH.mountPrivacy(false);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startPrivacy,{once:true});else startPrivacy();
})();

/* =====================================================================
   VISUAREALM · CREATIVE HOUSE — SHARED APP HELPERS (v3)
   ===================================================================== */
(function () {
  const CFG = window.VISUAREALM_CONFIG || {};
  const configured = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
    !CFG.SUPABASE_URL.includes("PASTE_") && !CFG.SUPABASE_ANON_KEY.includes("PASTE_");
  let client = null;
  if (configured && window.supabase) client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  // ---- taxonomy ----
  const DISCIPLINES = ["Filmmaker", "Crew", "Cast", "Photographer"];
  const ROLES_BY_DISCIPLINE = {
    Filmmaker: ["Directing", "Producing", "Writing", "Development", "Assistant Director", "Production Assistant"],
    Crew: ["Cinematography", "Camera", "Lighting", "Gaffing", "Grip", "Production Design", "Wardrobe", "Hair & Makeup", "Editing", "Colour", "Sound", "VFX", "Animation", "Motion Graphics"],
    Cast: ["Lead Role", "Supporting Role", "Background / Extra", "Voice"],
    Photographer: ["Photography", "Behind The Scenes", "Stills", "Unit Photography"]
  };
  const ALL_ROLES = Object.values(ROLES_BY_DISCIPLINE).flat();
  const CITIES = ["Toronto"]; // Toronto-exclusive for now (#5)

  const CH = {
    cfg: CFG, configured, sb: client, routes: CFG.ROUTES || {},
    DISCIPLINES, ROLES_BY_DISCIPLINE, ALL_ROLES, CITIES,

    async requireAuth() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      if (!data.session) { window.location.href = this.routes.afterLogout || "/create-account/"; return null; }
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
    async signOut() { if (client) await client.auth.signOut(); window.location.href = this.routes.afterLogout || "/create-account/"; },

    esc(v){ if(v==null) return ""; return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
    pill(s){ s=(s||"").toLowerCase(); return `<span class="pill ${s}">${this.esc(s.charAt(0).toUpperCase()+s.slice(1))}</span>`; },
    fmtDate(ts){ if(!ts) return "—"; try{return new Date(ts).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}catch(e){return "—";} },
    toast(el,msg,kind){ if(!el){alert(msg);return;} el.textContent=msg; el.className="alert show "+(kind==="ok"?"ok":"err"); },
    clearToast(el){ if(el) el.className="alert"; },
    guardConfig(sel){ if(configured) return true; const host=document.querySelector(sel)||document.body;
      const b=document.createElement("div"); b.className="alert err show"; b.style.cssText="margin:20px auto;max-width:560px";
      b.innerHTML="Setup needed: open <b>config.js</b> and paste your Supabase URL and key. See the README.";
      host.prepend(b); return false; },

    // ---- expiry (#4) ----
    timeLeft(expires){
      if(!expires) return {text:"No expiry",cls:""};
      const ms=new Date(expires)-new Date(); const d=Math.ceil(ms/86400000);
      if(d<0) return {text:"Expired",cls:"dead"};
      if(d===0) return {text:"Ends today",cls:"warn"};
      if(d<=7) return {text:d+" day"+(d>1?"s":"")+" left",cls:"warn"};
      return {text:d+" days left",cls:""};
    },

    // ---- badges (#10) ----
    async badgesFor(userId){
      if(!client) return [];
      const { data }=await client.from("user_badges").select("*, badges(label,description,kind,emoji)").eq("user_id",userId).order("awarded_at");
      return data||[];
    },
    async allBadges(){ if(!client) return []; const { data }=await client.from("badges").select("*"); return data||[]; },
    renderBadges(list){
      if(!list||!list.length) return '<span class="muted mono" style="font-size:.7rem;">No badges yet — they arrive as you take part.</span>';
      return '<div class="badge-grid">'+list.map(b=>{
        const m=b.badges||{}; return `<span class="badge-chip ${m.kind==='special'?'special':''}" title="${this.esc(m.description||'')}"><span class="bx">${this.esc(m.emoji||'+')}</span>${this.esc(m.label||b.badge_code)}</span>`;
      }).join('')+'</div>';
    },

    // ---- share links (#9) ----
    listingUrl(slug){ return `${location.origin}/listing/?id=${encodeURIComponent(slug)}`; },
    async copyShare(slug, btn){
      const url=this.listingUrl(slug);
      try{ await navigator.clipboard.writeText(url); if(btn){const t=btn.textContent; btn.textContent="Copied ✓"; setTimeout(()=>btn.textContent=t,1400);} }
      catch(e){ prompt("Copy this link:", url); }
    },

    // ---- floating report / feedback widget (#8) ----
    mountFeedback(){
      if(document.getElementById("vr-fab")) return;
      const fab=document.createElement("button"); fab.id="vr-fab"; fab.className="fab";
      fab.innerHTML='<span class="dot"></span> Feedback';
      const panel=document.createElement("div"); panel.className="fab-panel"; panel.id="vr-fabpanel";
      panel.innerHTML=`<h4>Report or feedback</h4>
        <div class="seg"><button data-k="feedback" class="on">Feedback</button><button data-k="report">Report</button><button data-k="bug">Bug</button></div>
        <textarea id="vr-fbmsg" placeholder="Tell us what's on your mind. Kept private, read by the team."></textarea>
        <div class="alert" id="vr-fbalert"></div>
        <button class="btn solid full sm" id="vr-fbsend">Send</button>`;
      document.body.appendChild(fab); document.body.appendChild(panel);
      let kind="feedback";
      fab.addEventListener("click",()=>panel.classList.toggle("show"));
      panel.querySelectorAll(".seg button").forEach(b=>b.addEventListener("click",()=>{
        panel.querySelectorAll(".seg button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); kind=b.dataset.k;
      }));
      document.getElementById("vr-fbsend").addEventListener("click", async ()=>{
        const msg=document.getElementById("vr-fbmsg").value.trim();
        const al=document.getElementById("vr-fbalert");
        if(!msg){ this.toast(al,"Write a short note first.","err"); return; }
        let user_id=null, email=null;
        const s=await this.getSession(); if(s){ user_id=s.user.id; email=s.user.email; }
        const { error }=await client.from("feedback").insert({ user_id, email, kind, page:location.pathname, message:msg });
        if(error){ this.toast(al,error.message,"err"); return; }
        this.toast(al,"Thank you — sent.","ok"); document.getElementById("vr-fbmsg").value="";
        setTimeout(()=>panel.classList.remove("show"),1100);
      });
    }
  };
  window.CH = CH;
})();
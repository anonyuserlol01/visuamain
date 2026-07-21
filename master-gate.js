/* VISUAREALM master maintenance gate — load after config.js. */
(function(){
  const root=document.documentElement,path=(location.pathname.replace(/\/+$/,'')||'/').toLowerCase();
  const AUTH_PATH='/create-account',MAINT_PATH='/maintenance';
  const release=()=>root.classList.remove('master-checking','master-redirecting');
  const deadline=(promise,ms=1000)=>Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(new Error('maintenance check timed out')),ms))]);
  const publish=(state)=>{window.VR_MASTER_STATE=state||{active:false};window.dispatchEvent(new CustomEvent('vr:master-state',{detail:window.VR_MASTER_STATE}));};
  // This check must never become a page loader. The page stays visible while
  // Supabase answers, which keeps Live Server and slow connections usable.

  if(path===MAINT_PATH||path.startsWith(MAINT_PATH+'/')){release();return;}
  const cfg=window.VISUAREALM_CONFIG||{};
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase){publish({active:false,error:'configuration'});release();return;}

  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let running=false,first=true;
  const adminSession=async()=>{const {data:{session}}=await deadline(sb.auth.getSession());if(!session)return false;const {data:profile}=await deadline(sb.from('profiles').select('is_admin').eq('id',session.user.id).maybeSingle());return !!(profile&&profile.is_admin);};
  const check=async()=>{
    if(running)return;running=true;
    try{
      const {data:state,error}=await deadline(sb.rpc('ch_master_maintenance_state'));if(error)throw error;const master=state||{active:false};publish(master);
      if(!master.active){root.classList.remove('master-auth-only','master-redirecting');release();return;}
      // Sign-in remains reachable. The account page listens to this state and
      // hides new-account entry while the master gate is active.
      if(path===AUTH_PATH||path.startsWith(AUTH_PATH+'/')){root.classList.add('master-auth-only');release();return;}
      if(await adminSession()){root.classList.add('master-admin-bypass');release();return;}
      location.replace('/maintenance/');
    }catch(error){
      // Fail open on a connectivity problem so a temporary API outage cannot
      // permanently lock the owner out of the site.
      if(first)publish({active:false,error:'unavailable'});release();
    }finally{running=false;first=false;}
  };
  check();setInterval(check,15000);
})();

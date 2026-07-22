(()=>{
  const path=(location.pathname.replace(/\/+$/,'')||'/').toLowerCase();
  const publicPaths=['/','/realm-pictures','/realm-music','/creative-house','/pricing'];
  if(!publicPaths.includes(path))return;

  const isHouse=path==='/creative-house';
  const pageKey=path==='/'?'company':path.slice(1).replace('/','-');
  document.body.classList.add('vr-public-page',`vr-${pageKey}-page`);

  const links=[
    ['/','VISUAREALM'],
    ['/realm-pictures/','Realm Pictures'],
    ['/realm-music/','Realm Music'],
    ['/creative-house/','Creative House']
  ];
  const current=href=>href==='/'?path==='/':path===href.replace(/\/$/,'');
  const linkMarkup=(mobile=false)=>links.map(([href,label],index)=>
    `<a href="${href}"${current(href)?' class="current" aria-current="page"':''}>${mobile?`<small>0${index+1}</small>`:''}<span>${label}</span></a>`
  ).join('');

  const oldHeader=document.querySelector('header.nav,header.site-nav');
  if(!oldHeader)return;
  oldHeader.className='vr-public-header';
  oldHeader.id='vr-public-header';
  oldHeader.innerHTML=`
    <a class="vr-public-brand" href="/" aria-label="VISUAREALM home">VISUA<span>REALM</span></a>
    <nav class="vr-desktop-nav" aria-label="Primary navigation">${linkMarkup()}</nav>
    <div class="vr-header-end">
      <span class="vr-nav-signal" aria-hidden="true"><i></i><span><b class="is-active">${isHouse?'You belong':'Stories · Sound · People'}</b><b>${isHouse?'Whatever pulls you in':'Independent · Toronto'}</b><b>${isHouse?'The House is open':'Three creative realms'}</b></span></span>
      <span class="vr-house-auth" id="vr-house-auth" ${isHouse?'':'hidden'} aria-live="polite"></span>
      <button class="vr-menu-toggle" id="vr-menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="vr-mobile-menu"><i></i></button>
    </div>`;

  const menu=document.createElement('aside');
  menu.className='vr-mobile-menu';menu.id='vr-mobile-menu';menu.setAttribute('aria-hidden','true');
  menu.innerHTML=`<div class="vr-menu-meta"><span>VISUAREALM / Navigation</span><span>Toronto · Canada</span></div><nav aria-label="Mobile navigation">${linkMarkup(true)}</nav><div class="vr-mobile-auth" id="vr-mobile-auth" ${isHouse?'':'hidden'}></div><p>Stories · Sound · People</p>`;
  document.body.appendChild(menu);

  const toggle=oldHeader.querySelector('#vr-menu-toggle');
  const signalWords=[...oldHeader.querySelectorAll('.vr-nav-signal b')];let signalIndex=0;
  if(signalWords.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)setInterval(()=>{signalWords[signalIndex].classList.remove('is-active');signalIndex=(signalIndex+1)%signalWords.length;signalWords[signalIndex].classList.add('is-active')},2800);
  const setMenu=open=>{toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');menu.classList.toggle('open',open);menu.setAttribute('aria-hidden',String(!open));document.body.classList.toggle('vr-menu-open',open);if(open)menu.querySelector('a')?.focus();};
  toggle.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));
  menu.addEventListener('click',event=>{if(event.target.closest('a,button'))setMenu(false)});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setMenu(false);toggle.focus();}});

  document.querySelectorAll('footer.footer').forEach(footer=>footer.remove());
  const footer=document.createElement('footer');footer.className='vr-public-footer';
  footer.innerHTML=`
    <div class="vr-footer-lead"><span>Independent creative company / Toronto</span><h2>Every beginning<br>deserves a <em>world.</em></h2></div>
    <div class="vr-footer-map"><a class="vr-footer-brand" href="/">VISUA<span>REALM</span></a><nav aria-label="Footer navigation">${linkMarkup()}<a href="/privacy.html"><span>Privacy</span></a><a href="/community-guidelines.html"><span>Community standards</span></a><a href="mailto:support@visuarealmstudios.com"><span>Support</span></a></nav></div>
    <div class="vr-footer-base"><span>© ${new Date().getFullYear()} VISUAREALM STUDIOS</span><span>Stories · Sound · People</span><a href="https://instagram.com/visuarealmstudios" target="_blank" rel="noopener noreferrer">Instagram ↗</a></div>`;
  document.body.appendChild(footer);

  if(!isHouse)return;
  const desktopAuth=document.getElementById('vr-house-auth'),mobileAuth=document.getElementById('vr-mobile-auth');
  const signedOut=()=>{
    desktopAuth.innerHTML='<a class="vr-auth-link" href="/create-account/">Sign in</a><a class="vr-auth-join" href="/create-account/?mode=signup">Create account</a>';
    mobileAuth.innerHTML='<a href="/create-account/">Sign in</a><a class="join" href="/create-account/?mode=signup">Create free account</a>';
  };
  const initials=value=>String(value||'Member').trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase();
  const signedIn=(session,profile)=>{
    const name=profile?.full_name||session.user.user_metadata?.full_name||session.user.email?.split('@')[0]||'Member';
    const mark=initials(name);
    desktopAuth.innerHTML=`<div class="vr-profile-menu"><button type="button" aria-expanded="false" aria-controls="vr-profile-popover" aria-label="Open profile menu for ${escapeHtml(name)}"><span>${escapeHtml(mark)}</span></button><div id="vr-profile-popover" class="vr-profile-popover" hidden><small>Signed in as</small><strong>${escapeHtml(name)}</strong><a href="/dashboard/">Dashboard</a><a href="/dashboard/?tab=Account">My profile</a><button type="button" data-vr-signout>Sign out</button></div></div>`;
    mobileAuth.innerHTML=`<div class="vr-mobile-member"><span>${escapeHtml(mark)}</span><div><small>Signed in as</small><strong>${escapeHtml(name)}</strong></div></div><a href="/dashboard/">Open dashboard</a><a href="/dashboard/?tab=Account">My profile</a><button type="button" data-vr-signout>Sign out</button>`;
    const trigger=desktopAuth.querySelector('.vr-profile-menu>button'),popover=desktopAuth.querySelector('.vr-profile-popover');
    const close=()=>{trigger.setAttribute('aria-expanded','false');popover.hidden=true;};
    trigger.addEventListener('click',event=>{event.stopPropagation();const open=trigger.getAttribute('aria-expanded')!=='true';trigger.setAttribute('aria-expanded',String(open));popover.hidden=!open;});
    document.addEventListener('click',event=>{if(!event.target.closest('.vr-profile-menu'))close()});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  };
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  signedOut();
  const cfg=window.VISUAREALM_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const refresh=async()=>{
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(!session){signedOut();return;}
      const {data:profile}=await sb.from('profiles').select('full_name').eq('id',session.user.id).maybeSingle();
      signedIn(session,profile);
      document.querySelectorAll('[data-vr-signout]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;await sb.auth.signOut();location.href='/creative-house/';}));
    }catch(error){signedOut();}
  };
  refresh();sb.auth.onAuthStateChange(()=>refresh());
})();

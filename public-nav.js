(()=>{
  const header=document.querySelector('header.nav, header.site-nav');
  if(!header) return;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const links=[['/','VISUAREALM'],['/realm-pictures/','Realm Pictures'],['/realm-music/','Realm Music'],['/creative-house/','Creative House'],['/pricing/','Pricing']];
  const button=document.createElement('button');
  button.className='public-menu-toggle';button.type='button';button.setAttribute('aria-label','Open navigation');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','public-menu');button.innerHTML='<span></span>';
  const panel=document.createElement('div');panel.className='public-menu-panel';panel.id='public-menu';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Site navigation');panel.setAttribute('aria-hidden','true');
  panel.innerHTML=`<div class="public-menu-kicker"><span>VISUAREALM / Navigation</span><span>You belong</span></div><nav class="public-menu-links" aria-label="Mobile navigation">${links.map(([href,label])=>`<a href="${href}"${(href==='/'?path==='/':path===href.replace(/\/$/,''))?' class="current" aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="public-menu-actions"><a href="/create-account/">Sign in</a><a href="/create-account/?mode=signup">Create account</a></div>`;
  header.appendChild(button);document.body.appendChild(panel);document.body.classList.add('public-menu-ready');
  const setOpen=open=>{button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation':'Open navigation');panel.classList.toggle('open',open);panel.setAttribute('aria-hidden',String(!open));document.body.classList.toggle('public-menu-open',open);if(open)panel.querySelector('a')?.focus()};
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  panel.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false)});
  addEventListener('keydown',event=>{if(button.getAttribute('aria-expanded')!=='true')return;if(event.key==='Escape'){setOpen(false);button.focus();return}if(event.key==='Tab'){const focusable=[...panel.querySelectorAll('a')];if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
})();

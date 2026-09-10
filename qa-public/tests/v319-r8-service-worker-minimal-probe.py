from __future__ import annotations
import os
from playwright.sync_api import sync_playwright
BASE=os.environ.get('QUADLUD_R8_BASE_URL','http://127.0.0.1:8765/')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(service_workers='allow')
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda exc: errors.append('pageerror:'+str(exc)))
    page.goto(BASE+'qa-sw-probe.html',wait_until='domcontentloaded')
    print('SW_MINIMAL origin',page.evaluate('location.origin'),flush=True)
    result=page.evaluate("""async()=>{
      const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      const immediate={scope:reg.scope,installing:reg.installing?.state||null,waiting:reg.waiting?.state||null,active:reg.active?.state||null};
      let activated=false;
      const end=Date.now()+8000;
      while(Date.now()<end){
        const current=await navigator.serviceWorker.getRegistration('./');
        if(current?.active?.state==='activated'){activated=true;break}
        await new Promise(r=>setTimeout(r,100));
      }
      const one=await navigator.serviceWorker.getRegistration('./');
      const all=await navigator.serviceWorker.getRegistrations();
      return {immediate,activated,one:one?{scope:one.scope,installing:one.installing?.state||null,waiting:one.waiting?.state||null,active:one.active?.state||null}:null,all:all.map(r=>({scope:r.scope,active:r.active?.state||null})),caches:await caches.keys()};
    }""")
    print('SW_MINIMAL result',result,flush=True)
    assert result['activated'],result
    assert result['one'] is not None,result
    assert result['all'],result
    assert not errors,errors
    context.close();browser.close()
    print('SW_MINIMAL PASS',flush=True)

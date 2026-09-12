from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
AUDIO=(ROOT/'GitHub'/'audio-service.js').read_text(encoding='utf-8')
WEB=(ROOT/'GitHub'/'audio-web.js').read_text(encoding='utf-8')
PREVIEW=(ROOT/'tests'/'manual'/'sound-preview.html').read_text(encoding='utf-8')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='fr-FR')
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append('pageerror:'+str(e)))
    page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' else None)
    page.set_content('<!doctype html><meta charset="utf-8"><div id="root"></div>')
    page.add_script_tag(content=AUDIO);page.add_script_tag(content=WEB)
    contract=page.evaluate("""()=>({a:QuadludAudioService.VERSION,w:QuadludWebAudio.VERSION,events:Object.keys(QuadludAudioService.EVENTS).length,errors:QuadludAudioService.validatePrograms(),durations:Object.values(QuadludAudioService.PROGRAMS).map(QuadludAudioService.durationMs)})""")
    assert contract['a']==2 and contract['w']==2,contract
    assert contract['events']==15 and contract['errors']==[],contract
    assert min(contract['durations'])>0 and max(contract['durations'])<=800,contract['durations']
    result=page.evaluate("""()=>{
      let resumes=0,closed=0,now=1000;
      class Param{setValueAtTime(){} exponentialRampToValueAtTime(){}}
      class Osc{constructor(){this.frequency=new Param();this.onended=null}connect(){}disconnect(){}start(){}stop(){if(this.onended)this.onended()}}
      class Gain{constructor(){this.gain=new Param()}connect(){}disconnect(){}}
      class AC{constructor(){this.state='suspended';this.currentTime=1;this.destination={}}resume(){resumes++;this.state='running';return Promise.resolve()}close(){closed++;return Promise.resolve()}createOscillator(){return new Osc()}createGain(){return new Gain()}}
      const backend=QuadludWebAudio.createWebAudioBackend({AudioContext:AC},{maxVoices:4});
      const audio=QuadludAudioService.createAudioService({backend,nowMs:()=>now,masterVolume:.6});
      const before=backend.diagnostics();const unlocked=audio.unlock();const first=audio.play(QuadludAudioService.EVENTS.MOVE_ACCEPTED);const second=audio.play(QuadludAudioService.EVENTS.MOVE_ACCEPTED);now+=28;const third=audio.play(QuadludAudioService.EVENTS.MOVE_ACCEPTED);const diag=audio.diagnostics();audio.dispose();
      return {before,unlocked,first,second,third,diag,resumes,closed}
    }""")
    assert result['before']['contextCreated'] is False,result
    assert result['unlocked'] and result['first'] and not result['second'] and result['third'],result
    assert result['diag']['suppressedCooldown']==1 and result['diag']['played']==2,result
    assert result['resumes']==1 and result['closed']==1,result
    assert not errors,errors
    ctx.close();browser.close()

assert 'audio-service.js' in PREVIEW and 'audio-web.js' in PREVIEW
assert 'app.js' not in PREVIEW
assert 'min-height:48px' in PREVIEW
print('sound audio browser contract: PASS')

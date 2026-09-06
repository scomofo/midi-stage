"""UI integration tests: in-memory Chromium page, simulated MIDI, real Web Audio clock.
Requires Playwright and Chromium. No physical hardware is emulated at the OS level.
"""
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'MIDI-Stage.html').read_text()
MOCK = r"""
(() => {
  // Browser permissions and storage are mocked for the in-memory test origin only.
  Object.defineProperty(window, 'isSecureContext', {get:()=>true, configurable:true});
  const store=new Map();
  Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()},configurable:true});
  const kit={id:'kit',name:'Virtual Drum Kit',manufacturer:'Test',state:'connected',onmidimessage:null};
  const keys={id:'keys',name:'Virtual Keys',manufacturer:'Test',state:'connected',onmidimessage:null};
  const access={inputs:new Map([['kit',kit],['keys',keys]]),onstatechange:null};
  window.__permissionRequests=[];
  Object.defineProperty(navigator,'requestMIDIAccess',{value:async options=>{window.__permissionRequests.push(options);return access;},configurable:true});
  window.__send=(id,data,timeStamp=performance.now())=>access.inputs.get(id).onmidimessage?.({data:Uint8Array.from(data),timeStamp});
  window.__disconnect=id=>{access.inputs.get(id).state='disconnected';access.onstatechange?.();};
  window.__at=(target,action)=>new Promise(resolve=>{const tick=()=>{if(MIDIStage.getSnapshot().time>=target){action();resolve();}else requestAnimationFrame(tick);};tick();});
})();
"""
checks=[]
def check(name,condition):
    if not condition: raise AssertionError(name)
    checks.append(name)
    print('PASS',name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':1440,'height':1120},device_scale_factor=1)
    context.add_init_script(MOCK)
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML,wait_until='load')
    check('ready state and three original songs', page.evaluate("MIDIStage.getSnapshot().status==='ready'") and page.locator('.song-card').count()==3)
    page.locator('[data-part="keys"]').click()
    page.locator('#connectMIDI').click()
    check('permission requested with SysEx disabled',page.evaluate('__permissionRequests.length===1 && __permissionRequests[0].sysex===false'))
    page.locator('[data-route="device"][data-player="drums"]').select_option('kit')
    page.locator('[data-route="device"][data-player="keys"]').select_option('keys')
    check('dedicated input selection accepts any channel',page.evaluate("MIDIStage.getSnapshot().players.every(p=>p.channel===0)"))
    page.locator('[data-close="setupDialog"]').last.click()
    page.locator('#start').click()
    page.evaluate("__at(0,()=>{__send('kit',[0x90,36,110]);__send('keys',[0x90,60,100]);})")
    s=page.evaluate('MIDIStage.getSnapshot()')
    check('simultaneous MIDI players score independently at the audible beat',all(x['stats']['perfect']==1 for x in s['players']))
    page.evaluate("__send('kit',[0x90,60,100]);")
    check('wrong device does not cross-score keyboard part',page.evaluate("MIDIStage.getSnapshot().players[1].stats.extra===0"))
    page.evaluate("__send('keys',[0x90,60,0]);")
    check('Note On velocity zero is a release, not another hit',page.evaluate("MIDIStage.getSnapshot().players[1].stats.extra===0"))
    page.evaluate("__at(60/112*3,()=>{__send('keys',[0x90,64,100]);__send('keys',[0xb0,64,127]);__send('keys',[0x80,64,0]);})")
    page.wait_for_timeout(440)
    check('CC64 sustain holds a released note to completion',page.evaluate("MIDIStage.getSnapshot().players[1].stats.holds===1 && MIDIStage.getSnapshot().players[1].stats.holdBreaks===0"))
    page.evaluate("__send('keys',[0xb0,64,0]);")
    page.locator('#pause').click()
    t=page.evaluate('MIDIStage.getSnapshot().time');page.wait_for_timeout(200)
    check('pause freezes the song clock',abs(page.evaluate('MIDIStage.getSnapshot().time')-t)<.001)
    page.locator('#start').click();page.wait_for_timeout(150)
    check('resume restarts with a count-in',page.evaluate("MIDIStage.getSnapshot().status==='playing'") and page.locator('#countdown').inner_text().strip()!='')
    page.evaluate("__disconnect('kit')")
    check('device disconnection pauses the band',page.evaluate("MIDIStage.getSnapshot().status==='paused'"))
    page.locator('#openSetup').click()
    page.locator('[data-learn="keys"][data-lane="0"]').click()
    page.evaluate("__send('keys',[0x92,55,100])")
    check('MIDI Learn binds the physical note and detected channel',page.evaluate("MIDIStage.getSnapshot().players[1].channel===3") and 'MIDI 55' in page.locator('[data-learn="keys"][data-lane="0"]').inner_text())
    page.locator('[data-close="setupDialog"]').last.click()
    page.locator('[data-song="neon-circuit"]').click()
    # Keyboard input through the real UI, not a scoring backdoor.
    page.locator('[data-part="keys"]').click()
    page.locator('#start').click()
    page.evaluate("__at(0,()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true})))")
    check('computer Space key scores the kick lane',page.evaluate("MIDIStage.getSnapshot().players[0].stats.perfect===1"))
    page.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}))")
    page.locator('#pause').click()
    # Source import via the browser file-input code path.
    page.locator('#midiFile').set_input_files(str(ROOT/'songs/neon-circuit.mid'))
    page.wait_for_selector('#setupDialog[open]')
    check('MIDI-file import exposes all four track/channel parts',page.locator('[data-route="source"][data-player="drums"] option').count()==4)
    check('imported song has a stable content-derived ID',page.evaluate("MIDIStage.getSnapshot().song.startsWith('midi-')"))
    page.locator('[data-close="setupDialog"]').last.click()
    page.locator('#midiFile').set_input_files({'name':'bad.mid','mimeType':'audio/midi','buffer':b'not MIDI'})
    page.wait_for_function("document.getElementById('toast').textContent.includes('Standard MIDI')")
    check('invalid file shows a readable error without crashing', 'Standard MIDI' in page.locator('#toast').inner_text())
    # Layouts: original, every player, compact phone viewport.
    page.locator('[data-song="neon-circuit"]').click()
    for part in ['keys','guitar','bass']:
        if page.locator(f'[data-part="{part}"]').get_attribute('aria-pressed')=='false':page.locator(f'[data-part="{part}"]').click()
    check('four-player lineup renders four independent input groups',page.locator('.pad-group').count()==4)
    page.screenshot(path=str(ROOT.parent/'midi-stage-four-player.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
    check('mobile layout has no horizontal document overflow',page.evaluate('document.body.scrollWidth<=window.innerWidth'))
    page.screenshot(path=str(ROOT.parent/'midi-stage-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1120})
    for part in ['guitar','bass']:page.locator(f'[data-part="{part}"]').click()
    page.locator('#demo').click();page.wait_for_timeout(3700)
    check('autoplay demo advances both parts without misses',page.evaluate("MIDIStage.getSnapshot().demo && MIDIStage.getSnapshot().players.every(p=>p.stats.perfect>0&&p.stats.miss===0)"))
    page.screenshot(path=str(ROOT.parent/'midi-stage-band.png'),full_page=True)
    check('no browser JavaScript errors',not errors)
    browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors},indent=2))

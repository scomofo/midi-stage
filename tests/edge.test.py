"""Additional browser checks for results, loops, calibration, audio cleanup and permission failures."""
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'MIDI-Stage.html').read_text()
checks=[]
def check(name,value):
    if not value: raise AssertionError(name)
    checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    page=b.new_page(viewport={'width':1440,'height':1120});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate("""(()=>{const s=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>s.get(k)??null,setItem:(k,v)=>s.set(k,String(v))},configurable:true});window.__at=(target,fn)=>new Promise(r=>{const tick=()=>{if(MIDIStage.getSnapshot().time>=target){fn();r();}else requestAnimationFrame(tick);};tick();});window.__key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));})()""")
    page.set_content(HTML,wait_until='load')
    page.locator('#midiFile').set_input_files(str(ROOT/'tests/fixtures/short.mid'))
    page.wait_for_selector('#setupDialog[open]');page.locator('[data-close="setupDialog"]').last.click()
    page.locator('#start').click()
    page.evaluate("__at(0,()=>{__key('keydown','KeyA');__key('keydown','KeyS');})")
    page.evaluate("__at(.97,()=>{__key('keyup','KeyA');__key('keyup','KeyS');})")
    page.evaluate("__at(1.5,()=>__key('keydown','KeyW'))")
    page.evaluate("__at(1.96,()=>__key('keyup','KeyW'))")
    page.wait_for_selector('#resultsDialog[open]',timeout=4000)
    check('actual keyboard chord and sustain performance reaches results',page.evaluate("MIDIStage.getSnapshot().players[0].stats.perfect===3 && MIDIStage.getSnapshot().players[0].stats.holds===3"))
    check('eligible player high score is saved',page.locator('#resultEyebrow').inner_text()=='NEW PERSONAL BEST' and page.locator('.result-score').inner_text()=='450')
    page.screenshot(path=str(ROOT.parent/'midi-stage-results.png'),full_page=True)
    page.locator('[data-close="resultsDialog"]').click()
    page.locator('#demo').click();page.wait_for_selector('#resultsDialog[open]',timeout=6000)
    check('completed autoplay is explicitly unranked', 'NO SCORE SAVED' in page.locator('#resultEyebrow').inner_text())
    page.locator('[data-close="resultsDialog"]').click()
    page.locator('.practice-tools summary').click();page.locator('#loop').check();page.locator('#loopStart').fill('0');page.locator('#loopEnd').fill('99');page.locator('#start').click()
    page.wait_for_function("document.getElementById('toast').textContent.includes('Choose a loop')")
    check('invalid loop bounds are rejected before playback',page.evaluate("MIDIStage.getSnapshot().status==='ready'"))
    page.locator('#loopEnd').fill('1.9');page.locator('#start').click();page.wait_for_function('MIDIStage.getSnapshot().loopCount>=1',timeout=6000)
    check('practice loops reset for another pass',page.evaluate('MIDIStage.getSnapshot().loopCount===1'))
    page.wait_for_function("MIDIStage.getSnapshot().status==='playing'",timeout=2000);page.locator('#pause').click()
    page.locator('#openSetup').click();page.locator('#calibrateButton').click();page.locator('#calibrationStart').click()
    check('calibration starts a timed tap session',page.locator('#calibrationTap').is_enabled())
    page.locator('[data-close="calibrationDialog"]').click()
    check('calibration cancellation returns safely',not page.locator('#calibrationDialog').evaluate('(e)=>e.open'))
    clean=page.evaluate("""async()=>{const a=new StageAudio.AudioEngine();await a.init();for(const type of ['drums','keys','guitar','bass'])a.tone(type,type==='drums'?36:60,100,a.ctx.currentTime+.05,.2);a.stop();await new Promise(r=>setTimeout(r,120));const n=a.nodes.size;await a.ctx.close();return n;}""")
    check('synth voices clean up after stop',clean==0)
    page.evaluate("Object.defineProperty(window,'isSecureContext',{get:()=>true,configurable:true});Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>{throw new DOMException('denied','NotAllowedError')},configurable:true})")
    page.locator('#connectMIDI').click();page.wait_for_function("document.getElementById('toast').textContent.includes('permission was denied')")
    check('denied MIDI permission produces actionable fallback', 'Keyboard play still works' in page.locator('#toast').inner_text())
    page.evaluate("Object.defineProperty(window,'isSecureContext',{get:()=>false,configurable:true})")
    page.locator('#connectMIDI').click();page.wait_for_function("document.getElementById('toast').textContent.includes('secure page')")
    check('insecure contexts show local-launch instructions', 'localhost' in page.locator('#toast').inner_text())
    check('no JavaScript errors during completion and error paths',not errors)
    b.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors},indent=2))

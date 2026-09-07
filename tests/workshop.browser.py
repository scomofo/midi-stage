"""Workshop UI integration with real audio decoding and simulated IndexedDB.
No real devices or input permissions are requested. Storage persistence across
browser restarts is not established by this in-memory suite.
"""
from pathlib import Path
import io
import json
import math
import os
import shutil
import struct
import wave
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'MIDI-Stage.html').read_text()
MOCK=r"""
(() => {
 const settings=new Map(),rows=new Map();
 Object.defineProperty(window,'localStorage',{value:{getItem:k=>settings.get(k)??null,setItem:(k,v)=>settings.set(k,String(v))},configurable:true});
 window.__storageFailure=false;window.__captureRequests=0;
 const db={close(){},createObjectStore(){},transaction(){
   const tx={error:null,objectStore:()=>({
     get:key=>request(()=>structuredClone(rows.get(key))),
     getAll:()=>request(()=>[...rows.values()].map(r=>structuredClone(r))),
     put:row=>request(()=>{if(!window.__storageFailure)rows.set(row.id,structuredClone(row));return row.id;}),
     delete:key=>request(()=>rows.delete(key))
   })};
   const request=action=>{const req={};setTimeout(()=>{try{req.result=action();req.onsuccess?.();if(window.__storageFailure){tx.error=new Error('Simulated storage quota failure. Export a chart backup.');tx.onabort?.();}else tx.oncomplete?.();}catch(e){tx.error=e;tx.onerror?.();}},8);return req;};return tx;
 }};
 Object.defineProperty(window,'indexedDB',{value:{open:()=>{const req={};setTimeout(()=>{req.result=db;req.onupgradeneeded?.();req.onsuccess?.();},0);return req;}},configurable:true});
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.__captureRequests++;throw Error('No physical hardware is allowed in this suite.');},enumerateDevices:async()=>[],addEventListener:()=>{},removeEventListener:()=>{}},configurable:true});
})();
"""
checks=[]
def check(name,ok):
    if not ok: raise AssertionError(name)
    checks.append(name);print('PASS',name,flush=True)
def snap(page): return page.evaluate('MIDIStage.getWorkshopSnapshot()')
def count(page,role=None):
    return sum(len(p['notes']) for p in snap(page)['project']['parts'] if role is None or p['type']==role)
def ready(page): page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
def import_file(page,path):
    page.locator('#wsFile').set_input_files(str(path));ready(page)

audio=io.BytesIO()
with wave.open(audio,'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000)
    samples=[int(11000*math.sin(2*math.pi*110*i/16000)*math.exp(-((i/16000)%0.5)*18)) for i in range(8*16000)]
    wav.writeframes(struct.pack('<'+'h'*len(samples),*samples))
audio_payload={'name':'Workshop TEST.wav','mimeType':'audio/wav','buffer':audio.getvalue()}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
    context.add_init_script(MOCK)
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.set_content(HTML,wait_until='load')
    page.locator('#openWorkshop').click()
    check('workshop opens without instrument capture',snap(page)['open'] and page.evaluate('__captureRequests')==0)
    import_file(page,ROOT/'songs/first-rehearsal.mid')
    check('MIDI import exposes four track assignments',page.locator('[data-ws-track]').count()==4)
    check('MIDI assignments identify drums keys guitar bass',page.locator('[data-ws-track]').evaluate_all('(els)=>els.map(e=>e.value)')==['drums','keys','guitar','bass'])
    page.locator('#wsBuildMidi').click()
    check('MIDI builds all four editable highways',all(p['notes'] for p in snap(page)['project']['parts']))
    check('MIDI song tempo and note pitches retained',snap(page)['project']['bpm']==96 and snap(page)['project']['parts'][2]['notes'][0]['pitch']==40)
    page.locator('[data-ws-role="guitar"]').click()
    before=count(page,'guitar')
    page.locator('#wsNoteTime').fill('.123');page.locator('#wsPitch').select_option('42');page.locator('#wsLength').fill('.05');page.locator('#wsAdd').click()
    check('form adds a note with exact timing and pitch',count(page,'guitar')==before+1)
    page.locator('#wsNoteList').select_option(label='0.123s · F♯2 / 42 · 0.05s')
    page.locator('#wsNoteTime').fill('.234');page.locator('#wsLength').fill('.12');page.locator('#wsUpdate').click()
    check('selected notes can change timing and sustain',any(n['time']==.234 and n['duration']==.12 for n in snap(page)['project']['parts'][2]['notes']))
    page.locator('#wsUndo').click()
    check('undo restores the previous note edit',any(n['time']==.123 for n in snap(page)['project']['parts'][2]['notes']))
    page.locator('#wsRedo').click()
    check('redo restores the updated note',any(n['time']==.234 for n in snap(page)['project']['parts'][2]['notes']))
    page.locator('#wsNoteList').select_option(label='0.234s · F♯2 / 42 · 0.12s');page.locator('#wsDelete').click()
    check('delete removes only the selected note',count(page,'guitar')==before)
    page.locator('[data-ws-role="drums"]').click()
    old=count(page,'drums');box=page.locator('#wsCanvas').bounding_box()
    page.locator('#wsCanvas').click(position={'x':float(520/840*box['width']),'y':float(270/382*box['height'])})
    check('canvas adds a snapped drum-lane note',count(page,'drums')==old+1)
    previous=snap(page)['project'];page.locator('#wsDuration').fill('.5');page.locator('#wsTiming').click()
    check('duration edits cannot silently truncate chart notes',snap(page)['project']==previous and 'Note' in page.locator('#wsStatus').inner_text())
    page.locator('#wsDuration').fill(str(previous['duration']))
    page.locator('#wsFile').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{broken'});ready(page)
    check('invalid chart import leaves the current draft intact',snap(page)['project']==previous and 'valid JSON' in page.locator('#wsStatus').inner_text())
    import_file(page,ROOT/'tests/fixtures/workshop-tone.mp3')
    check('MP3 import decodes a real MPEG audio fixture',1.4<snap(page)['project']['duration']<1.8)
    page.locator('#wsFile').set_input_files(audio_payload);ready(page)
    check('WAV import uses actual Web Audio decoding',snap(page)['project']['duration']==8 and snap(page)['project']['audioName']=='Workshop TEST.wav')
    check('audio import does not fabricate transcribed notes',count(page)==0 and 'not automatically transcribed' in page.locator('#wsStatus').inner_text())
    page.locator('#wsName').fill('Workshop TEST Rehearsal');page.locator('#wsBpm').fill('120');page.locator('#wsFirstBeat').fill('.25');page.locator('#wsTiming').click()
    for role in ['keys','guitar','bass']:page.locator(f'#wsRoles input[value="{role}"]').check()
    page.locator('#wsGenerate').click()
    check('beat practice creates four parts with an explicit scope label',all(p['notes'] for p in snap(page)['project']['parts']) and snap(page)['project']['origin']=='practice')
    check('first-beat offset aligns generated notes to the chosen grid',all(p['notes'][0]['time']==.25 for p in snap(page)['project']['parts']))
    page.locator('[data-ws-role="keys"]').click();page.locator('#wsPitch').select_option('62');page.locator('#wsLength').fill('.05')
    old=count(page,'keys');page.locator('#wsPreview').click();ready(page);page.wait_for_timeout(400)
    check('preview plays through the real audio transport',snap(page)['preview'])
    page.locator('#wsTapNote').click()
    check('playhead tap authors a note without stopping preview',count(page,'keys')==old+1 and snap(page)['preview'])
    page.locator('#wsStop').click();check('preview stop releases playback',not snap(page)['preview'])
    page.locator('#wsSave').click();ready(page)
    check('save commits chart and backing blob to library API',page.locator('.ws-library-row').count()==1 and 'audio saved' in page.locator('#wsLibrary').inner_text())
    project=snap(page)['project'];old_id=project['id']
    page.evaluate('__storageFailure=true');page.locator('#wsSave').click();ready(page)
    check('failed storage transaction is reported, never claimed saved','quota failure' in page.locator('#wsStatus').inner_text())
    page.evaluate('__storageFailure=false')
    with page.expect_download() as dl:page.locator('#wsExport').click()
    exported=Path(dl.value.path()).read_text();data=json.loads(exported)
    check('download exports a validated portable chart without audio bytes',data['schema']=='midi-stage-chart' and 'blob' not in data and data['audioName']=='Workshop TEST.wav')
    page.locator('#wsPlay').click();ready(page)
    s=page.evaluate('MIDIStage.getSnapshot()')
    check('use highways selects all four nonempty parts in gameplay',not snap(page)['open'] and len(s['players'])==4 and all(p['notes'] for p in s['players']))
    check('backing audio accompanies the chart into gameplay',s['bufferName']=='Workshop TEST.wav')
    page.locator('#demo').click();page.wait_for_function('MIDIStage.getSnapshot().time>1.1')
    check('generated highway demo scores every player with no misses',all(p['stats']['perfect']>0 and p['stats']['miss']==0 for p in page.evaluate('MIDIStage.getSnapshot().players')))
    page.locator('#openWorkshop').click();check('opening editor stops the game and input capture',page.evaluate('MIDIStage.getSnapshot().status')=='ready')
    page.locator('#wsNew').click();page.locator('[data-ws-load]').click();ready(page)
    check('library reopen restores chart and its stored audio',snap(page)['project']['id']==old_id and page.locator('#wsAudioName').inner_text()=='Workshop TEST.wav')
    page.locator('#wsFile').set_input_files({'name':'backup.midistage.json','mimeType':'application/json','buffer':exported.encode()});ready(page)
    check('chart-only import asks for backing audio instead of inventing it','Reattach' in page.locator('#wsAudioName').inner_text())
    page.locator('#wsAudioFile').set_input_files(audio_payload);ready(page)
    check('reattaching audio preserves all authored notes',snap(page)['project']['parts']==data['parts'])
    page.locator('#wsName').fill('<img src=x onerror=alert(1)>');page.locator('#wsTiming').click();page.locator('#wsSave').click();ready(page)
    check('untrusted song names render as text in library',page.locator('#wsLibrary img').count()==0 and '<img' in page.locator('#wsLibrary').inner_text())
    page.locator('#wsName').fill('Workshop TEST Rehearsal');page.locator('#wsTiming').click();page.locator('#wsSave').click();ready(page)
    page.locator('[data-ws-role="drums"]').click()
    out=Path(os.environ.get('TEST_ARTIFACT_DIR','/tmp/midi-stage-workshop-tests'));out.mkdir(parents=True,exist_ok=True)
    page.locator('#workshopDialog').evaluate('(el)=>el.scrollTop=0')
    page.screenshot(path=str(out/'workshop-desktop-TEST.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    check('workshop remains within narrow-screen horizontal bounds',page.evaluate('document.querySelector("#workshopDialog").scrollWidth<=document.querySelector("#workshopDialog").clientWidth+2'))
    page.locator('#workshopDialog').evaluate('(el)=>el.scrollTop=0')
    page.screenshot(path=str(out/'workshop-mobile-TEST.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1100})
    page.locator('#wsPreview').click();ready(page);page.locator('#wsClose').click()
    check('closing workshop stops preview immediately',not snap(page)['preview'])
    page.locator('#openWorkshop').click();old_title=snap(page)['project']['title']
    page.evaluate("""window.__decodeOriginal=AudioContext.prototype.decodeAudioData;AudioContext.prototype.decodeAudioData=function(...args){return new Promise(resolve=>{window.__finishDecode=()=>__decodeOriginal.apply(this,args).then(resolve);});};undefined;""")
    page.locator('#wsFile').set_input_files(audio_payload);page.wait_for_function('!!window.__finishDecode');page.locator('#wsClose').click();page.evaluate('__finishDecode(); undefined');ready(page)
    check('closing during pending audio decode discards late import',not snap(page)['open'] and snap(page)['project']['title']==old_title)
    page.evaluate('AudioContext.prototype.decodeAudioData=__decodeOriginal; undefined')
    page.locator('#openWorkshop').click();page.locator('[data-ws-delete]').click();ready(page)
    check('library deletion removes song and stored audio through explicit action',page.locator('.ws-library-row').count()==0)
    check('workshop never acquires real microphone or instrument input',page.evaluate('__captureRequests')==0)
    check('no JavaScript errors across workshop workflows',not errors)
    browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'storage':'simulated IndexedDB; actual Web Audio decoding and transport'},indent=2))

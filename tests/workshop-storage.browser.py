"""Real Chromium IndexedDB / Blob persistence across browser process restarts.
Run in an environment permitting file-origin navigation (GitHub-hosted CI).
Uses a fresh temporary profile, never an existing user browser profile.
"""
from pathlib import Path
import io
import json
import math
import os
import shutil
import struct
import tempfile
import wave
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,condition):
    if not condition:raise AssertionError(name)
    checks.append(name);print('PASS',name,flush=True)
stream=io.BytesIO()
with wave.open(stream,'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000)
    wav.writeframes(b''.join(struct.pack('<h',int(6000*math.sin(2*math.pi*110*i/16000))) for i in range(4*16000)))
payload={'name':'Persistence TEST.wav','mimeType':'audio/wav','buffer':stream.getvalue()}
with tempfile.TemporaryDirectory(prefix='midi-stage-profile-') as profile,sync_playwright() as p:
    opts={'headless':True,'executable_path':os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),'args':['--no-sandbox','--autoplay-policy=no-user-gesture-required']}
    errors=[]
    context=p.chromium.launch_persistent_context(profile,**opts)
    page=context.pages[0];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'MIDI-Stage.html').as_uri(),wait_until='load')
    page.locator('#openWorkshop').click();page.locator('#wsFile').set_input_files(payload)
    page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
    page.locator('#wsName').fill('Persistent library TEST');page.locator('#wsAudioOffset').fill('.5');page.locator('#wsTiming').click();page.locator('#wsGenerate').click()
    page.locator('#wsSave').click();page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
    project_id=page.evaluate('MIDIStage.getWorkshopSnapshot().project.id')
    check('real IndexedDB save completes and preserves a Blob',page.evaluate('(key)=>new StageWorkshop.Library().get(key).then(r=>!!r && r.blob instanceof Blob && r.blob.size>1000)',project_id))
    context.close()
    # Relaunch Chromium, not just reload an in-memory document.
    context=p.chromium.launch_persistent_context(profile,**opts);page=context.pages[0]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    page.goto((ROOT/'MIDI-Stage.html').as_uri(),wait_until='load')
    page.wait_for_function('MIDIStage.getSnapshot().songCount===5')
    check('saved chart is restored after Chromium process restart',page.get_by_role('button',name='Persistent library TEST',exact=False).count()==1)
    page.get_by_role('button',name='Persistent library TEST',exact=False).click()
    page.wait_for_function('!MIDIStage.getSnapshot().backingLoading')
    check('stored Blob decodes again as the selected song backing',page.evaluate('MIDIStage.getSnapshot().bufferName')=='Persistence TEST.wav')
    check('per-song backing offset survives browser restart',page.locator('#audioOffset').input_value()=='0.5')
    page.locator('#openWorkshop').click();page.locator('[data-ws-load]').click();page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
    check('restored song reopens as an editable arrangement',page.evaluate('MIDIStage.getWorkshopSnapshot().project.parts[0].notes.length')>0)
    page.locator('[data-ws-delete]').click();page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
    check('real database deletion removes chart and backing',page.evaluate('(key)=>new StageWorkshop.Library().get(key).then(r=>r===null)',project_id))
    check('no JavaScript errors during real persistence verification',not errors)
    context.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'storage':'real Chromium IndexedDB + Blob; file origin; browser process restarted'},indent=2))

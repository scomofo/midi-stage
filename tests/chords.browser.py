"""Chord-highway browser integration. Uses simulated MIDI/audio devices only.
No copyrighted audio, network resources, or physical hardware are accessed.
"""
from pathlib import Path
import json, os, re, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'MIDI-Stage.html').read_text()
MOCK=re.search(r'MOCK=r"""(.*?)"""',(ROOT/'tests/strings.browser.py').read_text(),re.S).group(1)
checks=[]
def check(name,value):
    if not value: raise AssertionError(name)
    checks.append(name); print('PASS',name,flush=True)
def snap(page): return page.evaluate('MIDIStage.getSnapshot()')
def ws(page): return page.evaluate('MIDIStage.getWorkshopSnapshot()')

def chart():
    chords=[
      {'time':0,'duration':2,'name':'C','roman':'I','key':'C','pitches':[60,64,67],'confidence':.92,'source':'estimated'},
      {'time':2,'duration':2,'name':'G','roman':'V','key':'C','pitches':[67,71,74],'confidence':.88,'source':'estimated'},
      {'time':4,'duration':2,'name':'Am','roman':'vi','key':'C','pitches':[69,72,76],'confidence':.9,'source':'estimated'},
      {'time':6,'duration':2,'name':'F','roman':'IV','key':'C','pitches':[65,69,72],'confidence':.87,'source':'estimated'},
    ]
    parts=[]
    for role,pitch in [('drums',36),('keys',60),('guitar',40),('bass',28)]:
        notes=[] if role in ('drums','bass') else [{'time':c['time'],'duration':.07,'pitch':pitch,'velocity':100} for c in chords]
        parts.append({'type':role,'notes':notes})
    return {'schema':'midi-stage-chart','version':3,'matching':'rhythm','id':'chart-browser-pop-chords','title':'Browser Pop Chords','bpm':120,'duration':8,'firstBeat':0,'audioOffset':0,'audioName':'','origin':'audio-rhythm','parts':parts,'tempoMap':[],'beats':[], 'chordHighways':{'keys':chords,'guitar':chords}}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':1440,'height':1120});context.add_init_script(MOCK)
    page=context.new_page(); errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.set_content(HTML,wait_until='load')
    page.locator('#openWorkshop').click()
    check('I-V-vi-IV assist is enabled by default',page.locator('#wsPopAssist').is_checked() and page.locator('#wsChordKey').input_value()=='auto')
    raw=json.dumps(chart()).encode()
    page.locator('#wsFile').set_input_files({'name':'pop-chords.midistage.json','mimeType':'application/json','buffer':raw})
    page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
    project=ws(page)['project']
    check('version-3 import preserves Roman numerals and key',project['version']==3 and [c['roman'] for c in project['chordHighways']['keys']]==['I','V','vi','IV'] and project['chordHighways']['keys'][0]['key']=='C')
    page.locator('#wsPlay').click();page.wait_for_function("!document.getElementById('workshopDialog').open")
    check('publishing chord highways closes Song Workshop',not page.locator('#workshopDialog').evaluate('(e)=>e.open'))
    check('published setlist song advertises chord highways','CHORD HIGHWAYS' in page.locator('#songTag').inner_text())
    # Keyboard only for exact chord-gameplay validation.
    if page.locator('[data-part="guitar"]').get_attribute('aria-pressed')=='true': page.locator('[data-part="guitar"]').click()
    page.locator('#connectMIDI').click()
    page.locator('[data-route="device"][data-player="keys"]').select_option('keys')
    page.locator('[data-route="channel"][data-player="keys"]').select_option('0')
    page.locator('[data-close="setupDialog"]').last.click()
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    check('keyboard gameplay uses one chord target instead of three note targets',snap(page)['players'][0]['chordMode'] and snap(page)['players'][0]['notes'][0]['name']=='C' and snap(page)['players'][0]['notes'][0]['roman']=='I')
    page.evaluate("__at(0,()=>{__send('keys',[0x90,72,100]);__send('keys',[0x90,76,100]);__send('keys',[0x90,79,100]);})")
    s=snap(page)['players'][0]['stats']
    check('C major in another octave scores as one arcade chord',s['perfect']+s['great']+s['good']==1 and s['combo']==1 and s['extra']==0)
    page.evaluate("__at(2,()=>{__send('keys',[0x90,55,100]);__send('keys',[0x90,59,100]);__send('keys',[0x90,62,100]);})")
    s=snap(page)['players'][0]['stats']
    check('second progression chord advances combo once',s['perfect']+s['great']+s['good']==2 and s['combo']==2)
    page.locator('#pause').click()
    # Re-enable only live guitar and prove an arbitrary clean pluck scores strum timing, not identity.
    if page.locator('[data-part="guitar"]').get_attribute('aria-pressed')=='false': page.locator('[data-part="guitar"]').click()
    if page.locator('[data-part="keys"]').get_attribute('aria-pressed')=='true': page.locator('[data-part="keys"]').click()
    page.locator('#openSetup').click();page.locator('[data-route="input"][data-player="guitar"]').select_option('audio');page.locator('[data-close="setupDialog"]').last.click()
    page.locator('#openSoundcheck').click();page.locator('#soundAllow').click();page.locator('#guitarAudioDevice').select_option('duo');page.locator('#guitarAudioChannel').select_option('1');page.locator('#soundClose').click()
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    page.evaluate("__at(0,()=>__audioMock.pluck(1,52,.35))")
    page.wait_for_timeout(260)
    g=snap(page)['players'][0]
    check('live guitar chord highway scores strum timing without claiming chord recognition',g['chordMode'] and g['stats']['perfect']+g['stats']['great']+g['stats']['good']==1 and 'strum timing only' in page.locator('#liveInputs').inner_text())
    page.locator('#pause').click()
    check('no external requests during chord workflow',not [u for u in requests if u.startswith(('http://','https://'))])
    check('no JavaScript page errors in chord workflow',not errors)
    browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'scope':'version-3 chords, simulated MIDI/live-audio'},indent=2))

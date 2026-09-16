"""Chord-first gameplay regression through the actual UI and simulated MIDI ports.
No real keyboard, audio interface or latency certification is claimed.
"""
from pathlib import Path
import json, os, re, shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'MIDI-Stage.html').read_text()
MOCK = re.search(r'MOCK=r"""(.*?)"""', (ROOT/'tests/strings.browser.py').read_text(), re.S).group(1)
checks=[]
def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name); print('PASS', name, flush=True)

def arrangement():
    chords=[dict(time=0,duration=.7,name='C',pitches=[60,64,67],source='midi'),dict(time=2,duration=.7,name='G',pitches=[59,62,67],source='midi')]
    notes=[dict(time=c['time'],duration=c['duration'],pitch=p,velocity=100) for c in chords for p in c['pitches']]
    notes.append(dict(time=4,duration=.5,pitch=62,velocity=100))
    return dict(schema='midi-stage-chart',version=3,id='chart-integrity-check',title='Chord integrity',bpm=120,duration=6,firstBeat=0,audioOffset=0,audioName='',origin='midi',parts=[dict(type=t,notes=notes if t=='keys' else []) for t in ['drums','keys','guitar','bass']],tempoMap=[],beats=[],chordHighways=dict(keys=chords))

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':1440,'height':1100});context.add_init_script(MOCK)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML,wait_until='load')
    check('first run opens the authored chord song with keyboard enabled',page.evaluate("MIDIStage.getSnapshot().song==='open-stage' && MIDIStage.getSnapshot().players.length===1 && MIDIStage.getSnapshot().players[0].id==='keys' && MIDIStage.getSnapshot().players[0].chordMode"))
    check('keyboard guide shows an upcoming chord and piano keys',page.locator('#chordGuide').is_visible() and page.locator('#chordGuide .piano-key').count()>12)
    counts=[]
    for level in ['chill','standard','expert']:
        page.locator('#difficulty').select_option(level)
        counts.append(page.evaluate('MIDIStage.getSnapshot().players[0].notes.length'))
    check('difficulty changes the authored arrangement',counts[0]<counts[1]<counts[2])
    page.locator('#difficulty').select_option('standard')
    page.locator('#demo').click();page.wait_for_timeout(4300)
    check('starter demonstration plays and holds chords',page.evaluate('MIDIStage.getSnapshot().players[0].stats.perfect>0 && MIDIStage.getSnapshot().players[0].stats.miss===0'))
    page.screenshot(path=str(ROOT.parent/'midi-stage-chord-experience.png'),full_page=True)
    page.locator('#pause').click()
    page.locator('#openWorkshop').click()
    page.locator('#wsFile').set_input_files({'name':'integrity.midistage.json','mimeType':'application/json','buffer':json.dumps(arrangement()).encode()})
    page.wait_for_function('!MIDIStage.getWorkshopSnapshot().busy')
    page.locator('#wsPlay').click();page.wait_for_function('!document.getElementById("workshopDialog").open')
    check('mixed chart retains two chords and the single-note fill',page.evaluate('MIDIStage.getSnapshot().players[0].notes.length===3'))
    page.locator('#connectMIDI').click()
    page.locator('[data-route="device"][data-player="keys"]').select_option('keys')
    page.locator('[data-route="channel"][data-player="keys"]').select_option('0')
    page.locator('[data-close="setupDialog"]').last.click()
    page.locator('#start').click()
    page.evaluate("__at(0,()=>{for(const n of [60,64,67,72])__send('keys',[0x90,n,100]);})")
    check('octave doubling is one fair chord hit',page.evaluate('MIDIStage.getSnapshot().players[0].stats.perfect===1 && MIDIStage.getSnapshot().players[0].stats.extra===0'))
    page.evaluate("__at(.3,()=>{for(const n of [60,64,67,72])__send('keys',[0x80,n,0]);})")
    check('early chord release breaks the hold',page.evaluate('MIDIStage.getSnapshot().players[0].stats.holdBreaks===1'))
    page.evaluate("__at(2,()=>{for(const n of [59,62,67])__send('keys',[0x90,n,100]);__send('keys',[0xb0,64,127]);})")
    page.evaluate("__at(2.2,()=>{for(const n of [59,62,67])__send('keys',[0x80,n,0]);})")
    page.evaluate("__at(2.85,()=>__send('keys',[0xb0,64,0]))")
    check('CC64 sustains a complete chord after physical key release',page.evaluate('MIDIStage.getSnapshot().players[0].stats.holds===1 && MIDIStage.getSnapshot().players[0].stats.holdBreaks===1'))
    page.evaluate("__at(4,()=>__send('keys',[0x90,62,100]))")
    check('single-note passage scores after the chord passage',page.evaluate('MIDIStage.getSnapshot().players[0].stats.perfect===3'))
    page.evaluate("__at(4.7,()=>__send('keys',[0x80,62,0]))")
    page.wait_for_function('document.getElementById("resultsDialog").open')
    check('completed performance earns stars and saves its hold-aware record',page.evaluate("MIDIStage.getSnapshot().progress.history.length===1 && MIDIStage.getSnapshot().progress.history[0].stars===4 && MIDIStage.getSnapshot().progress.history[0].mastered===false") and page.locator('.result-stars').get_attribute('aria-label')=='4 of 5 stars')
    page.locator('[data-close="resultsDialog"]').click()
    page.locator('#openWorkshop').click();page.locator('#wsEditCurrent').click()
    page.locator('[data-ws-role="keys"]').click()
    page.locator('#wsChordEditor summary').click()
    page.locator('#wsChordList').select_option('0');page.locator('#wsChordPitches').fill('60, 63, 67');page.locator('#wsChordSave').click()
    check('chord editor changes both source notes and scored harmony',page.evaluate("MIDIStage.getWorkshopSnapshot().project.chordHighways.keys[0].name==='Cm' && MIDIStage.getWorkshopSnapshot().project.parts.find(p=>p.type==='keys').notes.some(n=>n.time===0&&n.pitch===63)"))
    page.locator('#wsPlay').click();page.wait_for_function('!document.getElementById("workshopDialog").open')
    for part in ['drums','guitar','bass']:
        page.locator(f'[data-part="{part}"]').click()
    check('four-player view retains chord guidance',page.locator('#chordGuide').is_visible() and 'Cm' in page.locator('#chordGuide').inner_text())
    page.set_viewport_size({'width':390,'height':844})
    check('chord guidance fits a narrow viewport',page.evaluate('document.body.scrollWidth<=window.innerWidth'))
    check('no JavaScript errors in chord-first workflow',not errors)
    browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors},indent=2))

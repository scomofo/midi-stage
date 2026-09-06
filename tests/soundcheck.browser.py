"""Browser integration: mocked audio hardware, real Web Audio capture graphs.
No physical interface, microphone permission UI, or instrument is tested.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import shutil
import threading
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
MOCK=r"""
(()=>{
  Object.defineProperty(window,'isSecureContext',{get:()=>true,configurable:true});
  const m=window.__audioMock={calls:[],tracks:[],permission:false,denied:false,delay:0,available:['duo','mono'],contexts:[]};
  const media=new EventTarget();
  media.enumerateDevices=async()=>m.available.map(id=>({kind:'audioinput',deviceId:id,label:m.permission?(id==='duo'?'Virtual two-channel interface — TEST':'Virtual mono input — TEST'):''}));
  media.getUserMedia=async constraints=>{
    m.calls.push(constraints);
    if(m.denied)throw new DOMException('test rejection','NotAllowedError');
    if(m.delay)await new Promise(r=>setTimeout(r,m.delay));
    const id=constraints.audio?.deviceId?.exact||'duo';
    if(!m.available.includes(id))throw new DOMException('not available','OverconstrainedError');
    m.permission=true;
    const count=id==='mono'?1:2,ctx=new AudioContext(),merge=ctx.createChannelMerger(count),dest=ctx.createMediaStreamDestination();
    dest.channelCount=count;dest.channelCountMode='explicit';merge.connect(dest);
    const oscillators=[],gains=[];
    for(let i=0;i<count;i++){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=i===0?110:41.20344;gain.gain.value=.18;osc.connect(gain);gain.connect(merge,0,i);osc.start();oscillators.push(osc);gains.push(gain);}
    await ctx.resume();
    const track=dest.stream.getAudioTracks()[0],nativeStop=track.stop.bind(track);
    Object.defineProperty(track,'getSettings',{value:()=>({channelCount:count,sampleRate:ctx.sampleRate,deviceId:'PRIVATE-DEVICE-ID',groupId:'PRIVATE-GROUP-ID',echoCancellation:false,noiseSuppression:false,autoGainControl:false})});
    Object.defineProperty(track,'label',{value:id==='duo'?'Virtual two-channel interface — TEST':'Virtual mono input — TEST'});
    track.stop=()=>{nativeStop();for(const osc of oscillators)try{osc.stop();}catch(_){}if(ctx.state!=='closed')ctx.close();};
    m.tracks.push(track);m.contexts.push({ctx,oscillators,gains,track});return dest.stream;
  };
  Object.defineProperty(navigator,'mediaDevices',{value:media,configurable:true});
  m.live=()=>m.tracks.filter(t=>t.readyState==='live').length;
  m.remove=id=>{m.available=m.available.filter(x=>x!==id);media.dispatchEvent(new Event('devicechange'));};
})();
"""
checks=[]
def check(name,condition):
    if not condition:raise AssertionError(name)
    checks.append(name);print('PASS',name,flush=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
# Browser loopback navigation is blocked by this execution environment. Inline
# the actual source modules for UI tests; do not bypass that browser policy.
source=(ROOT/'index.html').read_text()
modules=re.findall(r'<script defer src="([^"]+)"></script>',source)
source=re.sub(r'<script defer src="[^"]+"></script>','',source)
source=source.replace('<link rel="stylesheet" href="src/styles.css">','<style>'+(ROOT/'src/styles.css').read_text()+'</style>')
source=source.replace('</body>','<script>'+"\n".join((ROOT/m).read_text() for m in modules)+'</script></body>')
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=b.new_context(viewport={'width':1440,'height':1260},accept_downloads=True)
    context.add_init_script(MOCK)
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(source,wait_until='load')
    check('inlined source build loads without requesting audio access',page.evaluate('__audioMock.calls.length===0'))
    page.locator('#openSoundcheck').click()
    check('opening soundcheck does not start capture',page.evaluate('__audioMock.calls.length===0'))
    page.locator('#soundAllow').click()
    page.wait_for_function('__audioMock.permission && __audioMock.live()===0')
    check('discovery reveals device labels and stops temporary capture',page.locator('#guitarAudioDevice option').all_text_contents()==['Select your audio input','Virtual two-channel interface — TEST','Virtual mono input — TEST'])
    page.evaluate('__audioMock.delay=180');page.locator('#soundAllow').click();page.locator('#soundClose').click();page.wait_for_timeout(350)
    check('closing during device discovery does not leave a late capture active',page.evaluate('__audioMock.live()===0'))
    page.evaluate('__audioMock.delay=0');page.locator('#openSoundcheck').click()
    page.locator('#guitarAudioDevice').select_option('duo')
    page.locator('#bassAudioDevice').select_option('duo')
    check('same-device same-channel assignments show a warning',page.locator('#soundConflict').is_visible())
    page.locator('#bassAudioChannel').select_option('2')
    check('separate channel selections clear the duplication warning',page.locator('#soundConflict').is_hidden())
    page.locator('#guitarCheck').click();page.wait_for_function("document.getElementById('guitarPitch').textContent==='A2'")
    page.locator('#bassCheck').click();page.wait_for_function("document.getElementById('bassPitch').textContent==='E1'")
    check('real Web Audio channels independently detect A2 guitar and E1 bass',page.locator('#guitarPitch').inner_text()=='A2' and page.locator('#bassPitch').inner_text()=='E1')
    check('two soundchecks share one device capture',page.evaluate('__audioMock.calls.length===3 && __audioMock.live()===1'))
    check('capture requests have no video and disable speech processing',page.evaluate('__audioMock.calls.filter(c=>c.audio!==true).every(c=>c.video===false && c.audio.echoCancellation===false && c.audio.autoGainControl===false && c.audio.noiseSuppression===false)'))
    check('signal meters are populated from captured samples',float(page.locator('#guitarLevel').get_attribute('aria-valuenow'))>-40 and float(page.locator('#bassLevel').get_attribute('aria-valuenow'))>-40)
    check('audio diagnostics cannot increment rhythm-game scores',page.evaluate("MIDIStage.getSnapshot().status==='ready' && MIDIStage.getSnapshot().players.every(p=>p.stats.score===0)"))
    page.screenshot(path=str(ROOT.parent/'MIDI-Stage-v0.2-Soundcheck-TEST.png'),full_page=True)
    with page.expect_download() as download_info:page.locator('#soundReport').click()
    download=download_info.value;report=json.loads(Path(download.path()).read_text());text=json.dumps(report)
    check('downloaded report identifies labels and per-role channels',report['routes']['guitar']['browserChannel']==1 and report['routes']['bass']['browserChannel']==2 and report['audioInputs'][0]['name'].startswith('Virtual'))
    check('device report excludes private IDs and audio samples','PRIVATE-' not in text and 'deviceId' not in text and 'groupId' not in text and 'samples' not in report)
    page.locator('#guitarCheck').click()
    check('stopping one role preserves the other shared capture',page.evaluate('__audioMock.live()===1') and page.locator('#bassBadge').inner_text()=='LISTENING')
    page.locator('#soundDone').click();page.wait_for_function('__audioMock.live()===0')
    check('closing soundcheck releases its last audio track',page.evaluate('__audioMock.live()===0'))
    page.locator('#openSoundcheck').click()
    check('reopening retains routes but never auto-starts capture',page.locator('#bassAudioChannel').input_value()=='2' and page.evaluate('__audioMock.live()===0'))
    page.locator('#guitarAudioDevice').select_option('mono');page.locator('#guitarAudioChannel').select_option('2');page.locator('#guitarCheck').click()
    page.wait_for_function("document.getElementById('guitarSignal').textContent.includes('exposes 1 browser channel')")
    check('mono input cannot silently satisfy a stereo-channel request',page.evaluate('__audioMock.live()===0') and page.locator('#guitarBadge').inner_text()=='CHECK INPUT')
    page.locator('#guitarAudioChannel').select_option('1');page.locator('#guitarCheck').click()
    page.wait_for_function("document.getElementById('guitarPitch').textContent==='A2'")
    check('choosing the actual mono channel recovers cleanly',page.locator('#guitarAudioChannel option').count()==1)
    page.locator('#soundStop').click();page.wait_for_function('__audioMock.live()===0')
    check('stop-all releases active captures',page.evaluate('__audioMock.live()===0'))
    page.evaluate('__audioMock.denied=true');page.locator('#guitarCheck').click()
    page.wait_for_function("document.getElementById('guitarSignal').textContent.includes('permission was denied')")
    check('denied permission is actionable without breaking the game',not errors and page.evaluate('__audioMock.live()===0'))
    page.evaluate('__audioMock.denied=false;__audioMock.delay=250');page.locator('#guitarCheck').click();page.locator('#soundClose').click();page.wait_for_timeout(450)
    check('closing while capture is pending also stops a late-arriving stream',page.evaluate('__audioMock.live()===0'))
    page.evaluate('__audioMock.delay=0');page.locator('#openSoundcheck').click();page.locator('#guitarAudioDevice').select_option('duo');page.locator('#guitarAudioChannel').select_option('1');page.locator('#guitarCheck').click();page.wait_for_function("document.getElementById('guitarBadge').textContent==='LISTENING'")
    page.locator('#bassCheck').click();page.wait_for_function("document.getElementById('bassBadge').textContent==='LISTENING'")
    page.evaluate("__audioMock.remove('duo')")
    page.wait_for_function('__audioMock.live()===0')
    check('unplug notification stops both roles sharing the removed input',page.locator('#guitarSignal').inner_text().startswith('This audio input disconnected') and page.locator('#bassSignal').inner_text().startswith('This audio input disconnected'))
    page.locator('#guitarAudioDevice').select_option('mono');page.locator('#guitarCheck').click();page.wait_for_function("document.getElementById('guitarBadge').textContent==='LISTENING'")
    page.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
    check('hiding the tab stops soundcheck capture',page.evaluate('__audioMock.live()===0'))
    page.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true})")
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    check('small-screen soundcheck has no horizontal overflow',page.locator('#soundcheckDialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1') and page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.screenshot(path=str(ROOT.parent/'soundcheck-mobile-TEST.png'),full_page=True)
    page.locator('#soundMIDI').click()
    check('MIDI routing remains accessible and soundcheck closes',page.locator('#setupDialog').evaluate('(e)=>e.open') and not page.locator('#soundcheckDialog').evaluate('(e)=>e.open'))
    check('no external network requests were made',all(r.startswith(url) for r in requests))
    check('no JavaScript errors on success, cancellation or error paths',not errors)
    # Separate fresh page exercises the distributable self-contained artifact.
    standalone=context.new_page();standalone.set_content((ROOT/'MIDI-Stage.html').read_text(),wait_until='load');standalone.locator('#openSoundcheck').click()
    check('self-contained artifact contains the new soundcheck and capture remains opt-in',standalone.locator('#soundcheckDialog').evaluate('(e)=>e.open') and standalone.evaluate('__audioMock.calls.length===0'))
    b.close()
finally:server.shutdown();server.server_close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'hardware':'simulated input hardware; real browser audio graph'},indent=2))

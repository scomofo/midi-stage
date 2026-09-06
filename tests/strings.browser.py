"""v0.3 integration: real Chromium capture graphs and audio clock, simulated devices.
No OS permission UI or physical instrument is exercised. Input observations are not
injected into the app: controlled oscillators become actual captured MediaStreams.
"""
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'MIDI-Stage.html').read_text()
MOCK=r"""
(()=>{
  Object.defineProperty(window,'isSecureContext',{get:()=>true,configurable:true});
  const store=new Map();window.__store=store;
  Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},configurable:true});
  window.__hidden=false;Object.defineProperty(document,'hidden',{get:()=>__hidden,configurable:true});
  const kit={id:'kit',name:'Drum Kit — TEST',state:'connected'},keys={id:'keys',name:'88 Keys — TEST',state:'connected'};
  const access={inputs:new Map([['kit',kit],['keys',keys]]),onstatechange:null};
  Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>access,configurable:true});
  window.__send=(id,bytes)=>access.inputs.get(id).onmidimessage?.({data:Uint8Array.from(bytes),timeStamp:performance.now()});
  window.__at=(target,action)=>new Promise(resolve=>{const tick=()=>{if(MIDIStage.getSnapshot().time>=target){action();resolve();}else requestAnimationFrame(tick);};tick();});
  const media=new EventTarget(),m=window.__audioMock={calls:[],streams:[],denied:false,unknown:false,delay:0};
  media.enumerateDevices=async()=>['duo','mono'].map(id=>({kind:'audioinput',deviceId:id,label:id==='duo'?'Two-channel interface — TEST':'Mono interface — TEST'}));
  media.getUserMedia=async c=>{
    m.calls.push(c);if(m.denied)throw new DOMException('denied in test','NotAllowedError');
    if(m.delay)await new Promise(r=>setTimeout(r,m.delay));
    const id=c.audio?.deviceId?.exact||'duo',count=id==='mono'?1:2,ctx=new AudioContext();
    const merge=ctx.createChannelMerger(count),dest=ctx.createMediaStreamDestination();
    dest.channelCount=count;dest.channelCountMode='explicit';merge.connect(dest);
    const oscillators=[],gains=[];
    for(let i=0;i<count;i++){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=i?41.20344:82.40689;gain.gain.value=0;osc.connect(gain);gain.connect(merge,0,i);osc.start();oscillators.push(osc);gains.push(gain);}
    await ctx.resume();
    const track=dest.stream.getAudioTracks()[0],nativeStop=track.stop.bind(track);
    Object.defineProperty(track,'getSettings',{value:()=>({...(m.unknown?{}:{channelCount:count}),sampleRate:ctx.sampleRate,deviceId:'PRIVATE-TEST',echoCancellation:false,noiseSuppression:false,autoGainControl:false})});
    Object.defineProperty(track,'label',{value:'Two-channel interface — TEST'});
    track.stop=()=>{nativeStop();for(const osc of oscillators)try{osc.stop();}catch(_){}if(ctx.state!=='closed')ctx.close();};
    m.streams.push({track,ctx,oscillators,gains});return dest.stream;
  };
  Object.defineProperty(navigator,'mediaDevices',{value:media,configurable:true});
  m.live=()=>m.streams.filter(s=>s.track.readyState==='live');
  m.pluck=(channel,pitch,duration=.45,amplitude=.20)=>{const s=m.live().at(-1);if(!s)throw Error('No capture available');const at=s.ctx.currentTime;const osc=s.oscillators[channel-1],gain=s.gains[channel-1];osc.frequency.setValueAtTime(440*2**((pitch-69)/12),at);gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(amplitude,at);gain.gain.setValueAtTime(0,at+duration);};
  m.end=()=>{const s=m.live()[0];s.track.stop();s.track.dispatchEvent(new Event('ended'));};
})();
"""
checks=[]
def check(name,value):
    if not value:raise AssertionError(name)
    checks.append(name);print('PASS',name,flush=True)
def snap(page):return page.evaluate('MIDIStage.getSnapshot()')
def close_setup(page):page.locator('[data-close="setupDialog"]').last.click()
def setup(page):
    page.locator('[data-song="first-rehearsal"]').click()
    for role in ['keys','guitar','bass']:page.locator(f'[data-part="{role}"]').click()
    page.locator('#connectMIDI').click()
    for role,device in [('drums','kit'),('keys','keys')]:page.locator(f'[data-route="device"][data-player="{role}"]').select_option(device)
    for role in ['guitar','bass']:page.locator(f'[data-route="input"][data-player="{role}"]').select_option('audio')
    close_setup(page)
    page.locator('#openSoundcheck').click();page.locator('#soundAllow').click()
    for role,ch in [('guitar','1'),('bass','2')]:
        page.locator(f'#{role}AudioDevice').select_option('duo');page.locator(f'#{role}AudioChannel').select_option(ch)
    page.locator('#soundClose').click()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=b.new_context(viewport={'width':1440,'height':1280});context.add_init_script(MOCK)
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.set_content(HTML,wait_until='load')
    check('v0.3 loads with four tracks and no capture permission request',snap(page)['status']=='ready' and page.locator('.song-card').count()==4 and page.evaluate('__audioMock.calls.length===0'))
    setup(page)
    check('audio routing controls preserve MIDI drums and keyboard',[(x['id'],x['input']) for x in snap(page)['players']]==[('drums','midi'),('keys','midi'),('guitar','audio'),('bass','audio')])
    check('soundcheck closure stops diagnostic capture',page.evaluate('__audioMock.live().length===0'))
    check('live guitar and bass disable on-screen score shortcuts',page.locator('.pad[data-player="guitar"]:disabled').count()>0 and page.locator('.pad[data-player="bass"]:disabled').count()>0)
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    check('two audio players share one real stream with two analysers',page.evaluate('__audioMock.live().length===1') and len(snap(page)['audio']['routes'])==2)
    page.evaluate("__at(0,()=>{__send('kit',[0x90,36,110]);__send('kit',[0x90,42,95]);__send('keys',[0x90,64,100]);__audioMock.pluck(1,40);__audioMock.pluck(2,28);})")
    page.wait_for_timeout(300)
    first=snap(page)
    check('physical-input path simulation scores all four instruments independently',all(x['stats']['perfect']+x['stats']['great']+x['stats']['good']>0 for x in first['players']))
    check('live audio status shows detected notes and standard-tuning hints','LIVE AUDIO' in page.locator('#liveInputs').inner_text() and 'standard-tuning hints' in page.locator('#liveInputs').inner_text())
    page.evaluate("__at(.625,()=>{__send('kit',[0x90,38,100]);__audioMock.pluck(1,55);__audioMock.pluck(2,31);})")
    page.evaluate("__at(1.25,()=>{__send('kit',[0x90,36,100]);__send('keys',[0x90,67,100]);__audioMock.pluck(1,45);__audioMock.pluck(2,33);})")
    page.evaluate("__at(1.875,()=>{__send('kit',[0x90,38,100]);__audioMock.pluck(1,47,.12);__audioMock.pluck(2,35);})")
    page.evaluate('__at(2.42,()=>{})')
    state=snap(page);g=state['players'][2]['stats'];bass=state['players'][3]['stats']
    check('wrong guitar octave is rejected, while bass still scores its own channel',g['extra']>=1 and g['miss']>=1 and bass['perfect']+bass['great']+bass['good']==4)
    check('early guitar release breaks a sustain instead of granting the tail',g['holdBreaks']>=1)
    check('clean bass notes earn confirmed sustain bonuses',bass['holds']>=3)
    page.evaluate("document.querySelector('.local-badge').textContent='SIMULATED INPUTS / TEST'")
    page.screenshot(path=str(ROOT.parent/'MIDI-Stage-v0.3-Live-Band-TEST.png'),full_page=True)
    page.locator('#pause').click();frozen=snap(page);page.wait_for_timeout(180)
    check('pause freezes time and releases the shared capture',snap(page)['time']==frozen['time'] and page.evaluate('__audioMock.live().length===0') and not snap(page)['audio']['running'])
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    check('resume reacquires audio with a new count-in',page.evaluate('__audioMock.live().length===1') and 'COUNT IN' in page.locator('#countdown').inner_text())
    page.evaluate('__audioMock.end()')
    check('an ended audio track pauses the whole band and closes both routes',snap(page)['status']=='paused' and not snap(page)['audio']['routes'] and page.evaluate('__audioMock.live().length===0'))
    # Independent player offsets persist; changes reset the performance.
    page.locator('#openSetup').click()
    page.locator('[data-route="offsetMs"][data-player="guitar"]').fill('75');page.locator('[data-route="offsetMs"][data-player="guitar"]').press('Tab')
    page.locator('[data-route="offsetMs"][data-player="bass"]').fill('-20');page.locator('[data-route="offsetMs"][data-player="bass"]').press('Tab');close_setup(page)
    check('per-player timing is independent and saved locally',[x['offsetMs'] for x in snap(page)['players']]==[0,0,75,-20] and page.evaluate("JSON.parse(__store.get('midi-stage-settings-v1')).players[2].offsetMs===75"))
    # Duplicate route, failed permission, and unavailable channel must not half-start.
    page.locator('#openSoundcheck').click();page.locator('#bassAudioChannel').select_option('1');page.locator('#soundClose').click()
    before=page.evaluate('__audioMock.calls.length');page.locator('#start').click()
    check('same-channel conflict blocks gameplay before capture',snap(page)['status']=='ready' and 'same audio channel' in page.locator('#toast').inner_text() and page.evaluate('__audioMock.calls.length')==before)
    page.locator('#openSoundcheck').click();page.locator('#bassAudioChannel').select_option('2');page.locator('#soundClose').click()
    page.evaluate('__audioMock.denied=true');page.locator('#start').click();page.wait_for_timeout(100)
    check('permission denial leaves no partial band or live streams',snap(page)['status']=='ready' and page.evaluate('__audioMock.live().length===0') and 'denied' in page.locator('#toast').inner_text())
    page.evaluate('__audioMock.denied=false;__audioMock.unknown=true');page.locator('#start').click();page.wait_for_timeout(150)
    check('unknown stereo channel count is not represented as verified separation',snap(page)['status']=='ready' and page.evaluate('__audioMock.live().length===0') and 'channel count' in page.locator('#toast').inner_text())
    page.evaluate('__audioMock.unknown=false')
    page.locator('#openSoundcheck').click();page.locator('#bassAudioDevice').select_option('mono');page.locator('#soundClose').click()
    page.locator('#start').click();page.wait_for_timeout(150)
    check('mono channel two fails safely and also closes the first player',snap(page)['status']=='ready' and page.evaluate('__audioMock.live().length===0') and '1 browser channel' in page.locator('#toast').inner_text())
    page.locator('#openSoundcheck').click();page.locator('#bassAudioDevice').select_option('duo');page.locator('#soundClose').click()
    # Cancel pending capture via song selection, without touching microphone data.
    page.evaluate('__audioMock.delay=350');page.locator('#start').click();page.locator('[data-song="after-hours"]').click();page.wait_for_timeout(600)
    check('changing songs cancels startup and releases late permission streams',snap(page)['status']=='ready' and snap(page)['song']=='after-hours' and page.evaluate('__audioMock.live().length===0'))
    page.evaluate('__audioMock.delay=0');page.locator('[data-song="first-rehearsal"]').click()
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    page.evaluate("__hidden=true;document.dispatchEvent(new Event('visibilitychange'))")
    check('hidden-tab interruption stops gameplay capture',snap(page)['status']=='paused' and page.evaluate('__audioMock.live().length===0'))
    page.evaluate("__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
    page.locator('[data-song="first-rehearsal"]').click()
    before=page.evaluate('__audioMock.calls.length');page.locator('#demo').click();page.wait_for_timeout(150)
    check('autoplay never opens an audio input even for audio-mode players',snap(page)['demo'] and page.evaluate('__audioMock.calls.length')==before)
    page.locator('#pause').click();page.locator('[data-song="first-rehearsal"]').click()
    # Soundcheck CTA is an explicit mode/lineup change, not persistent recording.
    page.locator('#openSoundcheck').click();page.locator('#guitarUse').click()
    check('Use live guitar button selects gameplay mode and closes soundcheck without capture',not page.locator('#soundcheckDialog').is_visible() and snap(page)['players'][2]['input']=='audio' and page.evaluate('__audioMock.live().length===0'))
    # Two identical authored notes: continuous ringing must not hit both.
    page.locator('details.practice-tools summary').click()
    page.locator('#loop').check();page.locator('#loopStart').fill('7.5');page.locator('#loopEnd').fill('9.5')
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    page.evaluate("__at(7.5,()=>{__audioMock.pluck(1,40,1.2);})")
    page.evaluate('__at(8.6,()=>{})')
    g=snap(page)['players'][2]['stats']
    check('one ringing captured note cannot hit two identical chart notes',g['perfect']+g['great']+g['good']==1 and g['miss']>=1)
    page.locator('#pause').click();page.locator('[data-song="first-rehearsal"]').click()
    page.locator('#loop').check();page.locator('#loopStart').fill('7.5');page.locator('#loopEnd').fill('9.5')
    page.locator('#start').click();page.wait_for_function("MIDIStage.getSnapshot().status==='playing'")
    page.evaluate("__at(7.5,()=>__audioMock.pluck(1,40,.45))")
    page.evaluate("__at(8.125,()=>__audioMock.pluck(1,40,.45))")
    page.evaluate('__at(8.6,()=>{})')
    g=snap(page)['players'][2]['stats']
    check('two separate captured plucks score the repeated note twice',g['perfect']+g['great']+g['good']==2 and g['extra']==0)
    page.wait_for_function("MIDIStage.getSnapshot().loopCount>=1 && MIDIStage.getSnapshot().status==='playing'",timeout=8000)
    check('practice-loop restart uses fresh capture without accumulating streams',page.evaluate('__audioMock.live().length===1') and len(snap(page)['audio']['routes'])==2)
    page.locator('#pause').click()
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
    check('live status remains readable without mobile horizontal overflow',page.evaluate('document.body.scrollWidth<=innerWidth'))
    page.screenshot(path=str(ROOT.parent/'MIDI-Stage-v0.3-Mobile-TEST.png'),full_page=True)
    check('no external network requests or JavaScript page errors',not requests and not errors)
    b.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'hardware':'simulated devices; actual browser capture graphs'},indent=2))

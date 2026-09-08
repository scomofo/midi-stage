"""MIDI OUT browser integration: simulated Web MIDI outputs, real app/UI/audio clock."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'MIDI-Stage.html').read_text()
MOCK=r"""
(()=>{
 Object.defineProperty(window,'isSecureContext',{get:()=>true,configurable:true});
 const store=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()},configurable:true});
 const kit={id:'kit',name:'Virtual Drum Kit',manufacturer:'Test',state:'connected',onmidimessage:null};
 const keys={id:'keys',name:'Virtual Keys',manufacturer:'Test',state:'connected',onmidimessage:null};
 window.__midiOut=[];window.__midiClear=[];
 const makeOut=(id,name)=>({id,name,manufacturer:'Test',state:'connected',send:(data,timestamp=0)=>window.__midiOut.push({id,data:[...data],timestamp}),clear:()=>window.__midiClear.push(id)});
 const synth=makeOut('synth','Virtual Synth'),pads=makeOut('pads','LED Pads');
 const access={inputs:new Map([['kit',kit],['keys',keys]]),outputs:new Map([['synth',synth],['pads',pads]]),onstatechange:null};
 window.__permissionRequests=[];
 Object.defineProperty(navigator,'requestMIDIAccess',{value:async opts=>{window.__permissionRequests.push(opts);return access;},configurable:true});
 window.__send=(id,data,timeStamp=performance.now())=>access.inputs.get(id).onmidimessage?.({data:Uint8Array.from(data),timeStamp});
 window.__disconnectOut=id=>{access.outputs.get(id).state='disconnected';access.onstatechange?.();};
 window.__at=(target,action)=>new Promise(resolve=>{const tick=()=>{if(MIDIStage.getSnapshot().time>=target){action();resolve();}else requestAnimationFrame(tick)};tick();});
})();
"""
checks=[]
def check(name,value):
 if not value: raise AssertionError(name)
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 context=browser.new_context(viewport={'width':1440,'height':1150},device_scale_factor=1);context.add_init_script(MOCK)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(HTML,wait_until='load')
 page.locator('[data-part="keys"]').click();page.locator('#connectMIDI').click()
 check('Web MIDI permission still requests SysEx disabled',page.evaluate('__permissionRequests.length===1 && __permissionRequests[0].sysex===false'))
 snap=page.evaluate('MIDIStage.getSnapshot()')
 check('two MIDI outputs are enumerated in hardware snapshot',len(snap['outputs'])==2 and {o['name'] for o in snap['outputs']}=={'Virtual Synth','LED Pads'})
 check('instrument setup exposes MIDI OUT hardware section',page.locator('.hardware-global').is_visible() and 'MIDI OUT' in page.locator('.hardware-global').inner_text())
 synth_key='test|virtual synth#1'; pads_key='test|led pads#1'
 # Input routes and output hardware profiles.
 page.locator('[data-route="device"][data-player="drums"]').select_option('kit');page.locator('[data-route="device"][data-player="keys"]').select_option('keys')
 page.locator('[data-hw="outputKey"][data-player="keys"]').select_option(synth_key)
 page.locator('[data-hw="channel"][data-player="keys"]').select_option('3')
 page.locator('[data-hw="preset"][data-player="keys"]').select_option('synth')
 page.locator('[data-hw="outputKey"][data-player="drums"]').select_option(pads_key)
 page.locator('[data-hw="preset"][data-player="drums"]').select_option('feedback')
 page.locator('[data-hw="feedbackNumber"][data-player="drums"]').fill('42');page.locator('[data-hw="feedbackNumber"][data-player="drums"]').press('Tab')
 page.locator('#clockOutput').select_option(synth_key);page.locator('#midiClock').check();page.locator('#midiTransport').check()
 snap=page.evaluate('MIDIStage.getSnapshot()')
 check('hardware profile saves guide output by stable port signature',snap['hardware']['players']['keys']['outputKey']==synth_key and snap['hardware']['players']['keys']['guide'] and snap['hardware']['players']['keys']['channel']==3)
 check('feedback profile saves note pulse route',snap['hardware']['players']['drums']['outputKey']==pads_key and snap['hardware']['players']['drums']['feedback']=='note' and snap['hardware']['players']['drums']['feedbackNumber']==42)
 page.evaluate('__midiOut.length=0');page.locator('[data-hw-test="keys"]').click();page.wait_for_timeout(20)
 sent=page.evaluate('__midiOut')
 check('test note uses selected output and channel',len(sent)>=2 and sent[0]['id']=='synth' and sent[0]['data'][:2]==[0x92,60] and sent[1]['data'][0]==0x82)
 # Close and reopen to prove the saved profile renders without reconfiguration.
 page.locator('[data-close="setupDialog"]').last.click();page.locator('#openSetup').click()
 check('hardware profile selection persists when setup is reopened',page.locator('[data-hw="outputKey"][data-player="keys"]').input_value()==synth_key and page.locator('[data-hw="preset"][data-player="keys"]').input_value()=='synth')
 page.locator('[data-close="setupDialog"]').last.click();page.evaluate('__midiOut.length=0;__midiClear.length=0')
 page.locator('#start').click();page.evaluate("__at(0,()=>{__send('kit',[0x90,36,110]);__send('keys',[0x90,60,100]);})")
 page.wait_for_timeout(100)
 sent=page.evaluate('__midiOut')
 check('session emits MIDI Start transport',any(e['id']=='synth' and e['data']==[0xfa] for e in sent))
 check('session emits 24 PPQN MIDI Clock messages',sum(1 for e in sent if e['id']=='synth' and e['data']==[0xf8])>=2)
 check('external synth guide sends authored key notes on output channel 3',any(e['id']=='synth' and e['data'][:2]==[0x92,60] for e in sent))
 check('successful drum hit pulses configured feedback note',any(e['id']=='pads' and e['data'][:2]==[0x99,42] and e['data'][2]>0 for e in sent))
 check('no SysEx is emitted by any hardware feature',not any(e['data'] and e['data'][0]==0xf0 for e in sent))
 page.locator('#pause').click();page.wait_for_timeout(30);sent=page.evaluate('__midiOut');cleared=page.evaluate('__midiClear')
 check('pause sends MIDI Stop transport',any(e['id']=='synth' and e['data']==[0xfc] for e in sent))
 check('pause clears only configured output queues',set(cleared)=={'synth','pads'})
 check('pause sends sustain-off/all-notes/all-sound panic on configured channels',any(e['id']=='synth' and e['data']==[0xb2,123,0] for e in sent) and any(e['id']=='pads' and e['data']==[0xb9,120,0] for e in sent))
 page.evaluate('__midiOut.length=0');page.locator('#start').click();page.evaluate('__at(MIDIStage.getSnapshot().time,()=>{})');page.wait_for_timeout(2300)
 check('resume emits MIDI Continue rather than another Start',page.evaluate("__midiOut.some(e=>e.id==='synth'&&e.data.length===1&&e.data[0]===0xfb) && !__midiOut.some(e=>e.id==='synth'&&e.data.length===1&&e.data[0]===0xfa)"))
 page.locator('#pause').click();page.locator('#openSetup').click();page.evaluate('__midiOut.length=0');page.locator('#panicOut').click();page.wait_for_timeout(20)
 panic=page.evaluate('__midiOut')
 check('explicit panic targets all sixteen channels on each connected output',sum(1 for e in panic if e['id']=='synth' and len(e['data'])==3 and e['data'][1]==123)==16 and sum(1 for e in panic if e['id']=='pads' and len(e['data'])==3 and e['data'][1]==120)==16)
 page.evaluate("__disconnectOut('synth')")
 check('disconnected output disappears while saved hardware profile remains',page.evaluate("MIDIStage.getSnapshot().outputs.length===1") and 'Saved output (disconnected)' in page.locator('[data-hw="outputKey"][data-player="keys"]').inner_text())
 check('no browser JavaScript errors in MIDI OUT workflow',not errors)
 browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'scope':'simulated Web MIDI I/O; real browser UI/audio clock'},indent=2))

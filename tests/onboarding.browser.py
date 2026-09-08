"""Hardware onboarding browser flow with simulated Web MIDI; no physical hardware."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];HTML=(ROOT/'MIDI-Stage.html').read_text()
MOCK=r"""
(()=>{
 Object.defineProperty(window,'isSecureContext',{get:()=>true,configurable:true});
 const store=new Map();window.__store=store;Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()},configurable:true});
 const kit={id:'opaque-kit-id',name:'Virtual Drum Kit',manufacturer:'Test',state:'connected',onmidimessage:null};
 const keys={id:'opaque-keys-id',name:'Virtual Keys',manufacturer:'Test',state:'connected',onmidimessage:null};
 window.__midiOut=[];const out=(id,name)=>({id,name,manufacturer:'Test',state:'connected',send:(data,timestamp=0)=>window.__midiOut.push({id,data:[...data],timestamp}),clear:()=>{}});
 const synth=out('opaque-synth-id','Virtual Synth'),pads=out('opaque-pads-id','LED Pads');
 const access={inputs:new Map([[kit.id,kit],[keys.id,keys]]),outputs:new Map([[synth.id,synth],[pads.id,pads]]),onstatechange:null};
 window.__permissionRequests=[];Object.defineProperty(navigator,'requestMIDIAccess',{value:async opts=>{window.__permissionRequests.push(opts);return access;},configurable:true});
 window.__send=(id,data,timeStamp=performance.now())=>access.inputs.get(id).onmidimessage?.({data:Uint8Array.from(data),timeStamp});
})();
"""
checks=[]
def check(name,value):
 if not value: raise AssertionError(name)
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 context=browser.new_context(viewport={'width':1280,'height':1000},device_scale_factor=1);context.add_init_script(MOCK)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(HTML,wait_until='load')
 page.locator('#hardwareWizard').click()
 check('wizard opens without requesting MIDI permission',page.locator('#onboardingDialog').is_visible() and page.evaluate('__permissionRequests.length===0'))
 check('wizard starts on discovery step',page.evaluate('MIDIStage.getSnapshot().onboarding.step===0') and 'Find your rig' in page.locator('#wizardTitle').inner_text())
 page.locator('#wizardConnect').click();page.wait_for_function('__permissionRequests.length===1 && MIDIStage.getSnapshot().outputs.length===2')
 check('wizard MIDI access keeps SysEx disabled',page.evaluate('__permissionRequests[0].sysex===false'))
 check('discovery shows two inputs and two outputs','Virtual Drum Kit' in page.locator('#wizardBody').inner_text() and 'Virtual Synth' in page.locator('#wizardBody').inner_text())
 page.locator('#wizardNext').click()
 check('identify step offers all four roles',page.locator('.wizard-role').count()==4)
 page.locator('[data-listen="drums"]').click();page.evaluate("__send('opaque-kit-id',[0x99,36,112])")
 snap=page.evaluate('MIDIStage.getSnapshot()');drums=next(x for x in snap['players'] if x['id']=='drums')
 check('playing drum pad binds drum device and channel',drums['device']=='opaque-kit-id' and drums['channel']==10)
 page.locator('[data-listen="keys"]').click();page.evaluate("__send('opaque-keys-id',[0x90,60,100])")
 snap=page.evaluate('MIDIStage.getSnapshot()');keys_state=next(x for x in snap['players'] if x['id']=='keys')
 check('playing keyboard binds keyboard device and channel',keys_state['device']=='opaque-keys-id' and keys_state['channel']==1)
 page.locator('#wizardNext').click();synth_key='test|virtual synth#1';pads_key='test|led pads#1'
 page.locator('[data-wout="keys"]').select_option(synth_key);page.locator('[data-wpreset="keys"]').select_option('synth')
 page.locator('[data-wout="drums"]').select_option(pads_key);page.locator('[data-wpreset="drums"]').select_option('feedback')
 page.locator('#wizardClockOutput').select_option(synth_key);page.locator('#wizardClock').check();page.locator('#wizardTransport').check()
 snap=page.evaluate('MIDIStage.getSnapshot()')
 check('wizard saves synth and feedback output profiles',snap['hardware']['players']['keys']['preset']=='synth' and snap['hardware']['players']['keys']['outputKey']==synth_key and snap['hardware']['players']['drums']['preset']=='feedback')
 check('wizard saves MIDI clock route',snap['hardware']['clock']['enabled'] and snap['hardware']['clock']['outputKey']==synth_key)
 page.evaluate('__midiOut.length=0');page.locator('[data-wtest="keys"]').click();page.wait_for_timeout(30)
 check('wizard test button sends real MIDI output messages',page.evaluate("__midiOut.some(e=>e.id==='opaque-synth-id' && (e.data[0]&0xf0)===0x90)"))
 page.locator('#wizardNext').click()
 page.locator('[data-woffset="keys"]').fill('18');page.locator('[data-woffset="keys"]').press('Tab')
 check('manual per-player timing correction is saved',next(x for x in page.evaluate('MIDIStage.getSnapshot().players') if x['id']=='keys')['offsetMs']==18)
 page.locator('[data-wcal="keys"]').click()
 check('role calibration handoff names the selected instrument',page.locator('#calibrationDialog').is_visible() and 'Keyboard timing calibration' in page.locator('#calibrationTitle').inner_text())
 page.locator('[data-close="calibrationDialog"]').click();page.wait_for_selector('#onboardingDialog[open]')
 check('closing calibration returns to wizard calibration step',page.evaluate('MIDIStage.getSnapshot().onboarding.step===3'))
 page.locator('#wizardNext').click()
 check('summary includes identified routes and output profile','Virtual Drum Kit' in page.locator('#wizardBody').inner_text() and 'Virtual Synth' in page.locator('#wizardBody').inner_text())
 page.locator('#wizardNext').click();page.wait_for_function('!document.getElementById("onboardingDialog").open')
 check('finish marks onboarding profile complete',page.evaluate('MIDIStage.getSnapshot().onboarding.complete===true'))
 check('completion record is stored locally',page.evaluate("JSON.parse(__store.get('midi-stage-onboarding-v1')).completed===true"))
 check('no JavaScript errors during onboarding workflow',not errors)
 browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'javascript_errors':errors,'scope':'simulated Web MIDI ports; real wizard UI'},indent=2))

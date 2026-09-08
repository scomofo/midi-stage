/* Web MIDI input/output transport. SysEx is deliberately disabled. */
(function(root){
  'use strict';
  const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
  function basePortKey(port){return `${clean(port?.manufacturer).toLowerCase()}|${clean(port?.name).toLowerCase()}`;}
  class MIDIHub {
    constructor({onMessage=()=>{},onDevices=()=>{},onOutputs=()=>{},onDisconnect=()=>{},onOutputDisconnect=()=>{}}={}){
      this.access=null;this.onMessage=onMessage;this.onDevices=onDevices;this.onOutputs=onOutputs;this.onDisconnect=onDisconnect;this.onOutputDisconnect=onOutputDisconnect;this.attached=new Map();this.lastOutputs=new Set();
    }
    async connect(){
      if(!root.isSecureContext)throw Error('MIDI needs a secure page. Launch with start.py and open http://localhost:8765 in Chrome.');
      if(!root.navigator?.requestMIDIAccess)throw Error('Web MIDI is not available here. Use desktop Chrome. Keyboard play still works.');
      this.access=await root.navigator.requestMIDIAccess({sysex:false});
      this.access.onstatechange=()=>this.refresh();this.refresh();return this.devices();
    }
    keyed(ports,label){
      const seen=new Map();return [...ports].filter(p=>p.state==='connected').map(p=>{const base=basePortKey(p),n=(seen.get(base)||0)+1;seen.set(base,n);return {id:p.id,key:`${base}#${n}`,name:p.name||label,manufacturer:p.manufacturer||'',state:p.state};});
    }
    devices(){return this.access?this.keyed(this.access.inputs.values(),'MIDI input'):[];}
    outputDevices(){return this.access?.outputs?.values?this.keyed(this.access.outputs.values(),'MIDI output'):[];}
    refresh(){
      const devices=this.devices(),ids=new Set(devices.map(d=>d.id));
      for(const [id,port] of this.attached)if(!ids.has(id)){port.onmidimessage=null;this.attached.delete(id);this.onDisconnect(id);}
      if(this.access)for(const port of this.access.inputs.values())if(port.state==='connected'&&!this.attached.has(port.id)){
        port.onmidimessage=event=>this.receive(port.id,event);this.attached.set(port.id,port);
      }
      const outputs=this.outputDevices(),outIds=new Set(outputs.map(o=>o.id));
      for(const old of this.lastOutputs)if(!outIds.has(old))this.onOutputDisconnect(old);
      this.lastOutputs=outIds;this.onDevices(devices);this.onOutputs(outputs);
    }
    receive(device,event){
      const d=event.data;if(!d||!d.length)return;const type=d[0]&0xf0,channel=(d[0]&15)+1;
      const timestamp=Number.isFinite(event.timeStamp)?event.timeStamp:performance.now();
      if(d.length>=3&&(type===0x90||type===0x80))this.onMessage({kind:type===0x90&&d[2]>0?'on':'off',device,channel,note:d[1],velocity:type===0x80?0:d[2],timestamp,token:`${device}:${channel}:${d[1]}`});
      else if(d.length>=3&&type===0xb0)this.onMessage({kind:'cc',device,channel,controller:d[1],value:d[2],timestamp});
    }
    outputById(id){return this.access?.outputs?.get(id)||null;}
    outputByKey(key){const meta=this.outputDevices().find(o=>o.key===key);return meta?this.outputById(meta.id):null;}
    send(outputId,data,timestamp=0){
      if(!Array.isArray(data)&&!(data instanceof Uint8Array))throw TypeError('MIDI output data must be a byte sequence.');
      if(data[0]===0xf0)throw Error('SysEx output is disabled in MIDI Stage.');
      const port=this.outputById(outputId);if(!port||port.state==='disconnected')throw Error('MIDI output is disconnected.');
      port.send([...data],Number.isFinite(timestamp)?timestamp:0);return true;
    }
    sendKey(key,data,timestamp=0){const meta=this.outputDevices().find(o=>o.key===key);if(!meta)throw Error('Saved MIDI output is not connected.');return this.send(meta.id,data,timestamp);}
    clear(outputId){const port=this.outputById(outputId);if(port?.clear)port.clear();}
    clearKey(key){const meta=this.outputDevices().find(o=>o.key===key);if(meta)this.clear(meta.id);}
    panic(outputId,channels=Array.from({length:16},(_,i)=>i+1)){
      const port=this.outputById(outputId);if(!port)return false;port.clear?.();for(const ch of channels){const status=0xb0+Math.max(0,Math.min(15,ch-1));port.send([status,64,0]);port.send([status,123,0]);port.send([status,120,0]);}return true;
    }
  }
  root.StageMIDI={MIDIHub,basePortKey};
  if(typeof module==='object'&&module.exports)module.exports={MIDIHub,basePortKey};
})(typeof globalThis!=='undefined'?globalThis:this);

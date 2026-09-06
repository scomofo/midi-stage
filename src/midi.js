/* MIDI input only: no SysEx, output, firmware access, or network traffic. */
(function(root){
  'use strict';
  class MIDIHub {
    constructor({onMessage=()=>{},onDevices=()=>{},onDisconnect=()=>{}}={}){this.access=null;this.onMessage=onMessage;this.onDevices=onDevices;this.onDisconnect=onDisconnect;this.attached=new Map();}
    async connect(){
      if(!window.isSecureContext)throw Error('MIDI needs a secure page. Launch with start.py and open http://localhost:8765 in Chrome.');
      if(!navigator.requestMIDIAccess)throw Error('Web MIDI is not available here. Use desktop Chrome. Keyboard play still works.');
      this.access=await navigator.requestMIDIAccess({sysex:false});
      this.access.onstatechange=()=>this.refresh();this.refresh();return this.devices();
    }
    devices(){return this.access?[...this.access.inputs.values()].filter(p=>p.state==='connected').map(p=>({id:p.id,name:p.name||'MIDI input',manufacturer:p.manufacturer||''})):[];}
    refresh(){
      const devices=this.devices(),ids=new Set(devices.map(d=>d.id));
      for(const [id,port] of this.attached)if(!ids.has(id)){port.onmidimessage=null;this.attached.delete(id);this.onDisconnect(id);}
      if(this.access)for(const port of this.access.inputs.values())if(port.state==='connected'&&!this.attached.has(port.id)){
        port.onmidimessage=event=>this.receive(port.id,event);this.attached.set(port.id,port);
      }
      this.onDevices(devices);
    }
    receive(device,event){
      const d=event.data;if(!d||!d.length)return;const type=d[0]&0xf0,channel=(d[0]&15)+1;
      const timestamp=Number.isFinite(event.timeStamp)?event.timeStamp:performance.now();
      if(d.length>=3&&(type===0x90||type===0x80))this.onMessage({kind:type===0x90&&d[2]>0?'on':'off',device,channel,note:d[1],velocity:type===0x80?0:d[2],timestamp,token:`${device}:${channel}:${d[1]}`});
      else if(d.length>=3&&type===0xb0)this.onMessage({kind:'cc',device,channel,controller:d[1],value:d[2],timestamp});
    }
  }
  root.StageMIDI={MIDIHub};
})(globalThis);

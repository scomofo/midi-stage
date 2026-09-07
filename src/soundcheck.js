/* The Soundcheck UI is intentionally separate from the rhythm-game judge. */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id), roles=['guitar','bass'];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  class Controller {
    constructor({getContext,beforeOpen=()=>{},onMIDI=()=>{},getMIDI=()=>[]}={}) {
      this.beforeOpen=beforeOpen;this.onMIDI=onMIDI;this.getMIDI=getMIDI;this.devices=[];this.status={};this.details={};this.scanSerial=0;
      let saved={};try{saved=JSON.parse(localStorage.getItem('midi-stage-soundcheck-v1'))||{};}catch(_){}
      this.settings=Object.fromEntries(roles.map(role=>[role,{device:typeof saved[role]?.device==='string'?saved[role].device:'',channel:Number.isInteger(saved[role]?.channel)&&saved[role].channel>=1&&saved[role].channel<=32?saved[role].channel:1,gateDb:Number.isFinite(saved[role]?.gateDb)?Math.max(-80,Math.min(-15,saved[role].gateDb)):-55}]));
      this.hub=new StageInput.AudioInputHub({getContext,onData:(role,data)=>this.meter(role,data),onState:(role,status)=>this.state(role,status),onDevices:devices=>{this.devices=devices;this.renderDevices();}});
      this.renderCards();
      $('openSoundcheck').onclick=()=>this.open();
      $('soundClose').onclick=()=>$('soundcheckDialog').close();
      $('soundDone').onclick=()=>$('soundcheckDialog').close();
      $('soundcheckDialog').addEventListener('close',()=>{this.scanSerial++;this.hub.stopAll();this.save();});
      $('soundAllow').onclick=()=>this.allow();
      $('soundRefresh').onclick=()=>this.hub.refresh().then(d=>this.notice(d.length?`${d.length} audio input${d.length===1?'':'s'} listed. Select yours below.`:'No audio inputs listed. Connect your interface, then allow audio access.')).catch(e=>this.notice(StageInput.messageFor(e),true));
      $('soundStop').onclick=()=>{this.scanSerial++;this.hub.stopAll();this.notice('All soundcheck inputs stopped. Nothing is recording.');};
      $('soundMIDI').onclick=()=>{$('soundcheckDialog').close();this.onMIDI();};
      $('soundReport').onclick=()=>this.downloadReport();
      document.addEventListener('visibilitychange',()=>{if(document.hidden){this.scanSerial++;this.hub.stopAll();if($('soundcheckDialog').open)this.notice('Soundcheck stopped because this tab was hidden. Start a check again when ready.');}});
      window.addEventListener('beforeunload',()=>this.hub.destroy());
    }
    save(){try{localStorage.setItem('midi-stage-soundcheck-v1',JSON.stringify(this.settings));}catch(_){}}
    async open(){
      if(this.beforeOpen()===false)return;
      this.updateMIDI();$('soundcheckDialog').showModal();
      if(!this.hub.supported())this.notice('Audio capture is unavailable in this view. Use the localhost launcher in desktop Chrome. MIDI and keyboard play are unchanged.',true);
      else try{await this.hub.refresh();}catch(e){this.notice(StageInput.messageFor(e),true);}
    }
    notice(message,error=false){$('soundStatus').textContent=message;$('soundStatus').classList.toggle('error',error);}
    async allow(){
      const ticket=++this.scanSerial;$('soundAllow').disabled=true;this.notice('Approve audio access in your browser. Its permission dialog may call your interface a microphone.');
      try{const d=await this.hub.allow();if(ticket===this.scanSerial)this.notice(d.length?`${d.length} audio input${d.length===1?'':'s'} found. The permission check has stopped; select an input to test.`:'Permission granted, but no audio inputs were listed. Check your interface connection.');}
      catch(e){if(ticket===this.scanSerial)this.notice(StageInput.messageFor(e),true);}
      finally{$('soundAllow').disabled=false;}
    }
    renderCards(){
      $('soundCards').innerHTML=roles.map(role=>`<section class="sound-card" aria-labelledby="${role}SoundTitle"><div class="sound-card-head"><div><span class="eyebrow">${role==='guitar'?'01 / ELECTRIC GUITAR':'02 / ELECTRIC BASS'}</span><h3 id="${role}SoundTitle">${role==='guitar'?'Guitar':'Bass'} soundcheck</h3></div><span class="sound-badge" id="${role}Badge">STOPPED</span></div><div class="sound-fields"><label for="${role}AudioDevice">AUDIO INPUT<select id="${role}AudioDevice"></select></label><label for="${role}AudioChannel">BROWSER CHANNEL<select id="${role}AudioChannel"></select></label></div><p id="${role}CaptureInfo" class="sound-capture-info">Channel availability will be checked when capture starts.</p><div class="sound-meter-label"><span>INPUT LEVEL</span><output id="${role}Db">— dBFS</output></div><div id="${role}Level" class="sound-level" role="meter" aria-label="${role} input level" aria-valuemin="-80" aria-valuemax="0" aria-valuenow="-80"><span id="${role}LevelBar"></span></div><div class="sound-meter-scale"><span>−80</span><span>−40</span><span>−12</span><span>0 dBFS</span></div><div class="sound-tuner"><output id="${role}Pitch" aria-label="${role} detected note">—</output><div><strong id="${role}Cents">Play one clean note</strong><small id="${role}Frequency">Reference: A4 = 440 Hz</small></div></div><p class="sound-signal" id="${role}Signal" role="status">Choose your interface, then start the check.</p><label class="sound-gate" for="${role}Gate">NOISE GATE <output id="${role}GateValue">${this.settings[role].gateDb} dBFS</output><input id="${role}Gate" type="range" min="-80" max="-15" step="1" value="${this.settings[role].gateDb}"></label><div class="sound-card-foot"><button id="${role}Check" class="button secondary">Check ${role}</button><small>Silent analysis · no audio playback</small></div></section>`).join('');
      for(const role of roles){
        $(`${role}AudioDevice`).onchange=e=>{this.hub.stop(role);this.settings[role].device=e.target.value;delete this.details[role];this.renderChannels(role);$(`${role}CaptureInfo`).textContent='Channel availability will be checked when capture starts.';this.save();this.conflicts();};
        $(`${role}AudioChannel`).onchange=e=>{this.hub.stop(role);this.settings[role].channel=Number(e.target.value);this.save();this.conflicts();};
        $(`${role}Gate`).oninput=e=>{const db=Number(e.target.value);this.settings[role].gateDb=db;$(`${role}GateValue`).textContent=`${db} dBFS`;this.hub.setGate(role,db);this.save();};
        $(`${role}Check`).onclick=async()=>{
          if(this.status[role]?.active||this.status[role]?.pending){this.hub.stop(role);return;}
          const s=this.settings[role];
          try{await this.hub.start(role,s.device,s.channel,s.gateDb);}catch(e){this.state(role,{error:StageInput.messageFor(e)});}
        };
      }
      this.renderDevices();
    }
    renderDevices(){
      for(const role of roles){const s=this.settings[role],missing=s.device&&!this.devices.some(d=>d.id===s.device);
        $(`${role}AudioDevice`).innerHTML=`<option value="">Select your audio input</option>${this.devices.map(d=>`<option value="${esc(d.id)}" ${d.id===s.device?'selected':''}>${esc(d.name)}</option>`).join('')}${missing?`<option value="${esc(s.device)}" selected>Saved input — unavailable / permission needed</option>`:''}`;
        this.renderChannels(role);
      }
      this.conflicts();
    }
    renderChannels(role){
      const s=this.settings[role],count=this.details[role]?.channels,available=Math.min(count||2,32);
      $(`${role}AudioChannel`).innerHTML=Array.from({length:available},(_,i)=>`<option value="${i+1}" ${s.channel===i+1?'selected':''}>Channel ${i+1}${count?'':' · verify'}</option>`).join('')+(s.channel>available?`<option value="${s.channel}" selected>Channel ${s.channel} — not exposed</option>`:'');
    }
    state(role,status){
      if(!role){if(status.error)this.notice(status.error,true);return;}
      this.status[role]=status;const active=!!status.active,pending=!!status.pending;
      $(`${role}Check`).textContent=active?'Stop check':pending?'Cancel check':`Check ${role}`;
      $(`${role}AudioDevice`).disabled=active||pending;$(`${role}AudioChannel`).disabled=active||pending;
      const badge=$(`${role}Badge`);badge.textContent=active?'LISTENING':pending?'CONNECTING':status.error?'CHECK INPUT':'STOPPED';badge.classList.toggle('active',active);badge.classList.toggle('error',!!status.error);
      if(active){this.details[role]=status;this.renderChannels(role);const s=status.settings;
        $(`${role}CaptureInfo`).textContent=`${status.name} · ${status.channels?`${status.channels} browser channel${status.channels===1?'':'s'}`:'channel count not reported — verify manually'}${s.sampleRate?` · ${(s.sampleRate/1000).toFixed(1)} kHz`:''}${[s.echoCancellation,s.noiseSuppression,s.autoGainControl].some(x=>x===true)?' · browser processing remains enabled':''}`;
        $(`${role}Signal`).textContent='Listening. Pluck one string and watch the meter.';
      }else{
        this.meter(role,{db:-100,peak:0,pitch:null,signal:false});
        $(`${role}Signal`).textContent=status.error|| (pending?'Waiting for the browser to open this input…':'Input stopped. Start a check when ready.');
      }
      this.conflicts();
    }
    meter(role,data){
      const db=Math.max(-80,Math.min(0,data.db)),isActive=!!this.status[role]?.active;
      $(`${role}LevelBar`).style.width=`${(db+80)/80*100}%`;$(`${role}Level`).setAttribute('aria-valuenow',db.toFixed(1));$(`${role}Level`).classList.toggle('clipping',!!data.clipping);
      $(`${role}Db`).textContent=data.db<=-99?'— dBFS':`${data.db.toFixed(1)} dBFS`;
      $(`${role}Pitch`).textContent=data.pitch?.name||'—';
      $(`${role}Cents`).textContent=data.pitch?`${Math.abs(data.pitch.cents)<5?'In tune':`${Math.abs(data.pitch.cents).toFixed(0)} cents ${data.pitch.cents>0?'sharp':'flat'}`}`:'Play one clean note';
      $(`${role}Frequency`).textContent=data.pitch?`${data.pitch.frequency.toFixed(1)} Hz · ${Math.round(data.pitch.confidence*100)}% periodicity`:'Reference: A4 = 440 Hz';
      if(isActive){const message=data.muted?'Input interrupted or muted by the device.':data.clipping?'CLIPPING — lower the interface input gain.':!data.signal?'No signal above the gate. Pluck a string; check the input, channel and gain.':data.pitch?'Signal and single-note pitch detected.': 'Signal detected. Let one clean note ring; chords and effects may confuse the tuner.';if($(`${role}Signal`).textContent!==message)$(`${role}Signal`).textContent=message;}
    }
    conflicts(){
      const a=this.settings.guitar,b=this.settings.bass;
      const same=a.device&&a.device===b.device&&a.channel===b.channel;
      $('soundConflict').hidden=!same;$('soundConflict').textContent='Guitar and bass are assigned to the same input channel. These checks will hear the same signal. Use separate exposed channels or test the instruments one at a time.';
    }
    updateMIDI(){const devices=this.getMIDI();$('soundMidiDevices').textContent=devices.length?devices.map(d=>d.name).join(' · '):'No MIDI inputs connected in this session. Use Connect MIDI on the main screen.';}
    receiveMIDI(event){if(event.kind==='on'&&$('soundcheckDialog').open)$('soundMidiLast').textContent=`${this.getMIDI().find(d=>d.id===event.device)?.name||'MIDI input'} · note ${event.note} · channel ${event.channel} · velocity ${event.velocity}`;}
    report(){return {app:'MIDI Stage',version:'0.2.0-soundcheck',createdAt:new Date().toISOString(),purpose:'Local input diagnostics; no audio scoring or physical-device certification.',audioInputs:this.devices.map(d=>({name:d.name})),midiInputs:this.getMIDI().map(d=>({name:d.name,manufacturer:d.manufacturer||''})),routes:Object.fromEntries(roles.map(role=>[role,{inputName:this.devices.find(d=>d.id===this.settings[role].device)?.name||'Not selected / unavailable',browserChannel:this.settings[role].channel,gateDb:this.settings[role].gateDb,capture:this.hub.describe(role),lastOpened:this.details[role]?{name:this.details[role].name,channels:this.details[role].channels,settings:this.details[role].settings}:null}])),limitations:['Device names may be generic.','Browser channels do not prove physical jack routing.','The tuner estimates single notes only.','No audio samples, device IDs or group IDs are included.']};}
    downloadReport(){const blob=new Blob([JSON.stringify(this.report(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='MIDI-Stage-Device-Report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.notice('Device report saved locally. It contains device labels and settings, not audio or private device IDs.');}
  }
  root.StageSoundcheck={Controller};
})(globalThis);

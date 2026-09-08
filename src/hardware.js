/* Safe MIDI OUT profiles, guide routing, clock/transport and hit feedback. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.StageCore);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StageHardware=api;
})(globalThis,function(C){
  'use strict';
  const ROLES=['drums','keys','guitar','bass'];
  const DEFAULT_CHANNEL={drums:10,keys:1,guitar:2,bass:3};
  const DEFAULT_FEEDBACK={drums:36,keys:60,guitar:64,bass:40};
  const PRESETS={
    off:{guide:false,feedback:'off'},
    synth:{guide:true,feedback:'off'},
    feedback:{guide:false,feedback:'note'},
    hybrid:{guide:true,feedback:'note'},
    custom:null
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function playerDefaults(role){return {outputKey:'',channel:DEFAULT_CHANNEL[role]||1,preset:'off',guide:false,feedback:'off',feedbackNumber:DEFAULT_FEEDBACK[role]||60};}
  function defaultSettings(){return {clock:{enabled:false,transport:true,outputKey:''},players:Object.fromEntries(ROLES.map(r=>[r,playerDefaults(r)]))};}
  function normalizePlayer(role,value={}){
    const d=playerDefaults(role),p={...d,...value};p.outputKey=typeof p.outputKey==='string'?p.outputKey:'';p.channel=clamp(Math.round(Number(p.channel)||d.channel),1,16);p.feedbackNumber=clamp(Math.round(Number(p.feedbackNumber)||d.feedbackNumber),0,127);p.feedback=['off','note','cc'].includes(p.feedback)?p.feedback:'off';p.guide=!!p.guide;p.preset=Object.hasOwn(PRESETS,p.preset)?p.preset:'custom';return p;
  }
  function normalizeSettings(value={}){const d=defaultSettings(),clock={...d.clock,...(value.clock||{})};clock.enabled=!!clock.enabled;clock.transport=clock.transport!==false;clock.outputKey=typeof clock.outputKey==='string'?clock.outputKey:'';return {clock,players:Object.fromEntries(ROLES.map(r=>[r,normalizePlayer(r,value.players?.[r])]))};}
  function applyPreset(profile,preset){const p=normalizePlayer('keys',profile);if(!Object.hasOwn(PRESETS,preset))preset='custom';if(PRESETS[preset])Object.assign(p,PRESETS[preset]);p.preset=preset;return p;}
  function status(channel,type){return (type&0xf0)+clamp(channel,1,16)-1;}
  function feedbackValue(grade){return grade==='perfect'?127:grade==='great'?104:grade==='good'?78:0;}
  function beatTimes(song){return (song?.beats||[]).map(b=>Number(b.time)).filter(Number.isFinite).sort((a,b)=>a-b);}
  function clockPlan(song,start=0,end=song.duration){const beats=beatTimes(song),times=[];if(beats.length>=2){for(let i=0;i<beats.length;i++){const a=beats[i];if(a>=end)break;const prev=i?beats[i]-beats[i-1]:60/(song.bpm||120),b=beats[i+1]??(a+prev);if(b<=a)continue;for(let k=0;k<24;k++){const t=a+(b-a)*k/24;if(t>=start-1e-8&&t<end-1e-8)times.push(t);}}}else{const step=60/(song.bpm||120)/24;for(let i=Math.ceil((start-1e-8)/step);i*step<end-1e-8;i++)times.push(i*step);}return times;}
  function songPosition(song,time){const beats=beatTimes(song);let quarter;if(beats.length>=2){let i=0;while(i+1<beats.length&&beats[i+1]<=time+1e-9)i++;const a=beats[i]??0,b=beats[i+1]??(a+(i?beats[i]-beats[i-1]:60/(song.bpm||120))),fraction=b>a?clamp((time-a)/(b-a),0,1):0;quarter=i+fraction;}else quarter=time*(song.bpm||120)/60;return clamp(Math.round(quarter*4),0,0x3fff);}
  class Engine{
    constructor({hub,settings,onStatus=()=>{},now=()=>performance.now()}={}){this.hub=hub;this.settings=normalizeSettings(settings);this.onStatus=onStatus;this.now=now;this.running=false;this.timer=null;this.guide=[];this.guideCursor=0;this.clockTimes=[];this.clockCursor=0;this.transportSent=false;this.session=null;this.touched=new Map();}
    configure(settings){this.settings=normalizeSettings(settings);return this.settings;}
    connected(key){return !!key&&!!this.hub?.outputDevices?.().some(o=>o.key===key);}
    meta(key){return this.hub?.outputDevices?.().find(o=>o.key===key)||null;}
    sendKey(key,data,at=0){if(!key)return false;if(!this.connected(key)){this.onStatus('Saved MIDI output is not connected.');return false;}try{this.hub.sendKey(key,data,at);return true;}catch(e){this.onStatus(e.message);return false;}}
    touch(key,ch){if(!key)return;if(!this.touched.has(key))this.touched.set(key,new Set());this.touched.get(key).add(ch);}
    guidePlan(song,players,start,end){
      const events=[];for(const player of players.filter(p=>p.enabled)){const profile=this.settings.players[player.id];if(!profile?.guide||!profile.outputKey)continue;let notes=[];
        const chords=song.chordHighways?.[player.type];if(chords?.length){for(const e of chords)if(e.time>=start-1e-6&&e.time<end-1e-6)for(const pitch of e.pitches||[])notes.push({time:e.time,duration:e.duration,pitch,velocity:92});}
        else if(!song.rhythmOnly){const part=C.sourceFor(song,player);notes=part.notes.filter(n=>n.time>=start-1e-6&&n.time<end-1e-6);}
        for(const n of notes){const ch=profile.channel,on=status(ch,0x90),off=status(ch,0x80),dur=Math.max(.04,Math.min(Number(n.duration)||.1,end-n.time));events.push({time:n.time,key:profile.outputKey,data:[on,clamp(Math.round(n.pitch),0,127),clamp(Math.round(n.velocity)||90,1,127)]},{time:n.time+dur,key:profile.outputKey,data:[off,clamp(Math.round(n.pitch),0,127),0]});this.touch(profile.outputKey,ch);}
      }return events.sort((a,b)=>a.time-b.time||(a.data[0]&0xf0)-(b.data[0]&0xf0));
    }
    start({song,players,speed=1,seek=0,end=song.duration,resume=false,songNow=()=>seek}={}){
      this.stop({transport:false,panic:true});this.running=true;this.session={song,players,speed,seek,end,resume,songNow};this.guide=this.guidePlan(song,players,seek,end);this.guideCursor=0;this.clockTimes=this.settings.clock.enabled?clockPlan(song,seek,end):[];this.clockCursor=0;this.transportSent=false;this.schedule();this.timer=setInterval(()=>this.schedule(),25);return this.snapshot();
    }
    schedule(){
      if(!this.running||!this.session)return;const {song,speed,seek,end,resume,songNow}=this.session,now=this.now(),current=songNow(now),lookahead=.13*speed,until=current+lookahead;
      const clock=this.settings.clock;if(clock.outputKey&&clock.transport&&!this.transportSent&&current<=seek+.001&&until>=seek){const at=now+Math.max(0,(seek-current)/speed*1000);if(resume||seek>1e-6){const spp=songPosition(song,seek);this.sendKey(clock.outputKey,[0xf2,spp&0x7f,(spp>>7)&0x7f],at);this.sendKey(clock.outputKey,[0xfb],at);}else this.sendKey(clock.outputKey,[0xfa],at);this.transportSent=true;}
      if(clock.enabled&&clock.outputKey)while(this.clockCursor<this.clockTimes.length&&this.clockTimes[this.clockCursor]<=until+1e-8){const t=this.clockTimes[this.clockCursor++];if(t<current-.05*speed)continue;this.sendKey(clock.outputKey,[0xf8],now+Math.max(0,(t-current)/speed*1000));}
      while(this.guideCursor<this.guide.length&&this.guide[this.guideCursor].time<=until+1e-8){const e=this.guide[this.guideCursor++];if(e.time<current-.05*speed)continue;this.sendKey(e.key,e.data,now+Math.max(0,(e.time-current)/speed*1000));}
    }
    feedback(player,grade){const p=this.settings.players[player?.id];if(!p?.outputKey||p.feedback==='off'||!['perfect','great','good'].includes(grade))return false;const value=feedbackValue(grade),now=this.now(),ch=p.channel,n=p.feedbackNumber;this.touch(p.outputKey,ch);
      if(p.feedback==='cc'){this.sendKey(p.outputKey,[status(ch,0xb0),n,value],now);this.sendKey(p.outputKey,[status(ch,0xb0),n,0],now+90);}
      else{this.sendKey(p.outputKey,[status(ch,0x90),n,value],now);this.sendKey(p.outputKey,[status(ch,0x80),n,0],now+90);}return true;
    }
    test(player){const p=this.settings.players[player?.id];if(!p?.outputKey)return false;const now=this.now(),note=p.feedbackNumber||60;this.touch(p.outputKey,p.channel);this.sendKey(p.outputKey,[status(p.channel,0x90),note,110],now);this.sendKey(p.outputKey,[status(p.channel,0x80),note,0],now+160);return true;}
    configuredKeys(){const keys=new Set();if(this.settings.clock.outputKey)keys.add(this.settings.clock.outputKey);for(const p of Object.values(this.settings.players))if(p.outputKey)keys.add(p.outputKey);return keys;}
    panic(all=false){let sent=0;for(const out of this.hub?.outputDevices?.()||[]){let channels;if(all)channels=Array.from({length:16},(_,i)=>i+1);else{channels=new Set(this.touched.get(out.key)||[]);for(const p of Object.values(this.settings.players))if(p.outputKey===out.key)channels.add(p.channel);channels=[...channels];}if(channels.length){this.hub.panic(out.id,channels);sent++;}}return sent;}
    stop({transport=true,panic=true}={}){const wasRunning=this.running;this.running=false;clearInterval(this.timer);this.timer=null;for(const key of this.configuredKeys()){const meta=this.meta(key);if(meta)this.hub.clear(meta.id);}if(wasRunning&&transport&&this.settings.clock.transport&&this.settings.clock.outputKey)this.sendKey(this.settings.clock.outputKey,[0xfc],this.now());if(panic&&(wasRunning||this.touched.size))this.panic(false);this.touched.clear();this.guide=[];this.guideCursor=0;this.clockTimes=[];this.clockCursor=0;this.session=null;this.transportSent=false;}
    snapshot(){return {running:this.running,clock:{...this.settings.clock},players:JSON.parse(JSON.stringify(this.settings.players)),outputs:(this.hub?.outputDevices?.()||[]).map(o=>({...o})),guidePending:Math.max(0,this.guide.length-this.guideCursor)};}
  }
  return {ROLES,PRESETS,DEFAULT_CHANNEL,DEFAULT_FEEDBACK,playerDefaults,defaultSettings,normalizePlayer,normalizeSettings,applyPreset,feedbackValue,beatTimes,clockPlan,songPosition,Engine};
});

/* MIDI Stage: deterministic charts, scoring, and Standard MIDI File parsing.
   No DOM, network, clocks, or audio dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StageCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PC = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const COLORS = ['#ff647c','#f9bc62','#49dcc8','#69a8ff','#be91ff','#eb81cd','#91dc78','#f2df8c','#73cce8','#afadff','#ee9e6c','#8ec2b4'];
  const DRUMS = [
    {name:'KICK', short:'KICK', notes:[35,36], pitch:36, color:COLORS[1]},
    {name:'SNARE', short:'SNR', notes:[37,38,39,40], pitch:38, color:COLORS[0]},
    {name:'HI-HAT', short:'HAT', notes:[42,44,46], pitch:42, color:COLORS[2]},
    {name:'TOMS', short:'TOM', notes:[41,43,45,47,48,50], pitch:45, color:COLORS[3]},
    {name:'CRASH', short:'CRSH', notes:[49,52,55,57], pitch:49, color:COLORS[4]},
    {name:'RIDE', short:'RIDE', notes:[51,53,59], pitch:51, color:COLORS[5]}
  ];
  const WINDOWS = {chill:[0.07,0.12,0.19], standard:[0.045,0.09,0.14], expert:[0.025,0.055,0.09]};
  const TYPES = ['drums','keys','guitar','bass'];
  const LABELS = {drums:'Drums',keys:'Keys',guitar:'Guitar',bass:'Bass'};
  const KEYS = {
    drums:['Space','KeyD','KeyF','KeyG','KeyH','KeyJ'],
    keys:['KeyA','KeyS','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft'],
    guitar:['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','Semicolon','Quote'],
    bass:['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal']
  };
  function keyLabel(code) { return code === 'Space' ? 'SPACE' : code.replace(/^Key|^Digit/,'').replace('BracketLeft','[').replace('Comma',',').replace('Period','.').replace('Slash','/').replace('Semicolon',';').replace('Quote',"'").replace('Minus','−').replace('Equal','='); }
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const pc = n => ((n % 12)+12)%12;
  const noteName = n => PC[pc(n)] + (Math.floor(n/12)-1);
  function defaults() { return TYPES.map((type,i) => ({id:type,type,label:LABELS[type],enabled:i===0,device:'any',channel:type==='drums'?10:i,mode:'pitch',input:'midi',offsetMs:0,source:type,learned:{}})); }
  function median(a) { if (!a.length) return 0; const s=[...a].sort((a,b)=>a-b), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
  function calibration(taps) { const center=median(taps), mad=median(taps.map(x=>Math.abs(x-center))); const clean=taps.filter(x=>Math.abs(x-center)<=Math.max(45,3*mad)); return {offset:Math.round(median(clean)),spread:Math.round(median(clean.map(x=>Math.abs(x-median(clean))))),count:clean.length}; }
  function lowerBound(a,t,field='time') { let l=0,r=a.length; while(l<r){const m=(l+r)>>>1;if(a[m][field]<t) l=m+1; else r=m;}return l; }
  function makeSong(id=0) {
    const info = [
      {id:'neon-circuit',name:'Neon Circuit',subtitle:'A driving pocket. A little electricity.',bpm:112,bars:32,tag:'SYNTH ROCK',accent:'#49dcc8'},
      {id:'after-hours',name:'After Hours',subtitle:'Room to breathe. Space to find your groove.',bpm:88,bars:24,tag:'DOWNTEMPO',accent:'#be91ff'},
      {id:'voltage-run',name:'Voltage Run',subtitle:'Fast hands, tight fills, no holding back.',bpm:144,bars:32,tag:'HIGH ENERGY',accent:'#f9bc62'}
    ][id];
    const beat=60/info.bpm, parts = TYPES.map(type=>({id:type,name:LABELS[type],channel:type==='drums'?10:1,type,notes:[]}));
    const add=(type,b,p,d=.18,v=100)=>parts.find(x=>x.type===type).notes.push({time:b*beat,duration:d*beat,pitch:p,velocity:v});
    const roots=[0,4,3,1], scale=[60,62,64,67,69];
    for(let bar=0;bar<info.bars;bar++) {
      const b=bar*4,r=roots[Math.floor(bar/4)%4],root=scale[r];
      add('drums',b,36);add('drums',b+2,36);
      if(bar%2 && id!==1) add('drums',b+2.5,36,.15,87);
      add('drums',b+1,38);add('drums',b+3,38);
      for(let h=0;h<8;h++) if(id!==1||h%2===0) add('drums',b+h/2,bar>=16&&bar<24?51:42,.12,h%2?64:83);
      if(bar%8===0) add('drums',b,49,.7,95);
      if(bar%8===7) for(let f=0;f<4;f++) add('drums',b+3+f*.25,[48,47,45,43][f],.14,82+f*5);
      for(let k=0;k<4;k++) add('keys',b+k,scale[(r+[0,2,4,2][k])%5],k===3?.75:.65,78);
      if(bar%4===2) {add('keys',b,scale[(r+2)%5]+12,1.65,61);add('keys',b+2,scale[(r+4)%5]+12,1.6,63);}
      for(let g=0;g<4;g++) add('guitar',b+g,scale[(r+(g===3?2:0))%5]-12,g===3?.7:.5,84);
      if(bar%4===3) add('guitar',b+3.5,scale[(r+1)%5]-12,.35,78);
      for(let k=0;k<(id===2?4:2);k++) add('bass',b+k*(id===2?1:2),root-24,(id===2?.8:1.7),95);
    }
    parts.forEach(p=>p.notes.sort((a,b)=>a.time-b.time||a.pitch-b.pitch));
    const duration=info.bars*4*beat;
    return {...info,parts,duration,original:true,tempoMap:[{tick:0,time:0,bpm:info.bpm}],beats:Array.from({length:info.bars*4+1},(_,i)=>({time:i*beat,bar:i%4===0})),sections:[{time:0,name:'INTRO'},{time:8*4*beat,name:'IN THE POCKET'},{time:16*4*beat,name:'TURN IT UP'},{time:24*4*beat,name:'BRING IT HOME'}].filter(x=>x.time<duration)};
  }
  function makeValidationSong() {
    const bpm=96,beat=60/bpm,bars=8;
    const parts=TYPES.map((type,i)=>({id:type,type,name:LABELS[type],channel:type==='drums'?10:i,notes:[]}));
    const add=(type,b,pitch,d=.12,velocity=95)=>parts.find(p=>p.type===type).notes.push({time:b*beat,pitch,duration:d*beat,velocity});
    for(let bar=0;bar<bars;bar++) {
      const b=bar*4;
      for(let i=0;i<4;i++){add('drums',b+i,i%2?38:36);add('drums',b+i,42,.1,64);}
      add('keys',b,64,1.5);add('keys',b+2,67,1.5);
      const riff=bar%4===3?[40,40,43,40]:[40,43,45,47];
      if(bar%4===2){add('guitar',b,40,1.65);add('guitar',b+2,43,1.65);add('bass',b,28,1.65);add('bass',b+2,31,1.65);}
      else for(let i=0;i<4;i++){add('guitar',b+i,riff[i],.68);add('bass',b+i,riff[i]-12,.68);}
    }
    parts.forEach(p=>p.notes.sort((a,b)=>a.time-b.time||a.pitch-b.pitch));
    return {id:'first-rehearsal',name:'First Rehearsal',subtitle:'Four instruments. One clean take.',bpm,bars,tag:'BAND VALIDATION',accent:'#49dcc8',parts,duration:bars*4*beat,original:true,tempoMap:[{tick:0,time:0,bpm}],beats:Array.from({length:bars*4+1},(_,i)=>({time:i*beat,bar:i%4===0})),sections:[{time:0,name:'SINGLE NOTES'},{time:8*beat,name:'HOLD THE NOTE'},{time:12*beat,name:'REPEATED PLUCKS'},{time:16*beat,name:'BRING IT TOGETHER'}]};
  }
  function sourceFor(song, player) { return song.parts.find(p=>p.id===player.source)||song.parts.find(p=>p.type===player.type)||song.parts[0]; }
  function lanesFor(song,player) {
    if(song.rhythmOnly)return [{name:'ANY NOTE / PAD',short:'HIT',pitch:{drums:36,keys:60,guitar:40,bass:28}[player.type],pc:0,any:true,color:COLORS[TYPES.indexOf(player.type)]}];
    if(player.type==='drums') return DRUMS.map(d=>({...d,notes:[...d.notes]}));
    const part=sourceFor(song,player), pitches=[...new Set(part.notes.map(n=>pc(n.pitch)))].sort((a,b)=>a-b);
    return pitches.map((p,i)=>{const all=part.notes.filter(n=>pc(n.pitch)===p).map(n=>n.pitch).sort((a,b)=>a-b);const pitch=all[Math.floor(all.length/2)]||60+p;return {name:PC[p],short:PC[p],pitch,pc:p,color:COLORS[i%COLORS.length]};});
  }
  function laneForPitch(pitch,player,lanes) {
    if(lanes[0]?.any)return Number.isInteger(pitch)&&pitch>=0&&pitch<=127?0:-1;
    if(Object.prototype.hasOwnProperty.call(player.learned,pitch)) return player.learned[pitch];
    return player.type==='drums'?lanes.findIndex(l=>l.notes.includes(pitch)):lanes.findIndex(l=>l.pc===pc(pitch));
  }
  function makeChart(song,player,start=0,end=song.duration) {
    const lanes=lanesFor(song,player), part=sourceFor(song,player);
    // Learned mappings change the controller, never the authored chart.
    const chartPlayer={...player,learned:{}};
    const notes=part.notes.filter(n=>n.time>=start-1e-6&&n.time<end-1e-6).map((n,id)=>({...n,id,lane:laneForPitch(n.pitch,chartPlayer,lanes),duration:Math.min(n.duration,end-n.time)})).filter(n=>n.lane>=0);
    return {lanes,notes};
  }
  function routes(player,device,channel) { return player.enabled&&player.input!=='audio'&&(player.device==='any'||player.device===device)&&(player.channel===0||player.channel===channel); }
  function routingConflicts(players) {
    const enabled=players.filter(p=>p.enabled&&p.input!=='audio'), out=[];
    for(let i=0;i<enabled.length;i++)for(let j=i+1;j<enabled.length;j++){
      const a=enabled[i],b=enabled[j];
      if((a.device==='any'||b.device==='any'||a.device===b.device)&&(a.channel===0||b.channel===0||a.channel===b.channel)) out.push(`${a.label} and ${b.label} share a MIDI route`);
    } return out;
  }
  class Judge {
    constructor(chart,{difficulty='standard',speed=1,drums=false,mode='pitch',verifiedHolds=false,onJudge=()=>{}}={}) {
      this.verifiedHolds=verifiedHolds;this.confirmed=new Map();this.notes=chart.notes.map(n=>({...n,state:0,hold:null}));this.lanes=chart.lanes;this.windows=(WINDOWS[difficulty]||WINDOWS.standard).map(x=>x*speed);this.speed=speed;this.drums=drums;this.mode=mode;this.onJudge=onJudge;this.cursor=0;this.held=new Map();this.activeHolds=new Set();
      this.stats={score:0,combo:0,maxCombo:0,perfect:0,great:0,good:0,miss:0,extra:0,holdBreaks:0,holds:0,weight:0,offsets:[]};
    }
    get multiplier(){return Math.min(4,1+Math.floor(this.stats.combo/10));}
    get accuracy(){const s=this.stats,n=s.perfect+s.great+s.good+s.miss+s.extra;return n?100*s.weight/n:100;}
    tick(t){
      while(this.cursor<this.notes.length&&this.notes[this.cursor].time<t-this.windows[2]-1e-8){const n=this.notes[this.cursor++];if(!n.state){n.state=2;this.stats.miss++;this.stats.combo=0;this.onJudge({grade:'miss',note:n,delta:0});}}
      if(!this.verifiedHolds)for(const n of [...this.activeHolds]) if(t>=n.time+n.duration-.065*this.speed) this.finishHold(n,true);
    }
    hit(t,{lane,pitch,token='keyboard',arcade=false}){
      this.tick(t);let closest=null,best=Infinity;
      for(let i=this.cursor;i<this.notes.length;i++){
        const n=this.notes[i];if(n.time>t+this.windows[2]+1e-8)break;
        if(n.state||n.lane!==lane||(!this.drums&&!arcade&&this.mode==='exact'&&n.pitch!==pitch))continue;
        const d=Math.abs(n.time-t);if(d<=this.windows[2]+1e-8&&d<best){closest=n;best=d;}
      }
      if(!closest){this.stats.extra++;this.stats.combo=0;this.onJudge({grade:'extra',lane,delta:0});return null;}
      const grade=best<=this.windows[0]+1e-8?'perfect':best<=this.windows[1]+1e-8?'great':'good';
      const weight={perfect:1,great:.75,good:.4}[grade],n=closest,s=this.stats;
      n.state=1;n.hitAt=t;n.grade=grade;s[grade]++;s.weight+=weight;s.combo++;s.maxCombo=Math.max(s.maxCombo,s.combo);s.score+=Math.round(100*weight*this.multiplier);s.offsets.push((t-n.time)/this.speed*1000);
      if(!this.drums&&n.duration/this.speed>=.35){n.hold='held';n.token=token;n.holdMultiplier=this.multiplier;this.activeHolds.add(n);if(!this.held.has(token))this.held.set(token,new Set());this.held.get(token).add(n);}
      this.onJudge({grade,note:n,delta:(t-n.time)/this.speed*1000});return n;
    }
    finishHold(n,success){
      if(n.hold!=='held')return;n.hold=success?'complete':'broken';this.activeHolds.delete(n);const set=this.held.get(n.token);if(set){set.delete(n);if(!set.size)this.held.delete(n.token);}
      if(success){this.stats.holds++;this.stats.score+=50*n.holdMultiplier;}else{this.stats.holdBreaks++;this.stats.combo=0;this.onJudge({grade:'release',note:n,delta:0});}
    }
    confirm(token,t){if(!Number.isFinite(t)||!this.held.has(token))return;this.confirmed.set(token,Math.max(this.confirmed.get(token)??-Infinity,t));for(const n of [...(this.held.get(token)||[])])if(t>=n.time+n.duration-.065*this.speed)this.finishHold(n,true);}
    release(token,t){const through=this.verifiedHolds?(this.confirmed.get(token)??-Infinity):t;for(const n of [...(this.held.get(token)||[])])this.finishHold(n,through>=n.time+n.duration-.09*this.speed);this.confirmed.delete(token);}
    finish(t){this.tick(t+this.windows[2]+.001);return {...this.stats,accuracy:this.accuracy,total:this.notes.length,meanOffset:this.stats.offsets.length?this.stats.offsets.reduce((a,b)=>a+b,0)/this.stats.offsets.length:0};}
  }
  function parseMIDI(input,name='Imported MIDI') {
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
    if(bytes.length>8*1024*1024)throw Error('MIDI files must be smaller than 8 MB.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let pos=0,limit=bytes.length,events=0,noteCount=0,maxTick=0;
    function need(n){if(pos+n>limit)throw Error('Truncated MIDI file.');}
    function u8(){need(1);return bytes[pos++];}function u16(){need(2);const n=view.getUint16(pos);pos+=2;return n;}function u32(){need(4);const n=view.getUint32(pos);pos+=4;return n;}
    function str(n){need(n);const s=String.fromCharCode(...bytes.subarray(pos,pos+n));pos+=n;return s;}
    function vlq(){let n=0;for(let i=0;i<4;i++){const b=u8();n=n*128+(b&127);if(!(b&128))return n;}throw Error('Invalid MIDI variable-length value.');}
    if(str(4)!=='MThd')throw Error('This is not a Standard MIDI File (.mid).');
    const hlen=u32();if(hlen<6)throw Error('Invalid MIDI header.');need(hlen);const hend=pos+hlen,format=u16(),tracks=u16(),ppq=u16();pos=hend;
    if(format>1)throw Error('Use MIDI format 0 or 1. Format 2 contains independent sequences.');
    if(!tracks||tracks>512||(format===0&&tracks!==1))throw Error('Invalid MIDI track count.');
    if(!ppq||(ppq&0x8000))throw Error('SMPTE-timed MIDI is not supported. Export with musical/PPQ timing.');
    const tempos=[{tick:0,us:500000}],raw=[];
    for(let ti=0;ti<tracks;ti++){
      limit=bytes.length;if(str(4)!=='MTrk')throw Error('Expected a MIDI track chunk.');const len=u32();need(len);const end=pos+len;limit=end;
      let tick=0,running=0,trackName=`Track ${ti+1}`;const active=new Map(),parts=new Map();
      const partFor=ch=>{if(!parts.has(ch))parts.set(ch,{id:`track-${ti}-ch-${ch+1}`,name:trackName,channel:ch+1,type:ch===9?'drums':'keys',notes:[]});return parts.get(ch);};
      const close=(ch,pitch)=>{const key=`${ch}:${pitch}`,q=active.get(key);if(q&&q.length){const n=q.shift();n.endTick=Math.max(n.tick+1,tick);if(!q.length)active.delete(key);}};
      while(pos<end){
        if(++events>500000)throw Error('This MIDI has too many events. Export a shorter arrangement.');
        tick+=vlq();maxTick=Math.max(maxTick,tick);let status=u8();
        if(status<128){if(!running)throw Error('MIDI running status is missing.');pos--;status=running;}
        if(status===0xff){running=0;const type=u8(),n=vlq();need(n);const at=pos;
          if(type===0x51&&n===3){const us=bytes[pos]*65536+bytes[pos+1]*256+bytes[pos+2];if(us>0)tempos.push({tick,us});}
          if(type===3){trackName=new TextDecoder().decode(bytes.subarray(pos,pos+n)).slice(0,100);parts.forEach(p=>p.name=trackName);}
          pos=at+n;if(type===0x2f){pos=end;break;}continue;
        }
        if(status===0xf0||status===0xf7){running=0;const n=vlq();need(n);pos+=n;continue;}
        if(status>=0xf0)throw Error('Unsupported system event inside this MIDI file.');
        running=status;const type=status&0xf0,ch=status&15,a=u8(),b=(type===0xc0||type===0xd0)?0:u8();if(a>127||b>127)throw Error('Invalid MIDI data byte.');
        if(type===0x90&&b){if(++noteCount>60000)throw Error('This MIDI has more than 60,000 notes. Export a shorter arrangement.');const n={tick,pitch:a,velocity:b,endTick:null};partFor(ch).notes.push(n);const key=`${ch}:${a}`;if(!active.has(key))active.set(key,[]);active.get(key).push(n);}
        else if(type===0x80||(type===0x90&&!b))close(ch,a);
      }
      for(const queue of active.values())for(const n of queue)n.endTick=Math.max(n.tick+ppq/4,tick);
      for(const p of parts.values())if(p.notes.length)raw.push(p);
      pos=end;
    }
    if(!raw.length)throw Error('No playable Note On events were found in this MIDI.');
    tempos.sort((a,b)=>a.tick-b.tick);const map=[];
    for(const t of tempos){if(map.length&&map[map.length-1].tick===t.tick)map[map.length-1]=t;else map.push(t);}
    let time=0;map.forEach((t,i)=>{if(i)time+=(t.tick-map[i-1].tick)/ppq*map[i-1].us/1e6;t.time=time;t.bpm=60e6/t.us;});
    const toSec=tick=>{let i=lowerBound(map,tick+1e-7,'tick')-1;i=Math.max(0,i);const t=map[i];return t.time+(tick-t.tick)/ppq*t.us/1e6;};
    let duration=0;
    const parts=raw.map(p=>({...p,name:`${p.name} · ch ${p.channel}`,notes:p.notes.map(n=>{const t=toSec(n.tick),e=toSec(n.endTick);duration=Math.max(duration,e);return {time:t,duration:Math.max(.02,e-t),pitch:n.pitch,velocity:n.velocity};}).sort((a,b)=>a.time-b.time||a.pitch-b.pitch)}));
    if(duration>3600)throw Error('This MIDI is longer than one hour. Export a shorter section.');
    const beats=[];for(let tick=0;tick<=maxTick&&beats.length<20000;tick+=ppq)beats.push({time:toSec(tick),bar:false});
    let hash=2166136261;for(const byte of bytes){hash^=byte;hash=Math.imul(hash,16777619);}
    return {id:`midi-${(hash>>>0).toString(16)}`,name:name.replace(/\.midi?$/i,''),subtitle:'Your MIDI. Your instruments. Your stage.',tag:'LOCAL MIDI',bpm:Math.round(map[0].bpm),parts,duration:Math.max(duration,.25),original:false,tempoMap:map,beats,sections:[{time:0,name:'YOUR ARRANGEMENT'}],format};
  }
  return {PC,COLORS,DRUMS,WINDOWS,TYPES,LABELS,KEYS,keyLabel,clamp,pc,noteName,defaults,median,calibration,lowerBound,makeSong,makeValidationSong,sourceFor,lanesFor,laneForPitch,makeChart,routes,routingConflicts,Judge,parseMIDI};
});

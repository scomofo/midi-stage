/* Chord highway extraction, local audio estimation, rendering data and scoring. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.StageCore);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StageChords=api;
})(globalThis,function(C){
  'use strict';
  const TEMPLATES=[
    {suffix:'maj7',ints:[0,4,7,11]},{suffix:'7',ints:[0,4,7,10]},{suffix:'m7',ints:[0,3,7,10]},
    {suffix:'',ints:[0,4,7]},{suffix:'m',ints:[0,3,7]},{suffix:'dim',ints:[0,3,6]},
    {suffix:'aug',ints:[0,4,8]},{suffix:'sus2',ints:[0,2,7]},{suffix:'sus4',ints:[0,5,7]},{suffix:'5',ints:[0,7]}
  ];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const unique=a=>[...new Set(a)].sort((x,y)=>x-y);
  const pcs=pitches=>unique(pitches.map(C.pc));
  function chordName(pitches){
    const set=pcs(pitches);if(set.length<2||set.length>4)return null;
    for(let root=0;root<12;root++)for(const t of TEMPLATES){
      const want=unique(t.ints.map(i=>(root+i)%12));
      if(want.length===set.length&&want.every((p,i)=>p===set[i]))return `${C.PC[root]}${t.suffix}`;
    }return null;
  }
  function groupNotes(notes,{tolerance=.035,minTones=2}={}){
    const sorted=[...notes].sort((a,b)=>a.time-b.time||a.pitch-b.pitch),groups=[];let group=[];
    const flush=()=>{if(group.length){const pitches=unique(group.map(n=>n.pitch)),name=chordName(pitches);if(name&&pcs(pitches).length>=minTones){const time=Math.min(...group.map(n=>n.time)),end=Math.max(...group.map(n=>n.time+n.duration));groups.push({time,duration:Math.max(.08,end-time),name,pitches,pcs:pcs(pitches),confidence:1,source:'midi'});}group=[];}};
    for(const n of sorted){if(!group.length||n.time-group[0].time<=tolerance)group.push(n);else{flush();group=[n];}}flush();return groups;
  }
  function templateScore(chroma,root,ints){
    const sum=[...chroma].reduce((a,b)=>a+b,0);if(sum<1e-8)return -1;
    const c=[...chroma].map(v=>v/sum),insideTotal=ints.reduce((v,i)=>v+c[(root+i)%12],0);
    return insideTotal/ints.length-.42*(1-insideTotal)/Math.max(1,12-ints.length);
  }
  function progressionForKey(root){
    const defs=[['I',root,'',[0,4,7]],['V',(root+7)%12,'',[0,4,7]],['vi',(root+9)%12,'m',[0,3,7]],['IV',(root+5)%12,'',[0,4,7]]];
    return defs.map(([roman,r,suffix,ints])=>{const pitches=ints.map(i=>60+r+i);return {roman,root:r,suffix,ints,name:`${C.PC[r]}${suffix}`,pitches,pcs:pcs(pitches)};});
  }
  function fitPopProgression(chromas,forcedKey=null){
    if(!Array.isArray(chromas)||chromas.length<4)return null;let best=null,second=null;
    for(let key=0;key<12;key++){if(forcedKey!==null&&key!==forcedKey)continue;const prog=progressionForKey(key);for(const span of [1,2,4])for(let offset=0;offset<span;offset++)for(let phase=0;phase<4;phase++){
      let score=0,count=0;for(let i=0;i<chromas.length;i++){const c=chromas[i];if(!c)continue;const chord=prog[(Math.floor((i+offset)/span)+phase)%4];score+=templateScore(c,chord.root,chord.ints);count++;}
      if(!count)continue;const fit={key,span,offset,phase,score:score/count,progression:prog};if(!best||fit.score>best.score){second=best;best=fit;}else if(!second||fit.score>second.score)second=fit;
    }}
    if(!best||best.score<.06)return null;best.confidence=clamp((best.score-(second?.score??0))/.028,0,1);if(best.confidence<.06)return null;return best;
  }
  function classifyChroma(chroma){
    if(!Array.isArray(chroma)&&!(chroma instanceof Float32Array)&&!(chroma instanceof Float64Array))throw Error('Invalid chroma data.');
    if(chroma.length!==12||[...chroma].some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid chroma data.');
    const sum=[...chroma].reduce((a,b)=>a+b,0);if(sum<1e-8)return null;const scores=[];
    for(let root=0;root<12;root++)for(const t of TEMPLATES.filter(t=>t.ints.length>=3&&t.ints.length<=4))scores.push({root,template:t,score:templateScore(chroma,root,t.ints)});
    scores.sort((a,b)=>b.score-a.score);const best=scores[0],second=scores[1];
    if(best.score<.055)return null;
    const confidence=clamp((best.score-second.score)/Math.max(.02,best.score)*1.8,0,1);
    const rootMidi=60+best.root,pitches=best.template.ints.map(i=>rootMidi+i);
    return {name:`${C.PC[best.root]}${best.template.suffix}`,root:best.root,pitches,pcs:pcs(pitches),confidence};
  }
  function fftChroma(samples,sampleRate){
    const n=samples.length,re=new Float64Array(n),im=new Float64Array(n);for(let i=0;i<n;i++)re[i]=samples[i]*(.5-.5*Math.cos(2*Math.PI*i/(n-1)));
    for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const x=re[i];re[i]=re[j];re[j]=x;}}
    for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr0=Math.cos(ang),wi0=Math.sin(ang);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const u=i+j,v=u+len/2,tr=wr*re[v]-wi*im[v],ti=wr*im[v]+wi*re[v];re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;const nw=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nw;}}}
    const chroma=new Float64Array(12);for(let k=1;k<n/2;k++){const f=k*sampleRate/n;if(f<65||f>1800)continue;const midi=69+12*Math.log2(f/440),p=C.pc(Math.round(midi)),mag=re[k]*re[k]+im[k]*im[k];chroma[p]+=mag/Math.sqrt(f);}return chroma;
  }
  function windowChroma(buffer,from,to,n=2048){
    const dur=Math.max(.08,to-from),rate=n/dur,samples=new Float64Array(n),channels=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c));
    for(let i=0;i<n;i++){const t=from+i/n*dur,idx=clamp(Math.floor(t*buffer.sampleRate),0,buffer.length-1);let v=0;for(const ch of channels)v+=ch[idx];samples[i]=v/channels.length;}
    return fftChroma(samples,rate);
  }
  async function analyzeBuffer(buffer,{bpm,firstBeat=0,progress=()=>{},cancelled=()=>false,progressionAssist=true,forcedKey=null}={}){
    if(!buffer||!Number.isFinite(buffer.duration)||!Number.isFinite(buffer.sampleRate)||!Number.isFinite(bpm)||bpm<20||bpm>400)throw Error('Set a valid decoded song and tempo before estimating chords.');
    const beat=60/bpm,raw=[],chromas=[],max=Math.min(3000,Math.ceil((buffer.duration-firstBeat)/beat));
    for(let i=0;i<max;i++){
      if(cancelled()){const e=Error('Chord analysis cancelled.');e.name='AbortError';throw e;}
      const time=firstBeat+i*beat;if(time>=buffer.duration-.05)break;const end=Math.min(buffer.duration,time+Math.max(.18,Math.min(.72,beat*.9))),chroma=windowChroma(buffer,time,end),found=classifyChroma(chroma);chromas.push(chroma);
      raw.push(found?{time,duration:Math.max(.08,end-time),...found,source:'estimated'}:{time,duration:Math.max(.08,end-time),name:null,confidence:0,source:'estimated'});
      if(i%8===7){progress((i+1)/max);await new Promise(r=>setTimeout(r,0));}
    }
    if(forcedKey!==null&&(!Number.isInteger(forcedKey)||forcedKey<0||forcedKey>11))throw Error('Forced key must be a pitch class from 0 to 11.');const pop=progressionAssist?fitPopProgression(chromas,forcedKey):null;
    if(pop){const out=[];for(let i=0;i<raw.length;i++){const chord=pop.progression[(Math.floor((i+pop.offset)/pop.span)+pop.phase)%4],score=templateScore(chromas[i],chord.root,chord.ints),local=clamp((score-.025)/.19,0,1),e={time:raw[i].time,duration:Math.min(beat,buffer.duration-raw[i].time),name:chord.name,pitches:chord.pitches,pcs:chord.pcs,roman:chord.roman,key:C.PC[pop.key],confidence:clamp(.35*pop.confidence+.65*local,0,1),source:'estimated'};const last=out.at(-1);if(last&&last.name===e.name&&last.roman===e.roman&&e.time<=last.time+last.duration+beat*.2){last.duration=Math.min(buffer.duration-last.time,e.time+e.duration-last.time);last.confidence=(last.confidence+e.confidence)/2;}else out.push(e);}progress(1);return out;}
    for(let i=1;i<raw.length-1;i++)if(raw[i-1].name&&raw[i-1].name===raw[i+1].name&&(raw[i].confidence<.18||raw[i].name!==raw[i-1].name))raw[i]={...raw[i-1],time:raw[i].time,duration:raw[i].duration,confidence:Math.min(raw[i-1].confidence,raw[i+1].confidence)};
    const out=[];for(const e of raw){if(!e.name||e.confidence<.035)continue;const last=out.at(-1);if(last&&last.name===e.name&&e.time<=last.time+last.duration+beat*.2){last.duration=Math.min(buffer.duration,last.duration+beat);last.confidence=(last.confidence+e.confidence)/2;}else out.push({...e,duration:Math.min(beat,buffer.duration-e.time)});}progress(1);return out;
  }
  function makeChart(song,player,start=0,end=song.duration,{timingOnly=false}={}){
    const events=song.chordHighways?.[player.type]||[];if(!events.length)return null;
    const lanes=timingOnly?[{name:'CHORD STRUM',short:'STRUM',pitch:40,pc:0,any:true,color:C.COLORS[2]}]:C.PC.map((name,i)=>({name,short:name,pitch:60+i,pc:i,color:C.COLORS[i]}));
    const source=C.sourceFor(song,player)?.notes||[],consumed=new Set();
    const notes=events.filter(e=>e.time>=start-1e-6&&e.time<end-1e-6).map(e=>{
      const toneEnds={};
      // Only replace the source attacks belonging to this target. Riffs, rolled
      // voicings and unsupported chord names remain playable ordinary notes.
      if(!song.rhythmOnly)for(let i=C.lowerBound(source,e.time-.035-1e-8);i<source.length&&source[i].time<=e.time+.035+1e-8;i++){
        const n=source[i];
        if(!consumed.has(i)&&Math.abs(n.time-e.time)<=.035+1e-8&&e.pitches.includes(n.pitch)){
          consumed.add(i);toneEnds[n.pitch]=Math.max(toneEnds[n.pitch]||0,Math.min(end,n.time+n.duration));
        }
      }
      return {...e,chord:true,lanes:timingOnly?[0]:e.pcs.slice(),lane:timingOnly?0:e.pcs[0],duration:Math.min(e.duration,end-e.time),toneEnds};
    });
    // Audio rhythm markers are placeholders, not additional authored pitches.
    if(!song.rhythmOnly)source.forEach((n,i)=>{
      if(!consumed.has(i)&&n.time>=start-1e-6&&n.time<end-1e-6)notes.push({...n,chord:false,lane:timingOnly?0:C.pc(n.pitch),duration:Math.min(n.duration,end-n.time)});
    });
    notes.sort((a,b)=>a.time-b.time||(a.pitch??-1)-(b.pitch??-1));notes.forEach((n,id)=>n.id=id);
    return {lanes,notes,chordMode:true,timingOnly};
  }
  class ChordJudge{
    constructor(chart,{difficulty='standard',speed=1,mode='pitch',timingOnly=false,verifiedHolds=false,onJudge=()=>{}}={}){
      this.notes=chart.notes.map(n=>({...n,state:0,hold:null,received:new Set()}));this.lanes=chart.lanes;
      this.windows=(C.WINDOWS[difficulty]||C.WINDOWS.standard).map(x=>x*speed);this.speed=speed;this.mode=mode;this.timingOnly=timingOnly;this.verifiedHolds=verifiedHolds;
      this.chordMode=true;this.cursor=0;this.onJudge=onJudge;this.activeHolds=new Set();this.held=new Map();this.confirmed=new Map();this.sounding=new Map();this.pending=new Set();this.recentChords=[];
      this.stats={score:0,combo:0,maxCombo:0,perfect:0,great:0,good:0,miss:0,extra:0,holdBreaks:0,holds:0,weight:0,offsets:[]};
    }
    get multiplier(){return Math.min(4,1+Math.floor(this.stats.combo/10));}
    get accuracy(){const s=this.stats,n=s.perfect+s.great+s.good+s.miss+s.extra;return n?100*s.weight/n:100;}
    exact(n,arcade=false){return this.mode==='exact'&&!arcade&&(!n.chord||n.source==='midi');}
    required(n,exact=this.exact(n)){return n.chord?(exact?n.pitches:n.pcs):[exact?n.pitch:(this.lanes[n.lane]?.pc??C.pc(n.pitch))];}
    voiceKey(v,exact){return exact?v.pitch:(this.lanes[v.lane]?.pc??C.pc(v.pitch));}
    matches(n,v,exact=this.exact(n,v.arcade)){
      if(n.chord)return this.timingOnly||this.required(n,exact).includes(this.voiceKey(v,exact));
      return n.lane===v.lane&&(!exact||n.pitch===v.pitch);
    }
    voicesFor(n,exact=this.exact(n)){return [...this.sounding.entries()].filter(([,v])=>this.matches(n,v,exact));}
    guidance(){
      let n;for(let i=this.cursor;i<this.notes.length;i++)if(!this.notes[i].state){n=this.notes[i];break;}if(!n)return null;
      const exact=this.exact(n),expected=this.required(n,exact),held=unique(this.voicesFor(n,exact).map(([,v])=>this.voiceKey(v,exact)));
      return {id:n.id,name:n.name||C.noteName(n.pitch),chord:!!n.chord,exact,timingOnly:!!(n.chord&&this.timingOnly),expected:expected.slice(),held,missing:expected.filter(k=>!held.includes(k))};
    }
    tick(t){
      while(this.cursor<this.notes.length&&this.notes[this.cursor].time<t-this.windows[2]-1e-8){const n=this.notes[this.cursor++];if(!n.state){n.state=2;this.pending.delete(n);this.stats.miss++;this.stats.combo=0;this.onJudge({grade:'miss',note:n,delta:0});}}
      if(!this.verifiedHolds)for(const n of [...this.activeHolds])if(t>=n.time+n.duration-.065*this.speed)this.finishHold(n,true);
    }
    hit(t,{lane,pitch,token=`note:${pitch}`,arcade=false}){
      if(!Number.isFinite(t)||!Number.isInteger(pitch)||pitch<0||pitch>127)return null;
      this.tick(t);if(this.sounding.has(token))this.release(token,t);
      const voice={lane:lane??this.lanes.findIndex(l=>l.pc===C.pc(pitch)),pitch,at:t,arcade,credited:false};this.sounding.set(token,voice);
      // A doubled octave can take over a pitch-class sustain before another
      // octave releases. Track every sounding token, not just the scoring onset.
      for(const n of this.activeHolds)if(n.chord&&this.matches(n,voice,n.matchExact))this.attach(n,token);
      let closest=null,best=Infinity;
      for(let i=this.cursor;i<this.notes.length;i++){
        const n=this.notes[i];if(n.time>t+this.windows[2]+1e-8)break;
        const d=Math.abs(n.time-t);if(n.state||d>this.windows[2]+1e-8||!this.matches(n,voice))continue;
        if(d<best){closest=n;best=d;}
      }
      // MIDI serializes a simultaneous voicing. The final doubled tone must not
      // become an extra just because the other tones completed the target first.
      this.recentChords=this.recentChords.filter(n=>n.hold==='held'||Math.abs(t-n.hitAt)<=.08*this.speed+1e-8);
      const completed=this.recentChords.find(n=>!this.timingOnly&&this.matches(n,voice,n.matchExact)&&
        (n.hold==='held'||Math.abs(t-n.hitAt)<=.08*this.speed+1e-8)&&Math.abs(t-n.time)<=best+1e-8);
      if(completed){voice.credited=true;return completed;}
      if(!closest){this.stats.extra++;this.stats.combo=0;this.onJudge({grade:'extra',lane:voice.lane,delta:0});return null;}
      if(!closest.chord||this.timingOnly){voice.credited=true;return this.award(closest,t,best,token,this.exact(closest,arcade));}
      this.pending.add(closest);const exact=this.exact(closest,arcade),required=this.required(closest,exact),voices=this.voicesFor(closest,exact);
      // Credited common tones may remain held through a chord change. All other
      // tones must start in this target's window and within a 120 ms roll. A hit
      // call is always required: holding a repeated chord never scores itself.
      const eligible=voices.filter(([,v])=>v.credited||Math.abs(v.at-closest.time)<=this.windows[2]+1e-8);
      const received=new Set(eligible.map(([,v])=>this.voiceKey(v,exact)));closest.received=received;
      if(required.some(k=>!received.has(k)))return closest;
      // Select one voice per tone: octave doubling cannot worsen the grade.
      const chosen=required.map(k=>eligible.filter(([,v])=>this.voiceKey(v,exact)===k).sort((a,b)=>Number(b[1].credited)-Number(a[1].credited)||Math.abs(a[1].at-closest.time)-Math.abs(b[1].at-closest.time))[0]);
      const fresh=chosen.filter(([,v])=>!v.credited).map(([,v])=>v.at);fresh.push(t);
      if(Math.max(...fresh)-Math.min(...fresh)>.12*this.speed+1e-8)return closest;
      const error=Math.max(...fresh.map(at=>Math.abs(at-closest.time)));
      for(const [,v]of voices)v.credited=true;
      return this.award(closest,t,error,token,exact);
    }
    attach(n,token){if(!this.held.has(token))this.held.set(token,new Set());this.held.get(token).add(n);}
    award(n,t,best,token,exact){
      const grade=best<=this.windows[0]+1e-8?'perfect':best<=this.windows[1]+1e-8?'great':'good',weight={perfect:1,great:.75,good:.4}[grade],s=this.stats;
      n.state=1;n.hitAt=t;n.grade=grade;n.matchExact=exact;s[grade]++;s.weight+=weight;s.combo++;s.maxCombo=Math.max(s.maxCombo,s.combo);s.score+=Math.round((n.chord?140:100)*weight*this.multiplier);s.offsets.push((t-n.time)/this.speed*1000);
      this.pending.delete(n);if(n.chord)this.recentChords.push(n);
      if(n.duration/this.speed>=.35&&!(n.chord&&this.timingOnly)){
        n.hold='held';n.token=token;n.holdMultiplier=this.multiplier;this.activeHolds.add(n);
        if(n.chord){for(const [tok]of this.voicesFor(n,exact))this.attach(n,tok);}else this.attach(n,token);
      }
      this.onJudge({grade,note:n,delta:(t-n.time)/this.speed*1000});return n;
    }
    finishHold(n,success){
      if(n.hold!=='held')return;n.hold=success?'complete':'broken';this.activeHolds.delete(n);
      for(const [token,set]of this.held){set.delete(n);if(!set.size)this.held.delete(token);}
      if(success){this.stats.holds++;this.stats.score+=50*n.holdMultiplier;}else{this.stats.holdBreaks++;this.stats.combo=0;this.onJudge({grade:'release',note:n,delta:0});}
    }
    confirm(token,t){
      if(!Number.isFinite(t)||!this.held.has(token))return;this.confirmed.set(token,Math.max(this.confirmed.get(token)??-Infinity,t));
      for(const n of [...this.held.get(token)])if(!n.chord&&t>=n.time+n.duration-.065*this.speed)this.finishHold(n,true);
    }
    release(token,t){
      if(!Number.isFinite(t))return;const holds=[...(this.held.get(token)||[])];this.sounding.delete(token);this.held.delete(token);
      for(const n of holds){
        const through=this.verifiedHolds?(this.confirmed.get(token)??-Infinity):t;
        if(!n.chord){this.finishHold(n,through>=n.time+n.duration-.09*this.speed);continue;}
        const still=new Set(this.voicesFor(n,n.matchExact).map(([,v])=>this.voiceKey(v,n.matchExact)));
        const needed=this.required(n,n.matchExact).filter(key=>{
          const pitches=n.pitches.filter(p=>n.matchExact?p===key:C.pc(p)===key);
          const until=Math.max(...pitches.map(p=>n.toneEnds?.[p]??n.time+n.duration));
          return t<until-.09*this.speed;
        });
        if(needed.some(key=>!still.has(key)))this.finishHold(n,false);
        else if(t>=n.time+n.duration-.09*this.speed)this.finishHold(n,true);
      }
      this.confirmed.delete(token);
      for(const n of this.pending)n.received=new Set(this.voicesFor(n).map(([,v])=>this.voiceKey(v,this.exact(n))));
    }
    cancelHolds(){
      const count=this.activeHolds.size;for(const n of this.activeHolds)n.hold='paused';this.activeHolds.clear();this.held.clear();this.confirmed.clear();this.sounding.clear();
      for(const n of this.pending)n.received.clear();this.pending.clear();this.recentChords=[];return count;
    }
    finish(t){this.tick(t+this.windows[2]+.001);return {...this.stats,accuracy:this.accuracy,total:this.notes.length,meanOffset:this.stats.offsets.length?this.stats.offsets.reduce((a,b)=>a+b,0)/this.stats.offsets.length:0};}
  }
  return {TEMPLATES,chordName,groupNotes,templateScore,progressionForKey,fitPopProgression,classifyChroma,fftChroma,analyzeBuffer,makeChart,ChordJudge};
});

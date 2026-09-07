/* Song Workshop data model. Pure, bounded chart operations; never fetches audio. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.StageCore);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StageWorkshop=api;
})(globalThis,function(C){
  'use strict';
  const SCHEMA='midi-stage-chart',VERSION=1,MAX_NOTES=60000,MAX_SECONDS=3600,MAX_JSON=12*1024*1024;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const sortNotes=a=>a.sort((x,y)=>x.time-y.time||x.pitch-y.pitch);
  function number(n,min,max,label){if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`${label} must be between ${min} and ${max}.`);return n;}
  function integer(n,min,max,label){number(n,min,max,label);if(!Number.isInteger(n))throw Error(`${label} must be a whole number.`);return n;}
  function text(s,fallback,max=160){return typeof s==='string'?s.slice(0,max):fallback;}
  function id(){return 'chart-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
  function empty({title='Untitled session',duration=60,bpm=120}={}){
    return validate({schema:SCHEMA,version:VERSION,id:id(),title,bpm,duration,firstBeat:0,audioOffset:0,audioName:'',origin:'manual',parts:C.TYPES.map(type=>({type,notes:[]})),tempoMap:[],beats:[]});
  }
  function validate(raw){
    if(!raw||typeof raw!=='object'||raw.schema!==SCHEMA||![1,2].includes(raw.version))throw Error('Use a MIDI Stage chart exported by Song Workshop (version 1 or 2).');
    if(raw.matching!==undefined&&raw.matching!=='rhythm')throw Error('Unsupported chart matching mode.');
    const rhythm=raw.version===2&&raw.matching==='rhythm';
    if(raw.version===2&&!rhythm||raw.matching==='rhythm'&&!rhythm)throw Error('Rhythm charts require version 2 and rhythm matching.');
    const duration=number(raw.duration,.25,MAX_SECONDS,'Song duration');
    const bpm=number(raw.bpm,20,400,'Tempo'),firstBeat=number(raw.firstBeat??0,0,duration,'First beat');
    const audioOffset=number(raw.audioOffset??0,-120,120,'Audio offset');
    if(typeof raw.id!=='string'||!/^chart-[a-zA-Z0-9-]{1,90}$/.test(raw.id))throw Error('Invalid chart ID.');
    if(!Array.isArray(raw.parts)||raw.parts.length!==4)throw Error('A chart must contain four instrument parts.');
    let total=0;const seen=new Set();
    const parts=C.TYPES.map(type=>{
      const part=raw.parts.find(p=>p?.type===type);if(!part||seen.has(part.type)||!Array.isArray(part.notes))throw Error(`Missing or invalid ${type} part.`);seen.add(part.type);
      total+=part.notes.length;if(total>MAX_NOTES)throw Error('A chart can contain at most 60,000 notes.');
      const notes=part.notes.map(n=>{
        if(!n||typeof n!=='object')throw Error('Invalid chart note.');
        const time=number(n.time,0,duration-.000001,'Note time'),length=number(n.duration,.02,MAX_SECONDS,'Note duration');
        if(time+length>duration+.00001)throw Error('A note extends beyond the song. Increase duration first.');
        const pitch=integer(n.pitch,0,127,'MIDI pitch');
        if(type==='drums'&&!C.DRUMS.some(d=>d.notes.includes(pitch)))throw Error(`Drum note ${pitch} has no supported lane. Remap it before importing.`);
        return {time,duration:length,pitch,velocity:integer(n.velocity??100,1,127,'Velocity')};
      });
      const dedup=new Set();return {type,notes:sortNotes(notes).filter(n=>{const key=`${n.time}:${n.pitch}`;if(dedup.has(key))return false;dedup.add(key);return true;})};
    });
    const tempoMap=(raw.tempoMap??[]);if(!Array.isArray(tempoMap)||tempoMap.length>20000)throw Error('Invalid tempo map.');
    let prev=-1;const tempos=tempoMap.map(t=>{const time=number(t.time,0,duration,'Tempo time');if(time<=prev)throw Error('Tempo map must be sorted with unique times.');prev=time;return {time,bpm:number(t.bpm,.01,6e7,'MIDI tempo')};});
    const inputBeats=raw.beats??[];if(!Array.isArray(inputBeats)||inputBeats.length>20000)throw Error('Too many beat markers.');
    prev=-1;const beats=inputBeats.map(b=>{const time=number(b.time,0,duration+.00001,'Beat time');if(time<=prev)throw Error('Beat markers must be sorted with unique times.');prev=time;return {time,bar:!!b.bar};});
    return {schema:SCHEMA,version:rhythm?2:VERSION,...(rhythm?{matching:'rhythm'}:{}),id:raw.id,title:text(raw.title,'Untitled session').trim()||'Untitled session',bpm,duration,firstBeat,audioOffset,audioName:text(raw.audioName,''),origin:rhythm?'audio-rhythm':['midi','practice','manual'].includes(raw.origin)?raw.origin:'manual',parts,tempoMap:tempos,beats};
  }
  function parse(input){if(typeof input!=='string'||input.length>MAX_JSON)throw Error('Chart JSON must be smaller than 12 MB.');let raw;try{raw=JSON.parse(input);}catch(_){throw Error('The chart file is not valid JSON.');}return validate(raw);}
  function serialize(project){return JSON.stringify(validate(project),null,2);}
  function grid(project){
    if(project.beats.length)return clone(project.beats);
    const beat=60/project.bpm,result=[];
    for(let i=0;i<20000;i++){const time=project.firstBeat+i*beat;if(time>project.duration+1e-8)break;result.push({time,bar:i%4===0});}return result;
  }
  function snap(time,project,division=2){
    if(!division)return C.clamp(time,0,project.duration-.02);
    number(division,1,16,'Grid division');let start=project.firstBeat,step=60/project.bpm;
    if(project.beats.length){const at=C.lowerBound(project.beats,time+.0000001)-1;if(at>=0){start=project.beats[at].time;step=at+1<project.beats.length?project.beats[at+1].time-start:60/(project.tempoMap.at(-1)?.bpm||project.bpm);}}
    return Math.round(C.clamp(start+Math.round((time-start)/step*division)*step/division,0,project.duration-.02)*1e6)/1e6;
  }
  function suggestRoutes(song){
    return Object.fromEntries(song.parts.map(p=>[p.id,p.channel===10||/drum|percuss|kit/i.test(p.name)?'drums':/bass/i.test(p.name)?'bass':/guit|lead string/i.test(p.name)?'guitar':'keys']));
  }
  function monophonic(notes,low=false){
    const out=[];
    for(const n of sortNotes(clone(notes))){
      const last=out.at(-1);
      if(last&&Math.abs(n.time-last.time)<.025){if((low&&n.pitch<last.pitch)||(!low&&n.pitch>last.pitch))out[out.length-1]=n;continue;}
      if(last&&last.time+last.duration>n.time){last.duration=n.time-last.time;if(last.duration<.02)out.pop();}
      out.push(n);
    }return out;
  }
  function thin(notes,level='full'){
    if(!['full','medium','easy'].includes(level))throw Error('Unknown chart density.');
    if(level==='full')return clone(notes);
    const step=level==='easy'?.28:.14,out=[];let group=-Infinity;
    for(const n of sortNotes(clone(notes))){if(n.time-group<.00001||n.time-group>=step){if(n.time-group>=step)group=n.time;out.push(n);}}return out;
  }
  function fromMIDI(song,routes,{density='full',singleStrings=false}={}){
    const project=empty({title:song.name,duration:song.duration,bpm:C.clamp(song.bpm,20,400)});project.origin='midi';
    project.tempoMap=song.tempoMap.filter(t=>t.time<=song.duration).map(({time,bpm})=>({time,bpm}));
    project.beats=song.beats.filter(b=>b.time<=song.duration).map(b=>({...b}));
    const warnings=[];
    for(const source of song.parts){const role=routes[source.id];if(!role||role==='skip')continue;if(!C.TYPES.includes(role))throw Error('Invalid instrument assignment.');
      const target=project.parts.find(p=>p.type===role);let removed=0;
      for(const n of source.notes){if(role==='drums'&&!C.DRUMS.some(d=>d.notes.includes(n.pitch))){removed++;continue;}
        const duration=Math.min(n.duration,project.duration-n.time);if(duration>=.02)target.notes.push({...n,duration});}
      if(removed)warnings.push(`${source.name}: skipped ${removed} pitches with no drum lane; assign them to another instrument to preserve them.`);
    }
    for(const p of project.parts){p.notes=thin(p.notes,density);if(singleStrings&&['guitar','bass'].includes(p.type))p.notes=monophonic(p.notes,p.type==='bass');}
    if(singleStrings)warnings.push('Single-note reduction applied to guitar/bass: chord tones and overlapping tails may be removed.');
    return {project:validate(project),warnings};
  }
  function fromSong(song,players=[]){
    if(song.chartProject)return validate(song.chartProject);
    const routes={};for(const p of song.parts){const assigned=players.find(x=>x.source===p.id);routes[p.id]=C.TYPES.includes(p.type)?p.type:(assigned?.type||suggestRoutes(song)[p.id]);}
    const p=fromMIDI(song,routes).project;return song.rhythmOnly?validate({...p,version:2,matching:'rhythm'}):p;
  }
  function practice(project,{roles=['drums'],density='medium',roots={keys:60,guitar:40,bass:28}}={}){
    const p=validate(project);if(!Array.isArray(roles)||!roles.length||roles.some(r=>!C.TYPES.includes(r)))throw Error('Select at least one instrument to generate.');
    if(!['easy','medium','full'].includes(density))throw Error('Unknown chart density.');
    if(p.matching==='rhythm'&&p.parts.some(part=>part.notes.length&&!roles.includes(part.type)))throw Error('Select every populated instrument before converting a rhythm chart to pitch exercises. This prevents placeholder notes in the other parts being judged as real pitches.');
    const beat=60/p.bpm;
    for(const type of roles){const notes=[],root=type==='drums'?36:integer(roots[type]??{keys:60,guitar:40,bass:28}[type],0,127,'Practice pitch');
      const add=(b,pitch,length=.12)=>{const time=p.firstBeat+b*beat,duration=Math.min(length*beat,p.duration-time);if(time<p.duration&&duration>=.02)notes.push({time,duration,pitch,velocity:100});};
      const count=Math.ceil((p.duration-p.firstBeat)/beat);
      for(let i=0;i<count;i++){
        if(type==='drums'){add(i,i%2?38:36);if(density!=='easy'){add(i,42);if(density==='full')add(i+.5,42);}}
        else if(density!=='easy'||i%2===0){add(i,root,type==='bass'?.8:.6);if(density==='full'&&type!=='bass')add(i+.5,root,.35);}
      }
      p.parts.find(x=>x.type===type).notes=notes;
    }
    p.origin='practice';p.version=1;delete p.matching;p.tempoMap=[];p.beats=[];return validate(p);
  }
  function fromAudioAnalysis(project,analysis,options={}){
    const p=validate(project),A=typeof module==='object'&&module.exports?require('./song-analysis.js'):globalThis.StageSongAnalysis;
    const bpm=options.bpm??analysis.bpm,firstBeat=options.firstBeat??analysis.firstBeat;
    const parts=A.eventsFor(analysis,{...options,bpm,firstBeat});
    return validate({...p,version:2,matching:'rhythm',origin:'audio-rhythm',bpm,firstBeat,parts,tempoMap:[],beats:[],audioOffset:0});
  }
  function revise(project,type,index,note){
    const p=clone(project),part=p.parts.find(p=>p.type===type);if(!part)throw Error('Choose an instrument.');
    if(index!==null&&(!Number.isInteger(index)||index<0||index>=part.notes.length))throw Error('Select an existing note.');
    if(index===null)part.notes.push(note);else if(note===null)part.notes.splice(index,1);else part.notes[index]=note;
    return validate(p);
  }
  function quantize(project,type,division){const p=clone(project),part=p.parts.find(p=>p.type===type);if(!part)throw Error('Choose an instrument.');part.notes=part.notes.map(n=>{const time=snap(n.time,p,division);return {...n,time,duration:Math.min(n.duration,p.duration-time)};});return validate(p);}
  function hash(project){const data=JSON.stringify(validate(project));let h=2166136261;for(let i=0;i<data.length;i++){h^=data.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function toSong(project){const p=validate(project);return {id:`workshop-${p.id}-${hash(p)}`,libraryId:p.id,chartProject:p,workshop:true,rhythmOnly:p.matching==='rhythm',name:p.title,subtitle:p.matching==='rhythm'?'Audio rhythm — any note / pad':p.origin==='practice'?'Beat practice — not a transcription':'Your authored arrangement',tag:p.matching==='rhythm'?'RHYTHM ONLY · NOT NOTE TRANSCRIPTION':p.origin==='practice'?'BEAT PRACTICE':'CUSTOM HIGHWAYS',original:false,bpm:p.bpm,duration:p.duration,backingOffset:p.audioOffset,audioName:p.audioName,tempoMap:p.tempoMap.length?p.tempoMap:[{time:0,bpm:p.bpm}],beats:grid(p),sections:[{time:0,name:p.origin==='practice'?'PRACTICE CHART':'YOUR ARRANGEMENT'}],parts:p.parts.map((part,i)=>({id:part.type,type:part.type,name:C.LABELS[part.type],channel:part.type==='drums'?10:i,notes:clone(part.notes)}))};}
  function counts(project){return Object.fromEntries(project.parts.map(p=>[p.type,p.notes.length]));}
  class History{
    constructor(project){this.current=validate(project);this.past=[];this.future=[];}
    set(project){const next=validate(project);if(JSON.stringify(next)===JSON.stringify(this.current))return;this.past.push(this.current);if(this.past.length>20)this.past.shift();this.current=next;this.future=[];}
    undo(){if(this.past.length){this.future.push(this.current);this.current=this.past.pop();}return this.current;}
    redo(){if(this.future.length){this.past.push(this.current);this.current=this.future.pop();}return this.current;}
  }
  /* A save resolves on transaction completion, not merely a request's success. */
  class Library{
    constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;this.db=null;}
    async open(){
      if(this.db)return this.db;if(!this.indexedDB)throw Error('Browser song storage is unavailable. Export the chart to keep it.');
      this.db=await new Promise((resolve,reject)=>{const request=this.indexedDB.open('midi-stage-songs',1);request.onupgradeneeded=()=>request.result.createObjectStore('songs',{keyPath:'id'});request.onerror=()=>reject(request.error||Error('Song library could not open.'));request.onblocked=()=>reject(Error('Close other MIDI Stage tabs and try saving again.'));request.onsuccess=()=>resolve(request.result);});
      this.db.onversionchange=()=>{this.db.close();this.db=null;};return this.db;
    }
    async transaction(mode,action){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('songs',mode);let value;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Song library write failed. Export a backup chart.'));const req=action(tx.objectStore('songs'));req.onsuccess=()=>{value=req.result;};});}
    async save(project,blob=null){const p=validate(project);if(blob!==null&&(!(blob instanceof Blob)||blob.size>80*1024*1024))throw Error('Backing audio must be a file smaller than 80 MB.');await this.transaction('readwrite',store=>store.put({id:p.id,project:p,blob,updated:Date.now()}));return p;}
    async list(){const rows=await this.transaction('readonly',s=>s.getAll());return rows.map(row=>{try{return {project:validate(row.project),hasAudio:!!row.blob,updated:row.updated};}catch(_){return null;}}).filter(Boolean).sort((a,b)=>b.updated-a.updated);}
    async get(key){const row=await this.transaction('readonly',s=>s.get(key));if(!row)return null;return {project:validate(row.project),blob:row.blob instanceof Blob?row.blob:null};}
    async remove(key){await this.transaction('readwrite',s=>s.delete(key));}
  }
  return {SCHEMA,VERSION,MAX_NOTES,MAX_SECONDS,MAX_JSON,empty,validate,parse,serialize,grid,snap,suggestRoutes,monophonic,thin,fromMIDI,fromSong,practice,fromAudioAnalysis,revise,quantize,toSong,counts,History,Library,clone};
});

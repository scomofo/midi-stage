const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
const X=require('../src/chords.js');
const W=require('../src/workshop.js');

test('common MIDI voicings get readable chord names',()=>{
  assert.equal(X.chordName([60,64,67]),'C');
  assert.equal(X.chordName([57,60,64]),'Am');
  assert.equal(X.chordName([62,65,69,72]),'Dm7');
});

test('simultaneous MIDI notes group into one chord target',()=>{
  const notes=[60,64,67].map(p=>({time:1,duration:.5,pitch:p,velocity:100}));
  const groups=X.groupNotes(notes);
  assert.equal(groups.length,1);assert.equal(groups[0].name,'C');
  assert.deepEqual(groups[0].pcs,[0,4,7]);
});

test('FFT chroma identifies a synthetic C-major triad',()=>{
  const rate=4096,n=2048,s=new Float64Array(n);
  for(let i=0;i<n;i++){const t=i/rate;s[i]=.5*Math.sin(2*Math.PI*261.6256*t)+.4*Math.sin(2*Math.PI*329.6276*t)+.35*Math.sin(2*Math.PI*391.995*t);}
  const found=X.classifyChroma(X.fftChroma(s,rate));
  assert.equal(found.name,'C');assert.ok(found.confidence>.2);
});
test('version-3 charts preserve chord-highway metadata',()=>{
  let p=W.empty({duration:8,bpm:120});
  p.parts.find(x=>x.type==='keys').notes=[60,64,67].map(pitch=>({time:1,duration:.5,pitch,velocity:100}));
  p=W.withChords(p,[{time:1,duration:.5,name:'C',pitches:[60,64,67],confidence:.8,source:'estimated'}],['keys']);
  const saved=W.parse(W.serialize(p));
  assert.equal(saved.version,3);assert.equal(saved.chordHighways.keys[0].name,'C');
});

const chordChart=()=>({lanes:C.PC.map((name,i)=>({name,pc:i,pitch:60+i,color:C.COLORS[i]})),notes:[{time:1,duration:.5,name:'C',pitches:[60,64,67],pcs:[0,4,7],lanes:[0,4,7],lane:0,chord:true}]});

test('exact MIDI chord scores only after every authored pitch arrives',()=>{
  const j=new X.ChordJudge(chordChart(),{mode:'exact'});
  j.hit(1,{lane:0,pitch:60});j.hit(1.01,{lane:4,pitch:64});assert.equal(j.stats.perfect,0);
  j.hit(1.02,{lane:7,pitch:67});assert.equal(j.stats.perfect,1);assert.equal(j.stats.combo,1);
});

test('arcade chord mode accepts the same pitch classes in other octaves',()=>{
  const j=new X.ChordJudge(chordChart(),{mode:'pitch'});
  j.hit(1,{lane:0,pitch:72});j.hit(1.01,{lane:4,pitch:76});j.hit(1.02,{lane:7,pitch:79});
  assert.equal(j.stats.perfect,1);
});
test('partial chord becomes one miss, not several tone misses',()=>{
  const j=new X.ChordJudge(chordChart(),{mode:'exact'});
  j.hit(1,{lane:0,pitch:60});j.tick(1.3);
  assert.equal(j.stats.miss,1);assert.equal(j.stats.perfect,0);
});

test('live-guitar chord mode judges one strum by timing only',()=>{
  const chart={lanes:[{name:'CHORD STRUM',short:'STRUM',pitch:40,pc:0,any:true,color:C.COLORS[2]}],notes:[{time:1,duration:.5,name:'C',pitches:[60,64,67],pcs:[0,4,7],lanes:[0],lane:0,chord:true}]};
  const j=new X.ChordJudge(chart,{timingOnly:true,mode:'exact'});
  j.hit(1.01,{lane:0,pitch:41});
  assert.equal(j.stats.perfect,1);assert.equal(j.stats.extra,0);
});

test('I-V-vi-IV helper emits the expected chords in C major',()=>{
  assert.deepEqual(X.progressionForKey(0).map(x=>`${x.roman} ${x.name}`),['I C','V G','vi Am','IV F']);
});

test('I-V-vi-IV fitting finds key and phase from synthetic chord chroma',()=>{
  const tone=(root,ints)=>{const a=Array(12).fill(.01);for(const i of ints)a[(root+i)%12]=1;return a;};
  const p=X.progressionForKey(0),seq=[];for(let r=0;r<3;r++)for(const chord of p)seq.push(tone(chord.root,chord.ints));
  const fit=X.fitPopProgression(seq);
  assert.equal(fit.key,0);assert.equal(fit.phase,0);assert.equal(fit.span,1);assert.ok(fit.confidence>.8);
});

test('forced I-V-vi-IV key restricts progression fitting',()=>{
  const tone=(root,ints)=>{const a=Array(12).fill(.01);for(const i of ints)a[(root+i)%12]=1;return a;};
  const p=X.progressionForKey(7),seq=[];for(let r=0;r<2;r++)for(const chord of p)seq.push(tone(chord.root,chord.ints));
  const fit=X.fitPopProgression(seq,7);assert.equal(fit.key,7);
});

test('chord grade reflects the least accurate chord tone arrival',()=>{
  const j=new X.ChordJudge(chordChart(),{mode:'pitch'});
  j.hit(.93,{lane:0,pitch:60});j.hit(1.01,{lane:4,pitch:64});j.hit(1.02,{lane:7,pitch:67});
  assert.equal(j.stats.perfect,0);assert.equal(j.stats.great,1);
});

test('PCM I-V-vi-IV progression resolves to C major and Roman labels',async()=>{
  const sr=8000,duration=8,n=sr*duration,data=new Float32Array(n);
  const seq=[[261.6256,329.6276,391.9954],[391.9954,493.8833,587.3295],[440,523.2511,659.2551],[349.2282,440,523.2511]];
  for(let i=0;i<n;i++){const t=i/sr,beat=Math.floor(t/.5),local=t%0.5,env=Math.min(1,local/.02)*Math.min(1,(.5-local)/.05);data[i]=env*.18*seq[beat%4].reduce((s,f)=>s+Math.sin(2*Math.PI*f*t),0);}
  const buffer={duration,sampleRate:sr,numberOfChannels:1,length:n,getChannelData:()=>data};
  const out=await X.analyzeBuffer(buffer,{bpm:120,firstBeat:0});
  assert.deepEqual(out.slice(0,4).map(x=>`${x.roman} ${x.name}`),['I C','V G','vi Am','IV F']);
  assert.ok(out.slice(0,4).every(x=>x.key==='C'&&x.confidence>.7));
});

test('monophonic pulse track does not invent a chord progression',async()=>{
  const sr=16000,duration=12,n=sr*duration,data=new Float32Array(n);
  for(let beat=.35;beat<duration;beat+=.5)for(let i=Math.floor(beat*sr);i<Math.min(n,Math.floor((beat+.12)*sr));i++){const t=i/sr-beat;data[i]=Math.sin(2*Math.PI*110*t)*Math.exp(-50*t);}
  const buffer={duration,sampleRate:sr,numberOfChannels:1,length:n,getChannelData:()=>data};
  const out=await X.analyzeBuffer(buffer,{bpm:120,firstBeat:.35});
  assert.equal(out.length,0);
});

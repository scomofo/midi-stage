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

const chordChart=()=>({lanes:C.PC.map((name,i)=>({name,pc:i,pitch:60+i,color:C.COLORS[i]})),notes:[{id:0,time:1,duration:.5,name:'C',pitches:[60,64,67],pcs:[0,4,7],lanes:[0,4,7],lane:0,chord:true,source:'midi'}]});
const press=(j,pitch,time=1,token=String(pitch),lane=C.pc(pitch))=>j.hit(time,{lane,pitch,token});

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

test('exact MIDI chords reject the right pitch classes in the wrong register',()=>{
  const j=new X.ChordJudge(chordChart(),{mode:'exact'});
  [72,76,79].forEach(p=>press(j,p));j.tick(1.3);
  assert.equal(j.stats.perfect,0);assert.equal(j.stats.extra,3);assert.equal(j.stats.miss,1);
  const estimated=chordChart();estimated.notes[0].source='estimated';
  const flexible=new X.ChordJudge(estimated,{mode:'exact'});
  [72,76,79].forEach(p=>press(flexible,p));assert.equal(flexible.stats.perfect,1);
});

test('three non-overlapping taps cannot earn a chord hit',()=>{
  const j=new X.ChordJudge(chordChart());
  for(const [t,p]of [[.97,60],[1,64],[1.03,67]]){press(j,p,t);j.release(String(p),t+.001);}
  j.tick(1.3);assert.equal(j.stats.perfect,0);assert.equal(j.stats.miss,1);
});

test('initial chord tones must start inside the timing window and a bounded roll',()=>{
  const early=new X.ChordJudge(chordChart());press(early,60,.7);press(early,64,1);press(early,67,1.02);
  early.tick(1.3);assert.equal(early.stats.perfect,0);assert.equal(early.stats.miss,1);
  const wide=new X.ChordJudge(chordChart());press(wide,60,.88);press(wide,64,1);press(wide,67,1.12);
  wide.tick(1.3);assert.equal(wide.stats.good,0);assert.equal(wide.stats.miss,1);
  const rolled=new X.ChordJudge(chordChart());press(rolled,60,.96);press(rolled,64,1);press(rolled,67,1.04);
  assert.equal(rolled.stats.perfect,1);
});

test('arcade octave doubling is fair in every MIDI message order',()=>{
  const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,k)=>k!==i)).map(rest=>[v,...rest])):[[]];
  for(const notes of permutations([60,64,67,72])){
    const j=new X.ChordJudge(chordChart());notes.forEach(p=>press(j,p));
    assert.equal(j.stats.perfect,1,notes.join(','));assert.equal(j.stats.extra,0);assert.equal(j.stats.combo,1);assert.equal(j.accuracy,100);
  }
});

test('early chord release breaks its hold and held chord earns one completion bonus',()=>{
  const early=new X.ChordJudge(chordChart());[60,64,67].forEach(p=>press(early,p));early.release('64',1.02);early.tick(2);
  assert.equal(early.stats.holdBreaks,1);assert.equal(early.stats.combo,0);assert.equal(early.stats.score,140);assert.equal(early.stats.holds,0);
  // App defers MIDI note-offs while CC64 is down: no release reaches the judge.
  const sustained=new X.ChordJudge(chordChart());[60,64,67].forEach(p=>press(sustained,p));sustained.tick(1.5);
  [60,64,67].forEach(p=>sustained.release(String(p),1.6));sustained.tick(2);
  assert.equal(sustained.stats.holds,1);assert.equal(sustained.stats.holdBreaks,0);assert.equal(sustained.stats.score,190);
});

test('an octave replacement can keep an arcade chord sounding through its tail',()=>{
  const j=new X.ChordJudge(chordChart());[60,64,67,72].forEach(p=>press(j,p));j.release('60',1.1);j.tick(1.5);
  assert.equal(j.stats.extra,0);assert.equal(j.stats.holdBreaks,0);assert.equal(j.stats.holds,1);
});

test('held common tones carry across changes and repeated chords require fresh attack',()=>{
  const chart=chordChart();chart.notes[0].duration=.9;
  chart.notes.push({...chart.notes[0],id:1,time:2,name:'Am',pitches:[60,64,69],pcs:[0,4,9],lanes:[0,4,9]});
  chart.notes.push({...chart.notes[1],id:2,time:3});
  const j=new X.ChordJudge(chart);[60,64,67].forEach(p=>press(j,p));j.tick(1.9);j.release('67',1.9);press(j,69,2);
  assert.equal(j.stats.perfect,2);j.tick(3.15);assert.equal(j.stats.perfect,2);assert.equal(j.stats.miss,1);
  const repeated=new X.ChordJudge(chart);[60,64,67].forEach(p=>press(repeated,p));repeated.tick(1.9);repeated.release('67',1.9);press(repeated,69,2);
  repeated.tick(2.9);repeated.release('69',2.98);press(repeated,69,3);
  assert.equal(repeated.stats.perfect,3);assert.equal(repeated.stats.extra,0);
});

test('learned lanes assist arcade matching without changing exact MIDI pitch',()=>{
  const j=new X.ChordJudge(chordChart());press(j,61,1,'mapped-c',0);press(j,65,1,'mapped-e',4);press(j,68,1,'mapped-g',7);
  assert.equal(j.stats.perfect,1);
  const exact=new X.ChordJudge(chordChart(),{mode:'exact'});press(exact,61,1,'mapped-c',0);press(exact,65,1,'mapped-e',4);press(exact,68,1,'mapped-g',7);
  assert.equal(exact.stats.perfect,0);assert.equal(exact.stats.extra,3);
});

test('pause cancels sounding state and unfinished holds without rewarding their tails',()=>{
  const chart=chordChart();chart.notes.push({...chart.notes[0],id:1,time:2});const j=new X.ChordJudge(chart);
  [60,64,67].forEach(p=>press(j,p));assert.equal(j.cancelHolds(),1);j.tick(1.8);press(j,60,2);
  assert.equal(j.stats.perfect,1);assert.equal(j.stats.holds,0);assert.equal(j.stats.holdBreaks,0);assert.equal(j.notes[0].hold,'paused');
  assert.deepEqual(j.guidance().missing,[4,7]);
});

test('mixed MIDI arrangements preserve riffs, unsupported chords and rolled attacks',()=>{
  const notes=[{time:0,duration:.1,pitch:60,velocity:100},...[60,64,67].map(pitch=>({time:1,duration:.5,pitch,velocity:100})),
    {time:2,duration:.1,pitch:62,velocity:100},...[60,62,64,67].map(pitch=>({time:3,duration:.5,pitch,velocity:100})),
    ...[60,64,67].map((pitch,i)=>({time:4+i*.03,duration:.2,pitch,velocity:100}))];
  const source={name:'mixed arrangement',bpm:120,duration:5,parts:[{id:'piano',notes}],tempoMap:[{time:0,bpm:120}],beats:[]};
  const project=W.fromMIDI(source,{piano:'keys'}).project,song=W.toSong(project),player=C.defaults()[1];
  const chart=X.makeChart(song,player);assert.equal(chart.notes.filter(n=>n.chord).length,1);assert.equal(chart.notes.filter(n=>!n.chord).length,9);
  const j=new X.ChordJudge(chart,{mode:'exact'});
  for(const n of chart.notes){if(n.chord){n.pitches.forEach(p=>press(j,p,n.time));n.pitches.forEach(p=>j.release(String(p),n.time+n.duration));}else{press(j,n.pitch,n.time);j.release(String(n.pitch),n.time+n.duration);}}
  assert.equal(j.finish(5).perfect,10);assert.equal(j.stats.extra,0);assert.equal(j.stats.miss,0);
  const clipped=X.makeChart(song,player,.5,1.25);assert.equal(clipped.notes.length,1);assert.equal(clipped.notes[0].duration,.25);
});

test('chord sustain respects individual authored tone endings',()=>{
  const project=W.empty({duration:3});project.parts.find(p=>p.type==='keys').notes=[60,64,67].map((pitch,i)=>({time:1,duration:i===0?.4:1,pitch,velocity:100}));
  const song=W.toSong(W.withChords(project,X.groupNotes(project.parts.find(p=>p.type==='keys').notes),['keys']));
  const j=new X.ChordJudge(X.makeChart(song,C.defaults()[1]));[60,64,67].forEach(p=>press(j,p));j.release('60',1.4);j.tick(2);
  assert.equal(j.stats.holdBreaks,0);assert.equal(j.stats.holds,1);
});

test('estimated chord highways do not also score rhythm placeholder notes',()=>{
  let project=W.empty({duration:3});project.version=2;project.matching='rhythm';project.parts.find(p=>p.type==='keys').notes=[{time:1,duration:.1,pitch:60,velocity:100},{time:1.5,duration:.1,pitch:60,velocity:100}];
  project=W.withChords(project,[{time:1,duration:1,name:'C',pitches:[60,64,67],source:'estimated'}],['keys']);
  const chart=X.makeChart(W.toSong(project),C.defaults()[1]);assert.equal(chart.notes.length,1);assert.equal(chart.notes[0].chord,true);
});

test('mixed live guitar uses timing for chords and verified exact pitch for singles',()=>{
  const chart=chordChart();chart.lanes=[{name:'STRUM',pc:0,any:true}];chart.notes[0].lanes=[0];chart.notes.push({id:1,time:2,duration:.5,pitch:64,lane:0,chord:false});
  const j=new X.ChordJudge(chart,{timingOnly:true,mode:'exact',verifiedHolds:true});press(j,40,1,'strum',0);
  assert.equal(j.stats.perfect,1);assert.equal(j.activeHolds.size,0);press(j,65,2,'wrong',0);assert.equal(j.stats.extra,1);press(j,64,2,'right',0);j.tick(2.5);
  assert.equal(j.stats.holds,0);j.confirm('right',2.5);assert.equal(j.stats.holds,1);assert.equal(j.stats.perfect,2);
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

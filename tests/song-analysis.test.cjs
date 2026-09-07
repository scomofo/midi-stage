const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/song-analysis.js');
const W = require('../src/workshop.js');
const C = require('../src/core.js');
function pulse({bpm=120,sr=16000,duration=20,start=.35,stop=duration}={}) {
  const data=new Float32Array(Math.ceil(duration*sr));
  for(let t=start;t<stop;t+=60/bpm)for(let j=0;j<.12*sr&&Math.round(t*sr)+j<data.length;j++)data[Math.round(t*sr)+j]=.6*Math.sin(2*Math.PI*110*j/sr)*Math.exp(-j/sr*35);
  return data;
}
const analyze=(x,sr=16000)=>A.analyzeEnvelope(A.envelopeFromChannels([x],sr));
for(const bpm of [60,90,96,120,137,180,215])test(`estimates ${bpm} BPM synthetic pulse with intro silence`,()=>{
  const r=analyze(pulse({bpm}));assert.ok(Math.abs(r.bpm-bpm)<.4);assert.ok(Math.abs(r.firstBeat-.35)<.025);assert.equal(r.confidence,'high');assert.ok(r.onsets[0].time>=.34);
});
for(const sr of [44100,48000,96000])test(`pulse extraction at ${sr} Hz`,()=>{assert.ok(Math.abs(analyze(pulse({sr}),sr).bpm-120)<.4);});
test('inverted stereo does not cancel rhythmic energy',()=>{const x=pulse(),y=x.map(v=>-v);const r=A.analyzeEnvelope(A.envelopeFromChannels([x,y],16000));assert.equal(r.bpm,120);});
test('silence yields no invented tempo or notes',()=>{const r=analyze(new Float32Array(80000));assert.equal(r.bpm,null);assert.equal(r.onsets.length,0);assert.throws(()=>A.eventsFor(r,{bpm:120}),/No usable/);});
test('continuous tone has no reliable rhythmic pulse',()=>{const x=new Float32Array(160000).map((_,i)=>.4*Math.sin(2*Math.PI*110*i/16000));const r=analyze(x);assert.equal(r.bpm,null);});
test('deterministic noise is not claimed as a strong pulse',()=>{let seed=73;const x=new Float32Array(160000).map(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*.6;});assert.notEqual(analyze(x).confidence,'high');});
test('short clips request a tempo instead of guessing',()=>{assert.equal(analyze(pulse({duration:2})).bpm,null);});
test('invalid PCM sample fails closed',()=>{const x=pulse();x[10]=NaN;assert.throws(()=>analyze(x),/invalid samples/);});
test('unmatched stereo channel lengths are rejected',()=>{assert.throws(()=>A.envelopeFromChannels([new Float32Array(10),new Float32Array(20)],16000));});
test('out-of-range sample rates are rejected',()=>{assert.throws(()=>A.envelopeFromChannels([pulse()],1));});
test('oversize audio rejected before analysis',()=>{assert.throws(()=>A.envelopeBuilder([new Float32Array(8000*601)],8000),/ten minutes/);});
test('incomplete envelope cannot be consumed',()=>{assert.throws(()=>A.envelopeBuilder([pulse()],16000).result(),/incomplete/);});
test('malformed envelope frame lengths are rejected',()=>{const e=A.envelopeFromChannels([pulse()],16000);e.low=new Float32Array(1);assert.throws(()=>A.analyzeEnvelope(e),/Invalid/);});
const reference=analyze(pulse({stop:12}));
test('generated attacks avoid silent intro and outro',()=>{const parts=A.eventsFor(reference,{roles:C.TYPES});for(const p of parts)for(const n of p.notes)assert.ok(n.time>=.34&&n.time<12);});
test('difficulty reduces density without adding invented attacks',()=>{const easy=A.eventsFor(reference,{density:'easy'})[0].notes,full=A.eventsFor(reference,{density:'full'})[0].notes;assert.ok(easy.length<full.length);assert.ok(full.every(n=>reference.onsets.some(o=>Math.abs(o.time-n.time)<1e-5)));});
test('unselected instruments remain empty',()=>{assert.deepEqual(A.eventsFor(reference,{roles:['bass']}).map(p=>!!p.notes.length),[false,false,false,true]);});
test('full band contains bounded single-note markers',()=>{for(const p of A.eventsFor(reference,{roles:C.TYPES,density:'full'})){assert.ok(p.notes.length);p.notes.forEach((n,i)=>{assert.ok(n.duration>=.02&&n.duration<=.07);if(i)assert.ok(n.time>=p.notes[i-1].time+p.notes[i-1].duration);});}});
test('no-role and invalid tempo errors are recoverable',()=>{assert.throws(()=>A.eventsFor(reference,{roles:[]}));assert.throws(()=>A.eventsFor(reference,{bpm:0}));assert.throws(()=>A.eventsFor(reference,{firstBeat:999}));});
test('tap-grid fallback only fills active audio regions',()=>{const parts=A.eventsFor(reference,{bpm:120,firstBeat:.35,useGrid:true});assert.ok(parts[0].notes.length);assert.ok(parts[0].notes.every(n=>n.time<12));});
const base=W.empty({duration:reference.duration});
const project=W.fromAudioAnalysis(base,reference,{roles:C.TYPES});
test('audio-rhythm charts use an explicitly versioned portable format',()=>{assert.equal(project.version,2);assert.equal(project.matching,'rhythm');assert.deepEqual(W.parse(W.serialize(project)),project);assert.equal(W.toSong(project).rhythmOnly,true);});
test('ordinary MIDI/manual chart exports stay backward compatible',()=>{assert.equal(W.validate(base).version,1);assert.equal(W.toSong(base).rhythmOnly,false);});
test('version 2 cannot silently become a pitch chart',()=>{assert.throws(()=>W.validate({...base,version:2}),/Rhythm/);assert.throws(()=>W.validate({...base,matching:'rhythm'}),/Rhythm/);});
test('rebuilding a normal exercise explicitly exits rhythm mode',()=>{const p=W.practice(project,{roles:C.TYPES});assert.equal(p.version,1);assert.equal(p.matching,undefined);});
test('all four roles accept any MIDI pitch as a rhythm marker',()=>{const song=W.toSong(project);for(const p of C.defaults()){const chart=C.makeChart(song,p),judge=new C.Judge(chart,{mode:'rhythm',drums:p.type==='drums'});assert.equal(chart.lanes.length,1);const lane=C.laneForPitch(77,p,chart.lanes);assert.equal(lane,0);judge.hit(chart.notes[0].time,{lane,pitch:77,token:'one'});assert.equal(judge.stats.perfect,1);}});
test('rhythm lane ignores saved pad mappings but invalid pitches fail',()=>{const p={...C.defaults()[0],learned:{77:5}},lanes=C.lanesFor(W.toSong(project),p);assert.equal(C.laneForPitch(77,p,lanes),0);assert.equal(C.laneForPitch(-1,p,lanes),-1);});
test('normal charts still enforce exact pitch and octave',()=>{const chart={lanes:[{pc:0}],notes:[{time:1,pitch:60,lane:0,duration:.07}]};const j=new C.Judge(chart,{mode:'exact'});j.hit(1,{lane:0,pitch:72});assert.equal(j.stats.perfect,0);});
test('rhythm markers still require separate timed attacks',()=>{const p=C.defaults()[1],chart=C.makeChart(W.toSong(project),p),j=new C.Judge(chart,{mode:'rhythm'});j.hit(chart.notes[0].time,{lane:0,pitch:77});j.tick(reference.duration);assert.equal(j.stats.perfect,1);assert.equal(j.stats.miss,chart.notes.length-1);});
test('bounded ten-minute workload remains within chart limits',()=>{const r=analyze(pulse({duration:600,bpm:120}));const p=W.fromAudioAnalysis(W.empty({duration:600}),r,{roles:C.TYPES,density:'full'});assert.ok(p.parts.reduce((s,x)=>s+x.notes.length,0)<W.MAX_NOTES);});

test('partial practice conversion cannot turn unmodified rhythm placeholders into pitch targets',()=>{assert.throws(()=>W.practice(project,{roles:['drums']}),/every populated instrument/);});
test('song to editable project keeps explicit rhythm semantics',()=>{assert.deepEqual(W.fromSong(W.toSong(project)),project);});
test('unknown matching metadata fails closed',()=>{assert.throws(()=>W.validate({...base,matching:'future-mode'}),/Unsupported/);});

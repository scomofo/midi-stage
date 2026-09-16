'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const W=require('../src/workshop.js'),C=require('../src/core.js'),S=require('../src/strings.js'),F=require('./midi-fixtures.cjs');
const notes=p=>p.parts.reduce((n,p)=>n+p.notes.length,0);
const note=(time=0,pitch=60,duration=.2)=>({time,pitch,duration,velocity:100});
test('blank charts contain four empty instrument parts',()=>{const p=W.empty();assert.equal(p.parts.length,4);assert.equal(notes(p),0);});
test('chart serialization roundtrips notes and metadata',()=>{const p=W.revise(W.empty({title:'My song'}),'keys',null,note());assert.deepEqual(W.parse(W.serialize(p)),p);});
test('JSON rejects foreign schemas',()=>assert.throws(()=>W.parse('{"version":1}'),/Song Workshop/));
test('JSON rejects invalid text',()=>assert.throws(()=>W.parse('{'),/valid JSON/));
test('JSON rejects unsupported schema versions',()=>{const p=W.empty();p.version=99;assert.throws(()=>W.validate(p),/version 1/);});
test('JSON input is size limited',()=>assert.throws(()=>W.parse(' '.repeat(W.MAX_JSON+1)),/12 MB/));
test('untrusted extras are not retained',()=>{const p=W.empty();p.audioUrl='https://example.invalid/';p.parts[0].script='x';const clean=W.validate(p);assert.equal(clean.audioUrl,undefined);assert.equal(clean.parts[0].script,undefined);});
test('unsafe ID rejected before interpolation',()=>{const p=W.empty();p.id='chart-"><img>';assert.throws(()=>W.validate(p),/ID/);});
test('metadata lengths are bounded but not interpreted',()=>{const p=W.empty({title:'<img onerror=x>'+'x'.repeat(500)});assert.equal(p.title.length,160);});
for(const bad of [NaN,Infinity,-1,128,60.5])test(`invalid note pitch ${bad} rejected`,()=>assert.throws(()=>W.revise(W.empty(),'keys',null,note(0,bad))));
test('negative notes rejected',()=>assert.throws(()=>W.revise(W.empty(),'keys',null,note(-1)),/Note time/));
test('notes beyond song end rejected, not silently moved',()=>assert.throws(()=>W.revise(W.empty(),'keys',null,note(59.9,60,.5)),/beyond/));
test('unsupported drum pitches rejected',()=>assert.throws(()=>W.revise(W.empty(),'drums',null,note(0,60)),/drum|Drum/));
test('drum aliases preserved',()=>{assert.equal(W.revise(W.empty(),'drums',null,note(0,46)).parts[0].notes[0].pitch,46);});
test('missing and duplicate instrument parts rejected',()=>{const p=W.empty();p.parts[3]=p.parts[0];assert.throws(()=>W.validate(p),/bass/);});
test('duplicate time/pitch is deduplicated',()=>{let p=W.revise(W.empty(),'keys',null,note());p=W.revise(p,'keys',null,note());assert.equal(notes(p),1);});
test('notes are sorted after edits',()=>{let p=W.revise(W.empty(),'keys',null,note(2));p=W.revise(p,'keys',null,note(1));assert.deepEqual(p.parts[1].notes.map(n=>n.time),[1,2]);});
test('an invalid edit does not mutate the original',()=>{const p=W.empty();assert.throws(()=>W.revise(p,'keys',null,note(-1)));assert.equal(notes(p),0);});
test('delete updates only selected part',()=>{let p=W.revise(W.empty(),'keys',null,note());p=W.revise(p,'bass',null,note(0,28));p=W.revise(p,'keys',0,null);assert.equal(p.parts[1].notes.length,0);assert.equal(p.parts[3].notes.length,1);});
test('constant grid supports a first beat offset',()=>{const p={...W.empty({duration:4,bpm:120}),firstBeat:.25};assert.equal(W.grid(p)[0].time,.25);assert.equal(W.grid(p)[4].time,2.25);});
test('snap supports half beats and off-grid editing',()=>{const p=W.empty();assert.equal(W.snap(.37,p,2),.25);assert.equal(W.snap(.37,p,0),.37);});
test('snap follows an imported changing-tempo beat map',()=>{const p={...W.empty(),beats:[{time:0},{time:.5},{time:1},{time:2}],tempoMap:[{time:0,bpm:120},{time:1,bpm:60}]};assert.equal(W.snap(1.6,p,2),1.5);});
test('unsorted beat/tempo maps are rejected',()=>{const p=W.empty();assert.throws(()=>W.validate({...p,beats:[{time:1},{time:0}]}),/sorted/);assert.throws(()=>W.validate({...p,tempoMap:[{time:1,bpm:60},{time:0,bpm:120}]}),/sorted/);});
test('MIDI track suggestions identify guitar bass and drums',()=>{const song=C.parseMIDI(F.exportSong(C.makeValidationSong()),'rehearsal.mid'),r=W.suggestRoutes(song);assert.deepEqual(Object.values(r),['drums','keys','guitar','bass']);});
test('MIDI supplies exact note times, pitches and tails',()=>{const song=C.parseMIDI(F.exportSong(C.makeValidationSong()),'test.mid');const p=W.fromMIDI(song,W.suggestRoutes(song)).project;assert.deepEqual(p.parts[2].notes,song.parts[2].notes);});
test('track assignment can skip or merge parts',()=>{const song=C.makeValidationSong();const {project}=W.fromMIDI(song,{drums:'skip',keys:'keys',guitar:'keys',bass:'bass'});assert.equal(project.parts[0].notes.length,0);assert.equal(project.parts[1].notes.length,song.parts[1].notes.length+song.parts[2].notes.length);});
test('unsupported drum mappings generate an explicit warning',()=>{const {project,warnings}=W.fromMIDI(C.makeValidationSong(),{keys:'drums'});assert.equal(notes(project),0);assert.ok(warnings[0].includes('skipped'));});
test('full density preserves chord voicings',()=>{const ns=[note(0,60),note(0,64),note(.1,67)];assert.equal(W.thin(ns).length,3);assert.equal(W.thin(ns,'easy').length,2);});
test('single-note reduction keeps upper guitar and lower bass voices',()=>{const ns=[note(0,40,.8),note(0,47,.8),note(.5,43,.3)];assert.equal(W.monophonic(ns)[0].pitch,47);assert.equal(W.monophonic(ns,true)[0].pitch,40);assert.equal(W.monophonic(ns)[0].duration,.5);});
test('single-note MIDI conversion produces playable live-string charts',()=>{const song=C.makeValidationSong();song.parts[2].notes.push(note(0,52,1));const {project}=W.fromMIDI(song,W.suggestRoutes(song),{singleStrings:true});assert.equal(S.chartError(project.parts[2].notes,'guitar'),null);});
test('audio practice generator is explicitly marked practice',()=>{const p=W.practice(W.empty({duration:8}));assert.equal(p.origin,'practice');assert.equal(W.toSong(p).tag,'BEAT PRACTICE');});
test('generator creates four independent, live-playable parts',()=>{const p=W.practice(W.empty({duration:8}),{roles:C.TYPES});assert.ok(p.parts.every(p=>p.notes.length>0));for(const p2 of p.parts.slice(2))assert.equal(S.chartError(p2.notes,p2.type),null);});
test('generator clips notes at end and honors first beat',()=>{const p=W.practice({...W.empty({duration:2.1}),firstBeat:.2},{roles:C.TYPES,density:'full'});assert.ok(p.parts.every(p=>p.notes.every(n=>n.time>=.2&&n.time+n.duration<=2.10001)));});
test('generator preserves unselected instrument notes',()=>{const old=W.revise(W.empty(),'keys',null,note(3,64));assert.deepEqual(W.practice(old).parts[1].notes,old.parts[1].notes);});
test('empty and invalid generation selections rejected',()=>{assert.throws(()=>W.practice(W.empty(),{roles:[]}),/instrument/);assert.throws(()=>W.practice(W.empty(),{density:'impossible'}),/density/);});
test('practice density changes note count',()=>{const p=W.empty({duration:8});assert.ok(notes(W.practice(p,{density:'full'}))>notes(W.practice(p,{density:'easy'})));});
test('snap part preserves other parts and bounds',()=>{let p=W.revise(W.empty(),'keys',null,note(.31));p=W.quantize(p,'keys',2);assert.equal(p.parts[1].notes[0].time,.25);assert.equal(p.parts[0].notes.length,0);});
test('undo and redo restore exact chart data',()=>{const h=new W.History(W.empty()),original=W.clone(h.current);h.set(W.revise(h.current,'keys',null,note()));h.undo();assert.deepEqual(h.current,original);h.redo();assert.equal(notes(h.current),1);});
test('editing after undo clears redo stack',()=>{const h=new W.History(W.empty());h.set(W.revise(h.current,'keys',null,note()));h.undo();h.set(W.revise(h.current,'bass',null,note(0,28)));assert.equal(h.future.length,0);});
test('undo memory is bounded to 20 states',()=>{const h=new W.History(W.empty());for(let i=0;i<25;i++)h.set({...h.current,title:'Edit '+i});assert.equal(h.past.length,20);});
test('chart revision changes high-score identity',()=>{const p=W.empty();assert.notEqual(W.toSong(p).id,W.toSong({...p,title:'New title'}).id);assert.equal(W.toSong(p).id,W.toSong(p).id);});
test('song conversion routes each part into actual gameplay highways',()=>{const p=W.practice(W.empty({duration:8}),{roles:C.TYPES}),song=W.toSong(p);for(const player of C.defaults()){const chart=C.makeChart(song,player);assert.equal(chart.notes.length,p.parts.find(q=>q.type===player.type).notes.length);}});
test('library reports missing browser storage rather than claiming success',async()=>{const library=new W.Library(null);await assert.rejects(library.save(W.empty()),/storage is unavailable/);});

function chordProject(time=1){
  const song=C.makeValidationSong();song.parts.find(p=>p.type==='keys').notes=[... [60,64,67].map(p=>note(time,p,.6)),note(3,62,.2)];
  return W.fromMIDI(song,{keys:'keys'}).project;
}
test('editing a chord tone updates the playable chord while preserving mixed source notes',()=>{
  const original=chordProject(),minor=W.revise(original,'keys',1,note(1,63,.6));
  assert.equal(minor.chordHighways.keys[0].name,'Cm');assert.deepEqual(minor.chordHighways.keys[0].pitches,[60,63,67]);
  assert.equal(minor.parts[1].notes.length,4);assert.equal(minor.parts[1].notes.at(-1).pitch,62);
  assert.equal(original.chordHighways.keys[0].name,'C');assert.equal(original.parts[1].notes[1].pitch,64);
  const restored=W.parse(W.serialize(minor));assert.deepEqual(restored,minor);assert.equal(W.toSong(restored).chordHighways.keys[0].name,'Cm');
});
test('deleting source notes removes obsolete chord targets without deleting remaining notes',()=>{
  let p=W.revise(chordProject(),'keys',1,null);assert.equal(p.chordHighways.keys[0].name,'C5');
  p=W.revise(p,'keys',1,null);assert.equal(p.chordHighways,undefined);assert.deepEqual(p.parts[1].notes.map(n=>n.pitch),[60,62]);
});
test('adding notes recreates a chord after its previous target disappeared',()=>{
  let p=W.revise(chordProject(),'keys',1,null);p=W.revise(p,'keys',1,null);
  p=W.revise(p,'keys',null,note(1,63,.6));p=W.revise(p,'keys',null,note(1,67,.6));
  assert.equal(p.chordHighways.keys[0].name,'Cm');
});
test('quantization moves the source voicing and derived chord together',()=>{
  const p=W.quantize(chordProject(.31),'keys',2);assert.equal(p.chordHighways.keys[0].time,.3125);
  assert.ok(p.parts[1].notes.slice(0,3).every(n=>n.time===.3125));assert.deepEqual(W.parse(W.serialize(p)),p);
});
test('editing and quantizing rhythm markers preserves independently estimated harmony',()=>{
  const base=chordProject(.31),estimated={...base.chordHighways.keys[0],source:'estimated',roman:'I',key:'C',confidence:.4};
  const p=W.withChords({...base,version:3,matching:'rhythm'},[estimated],['keys']);
  const edited=W.quantize(W.revise(p,'keys',1,note(.31,63,.6)),'keys',2);
  assert.deepEqual(edited.chordHighways.keys,p.chordHighways.keys);
});
test('practice regeneration replaces selected chord targets and preserves other roles',()=>{
  let p=chordProject();p=W.withChords(p,p.chordHighways.keys,['guitar']);
  const regenerated=W.practice(p,{roles:['keys'],density:'easy'});
  assert.equal(regenerated.chordHighways.keys.length,0);assert.deepEqual(regenerated.chordHighways.guitar,p.chordHighways.guitar);
  assert.ok(regenerated.parts[1].notes.every(n=>n.pitch===60));assert.deepEqual(W.parse(W.serialize(regenerated)),regenerated);
});
test('MIDI density rebuild derives targets only from retained notes',()=>{
  const song=C.makeValidationSong();song.parts[1].notes=[...[60,64,67].map(p=>note(1,p)),...[62,65,69].map(p=>note(1.1,p)),note(3,62)];
  const p=W.fromMIDI(song,{keys:'keys'},{density:'easy'}).project;
  assert.deepEqual(p.chordHighways.keys.map(c=>c.name),['C']);assert.equal(p.parts[1].notes.length,4);
});
test('explicit MIDI chord edits rewrite source notes and preserve separate single notes',()=>{
  const p=chordProject(),updated=W.reviseChord(p,'keys',0,{time:1.5,duration:.5,pitches:[60,63,67]});
  assert.equal(updated.chordHighways.keys[0].name,'Cm');assert.equal(updated.chordHighways.keys[0].time,1.5);
  assert.deepEqual(updated.parts[1].notes.slice(0,3).map(n=>[n.time,n.pitch,n.duration]),[[1.5,60,.5],[1.5,63,.5],[1.5,67,.5]]);
  assert.deepEqual(updated.parts[1].notes.at(-1),p.parts[1].notes.at(-1));assert.deepEqual(W.parse(W.serialize(updated)),updated);
  const removed=W.reviseChord(updated,'keys',0,null);assert.equal(removed.chordHighways,undefined);assert.deepEqual(removed.parts[1].notes,[p.parts[1].notes.at(-1)]);
});
test('explicit estimated-chord corrections become manual without modifying source markers',()=>{
  const base=chordProject(),p=W.withChords(base,[{...base.chordHighways.keys[0],source:'estimated',roman:'I',key:'C',confidence:.3}],['keys']);
  const fixed=W.reviseChord(p,'keys',0,{time:1,duration:.6,pitches:[60,63,67]});
  assert.equal(fixed.chordHighways.keys[0].name,'Cm');assert.equal(fixed.chordHighways.keys[0].source,'manual');assert.equal(fixed.chordHighways.keys[0].confidence,1);
  assert.equal(fixed.chordHighways.keys[0].roman,'');assert.equal(fixed.chordHighways.keys[0].key,'');assert.deepEqual(fixed.parts,p.parts);
  assert.deepEqual(W.quantize(fixed,'keys',2).chordHighways,fixed.chordHighways);
});
test('invalid explicit chord edits are rejected without mutating the chart',()=>{
  const p=chordProject(),copy=W.clone(p);
  assert.throws(()=>W.reviseChord(p,'keys',0,{time:1,duration:1,pitches:[60,128]}),/pitch/i);
  assert.throws(()=>W.reviseChord(p,'keys',5,null),/existing chord/);assert.deepEqual(p,copy);
});
test('clearPart removes both notes and chord targets only from the selected role',()=>{
  const p=W.withChords(chordProject(),chordProject().chordHighways.keys,['guitar']);
  const cleared=W.clearPart(p,'keys');assert.equal(cleared.parts[1].notes.length,0);assert.equal(cleared.chordHighways.keys.length,0);
  assert.deepEqual(cleared.chordHighways.guitar,p.chordHighways.guitar);assert.deepEqual(W.parse(W.serialize(cleared)),cleared);
  assert.equal(W.clearPart(cleared,'guitar').chordHighways,undefined);
});
test('new manual chord targets support a chord-only part and survive save/reload',()=>{
  const p=W.reviseChord(W.empty(),'keys',null,{time:1,duration:1,pitches:[60,64,67]});
  assert.equal(p.chordHighways.keys[0].source,'manual');assert.equal(p.chordHighways.keys[0].name,'C');assert.equal(p.parts[1].notes.length,0);
  assert.deepEqual(W.parse(W.serialize(p)),p);
});
test('new targets on MIDI charts add corresponding source notes and preserve the existing arrangement',()=>{
  const original=chordProject(),p=W.reviseChord(original,'keys',null,{time:4,duration:.5,pitches:[62,65,69]});
  assert.deepEqual(p.parts[1].notes.slice(0,4),original.parts[1].notes);assert.deepEqual(p.chordHighways.keys.map(c=>c.name),['C','Dm']);
  assert.deepEqual(p.parts[1].notes.slice(4).map(n=>n.pitch),[62,65,69]);
});
test('short source chords at the song end remain valid notes instead of extending beyond the song',()=>{
  let p=W.empty({duration:1});for(const pitch of [60,64,67])p=W.revise(p,'keys',null,note(.98,pitch,.02));
  assert.equal(p.parts[1].notes.length,3);assert.equal(p.chordHighways,undefined);assert.deepEqual(W.parse(W.serialize(p)),p);
});

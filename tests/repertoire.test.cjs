const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
const X=require('../src/chords.js');
const R=require('../src/repertoire.js');

const part=(song,type)=>song.parts.find(p=>p.type===type);
const attacks=song=>[...new Set(part(song,'keys').notes.map(n=>n.time))];

test('Open Stage is a complete original 90-second band song with a musical form',()=>{
  const song=R.makeSong();
  assert.equal(song.id,'open-stage');assert.equal(song.original,true);
  assert.equal(song.duration,90);assert.equal(song.bpm,96);assert.equal(song.bars,36);
  assert.deepEqual(song.parts.map(p=>p.type),C.TYPES);
  assert.deepEqual(song.sections.map(s=>s.name),['INTRO','VERSE','CHORUS','BRIDGE','FINAL CHORUS','OUTRO']);
  assert.deepEqual(song.sections.map(s=>s.time),[0,10,30,50,60,80]);
  assert.deepEqual(song.harmony.slice(-4).map(h=>h.name),['F','G','C','C']);
  assert.equal(song.beats.at(-1).time,song.duration);
});

for(const level of R.DIFFICULTIES){
  test(`${level}: every event is playable, finite, bounded and in a valid MIDI range`,()=>{
    const song=R.makeSong(level);
    for(const p of song.parts){
      assert.ok(p.notes.length>20);assert.ok(p.channel>=1&&p.channel<=16);
      let previous=-Infinity;
      for(const n of p.notes){
        assert.ok(Number.isFinite(n.time)&&n.time>=0&&n.time>=previous);previous=n.time;
        assert.ok(Number.isFinite(n.duration)&&n.duration>0);
        assert.ok(n.time+n.duration<=song.duration+1e-9);
        assert.ok(Number.isInteger(n.pitch)&&n.pitch>=21&&n.pitch<=108);
        assert.ok(Number.isInteger(n.velocity)&&n.velocity>0&&n.velocity<=127);
      }
    }
    assert.ok(song.chordHighways.keys.length>=36);
    assert.equal(song.chordHighways.guitar,undefined);
    assert.equal(song.chordHighways.bass,undefined);
    for(const type of ['guitar','bass']){
      const notes=part(song,type).notes;
      for(let i=1;i<notes.length;i++)assert.ok(notes[i-1].time+notes[i-1].duration<=notes[i].time+1e-9,`${type} stays monophonic`);
    }
  });

  test(`${level}: scored chords match source notes, have hand hints, and end before the next attack`,()=>{
    const song=R.makeSong(level),keys=part(song,'keys').notes;
    const starts=attacks(song);
    for(const event of song.chordHighways.keys){
      const authored=keys.filter(n=>Math.abs(n.time-event.time)<1e-9).map(n=>n.pitch);
      assert.deepEqual(event.pitches,authored);
      assert.equal(X.chordName(authored),event.name);
      assert.deepEqual(event.pcs,[...new Set(authored.map(C.pc))].sort((a,b)=>a-b));
      assert.equal(event.source,'midi');assert.equal(event.confidence,1);
      assert.deepEqual([...event.hint.leftHand,...event.hint.rightHand],authored);
      assert.ok(event.hint.rightHand.at(-1)-event.hint.rightHand[0]<=12,'right hand fits one octave');
      const next=starts.find(time=>time>event.time+1e-9);
      if(next!==undefined)assert.ok(event.time+event.duration<next-1e-9,`${event.name} releases before next attack`);
    }
    // This guards individual melody notes too, rather than just chord metadata.
    for(const n of keys){
      const next=starts.find(time=>time>n.time+1e-9);
      if(next!==undefined)assert.ok(n.time+n.duration<next-1e-9);
    }
  });
}

test('difficulty changes the music: dyads, triads/inversions, then seventh voicings and syncopation',()=>{
  const chill=R.makeSong('chill'),standard=R.makeSong('standard'),expert=R.makeSong('expert');
  assert.deepEqual(chill.chordHighways.keys[0].pitches,[60,67]);
  assert.deepEqual(standard.chordHighways.keys[0].pitches,[60,64,67]);
  assert.deepEqual(expert.chordHighways.keys[0].pitches,[48,60,64,67,71]);
  assert.equal(expert.chordHighways.keys[0].name,'Cmaj7');
  assert.equal(standard.chordHighways.keys.find(n=>n.time===30).name,'F');
  assert.deepEqual(standard.chordHighways.keys.find(n=>n.time===30).pitches,[57,60,65]);
  assert.ok(attacks(chill).length<attacks(standard).length);
  assert.ok(attacks(standard).length<attacks(expert).length);
  assert.ok(part(chill,'keys').notes.length<part(standard,'keys').notes.length);
  assert.ok(part(standard,'keys').notes.length<part(expert,'keys').notes.length);
  assert.ok(expert.chordHighways.keys.some(e=>Math.abs(e.time/(60/96)%1-.75)<1e-9),'expert has offbeat chord attacks');
  assert.deepEqual(chill.harmony,expert.harmony);
  assert.deepEqual(part(chill,'drums'),part(expert,'drums'));
});

test('standard and expert contain single-note answers between chords',()=>{
  for(const level of ['standard','expert']){
    const song=R.makeSong(level),keys=part(song,'keys').notes;
    const single=keys.filter(n=>keys.filter(other=>Math.abs(other.time-n.time)<1e-9).length===1);
    assert.ok(single.length>=12);
    for(const n of single)assert.ok(!song.chordHighways.keys.some(e=>Math.abs(e.time-n.time)<1e-9));
    assert.ok(single.some(n=>n.time>=10&&n.time<30),'verse has a melodic answer');
    assert.ok(single.some(n=>n.time>=60&&n.time<80),'final chorus has a melodic answer');
  }
});

test('resolving arrangement preserves ordinary songs and does not leak mutations',()=>{
  const ordinary=C.makeSong(0);
  assert.equal(R.resolve(ordinary,'expert'),ordinary);
  const edited={id:'workshop-open-stage',repertoire:R.ID,arrangement:'chill'};
  assert.equal(R.resolve(edited,'expert'),edited);
  const a=R.makeSong('chill'),b=R.resolve(a,'expert');
  assert.equal(a.arrangement,'chill');assert.equal(b.arrangement,'expert');
  assert.equal(R.resolve(b,'expert'),b);
  a.parts[1].notes[0].pitch=1;
  a.chordHighways.keys[0].hint.rightHand[0]=1;
  assert.equal(R.makeSong('chill').parts[1].notes[0].pitch,60);
  assert.equal(R.makeSong('chill').chordHighways.keys[0].hint.rightHand[0],60);
  assert.equal(R.makeSong('unknown').arrangement,'standard');
});

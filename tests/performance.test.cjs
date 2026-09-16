const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../src/performance.js');

const stats=(overrides={})=>({id:'keys',perfect:20,great:0,good:0,miss:0,extra:0,holds:10,holdBreaks:0,total:20,score:3000,...overrides});
const options=(overrides={})=>({songId:'open-stage',difficulty:'standard',mode:'exact',speed:1,completed:true,...overrides});
const run=(counts={},opts={})=>P.result([stats(counts)],options(opts));

test('energy reacts to playing and misses and stays within zero to one hundred',()=>{
  let band=P.createSession(['keys']);
  const original=structuredClone(band);
  band=P.record(band,'keys','perfect',0);
  assert.ok(band.energy>original.energy);assert.equal(original.energy,50);
  const high=band.energy;band=P.record(band,'keys','miss',.5);
  assert.ok(band.energy<high);
  for(let i=0;i<100;i++)band=P.record(band,'keys','perfect',i);
  assert.equal(band.energy,100);
  for(let i=0;i<100;i++)band=P.record(band,'keys','release',100+i);
  assert.equal(band.energy,0);
  assert.equal(band.bandBonus,0,'solo playing cannot claim cooperative credit');
});

test('one cooperative bonus requires distinct active players in a shared phrase',()=>{
  let band=P.createSession(['keys','guitar','drums'],{bpm:120});
  for(let i=0;i<4;i++)band=P.record(band,'keys','perfect',i*.25);
  assert.equal(band.bandBonus,0);
  band=P.record(band,'drums','great',1);
  assert.equal(band.bandBonus,0,'every member must contribute');
  band=P.record(band,'guitar','good',1.5);
  assert.equal(band.bandBonus,150);assert.equal(band.bandPhrases,1);
  band=P.record(band,'guitar','perfect',1.75);
  assert.equal(band.bandBonus,150,'one phrase pays once');
  band=P.record(band,'keys','perfect',2);
  band=P.record(band,'drums','perfect',2.5);
  band=P.record(band,'guitar','perfect',3);
  assert.equal(band.bandBonus,300);assert.equal(band.bandPhrases,2);
});

test('misses reset pending cooperation and hits in separate phrases do not combine',()=>{
  let band=P.createSession(['keys','bass'],{bpm:120});
  band=P.record(band,'keys','perfect',0);
  band=P.record(band,'bass','miss',.1);
  band=P.record(band,'bass','perfect',.5);
  assert.equal(band.bandBonus,0);
  band=P.record(band,'keys','perfect',2.1);
  assert.equal(band.bandBonus,0,'previous phrase credit expired');
  band=P.record(band,'bass','perfect',1.9);
  assert.equal(band.bandBonus,0,'older event cannot reopen previous phrase');
  band=P.record(band,'bass','great',2.5);
  assert.equal(band.bandBonus,100);
});

test('unknown players, unknown grades and invalid timestamps do not affect a session',()=>{
  const band=P.createSession(['keys','keys','drums']);
  assert.deepEqual(band.players,['drums','keys']);
  assert.equal(P.record(band,'outsider','perfect',0),band);
  assert.equal(P.record(band,'keys','hold-complete',0),band);
  assert.equal(P.record(band,'keys','perfect',NaN),band);
  assert.equal(P.record(band,'keys','perfect',-1),band);
});

test('five-star mastery needs accurate hits and completed holds',()=>{
  const clean=run(),broken=run({holds:0,holdBreaks:10});
  assert.equal(clean.stars,5);assert.equal(clean.mastered,true);
  assert.equal(clean.quality,1);
  assert.equal(broken.stars,3);assert.equal(broken.mastered,false);
  assert.equal(broken.holdQuality,0);assert.equal(broken.quality,.75);
  assert.ok(run({extra:20}).stars<clean.stars);
  assert.ok(run({perfect:10,great:5,good:5}).stars<clean.stars);
});

test('idle completion gives no reward or progress record',()=>{
  const idle=run({perfect:0,miss:20,holds:0,score:0});
  assert.equal(idle.stars,0);assert.equal(idle.mastered,false);assert.equal(idle.eligible,false);
  assert.deepEqual(P.updateProgress(null,idle),{version:1,history:[],records:{}});
});

test('unfinished, demo, assisted and loop runs cannot enter progress',()=>{
  const prior=P.updateProgress(null,run());
  for(const flags of [{completed:false},{demo:true},{assisted:true},{loop:true}]){
    const ignored=run({},flags);
    assert.equal(ignored.eligible,false);assert.equal(ignored.stars,0);
    assert.equal(P.updateProgress(prior,ignored),prior);
  }
});

test('slow practice and easier settings have separate identities and never grant exact full-speed mastery',()=>{
  const exact=run();
  for(const settings of [{speed:.75},{speed:1.25},{mode:'pitch'},{mode:'timing'},{difficulty:'chill'}]){
    const practice=run({},settings);
    assert.equal(practice.eligible,true);assert.equal(practice.stars,5);
    assert.equal(practice.mastered,false);assert.notEqual(practice.identity,exact.identity);
  }
  const band=run({}, {lineup:['keys:midi:exact','drums:midi:pitch']});
  assert.notEqual(band.identity,exact.identity);
  assert.equal(band.identity,run({}, {lineup:['drums:midi:pitch','keys:midi:exact']}).identity);
});

test('band bonus remains separate from chart score, stars and judge statistics',()=>{
  const judge=stats(),before=structuredClone(judge);
  const plain=P.result([judge],options()),bonus=P.result([judge],options({bandBonus:200}));
  assert.deepEqual(judge,before);
  assert.equal(bonus.chartScore,plain.chartScore);assert.equal(bonus.bandBonus,200);
  assert.equal(bonus.totalScore,plain.chartScore+200);
  assert.equal(bonus.stars,plain.stars);assert.equal(bonus.quality,plain.quality);
});

test('progress is immutable, preserves bests and bounds both runs and identities',()=>{
  const best=run(),first=P.updateProgress(null,best),snapshot=structuredClone(first);
  const worse=run({perfect:10,miss:10,score:1000});
  const second=P.updateProgress(first,worse);
  assert.deepEqual(first,snapshot);
  assert.equal(second.records[best.identity].stars,5);
  assert.equal(second.records[best.identity].mastered,true);
  assert.equal(second.records[best.identity].chartScore,3000);
  assert.equal(second.records[best.identity].attempts,2);
  assert.equal(second.history.at(-1).chartScore,1000);
  let progress=second;
  for(let i=0;i<80;i++)progress=P.updateProgress(progress,run({}, {songId:`song-${i}`}));
  assert.equal(progress.history.length,P.MAX_HISTORY);
  assert.equal(Object.keys(progress.records).length,P.MAX_RECORDS);
  assert.equal(progress.history.at(-1).songId,'song-79');
  assert.ok(Object.values(progress.records).every(record=>record.songId!=='song-0'));
});

test('multiple players contribute weighted chart accuracy and holds',()=>{
  const two=P.result([stats(),stats({id:'drums',perfect:0,miss:20,holds:0,score:0})],options());
  assert.equal(two.targets,40);assert.equal(two.hits,20);assert.equal(two.quality,.5);
  assert.equal(two.stars,2);assert.equal(two.mastered,false);
});

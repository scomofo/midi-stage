const test=require('node:test');
const assert=require('node:assert/strict');
const {AudioEngine}=require('../src/audio.js');
global.StageCore=require('../src/core.js');
const stretch=require('../src/stretch.js');

class Param{
  constructor(value=0){this.value=value;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}
}
class Node{
  constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.playbackRate=new Param(1);this.connections=[];this.starts=[];this.stops=[];}
  connect(node){this.connections.push(node);}disconnect(){}start(...args){this.starts.push(args);}stop(...args){this.stops.push(args);}setPeriodicWave(){}
}
class Context{
  constructor(){this.sampleRate=8000;this.currentTime=10;this.state='running';this.destination={};this.sources=[];}
  createGain(){return new Node();}createBiquadFilter(){return new Node();}createOscillator(){return new Node();}createPeriodicWave(){return {};}
  createDynamicsCompressor(){return {threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param(),connect(){}};}
  createBufferSource(){const node=new Node();this.sources.push(node);return node;}
  createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return {numberOfChannels,length,sampleRate,duration:length/sampleRate,getChannelData:c=>channels[c]};}
}
global.window={AudioContext:Context};
const song={id:'audio-test',bpm:120,duration:6,beats:[],parts:[{id:'keys',type:'keys',notes:[]}]};
const players=[{id:'keys',type:'keys',source:'keys',enabled:true}];
function backing(seconds=6){const buffer=new Context().createBuffer(1,seconds*8000,8000);buffer.getChannelData(0).forEach((_,i,a)=>a[i]=.4*Math.sin(2*Math.PI*440*i/8000));return buffer;}

test('stretched backing seeks in prepared-buffer time while song clock remains in chart time',async()=>{
  for(const [speed,seek,audioOffset]of [[.5,2,.5],[.75,0,1],[1.25,2,-.5]]){
    const engine=new AudioEngine();try{
      await engine.begin({song,players,speed,seek,audioOffset,end:5,countIn:false,buffer:backing()});
      const source=engine.ctx.sources.at(-1),[at,offset]=source.starts[0];
      assert.equal(source.playbackRate.value,1);assert.equal(source.buffer.length,Math.ceil(48000/speed));
      assert.ok(Math.abs(offset-Math.max(0,seek-audioOffset)/speed)<1e-9);
      engine.contextAt=()=>at;assert.ok(Math.abs(engine.songAt()-Math.max(seek,audioOffset))<1e-9);
      assert.ok(Math.abs(source.stops[0][0]-(engine.origin+5/speed))<1e-9);
    }finally{engine.stop();}
  }
});

test('normal backing uses its original buffer at unit playback rate',async()=>{
  const engine=new AudioEngine(),buffer=backing();try{
    await engine.begin({song,players,buffer,countIn:false,seek:2,audioOffset:.5});const source=engine.ctx.sources.at(-1);
    assert.equal(source.buffer,buffer);assert.equal(source.playbackRate.value,1);assert.equal(source.starts[0][1],1.5);
  }finally{engine.stop();}
});

test('pause and resume reuse one prepared variant; changing source or tempo replaces it',async()=>{
  const engine=new AudioEngine(),buffer=backing();let calls=0;global.StageStretch={prepare:(...args)=>{calls++;return stretch.prepare(...args);}};
  try{
    await engine.begin({song,players,buffer,speed:.5,countIn:false});const prepared=engine.prepared.buffer;engine.stop();
    await engine.begin({song,players,buffer,speed:.5,seek:2,countIn:false});assert.equal(calls,1);assert.equal(engine.ctx.sources.at(-1).buffer,prepared);assert.equal(engine.ctx.sources.at(-1).starts[0][1],4);
    await engine.begin({song,players,buffer,speed:.75,countIn:false});assert.equal(calls,2);assert.notEqual(engine.prepared.buffer,prepared);
    const replacement=backing();await engine.begin({song,players,buffer:replacement,speed:.75,countIn:false});assert.equal(calls,3);assert.equal(engine.prepared.source,replacement);
  }finally{engine.stop();delete global.StageStretch;}
});

test('stop during async preparation prevents playback, timers and stale cache writes',async()=>{
  const engine=new AudioEngine();let progress=0;
  await assert.rejects(engine.begin({song,players,buffer:backing(20),speed:.5,progress:()=>{progress++;engine.stop();}}),{name:'AbortError'});
  assert.ok(progress>0);assert.equal(engine.running,false);assert.equal(engine.timer,null);assert.equal(engine.ctx.sources.length,0);assert.equal(engine.prepared,null);
});

test('external startup cancellation is checked before scheduling backing',async()=>{
  const engine=new AudioEngine();await assert.rejects(engine.begin({song,players,buffer:backing(),cancelled:()=>true}),{name:'AbortError'});
  assert.equal(engine.running,false);assert.equal(engine.ctx.sources.length,0);
});

test('mix buses stay independent and performance only affects synthesized guide player',async()=>{
  const engine=new AudioEngine();engine.setMix({backing:.3,monitor:.7,guide:.5});
  try{
    await engine.begin({song:{...song,parts:[{...song.parts[0],notes:[{time:0,pitch:60,duration:.5,velocity:100}]}]},players,guide:true,countIn:false});
    assert.equal(engine.buses.backing.gain.value,.3);assert.equal(engine.buses.monitor.gain.value,.7);assert.equal(engine.buses.guide.gain.value,.5);
    engine.performance('keys','miss');assert.equal(engine.guidePlayers.get('keys').gain.value,.18);assert.equal(engine.buses.backing.gain.value,.3);
    engine.performance('keys','perfect');assert.equal(engine.guidePlayers.get('keys').gain.value,1);
    engine.setMix({backing:0,guide:0,monitor:1});assert.equal(engine.buses.backing.gain.value,0);assert.equal(engine.buses.monitor.gain.value,1);assert.equal(engine.buses.guide.gain.value,0);
  }finally{engine.stop();}
});

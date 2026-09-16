const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare}=require('../src/stretch.js');

function signal({seconds=2,rate=16000,channels=1,frequency=440}={}){
  const length=Math.round(seconds*rate),data=Array.from({length:channels},(_,c)=>Float32Array.from({length},(_,i)=>(c?-.6:1)*(.55*Math.sin(2*Math.PI*frequency*i/rate)+.15*Math.sin(4*Math.PI*frequency*i/rate))));
  return {length,sampleRate:rate,numberOfChannels:channels,duration:length/rate,getChannelData:c=>data[c]};
}
function dominant(buffer,channel=0){
  const data=buffer.getChannelData(channel),n=2**Math.floor(Math.log2(Math.min(16384,data.length))),from=Math.floor((data.length-n)/2),re=new Float64Array(n),im=new Float64Array(n);
  for(let i=0;i<n;i++)re[i]=data[from+i]*(.5-.5*Math.cos(2*Math.PI*i/(n-1)));
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
  for(let size=2;size<=n;size*=2)for(let start=0;start<n;start+=size)for(let i=0;i<size/2;i++){
    const a=-2*Math.PI*i/size,c=Math.cos(a),s=Math.sin(a),u=start+i,v=u+size/2,tr=c*re[v]-s*im[v],ti=c*im[v]+s*re[v];
    re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;
  }
  let best=0,power=0;for(let i=1;i<n/2;i++){const p=re[i]*re[i]+im[i]*im[i];if(p>power){best=i;power=p;}}
  return best*buffer.sampleRate/n;
}

for(const speed of [.5,.75,1.25])test(`PCM tempo ${speed} preserves pitch and has the requested duration`,async()=>{
  const input=signal(),output=await prepare(input,speed);
  assert.equal(output.length,Math.ceil(input.length/speed));assert.ok(Math.abs(output.duration-input.duration/speed)<=1/input.sampleRate);
  assert.ok(Math.abs(dominant(output)-440)<2,`dominant frequency ${dominant(output)} Hz`);
  assert.ok(output.getChannelData(0).every(Number.isFinite));
});

test('stereo alignment preserves anti-phase amplitude relationship without channel drift',async()=>{
  const input=signal({channels:2}),output=await prepare(input,.75),left=output.getChannelData(0),right=output.getChannelData(1);
  assert.equal(output.numberOfChannels,2);assert.ok(Math.abs(dominant(output,1)-440)<2);
  let error=0;for(let i=0;i<left.length;i++)error=Math.max(error,Math.abs(right[i]+.6*left[i]));
  assert.ok(error<1e-6,`stereo relation error ${error}`);
});

test('100% tempo returns the unmodified original buffer',async()=>{
  const input=signal(),before=input.getChannelData(0).slice();assert.equal(await prepare(input,1),input);assert.deepEqual(input.getChannelData(0),before);
});

test('output memory limit is checked before allocating a stretched buffer',async()=>{
  let allocations=0;await assert.rejects(prepare(signal(),.5,{maxOutputBytes:100,createBuffer:()=>{allocations++;}}),/too long/);assert.equal(allocations,0);
});

test('preparation yields and cancellation stops further work',async()=>{
  let cancelled=false,yields=0;
  await assert.rejects(prepare(signal({seconds:20}),.5,{cancelled:()=>cancelled,yieldControl:async()=>{yields++;cancelled=true;}}),{name:'AbortError'});
  assert.ok(yields>0);
});

test('silent backing remains silent and does not produce invalid samples',async()=>{
  const input=signal({seconds:.2});input.getChannelData(0).fill(0);const output=await prepare(input,.5);assert.ok(output.getChannelData(0).every(v=>v===0));
});

test('invalid tempo fails explicitly instead of resampling',async()=>{
  await assert.rejects(prepare(signal(),0),/25%/);await assert.rejects(prepare(signal(),NaN),/25%/);
});

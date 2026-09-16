/* Local WSOLA time stretching. Frames retain their original sample rate/pitch;
   one shared alignment preserves the stereo image. No network or resampling. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StageStretch=api;
})(globalThis,function(){
  'use strict';
  const MAX_OUTPUT_BYTES=192*1024*1024;
  function aborted(){const error=Error('Backing preparation cancelled.');error.name='AbortError';return error;}
  function arrayBuffer(channels,length,sampleRate){
    const data=Array.from({length:channels},()=>new Float32Array(length));
    return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:i=>data[i]};
  }
  async function prepare(input,speed,{createBuffer=arrayBuffer,cancelled=()=>false,progress=()=>{},maxOutputBytes=MAX_OUTPUT_BYTES,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
    if(!input||!Number.isInteger(input.length)||input.length<1||!Number.isFinite(input.sampleRate)||input.sampleRate<8000||!Number.isInteger(input.numberOfChannels)||input.numberOfChannels<1||input.numberOfChannels>8)throw Error('Invalid backing audio for tempo preparation.');
    if(!Number.isFinite(speed)||speed<.25||speed>2)throw Error('Pitch-preserving tempo must be between 25% and 200%.');
    if(cancelled())throw aborted();
    if(speed===1){progress(1);return input;}
    const length=Math.ceil(input.length/speed),bytes=length*input.numberOfChannels*4;
    if(!Number.isSafeInteger(length)||bytes>maxOutputBytes)throw Error('This backing is too long at that tempo. Use a shorter audio clip or a tempo closer to 100%.');
    const output=createBuffer(input.numberOfChannels,length,input.sampleRate);
    const source=Array.from({length:input.numberOfChannels},(_,c)=>input.getChannelData(c)),dest=source.map((_,c)=>output.getChannelData(c));
    const hop=Math.max(64,Math.round(input.sampleRate*.02)),frame=hop*2,search=Math.round(input.sampleRate*.012),coarse=Math.max(1,Math.round(input.sampleRate/8000)),stride=Math.max(1,Math.floor(hop/128));
    let previous=0,lastYield=Date.now();
    for(let out=0;out<length;out+=hop){
      if(cancelled())throw aborted();
      const nominal=Math.round(out*speed);let selected=nominal;
      if(out){
        // Pick an energetic reference channel without summing anti-phase stereo.
        let reference=0,energy=-1;
        for(let c=0;c<source.length;c++){let sum=0;for(let i=0;i<hop;i+=stride){const v=source[c][previous+hop+i]||0;sum+=v*v;}if(sum>energy){energy=sum;reference=c;}}
        const data=source[reference],lo=Math.max(0,nominal-search),hi=Math.min(input.length-1,nominal+search);
        let best=-Infinity;
        const score=at=>{
          let dot=0,power=0;
          for(let i=0;i<hop;i+=stride){const a=data[previous+hop+i]||0,b=data[at+i]||0;dot+=a*b;power+=b*b;}
          // Normalized correlation aligns waveform phases; a tiny position cost
          // prevents arbitrary jumps on silence and breaks periodic ties.
          return energy>1e-12&&power>1e-12?dot/Math.sqrt(energy*power)-Math.abs(at-nominal)*1e-7:-Math.abs(at-nominal);
        };
        if(lo<=hi){
          selected=Math.min(hi,Math.max(lo,nominal));best=score(selected);
          for(let at=lo;at<=hi;at+=coarse){const value=score(at);if(value>best){best=value;selected=at;}}
          const center=selected;
          for(let at=Math.max(lo,center-coarse);at<=Math.min(hi,center+coarse);at++){const value=score(at);if(value>best){best=value;selected=at;}}
        }
      }
      for(let i=0;i<frame&&out+i<length;i++){
        const weight=i<hop?(out===0?1:i/hop):1-(i-hop)/hop;
        for(let c=0;c<source.length;c++)dest[c][out+i]+=(source[c][selected+i]||0)*weight;
      }
      previous=selected;
      if(Date.now()-lastYield>=12){progress(Math.min(1,(out+hop)/length));await yieldControl();lastYield=Date.now();}
    }
    if(cancelled())throw aborted();progress(1);return output;
  }
  return {prepare,MAX_OUTPUT_BYTES};
});

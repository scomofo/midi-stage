/* Audio-clock transport with a short look-ahead scheduler. All sounds synthesized here. */
(function(root){
  'use strict';
  class AudioEngine {
    constructor(){this.ctx=null;this.master=null;this.nodes=new Set();this.origin=0;this.speed=1;this.running=false;this.events=[];this.cursor=0;this.timer=null;this.volume=.55;this.monitorVoices=new Map();}
    async init({resume=true}={}){
      if(!this.ctx){
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Web Audio is unavailable in this browser.');
        this.ctx=new AC({latencyHint:'interactive'});this.master=this.ctx.createGain();this.master.gain.value=this.volume*.5;
        const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=8;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.15;
        this.master.connect(limiter);limiter.connect(this.ctx.destination);
        this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const a=this.noise.getChannelData(0);let seed=12553;
        for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;a[i]=(seed>>>0)/2147483648-1;}
      }
      // Decoding local files must not wait for autoplay/user-activation permission.
      if(!resume)return;
      if(this.ctx.state==='suspended')await this.ctx.resume();
      if(this.ctx.state!=='running')throw Error('Audio could not start. Click Start again to enable browser audio.');
    }
    setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.5,this.ctx.currentTime,.02);}
    contextAt(stamp=performance.now()){
      if(!this.ctx)return 0;
      const ts=this.ctx.getOutputTimestamp?.();
      if(ts&&ts.contextTime>0&&ts.performanceTime>0)return ts.contextTime+(stamp-ts.performanceTime)/1000;
      return this.ctx.currentTime-(this.ctx.outputLatency||this.ctx.baseLatency||0)+(stamp-performance.now())/1000;
    }
    songAt(stamp=performance.now()){return (this.contextAt(stamp)-this.origin)*this.speed;}
    track(source,gain,filter){
      const voice={source,gain,filter,stopped:false,stop:()=>{if(voice.stopped)return;voice.stopped=true;try{gain.gain.cancelScheduledValues(this.ctx.currentTime);gain.gain.setTargetAtTime(.0001,this.ctx.currentTime,.012);source.stop(this.ctx.currentTime+.05);}catch(_){}}};
      this.nodes.add(voice);source.onended=()=>{this.nodes.delete(voice);try{source.disconnect();gain.disconnect();filter?.disconnect();}catch(_){}};return voice;
    }
    tone(type,pitch,velocity=90,at=this.ctx.currentTime,duration=.3,level=1){
      const ctx=this.ctx,start=Math.max(ctx.currentTime,at),v=Math.max(.01,velocity/127)*level;
      if(type==='drums')return this.drum(pitch,v,start);
      const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();const freq=440*Math.pow(2,(pitch-69)/12);
      osc.type=type==='bass'?'sawtooth':type==='guitar'?'sawtooth':'triangle';osc.frequency.value=freq;
      filter.type='lowpass';filter.frequency.setValueAtTime(type==='bass'?700:type==='guitar'?2200:4000,start);filter.frequency.exponentialRampToValueAtTime(type==='bass'?160:900,start+Math.min(duration,.35));filter.Q.value=.5;
      const sustain=Math.max(.06,Math.min(duration,10)),amp=v*(type==='bass'?.2:type==='guitar'?.095:.23);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,amp),start+.008);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,amp*.55),start+.12);gain.gain.setValueAtTime(Math.max(.0002,amp*.5),start+sustain+.12);gain.gain.exponentialRampToValueAtTime(.0001,start+sustain+.24);
      osc.connect(filter);filter.connect(gain);gain.connect(this.master);const voice=this.track(osc,gain,filter);osc.start(start);osc.stop(start+sustain+.25);return voice;
    }
    drum(pitch,v,start){
      const ctx=this.ctx;let freq,duration,kind;
      if([35,36].includes(pitch)){freq=150;duration=.27;kind='kick';}
      else if([37,38,39,40].includes(pitch)){freq=1500;duration=.15;kind='noise';}
      else if([41,43,45,47,48,50].includes(pitch)){freq=95+(pitch-41)*15;duration=.24;kind='tom';}
      else{freq=[49,52,55,57].includes(pitch)?5000:8000;duration=[49,52,55,57].includes(pitch)?.6:pitch===46?.28:.075;kind='metal';}
      const gain=ctx.createGain(),filter=ctx.createBiquadFilter();let source;
      if(kind==='kick'||kind==='tom'){
        source=ctx.createOscillator();source.type='sine';source.frequency.setValueAtTime(freq,start);source.frequency.exponentialRampToValueAtTime(kind==='kick'?45:freq*.55,start+duration);filter.type='lowpass';filter.frequency.value=1000;
      }else{source=ctx.createBufferSource();source.buffer=this.noise;filter.type=kind==='metal'?'highpass':'bandpass';filter.frequency.value=freq;filter.Q.value=.55;}
      const amp=v*(kind==='kick'?.65:kind==='metal'?.18:.36);
      gain.gain.setValueAtTime(Math.max(.0002,amp),start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      source.connect(filter);filter.connect(gain);gain.connect(this.master);const voice=this.track(source,gain,filter);source.start(start);source.stop(start+duration+.01);return voice;
    }
    click(at,accent=false){if(!this.ctx)return;const ctx=this.ctx,start=Math.max(at,ctx.currentTime),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=accent?1400:1000;gain.gain.setValueAtTime(.15,start);gain.gain.exponentialRampToValueAtTime(.0001,start+.045);osc.connect(gain);gain.connect(this.master);const v=this.track(osc,gain);osc.start(start);osc.stop(start+.05);return v;}
    async begin({song,players,speed=1,seek=0,end=song.duration,countIn=true,guide=false,demo=false,metronome=false,buffer=null,audioOffset=0}){
      await this.init();this.stop();this.speed=speed;this.song=song;const beat=60/song.bpm;
      const pre=countIn?4*beat/speed:.12;this.origin=this.ctx.currentTime+.12+pre-seek/speed;
      this.events=[];
      if(countIn)for(let i=4;i>0;i--)this.events.push({time:seek-i*beat,click:true,accent:i===4});
      if(metronome)for(const b of song.beats)if(b.time>=seek&&b.time<end)this.events.push({time:b.time,click:true,accent:b.bar});
      const sources=new Set(players.filter(p=>p.enabled).map(p=>root.StageCore.sourceFor(song,p).id));
      if(!buffer)for(const part of song.parts){const selected=sources.has(part.id);if(selected&&!guide&&!demo)continue;
        const player=players.find(p=>p.enabled&&root.StageCore.sourceFor(song,p).id===part.id);const type=player?.type||part.type||'keys';
        for(const n of part.notes)if(n.time>=seek-1e-6&&n.time<end)this.events.push({...n,type,level:selected?.42:.65,duration:Math.min(n.duration,end-n.time)/speed});
      }
      this.events.sort((a,b)=>a.time-b.time);this.cursor=0;this.running=true;
      if(buffer){
        const src=this.ctx.createBufferSource(),gain=this.ctx.createGain();src.buffer=buffer;src.playbackRate.value=speed;gain.gain.value=.8;src.connect(gain);gain.connect(this.master);
        const songStart=Math.max(seek,audioOffset),offset=Math.max(0,seek-audioOffset),at=this.origin+songStart/speed;
        if(offset<buffer.duration&&songStart<end){this.track(src,gain);src.start(Math.max(this.ctx.currentTime,at),offset);src.stop(this.origin+end/speed);}else{src.disconnect();gain.disconnect();}
      }
      this.schedule();this.timer=setInterval(()=>this.schedule(),25);
    }
    schedule(){
      if(!this.running)return;const until=(this.ctx.currentTime+.12-this.origin)*this.speed;
      while(this.cursor<this.events.length&&this.events[this.cursor].time<=until){const e=this.events[this.cursor++],at=this.origin+e.time/this.speed;if(at<this.ctx.currentTime-.07)continue;
        if(e.click)this.click(at,e.accent);else this.tone(e.type,e.pitch,e.velocity,at,e.duration,e.level);
      }
    }
    stop(){this.running=false;clearInterval(this.timer);this.timer=null;for(const n of [...this.nodes])n.stop();this.monitorVoices.clear();}
    monitor(token,type,pitch,velocity,duration=1){if(!this.ctx||this.ctx.state!=='running')return;this.release(token);const v=this.tone(type,pitch,velocity,this.ctx.currentTime,duration,.85);if(type!=='drums')this.monitorVoices.set(token,v);}
    release(token){const v=this.monitorVoices.get(token);if(v){v.stop();this.monitorVoices.delete(token);}}
  }
  root.StageAudio={AudioEngine};
})(globalThis);

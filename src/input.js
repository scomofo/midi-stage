/* Local audio soundcheck. Capture is explicit, muted and never recorded.
   This capture module never awards scores; the optional live-string tracker consumes observations. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StageInput = api;
})(globalThis, function() {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function level(samples) {
    let sum = 0, energy = 0, peak = 0;
    for (const x of samples) { if (!Number.isFinite(x)) return {rms:0, db:-100, peak:0}; sum += x; energy += x*x; peak = Math.max(peak, Math.abs(x)); }
    const n = samples.length || 1;
    const rms = Math.sqrt(Math.max(0, energy/n - (sum/n)**2));
    return {rms, db: Math.max(-100, 20*Math.log10(Math.max(1e-5, rms))), peak};
  }
  function noteAt(frequency) {
    if (!(frequency > 0) || !Number.isFinite(frequency)) return null;
    const value = 69 + 12*Math.log2(frequency/440), midi = Math.round(value);
    const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
    return {frequency, midi, name:names[((midi%12)+12)%12]+(Math.floor(midi/12)-1), cents:100*(value-midi)};
  }
  /* Cumulative normalized difference, using a fixed comparison window.
     Downsampling bounds work for the low strings. Not polyphonic transcription. */
  function detectPitch(samples, sampleRate, options={}) {
    if (!samples || samples.length < 512 || !Number.isFinite(sampleRate) || sampleRate < 8000) return null;
    const minHz = options.minHz || 28, maxHz = options.maxHz || 1500;
    const meter = level(samples);
    if (meter.db < (options.gateDb ?? -55) || meter.rms < 1e-5) return null;
    const step = Math.max(1, Math.floor(sampleRate/12000)), rate = sampleRate/step;
    const n = Math.floor(samples.length/step), data = new Float64Array(n);
    let mean = 0;
    for (let i=0; i<n; i++) { let x=0; for (let k=0; k<step; k++) x+=samples[i*step+k]; data[i]=x/step; mean+=data[i]; }
    mean/=n; for(let i=0;i<n;i++) data[i]-=mean;
    const minLag=Math.max(2,Math.floor(rate/maxHz)), maxLag=Math.min(Math.ceil(rate/minHz),Math.floor(n/2)-1);
    if(maxLag<=minLag) return null;
    const windowSize=n-maxLag, diff=new Float64Array(maxLag+1);
    let cumulative=0; diff[0]=1;
    for(let lag=1;lag<=maxLag;lag++) {
      let d=0; for(let i=0;i<windowSize;i++){const v=data[i]-data[i+lag]; d+=v*v;}
      cumulative+=d; diff[lag]=cumulative>1e-15?d*lag/cumulative:1;
    }
    let chosen=-1;
    for(let lag=minLag;lag<maxLag;lag++) {
      if(diff[lag]<.13){while(lag+1<=maxLag&&diff[lag+1]<diff[lag])lag++;chosen=lag;break;}
    }
    if(chosen<0) return null;
    const left=diff[chosen-1], middle=diff[chosen], right=diff[Math.min(maxLag,chosen+1)];
    const denom=left-2*middle+right;
    const correction=chosen<maxLag&&Math.abs(denom)>1e-15?clamp(.5*(left-right)/denom,-1,1):0;
    const frequency=rate/(chosen+correction);
    if(frequency<minHz*.98||frequency>maxHz*1.02) return null;
    return {...noteAt(frequency), confidence:clamp(1-middle,0,1)};
  }
  function messageFor(error) {
    switch(error?.name) {
      case 'NotAllowedError': return 'Audio permission was denied. Allow microphone/audio input for this local page in browser settings, then retry.';
      case 'NotFoundError': return 'No audio input was found. Connect the interface and check that your computer recognizes it.';
      case 'NotReadableError': return 'The audio input could not be opened. Check the cable, driver, or whether another app is holding the device.';
      case 'OverconstrainedError': return 'That saved audio input is unavailable. Refresh the device list and choose a connected input.';
      default: return error?.message || 'Audio input could not start.';
    }
  }
  class AudioInputHub {
    constructor({getContext, mediaDevices, onData=()=>{}, onState=()=>{}, onDevices=()=>{}, intervalMs=85, fftSizeFor=null, requireKnownChannels=false}={}) {
      this.media = mediaDevices || globalThis.navigator?.mediaDevices;
      this.intervalMs=clamp(Number(intervalMs)||85,15,250);this.fftSizeFor=fftSizeFor;this.requireKnownChannels=requireKnownChannels;this.getContext=getContext;this.onData=onData;this.onState=onState;this.onDevices=onDevices;
      this.entries=new Map();this.routes=new Map();this.requests=new Map();this.devices=[];this.timer=null;this.serial=0;this.discoveryEpoch=0;this.discoveryStreams=new Set();
      this.deviceChange=()=>this.refresh().catch(e=>this.onState(null,{error:messageFor(e)}));
      this.media?.addEventListener?.('devicechange',this.deviceChange);
    }
    supported() { return !!(this.media?.getUserMedia && this.media?.enumerateDevices); }
    assertSupport() {
      if(!this.supported()) throw Error('Audio capture is unavailable here. Use the localhost launcher in desktop Chrome and check site permissions.');
      if(globalThis.isSecureContext===false) throw Error('Audio input needs a secure page. Use start.py and open the localhost address.');
    }
    async refresh() {
      if(!this.media?.enumerateDevices) return [];
      const all=(await this.media.enumerateDevices()).filter(d=>d.kind==='audioinput'&&d.deviceId);
      // Avoid listing the same physical input again as the system-default alias.
      const direct=all.filter(d=>!['default','communications'].includes(d.deviceId));
      this.devices=(direct.length?direct:all).map((d,i)=>({id:d.deviceId,name:d.label||`Audio input ${i+1} (allow access to reveal its name)`}));
      this.onDevices(this.devices.map(d=>({...d})));
      for(const [role,r] of [...this.routes]) if(!all.some(d=>d.deviceId===r.deviceId)) {
        this.stop(role);this.onState(role,{error:'This audio input disconnected. Reconnect it, refresh, and start the check again.'});
      }
      return this.devices;
    }
    async allow() {
      this.assertSupport();
      // This temporary capture is only for permission and enumeration, never playback.
      const epoch=this.discoveryEpoch;
      const stream=await this.media.getUserMedia({audio:true,video:false});
      this.discoveryStreams.add(stream);
      try{if(epoch!==this.discoveryEpoch)return [];const devices=await this.refresh();return epoch===this.discoveryEpoch?devices:[];}
      finally{this.discoveryStreams.delete(stream);stream.getTracks().forEach(t=>t.stop());}
    }
    async acquire(deviceId,ctx) {
      let entry=this.entries.get(deviceId);
      if(!entry) {
        entry={deviceId,refs:0,stream:null,source:null,splitter:null,mute:null,track:null,settings:{},channels:null};
        this.entries.set(deviceId,entry);
        entry.promise=(async()=>{
          try {
            const stream=await this.media.getUserMedia({audio:{deviceId:{exact:deviceId},channelCount:{ideal:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
            entry.stream=stream;entry.track=stream.getAudioTracks()[0];
            if(!entry.track)throw Error('The device did not return an audio track.');
            entry.settings=entry.track.getSettings?.()||{};
            const count=Number(entry.settings.channelCount);
            entry.channels=Number.isInteger(count)&&count>0?count:null;
            entry.source=ctx.createMediaStreamSource(stream);entry.splitter=ctx.createChannelSplitter(Math.min(entry.channels||2,32));
            entry.mute=ctx.createGain();entry.mute.gain.value=0;
            entry.source.connect(entry.splitter);entry.mute.connect(ctx.destination);
            entry.ended=()=>{for(const [role,r] of [...this.routes])if(r.entry===entry){this.stop(role);this.onState(role,{error:'Audio capture ended. Check the connection and start again.'});}};
            entry.track.addEventListener?.('ended',entry.ended);
            return entry;
          } catch(e){this.dispose(entry);throw e;}
        })();
      }
      entry.refs++;
      try{return await entry.promise;}catch(e){entry.refs--;throw e;}
    }
    release(entry) {entry.refs--;if(entry.refs<=0)this.dispose(entry);}
    dispose(entry) {
      if(this.entries.get(entry.deviceId)===entry)this.entries.delete(entry.deviceId);
      entry.track?.removeEventListener?.('ended',entry.ended);
      for(const node of [entry.source,entry.splitter,entry.mute])try{node?.disconnect();}catch(_){}
      entry.stream?.getTracks().forEach(t=>t.stop());
    }
    async start(role,deviceId,channel=1,gateDb=-55) {
      this.assertSupport();
      if(!['guitar','bass'].includes(role))throw Error('Choose guitar or bass.');
      if(typeof deviceId!=='string'||!deviceId)throw Error('Choose an audio input first.');
      if(!Number.isInteger(channel)||channel<1||channel>32)throw Error('Choose a valid browser channel.');
      this.stop(role);
      const request=++this.serial;this.requests.set(role,request);this.onState(role,{pending:true});
      let entry=null,analyser=null;
      try {
        const ctx=await this.getContext();
        if(this.requests.get(role)!==request)return null;
        entry=await this.acquire(deviceId,ctx);
        if(this.requests.get(role)!==request){this.release(entry);return null;}
        if(entry.track.readyState==='ended')throw Error('Audio capture has ended. Reconnect and try again.');
        if(this.requireKnownChannels && channel>1 && !entry.channels)throw Error('The browser did not report its channel count. Channel 2 cannot be verified for live play; use a verified stereo input or a separate device.');
        if(channel>Math.min(entry.channels||2,32))throw Error(`This input exposes ${entry.channels||2} browser channel${entry.channels===1?'':'s'}, not channel ${channel}. Choose an available channel; do not assume the physical jack number.`);
        analyser=ctx.createAnalyser();analyser.fftSize=this.fftSizeFor?this.fftSizeFor(ctx.sampleRate,role):8192;analyser.smoothingTimeConstant=0;
        entry.splitter.connect(analyser,channel-1,0);analyser.connect(entry.mute);
        const route={role,deviceId,channel,gateDb:clamp(Number(gateDb)||-55,-80,-15),entry,analyser,samples:new Float32Array(analyser.fftSize),sampleRate:ctx.sampleRate,ctx};
        this.routes.set(role,route);this.requests.delete(role);
        this.onState(role,{active:true,channel,channels:entry.channels,settings:this.safeSettings(entry.settings),name:entry.track.label||this.devices.find(d=>d.id===deviceId)?.name||'Audio input'});
        if(!this.timer)this.timer=setInterval(()=>this.sample(),this.intervalMs);
        return this.describe(role);
      } catch(e) {
        try{if(analyser){entry?.splitter?.disconnect(analyser);analyser.disconnect();}}catch(_){}
        if(entry)this.release(entry);
        if(this.requests.get(role)!==request)return null;
        this.requests.delete(role);this.onState(role,{error:messageFor(e)});throw e;
      }
    }
    setGate(role,db) {const route=this.routes.get(role);if(route)route.gateDb=clamp(Number(db)||-55,-80,-15);}
    sample() {
      for(const [role,r] of this.routes) {
        try {
          r.analyser.getFloatTimeDomainData(r.samples);
          const fullMeter=level(r.samples),meter=this.fftSizeFor?level(r.samples.subarray(-Math.ceil(r.sampleRate*.02))):fullMeter,pitch=detectPitch(r.samples,r.sampleRate,{minHz:role==='bass'?28:65,maxHz:role==='bass'?550:1500,gateDb:r.gateDb});
          this.onData(role,{...meter,pitch,timestamp:performance.now(),windowMs:r.samples.length/r.sampleRate*1000,clipping:fullMeter.peak>=.985,signal:meter.db>=r.gateDb,muted:!!r.entry.track.muted});
        } catch(e){this.stop(role);this.onState(role,{error:messageFor(e)});}
      }
    }
    stop(role) {
      this.requests.delete(role);
      const r=this.routes.get(role);
      if(r){this.routes.delete(role);try{r.entry.splitter.disconnect(r.analyser);r.analyser.disconnect();}catch(_){}this.release(r.entry);}
      if(!this.routes.size){clearInterval(this.timer);this.timer=null;}
      this.onState(role,{active:false});
    }
    stopAll(){this.discoveryEpoch++;for(const stream of this.discoveryStreams)stream.getTracks().forEach(t=>t.stop());this.discoveryStreams.clear();for(const role of new Set([...this.requests.keys(),...this.routes.keys()]))this.stop(role);}
    safeSettings(s){return Object.fromEntries(['channelCount','sampleRate','sampleSize','latency','echoCancellation','noiseSuppression','autoGainControl'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));}
    describe(role){const r=this.routes.get(role);return r?{role,channel:r.channel,channels:r.entry.channels,settings:this.safeSettings(r.entry.settings),active:true}:null;}
    destroy(){this.stopAll();this.media?.removeEventListener?.('devicechange',this.deviceChange);}
  }
  return {AudioInputHub,detectPitch,noteAt,level,messageFor};
});

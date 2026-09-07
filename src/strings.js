/* Monophonic live-string input. No microphone samples are stored or uploaded.
   The tracker has no chart access: it cannot snap a wrong pitch to an expected note. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StageStrings = api;
})(globalThis, function() {
  'use strict';
  const LOOKBACK_MS = 260;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const isAudio = p => ['guitar', 'bass'].includes(p.type) && p.input === 'audio';
  const offset = p => clamp(Number(p.offsetMs) || 0, -500, 500);
  function correctionMs(p, globalOffset = 0) { return globalOffset + offset(p); }
  function frameSize(rate, role) {
    return clamp(2 ** Math.ceil(Math.log2(rate * (role === 'bass' ? .085 : .042))), 1024, 16384);
  }
  function routeError(players, settings) {
    const audio = players.filter(p => p.enabled && isAudio(p));
    for (const p of audio) {
      const s = settings[p.id];
      if (!s || typeof s.device !== 'string' || !s.device) return `Choose ${p.label}'s input in Audio soundcheck first.`;
      if (!Number.isInteger(s.channel) || s.channel < 1 || s.channel > 32) return `Choose a valid audio channel for ${p.label}.`;
    }
    for (let i = 0; i < audio.length; i++) for (let j = i + 1; j < audio.length; j++) {
      const a = settings[audio[i].id], b = settings[audio[j].id];
      if (a.device === b.device && a.channel === b.channel) return 'Guitar and bass cannot score from the same audio channel. Select separate channels or inputs.';
    }
    return null;
  }
  function chartError(notes, role) {
    const [low, high] = role === 'bass' ? [23, 72] : [36, 89];
    let end = -Infinity;
    for (const n of notes) {
      if (n.pitch < low || n.pitch > high) return `${role} chart contains pitches outside this single-note detector's range. Choose a different track or MIDI input.`;
      if (n.time < end - .035) return `${role} chart has chords or overlapping notes. Live audio v0.3 needs a monophonic track; choose First Rehearsal or a single-note MIDI part.`;
      end = n.time + n.duration;
    }
    return null;
  }
  function fretHint(pitch, role) {
    const tuning = role === 'bass' ? [[28,'E'],[33,'A'],[38,'D'],[43,'G']] : [[40,'low E'],[45,'A'],[50,'D'],[55,'G'],[59,'B'],[64,'high E']];
    const choices = tuning.map(([open, string]) => ({string, fret:pitch-open})).filter(x => x.fret >= 0 && x.fret <= 24).sort((a,b) => a.fret-b.fret);
    const best = choices[0];
    return best ? `${best.string} · ${best.fret === 0 ? 'open' : 'fret ' + best.fret}` : 'Outside standard tuning hints';
  }
  class NoteTracker {
    constructor({gateDb=-55, stableMs=35, releaseMs=80, confidence=.90, cents=40}={}) {
      this.options={gateDb,stableMs,releaseMs,confidence,cents}; this.serial=0; this.reset();
    }
    reset() {
      this.active=null; this.candidate=null; this.attack=null; this.previousDb=-100;
      this.lastFrame=-Infinity; this.lastAttack=-Infinity; this.lastPitch=null; this.invalidSince=null;
    }
    feed(data) {
      const events=[], now=data.timestamp;
      if (!Number.isFinite(now) || now <= this.lastFrame) return events;
      this.lastFrame=now;
      const o=this.options, db=Number.isFinite(data.db)?data.db:-100;
      const audible=db>=o.gateDb;
      const rise=audible && (this.previousDb<o.gateDb || db-this.previousDb>=7);
      if (rise && now-this.lastAttack>=110 && !data.clipping && !data.muted) {
        this.attack=now; this.lastAttack=now;
      }
      this.previousDb=db;
      if (this.attack!==null && now-this.attack>LOOKBACK_MS-20) this.attack=null;
      const pitch=data.pitch;
      const valid=audible && !data.muted && !data.clipping && pitch && Number.isInteger(pitch.midi) && pitch.midi>=0 && pitch.midi<=127 &&
        Number.isFinite(pitch.cents) && Math.abs(pitch.cents)<=o.cents && Number.isFinite(pitch.confidence) && pitch.confidence>=o.confidence && pitch.confidence<=1;
      const off=stamp=>{
        if (this.active) events.push({kind:'off',pitch:this.active.pitch,token:this.active.token,timestamp:stamp});
        this.active=null; this.invalidSince=null;
      };
      if (!valid) {
        this.candidate=null;
        if (data.clipping || data.muted) this.attack=null;
        if (this.active) {
          if (this.invalidSince===null) this.invalidSince=now;
          if (now-this.invalidSince>=o.releaseMs) off(this.invalidSince);
        }
        return events;
      }
      if (!this.candidate || this.candidate.pitch!==pitch.midi) this.candidate={pitch:pitch.midi,since:now};
      const candidate=this.candidate;
      const same=this.active?.pitch===pitch.midi;
      if (same) this.invalidSince=null;
      else if (this.active && this.invalidSince===null) this.invalidSince=now;
      const changed=this.lastPitch!==null && pitch.midi!==this.lastPitch;
      // Allow a full analysis window after an attack before trusting the new pitch.
      // This avoids scoring the previous note still present in the analyser buffer.
      const attackReady=this.attack!==null && now-this.attack>=Math.max(o.stableMs,data.windowMs||0);
      if (now-candidate.since>=o.stableMs && (attackReady || (changed && this.attack===null))) {
        const stamp=this.attack!==null ? this.attack : candidate.since;
        off(stamp);
        const token=`string-${++this.serial}`;
        this.active={pitch:pitch.midi,token}; this.lastPitch=pitch.midi; this.attack=null;
        events.push({kind:'on',pitch:pitch.midi,token,timestamp:stamp});
      } else if (!same && this.active && now-this.invalidSince>=o.releaseMs) off(this.invalidSince);
      if (this.active?.pitch===pitch.midi && this.attack===null) {
        // Conservative sustain evidence: a note must remain periodic through its tail.
        events.push({kind:'hold',pitch:pitch.midi,token:this.active.token,timestamp:now-(data.windowMs||0)/2});
      }
      return events;
    }
  }
  class LiveSession {
    constructor({InputHub,getContext,onEvent=()=>{},onData=()=>{},onError=()=>{}}) {
      this.onEvent=onEvent; this.onData=onData; this.onError=onError;
      this.epoch=0; this.running=false; this.trackers=new Map(); this.latest=new Map(); this.ready=new Set();
      this.hub=new InputHub({getContext,intervalMs:20,fftSizeFor:frameSize,requireKnownChannels:true,
        onData:(role,data)=>this.receive(role,data),onState:(role,status)=>{
          if (this.running && role && this.trackers.has(role) && (status.error || (this.ready.has(role) && !status.active && !status.pending))) {
            this.onError(status.error || `${role} audio capture stopped. Check the input and resume.`);
          }
          if (status.active) this.ready.add(role);
        }});
    }
    async start(players,settings) {
      this.stop(); const epoch=this.epoch;
      const error=routeError(players,settings); if(error) throw Error(error);
      const selected=players.filter(p=>p.enabled&&isAudio(p));
      if (!selected.length) return true;
      this.running=true;
      try {
        for (const p of selected) this.trackers.set(p.id,new NoteTracker({gateDb:settings[p.id].gateDb}));
        for (const p of selected) {
          const s=settings[p.id], result=await this.hub.start(p.id,s.device,s.channel,s.gateDb);
          if (epoch!==this.epoch) return false;
          if (!result) throw Error(`${p.label} input was cancelled.`);
        }
        return true;
      } catch(e) { if(epoch===this.epoch)this.stop(); throw e; }
    }
    receive(role,data) {
      if (!this.running) return;
      const previous=this.latest.get(role);
      if (previous && data.timestamp-previous.timestamp>LOOKBACK_MS) {
        this.onError('Live audio analysis was interrupted. Playback paused; resume with a fresh count-in.'); return;
      }
      this.latest.set(role,data); this.onData(role,data);
      for (const event of this.trackers.get(role)?.feed(data)||[]) this.onEvent(role,event);
    }
    stop() {
      this.running=false; this.epoch++; this.ready.clear(); this.trackers.clear(); this.latest.clear(); this.hub.stopAll();
    }
    destroy() { this.stop(); this.hub.destroy(); }
  }
  return {LOOKBACK_MS,isAudio,correctionMs,frameSize,routeError,chartError,fretHint,NoteTracker,LiveSession};
});

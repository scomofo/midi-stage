/* Local, dependency-free pulse analysis. No pitch transcription or stem separation.
   The analysis result is plain data: a future native renderer can consume the same chart. */
(function (root, factory) {
  const api = factory();
  api.workerSource = () => `const A=(${factory.toString()})();onmessage=e=>{try{postMessage({result:A.analyzeEnvelope(e.data)});}catch(error){postMessage({error:error.message});}};`;
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StageSongAnalysis = api;
})(globalThis, function createAnalysisAPI() {
  'use strict';
  const STEP = .01, MAX_SECONDS = 600;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  const cancelled = () => { const e = new Error('Analysis cancelled. Your previous chart has been kept.'); e.name = 'AbortError'; return e; };

  // Stereo is combined as ENERGY, never as signed amplitudes: inverted channels cannot cancel.
  // Work in small frame batches so file preparation does not lock the editor.
  function envelopeBuilder(channels, sampleRate) {
    if (!Array.isArray(channels) || !channels.length || channels.length > 8 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
      throw Error('Unsupported audio channel count or sample rate.');
    const length = channels[0].length, duration = length / sampleRate;
    if (!length || duration > MAX_SECONDS || channels.some(c => !(c instanceof Float32Array) || c.length !== length))
      throw Error('Use matching audio channels no longer than ten minutes.');
    const frameSize = Math.max(1, Math.round(sampleRate * STEP)), count = Math.ceil(length / frameSize);
    const energy = new Float32Array(count), low = new Float32Array(count), high = new Float32Array(count);
    const stride = Math.max(1, Math.floor(sampleRate / 12000)), effectiveRate = sampleRate / stride;
    const aLow = 1 - Math.exp(-2 * Math.PI * 180 / effectiveRate), aHigh = 1 - Math.exp(-2 * Math.PI * 2200 / effectiveRate);
    const lp = new Float64Array(channels.length), hp = new Float64Array(channels.length);
    let frame = 0;
    return {
      get progress() { return frame / count; },
      step(batch = 128) {
        const end = Math.min(count, frame + batch);
        for (; frame < end; frame++) {
          let e = 0, l = 0, h = 0, n = 0;
          for (let i = frame * frameSize; i < Math.min(length, (frame + 1) * frameSize); i += stride) {
            for (let c = 0; c < channels.length; c++) {
              const x = channels[c][i];
              if (!Number.isFinite(x)) throw Error('The decoded audio contains invalid samples.');
              lp[c] += aLow * (x - lp[c]); hp[c] += aHigh * (x - hp[c]);
              e += x * x; l += lp[c] * lp[c]; h += (x - hp[c]) ** 2; n++;
            }
          }
          energy[frame] = Math.sqrt(e / n); low[frame] = Math.sqrt(l / n); high[frame] = Math.sqrt(h / n);
        }
        return frame === count;
      },
      result() { if (frame !== count) throw Error('Audio preparation is incomplete.'); return { energy, low, high, step: frameSize / sampleRate, duration }; }
    };
  }
  function envelopeFromChannels(channels, sampleRate) {
    const b = envelopeBuilder(channels, sampleRate); while (!b.step()) {} return b.result();
  }
  function analyzeEnvelope({ energy, low, high, step, duration }) {
    if (!(energy instanceof Float32Array) || !(low instanceof Float32Array) || !(high instanceof Float32Array) ||
        !energy.length || energy.length > 60002 || low.length !== energy.length || high.length !== energy.length ||
        !Number.isFinite(step) || step < .009 || step > .011 || !Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS ||
        Math.abs(energy.length * step - duration) > step * 1.1) throw Error('Invalid audio analysis data.');
    let peak = 0;
    for (let i = 0; i < energy.length; i++) {
      if (![energy[i], low[i], high[i]].every(v => Number.isFinite(v) && v >= 0)) throw Error('Invalid audio analysis samples.');
      peak = Math.max(peak, energy[i]);
    }
    const empty = { version: 1, method: 'energy-onsets-v1', duration, bpm: null, firstBeat: 0, confidence: 'low', pulseScore: 0, onsets: [], activeRanges: [], warnings: [] };
    if (peak < 1e-5) return { ...empty, warnings: ['No usable signal. Choose an audio file that contains music.'] };
    const gate = Math.max(1e-5, peak * .025), activeRanges = [];
    let from = null, last = 0;
    for (let i = 0; i < energy.length; i++) {
      if (energy[i] > gate) { if (from === null) from = i * step; last = Math.min(duration, (i + 1) * step); }
      if (from !== null && (i * step - last > .16 || i === energy.length - 1)) { activeRanges.push({ from, to: last }); from = null; }
    }
    const novelty = new Float32Array(energy.length); let maxNovelty = 0;
    for (let i = 0; i < novelty.length; i++) {
      novelty[i] = Math.max(0, energy[i] - (energy[i - 1] || 0)) + .5 * Math.max(0, low[i] - (low[i - 1] || 0)) + .25 * Math.max(0, high[i] - (high[i - 1] || 0));
      maxNovelty = Math.max(maxNovelty, novelty[i]);
    }
    const floor = Math.max(maxNovelty * .06, median(novelty) * 4, 1e-5), onsets = [];
    for (let i = 0; i < novelty.length; i++) {
      const strength = novelty[i];
      if (strength < floor || energy[i] < gate || strength < (novelty[i - 1] || 0) || strength <= (novelty[i + 1] || 0)) continue;
      const onset = { time: Math.max(0, i * step), strength: strength / maxNovelty,
        low: clamp(low[i] / Math.max(energy[i], 1e-9), 0, 1), high: clamp(high[i] / Math.max(energy[i], 1e-9), 0, 1) };
      const previous = onsets.at(-1);
      if (previous && onset.time - previous.time < .085) { if (onset.strength > previous.strength) onsets[onsets.length - 1] = onset; }
      else onsets.push(onset);
    }
    const result = { ...empty, firstBeat: onsets[0]?.time || activeRanges[0]?.from || 0, onsets, activeRanges };
    if (onsets.length < 6 || onsets.at(-1).time - onsets[0].time < 3) {
      result.warnings.push('Not enough clear attacks to estimate a pulse. Tap a tempo or use the advanced editor.'); return result;
    }
    // Cap the tempo fit workload using evenly spaced attacks, not just the song's intro.
    const strong = onsets.filter(o => o.strength >= .12), source = strong.length >= 6 ? strong : onsets;
    const selected = source.filter((_, i) => i % Math.max(1, Math.ceil(source.length / 1800)) === 0);
    const histogram = new Map();
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < Math.min(i + 9, selected.length); j++) {
        const d = selected[j].time - selected[i].time;
        for (let k = 1; k <= 8; k++) {
          const bpm = 60 * k / d; if (bpm < 55 || bpm > 220) continue;
          const bin = Math.round(bpm * 2) / 2;
          histogram.set(bin, (histogram.get(bin) || 0) + Math.sqrt(selected[i].strength * selected[j].strength) / k);
        }
      }
    }
    const candidates = [...histogram].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([b]) => b);
    function fit(bpm) {
      const period = 60 / bpm;
      let co = 0, si = 0, weight = 0;
      for (const o of selected) { const w = o.strength; co += Math.cos(o.time / period * 2 * Math.PI) * w; si += Math.sin(o.time / period * 2 * Math.PI) * w; weight += w; }
      const coherence = Math.hypot(co, si) / Math.max(weight, 1e-9), phase = ((Math.atan2(si, co) / (2 * Math.PI) * period) % period + period) % period;
      let aligned = 0; const occupied = new Set();
      for (const o of selected) { const beat = Math.round((o.time - phase) / period), error = Math.abs(o.time - phase - beat * period); if (error < Math.min(.075, period * .16)) { aligned += o.strength; occupied.add(beat); } }
      const span = Math.max(1, (selected.at(-1).time - selected[0].time) / period), coverage = Math.min(1, occupied.size / span);
      return { bpm, phase, coherence, coverage, score: .6 * coherence + .25 * aligned / weight + .15 * coverage };
    }
    let best = { score: 0 };
    for (const bpm of candidates) for (let d = -.5; d <= .50001; d += .05) {
      if (bpm + d < 55 || bpm + d > 220) continue;
      const f = fit(bpm + d); if (f.score > best.score) best = f;
    }
    if (best.score < .48) { result.warnings.push('The pulse is uncertain. Tap a tempo; this track may have soft attacks or changing tempo.'); return result; }
    result.bpm = Math.round(best.bpm * 100) / 100;
    result.pulseScore = Math.round(best.score * 1000) / 1000;
    result.confidence = best.score >= .8 && onsets.length >= 12 ? 'high' : 'medium';
    const period = 60 / result.bpm;
    result.firstBeat = Math.max(0, best.phase + Math.ceil((onsets[0].time - .075 - best.phase) / period) * period);
    // Confidence is a heuristic, NOT a calibrated probability or a downbeat detector.
    result.warnings.push('Estimated pulse, not an identified bar downbeat. Use half/double tempo or Tap BPM when it feels wrong.');
    return result;
  }
  function eventsFor(result, { roles = ['drums'], density = 'medium', bpm = result.bpm, firstBeat = result.firstBeat, useGrid = false } = {}) {
    const types = ['drums', 'keys', 'guitar', 'bass'];
    if (!roles.length || roles.some(r => !types.includes(r)) || new Set(roles).size !== roles.length) throw Error('Choose at least one instrument.');
    if (!['easy', 'medium', 'full'].includes(density) || !Number.isFinite(bpm) || bpm < 20 || bpm > 400 || !Number.isFinite(firstBeat) || firstBeat < 0 || firstBeat >= result.duration) throw Error('Set a valid tempo and first beat before building.');
    const beat = 60 / bpm, pitches = { drums: 36, keys: 60, guitar: 40, bass: 28 };
    let events = result.onsets;
    if (useGrid) {
      events = [];
      const step = beat / (density === 'full' ? 2 : 1);
      for (let t = firstBeat; t < result.duration - .02; t += step) {
        if (result.activeRanges.some(r => t >= r.from - .04 && t <= r.to + .04)) events.push({ time: t, strength: 1, low: 1, high: 0 });
      }
    }
    if (!events.length) throw Error('No usable rhythmic attacks. Try tapping the pulse or a different section of the song.');
    return types.map(type => {
      if (!roles.includes(type)) return { type, notes: [] };
      const gap = Math.max(.1, beat * ({ easy: 1.4, medium: .7, full: .3 }[density]) * (type === 'bass' ? 1.4 : 1));
      const picked = [];
      for (const e of events) {
        if (e.time + .02 > result.duration) continue;
        const last = picked.at(-1);
        if (last && e.time - last.time < gap) { if (e.strength > last.strength * 1.5) picked[picked.length - 1] = e; }
        else picked.push(e);
      }
      return { type, notes: picked.map(e => ({ time: Math.round(e.time * 1e6) / 1e6, duration: Math.min(.07, result.duration - e.time), pitch: pitches[type], velocity: clamp(Math.round(65 + 50 * e.strength), 1, 127) })) };
    });
  }
  return { STEP, MAX_SECONDS, envelopeBuilder, envelopeFromChannels, analyzeEnvelope, eventsFor, cancelled };
});

(function (root) {
  'use strict';
  if (typeof module === 'object' && module.exports) return;
  const A = root.StageSongAnalysis;
  class Job {
    constructor() { this.stopped = false; this.worker = null; this.reject = null; this.url = null; this.timer = null; this.backend = 'cooperative'; }
    cleanup() { clearTimeout(this.timer); this.worker?.terminate(); this.worker = null; if (this.url) URL.revokeObjectURL(this.url); this.url = null; this.reject = null; }
    cancel() { this.stopped = true; const reject = this.reject; this.cleanup(); reject?.(A.cancelled()); }
    async run(buffer, progress = () => {}) {
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
      const builder = A.envelopeBuilder(channels, buffer.sampleRate);
      while (!builder.step(100)) {
        if (this.stopped) throw A.cancelled();
        progress(.1 + builder.progress * .6, 'Reading rhythmic energy…');
        await new Promise(r => setTimeout(r, 0));
      }
      if (this.stopped) throw A.cancelled();
      progress(.75, 'Estimating pulse and attacks…');
      const envelope = builder.result();
      // Worker support is an optimization, not a dependency. A blocked worker has a bounded fallback.
      try {
        if (typeof Worker === 'undefined') throw Error('Worker not available');
        this.url = URL.createObjectURL(new Blob([A.workerSource()], { type: 'text/javascript' }));
        this.worker = new Worker(this.url); this.backend = 'worker';
        return await new Promise((resolve, reject) => {
          this.reject = reject;
          this.timer = setTimeout(() => reject(Error('Worker timed out')), 15000);
          this.worker.onmessage = e => e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result);
          this.worker.onerror = e => { e.preventDefault(); reject(Error('Worker failed')); };
          // Keep the small envelope for fallback; never transfer the original playback buffer.
          this.worker.postMessage(envelope);
        });
      } catch (e) {
        if (this.stopped || e.name === 'AbortError') throw A.cancelled();
        this.backend = 'cooperative'; this.cleanup();
        await new Promise(r => setTimeout(r, 0));
        if (this.stopped) throw A.cancelled();
        return A.analyzeEnvelope(envelope);
      } finally { this.cleanup(); }
    }
  }
  A.Job = Job;
})(globalThis);

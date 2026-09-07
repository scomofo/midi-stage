/* MIDI Stage application. Local-only, dependency-free browser build. */
(function(){
  'use strict';
  const C=StageCore,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=t=>{t=Math.max(0,Math.floor(t));return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;};
  const icons={drums:'◉',keys:'▥',guitar:'ϟ',bass:'≋'};
  const storage={get(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch(_){return fallback;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}};
  const saved=storage.get('midi-stage-settings-v1',{});
  const players=C.defaults().map(p=>{const old=saved.players?.find(x=>x.id===p.id);if(!old)return p;return {...p,enabled:!!old.enabled,device:typeof old.device==='string'?old.device:'any',channel:C.clamp(Number(old.channel)||0,0,16),mode:old.mode==='exact'?'exact':'pitch',learned:old.learned&&typeof old.learned==='object'?Object.fromEntries(Object.entries(old.learned).filter(([n,l])=>Number(n)>=0&&Number(n)<128&&Number.isInteger(l)&&l>=0&&l<12)): {}};});
  if(!players.some(p=>p.enabled))players[0].enabled=true;
  const state={songs:[C.makeSong(0),C.makeSong(1),C.makeSong(2)],song:null,players,status:'ready',position:0,speed:1,difficulty:'standard',judges:new Map(),charts:new Map(),feedback:new Map(),flashes:new Map(),particles:[],devices:[],demo:false,assisted:false,learn:null,from:0,to:0,loops:0,buffer:null,bufferName:'',minVelocity:C.clamp(Number(saved.minVelocity)||12,1,127),inputOffset:C.clamp(Number(saved.inputOffset)||0,-500,500),monitor:saved.monitor!==false,lastInput:new Map(),activeTokens:new Map(),pedals:new Map(),deferred:new Map(),keyDown:new Set(),calibration:null,startLock:false};
  state.song=state.songs[0];
  const audio=new StageAudio.AudioEngine();
  let toastTimer=0,raf=0,view={w:900,h:430,dpr:1},lastHud=0,lastCount='',calTimer=0,loopTimer=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hub=new StageMIDI.MIDIHub({onMessage:handleMIDI,onDevices:updateDevices,onDisconnect:id=>{if(state.status==='playing'&&players.some(p=>p.enabled&&(p.device===id||p.device==='any'))){pauseGame('An instrument disconnected. Reconnect it, then resume.');}releaseDevice(id);}});
  const soundcheck=new StageSoundcheck.Controller({getContext:async()=>{await audio.init();return audio.ctx;},beforeOpen:()=>{if(state.status==='starting')return false;if(state.status==='playing')pauseGame('Paused for soundcheck.');},onMIDI:openSetup,getMIDI:()=>state.devices});
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5000);}
  function persist(){storage.set('midi-stage-settings-v1',{players:players.map(({id,enabled,device,channel,mode,learned})=>({id,enabled,device,channel,mode,learned})),minVelocity:state.minVelocity,inputOffset:state.inputOffset,monitor:state.monitor});}
  function enabled(){return players.filter(p=>p.enabled);}
  function bestKey(){return ['midi-stage-best-v1',state.song.id,state.difficulty,state.speed,enabled().map(p=>`${p.id}:${p.source}:${p.mode}`).join('|')].join('/');}
  function resetReady(message){
    clearTimeout(loopTimer);audio.stop();state.status='ready';state.position=0;state.demo=false;state.assisted=false;state.loops=0;state.activeTokens.clear();state.pedals.clear();state.deferred.clear();state.keyDown.clear();state.feedback.clear();state.particles=[];state.from=0;state.to=state.song.duration;
    rebuildCharts();setControls();$('stageOverlay').hidden=false;$('countdown').innerHTML='';lastCount='';$('runStatus').textContent=message||'Ready when you are.';updateHUD();
  }
  function rebuildCharts(){state.charts.clear();state.judges.clear();for(const p of enabled()){const chart=C.makeChart(state.song,p,state.from,state.to);state.charts.set(p.id,chart);state.judges.set(p.id,new C.Judge(chart,{difficulty:state.difficulty,speed:state.speed,drums:p.type==='drums',mode:p.mode,onJudge:r=>feedback(p.id,r)}));}renderPads();}
  function renderSetlist(){
    $('songCount').textContent=`${String(state.songs.length).padStart(2,'0')} TRACKS`;
    $('setlist').innerHTML=state.songs.map((s,i)=>`<button class="song-card ${s===state.song?'selected':''}" data-song="${esc(s.id)}" aria-pressed="${s===state.song}"><span class="song-art a${Math.min(i,3)}" aria-hidden="true">${['≋','◒','ϟ','♫'][Math.min(i,3)]}</span><span><strong>${esc(s.name)}</strong><small>${s.bpm} BPM &nbsp;·&nbsp; ${fmt(Math.ceil(s.duration))}</small></span><span class="song-indicator" aria-hidden="true">${s===state.song?'●':'›'}</span></button>`).join('');
    $('setlist').querySelectorAll('button').forEach(b=>b.onclick=()=>selectSong(state.songs.find(s=>s.id===b.dataset.song)));
  }
  function renderBand(){
    $('bandPick').innerHTML=players.map(p=>`<button class="part-toggle" data-part="${p.id}" aria-pressed="${p.enabled}" title="${p.enabled?'Remove':'Add'} ${p.label} player"><span class="part-icon" aria-hidden="true">${icons[p.type]}</span>${p.label}<span class="tick" aria-hidden="true">${p.enabled?'✓':'＋'}</span></button>`).join('');
    $('bandPick').querySelectorAll('button').forEach(b=>b.onclick=()=>{const p=players.find(p=>p.id===b.dataset.part);if(p.enabled&&enabled().length===1)return toast('Keep at least one player in your lineup.');p.enabled=!p.enabled;persist();renderBand();resetReady('Lineup updated. Start a fresh set.');});
    $('stageMode').innerHTML=`<i></i> ${enabled().length===1?'SOLO SESSION':`${enabled().length}-PLAYER BAND`}`;
  }
  function selectSong(song){
    state.song=song;state.buffer=null;state.bufferName='';$('audioFile').value='';$('clearAudio').hidden=true;$('audioStatus').textContent='MIDI tracks are synthesized locally. Optional audio must match your chart; it is not automatically transcribed or aligned.';
    if(song.original){players.forEach(p=>p.source=p.type);}else{
      const drums=song.parts.find(p=>p.channel===10),melodic=song.parts.filter(p=>p.channel!==10);
      players.forEach(p=>{p.source=p.type==='drums'?(drums||song.parts[0]).id:(melodic.find(t=>t.name.toLowerCase().includes(p.type))||melodic[0]||song.parts[0]).id;p.enabled=drums?p.type==='drums':p.type==='keys';});
    }
    $('songTitle').textContent=song.name;$('songTag').textContent=`${song.original?'ORIGINAL SESSION':'YOUR COLLECTION'} / ${song.tag}`;$('bpmLabel').innerHTML=`${song.bpm} <small>${song.tempoMap.length>1?'BPM*':'BPM'}</small>`;$('bpmLabel').title=song.tempoMap.length>1?'Initial tempo. Tempo changes are preserved.':'';$('durationLabel').textContent=fmt(Math.ceil(song.duration));$('loopStart').value=0;$('loopEnd').value=Math.min(song.duration,Math.round(32*60/song.bpm*10)/10);$('loop').checked=false;renderSetlist();renderBand();resetReady();
  }
  function renderPads(){
    $('pads').innerHTML=enabled().map(p=>{const chart=state.charts.get(p.id);return `<div class="pad-group"><span class="pad-group-name">${p.label.toUpperCase()}</span>${chart.lanes.map((l,i)=>`<button class="pad" data-player="${p.id}" data-lane="${i}" style="--pad-color:${l.color}" aria-label="Play ${p.label} ${esc(l.name)}; keyboard ${C.keyLabel(C.KEYS[p.id][i])}"><span>${esc(l.short)}</span><kbd>${esc(C.keyLabel(C.KEYS[p.id][i]))}</kbd></button>`).join('')}</div>`;}).join('');
    $('pads').querySelectorAll('.pad').forEach(b=>{const p=players.find(p=>p.id===b.dataset.player),lane=Number(b.dataset.lane),token=`touch:${p.id}:${lane}`;b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);ensureAudio();inputHit(p,lane,state.charts.get(p.id).lanes[lane].pitch,token,105,performance.now(),true);};b.onpointerup=b.onpointercancel=()=>inputRelease(p,token,performance.now());});
  }
  async function ensureAudio(){try{await audio.init();}catch(e){toast(e.message);}}
  function setControls(){
    const playing=state.status==='playing',paused=state.status==='paused',busy=playing||paused||state.status==='starting';
    $('start').disabled=playing||state.status==='starting';$('start').innerHTML=paused?'▶ &nbsp; Resume':'▶ &nbsp; Start set';$('pause').disabled=!playing;$('demo').disabled=busy;
    ['difficulty','speed','guide','metronome','loop','loopStart','loopEnd','audioOffset','audioButton','clearAudio'].forEach(id=>$(id).disabled=busy);
    $('speedBadge').textContent=`${state.speed.toFixed(2)}× TEMPO`;
  }
  function range(){if(!$('loop').checked)return {from:0,to:state.song.duration};const from=Number($('loopStart').value),to=Number($('loopEnd').value);if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to>state.song.duration+.05||to-from<1)throw Error(`Choose a loop at least one second long, within 0–${state.song.duration.toFixed(1)} seconds.`);return {from,to:Math.min(to,state.song.duration)};}
  async function startSession(demo=false,loopRestart=false){
    if(state.startLock||state.status==='playing')return;state.startLock=true;
    try{
      const resume=state.status==='paused'&&!demo;
      if(!resume){const r=range();state.from=r.from;state.to=r.to;state.position=r.from;state.demo=demo;state.assisted=false;if(!loopRestart)state.loops=0;rebuildCharts();state.feedback.clear();state.particles=[];}
      if(![...state.judges.values()].some(j=>j.notes.length))throw Error('This section has no notes for your lineup. Choose another MIDI track in Instrument setup.');
      const conflicts=C.routingConflicts(players);if(conflicts.length&&!demo)toast(`${conflicts.join('; ')}. Use Instrument setup to give players separate devices or channels.`);
      state.status='starting';setControls();await audio.begin({song:state.song,players,speed:state.speed,seek:state.position,end:state.to,countIn:true,guide:$('guide').checked,demo:state.demo,metronome:$('metronome').checked,buffer:state.buffer,audioOffset:Number($('audioOffset').value)||0});
      state.status='playing';$('stageOverlay').hidden=true;$('runStatus').textContent=state.demo?'DEMO · Autoplay · Scores are not saved':$('loop').checked?`Loop practice · Pass ${state.loops+1}`:'Count in, then make it yours.';setControls();
    }catch(e){state.status='ready';audio.stop();setControls();toast(e.message||'The set could not start.');}finally{state.startLock=false;}
  }
  function pauseGame(message='Paused. Press Enter or Resume to continue.'){
    if(state.status!=='playing')return;state.position=C.clamp(audio.songAt(),state.from,state.to);state.status='paused';audio.stop();
    // A paused hold earns no unplayed sustain bonus. The run becomes practice-only.
    for(const j of state.judges.values())for(const n of [...j.activeHolds]){n.hold='paused';j.activeHolds.delete(n);j.held.delete(n.token);state.assisted=true;}
    state.activeTokens.clear();state.pedals.clear();state.deferred.clear();state.keyDown.clear();$('countdown').innerHTML='Ⅱ<small>PAUSED</small>';$('runStatus').textContent=message;setControls();
  }
  function feedback(id,result){
    const time=performance.now()/1000;state.feedback.set(id,{...result,until:time+.64});
    if(result.note&&['perfect','great','good'].includes(result.grade)){flash(id,result.note.lane);if(!reduced)for(let i=0;i<5;i++)state.particles.push({id,lane:result.note.lane,created:time,vx:(i-2)*26,vy:-55-(i%3)*20,color:state.charts.get(id).lanes[result.note.lane].color});}
    if(state.particles.length>120)state.particles.splice(0,state.particles.length-120);
  }
  function flash(id,lane){state.flashes.set(`${id}:${lane}`,performance.now()/1000+.14);const b=$('pads').querySelector(`[data-player="${id}"][data-lane="${lane}"]`);if(b){b.classList.add('flash');setTimeout(()=>b.classList.remove('flash'),120);}}
  function timeAt(stamp){return state.status==='playing'?audio.songAt(stamp)-state.inputOffset/1000*state.speed:state.position;}
  function inputHit(p,lane,pitch,token,velocity,stamp,arcade=false){
    if(lane<0||lane>=state.charts.get(p.id)?.lanes.length)return;flash(p.id,lane);let matched=null;
    if(state.status==='playing'&&!state.demo&&!$('setupDialog').open&&!$('calibrationDialog').open){const t=timeAt(stamp);if(t>=state.from-.2*state.speed&&t<=state.to+.2*state.speed)matched=state.judges.get(p.id)?.hit(t,{lane,pitch,token,arcade});}
    if((state.monitor||arcade)&&!state.demo)audio.monitor(token,p.type,pitch,velocity,matched?matched.duration/state.speed:1.7);
    state.activeTokens.set(token,{player:p.id,pitch,lane});
  }
  function inputRelease(p,token,stamp){state.judges.get(p.id)?.release(token,timeAt(stamp));audio.release(token);state.activeTokens.delete(token);}
  function releaseDevice(device){for(const [token,value]of [...state.activeTokens])if(token.includes(`|${device}:`))inputRelease(players.find(p=>p.id===value.player),token,performance.now());}
  function handleMIDI(event){
    soundcheck.receiveMIDI(event);
    if(event.kind==='on'){
      $('lastMIDI').textContent=`${C.noteName(event.note)} · note ${event.note} · ch ${event.channel} · velocity ${event.velocity}`;$('velocityBar').style.width=`${event.velocity/127*100}%`;
      if(event.velocity<state.minVelocity)return;
      if(state.calibration){calibrationTap(event.timestamp);return;}
      if(state.learn){const p=players.find(p=>p.id===state.learn.id);p.learned[event.note]=state.learn.lane;p.device=event.device;p.channel=event.channel;state.learn=null;persist();renderSetup();$('learnStatus').textContent=`Mapped ${p.label} to note ${event.note}, channel ${event.channel}.`;return;}
      const prev=state.lastInput.get(event.token);if(prev!==undefined&&event.timestamp-prev>=0&&event.timestamp-prev<16)return;state.lastInput.set(event.token,event.timestamp);
    }
    for(const p of enabled()){
      if(!C.routes(p,event.device,event.channel))continue;const route=`${p.id}|${event.device}:${event.channel}`,token=`${p.id}|${event.token}`;
      if(event.kind==='cc'){
        if(event.controller===64&&p.type!=='drums'){
          state.pedals.set(route,event.value>=64);
          if(event.value<64){for(const tok of state.deferred.get(route)||[])inputRelease(p,tok,event.timestamp);state.deferred.delete(route);}
        }else if(event.controller===120||event.controller===123){
          state.pedals.delete(route);state.deferred.delete(route);for(const tok of [...state.activeTokens.keys()])if(tok.startsWith(route+':'))inputRelease(p,tok,event.timestamp);
        }continue;
      }
      if(event.kind==='off'){
        if(state.pedals.get(route)&&p.type!=='drums'){if(!state.deferred.has(route))state.deferred.set(route,new Set());state.deferred.get(route).add(token);}else inputRelease(p,token,event.timestamp);
      }else{
        state.deferred.get(route)?.delete(token);
        // Repeated same-note Note On releases the preceding voice before retriggering.
        if(state.activeTokens.has(token))inputRelease(p,token,event.timestamp);
        const lanes=state.charts.get(p.id)?.lanes;if(!lanes)continue;const lane=C.laneForPitch(event.note,p,lanes);inputHit(p,lane,event.note,token,event.velocity,event.timestamp);
      }
    }
  }
  function updateDevices(devices){
    state.devices=devices;$('midiStatus').textContent=devices.length?`${devices.length} MIDI input${devices.length===1?'':'s'} connected`:'Keyboard ready';$('midiDot').classList.toggle('connected',devices.length>0);$('connectMIDI').innerHTML=devices.length?'⌁ &nbsp; MIDI connected':'⌁ &nbsp; Connect MIDI';$('inputMode').textContent=devices.length?'LIVE MIDI INPUT / KEYBOARD BACKUP':'COMPUTER KEYBOARD / MIDI';
    soundcheck.updateMIDI();if($('setupDialog').open)renderSetup();
  }
  function renderSetup(){
    const conflicts=C.routingConflicts(players);$('routeWarning').hidden=!conflicts.length;$('routeWarning').textContent=`${conflicts.join('. ')}. This sends the same input to multiple parts. Select separate devices or channels.`;
    $('routeSettings').innerHTML=players.map(p=>{
      const lanes=C.lanesFor(state.song,p),missing=p.device!=='any'&&!state.devices.some(d=>d.id===p.device);
      return `<section class="route-card"><div class="route-title"><strong>${icons[p.type]} &nbsp; ${p.label} <span style="color:var(--dim);font-size:10px;font-weight:400">${p.enabled?'IN YOUR LINEUP':'NOT PLAYING'}</span></strong><button data-reset="${p.id}">Reset mapping</button></div><div class="route-fields"><label>MIDI INPUT<select data-route="device" data-player="${p.id}"><option value="any" ${p.device==='any'?'selected':''}>Any MIDI input</option>${state.devices.map(d=>`<option value="${esc(d.id)}" ${p.device===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}${missing?`<option selected value="${esc(p.device)}">Saved device (disconnected)</option>`:''}</select></label><label>INPUT CHANNEL<select data-route="channel" data-player="${p.id}">${Array.from({length:17},(_,i)=>`<option value="${i}" ${p.channel===i?'selected':''}>${i===0?'Any channel':`Channel ${i}`}</option>`).join('')}</select></label><label>SONG TRACK<select data-route="source" data-player="${p.id}">${state.song.parts.map(s=>`<option value="${esc(s.id)}" ${C.sourceFor(state.song,p).id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>MATCHING<select data-route="mode" data-player="${p.id}" ${p.type==='drums'?'disabled':''}><option value="pitch" ${p.mode==='pitch'?'selected':''}>Arcade / any octave</option><option value="exact" ${p.mode==='exact'?'selected':''}>Exact MIDI pitch</option></select></label></div><div class="mapping-pads">${lanes.map((l,i)=>{const custom=Object.entries(p.learned).filter(([,v])=>v===i).map(([n])=>n);return `<button class="learn-button ${state.learn?.id===p.id&&state.learn?.lane===i?'learning':''}" data-learn="${p.id}" data-lane="${i}" style="--pad-color:${l.color}">${esc(l.name)}<small>${custom.length?'MIDI '+custom.join(', '):p.type==='drums'?'MIDI '+l.notes.join(','):'e.g. '+C.noteName(l.pitch)}</small></button>`;}).join('')}</div><p class="route-note">${p.type==='drums'?'General MIDI drum map by default. Learn a lane to bind its physical pad.':'Arcade matches the displayed pitch class or learned lane; Exact requires the authored MIDI note number.'} Learn also binds the device and channel. Computer keyboard always uses lane assist.</p></section>`;
    }).join('');
    $('routeSettings').querySelectorAll('[data-route]').forEach(el=>el.onchange=()=>{const p=players.find(p=>p.id===el.dataset.player),field=el.dataset.route;p[field]=field==='channel'?Number(el.value):el.value;if(field==='device'&&el.value!=='any')p.channel=0;if(field==='source')p.learned={};persist();resetReady('Instrument setup changed. Ready for a fresh set.');renderSetup();});
    $('routeSettings').querySelectorAll('[data-learn]').forEach(el=>el.onclick=()=>{state.learn={id:el.dataset.learn,lane:Number(el.dataset.lane)};renderSetup();$('learnStatus').textContent='Listening… play the pad/key to assign. Click Done to cancel.';if(!state.devices.length)toast('Connect MIDI first, then play the instrument you want to map.');});
    $('routeSettings').querySelectorAll('[data-reset]').forEach(el=>el.onclick=()=>{players.find(p=>p.id===el.dataset.reset).learned={};state.learn=null;persist();renderSetup();toast('Default lane mappings restored.');});
    $('minVelocity').value=state.minVelocity;$('inputOffset').value=state.inputOffset;$('monitor').checked=state.monitor;
  }
  function openSetup(){if(state.status==='playing')pauseGame();renderSetup();$('setupDialog').showModal();}
  function closeDialog(id){$(id).close();if(id==='setupDialog'){state.learn=null;persist();}if(id==='calibrationDialog')stopCalibration();}
  function updateHUD(){
    const judges=[...state.judges.values()],score=judges.reduce((a,j)=>a+j.stats.score,0),combo=judges.reduce((a,j)=>a+j.stats.combo,0),den=judges.reduce((a,j)=>a+j.stats.perfect+j.stats.great+j.stats.good+j.stats.miss+j.stats.extra,0),accuracy=den?judges.reduce((a,j)=>a+j.stats.weight,0)/den*100:null;
    $('score').textContent=String(score).padStart(6,'0').replace(/\B(?=(\d{3})+(?!\d))/g,',');$('combo').innerHTML=`${combo} <small>NOTES</small>`;$('multiplier').innerHTML=`${judges.length===1?judges[0].multiplier:Math.min(...judges.map(j=>j.multiplier))}<small>×</small>`;$('multiplier').title=judges.length>1?'Lowest active player multiplier. Each player scores independently.':'';$('accuracy').innerHTML=`${accuracy===null?'—':accuracy.toFixed(0)}<small>%</small>`;const personalBest=storage.get(bestKey(),0);$('best').textContent=personalBest?personalBest.toLocaleString():'—';
    const t=state.status==='playing'?audio.songAt():state.position,progress=C.clamp((t-state.from)/(state.to-state.from||1),0,1);$('progressFill').style.width=`${progress*100}%`;$('elapsed').textContent=fmt(Math.max(state.from,t));$('remaining').textContent=fmt(Math.ceil(Math.max(0,state.to-Math.max(state.from,t))));
  }
  function finishSession(){
    if(state.status!=='playing')return;state.position=state.to;state.status='complete';audio.stop();$('countdown').innerHTML='';
    const results=enabled().map(p=>({player:p,...state.judges.get(p.id).finish(state.to+.25*state.speed)}));
    const total=results.reduce((a,r)=>a+r.score,0),counts={perfect:0,great:0,good:0,miss:0,extra:0,holdBreaks:0,weight:0};for(const r of results)for(const k of Object.keys(counts))counts[k]+=r[k];const den=counts.perfect+counts.great+counts.good+counts.miss+counts.extra,acc=den?100*counts.weight/den:0;
    if($('loop').checked&&!state.demo){state.loops++;$('runStatus').textContent=`Loop ${state.loops}: ${Math.round(acc)}% accuracy. Starting next pass…`;state.status='ready';setControls();updateHUD();loopTimer=setTimeout(()=>startSession(false,true),600);return;}
    const old=storage.get(bestKey(),0),eligible=!state.demo&&!state.assisted&&!$('loop').checked,newBest=eligible&&total>old;
    if(newBest)storage.set(bestKey(),total);
    $('resultEyebrow').textContent=state.demo?'AUTOPLAY DEMO · NO SCORE SAVED':newBest?'NEW PERSONAL BEST':eligible?'SET COMPLETE':'PRACTICE RUN · NO SCORE SAVED';$('resultTitle').textContent=state.demo?'Now make it yours.':acc>=90?'You found your groove.':acc>=65?'The band is warming up.':'Every great set starts here.';
    $('resultContent').innerHTML=`<div class="result-score">${total.toLocaleString()}</div><div class="result-subtitle">${esc(state.song.name)} · ${state.difficulty} · ${Math.round(state.speed*100)}% tempo · ${enabled().length} player${enabled().length===1?'':'s'}</div><div class="result-grid"><div><span>ACCURACY</span><strong>${acc.toFixed(1)}%</strong></div><div><span>PERFECT HITS</span><strong>${counts.perfect}</strong></div><div><span>MISSED NOTES</span><strong>${counts.miss}</strong></div><div><span>EXTRA HITS</span><strong>${counts.extra}</strong></div></div><table class="result-table"><thead><tr><th>PLAYER</th><th>SCORE</th><th>BEST STREAK</th><th>ACCURACY</th><th>EARLY RELEASES</th></tr></thead><tbody>${results.map(r=>`<tr><td>${r.player.label}</td><td>${r.score.toLocaleString()}</td><td>${r.maxCombo}</td><td>${r.accuracy.toFixed(1)}%</td><td>${r.holdBreaks}</td></tr>`).join('')}</tbody></table><p class="result-advice">${state.demo?'This was autoplay, not a recorded player performance. Connect your instrument or use the on-screen keyboard controls to play for real.':acc<60?'Try Chill timing or 75% tempo, and loop a short section. Accuracy includes misses and extra mapped hits; sustained notes earn a completion bonus.':'Accuracy weights Perfect / Great / Good at 100% / 75% / 40%, and includes misses and extra mapped hits. Each instrument has its own streak and multiplier.'}</p>`;
    $('resultsDialog').showModal();$('runStatus').textContent=state.demo?'Demo complete. Your turn.':'Set complete. Play it again or change your lineup.';setControls();updateHUD();
  }
  // Render a perspective highway per active instrument, using the audible audio clock.
  const canvas=$('stageCanvas'),ctx=canvas.getContext('2d');
  function resize(){const rect=canvas.getBoundingClientRect();view={w:rect.width,h:rect.height,dpr:Math.min(2,window.devicePixelRatio||1)};canvas.width=Math.round(view.w*view.dpr);canvas.height=Math.round(view.h*view.dpr);}
  new ResizeObserver(resize).observe(canvas);
  function poly(points,fill,stroke,width=1){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}}
  function text(s,x,y,size,color,align='center',weight='500'){ctx.font=`${weight} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(s,x,y);}
  function render(t,now){
    const {w,h,dpr}=view;if(!w||!h)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#070d16');bg.addColorStop(.5,'#0b1825');bg.addColorStop(1,'#09121c');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w*.5,h*.12,0,w*.5,h*.12,w*.63);glow.addColorStop(0,'#33625c22');glow.addColorStop(1,'#18345300');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    for(let i=0;i<10;i++){const x=w*(i/9);poly([[w*.5+(i-4.5)*13,38],[x-20,h],[x+30,h]],i%2?'#609fc004':'#70d8b104');}
    ctx.strokeStyle='#65828d13';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(0,64+i*7);ctx.lineTo(w,64+i*7);ctx.stroke();}
    for(let i=0;i<34;i++){const x=((i*137+59)%997)/997*w,y=47+(i*47%113);ctx.fillStyle=i%4===0?'#73a4a44d':'#5f82982e';ctx.fillRect(x,y,i%4===0?2:1,1);}
    const active=enabled(),pw=w/active.length,hit=h-87,far=82,look=2.65*state.speed;
    const geom=new Map();
    active.forEach((p,pi)=>{
      const chart=state.charts.get(p.id),judge=state.judges.get(p.id);if(!chart)return;const lanes=chart.lanes,n=lanes.length,cx=pw*(pi+.5),bw=Math.min(active.length===1?640:500,pw*(active.length===1?.84:.91)),tw=bw*.37;
      const point=(lane,progress)=>{const f=C.clamp(progress,-.1,1.2),depth=Math.pow(Math.max(0,f),1.65),width=tw+(bw-tw)*Math.max(0,f);return {x:cx+(lane/n-.5)*width,y:far+(hit-far)*depth,width};};
      const yP=y=>C.clamp((y-t)/look,0,1),progress=nt=>1-(nt-t)/look;
      geom.set(p.id,{point,bw,n,hit,cx});
      text(`${active.length>1?'P'+(pi+1)+' / ':''}${p.label.toUpperCase()}`,cx,57,active.length>2?9:10,'#9bb3bd','center','650');
      if(active.length>1&&state.status==='playing')text(`${judge.stats.combo} STREAK  ·  ${judge.multiplier}×`,cx,72,7,'#62c8b9');
      const tl=point(0,0),tr=point(n,0),bl=point(0,1.12),br=point(n,1.12);
      const trackGradient=ctx.createLinearGradient(0,far,0,hit);trackGradient.addColorStop(0,'#101e2bc9');trackGradient.addColorStop(1,'#12232fef');poly([[tl.x,tl.y],[tr.x,tr.y],[br.x,br.y],[bl.x,bl.y]],trackGradient,'#41637755');
      for(let i=0;i<n;i++){
        const a=point(i,0),b=point(i+1,0),c=point(i+1,1.1),d=point(i,1.1);poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],i%2?'#518dab06':'#030d170c');
        if((state.flashes.get(`${p.id}:${i}`)||0)>now){const aa=point(i,.76),bb=point(i+1,.76);poly([[aa.x,aa.y],[bb.x,bb.y],[c.x,c.y],[d.x,d.y]],lanes[i].color+'1d');}
      }
      for(let i=0;i<=n;i++){const a=point(i,0),b=point(i,1.12);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=i===0||i===n?'#6b9daf5a':'#83b0c01b';ctx.lineWidth=i===0||i===n?1.3:.8;ctx.stroke();}
      const beats=state.song.beats,first=C.lowerBound(beats,t-.15);for(let bi=first;bi<beats.length&&beats[bi].time<t+look;bi++){const pr=progress(beats[bi].time),a=point(0,pr),b=point(n,pr);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=beats[bi].bar?'#82b4c44d':'#81afbe1b';ctx.lineWidth=beats[bi].bar?1.25:.75;ctx.stroke();}
      const a=point(0,1),b=point(n,1);ctx.shadowColor='#62ecd2';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#97dfd3b8';ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
      for(let lane=0;lane<n;lane++){const mid=point(lane+.5,1),lw=bw/n;ctx.beginPath();ctx.ellipse(mid.x,hit,Math.min(lw*.36,31),7,0,0,Math.PI*2);ctx.fillStyle='#101d28';ctx.fill();ctx.strokeStyle=lanes[lane].color+'aa';ctx.lineWidth=1.5;ctx.stroke();text(lanes[lane].short,mid.x,hit+26,active.length>2?6:active.length>1?7:8,lanes[lane].color);if(active.length<3)text(C.keyLabel(C.KEYS[p.id][lane]),mid.x,hit+40,7,'#6d8996');}
      const drawNote=n=>{
        const isHeld=n.hold==='held',pr=isHeld?1:progress(n.time);if(pr<0||pr>1.12)return;if(n.state===1&&!isHeld)return;
        const color=lanes[n.lane].color,pos=point(n.lane+.5,pr),lw=pos.width/lanes.length;
        if(p.type!=='drums'&&n.duration/state.speed>=.35&&n.time+n.duration>t){const tail=point(n.lane+.5,C.clamp(progress(n.time+n.duration),0,1));ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(pos.x,pos.y);ctx.strokeStyle=color+(n.state===2?'20':isHeld?'ba':'52');ctx.lineWidth=Math.max(2,lw*.15);ctx.stroke();}
        const alpha=n.state===2?'30':'e8',nh=Math.max(3,pr*7),hw=lw*.34;ctx.shadowColor=color;ctx.shadowBlur=n.state===2?0:reduced?0:7;
        poly([[pos.x-hw*.93,pos.y-nh/2],[pos.x+hw*.93,pos.y-nh/2],[pos.x+hw,pos.y+nh/2],[pos.x-hw,pos.y+nh/2]],color+alpha,n.state===2?null:color,1);ctx.shadowBlur=0;
        if(pr>.65&&p.mode==='exact'&&p.type!=='drums'&&active.length<3&&lw>22)text(C.noteName(n.pitch),pos.x,pos.y-10,7,color);
      };
      const notes=judge.notes,lo=C.lowerBound(notes,t-.4*state.speed),hi=C.lowerBound(notes,t+look);for(let i=Math.min(hi,lo+1500)-1;i>=lo;i--)drawNote(notes[i]);for(const n of judge.activeHolds)if(n.time<t-.4*state.speed)drawNote(n);
      const f=state.feedback.get(p.id);if(f&&f.until>now){const colors={perfect:'#62ecd2',great:'#8cbcff',good:'#f9bc62',miss:'#ff647c',extra:'#d794a4',release:'#f9bc62'},labels={perfect:'PERFECT',great:'GREAT',good:'GOOD',miss:'MISS',extra:'EXTRA HIT',release:'HOLD TO THE END'};ctx.globalAlpha=C.clamp((f.until-now)*3,0,1);text(labels[f.grade],cx,h*.44,active.length>2?10:active.length>1?15:20,colors[f.grade],'center','750');if(f.note&&['perfect','great','good'].includes(f.grade))text(Math.abs(f.delta)<5?'RIGHT ON TIME':`${Math.abs(Math.round(f.delta))} ms ${f.delta<0?'early':'late'}`,cx,h*.44+21,8,'#9ab4bf');ctx.globalAlpha=1;}
    });
    state.particles=state.particles.filter(p=>now-p.created<.5);if(!reduced)for(const p of state.particles){const g=geom.get(p.id);if(!g)continue;const dt=now-p.created,a=g.point(p.lane+.5,1);ctx.globalAlpha=1-dt*2;ctx.fillStyle=p.color;ctx.fillRect(a.x+p.vx*dt,g.hit+p.vy*dt+80*dt*dt,2.5,2.5);}ctx.globalAlpha=1;
    const vignette=ctx.createLinearGradient(0,0,0,h);vignette.addColorStop(0,'#060d1500');vignette.addColorStop(.89,'#060d1500');vignette.addColorStop(1,'#070f18bb');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }
  function frame(stamp){
    const now=stamp/1000;let t=state.status==='playing'?audio.songAt():state.status==='ready'?.4:state.position;
    if(state.status==='playing'){
      if(audio.ctx.state!=='running'){pauseGame('Audio was interrupted. Press Resume when ready.');t=state.position;}
      else{
        for(const p of enabled()){const j=state.judges.get(p.id);if(state.demo){let i=j.demoCursor||0;while(i<j.notes.length&&j.notes[i].time<=t){const n=j.notes[i++];j.hit(n.time,{lane:n.lane,pitch:n.pitch,token:`demo:${p.id}:${n.id}`});}j.demoCursor=i;}j.tick(t-(state.demo?0:state.inputOffset/1000)*state.speed);}
        const before=state.position-t;if(before>0){const count=Math.ceil(before/(60/state.song.bpm));const s=String(C.clamp(count,1,4));if(s!==lastCount){$('countdown').innerHTML=`${s}<small>${state.demo?'AUTOPLAY DEMO':'COUNT IN'}</small>`;lastCount=s;}}
        else if(lastCount){$('countdown').innerHTML='';lastCount='';}
        const section=[...state.song.sections].reverse().find(s=>s.time<=t);$('sectionName').textContent=state.demo?'AUTOPLAY DEMO':section?.name||'COUNT IN';
        if(t>=state.to+Math.max(.25,state.demo?0:state.inputOffset/1000+.2)*state.speed)finishSession();
      }
    }
    render(t,now);if(stamp-lastHud>90){updateHUD();lastHud=stamp;}
    if(state.calibration){const c=state.calibration,ct=audio.contextAt(),i=Math.round((ct-c.start)/c.interval);$('calibrationPulse').classList.toggle('lit',i>=0&&i<c.total&&Math.abs(ct-(c.start+i*c.interval))<.075);}
    raf=requestAnimationFrame(frame);
  }
  async function beginCalibration(){
    stopCalibration();try{await audio.init();const start=audio.ctx.currentTime+.5,interval=.6,total=16;state.calibration={start,interval,total,taps:[],last:-1};for(let i=0;i<total;i++)audio.click(start+i*interval,i<3);$('calibrationTap').disabled=false;$('calibrationStart').disabled=true;$('calibrationStatus').textContent='Listen to 3 warm-up clicks, then tap 10 times.';calTimer=setTimeout(()=>endCalibration(),(total*interval+.8)*1000);}catch(e){toast(e.message);}
  }
  function calibrationTap(stamp=performance.now()){
    const c=state.calibration;if(!c)return;const t=audio.contextAt(stamp),i=Math.round((t-c.start)/c.interval);if(i<3||i>=c.total||i<=c.last)return;
    const diff=(t-c.start-i*c.interval)*1000;if(Math.abs(diff)>260)return;c.last=i;c.taps.push(diff);$('calibrationStatus').textContent=`${c.taps.length} / 10 taps captured`;if(c.taps.length>=10)endCalibration();
  }
  function endCalibration(){const c=state.calibration;if(!c)return;const taps=[...c.taps];stopCalibration();if(taps.length<6){$('calibrationStatus').textContent='Not enough taps. Try again and begin after the 3 warm-up clicks.';return;}const result=C.calibration(taps);state.inputOffset=C.clamp(result.offset,-500,500);$('inputOffset').value=state.inputOffset;persist();$('calibrationStatus').textContent=`Saved ${state.inputOffset>=0?'+':''}${state.inputOffset} ms correction · ${result.count} taps · ${result.spread} ms variation`;}
  function stopCalibration(){clearTimeout(calTimer);state.calibration=null;audio.stop();$('calibrationTap').disabled=true;$('calibrationStart').disabled=false;$('calibrationPulse').classList.remove('lit');}
  // UI events.
  $('connectMIDI').onclick=async()=>{if(state.status==='playing')pauseGame();try{const devices=await hub.connect();await audio.init();if(devices.length===1&&enabled().length===1&&enabled()[0].device==='any'){enabled()[0].device=devices[0].id;enabled()[0].channel=0;persist();}openSetup();if(!devices.length)toast('MIDI permission granted, but no inputs are connected. Attach your instrument and check its driver.');}catch(e){toast(e.name==='NotAllowedError'?'MIDI permission was denied. Allow MIDI for this site in your browser settings. Keyboard play still works.':e.message);}};
  $('settingsTop').onclick=$('openSetup').onclick=openSetup;
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
  $('setupDialog').addEventListener('close',()=>{state.learn=null;persist();});$('calibrationDialog').addEventListener('close',stopCalibration);
  $('start').onclick=()=>startSession();$('overlayStart').onclick=()=>startSession();$('demo').onclick=()=>startSession(true);$('pause').onclick=()=>pauseGame();$('restart').onclick=()=>{resetReady();startSession();};
  $('difficulty').onchange=()=>{state.difficulty=$('difficulty').value;resetReady();};$('speed').onchange=()=>{state.speed=Number($('speed').value);resetReady();};$('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);
  $('minVelocity').onchange=()=>{state.minVelocity=C.clamp(Number($('minVelocity').value)||1,1,127);$('minVelocity').value=state.minVelocity;persist();};$('inputOffset').onchange=()=>{state.inputOffset=C.clamp(Number($('inputOffset').value)||0,-500,500);$('inputOffset').value=state.inputOffset;persist();};$('monitor').onchange=()=>{state.monitor=$('monitor').checked;persist();};
  $('calibrateButton').onclick=()=>{closeDialog('setupDialog');if(state.status==='playing')pauseGame();$('calibrationDialog').showModal();};$('calibrationStart').onclick=beginCalibration;$('calibrationTap').onclick=()=>calibrationTap();
  $('playAgain').onclick=()=>{closeDialog('resultsDialog');resetReady();startSession();};$('resultSetup').onclick=()=>{closeDialog('resultsDialog');resetReady();openSetup();};
  $('importButton').onclick=()=>{if(state.status==='playing')pauseGame();$('midiFile').click();};
  $('midiFile').onchange=async()=>{const file=$('midiFile').files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('MIDI files must be smaller than 8 MB.');const song=C.parseMIDI(await file.arrayBuffer(),file.name);state.songs=state.songs.filter(s=>s.original||s.id===song.id);if(!state.songs.some(s=>s.id===song.id))state.songs.push(song);else state.songs[state.songs.findIndex(s=>s.id===song.id)]=song;selectSong(song);openSetup();toast(`Imported ${song.parts.length} MIDI part${song.parts.length===1?'':'s'}. Choose a song track for each player.`);}catch(e){toast(e.message);}finally{$('midiFile').value='';}};
  $('audioButton').onclick=()=>$('audioFile').click();$('audioFile').onchange=async()=>{const file=$('audioFile').files[0];if(!file)return;try{if(file.size>80*1024*1024)throw Error('Use a backing audio file smaller than 80 MB.');await audio.init();state.buffer=await audio.ctx.decodeAudioData(await file.arrayBuffer());state.bufferName=file.name;$('audioStatus').textContent=`Backing audio: ${file.name}. Set “Audio starts at” to align it with the MIDI. Tempo changes playback speed and pitch of this audio.`;$('clearAudio').hidden=false;toast('Backing audio loaded locally. It replaces synthesized backing.');}catch(e){toast(`Audio could not be loaded: ${e.message}`);}};
  $('clearAudio').onclick=()=>{state.buffer=null;state.bufferName='';$('audioFile').value='';$('clearAudio').hidden=true;$('audioStatus').textContent='Synthesized backing restored.';};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch(_){toast('Full screen is not available in this browser view.');}};
  function editing(target){return /INPUT|SELECT|TEXTAREA/.test(target.tagName)||target.isContentEditable;}
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(state.status==='playing')pauseGame();return;}
    if($('calibrationDialog').open){if(e.code==='Space'&&!editing(e.target)){e.preventDefault();if(!e.repeat)calibrationTap(e.timeStamp);}return;}
    if(document.querySelector('dialog[open]')||editing(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
    // Native button activation must not also fire a musical shortcut.
    if(e.target.tagName==='BUTTON'&&(e.code==='Enter'||e.code==='Space'))return;
    if(e.code==='Enter'){e.preventDefault();if(e.repeat)return;if(state.status==='playing')pauseGame();else startSession();return;}
    const matches=[];for(const p of enabled()){const lane=C.KEYS[p.id].indexOf(e.code);if(lane>=0&&lane<state.charts.get(p.id).lanes.length)matches.push({p,lane});}
    if(matches.length){e.preventDefault();if(e.repeat||state.keyDown.has(e.code))return;state.keyDown.add(e.code);ensureAudio();for(const {p,lane} of matches)inputHit(p,lane,state.charts.get(p.id).lanes[lane].pitch,`keyboard:${p.id}:${e.code}`,100,e.timeStamp,true);}
    else if(e.code==='KeyR'&&!e.repeat){e.preventDefault();resetReady();startSession();}
  });
  window.addEventListener('keyup',e=>{state.keyDown.delete(e.code);for(const p of enabled())inputRelease(p,`keyboard:${p.id}:${e.code}`,e.timeStamp);});
  window.addEventListener('blur',()=>{if(state.status==='playing')pauseGame('Window lost focus. Press Resume when you are ready.');state.keyDown.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.status==='playing')pauseGame('Playback paused while this tab was hidden.');});
  window.addEventListener('beforeunload',()=>{audio.stop();cancelAnimationFrame(raf);});
  // Read-only diagnostics for tests and troubleshooting. No virtual scores or input backdoors.
  window.MIDIStage={version:'0.2.0',getSnapshot:()=>({status:state.status,song:state.song.id,time:state.status==='playing'?audio.songAt():state.position,demo:state.demo,players:enabled().map(p=>({id:p.id,device:p.device,channel:p.channel,stats:{...state.judges.get(p.id)?.stats},notes:state.judges.get(p.id)?.notes.map(n=>({time:n.time,lane:n.lane,pitch:n.pitch,state:n.state,hold:n.hold}))})),devices:state.devices.map(d=>({...d})),calibration:state.inputOffset,loopCount:state.loops})};
  renderSetlist();renderBand();resetReady();resize();raf=requestAnimationFrame(frame);
})();

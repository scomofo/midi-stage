/* Song Workshop UI: local file imports, arrangement editor, playback and library. */
(function(root){
  'use strict';
  const W=root.StageWorkshop,C=root.StageCore,$=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time=t=>`${Math.floor(Math.max(t,0)/60)}:${(Math.max(t,0)%60).toFixed(1).padStart(4,'0')}`;
  const LABELS={drums:'Drums',keys:'Keyboard',guitar:'Guitar',bass:'Bass'};
  const markup=`
  <dialog id="workshopDialog" class="workshop-dialog" aria-labelledby="workshopTitle">
    <div class="dialog-heading"><div><div class="eyebrow">SONG WORKSHOP / LOCAL FILES → PLAYABLE HIGHWAYS</div><h2 id="workshopTitle">Make it your setlist.</h2></div><button id="wsClose" class="icon-button" aria-label="Close Song Workshop">×</button></div>
    <p class="ws-intro">Drop a song. Find its groove. Play. MP3 highways score rhythm; MIDI highways can score the actual notes.</p>
    <section class="ws-quick-options" aria-label="Quick import settings"><div><strong>Your instruments</strong><div id="wsQuickRoles" class="ws-roles">${C.TYPES.map(type=>`<label class="check"><input type="checkbox" value="${type}" ${type==='drums'?'checked':''}> ${LABELS[type]}</label>`).join('')}</div></div><label>Highway difficulty<select id="wsQuickDensity"><option value="easy">Easy / room to breathe</option><option value="medium" selected>Normal / find the groove</option><option value="full">Busy / more attacks</option></select></label><button id="wsFullBand" class="button secondary small">Full band</button><label class="check"><input id="wsAuto" type="checkbox" checked> Automatically build from MP3 / audio</label><label class="check"><input id="wsAutoChords" type="checkbox" checked> Estimate chord highways for Keys / Guitar</label><label class="check"><input id="wsPopAssist" type="checkbox" checked> I–V–vi–IV assist</label><label>Song key<select id="wsChordKey"><option value="auto" selected>Auto detect</option>${C.PC.map((n,i)=>`<option value="${i}">${n} major</option>`).join('')}</select></label></section>
    <div class="ws-import" id="wsDrop"><div><strong>Drop your MP3 here</strong><span>Or choose WAV, MIDI, or a saved chart. Local files only.</span></div><button id="wsImport" class="button primary">＋ Import song / chart</button><button id="wsEditCurrent" class="button secondary">Edit selected song</button><button id="wsNew" class="button ghost">New blank chart</button><input id="wsFile" type="file" accept=".mid,.midi,.json,.mp3,.wav,.ogg,.flac,.m4a,audio/*" hidden><input id="wsAudioFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a" hidden></div>
    <p id="wsStatus" class="ws-status" role="status">Import a song or start a blank arrangement. Your work stays on this computer.</p>
    <section id="wsAnalysisProgress" class="ws-analysis-progress" aria-label="Song analysis" hidden><div><strong id="wsAnalysisLabel">Reading audio…</strong><button id="wsCancelAnalysis" class="button secondary small">Cancel</button></div><progress id="wsProgress" max="100" value="0" aria-label="Audio analysis progress"></progress><small>Your audio stays here. No account, server upload or model download.</small></section>
    <section id="wsQuickReady" class="ws-quick-ready" hidden aria-labelledby="wsQuickTitle"><div class="ws-quick-heading"><div><div class="eyebrow">AUDIO → RHYTHM HIGHWAY</div><h3 id="wsQuickTitle">Your highway is ready.</h3><p id="wsQuickSummary"></p></div><span id="wsPulseBadge" class="ws-pulse-badge"></span></div><p id="wsQuickScope" class="ws-quick-scope"><strong>Rhythm only:</strong> hit any pad or play any clean single note at each marker. This does not identify the song’s individual instrument notes.</p><div class="ws-quick-visual"><canvas id="wsQuickCanvas" width="920" height="184" role="img" aria-label="Generated rhythm markers and waveform, first twelve seconds"></canvas><p class="ws-small" id="wsQuickWindow">First twelve seconds · markers show timing, not instrument pitches</p></div><div class="ws-quick-controls"><label>Estimated pulse (BPM)<input id="wsQuickTempo" type="number" min="20" max="400" step="0.1" value="120"></label><button id="wsHalfTempo" class="button ghost small">½ tempo</button><button id="wsDoubleTempo" class="button ghost small">2× tempo</button><button id="wsQuickTap" class="button secondary small">Tap BPM</button><button id="wsQuickRebuild" class="button secondary small">Rebuild with these settings</button></div><p id="wsQuickHelp" class="ws-small"></p><div class="ws-actions"><button id="wsQuickPreview" class="button secondary">▶ Preview 12 seconds</button><button id="wsQuickStop" class="button ghost">■ Stop preview</button><label class="check"><input id="wsQuickSave" type="checkbox" checked> Save song &amp; audio locally</label><button id="wsQuickPlay" class="button primary">Play now →</button></div></section>
    <details id="wsAdvanced" class="ws-advanced"><summary>Advanced editor · exact timing, MIDI tracks, note editing &amp; library</summary>
    <div class="ws-layout"><aside class="ws-inspector">
      <h3>01 / Song &amp; timing</h3>
      <label>Song title<input id="wsName" maxlength="160" value="Untitled session"></label>
      <div class="ws-pair"><label>Tempo (BPM)<input id="wsBpm" type="number" min="20" max="400" step="0.1" value="120"></label><label>Duration (sec)<input id="wsDuration" type="number" min="0.25" max="3600" step="0.01" value="60"></label></div>
      <div class="ws-pair"><label>First beat (sec)<input id="wsFirstBeat" type="number" min="0" max="3600" step="0.01" value="0"></label><label>Audio starts at (sec)<input id="wsAudioOffset" type="number" min="-120" max="120" step="0.01" value="0"></label></div>
      <div class="ws-actions"><button id="wsTiming" class="button secondary small">Apply timing</button><button id="wsTap" class="button ghost small">Tap BPM</button></div>
      <p class="ws-small" id="wsTempoNote">First beat sets the grid, not the audio start. Timing edits do not move existing notes.</p>
      <div class="ws-audio-box"><strong id="wsAudioName">No backing audio</strong><button id="wsAttach" class="button secondary small">Attach / replace audio</button><button id="wsRemoveAudio" class="button ghost small" hidden>Remove audio</button><label class="check"><input id="wsKeepAudio" type="checkbox" checked> Keep audio in this browser library</label></div>
      <div id="wsMidiPanel" hidden><h3>02 / Assign MIDI tracks</h3><div id="wsTracks"></div><label>Chart density<select id="wsDensity"><option value="full">All notes (original)</option><option value="medium">Medium — thin fast runs</option><option value="easy">Easy — thin fast runs further</option></select></label><label class="check"><input id="wsSingleStrings" type="checkbox"> Reduce guitar/bass to single notes</label><p class="ws-small">Reduction keeps the upper guitar / lower bass chord tone and trims overlaps. Chord mode keeps simultaneous MIDI voicings; live guitar audio scores strum timing, not chord identity.</p><button id="wsBuildMidi" class="button primary small">Build highways from MIDI</button></div>
      <details class="ws-generator" open><summary>02 / Build a beat-practice chart</summary><p class="ws-small"><strong>Not a transcription.</strong> This generates exercises on your BPM grid, not the original song’s drum hits or guitar/bass notes. Edit them below or import a matching MIDI.</p><div id="wsRoles" class="ws-roles">${C.TYPES.map(type=>`<label class="check"><input type="checkbox" value="${type}" ${type==='drums'?'checked':''}> ${LABELS[type]}</label>`).join('')}</div><label>Pattern density<select id="wsPattern"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="full">Busy</option></select></label><div class="ws-roots">${['keys','guitar','bass'].map(type=>`<label>${LABELS[type]} practice pitch<select id="wsRoot-${type}">${Array.from({length:88},(_,i)=>i+21).map(p=>`<option value="${p}" ${p==={keys:60,guitar:40,bass:28}[type]?'selected':''}>${C.noteName(p)} · ${p}</option>`).join('')}</select></label>`).join('')}</div><button id="wsGenerate" class="button secondary small">Generate selected highways</button></details>
    </aside><section class="ws-editor">
      <div class="ws-editor-heading"><div><h3>03 / Shape the highway</h3><p class="ws-small">Click a blank cell to add a note; click a note to select it. Edit exact pitch, timing and sustain underneath.</p></div><div class="ws-actions"><button id="wsUndo" class="icon-button" aria-label="Undo chart edit" disabled>↶</button><button id="wsRedo" class="icon-button" aria-label="Redo chart edit" disabled>↷</button></div></div>
      <div class="ws-tabs" id="wsTabs">${C.TYPES.map(type=>`<button data-ws-role="${type}" aria-pressed="${type==='drums'}">${LABELS[type]} <span>0</span></button>`).join('')}</div>
      <div class="ws-editor-tools"><label>Snap<select id="wsSnap"><option value="0">Off</option><option value="1">Beat</option><option value="2" selected>½ beat</option><option value="4">¼ beat</option></select></label><label>View<select id="wsSpan"><option value="4">4 seconds</option><option value="8" selected>8 seconds</option><option value="16">16 seconds</option><option value="32">32 seconds</option></select></label><label>Lowest pitch<input id="wsLow" type="number" min="0" max="116" value="48"></label><button id="wsQuantize" class="button ghost small">Snap this part</button></div>
      <canvas id="wsCanvas" width="840" height="382" role="img" tabindex="0" aria-label="Editable note timeline. Use the note form below as an alternative to clicking the canvas."></canvas>
      <div class="ws-position"><button id="wsPrev" class="icon-button" aria-label="Previous timeline page">‹</button><input id="wsViewStart" type="range" min="0" max="60" step="0.1" value="0" aria-label="Timeline view start"><button id="wsNext" class="icon-button" aria-label="Next timeline page">›</button><output id="wsViewLabel">0:00.0 – 0:08.0</output></div>
      <div class="ws-note-form"><label>Time (sec)<input id="wsNoteTime" type="number" min="0" step="0.001" value="0"></label><label id="wsPitchLabel">Pitch / drum<select id="wsPitch"></select></label><label>Length (sec)<input id="wsLength" type="number" min="0.02" step="0.01" value="0.1"></label><label>Velocity<input id="wsVelocity" type="number" min="1" max="127" value="100"></label></div>
      <div class="ws-actions"><button id="wsAdd" class="button secondary small">Add note</button><button id="wsUpdate" class="button secondary small" disabled>Update selected</button><button id="wsDelete" class="button ghost small" disabled>Delete selected</button><button id="wsClearPart" class="button ghost small">Clear this part</button></div>
      <label class="ws-note-list">Notes in this window (first 200)<select id="wsNoteList"><option value="">Select a note to edit</option></select></label>
      <div class="ws-preview"><button id="wsPreview" class="button primary small">▶ Preview from view</button><button id="wsStop" class="button secondary small" disabled>■ Stop</button><label class="check"><input id="wsClick" type="checkbox" checked> Beat click</label><button id="wsTapNote" class="button ghost small" disabled>Add note at playhead</button><output id="wsClock">0:00.0</output></div>
      <p class="ws-small">Preview uses the backing file when attached, otherwise synthesized chart notes. “Add note at playhead” uses the pitch and length above. T also places a note while previewing (outside text fields).</p>
      <div id="wsReview" class="ws-review"></div>
      <section class="ws-library"><div class="ws-editor-heading"><h3>Your local songs</h3><button id="wsRefresh" class="button ghost small">Refresh library</button></div><div id="wsLibrary">No saved songs yet.</div><p class="ws-small">Browser storage can be cleared. Export a chart backup; JSON exports contain notes and timing, not the audio file.</p></section>
    </section></div>
    </details>
    <div class="dialog-footer ws-footer"><span id="wsSaveState">Unsaved draft · no audio uploads</span><div><button id="wsExport" class="button secondary">Export chart JSON</button><button id="wsSave" class="button secondary">Save to library</button><button id="wsPlay" class="button primary">Use highways in game →</button></div></div>
  </dialog>`;
  class Controller{
    constructor({beforeOpen=()=>{},getSelected=()=>null,onPublish=()=>{},onLibrary=()=>{},onDelete=()=>{},onPlay=()=>{}}={}){
      this.onPlay=onPlay;this.analysis=null;this.analysisJob=null;this.analysisBackend=null;this.chordCache=null;this.lastAuto=null;this.quickTaps=[];this.beforeOpen=beforeOpen;this.getSelected=getSelected;this.onPublish=onPublish;this.onLibrary=onLibrary;this.onDelete=onDelete;
      document.body.insertAdjacentHTML('beforeend',markup);this.dialog=$('workshopDialog');this.library=new W.Library();this.history=new W.History(W.empty());this.role='drums';this.selected=null;this.viewStart=0;this.span=8;this.buffer=null;this.blob=null;this.midi=null;this.routes={};this.wave=[];this.taps=[];this.generation=0;this.busy=false;this.preview=new StageAudio.AudioEngine();this.previewEnd=0;this.raf=0;this.dirty=true;
      this.bind();this.bindQuick();this.render();this.refreshLibrary().catch(e=>this.status(e.message));
    }
    get project(){return this.history.current;}
    status(message){$('wsStatus').textContent=message;}
    open(){if(this.beforeOpen()===false)return;this.dialog.showModal();this.render();}
    commit(project){this.stop();this.history.set(project);this.selected=null;this.dirty=true;this.render();}
    replace(project,buffer=null,blob=null){this.stop();this.analysis=null;this.chordCache=project.chordHighways?{events:project.chordHighways.guitar?.length?project.chordHighways.guitar:project.chordHighways.keys||[],bpm:project.bpm,firstBeat:project.firstBeat}:null;this.lastAuto=null;this.history=new W.History(project);this.selected=null;this.viewStart=0;this.buffer=buffer;this.blob=blob;this.dirty=true;this.makeWave();this.fitPitch();this.render();}
    async task(action){if(this.busy)return;const ticket=++this.generation;this.busy=true;this.renderBusy();try{await action(ticket);}catch(e){if(ticket===this.generation)this.status(e.message||'That action could not be completed.');}finally{if(ticket===this.generation){this.busy=false;this.renderBusy();}}}
    valid(ticket){return ticket===this.generation&&this.dialog.open;}
    renderBusy(){this.dialog.querySelectorAll('input,select').forEach(el=>{el.disabled=this.busy;});$('wsLow').disabled=this.busy||this.role==='drums';this.dialog.querySelectorAll('button').forEach(b=>{if(!['wsClose','wsCancelAnalysis'].includes(b.id))b.disabled=this.busy;});if(!this.busy){$('wsUpdate').disabled=$('wsDelete').disabled=this.selected===null;$('wsUndo').disabled=!this.history.past.length;$('wsRedo').disabled=!this.history.future.length;$('wsStop').disabled=$('wsTapNote').disabled=!this.preview.running;$('wsQuickStop').disabled=!this.preview.running;$('wsQuickPlay').disabled=!this.project.parts.some(p=>p.notes.length);}}
    bind(){
      $('wsClose').onclick=()=>{this.cancelWork();this.stop();this.dialog.close();};this.dialog.addEventListener('cancel',()=>{this.cancelWork();this.stop();});this.dialog.addEventListener('close',()=>{this.cancelWork();this.stop();});
      document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancelWork();this.stop();}});
      window.addEventListener('beforeunload',()=>{this.cancelWork();this.stop();});
      $('wsImport').onclick=()=>$('wsFile').click();$('wsFile').onchange=()=>{const f=$('wsFile').files[0];if(f)this.task(t=>this.importFile(f,t));$('wsFile').value='';};
      $('wsAttach').onclick=()=>$('wsAudioFile').click();$('wsAudioFile').onchange=()=>{const f=$('wsAudioFile').files[0];if(f)this.task(t=>this.importAudio(f,t,true));$('wsAudioFile').value='';};
      $('wsDrop').ondragover=e=>{e.preventDefault();$('wsDrop').classList.add('dragging');};$('wsDrop').ondragleave=()=>$('wsDrop').classList.remove('dragging');$('wsDrop').ondrop=e=>{e.preventDefault();$('wsDrop').classList.remove('dragging');if(e.dataTransfer.files.length!==1)return this.status('Drop one MIDI, audio or chart file at a time.');this.task(t=>this.importFile(e.dataTransfer.files[0],t));};
      // Keep a file dropped elsewhere in the modal from navigating away.
      this.dialog.addEventListener('dragover',e=>e.preventDefault());this.dialog.addEventListener('drop',e=>e.preventDefault());
      $('wsNew').onclick=()=>{if(!this.discard())return;this.midi=null;$('wsAdvanced').open=true;this.replace(W.empty());this.status('Blank chart ready. Set the tempo and duration, then add notes.');};
      $('wsEditCurrent').onclick=()=>this.task(async ticket=>{if(!this.discard())return;const selection=this.getSelected();if(!selection?.song)return;let project,blob=null,buffer=selection.buffer||null;
        if(selection.song.workshop){const row=await this.library.get(selection.song.libraryId).catch(()=>null);project=selection.project||row?.project||W.fromSong(selection.song,selection.players);blob=row?.blob||null;}else project=W.fromSong(selection.song,selection.players);
        if(!this.valid(ticket))return;project.audioOffset=selection.audioOffset||0;project.audioName=selection.bufferName||project.audioName;this.midi=null;$('wsAdvanced').open=true;this.replace(project,buffer,blob);this.status('Editing a copy of the selected arrangement. Original songs are not overwritten.');});
      $('wsTiming').onclick=()=>this.attempt(()=>this.applyTiming());
      $('wsName').onchange=()=>this.attempt(()=>this.commit({...this.project,title:$('wsName').value}));
      $('wsTap').onclick=()=>{const now=performance.now();if(this.taps.length&&now-this.taps.at(-1)>3000)this.taps=[];this.taps.push(now);this.taps=this.taps.slice(-9);if(this.taps.length>=3){const gaps=this.taps.slice(1).map((t,i)=>t-this.taps[i]);$('wsBpm').value=C.clamp(Math.round(60000/C.median(gaps)*10)/10,20,400);this.status('Tapped tempo shown. Apply timing to update the grid; existing notes stay in place.');}};
      $('wsBuildMidi').onclick=()=>this.attempt(()=>{if(!this.midi)return;if(this.project.parts.some(p=>p.notes.length)&&!confirm('Replace the current highways with notes from the imported MIDI? Undo remains available.'))return;const result=W.fromMIDI(this.midi,this.routes,{density:$('wsDensity').value,singleStrings:$('wsSingleStrings').checked});const p={...result.project,id:this.project.id,title:this.project.title,audioName:this.project.audioName,audioOffset:this.project.audioOffset,duration:Math.max(result.project.duration,this.project.duration)};this.commit(p);this.fitPitch();this.render();this.status(`Highways built from MIDI. ${result.warnings.join(' ')||'Note times, pitches and tempo changes preserved.'}`);});
      $('wsGenerate').onclick=()=>this.attempt(()=>{const roles=[...$('wsRoles').querySelectorAll('input:checked')].map(x=>x.value);if(this.project.parts.some(p=>roles.includes(p.type)&&p.notes.length)&&!confirm('Replace notes in the selected instruments with beat-practice exercises? Other parts will remain.'))return;if(!this.applyTiming())return;this.commit(W.practice(this.project,{roles,density:$('wsPattern').value,roots:Object.fromEntries(['keys','guitar','bass'].map(t=>[t,Number($('wsRoot-'+t).value)]))}));this.status('Beat-practice highways generated. These exercises are NOT transcribed from the audio.');});
      $('wsRemoveAudio').onclick=()=>{this.stop();this.buffer=null;this.blob=null;this.wave=[];this.commit({...this.project,audioName:'',audioOffset:0});};
      $('wsTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{this.role=b.dataset.wsRole;this.selected=null;this.fitPitch();this.render();$('wsPitch').value={drums:36,keys:60,guitar:40,bass:28}[this.role];});
      $('wsLow').onchange=()=>{$('wsLow').value=C.clamp(Math.round(Number($('wsLow').value)||0),0,116);this.draw();};
      $('wsSpan').onchange=()=>{this.span=Number($('wsSpan').value);this.render();};
      $('wsViewStart').oninput=()=>{this.viewStart=Number($('wsViewStart').value);this.draw();this.renderNotes();};
      $('wsPrev').onclick=()=>{this.viewStart=Math.max(0,this.viewStart-this.span);this.render();};$('wsNext').onclick=()=>{this.viewStart=Math.min(Math.max(0,this.project.duration-.02),this.viewStart+this.span);this.render();};
      $('wsCanvas').onclick=e=>this.attempt(()=>this.canvasClick(e));
      $('wsNoteList').onchange=()=>{if($('wsNoteList').value!=='')this.selectNote(Number($('wsNoteList').value));};
      $('wsAdd').onclick=()=>this.attempt(()=>this.writeNote(null));$('wsUpdate').onclick=()=>this.attempt(()=>this.writeNote(this.selected));
      $('wsDelete').onclick=()=>this.attempt(()=>{if(this.selected!==null)this.commit(W.revise(this.project,this.role,this.selected,null));});
      $('wsClearPart').onclick=()=>{if(confirm(`Clear the ${LABELS[this.role]} highway? You can undo this.`))this.commit({...this.project,parts:this.project.parts.map(p=>p.type===this.role?{...p,notes:[]}:p)});};
      $('wsQuantize').onclick=()=>this.attempt(()=>{if(!Number($('wsSnap').value))throw Error('Choose a grid subdivision first.');this.commit(W.quantize(this.project,this.role,Number($('wsSnap').value)));this.status('Note starts snapped to the grid. Sustain lengths preserved where possible.');});
      $('wsUndo').onclick=()=>{this.stop();this.history.undo();this.selected=null;this.dirty=true;this.render();};$('wsRedo').onclick=()=>{this.stop();this.history.redo();this.selected=null;this.dirty=true;this.render();};
      $('wsPreview').onclick=()=>this.task(ticket=>this.startPreview(ticket));$('wsStop').onclick=()=>this.stop();$('wsTapNote').onclick=()=>this.attempt(()=>this.tapNote());
      this.dialog.addEventListener('keydown',e=>{if(e.code==='KeyT'&&this.preview.running&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();this.attempt(()=>this.tapNote());}});
      $('wsSave').onclick=()=>this.task(t=>this.save(t));$('wsRefresh').onclick=()=>this.task(()=>this.refreshLibrary());
      $('wsExport').onclick=()=>this.attempt(()=>{const p=W.validate({...this.project,title:$('wsName').value}),url=URL.createObjectURL(new Blob([W.serialize(p)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=p.title.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)+'.midistage.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.status('Chart exported. Keep the original audio separately; it is not included in JSON.');});
      $('wsPlay').onclick=()=>this.task(async ticket=>{const p=W.validate({...this.project,title:$('wsName').value});if(!p.parts.some(part=>part.notes.length))throw Error('Build a highway or add at least one note before playing.');this.stop();this.onPublish(p,this.buffer);if(this.valid(ticket))this.dialog.close();});
    }
    attempt(action){try{action();}catch(e){this.status(e.message);}}
    discard(){return !this.dirty||!this.project.parts.some(p=>p.notes.length)||confirm('Replace this working draft? Save or export it first to keep it.');}
    applyTiming(){
      const p={...this.project,title:$('wsName').value,bpm:Number($('wsBpm').value),duration:Number($('wsDuration').value),firstBeat:Number($('wsFirstBeat').value),audioOffset:Number($('wsAudioOffset').value)};
      if((p.bpm!==this.project.bpm||p.firstBeat!==this.project.firstBeat)&&p.tempoMap.length){if(!confirm('Replace the imported MIDI tempo grid with a constant BPM grid? Existing note times will not move.'))return false;p.tempoMap=[];p.beats=[];}
      p.beats=p.beats.filter(b=>b.time<=p.duration);p.tempoMap=p.tempoMap.filter(t=>t.time<=p.duration);this.commit(p);return true;
    }
    async importFile(file,ticket){
      if(!this.discard())return;this.stop();this.status(`Reading ${file.name} locally…`);
      if(/\.midi?$/i.test(file.name)){
        if(file.size>8*1024*1024)throw Error('MIDI files must be smaller than 8 MB.');const song=C.parseMIDI(await file.arrayBuffer(),file.name);if(!this.valid(ticket))return;
        const project=W.empty({title:song.name,duration:song.duration,bpm:C.clamp(song.bpm,20,400)});this.midi=song;$('wsAdvanced').open=true;this.routes=W.suggestRoutes(song);this.replace(project);this.status(`Loaded ${song.parts.length} MIDI tracks. Assign them to instruments, then choose Build highways from MIDI.`);
      }else if(/\.json$/i.test(file.name)){
        if(file.size>W.MAX_JSON)throw Error('Chart JSON must be smaller than 12 MB.');const project=W.parse(await file.text());if(!this.valid(ticket))return;this.midi=null;$('wsAdvanced').open=true;this.replace(project);this.status(project.audioName?`Chart imported. Attach “${project.audioName}” to restore the backing audio.`:'Chart imported with all four highways.');
      }else await this.importAudio(file,ticket,false);
    }
    async decode(file){
      if(!file.size||file.size>80*1024*1024)throw Error('Choose a nonempty audio file smaller than 80 MB.');
      await this.preview.init({resume:false});let buffer;try{buffer=await this.preview.ctx.decodeAudioData(await file.arrayBuffer());}catch(_){throw Error('This audio could not be decoded. Try an unprotected MP3 or WAV file. Streaming links are not supported.');}
      if(buffer.duration<.25||buffer.duration>600||buffer.length*buffer.numberOfChannels*4>256*1024*1024)throw Error('Audio must be 0.25–600 seconds and under 256 MB when decoded. Export a shorter section.');return buffer;
    }
    async importAudio(file,ticket,attach){
      this.stop();$('wsAnalysisProgress').hidden=false;$('wsProgress').value=3;$('wsAnalysisLabel').textContent='Decoding local audio…';this.status('Decoding local audio…');
      try{const buffer=await this.decode(file);if(!this.valid(ticket))return;
      const project=attach?W.clone(this.project):W.empty({title:file.name.replace(/\.[^.]+$/,''),duration:buffer.duration});
      project.audioName=file.name;project.duration=attach?Math.max(project.duration,buffer.duration+project.audioOffset):buffer.duration;
      if(!attach&&$('wsAuto').checked){
        let analysis;
        try{analysis=await this.analyzeBuffer(buffer,ticket);}catch(e){if(e.name==='AbortError')return;throw e;}
        if(!this.valid(ticket))return;
        const options=this.quickOptions();let ready=project,chords=[];
        if(analysis.bpm){ready=W.fromAudioAnalysis(project,analysis,options);const chordRoles=options.roles.filter(r=>r==='keys'||r==='guitar');if(chordRoles.length&&$('wsAutoChords').checked){try{chords=await this.estimateChords(buffer,analysis.bpm,analysis.firstBeat,ticket);if(chords.length)ready=W.withChords(ready,chords,chordRoles);}catch(e){if(e.name==='AbortError')return;analysis.warnings.push('Chord estimate was skipped: '+e.message);}}}
        this.midi=null;this.replace(ready,buffer,file);this.analysis=analysis;this.chordCache=chords.length?{events:chords,bpm:analysis.bpm,firstBeat:analysis.firstBeat,assist:$('wsPopAssist').checked,key:$('wsChordKey').value}:null;this.lastAuto=W.serialize(ready);$('wsAdvanced').open=false;
        this.render();this.status(analysis.bpm?`${chords.length?chords.length+' estimated chord changes and ':''}rhythm highways ready. Preview, then Play now.`:'Audio loaded, but the pulse is uncertain. Tap BPM to build a rhythm highway or open the advanced editor.');
      }else{if(!attach)this.midi=null;$('wsAdvanced').open=true;this.replace(project,buffer,file);this.status(attach?'Backing audio attached. Existing notes are unchanged.':'Audio loaded. Set BPM and First beat, then generate a beat-practice chart or place notes manually. Audio is not automatically transcribed.');}
      }finally{if(ticket===this.generation)$('wsAnalysisProgress').hidden=true;}
    }

    cancelWork(){
      this.generation++;this.analysisJob?.cancel();this.analysisJob=null;this.busy=false;
      $('wsAnalysisProgress').hidden=true;this.renderBusy();
    }
    quickOptions(){return {roles:[...$('wsQuickRoles').querySelectorAll('input:checked')].map(e=>e.value),density:$('wsQuickDensity').value};}
    async analyzeBuffer(buffer,ticket){
      if(!this.quickOptions().roles.length)throw Error('Choose at least one instrument above, then import your song.');
      const job=new StageSongAnalysis.Job();this.analysisJob=job;$('wsAnalysisProgress').hidden=false;
      try{return await job.run(buffer,(fraction,label)=>{if(!this.valid(ticket))return;$('wsProgress').value=Math.round(fraction*78);$('wsAnalysisLabel').textContent=label;});}
      finally{if(this.analysisJob===job)this.analysisJob=null;if(ticket===this.generation)this.analysisBackend=job.backend;}
    }
    async estimateChords(buffer,bpm,firstBeat,ticket){
      $('wsAnalysisProgress').hidden=false;$('wsAnalysisLabel').textContent='Estimating chord progression…';$('wsProgress').value=80;
      const key=$('wsChordKey').value==='auto'?null:Number($('wsChordKey').value),events=await StageChords.analyzeBuffer(buffer,{bpm,firstBeat,progressionAssist:$('wsPopAssist').checked,forcedKey:key,progress:f=>{if(this.valid(ticket))$('wsProgress').value=80+Math.round(f*20);},cancelled:()=>!this.valid(ticket)});if(!this.valid(ticket))return [];$('wsAnalysisProgress').hidden=true;return events;
    }
    renderQuick(){
      const p=this.project,total=p.parts.reduce((s,t)=>s+t.notes.length,0),ready=!!this.buffer&&!this.midi;
      $('wsQuickReady').hidden=!ready;if(!ready)return;this.drawQuick();
      const rhythm=p.matching==='rhythm',chords=p.chordHighways?.guitar?.length||p.chordHighways?.keys?.length||0;$('wsQuickScope').textContent=chords?`Estimated chord highway: ${chords} chord changes. Keyboard MIDI requires the displayed chord tones; live guitar scores the strum timing because exact chord recognition is not yet verified. Review uncertain labels.`:rhythm?'Rhythm only: hit any pad or play any clean single note at each marker. This does not identify the song’s individual instrument notes.':total?'Imported arrangement: this chart retains note-pitch / drum-lane matching. Rebuild replaces it with rhythm-only markers after confirmation.':'No rhythm chart yet. Enter or tap a tempo, then rebuild. The resulting markers score timing, not the song’s individual instrument notes.';$('wsPlay').textContent=rhythm?'Load without starting →':'Use highways in game →';
      $('wsQuickTitle').textContent=rhythm&&total?'Your rhythm highway is ready.':this.analysis&&!this.analysis.bpm?'Tap the pulse to finish.':'Backing audio is ready.';
      const chordCount=Math.max(p.chordHighways?.keys?.length||0,p.chordHighways?.guitar?.length||0);$('wsQuickSummary').textContent=`${p.title} · ${time(p.duration)} · ${total} markers · ${p.parts.filter(t=>t.notes.length).length} instrument highways${chordCount?' · '+chordCount+' chord changes':''}`;
      $('wsPulseBadge').textContent=this.analysis?.manual?'Manual pulse':this.analysis?({high:'Strong pulse estimate',medium:'Check the pulse',low:'Needs a tempo'}[this.analysis.confidence]):rhythm?'Saved rhythm chart':'Editable arrangement';
      $('wsPulseBadge').dataset.confidence=this.analysis?.confidence||'medium';
      $('wsQuickTempo').value=this.analysis?.bpm||p.bpm;
      const pop=p.chordHighways?.guitar?.find(c=>c.roman)?.key||p.chordHighways?.keys?.find(c=>c.roman)?.key;$('wsQuickHelp').textContent=(pop?`I–V–vi–IV assist: ${pop} major · labels show Roman numeral + chord name. `:'')+(this.analysis?.warnings.join(' ')||'Preview the alignment. Rebuild analyzes the attached audio only when needed; MIDI and hand-authored notes are not automatic transcriptions.');
    }
    async rebuildQuick(ticket,{grid=false}={}){
      if(!this.buffer)throw Error('Import or attach your audio first.');
      if(this.project.parts.some(p=>p.notes.length)&&W.serialize(this.project)!==this.lastAuto&&!confirm('Replace this edited arrangement with rhythm-only highways? Undo remains available.'))return;
      const bpm=Number($('wsQuickTempo').value),options=this.quickOptions();
      let analysis=this.analysis;
      if(!analysis)analysis=await this.analyzeBuffer(this.buffer,ticket);
      if(!this.valid(ticket))return;
      const firstBeat=Math.min(analysis.firstBeat,this.project.duration-.02);
      const useGrid=grid||analysis.manualGrid||!analysis.bpm;
      let next=W.fromAudioAnalysis(this.project,analysis,{...options,bpm,firstBeat,useGrid}),chords=[];const chordRoles=options.roles.filter(r=>r==='keys'||r==='guitar');
      if(chordRoles.length&&$('wsAutoChords').checked){if(this.chordCache&&Math.abs(this.chordCache.bpm-bpm)<.01&&Math.abs(this.chordCache.firstBeat-firstBeat)<.02&&this.chordCache.assist===$('wsPopAssist').checked&&this.chordCache.key===$('wsChordKey').value)chords=this.chordCache.events;else chords=await this.estimateChords(this.buffer,bpm,firstBeat,ticket);if(!this.valid(ticket))return;if(chords.length){next=W.withChords(next,chords,chordRoles);this.chordCache={events:chords,bpm,firstBeat,assist:$('wsPopAssist').checked,key:$('wsChordKey').value};}}
      this.analysis={...analysis,bpm,manual:analysis.manual||Math.abs((analysis.bpm||0)-bpm)>.01,manualGrid:useGrid};this.commit(next);this.lastAuto=W.serialize(next);$('wsAdvanced').open=false;
      this.status(`${chords.length?chords.length+' chord changes · ':''}${useGrid?'manual-tempo rhythm chart':'attack-based rhythm chart'} ready. Preview, then Play now.`);
    }
    bindQuick(){
      $('wsFullBand').onclick=()=>{$('wsQuickRoles').querySelectorAll('input').forEach(e=>e.checked=true);this.status('Full band selected. Import a song or rebuild to use all four instruments.');};
      $('wsCancelAnalysis').onclick=()=>{this.cancelWork();this.status('Import cancelled. Your previous chart has been kept.');};
      $('wsQuickRebuild').onclick=()=>this.task(t=>this.rebuildQuick(t));
      for(const [id,factor] of [['wsHalfTempo',.5],['wsDoubleTempo',2]])$(id).onclick=()=>{const bpm=Number($('wsQuickTempo').value)*factor;if(bpm<20||bpm>400)return this.status('Tempo must stay between 20 and 400 BPM.');$('wsQuickTempo').value=Math.round(bpm*100)/100;this.task(t=>this.rebuildQuick(t));};
      $('wsQuickTap').onclick=()=>{const now=performance.now();if(now-(this.quickTaps.at(-1)||0)>3000)this.quickTaps=[];this.quickTaps.push(now);this.quickTaps=this.quickTaps.slice(-9);if(this.quickTaps.length<3){this.status('Keep tapping in time with the song.');return;}const gaps=this.quickTaps.slice(1).map((t,i)=>t-this.quickTaps[i]);$('wsQuickTempo').value=C.clamp(Math.round(60000/C.median(gaps)*10)/10,20,400);this.status('Tapped tempo ready. Choose Rebuild with these settings, then preview.');};
      $('wsQuickPreview').onclick=()=>this.task(t=>{this.viewStart=this.project.firstBeat;return this.startPreview(t,12);});
      $('wsQuickStop').onclick=()=>this.stop();
      $('wsQuickPlay').onclick=()=>this.task(async ticket=>{
        const p=W.validate(this.project);if(!p.parts.some(part=>part.notes.length))throw Error('Tap a tempo and build a highway first.');
        this.stop();let warning='';
        if($('wsQuickSave').checked){try{await this.library.save(p,this.blob);if(!this.valid(ticket))return;this.dirty=false;await this.refreshLibrary();}catch(e){warning=`Playing without a saved library copy: ${e.message} Export the chart to keep it.`;}}
        if(!this.valid(ticket))return;
        this.onPublish(p,this.buffer);this.dialog.close();this.onPlay(warning);
      });
    }
    async save(ticket){
      this.stop();const project=W.validate({...this.project,title:$('wsName').value});this.status('Saving to this browser…');
      await this.library.save(project,$('wsKeepAudio').checked?this.blob:null);
      if(!this.valid(ticket))return;this.history.current=project;this.dirty=false;this.render();await this.refreshLibrary();this.status(`Saved “${project.title}” in this browser${project.audioName&&!($('wsKeepAudio').checked&&this.blob)?'; reattach the backing audio when reopening':''}. Export a chart for a portable backup.`);
    }
    async refreshLibrary(){
      const rows=await this.library.list();this.onLibrary(rows.map(row=>row.project));
      $('wsLibrary').innerHTML=rows.length?rows.map(({project:p,hasAudio})=>`<div class="ws-library-row"><div><strong>${esc(p.title)}</strong><small>${p.bpm} BPM · ${time(p.duration)} · ${hasAudio?'audio saved':p.audioName?'reattach audio':'chart only'}</small></div><button class="button secondary small" data-ws-load="${p.id}">Open</button><button class="button ghost small" data-ws-delete="${p.id}" aria-label="Delete ${esc(p.title)} from local library">×</button></div>`).join(''):'No saved songs yet.';
      $('wsLibrary').querySelectorAll('[data-ws-load]').forEach(b=>b.onclick=()=>this.task(async ticket=>{if(!this.discard())return;const row=await this.library.get(b.dataset.wsLoad);if(!row)throw Error('This song was removed from the library.');let buffer=null;if(row.blob)buffer=await this.decode(row.blob);if(!this.valid(ticket))return;this.midi=null;this.replace(row.project,buffer,row.blob);this.dirty=false;this.render();this.status(row.project.audioName&&!buffer?'Chart loaded. Reattach the backing audio.':'Saved song loaded. Edit it or use its highways in the game.');}));
      $('wsLibrary').querySelectorAll('[data-ws-delete]').forEach(b=>b.onclick=()=>this.task(async()=>{if(!confirm('Delete this song and its stored audio from this browser library? Exported files are not affected.'))return;await this.library.remove(b.dataset.wsDelete);this.onDelete(b.dataset.wsDelete);await this.refreshLibrary();this.status('Removed from this browser library.');}));
    }
    async getBacking(id){const row=await this.library.get(id);return row?.blob?this.decode(row.blob):null;}
    fitPitch(){const notes=this.project.parts.find(p=>p.type===this.role).notes;$('wsLow').value=C.clamp(notes.length?Math.min(...notes.slice(0,60000).map(n=>n.pitch)):{keys:48,guitar:40,bass:28,drums:36}[this.role],0,116);}
    render(){
      const p=this.project;$('wsName').value=p.title;$('wsBpm').value=p.bpm;$('wsDuration').value=p.duration;$('wsFirstBeat').value=p.firstBeat;$('wsAudioOffset').value=p.audioOffset;$('wsViewStart').max=Math.max(0,p.duration-.02);$('wsViewStart').value=this.viewStart;
      $('wsAudioName').textContent=this.buffer?p.audioName||'Attached audio':p.audioName?`Reattach: ${p.audioName}`:'No backing audio';$('wsRemoveAudio').hidden=!p.audioName;
      $('wsTempoNote').textContent=p.tempoMap.length?'Imported MIDI tempo changes are preserved. Snap follows its beat markers. Changing BPM replaces that grid, not the note times.':'First beat sets the grid, not the audio start. Timing edits do not move existing notes.';
      $('wsMidiPanel').hidden=!this.midi;if(this.midi){$('wsTracks').innerHTML=this.midi.parts.map(part=>`<label class="ws-track"><span>${esc(part.name)} <small>${part.notes.length} notes</small></span><select data-ws-track="${esc(part.id)}">${['skip',...C.TYPES].map(r=>`<option value="${r}" ${this.routes[part.id]===r?'selected':''}>${LABELS[r]||'Skip track'}</option>`).join('')}</select></label>`).join('');$('wsTracks').querySelectorAll('select').forEach(s=>s.onchange=()=>{this.routes[s.dataset.wsTrack]=s.value;});}
      const totals=W.counts(p);$('wsTabs').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.wsRole===this.role);b.querySelector('span').textContent=totals[b.dataset.wsRole];});
      $('wsLow').disabled=this.role==='drums';const oldPitch=Number($('wsPitch').value)||{drums:36,keys:60,guitar:40,bass:28}[this.role];
      $('wsPitch').innerHTML=this.role==='drums'?C.DRUMS.map(d=>`<option value="${d.pitch}">${d.name} · ${d.pitch}</option>`).join(''):Array.from({length:128},(_,n)=>`<option value="${n}">${C.noteName(n)} · ${n}</option>`).join('');$('wsPitch').value=this.role==='drums'?(C.DRUMS.find(d=>d.notes.includes(oldPitch))?.pitch||36):oldPitch;
      $('wsSaveState').textContent=this.dirty?'Unsaved changes · no audio uploads':'Saved in this browser · local only';
      const warnings=[];for(const part of p.parts.filter(p=>p.type==='guitar'||p.type==='bass')){if(part.notes.length){const error=root.StageStrings.chartError(part.notes,part.type);if(error)warnings.push(error);}}
      const chordCount=Math.max(p.chordHighways?.keys?.length||0,p.chordHighways?.guitar?.length||0);$('wsReview').textContent=`${Object.values(totals).reduce((a,b)=>a+b,0)} notes across ${Object.values(totals).filter(Boolean).length} highways.${chordCount?' '+chordCount+' chord targets.':''} ${p.matching==='rhythm'?'Rhythm only outside chord highways: pitch values are placeholders, not transcribed notes. ':p.origin==='practice'?'Beat-practice exercise, not a transcription. ':''}${warnings.join(' ')}`;
      this.renderNotes();this.draw();this.renderQuick();this.renderBusy();
    }
    renderNotes(){const notes=this.project.parts.find(p=>p.type===this.role).notes;const visible=notes.map((n,i)=>({n,i})).filter(({n})=>n.time>=this.viewStart&&n.time<this.viewStart+this.span).slice(0,200);$('wsNoteList').innerHTML='<option value="">Select a note to edit</option>'+visible.map(({n,i})=>`<option value="${i}" ${this.selected===i?'selected':''}>${n.time.toFixed(3)}s · ${C.noteName(n.pitch)} / ${n.pitch} · ${n.duration.toFixed(2)}s</option>`).join('');}
    selectNote(index){const n=this.project.parts.find(p=>p.type===this.role).notes[index];if(!n)return;this.selected=index;$('wsNoteTime').value=n.time.toFixed(3);$('wsLength').value=n.duration.toFixed(3);$('wsVelocity').value=n.velocity;
      if(this.role==='drums'&&!C.DRUMS.some(d=>d.pitch===n.pitch)){const opt=document.createElement('option');opt.value=n.pitch;opt.textContent=`${C.DRUMS.find(d=>d.notes.includes(n.pitch)).name} · ${n.pitch}`;$('wsPitch').append(opt);}$('wsPitch').value=n.pitch;this.renderNotes();this.renderBusy();this.draw();}
    writeNote(index){const note={time:Number($('wsNoteTime').value),pitch:Number($('wsPitch').value),duration:Number($('wsLength').value),velocity:Number($('wsVelocity').value)};this.commit(W.revise(this.project,this.role,index,note));}
    rows(){return this.role==='drums'?C.DRUMS.map(d=>({pitch:d.pitch,label:d.name,color:d.color,notes:d.notes})):Array.from({length:12},(_,i)=>{const pitch=Number($('wsLow').value)+11-i;return {pitch,label:C.noteName(pitch),color:C.COLORS[C.pc(pitch)],notes:[pitch]};});}
    canvasClick(e){const rect=$('wsCanvas').getBoundingClientRect(),x=(e.clientX-rect.left)*840/rect.width,y=(e.clientY-rect.top)*382/rect.height;
      const hit=this.hitboxes?.findLast(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(hit){this.selectNote(hit.index);return;}
      if(x<86||y<76||y>=350)return;const rows=this.rows(),row=rows[Math.floor((y-76)/(274/rows.length))];if(!row)return;
      const t=W.snap(this.viewStart+(x-86)/742*this.span,this.project,Number($('wsSnap').value)),duration=Math.min(Number($('wsLength').value)||.1,this.project.duration-t);this.commit(W.revise(this.project,this.role,null,{time:t,pitch:row.pitch,duration,velocity:Number($('wsVelocity').value)||100}));$('wsNoteTime').value=t.toFixed(3);$('wsPitch').value=row.pitch;
    }
    makeWave(){this.wave=[];if(!this.buffer)return;const samples=this.buffer.getChannelData(0),step=Math.max(1,Math.ceil(samples.length/2000));for(let i=0;i<samples.length;i+=step){let peak=0;for(let j=i;j<Math.min(samples.length,i+step);j+=Math.max(1,Math.floor(step/32)))peak=Math.max(peak,Math.abs(samples[j]));this.wave.push(peak);}}
    drawQuick(){
      if(!$('wsQuickCanvas')||!this.buffer)return;
      const cv=$('wsQuickCanvas'),ctx=cv.getContext('2d'),p=this.project,w=cv.width,h=cv.height;
      const from=p.firstBeat,span=Math.max(.25,Math.min(12,p.duration-from)),left=80,right=w-16,width=right-left;
      const x=t=>left+(t-from)/span*width,parts=p.parts.filter(part=>part.notes.length);
      ctx.clearRect(0,0,w,h);ctx.fillStyle='#0a1822';ctx.fillRect(0,0,w,h);
      ctx.font='12px system-ui';ctx.textBaseline='middle';ctx.fillStyle='#9bb8c6';ctx.fillText('AUDIO',8,24);
      ctx.fillStyle='#3c7f78';for(let i=0;i<this.wave.length;i++){const t=i/this.wave.length*this.buffer.duration+p.audioOffset,px=x(t);if(px<left||px>right)continue;const a=this.wave[i]*18;ctx.fillRect(px,24-a,Math.max(1,this.buffer.duration/this.wave.length/span*width),a*2);}
      const chordEvents=p.chordHighways?.guitar?.length?p.chordHighways.guitar:p.chordHighways?.keys||[],chordRow=chordEvents.length?22:0,row=Math.min(28,(112-chordRow)/Math.max(1,parts.length)),colors={drums:'#f66b84',keys:'#f6c273',guitar:'#61d9c3',bass:'#69aaff'};
      if(chordEvents.length){ctx.fillStyle='#a9c4ce';ctx.fillText('CHORDS',8,49);for(const c of chordEvents){const x1=x(c.time),x2=x(Math.min(c.time+c.duration,from+span));if(x2<left||x1>right)continue;ctx.fillStyle=c.confidence<.12?'#68515d':'#244d49';ctx.fillRect(Math.max(left,x1),39,Math.max(18,x2-Math.max(left,x1)-2),18);ctx.fillStyle='#e5f7f1';ctx.font='11px system-ui';ctx.fillText((c.roman?c.roman+' ':'')+c.name,Math.max(left+4,x1+4),48);}}
      parts.forEach((part,i)=>{const y=55+chordRow+i*row;ctx.fillStyle='#a9c4ce';ctx.fillText(LABELS[part.type],8,y+row/2);ctx.fillStyle='#243746';ctx.fillRect(left,y+row/2,right-left,1);ctx.fillStyle=colors[part.type];for(const n of part.notes){const px=x(n.time);if(px<left||px>right)continue;ctx.fillRect(px-2,y+4,4,row-7);}});
      if(!parts.length){ctx.fillStyle='#b7cbd1';ctx.fillText('Tap a tempo to build your rhythm markers.',left,94);}
      const position=this.preview.running?this.preview.songAt():from;if(position>=from&&position<=from+span){ctx.strokeStyle='#f3fbf7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(position),4);ctx.lineTo(x(position),h-20);ctx.stroke();}
      ctx.fillStyle='#91b1bc';ctx.fillText(time(from),left,h-9);ctx.fillText(time(from+span),right-44,h-9);
      $('wsQuickWindow').textContent=`${time(from)} – ${time(from+span)} · ${this.preview.running?'Playing preview':'Preview window'} · ${chordEvents.length?'chord labels are local estimates':'markers show timing, not instrument pitches'}`;
    }
    draw(){
      this.drawQuick();
      const cv=$('wsCanvas'),ctx=cv.getContext('2d'),w=840,h=382,left=86,width=742,top=76,height=274,p=this.project,rows=this.rows(),rh=height/rows.length;
      const x=t=>left+(t-this.viewStart)/this.span*width;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080f19';ctx.fillRect(0,0,w,h);ctx.font='11px system-ui';ctx.textBaseline='middle';ctx.fillStyle='#91a6bd';ctx.fillText(this.buffer?'BACKING':'BEAT GRID',9,36);
      if(this.buffer&&this.wave.length){ctx.fillStyle='#367c7e';for(let i=0;i<this.wave.length;i++){const t=i/this.wave.length*this.buffer.duration+p.audioOffset,px=x(t);if(px<left||px>w)continue;const hh=this.wave[i]*26;ctx.fillRect(px,36-hh,Math.max(1,this.buffer.duration/this.wave.length/this.span*width),hh*2);}}
      rows.forEach((r,i)=>{const yy=top+i*rh;ctx.fillStyle=i%2?'#101e2b':'#0d1723';ctx.fillRect(left,yy,width,rh-1);ctx.fillStyle='#b8c7d9';ctx.fillText(r.label,10,yy+rh/2);});
      const beats=W.grid(p);for(const b of beats){if(b.time<this.viewStart||b.time>this.viewStart+this.span)continue;const px=x(b.time);ctx.strokeStyle=b.bar?'#526579':'#26394c';ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,350);ctx.stroke();}
      for(let i=0;i<=8;i++){const t=this.viewStart+i*this.span/8,px=x(t);ctx.fillStyle='#8a9eb4';ctx.fillText(time(t),Math.min(px,w-43),366);}
      this.hitboxes=[];const notes=p.parts.find(q=>q.type===this.role).notes;
      notes.forEach((n,index)=>{if(n.time+n.duration<this.viewStart||n.time>this.viewStart+this.span)return;const row=rows.findIndex(r=>r.notes.includes(n.pitch));if(row<0)return;const xx=Math.max(left,x(n.time)),ww=Math.min(w-xx-2,Math.max(7,x(n.time+n.duration)-xx)),yy=top+row*rh+3;if(ww<=0)return;ctx.fillStyle=rows[row].color;ctx.globalAlpha=index===this.selected?1:.8;ctx.fillRect(xx,yy,ww,rh-6);ctx.globalAlpha=1;if(index===this.selected){ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.strokeRect(xx-1,yy-1,ww+2,rh-4);}this.hitboxes.push({x:xx,y:yy,w:ww,h:rh-6,index});});
      if(this.preview.running){const t=this.preview.songAt(),px=x(t);if(px>=left&&px<=w){ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,8);ctx.lineTo(px,350);ctx.stroke();}$('wsClock').textContent=time(t);}
      $('wsViewLabel').textContent=`${time(this.viewStart)} – ${time(Math.min(p.duration,this.viewStart+this.span))}`;
    }
    async startPreview(ticket,limit=null){
      this.stop();const song=W.toSong(this.project);if(song.audioName&&!this.buffer)this.status('Backing audio is missing. Previewing synthesized chart notes only; attach the audio to hear the song.');
      await this.preview.begin({song,players:[],seek:this.viewStart,end:limit?Math.min(song.duration,this.viewStart+limit):song.duration,countIn:false,guide:true,demo:true,metronome:$('wsClick').checked,buffer:this.buffer,audioOffset:this.project.audioOffset});
      if(!this.valid(ticket)){this.stop();return;}this.previewEnd=limit?Math.min(song.duration,this.viewStart+limit):song.duration;
      const frame=()=>{if(!this.preview.running)return;if(document.hidden||this.preview.ctx.state!=='running'||this.preview.songAt()>=this.previewEnd){this.stop();return;}this.draw();this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);this.renderBusy();
    }
    tapNote(){const t=this.preview.songAt();if(t<0||t>=this.project.duration)return;const at=W.snap(t,this.project,Number($('wsSnap').value));const note={time:at,pitch:Number($('wsPitch').value),duration:Math.min(Number($('wsLength').value)||.1,this.project.duration-at),velocity:Number($('wsVelocity').value)||100};this.history.set(W.revise(this.project,this.role,null,note));this.dirty=true;this.selected=null;this.renderNotes();this.draw();$('wsSaveState').textContent='Unsaved live edits · restart preview to hear updated synthesized notes';}
    stop(){cancelAnimationFrame(this.raf);this.preview.stop();$('wsStop').disabled=$('wsTapNote').disabled=true;$('wsQuickStop').disabled=true;this.drawQuick();}
  }
  W.Controller=Controller;
})(globalThis);

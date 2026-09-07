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
    <p class="ws-intro">MIDI supplies exact notes. Audio supplies the backing track. Build, edit, rehearse, then take it to the stage.</p>
    <div class="ws-import" id="wsDrop"><div><strong>Start with a song</strong><span>Drop MIDI, MP3, WAV or an exported chart here.</span></div><button id="wsImport" class="button primary">＋ Import song / chart</button><button id="wsEditCurrent" class="button secondary">Edit selected song</button><button id="wsNew" class="button ghost">New blank chart</button><input id="wsFile" type="file" accept=".mid,.midi,.json,.mp3,.wav,.ogg,.flac,.m4a,audio/*" hidden><input id="wsAudioFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a" hidden></div>
    <p id="wsStatus" class="ws-status" role="status">Import a song or start a blank arrangement. Your work stays on this computer.</p>
    <div class="ws-layout"><aside class="ws-inspector">
      <h3>01 / Song &amp; timing</h3>
      <label>Song title<input id="wsName" maxlength="160" value="Untitled session"></label>
      <div class="ws-pair"><label>Tempo (BPM)<input id="wsBpm" type="number" min="20" max="400" step="0.1" value="120"></label><label>Duration (sec)<input id="wsDuration" type="number" min="0.25" max="3600" step="0.01" value="60"></label></div>
      <div class="ws-pair"><label>First beat (sec)<input id="wsFirstBeat" type="number" min="0" max="3600" step="0.01" value="0"></label><label>Audio starts at (sec)<input id="wsAudioOffset" type="number" min="-120" max="120" step="0.01" value="0"></label></div>
      <div class="ws-actions"><button id="wsTiming" class="button secondary small">Apply timing</button><button id="wsTap" class="button ghost small">Tap BPM</button></div>
      <p class="ws-small" id="wsTempoNote">First beat sets the grid, not the audio start. Timing edits do not move existing notes.</p>
      <div class="ws-audio-box"><strong id="wsAudioName">No backing audio</strong><button id="wsAttach" class="button secondary small">Attach / replace audio</button><button id="wsRemoveAudio" class="button ghost small" hidden>Remove audio</button><label class="check"><input id="wsKeepAudio" type="checkbox" checked> Keep audio in this browser library</label></div>
      <div id="wsMidiPanel" hidden><h3>02 / Assign MIDI tracks</h3><div id="wsTracks"></div><label>Chart density<select id="wsDensity"><option value="full">All notes (original)</option><option value="medium">Medium — thin fast runs</option><option value="easy">Easy — thin fast runs further</option></select></label><label class="check"><input id="wsSingleStrings" type="checkbox"> Reduce guitar/bass to single notes</label><p class="ws-small">Reduction keeps the upper guitar / lower bass chord tone and trims overlaps. Live audio does not score chords.</p><button id="wsBuildMidi" class="button primary small">Build highways from MIDI</button></div>
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
    <div class="dialog-footer ws-footer"><span id="wsSaveState">Unsaved draft · no audio uploads</span><div><button id="wsExport" class="button secondary">Export chart JSON</button><button id="wsSave" class="button secondary">Save to library</button><button id="wsPlay" class="button primary">Use highways in game →</button></div></div>
  </dialog>`;
  class Controller{
    constructor({beforeOpen=()=>{},getSelected=()=>null,onPublish=()=>{},onLibrary=()=>{},onDelete=()=>{}}={}){
      this.beforeOpen=beforeOpen;this.getSelected=getSelected;this.onPublish=onPublish;this.onLibrary=onLibrary;this.onDelete=onDelete;
      document.body.insertAdjacentHTML('beforeend',markup);this.dialog=$('workshopDialog');this.library=new W.Library();this.history=new W.History(W.empty());this.role='drums';this.selected=null;this.viewStart=0;this.span=8;this.buffer=null;this.blob=null;this.midi=null;this.routes={};this.wave=[];this.taps=[];this.generation=0;this.busy=false;this.preview=new StageAudio.AudioEngine();this.previewEnd=0;this.raf=0;this.dirty=true;
      this.bind();this.render();this.refreshLibrary().catch(e=>this.status(e.message));
    }
    get project(){return this.history.current;}
    status(message){$('wsStatus').textContent=message;}
    open(){if(this.beforeOpen()===false)return;this.dialog.showModal();this.render();}
    commit(project){this.stop();this.history.set(project);this.selected=null;this.dirty=true;this.render();}
    replace(project,buffer=null,blob=null){this.stop();this.history=new W.History(project);this.selected=null;this.viewStart=0;this.buffer=buffer;this.blob=blob;this.dirty=true;this.makeWave();this.fitPitch();this.render();}
    async task(action){if(this.busy)return;const ticket=this.generation;this.busy=true;this.renderBusy();try{await action(ticket);}catch(e){if(ticket===this.generation)this.status(e.message||'That action could not be completed.');}finally{this.busy=false;this.renderBusy();}}
    valid(ticket){return ticket===this.generation&&this.dialog.open;}
    renderBusy(){this.dialog.querySelectorAll('input,select').forEach(el=>{el.disabled=this.busy;});$('wsLow').disabled=this.busy||this.role==='drums';this.dialog.querySelectorAll('button').forEach(b=>{if(b.id!=='wsClose')b.disabled=this.busy;});if(!this.busy){$('wsUpdate').disabled=$('wsDelete').disabled=this.selected===null;$('wsUndo').disabled=!this.history.past.length;$('wsRedo').disabled=!this.history.future.length;$('wsStop').disabled=$('wsTapNote').disabled=!this.preview.running;}}
    bind(){
      $('wsClose').onclick=()=>{this.generation++;this.stop();this.dialog.close();};this.dialog.addEventListener('cancel',()=>{this.generation++;this.stop();});this.dialog.addEventListener('close',()=>{this.generation++;this.stop();});
      document.addEventListener('visibilitychange',()=>{if(document.hidden){this.stop();this.generation++;}});
      window.addEventListener('beforeunload',()=>this.stop());
      $('wsImport').onclick=()=>$('wsFile').click();$('wsFile').onchange=()=>{const f=$('wsFile').files[0];if(f)this.task(t=>this.importFile(f,t));$('wsFile').value='';};
      $('wsAttach').onclick=()=>$('wsAudioFile').click();$('wsAudioFile').onchange=()=>{const f=$('wsAudioFile').files[0];if(f)this.task(t=>this.importAudio(f,t,true));$('wsAudioFile').value='';};
      $('wsDrop').ondragover=e=>{e.preventDefault();$('wsDrop').classList.add('dragging');};$('wsDrop').ondragleave=()=>$('wsDrop').classList.remove('dragging');$('wsDrop').ondrop=e=>{e.preventDefault();$('wsDrop').classList.remove('dragging');if(e.dataTransfer.files.length!==1)return this.status('Drop one MIDI, audio or chart file at a time.');this.task(t=>this.importFile(e.dataTransfer.files[0],t));};
      // Keep a file dropped elsewhere in the modal from navigating away.
      this.dialog.addEventListener('dragover',e=>e.preventDefault());this.dialog.addEventListener('drop',e=>e.preventDefault());
      $('wsNew').onclick=()=>{if(!this.discard())return;this.midi=null;this.replace(W.empty());this.status('Blank chart ready. Set the tempo and duration, then add notes.');};
      $('wsEditCurrent').onclick=()=>this.task(async ticket=>{if(!this.discard())return;const selection=this.getSelected();if(!selection?.song)return;let project,blob=null,buffer=selection.buffer||null;
        if(selection.song.workshop){const row=await this.library.get(selection.song.libraryId).catch(()=>null);project=selection.project||row?.project||W.fromSong(selection.song,selection.players);blob=row?.blob||null;}else project=W.fromSong(selection.song,selection.players);
        if(!this.valid(ticket))return;project.audioOffset=selection.audioOffset||0;project.audioName=selection.bufferName||project.audioName;this.midi=null;this.replace(project,buffer,blob);this.status('Editing a copy of the selected arrangement. Original songs are not overwritten.');});
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
        const project=W.empty({title:song.name,duration:song.duration,bpm:C.clamp(song.bpm,20,400)});this.midi=song;this.routes=W.suggestRoutes(song);this.replace(project);this.status(`Loaded ${song.parts.length} MIDI tracks. Assign them to instruments, then choose Build highways from MIDI.`);
      }else if(/\.json$/i.test(file.name)){
        if(file.size>W.MAX_JSON)throw Error('Chart JSON must be smaller than 12 MB.');const project=W.parse(await file.text());if(!this.valid(ticket))return;this.midi=null;this.replace(project);this.status(project.audioName?`Chart imported. Attach “${project.audioName}” to restore the backing audio.`:'Chart imported with all four highways.');
      }else await this.importAudio(file,ticket,false);
    }
    async decode(file){
      if(!file.size||file.size>80*1024*1024)throw Error('Choose a nonempty audio file smaller than 80 MB.');
      await this.preview.init();let buffer;try{buffer=await this.preview.ctx.decodeAudioData(await file.arrayBuffer());}catch(_){throw Error('This audio could not be decoded. Try an unprotected MP3 or WAV file. Streaming links are not supported.');}
      if(buffer.duration<.25||buffer.duration>600||buffer.length*buffer.numberOfChannels*4>256*1024*1024)throw Error('Audio must be 0.25–600 seconds and under 256 MB when decoded. Export a shorter section.');return buffer;
    }
    async importAudio(file,ticket,attach){
      this.stop();this.status('Decoding local audio…');const buffer=await this.decode(file);if(!this.valid(ticket))return;
      const project=attach?W.clone(this.project):W.empty({title:file.name.replace(/\.[^.]+$/,''),duration:buffer.duration});
      project.audioName=file.name;project.duration=attach?Math.max(project.duration,buffer.duration+project.audioOffset):buffer.duration;
      if(!attach)this.midi=null;this.replace(project,buffer,file);this.status(attach?'Backing audio attached. Adjust Audio starts at to align it with the chart.':'Audio loaded. Set BPM and First beat, then generate a beat-practice chart or place notes manually. Audio is not automatically transcribed.');
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
      $('wsReview').textContent=`${Object.values(totals).reduce((a,b)=>a+b,0)} notes across ${Object.values(totals).filter(Boolean).length} highways. ${p.origin==='practice'?'Beat-practice exercise, not a transcription. ':''}${warnings.join(' ')}`;
      this.renderNotes();this.draw();this.renderBusy();
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
    draw(){
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
    async startPreview(ticket){
      this.stop();const song=W.toSong(this.project);if(song.audioName&&!this.buffer)this.status('Backing audio is missing. Previewing synthesized chart notes only; attach the audio to hear the song.');
      await this.preview.begin({song,players:[],seek:this.viewStart,end:song.duration,countIn:false,guide:true,demo:true,metronome:$('wsClick').checked,buffer:this.buffer,audioOffset:this.project.audioOffset});
      if(!this.valid(ticket)){this.stop();return;}this.previewEnd=song.duration;
      const frame=()=>{if(!this.preview.running)return;if(document.hidden||this.preview.ctx.state!=='running'||this.preview.songAt()>=this.previewEnd){this.stop();return;}this.draw();this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);this.renderBusy();
    }
    tapNote(){const t=this.preview.songAt();if(t<0||t>=this.project.duration)return;const at=W.snap(t,this.project,Number($('wsSnap').value));const note={time:at,pitch:Number($('wsPitch').value),duration:Math.min(Number($('wsLength').value)||.1,this.project.duration-at),velocity:Number($('wsVelocity').value)||100};this.history.set(W.revise(this.project,this.role,null,note));this.dirty=true;this.selected=null;this.renderNotes();this.draw();$('wsSaveState').textContent='Unsaved live edits · restart preview to hear updated synthesized notes';}
    stop(){cancelAnimationFrame(this.raf);this.preview.stop();$('wsStop').disabled=$('wsTapNote').disabled=true;}
  }
  W.Controller=Controller;
})(globalThis);

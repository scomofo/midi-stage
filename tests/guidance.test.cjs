'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../src/guidance.js');
const player={id:'keys',type:'keys',label:'Keyboard'};
const chord=(id,time,pitches=[60,64,67],name='C')=>({id,time,pitches,name,duration:1,chord:true,source:'midi',state:0});
const judge=(notes,mode='exact')=>({notes,mode,chordMode:true,windows:[.045,.09,.14],activeHolds:new Set(),sounding:new Map()});
test('Exact guidance shows authored MIDI register and rejects the same chord in another octave',()=>{
  const m=G.model({judge:judge([chord(1,1)]),player,time:0,activePitches:[48,52,55]});
  assert.deepEqual(m.target.pitchNames,['C4','E4','G4']);assert.equal(m.target.exact,true);
  assert.deepEqual(m.missing,[60,64,67]);assert.deepEqual(m.wrong,[48,52,55]);
  assert.equal(m.keys.find(k=>k.midi===48).wrong,true);assert.match(m.target.voicingLabel,/Required/);
});
test('Arcade guidance accepts another octave while describing the shown voicing as suggested',()=>{
  const m=G.model({judge:judge([chord(1,1)],'pitch'),player,time:0,activePitches:[48,52,55]});
  assert.deepEqual(m.expected,[0,4,7]);assert.deepEqual(m.missing,[]);assert.deepEqual(m.wrong,[]);
  assert.match(m.target.voicingLabel,/Suggested/);assert.equal(m.keys.find(k=>k.midi===60).expected,true);
});
test('missing and wrong tones are reported separately, ignoring duplicate voices',()=>{
  const m=G.model({judge:judge([chord(1,1)]),player,activePitches:[60,60,66]});
  assert.deepEqual(m.sounding,[60,66]);assert.deepEqual(m.missingNames,['E4','G4']);assert.deepEqual(m.wrongNames,['F♯4']);
  assert.equal(m.keys.find(k=>k.midi===60).sounding,true);assert.equal(m.keys.find(k=>k.midi===64).missing,true);
});
test('the current sustain remains visible while the next three chords are previewed',()=>{
  const held={...chord(0,0),duration:2,state:1,hold:'held',matchExact:true};
  const j=judge([held,chord(1,2,[62,65,69],'Dm'),chord(2,3,[64,67,71],'Em'),chord(3,4,[65,69,72],'F'),chord(4,5,[67,71,74],'G')]);j.activeHolds.add(held);
  const m=G.model({judge:j,player,time:1,activePitches:[60,64,67]});
  assert.equal(m.target.id,0);assert.equal(m.target.phase,'hold');assert.deepEqual(m.upcoming.map(n=>n.name),['Dm','Em','F']);
  held.hold='complete';j.activeHolds.clear();assert.equal(G.model({judge:j,player,time:2}).target.id,1);
});
test('completed and expired targets are skipped and mixed single notes remain readable',()=>{
  const j=judge([{...chord(0,0),state:1},chord(1,1),{id:2,time:3,duration:.5,pitch:74,chord:false,state:0},chord(3,4)]);
  const m=G.model({judge:j,player,time:2});assert.equal(m.target.id,2);assert.equal(m.target.name,'D5');assert.deepEqual(m.upcoming.map(n=>n.id),[3]);
});
test('authored hand hints retain their registers without inventing a hand assignment',()=>{
  const target=chord(0,0,[48,55,60,64,67]);target.hint={leftHand:[48,55],rightHand:[60,64,67],text:'Keep the left hand quiet.',section:'Verse',roman:'I'};
  const m=G.model({judge:judge([target]),player});assert.deepEqual(m.target.hints,{left:[48,55],right:[60,64,67],text:'Keep the left hand quiet.',section:'Verse',roman:'I'});
  assert.deepEqual(G.model({judge:judge([chord(0,0)]),player}).target.hints.left,[]);
});
test('piano geometry places black keys between white keys with the E/F and B/C gaps',()=>{
  const m=G.model({judge:judge([chord(0,0)]),player});const key=n=>m.keys.find(k=>k.midi===n);
  assert.equal(key(61).black,true);assert.equal(key(61).x,key(60).x+.69);assert.equal(key(61).width,.62);
  assert.equal(key(65).x,key(64).x+1);assert.equal(key(64).black,false);assert.equal(key(65).black,false);
  assert.equal(m.whiteCount,m.keys.filter(k=>!k.black).length);
});
test('88-key range includes A0 through C8 and does not hide exact MIDI notes outside it',()=>{
  const p={...player,guideRange:'88'},m=G.model({judge:judge([chord(0,0,[60,64,67])]),player:p});
  assert.equal(m.range.low,21);assert.equal(m.range.high,108);assert.deepEqual(m.physicalRange,{low:21,high:108});
  const wide=G.model({judge:judge([chord(0,0,[0,64,127])]),player:p});assert.equal(wide.range.low,0);assert.equal(wide.range.high,127);
  assert.equal(wide.keys.find(k=>k.midi===127).expected,true);assert.equal(wide.keys.find(k=>k.midi===127).outsideRange,true);
});
test('live strum guidance does not claim verified chord identity or missing pitches',()=>{
  const j=judge([chord(0,0)]);j.timingOnly=true;
  const m=G.model({judge:j,player:{id:'guitar',type:'guitar'},activePitches:[40]});assert.equal(m.target.timingOnly,true);assert.deepEqual(m.wrong,[]);assert.deepEqual(m.missing,[]);
  assert.match(m.target.voicingLabel,/strum timing only/);
});
test('estimated targets follow the judge pitch-class policy even when the player selected Exact',()=>{
  const target={...chord(0,0),source:'estimated'},m=G.model({judge:judge([target]),player,activePitches:[48,52,55]});
  assert.equal(m.target.exact,false);assert.deepEqual(m.missing,[]);assert.match(m.target.voicingLabel,/Suggested/);
});
test('models remain deterministic across frames and can read active judge voices',()=>{
  const j=judge([chord(0,2)]);j.sounding.set('one',{pitch:60});
  const first=G.model({judge:j,player,time:.5}),second=G.model({judge:j,player,time:.6});assert.deepEqual(first,second);assert.deepEqual(first.sounding,[60]);
  assert.equal(G.model({judge:{...j,chordMode:false},player}),null);assert.equal(G.model({judge:j,player:{type:'drums'}}),null);
});

// Small DOM double: confirms safe text APIs, panel retention, and render caching.
class Element{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.style={setProperty:(k,v)=>this.style[k]=v};this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this.replacements=(this.replacements||0)+1;}
  setAttribute(k,v){this.attributes[k]=v;}
  set innerHTML(value){throw Error('Unsafe HTML assignment: '+value);}
}
const document={createElement(tag){return new Element(tag,this);}};
test('render preserves all four player panels, uses text safely, and skips unchanged frames',()=>{
  const container=new Element('div',document),models=Array.from({length:4},(_,i)=>G.model({judge:judge([chord(0,1,[60,64,67],'<img src=x>')]),player:{...player,id:'p'+i,label:'Player '+i}}));
  assert.equal(G.render(container,models),true);assert.equal(container.children.length,4);const first=container.children[0];
  assert.equal(first.children.find(n=>n.className==='guide-target').textContent,'<img src=x>');
  assert.equal(G.render(container,models),false);assert.equal(container.replacements,1);assert.equal(container.children[0],first);
  const piano=first.children.find(n=>n.className==='guide-piano-scroll');assert.equal(piano.style.overflowX,'auto');assert.equal(piano.style.maxWidth,'100%');
  models[1]=G.model({judge:judge([chord(0,1)]),player:{...player,id:'p1'},activePitches:[60]});G.render(container,models);assert.equal(container.children[0],first);
});
test('controller displays completed players without disappearing and can clear the guide',()=>{
  const container=new Element('div',document),controller=new G.Controller(container);
  controller.update([{judge:judge([{...chord(0,0),state:1}]),player,time:2}]);assert.equal(container.children.length,1);assert.equal(container.hidden,false);
  controller.clear();assert.equal(container.children.length,0);assert.equal(container.hidden,true);
});
test('a chart within thirty semitones keeps the same keyboard positions across chord changes',()=>{
  const c=chord(0,1,[48,60,64],'C'),g=chord(1,3,[55,67,71],'G'),j=judge([c,g,chord(2,5,[66,74,78],'D')]);
  const first=G.model({judge:j,player,time:0});c.state=1;
  const next=G.model({judge:j,player,time:2});assert.equal(first.rangeMode,'song');assert.equal(next.target.name,'G');
  assert.deepEqual(next.range,first.range);assert.equal(next.keys.find(k=>k.midi===60).x,first.keys.find(k=>k.midi===60).x);
  assert.deepEqual(G.model({judge:j,player,time:2,activePitches:[55,67,71]}).range,first.range);
  assert.deepEqual(G.model({judge:j,player,time:2,activePitches:[first.range.low+1]}).range,first.range);
  const outside=G.model({judge:j,player,time:2,activePitches:[24]});assert.ok(outside.range.low<first.range.low);assert.ok(outside.keys.some(k=>k.midi===24));
});
test('wide charts explicitly label the changing focused register and retain MIDI extremes',()=>{
  const a=chord(0,1,[0,4,7]),b=chord(1,3,[120,124,127]),j=judge([a,b]);
  const low=G.model({judge:j,player,time:0});assert.equal(low.rangeMode,'focused');assert.match(low.rangeLabel,/Focused on current voicing/);assert.equal(low.range.low,0);
  a.state=1;const high=G.model({judge:j,player,time:2});assert.equal(high.range.high,127);assert.ok(high.range.low>low.range.low);
});
test('upcoming authored hand hints are visible before the target arrives',()=>{
  const next=chord(1,3,[55,67,71],'G');next.hint={leftHand:[55],rightHand:[67,71]};
  const container=new Element('div',document),m=G.model({judge:judge([chord(0,1),next]),player});G.render(container,[m]);
  assert.deepEqual(m.upcoming[0].hints.left,[55]);const text=container.children[0].children.find(n=>n.className==='guide-upcoming').textContent;
  assert.match(text,/G \(L G3; R G4\/B4\)/);
});

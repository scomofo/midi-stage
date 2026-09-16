/* Deterministic voicing guidance with a small, cached DOM renderer. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.StageCore);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StageGuidance=api;
})(globalThis,function(C){
  'use strict';
  const BLACK=new Set([1,3,6,8,10]),PHYSICAL_RANGE={low:21,high:108};
  const pitches=values=>[...new Set(Array.from(values||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<=127))].sort((a,b)=>a-b);
  const pitchClasses=values=>[...new Set(values.map(C.pc))].sort((a,b)=>a-b);
  function handHints(target){
    const hint=target?.hint||target?.hints||{},hands=target?.hands||target?.hand||{};
    return {left:pitches(hint.leftHand||hands.left||target?.leftHand),right:pitches(hint.rightHand||hands.right||target?.rightHand),
      text:typeof hint.text==='string'?hint.text:'',section:typeof hint.section==='string'?hint.section:'',roman:typeof hint.roman==='string'?hint.roman:''};
  }
  const authoredRanges=new WeakMap();
  function authoredRange(judge){
    const cached=authoredRanges.get(judge);if(cached?.notes===judge.notes)return cached;
    let low=128,high=-1;
    for(const n of judge.notes||[]){const hint=handHints(n);for(const pitch of pitches([...(n.chord?n.pitches||[]:[n.pitch]),...hint.left,...hint.right])){low=Math.min(low,pitch);high=Math.max(high,pitch);}}
    const result={notes:judge.notes,low,high,stable:high>=low&&high-low<=36};authoredRanges.set(judge,result);return result;
  }
  function keyboardRange(expected,sounding,player,authored){
    const base=authored.stable?[authored.low,authored.high]:expected;
    let low=base.length?Math.min(...base)-3:48,high=base.length?Math.max(...base)+3:72;
    if(player.guideRange==='88'){low=Math.min(PHYSICAL_RANGE.low,...base);high=Math.max(PHYSICAL_RANGE.high,...base);}
    low=C.clamp(low,0,127);high=C.clamp(high,0,127);
    if(BLACK.has(C.pc(low)))low--;if(BLACK.has(C.pc(high)))high++;
    if(sounding.length){const first=sounding[0],last=sounding.at(-1),context=player.guideRange==='88'?0:3;if(first<low)low=first-context;if(last>high)high=last+context;}
    low=C.clamp(low,0,127);high=C.clamp(high,0,127);
    if(BLACK.has(C.pc(low)))low--;if(BLACK.has(C.pc(high)))high++;
    return {low,high};
  }
  function model({judge,player,time=0,activePitches}={}){
    if(!judge?.chordMode||!player||player.type==='drums')return null;
    const sounding=pitches(activePitches===undefined?[...(judge.sounding?.values()||[])].map(v=>v.pitch):activePitches);
    const notes=judge.notes||[],window=judge.windows?.[2]??.14;
    const holds=[...(judge.activeHolds||[])].filter(n=>n.hold==='held'&&n.time+n.duration>=time).sort((a,b)=>b.time-a.time);
    const current=holds[0]||notes.find(n=>!n.state&&n.time+window>=time)||null,phase=holds.length?'hold':'next';
    const exact=!!current&&(typeof current.matchExact==='boolean'&&phase==='hold'?current.matchExact:
      typeof judge.exact==='function'?judge.exact(current):judge.mode==='exact'&&(!current.chord||current.source==='midi'));
    const timingOnly=!!(current?.chord&&judge.timingOnly),voicing=pitches(current?(current.chord?current.pitches:[current.pitch]):[]);
    const expected=exact?voicing:pitchClasses(voicing),heard=exact?sounding:pitchClasses(sounding);
    const missing=timingOnly?[]:expected.filter(n=>!heard.includes(n)),wrong=timingOnly?[]:sounding.filter(n=>!expected.includes(exact?n:C.pc(n)));
    const hints=handHints(current),authored=authoredRange(judge),range=keyboardRange([...voicing,...hints.left,...hints.right],sounding,player,authored);
    const rangeMode=player.guideRange==='88'?'88':authored.stable?'song':'focused';
    const rangeLabel=(rangeMode==='88'?'88-key piano':rangeMode==='song'?'Song register':'Focused on current voicing')+` · ${C.noteName(range.low)}–${C.noteName(range.high)}`;
    let whiteCount=0;const keys=[];
    if(current)for(let midi=range.low;midi<=range.high;midi++){
      const black=BLACK.has(C.pc(midi)),key=exact?midi:C.pc(midi),requested=voicing.includes(midi);
      keys.push({midi,name:C.noteName(midi),black,x:black?whiteCount-.31:whiteCount,width:black?.62:1,
        expected:requested,sounding:sounding.includes(midi),missing:requested&&missing.includes(key),wrong:wrong.includes(midi),
        outsideRange:midi<PHYSICAL_RANGE.low||midi>PHYSICAL_RANGE.high});
      if(!black)whiteCount++;
    }
    const upcoming=notes.filter(n=>n!==current&&n.chord&&!n.state&&n.time>=Math.max(time-window,current?.time??time-window)).slice(0,3)
      .map(n=>({id:n.id,name:n.name||n.pitches.map(C.noteName).join(' + '),time:n.time,hints:handHints(n)}));
    const target=current?{id:current.id,name:current.name||C.noteName(current.pitch),time:current.time,duration:current.duration,
      chord:!!current.chord,phase,exact,timingOnly,pitches:voicing,pitchNames:voicing.map(C.noteName),hints,
      voicingLabel:timingOnly?'Suggested voicing · strum timing only':exact?'Required voicing · Exact MIDI':'Suggested voicing · Arcade / any octave'}:null;
    const result={id:player.id,label:player.label||C.LABELS[player.type]||player.id,target,upcoming,range,rangeMode,rangeLabel,physicalRange:{...PHYSICAL_RANGE},whiteCount,keys,
      expected,sounding,missing,wrong,soundingNames:sounding.map(C.noteName),missingNames:missing.map(n=>exact?C.noteName(n):C.PC[n]),wrongNames:wrong.map(C.noteName),
      status:current?'':notes.length?'Part complete':'No targets in this part'};
    // Time itself is deliberately absent: frames without a target/input change
    // reuse their DOM, including any horizontal keyboard scroll position.
    result.signature=JSON.stringify([result.id,result.label,target,upcoming,range,rangeLabel,sounding,missing,wrong,result.status]);return result;
  }
  const rendered=new WeakMap();
  function render(container,models){
    const list=(models||[]).filter(Boolean),signature=list.map(m=>m.signature).join('\n');
    let cached=rendered.get(container);if(cached?.signature===signature)return false;
    const doc=container.ownerDocument||globalThis.document,next=new Map();
    function element(tag,className,text){const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
    for(const m of list){
      const old=cached?.cards.get(m.id);if(old?.signature===m.signature){next.set(m.id,old);continue;}
      const card=element('section','guide-card');card.setAttribute('aria-label',`${m.label} chord guidance`);card.dataset.player=m.id;
      const heading=element('div','guide-heading');heading.append(element('strong','',m.label),element('span','guide-phase',m.target?.phase==='hold'?'HOLD':m.target?'NEXT':''));card.append(heading);
      if(!m.target){card.append(element('p','guide-target',m.status));next.set(m.id,{signature:m.signature,node:card});continue;}
      const t=m.target;card.append(element('div','guide-target',t.name),element('p','guide-voicing',`${t.voicingLabel}: ${t.pitchNames.join(' · ')}`));
      const hands=[];if(t.hints.left.length)hands.push(`Left: ${t.hints.left.map(C.noteName).join(' · ')}`);if(t.hints.right.length)hands.push(`Right: ${t.hints.right.map(C.noteName).join(' · ')}`);if(t.hints.text)hands.push(t.hints.text);
      if(hands.length)card.append(element('p','guide-hands',hands.join(' | ')));
      const scroll=element('div','guide-piano-scroll'),piano=element('div','guide-piano');scroll.style.overflowX='auto';scroll.style.maxWidth='100%';scroll.style.minWidth='0';
      piano.style.position='relative';piano.style.setProperty('--white-count',String(m.whiteCount));piano.style.width='calc(var(--white-count) * var(--piano-white-width, 24px))';
      piano.setAttribute('role','img');piano.setAttribute('aria-label',`Piano ${C.noteName(m.range.low)} to ${C.noteName(m.range.high)}. ${t.voicingLabel}: ${t.pitchNames.join(', ')}.`);
      for(const k of m.keys){
        const classes=['piano-key',k.black?'black':'white',...['expected','sounding','missing','wrong','outsideRange'].filter(s=>k[s]).map(s=>s==='outsideRange'?'outside-range':s)];
        const key=element('span',classes.join(' '));key.dataset.midi=String(k.midi);key.style.position='absolute';key.style.setProperty('--key-x',String(k.x));key.style.setProperty('--key-width',String(k.width));
        key.style.left='calc(var(--key-x) * var(--piano-white-width, 24px))';key.style.width='calc(var(--key-width) * var(--piano-white-width, 24px))';
        key.title=`${k.name} · MIDI ${k.midi}${k.outsideRange?' · outside an 88-key piano':''}`;
        if(k.expected||k.sounding||C.pc(k.midi)===0)key.append(element('span','piano-note',k.name));piano.append(key);
      }
      scroll.append(piano);card.append(scroll,element('p','guide-range',m.rangeLabel));
      const feedback=t.timingOnly?'Strum timing is scored; chord identity is not checked.':
        `Sounding: ${m.soundingNames.join(' · ')||'—'} | Missing: ${m.missingNames.join(' · ')||'none'}${m.wrong.length?' | Wrong: '+m.wrongNames.join(' · '):''}`;
      card.append(element('p','guide-feedback',feedback));
      if(m.upcoming.length){
        const nextText=m.upcoming.map(n=>{const hands=[];if(n.hints.left.length)hands.push('L '+n.hints.left.map(C.noteName).join('/'));if(n.hints.right.length)hands.push('R '+n.hints.right.map(C.noteName).join('/'));return n.name+(hands.length?' ('+hands.join('; ')+')':'');});
        card.append(element('p','guide-upcoming','Then: '+nextText.join(' → ')));
      }
      const sameRange=old?.range?.low===m.range.low&&old?.range?.high===m.range.high;
      const targetKeys=m.keys.filter(k=>k.expected),center=targetKeys.length?targetKeys.reduce((sum,k)=>sum+k.x+k.width/2,0)/targetKeys.length:0;
      next.set(m.id,{signature:m.signature,node:card,scroll,range:m.range,
        scrollLeft:sameRange&&old.scroll?old.scroll.scrollLeft:null,center,whiteCount:m.whiteCount});
    }
    container.replaceChildren(...[...next.values()].map(entry=>entry.node));container.hidden=!list.length;
    // Keep the player's chosen register while keys light up. Center a newly
    // selected range once, after layout supplies its actual visible width.
    for(const entry of next.values())if(entry.scroll&&entry!==cached?.cards.get(entry.node.dataset.player)){
      const scroll=entry.scroll,width=scroll.firstElementChild?.scrollWidth||entry.whiteCount*24;
      scroll.scrollLeft=entry.scrollLeft??Math.max(0,entry.center/entry.whiteCount*width-(scroll.clientWidth||width)/2);
    }
    rendered.set(container,{signature,cards:next});return true;
  }
  class Controller{
    constructor(container){this.container=container;}
    update(inputs){return render(this.container,inputs.map(input=>model(input)));}
    clear(){return render(this.container,[]);}
  }
  return {PHYSICAL_RANGE,model,render,Controller};
});

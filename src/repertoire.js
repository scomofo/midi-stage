/* Open Stage — an original 90-second, chord-first band arrangement.
   Songwriting: 4/4, C major, 96 BPM. A quiet four-bar introduction establishes
   C–G–Am–F; the verse repeats that phrase before the chorus answers with
   F–C–G–Am. The Dm–Am–F–G bridge suspends the resolution, and a final chorus
   leads to an F–G–C–C ending. Guitar plays a short chord-tone answer; bass and
   drums define the pocket. These are authored parts, not audio transcription.

   The three arrangements share form/harmony and accompaniment. Chill begins
   with two-note open fifths and adds triads in the chorus. Standard introduces
   root-position triads, chorus inversions, and single-note phrase endings.
   Expert uses seventh chords, a separate low root, syncopated attacks, and
   melodic pickups. Each scored hold ends before the next attack. Every part
   is original and can be used with the project's existing license. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./core.js'):root.StageCore,node?require('./chords.js'):root.StageChords);
  if(node)module.exports=api;else root.StageRepertoire=api;
})(globalThis,function(C,X){
  'use strict';
  const ID='open-stage',BPM=96,BEAT=60/BPM;
  const DIFFICULTIES=['chill','standard','expert'];
  const FORM=[
    {name:'INTRO',style:'intro',chords:['C','G','Am','F']},
    {name:'VERSE',style:'verse',chords:['C','G','Am','F','C','G','Am','F']},
    {name:'CHORUS',style:'chorus',chords:['F','C','G','Am','F','C','G','G']},
    {name:'BRIDGE',style:'bridge',chords:['Dm','Am','F','G']},
    {name:'FINAL CHORUS',style:'chorus',chords:['F','C','G','Am','F','C','G','G']},
    {name:'OUTRO',style:'outro',chords:['F','G','C','C']}
  ];
  const HARMONY={
    C:{root:48,triad:[60,64,67],inversion:[60,64,67],rich:[48,60,64,67,71],roman:'I'},
    G:{root:43,triad:[55,59,62],inversion:[59,62,67],rich:[43,59,62,65,67],roman:'V'},
    Am:{root:45,triad:[57,60,64],inversion:[60,64,69],rich:[45,60,64,67,69],roman:'vi'},
    F:{root:41,triad:[53,57,60],inversion:[57,60,65],rich:[41,57,60,64,65],roman:'IV'},
    Dm:{root:50,triad:[62,65,69],inversion:[57,62,65],rich:[50,57,60,62,65],roman:'ii'}
  };
  const DESCRIPTION={
    chill:'Open fifths and easy triads. One chord per bar, two in the chorus.',
    standard:'Triads, smooth inversions, and short single-note turnarounds.',
    expert:'Seventh chords, left-hand roots, syncopation, and melodic pickups.'
  };
  const normalized=d=>DIFFICULTIES.includes(d)?d:'standard';

  function makeSong(difficulty='standard'){
    difficulty=normalized(difficulty);
    const parts=C.TYPES.map((type,i)=>({id:type,name:C.LABELS[type],channel:type==='drums'?10:i,type,notes:[]}));
    const byType=Object.fromEntries(parts.map(p=>[p.type,p]));
    const hints=new Map(),sections=[],harmony=[];
    const add=(type,b,pitch,duration,velocity=90)=>byType[type].notes.push({time:b*BEAT,duration:duration*BEAT,pitch,velocity});
    const addChord=(b,pitches,duration,section,roman)=>{
      for(const pitch of pitches)add('keys',b,pitch,duration,difficulty==='expert'?88:82);
      const low=difficulty==='expert'?1:0;
      hints.set(b*BEAT,{leftHand:pitches.slice(0,low),rightHand:pitches.slice(low),
        text:low?'Left hand: bass note. Right hand: chord.':'Right hand: play the marked keys together.',section,roman});
    };
    let bar=0;
    for(const section of FORM){
      sections.push({time:bar*4*BEAT,name:section.name});
      for(let index=0;index<section.chords.length;index++,bar++){
        const b=bar*4,name=section.chords[index],h=HARMONY[name];
        const finalBar=section.style==='outro'&&index===3;
        const chorus=section.style==='chorus';
        harmony.push({time:b*BEAT,duration:4*BEAT,name,roman:h.roman});

        // First listenable milestone: consistent accompaniment across levels,
        // with a lighter intro/bridge, chorus ride and a deliberate final stop.
        if(finalBar){
          add('drums',b,36,.15,104);add('drums',b,49,1.6,92);
          add('bass',b,h.root-12,3.3,96);add('guitar',b,h.root+12,3.3,78);
        }else{
          const light=section.style==='intro'||section.style==='bridge';
          add('drums',b,36,.12,98);add('drums',b+2,36,.12,94);
          add('drums',b+1,38,.12,light?68:96);add('drums',b+3,38,.12,light?72:99);
          for(let i=0;i<(light?4:8);i++)add('drums',b+i*(light?1:.5),chorus?51:42,.1,i%2?57:73);
          if(index===0)add('drums',b,49,.5,85);
          if(!light&&index===section.chords.length-1)for(let i=0;i<3;i++)add('drums',b+3.25+i*.25,[48,45,43][i],.1,82+i*5);
          add('bass',b,h.root-12,1.7,95);add('bass',b+2,h.root-12,1.15,90);
          if(chorus)add('bass',b+3.5,h.root-5,.35,82);
          // Monophonic root / fifth / third answer; no polyphonic audio-input
          // correctness is implied by the guitar accompaniment.
          const third=name.endsWith('m')?3:4;
          const guitarPitches=[h.root+12,h.root+19,h.root+12+third];
          const offsets=light?[.5,2.5]:[.5,2,3];
          offsets.forEach((offset,i)=>add('guitar',b+offset,guitarPitches[i],light?.7:.6,74+i*4));
        }

        if(finalBar){
          // Resolve the seventh colour to a plain C triad at the ending.
          const ending=difficulty==='expert'?[48,60,64,67]:[60,64,67];
          addChord(b,ending,3.3,section.name,h.roman);continue;
        }
        if(difficulty==='chill'){
          const pitches=chorus?h.triad:[h.root+12,h.root+19];
          const offsets=chorus?[0,2]:[0];
          for(const offset of offsets)addChord(b+offset,pitches,chorus?1.5:3.15,section.name,h.roman);
        }else if(difficulty==='standard'){
          const pitches=chorus?h.inversion:h.triad;
          // The end of each four-bar phrase has a genuine single-note answer.
          const turn=index%4===3&&section.style!=='intro';
          addChord(b,pitches,1.5,section.name,h.roman);
          addChord(b+2,pitches,turn?.7:1.5,section.name,h.roman);
          if(turn){add('keys',b+3,h.root+19,.32,76);add('keys',b+3.5,h.root+21,.32,72);}
        }else{
          const offsets=section.style==='intro'?[0,2.5]:chorus?[0,.75,2,2.75]:[0,1.5,3];
          const turn=index%2===1;
          for(let i=0;i<offsets.length;i++){
            const offset=offsets[i],next=offsets[i+1]??(turn?3.5:4);
            addChord(b+offset,h.rich,Math.min(1.2,next-offset-.2),section.name,h.roman);
          }
          if(turn){
            add('keys',b+3.5,h.root+19,.16,80);
            add('keys',b+3.75,h.root+21,.16,76);
          }
        }
      }
    }
    for(const part of parts)part.notes.sort((a,b)=>a.time-b.time||a.pitch-b.pitch);
    const chordHighways={keys:X.groupNotes(byType.keys.notes).map(event=>({...event,hint:hints.get(event.time)}))};
    const duration=bar*4*BEAT;
    return {id:ID,name:'Open Stage',subtitle:'Your first chord set. Find the pocket, then lift the chorus.',
      tag:'CHORD ROCK',accent:'#f9bc62',bpm:BPM,bars:bar,duration,original:true,parts,chordHighways,
      repertoire:ID,arrangement:difficulty,arrangementDescription:DESCRIPTION[difficulty],key:'C major',
      tempoMap:[{tick:0,time:0,bpm:BPM}],beats:Array.from({length:bar*4+1},(_,i)=>({time:i*BEAT,bar:i%4===0})),
      sections,harmony};
  }
  function resolve(song,difficulty='standard'){
    // Imported and Workshop-edited songs never get replaced by bundled data.
    if(song?.repertoire!==ID||song?.id!==ID)return song;
    return song.arrangement===normalized(difficulty)?song:makeSong(difficulty);
  }
  return {ID,DIFFICULTIES,makeSong,resolve};
});

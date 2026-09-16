/* Deterministic performance feedback; no DOM, audio, persistence or judge writes.
   All functions return new values. Integration:
     let band=createSession(['keys','drums'], {bpm:96});
     band=record(band,'keys','perfect',songTimeSeconds);
     const run=result([{id:'keys', ...judge.finish(end)}], options);
     progress=updateProgress(progress,run);

   Cooperative credit requires EVERY enabled performer to land a good-or-better
   hit in the same four-beat phrase. A phrase pays once; extra hits, missed notes
   and broken holds clear its pending participation. The bonus is separate from
   chartScore and never changes timing accuracy or the underlying judges.

   Result options: songId, difficulty, mode, speed, lineup (stable strings),
   completed, demo, assisted, loop, bandBonus. Progress keeps the newest 20 runs
   and the 50 most recently played identities. Identity includes speed, matching
   mode and lineup, so practice cannot overwrite a harder arrangement's best. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StagePerformance=api;
})(globalThis,function(){
  'use strict';
  const MAX_HISTORY=20,MAX_RECORDS=50;
  const MOVEMENT={perfect:2.4,great:1.6,good:.6,miss:-10,extra:-6,release:-7};
  const POSITIVE=new Set(['perfect','great','good']);
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const finite=(n,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
  const count=n=>Math.max(0,Math.floor(finite(n)));
  const strings=values=>[...new Set((Array.isArray(values)?values:[]).filter(x=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,200)))].sort();

  function createSession(playerIds,{bpm=96}={}){
    bpm=clamp(finite(bpm,96),20,400);
    return {players:strings(playerIds),energy:50,bandBonus:0,bandPhrases:0,lastBonusTime:null,
      phraseSeconds:4*60/bpm,phrase:-1,contributors:[],phraseAwarded:false};
  }
  function record(session,playerId,grade,time){
    if(!session?.players?.includes(playerId)||!Object.hasOwn(MOVEMENT,grade)||!Number.isFinite(time)||time<0)return session;
    const next={...session,contributors:[...session.contributors],energy:clamp(session.energy+MOVEMENT[grade],0,100)};
    const phrase=Math.floor(time/session.phraseSeconds);
    // Calibrated devices may report a slightly older timestamp. Such an event
    // still changes energy, but cannot reopen or pay a completed phrase.
    if(phrase<session.phrase)return next;
    if(phrase!==session.phrase){next.phrase=phrase;next.contributors=[];next.phraseAwarded=false;}
    if(!POSITIVE.has(grade)){next.contributors=[];return next;}
    if(next.players.length<2||next.phraseAwarded)return next;
    if(!next.contributors.includes(playerId))next.contributors.push(playerId);
    if(next.players.every(id=>next.contributors.includes(id))){
      next.phraseAwarded=true;next.bandPhrases++;
      next.bandBonus+=50*next.players.length;next.lastBonusTime=time;
      next.energy=Math.min(100,next.energy+5);
    }
    return next;
  }

  function result(judgeResults,options={}){
    const rows=Array.isArray(judgeResults)?judgeResults:[];
    const songId=typeof options.songId==='string'?options.songId.slice(0,200):'';
    const difficulty=['chill','standard','expert'].includes(options.difficulty)?options.difficulty:'standard';
    const mode=typeof options.mode==='string'&&options.mode?options.mode.slice(0,100):'pitch';
    const speed=finite(options.speed,1);
    const lineup=strings(options.lineup||rows.map((r,i)=>r.id||`player-${i+1}`));
    let targets=0,hits=0,weightedHits=0,extras=0,holds=0,brokenHolds=0,chartScore=0;
    for(const row of rows){
      const perfect=count(row.perfect),great=count(row.great),good=count(row.good),miss=count(row.miss);
      hits+=perfect+great+good;weightedHits+=perfect+.75*great+.4*good;
      targets+=Math.max(count(row.total),perfect+great+good+miss);
      extras+=count(row.extra);holds+=count(row.holds);brokenHolds+=count(row.holdBreaks);
      chartScore+=count(row.score);
    }
    const hitQuality=targets+extras?weightedHits/(targets+extras):0;
    const holdQuality=holds+brokenHolds?holds/(holds+brokenHolds):1;
    const quality=clamp(hitQuality*(.75+.25*holdQuality),0,1);
    const eligible=options.completed===true&&!options.demo&&!options.assisted&&!options.loop
      &&songId.length>0&&targets>0&&hits>0&&speed>0&&lineup.length>0;
    const stars=eligible?[.15,.4,.65,.82,.95].filter(threshold=>quality+1e-9>=threshold).length:0;
    // Arcade, Chill and slowdown still have their own score/star records, but
    // cannot claim full-speed exact-chord mastery.
    const mastered=eligible&&stars===5&&difficulty!=='chill'&&mode==='exact'&&Math.abs(speed-1)<1e-9;
    const identity=JSON.stringify([songId,difficulty,mode,speed,lineup]);
    const bandBonus=count(options.bandBonus);
    return {identity,songId,difficulty,mode,speed,lineup,eligible,stars,mastered,quality,hitQuality,holdQuality,
      targets,hits,holds,brokenHolds,chartScore,bandBonus,totalScore:chartScore+bandBonus};
  }

  function updateProgress(previous,run){
    if(!run?.eligible)return previous||{version:1,history:[],records:{}};
    const safePrevious=previous&&previous.version===1?previous:{};
    const priorRecords=safePrevious.records&&typeof safePrevious.records==='object'?safePrevious.records:{};
    const existing=priorRecords[run.identity];
    const entry={identity:run.identity,songId:run.songId,difficulty:run.difficulty,mode:run.mode,speed:run.speed,
      lineup:[...run.lineup],stars:run.stars,quality:run.quality,mastered:run.mastered,
      chartScore:run.chartScore,bandBonus:run.bandBonus,totalScore:run.totalScore};
    const best={...entry,attempts:Math.min(Number.MAX_SAFE_INTEGER,count(existing?.attempts)+1),
      stars:Math.max(count(existing?.stars),run.stars),quality:Math.max(finite(existing?.quality),run.quality),
      mastered:!!existing?.mastered||run.mastered,
      chartScore:Math.max(count(existing?.chartScore),run.chartScore),
      // A best band score is kept separately from best chart timing score.
      bandBonus:Math.max(count(existing?.bandBonus),run.bandBonus),
      totalScore:Math.max(count(existing?.totalScore),run.totalScore)};
    const records={};
    for(const [key,value] of Object.entries(priorRecords).filter(([key])=>key!==run.identity).slice(-(MAX_RECORDS-1)))records[key]=value;
    records[run.identity]=best;
    return {version:1,history:[...(Array.isArray(safePrevious.history)?safePrevious.history:[]).slice(-(MAX_HISTORY-1)),entry],records};
  }
  return {MAX_HISTORY,MAX_RECORDS,createSession,record,result,updateProgress};
});

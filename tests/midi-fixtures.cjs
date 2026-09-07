'use strict';
const C=require('../src/core.js');
const bytes=(...xs)=>Uint8Array.from(xs.flatMap(x=>Array.from(x)));
const u16=n=>[n>>>8&255,n&255],u32=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255];
const ascii=s=>[...s].map(c=>c.charCodeAt(0));
function vlq(n){n=Math.round(n);const out=[n&127];while((n=Math.floor(n/128))>0)out.unshift((n&127)|128);return out;}
const chunk=(name,data)=>bytes(ascii(name),u32(data.length),data);
function smf(tracks,{format=tracks.length===1?0:1,ppq=480}={}){return bytes(chunk('MThd',bytes(u16(format),u16(tracks.length),u16(ppq))),...tracks.map(t=>chunk('MTrk',t)));}
function meta(type,data){return [255,type,...vlq(data.length),...data];}
function exportSong(song=C.makeSong(0)){
  const ppq=480,beat=60/song.bpm,tempo=Math.round(60e6/song.bpm);
  const tracks=[bytes([0],meta(3,ascii(song.name)),[0],meta(0x51,[(tempo>>>16)&255,(tempo>>>8)&255,tempo&255]),[0,255,0x58,4,4,2,24,8],[0,255,0x2f,0])];
  for(const part of song.parts){const ch={drums:9,keys:0,guitar:1,bass:2}[part.type],events=[];
    for(const n of part.notes){events.push({tick:Math.round(n.time/beat*ppq),data:[0x90|ch,n.pitch,n.velocity],order:1});events.push({tick:Math.round((n.time+n.duration)/beat*ppq),data:[0x80|ch,n.pitch,0],order:0});}
    events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let tick=0,out=[0,...meta(3,ascii(part.name))];for(const e of events){out.push(...vlq(e.tick-tick),...e.data);tick=e.tick;}out.push(0,255,0x2f,0);tracks.push(Uint8Array.from(out));
  }
  return smf(tracks);
}
module.exports={bytes,smf,vlq,meta,exportSong};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');for(let i=0;i<3;i++){const song=C.makeSong(i),p=path.join(__dirname,'../songs',song.id+'.mid');fs.writeFileSync(p,exportSong(song));console.log(p);}}

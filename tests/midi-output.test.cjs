const test=require('node:test');
const assert=require('node:assert/strict');
const {MIDIHub,basePortKey}=require('../src/midi.js');
function access(){const sent=[],out={id:'o1',name:'Stage Synth',manufacturer:'Acme',state:'connected',send:(d,t=0)=>sent.push({d:[...d],t}),clear:()=>sent.push({clear:true})};return {sent,out,access:{inputs:new Map(),outputs:new Map([['o1',out]]),onstatechange:null}};}
test('stable base key uses manufacturer and name',()=>assert.equal(basePortKey({manufacturer:' Acme ',name:' Stage  Synth '}),'acme|stage synth'));
test('output metadata receives stable occurrence key',()=>{const a=access(),h=new MIDIHub();h.access=a.access;assert.equal(h.outputDevices()[0].key,'acme|stage synth#1');});
test('sendKey routes safe messages to output',()=>{const a=access(),h=new MIDIHub();h.access=a.access;h.sendKey('acme|stage synth#1',[0x90,60,100],42);assert.deepEqual(a.sent[0],{d:[0x90,60,100],t:42});});
test('SysEx is blocked even if a port exists',()=>{const a=access(),h=new MIDIHub();h.access=a.access;assert.throws(()=>h.send('o1',[0xf0,1,0xf7]),/SysEx output is disabled/);});
test('panic clears queue and sends sustain off/all notes/all sound for channel',()=>{const a=access(),h=new MIDIHub();h.access=a.access;assert.equal(h.panic('o1',[2]),true);assert.equal(a.sent[0].clear,true);assert.deepEqual(a.sent.slice(1).map(x=>x.d),[[0xb1,64,0],[0xb1,123,0],[0xb1,120,0]]);});

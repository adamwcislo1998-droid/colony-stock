import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateAnimal,filterAnimals} from '../dist/core.mjs';
import {validateEventDates,recoveryPreview,recoverAnimals,moveCage,removeCage,removeRoom,pedigreeMarkup} from '../dist/extensions.mjs';
import {saveDaily} from '../dist/daily.mjs';
const at='2026-10-07',seed=()=>initialState(at);
test('communal housing is valid and can be filtered without mixing caged occupants',()=>{
 const s=seed(),a={...s.animals[0],cage:''};assert.deepEqual(validateAnimal(a,s.animals,s.locations,a.id,at),[]);
 assert.deepEqual(filterAnimals([a,s.animals[1]],{room:'Room A',communal:true}).map(a=>a.id),[a.id]);
 assert.ok(validateAnimal({...a,room:'Missing'},s.animals,s.locations,a.id,at).length);
});
test('departed and archived animals do not appear in living stock filters',()=>{
 const a=seed().animals[0];assert.equal(filterAnimals([{...a,departed:at},{...a,id:'archived',archived:true}],{status:'living'}).length,0);
 assert.equal(filterAnimals([{...a,departed:at}],{status:'departed'}).length,1);
});
test('past event date changes are blocked while current-day corrections and adult arrival background are allowed',()=>{
 const a=seed().animals[0];assert.ok(validateEventDates(a,{...a,dob:'2020-01-01'},at).length);
 assert.deepEqual(validateEventDates({...a,dod:at},{...a,dod:''},at),[]);
 assert.ok(validateEventDates(a,{...a,dod:'2026-10-06'},at).length);
 assert.deepEqual(validateEventDates(null,{...a,arrived:at},at),[]);
 assert.ok(validateEventDates(null,{...a,arrived:'2026-10-06'},at).length);
});
test('configured sex choices and required typed fields enforce researchers schema',()=>{
 const s=seed(),a={...s.animals[0],sex:'Not assessed',extra:{custom_weight:'abc'}},schema=[{key:'sex',options:['Not assessed']},{key:'custom_weight',label:'Weight',custom:true,type:'number',required:true}];
 assert.ok(!validateAnimal(a,s.animals,s.locations,a.id,at,schema).some(e=>e.includes('sex')));
 assert.ok(validateAnimal(a,s.animals,s.locations,a.id,at,schema).some(e=>e.includes('number')));
 a.extra={};assert.ok(validateAnimal(a,s.animals,s.locations,a.id,at,schema).some(e=>e.includes('required')));
});
test('cage move changes present occupants atomically and retains before/after history',()=>{
 const s=seed(),n=moveCage(s,'Room A','A-01','Room B','Tester',at+'T12:00:00Z');
 assert.equal(s.animals[0].room,'Room A');assert.equal(n.animals[0].room,'Room B');
 assert.ok(n.locations.some(l=>l.room==='Room B'&&l.cage==='A-01'));assert.ok(!n.locations.some(l=>l.room==='Room A'&&l.cage==='A-01'));
 assert.equal(n.events.findLast(e=>e.animalId===s.animals[0].id).before.room,'Room A');
 assert.throws(()=>moveCage(s,'Room A','A-01','Room A','Tester'),/different/);
});
test('recovery keeps immutable reports and research history and archives later IDs',()=>{
 const s=seed(),target=structuredClone(s.animals);s.dailyRecords=[{date:at,animals:target,tables:{stock:target},csv:{stock:'frozen'}}];
 s.researchEntries=[{id:'research',notes:'Keep me'}];s.animals[0].notes='Changed';s.animals.push({...s.animals[0],id:'LATER'});
 const p=recoveryPreview(s,at);assert.equal(p.changed,2);assert.deepEqual(p.archive,['LATER']);
 const n=recoverAnimals(s,at,'Administrator',at+'T18:00:00Z');assert.equal(n.animals[0].notes,target[0].notes);assert.equal(n.animals.find(a=>a.id==='LATER').archived,true);
 assert.deepEqual(n.dailyRecords,s.dailyRecords);assert.deepEqual(n.researchEntries,s.researchEntries);assert.equal(n.events.length,s.events.length+1);assert.equal(n.events.at(-1).beforeAnimals.at(-1).id,'LATER');
});
test('pedigree exposes recorded parent and child IDs and escapes labels',()=>{
 const s=seed(),esc=x=>String(x).replaceAll('<','&lt;');assert.ok(pedigreeMarkup(s.animals,'DEMO-016',esc).includes('DEMO-001'));
 assert.ok(pedigreeMarkup(s.animals,'DEMO-001',esc).includes('DEMO-016'));
 assert.ok(!pedigreeMarkup([{id:'<script>',sex:'Unknown'}],'<script>',esc).includes('<script>'));
});

test('family tree shows four ancestor generations without expanding beyond the limit',()=>{
 const animals=Array.from({length:6},(_,i)=>({id:'GEN-'+i,mother:i<5?'GEN-'+(i+1):'',sex:'Unknown'}));
 const markup=pedigreeMarkup(animals,'GEN-0',String);
 assert.ok(markup.includes('Family tree'));
 assert.ok(markup.includes('GEN-4'));
 assert.ok(!markup.includes('GEN-5'));
});

test('occupied cages and rooms cannot be removed, including communal occupants and future deaths',()=>{
 const s=seed(),original=structuredClone(s),stamp=at+'T12:00:00Z';
 assert.throws(()=>removeCage(s,'Room A','A-01','Administrator',stamp),/occupied/);
 assert.throws(()=>removeRoom(s,'Room A','Administrator',stamp),/occupied/);
 assert.deepEqual(s,original);
 s.animals=[{...s.animals[0],cage:'',dod:'2026-10-08'}];
 assert.throws(()=>removeRoom(s,'Room A','Administrator',stamp),/occupied/);
 s.animals[0].cage='A-01';assert.throws(()=>removeCage(s,'Room A','A-01','Administrator',stamp),/occupied/);
});

test('empty cage removal preserves its room and a paired cage ID in another room',()=>{
 const s=seed(),stamp=at+'T12:00:00Z';s.animals=[];s.locations=[{room:'Empty room',cage:'SHARED'},{room:'Other room',cage:'SHARED'}];
 s.settings={autoDaily:false};const original=structuredClone(s),next=removeCage(s,'Empty room','SHARED','Administrator',stamp);
 assert.deepEqual(next.locations,[{room:'Other room',cage:'SHARED'},{room:'Empty room',cage:''}]);
 assert.deepEqual(s,original);assert.equal(next.settings.housingInitialized,true);assert.equal(next.settings.autoDaily,false);
 const event=next.events.at(-1);assert.equal(event.action,'Cage removed');assert.equal(event.actor,'Administrator');assert.equal(event.at,stamp);
 assert.deepEqual(event.locationBefore,{room:'Empty room',cage:'SHARED'});assert.equal(event.locationAfter,null);assert.deepEqual(event.snapshot,s.animals);
 assert.deepEqual(next.events.slice(0,-1),s.events);
});

test('location removal preserves historical animal references, reports, research and groups',()=>{
 const s=seed(),stamp=at+'T12:00:00Z';s.locations=[{room:'Historical room',cage:'OLD-01'},{room:'Other room',cage:''}];
 s.animals=s.animals.slice(0,3).map((animal,i)=>({...animal,room:'Historical room',cage:'OLD-01',...(i===0?{dod:at}:i===1?{departed:at}:{archived:true})}));
 s.researchEntries=[{id:'research',animalIds:[s.animals[0].id],notes:'Keep this history'}];
 const saved=saveDaily(s,{at:stamp}),original=structuredClone(saved),withoutCage=removeCage(saved,'Historical room','OLD-01','Administrator',stamp),withoutRoom=removeRoom(withoutCage,'Historical room','Administrator',stamp);
 assert.ok(!withoutRoom.locations.some(l=>l.room==='Historical room'));
 assert.deepEqual(withoutRoom.animals,saved.animals);assert.deepEqual(withoutRoom.dailyRecords,saved.dailyRecords);
 assert.deepEqual(withoutRoom.researchEntries,saved.researchEntries);assert.deepEqual(withoutRoom.groups,saved.groups);assert.deepEqual(saved,original);
 const event=withoutRoom.events.at(-1);assert.equal(event.action,'Room removed');assert.deepEqual(event.locationBefore,{room:'Historical room'});assert.equal(event.locationAfter,null);
 assert.deepEqual(event.snapshot,saved.animals);assert.deepEqual(withoutRoom.events.slice(0,-2),saved.events);
});

test('empty room removal removes all its cage locations and refuses missing locations',()=>{
 const s=seed(),stamp=at+'T12:00:00Z';s.animals=[];s.locations=[{room:'Empty room',cage:''},{room:'Empty room',cage:'E-01'},{room:'Empty room',cage:'E-02'},{room:'Other room',cage:'E-01'}];
 const next=removeRoom(s,'Empty room','Administrator',stamp);assert.deepEqual(next.locations,[{room:'Other room',cage:'E-01'}]);assert.equal(next.settings.housingInitialized,true);
 assert.throws(()=>removeRoom(next,'Empty room','Administrator',stamp),/existing room/);
 assert.throws(()=>removeCage(next,'Other room','','Administrator',stamp),/existing cage/);
 assert.throws(()=>removeCage(next,'Other room','   ','Administrator',stamp),/existing cage/);
 assert.throws(()=>removeCage(next,'Other room','Missing','Administrator',stamp),/existing cage/);
});

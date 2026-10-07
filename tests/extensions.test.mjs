import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateAnimal,filterAnimals} from '../dist/core.mjs';
import {validateEventDates,recoveryPreview,recoverAnimals,moveCage,pedigreeMarkup} from '../dist/extensions.mjs';
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
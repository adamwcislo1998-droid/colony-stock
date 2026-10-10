import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateAnimal,saveAnimal,asOf,age,filterAnimals,exportRows,csv,defaultColumns} from '../dist/core.mjs';
import {workbook} from '../dist/xlsx.mjs';
const at='2026-10-07',seed=()=>initialState(at);
import {expandDemo} from '../dist/core.mjs';
test('saved small demo expands without replacing edits or historical snapshots',()=>{
 const s=seed();s.animals=s.animals.slice(0,18);s.animals[0].notes='My saved edit';s.favourites=['DEMO-006'];
 const before=structuredClone(s),n=expandDemo(s,'2026-10-09T12:00:00Z');
 assert.equal(n.animals.length,170);assert.equal(n.animals[0].notes,'My saved edit');assert.deepEqual(n.favourites,s.favourites);assert.deepEqual(n.events.slice(0,-1),s.events);assert.deepEqual(s,before);assert.equal(expandDemo(n),n);
 for(const a of n.animals)assert.deepEqual(validateAnimal(a,n.animals,n.locations,a.id,'2026-10-09'),[]);
});
test('expanded demo has 170 unique animals and multiple pedigree generations',()=>{const s=seed();assert.equal(s.animals.length,170);assert.equal(new Set(s.animals.map(a=>a.id)).size,170);assert.ok(s.animals.some(a=>s.animals.find(p=>p.id===a.mother)?.mother));assert.ok(s.animals.some(a=>a.mother&&!a.father));assert.equal(asOf(s,at).length,170);});
test('all demo records satisfy domain validation',()=>{const s=seed();for(const a of s.animals)assert.deepEqual(validateAnimal(a,s.animals,s.locations,a.id,at),[]);});
test('duplicates, invalid dates, death before birth and inconsistent housing fail',()=>{
 const s=seed(),a={...s.animals[0],dob:'2026-02-30',dod:'2025-01-01',room:'Room B',cage:'A-01'};
 const errors=validateAnimal(a,s.animals,s.locations,null,at);
 assert.ok(errors.some(e=>e.includes('already exists')));assert.ok(errors.some(e=>e.includes('valid birth')));assert.ok(errors.some(e=>e.includes('before birth')));assert.ok(errors.some(e=>e.includes('within its room')));
});

test('historical animal notes can be edited after its room is removed, preserving optional cage blanks',()=>{
 const s=seed();
 for(const status of [{dod:at},{departed:at},{archived:true}]){
  const original={...s.animals[0],...status,room:'Retired room',cage:undefined},animals=[original,...s.animals.slice(1)];
  assert.deepEqual(validateAnimal({...original,cage:'',notes:'Additional context'},animals,s.locations,original.id,at),[]);
 }
});

test('historical missing cages remain valid only while their exact room and cage are preserved',()=>{
 const s=seed(),original={...s.animals[0],dod:at,room:'Room A',cage:'Retired cage'},animals=[original,...s.animals.slice(1)];
 assert.deepEqual(validateAnimal({...original,notes:'Additional context'},animals,s.locations,original.id,at),[]);
 assert.ok(validateAnimal({...original,cage:'Another retired cage'},animals,s.locations,original.id,at).some(error=>error.includes('within its room')));
 assert.ok(validateAnimal({...original,room:'Another retired room'},animals,s.locations,original.id,at).some(error=>error.includes('within its room')));
 assert.deepEqual(validateAnimal({...original,room:'Room B',cage:'B-01'},animals,s.locations,original.id,at),[]);
});

test('reviving a historical record requires a configured current room and cage',()=>{
 const s=seed();
 for(const status of [{dod:at},{departed:at},{archived:true}]){
  const original={...s.animals[0],...status,room:'Retired room',cage:'R-01'},animals=[original,...s.animals.slice(1)],revived={...original,dod:'',departed:'',archived:false};
  assert.ok(validateAnimal(revived,animals,s.locations,original.id,at).some(error=>error.includes('within its room')));
  assert.deepEqual(validateAnimal({...revived,room:'Room A',cage:''},animals,s.locations,original.id,at),[]);
 }
});

test('new and living animals cannot legitimize invalid housing by recording a death',()=>{
 const s=seed(),living={...s.animals[0],room:'Retired room',cage:'R-01'},animals=[living,...s.animals.slice(1)];
 assert.ok(validateAnimal({...living,dod:at},animals,s.locations,living.id,at).some(error=>error.includes('within its room')));
 assert.ok(validateAnimal({...living,id:'NEW-ANIMAL',dod:at},s.animals,s.locations,null,at).some(error=>error.includes('within its room')));
 assert.ok(validateAnimal({...living,notes:'Update'},animals,s.locations,living.id,at).some(error=>error.includes('within its room')));
});
test('unknown dates permitted; future events rejected',()=>{const s=seed(),a={...s.animals[3],dob:'',dod:''};assert.deepEqual(validateAnimal(a,s.animals,s.locations,a.id,at),[]);a.dob='2027-01-01';assert.ok(validateAnimal(a,s.animals,s.locations,a.id,at).some(e=>e.includes('future')));});
test('pedigree cycles rejected',()=>{const s=seed(),a={...s.animals[0],mother:'DEMO-016'};assert.ok(validateAnimal(a,s.animals,s.locations,a.id,at).some(e=>e.includes('cycle')));});
test('editing a parent cannot make its offspring older than it',()=>{const s=seed(),a={...s.animals[0],dob:at};assert.ok(validateAnimal(a,s.animals,s.locations,a.id,at).some(e=>e.includes('parent')||e.includes('Parent')));});
test('history keeps before/after and historical locations',()=>{const s=seed(),a={...s.animals[0],room:'Room B',cage:'B-01',notes:'Moved'};const next=saveAnimal(s,a,'Demo tester','2026-10-07T16:30:00.000Z',a.id);assert.equal(s.animals[0].room,'Room A');assert.equal(next.events.at(-1).before.room,'Room A');assert.equal(next.events.at(-1).after.room,'Room B');assert.equal(asOf(next,'2026-10-06').find(x=>x.id===a.id).room,'Room A');assert.equal(asOf(next,at).find(x=>x.id===a.id).room,'Room B');assert.equal(asOf(next,'2026-09-01'),null);});
test('death correction retains prior event and active stock is filtered',()=>{const s=seed(),a={...s.animals[0],dod:at};const n=saveAnimal(s,a,'Demo tester','2026-10-07T17:00:00Z',a.id);assert.equal(n.events.at(-1).action,'Death recorded');assert.ok(!filterAnimals(n.animals,{status:'living'}).some(x=>x.id===a.id));const c=saveAnimal(n,{...a,dod:''},'Demo tester','2026-10-07T18:00:00Z',a.id);assert.equal(c.events.at(-1).action,'Death corrected');assert.equal(c.events.at(-2).after.dod,at);});
test('age stops at death and unknown remains explicit',()=>{assert.equal(age('',at),'Unknown');assert.equal(age('2026-10-01',at,'2026-10-03'),'2 days');assert.equal(age('2027-01-01',at),'Not yet born');});
test('custom fields validate type and participate in search',()=>{const s=seed(),c={key:'custom_x',label:'Weight',type:'number',custom:true,visible:true},a={...s.animals[0],extra:{custom_x:'bad'}};assert.ok(validateAnimal(a,s.animals,s.locations,a.id,at,[c]).some(x=>x.includes('number')));assert.equal(filterAnimals([a],{search:'bad'}).length,1);});
test('exports respect configured labels, ordering, hidden and custom columns',()=>{const s=seed(),a={...s.animals[0],extra:{custom_x:'5'}},c=[{key:'custom_x',label:'New data',visible:true},{key:'id',label:'Identifier',visible:true},{key:'notes',label:'Hidden',visible:false}];assert.deepEqual(exportRows([a],at,c),[['New data','Identifier'],['5','DEMO-001']]);assert.equal(exportRows(s.animals,at)[0].length,11);});
test('CSV quoting preserves commas and neutralises formulas',()=>{const text=csv([['ID','Notes'],['001','=HYPERLINK("bad")'],['a,b','line\nnote']]);assert.ok(text.startsWith('\uFEFF'));assert.ok(text.includes('"a,b"'));assert.ok(text.includes("'=HYPERLINK"));assert.ok(text.includes('""bad""'));});
test('XLSX has expected ZIP parts and text-only escaped cells',()=>{const bytes=workbook([['ID'],['=1+1'],['<b>🦇 & "x"']]),text=new TextDecoder().decode(bytes);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);assert.ok(text.includes('xl/worksheets/sheet1.xml'));assert.ok(text.includes('t="inlineStr"'));assert.ok(text.includes('&lt;b&gt;'));assert.ok(!text.includes('<f>'));});
test('XLSX refuses a zero-column workbook',()=>{assert.throws(()=>workbook([[],[]]),/column/i);});

import {saveGroup,groupTimeline} from '../dist/core.mjs';
test('cohort history preserves membership and excludes edits after removal',()=>{
 let s=seed();s.events=[s.events[0]];
 const group={id:'test-cohort',name:'Study',notes:'Synthetic',animalIds:['DEMO-001']};
 s=saveGroup(s,group,'Tester','2026-10-07T12:00:00Z');
 s=saveAnimal(s,{...s.animals[0],dod:'2026-10-08'},'Tester','2026-10-08T12:00:00Z','DEMO-001');
 s=saveGroup(s,{...group,animalIds:['DEMO-001','DEMO-002']},'Tester','2026-10-09T12:00:00Z');
 s=saveGroup(s,{...group,animalIds:['DEMO-002']},'Tester','2026-10-10T12:00:00Z');
 s=saveAnimal(s,{...s.animals[0],dod:''},'Tester','2026-10-10T13:00:00Z','DEMO-001');
 const t=groupTimeline(s,group.id);assert.equal(t.events.filter(e=>e.action==='Death recorded').length,1);assert.equal(t.events.filter(e=>e.action==='Death corrected').length,0);
 assert.deepEqual(t.days.at(-1),{date:'2026-10-10',members:1,living:1,deceased:0});
 assert.equal(s.events.find(e=>e.groupId===group.id&&e.groupBefore)?.groupBefore.animalIds.length,1);
});
test('synthetic timestamps never follow the current real time',()=>{
 const s=initialState();assert.ok(s.events.every(e=>Date.parse(e.at)<=Date.now()));
});


import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,saveAnimal,validateAnimal} from '../dist/core.mjs';
import {choices,schemaErrors,fieldErrors,saveColumns} from '../dist/fields.mjs';
const field={key:'custom_group',label:'Treatment',custom:true,visible:true,type:'select',options:['Control'],allowNew:false};
test('strict choices reject unlisted values; flexible choices are learned with record history',()=>{
 const s=initialState();s.columns.push(structuredClone(field));const a=structuredClone(s.animals[0]);a.extra.custom_group='Trial';
 assert.ok(validateAnimal(a,s.animals,s.locations,a.id,undefined,s.columns).some(x=>x.includes('listed')));
 s.columns.at(-1).allowNew=true;assert.deepEqual(validateAnimal(a,s.animals,s.locations,a.id,undefined,s.columns),[]);
 const n=saveAnimal(s,a,'Tester',undefined,a.id);assert.deepEqual(n.columns.at(-1).options,['Control','Trial']);assert.deepEqual(s.columns.at(-1).options,['Control']);assert.equal(n.events.at(-1).after.extra.custom_group,'Trial');
});
test('tightening schema rejects incompatible values without discarding them',()=>{
 const s=initialState();s.animals[0].extra.custom_group='Trial';
 assert.ok(schemaErrors([...s.columns,field],s.animals).some(x=>x.includes('existing record')));
 assert.deepEqual(schemaErrors([...s.columns,{...field,allowNew:true}],s.animals),[]);
 assert.ok(schemaErrors([...s.columns,{...field,required:true}],s.animals).length);
});
test('numbers, required values, calendar dates and defaults validate',()=>{
 const n={...field,type:'number',min:'0',max:'10',required:true};
 for(const value of ['', 'no', '-1','11'])assert.ok(fieldErrors(value,n).length);
 assert.deepEqual(fieldErrors('1.5',n),[]);
 assert.ok(fieldErrors('2026-02-30',{...n,type:'date'}).length);
 assert.ok(schemaErrors([{...n,required:false,defaultValue:'20'}],[]).some(x=>x.startsWith('Default:')));
 assert.ok(schemaErrors([{...n,required:false,min:'20'}],[]).some(x=>x.includes('minimum')));
});
test('schema history retains previous settings and hidden field values',()=>{
 const s=initialState();s.columns.push(structuredClone(field));s.animals[0].extra.custom_group='Control';
 const n=saveColumns(s,s.columns.map(c=>c.key===field.key?{...c,visible:false,allowNew:true}:c),'Tester');
 assert.equal(n.events.at(-1).columnsBefore.at(-1).visible,true);assert.equal(n.events.at(-1).columnsAfter.at(-1).visible,false);assert.equal(n.animals[0].extra.custom_group,'Control');
});
test('choice parsing preserves unique entries and supports lines and commas',()=>{assert.deepEqual(choices(' A, B\nA\n C '),['A','B','C']);});

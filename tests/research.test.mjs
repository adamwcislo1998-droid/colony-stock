import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../dist/core.mjs';
import {validateResearch,saveResearch,filterResearch,researchPage,renderResearchForm} from '../dist/research.mjs';
const date='2026-10-07',stamp=date+'T12:00:00Z',actor={name:'Tester',role:'researcher'},seed=()=>initialState(date);
const entry=(overrides={})=>({date,type:'Behaviour',animalIds:['DEMO-001'],notes:'Synthetic observation',fields:{},...overrides});
test('research entries preserve stock and append exact before/after note history',()=>{
 const original=seed(),n=saveResearch(original,entry(),actor,stamp),saved=n.researchEntries[0];assert.deepEqual(n.animals,original.animals);assert.equal(original.researchEntries,undefined);
 const updated=saveResearch(n,{...saved,notes:'Revised',baseUpdatedAt:saved.updatedAt},actor,date+'T13:00:00Z');assert.equal(updated.researchEntries.length,1);assert.equal(updated.events.at(-1).researchBefore.notes,'Synthetic observation');assert.equal(updated.researchEntries[0].createdAt,saved.createdAt);
});
test('research dates reject backdating and closed-day edits',()=>{
 const s=seed();assert.ok(validateResearch(s,entry({date:'2026-10-06'}),stamp).length);assert.ok(validateResearch(s,entry({date:'2026-10-08'}),stamp).length);
 const n=saveResearch(s,entry(),actor,stamp);assert.throws(()=>saveResearch(n,{...n.researchEntries[0],date:'2026-10-08'},actor,'2026-10-08T12:00:00Z'),/final/);
});
test('research categories, animal identities and duplicate selections are validated',()=>{
 const s=seed();for(const bad of [entry({type:'Invented'}),entry({animalIds:[]}),entry({animalIds:['MISSING']}),entry({animalIds:['DEMO-001','DEMO-001']})])assert.ok(validateResearch(s,bad,stamp).length);
 s.researchTypes=['Custom study'];assert.deepEqual(validateResearch(s,entry({type:'Custom study'}),stamp),[]);
});
test('typed research fields accept uncertainty choices and enforce required values',()=>{
 const s=seed();s.researchFields=[{key:'mass',label:'Mass',type:'number',required:true},{key:'confidence',label:'Confidence',type:'select',options:['Known','Uncertain']},{key:'date',label:'Observed',type:'date'},{key:'checked',label:'Checked',type:'boolean'}];
 assert.deepEqual(validateResearch(s,entry({fields:{mass:'0',confidence:'Uncertain',date,checked:false}}),stamp),[]);
 assert.equal(validateResearch(s,entry({fields:{mass:'bad',confidence:'bad',date:'2026-02-30',checked:'false'}}),stamp).length,4);assert.ok(validateResearch(s,entry(),stamp).some(e=>e.includes('required')));
});
test('existing research field definitions remain readable/editable after schema changes',()=>{
 const s=seed();s.researchFields=[{key:'result',label:'Original result',type:'select',options:['Uncertain']}];const n=saveResearch(s,entry({fields:{result:'Uncertain'}}),actor,stamp);n.researchFields=[{key:'other',label:'New field',type:'number'}];
 const u=saveResearch(n,{...n.researchEntries[0],notes:'Updated'},actor,date+'T13:00:00Z');assert.equal(u.researchEntries[0].fieldDefinitions[0].label,'Original result');assert.match(renderResearchForm(u,undefined,u.researchEntries[0]),/name="result"/);
});
test('cohort queries retain membership as recorded rather than current membership',()=>{
 const n=saveResearch(seed(),entry({animalIds:['DEMO-001','DEMO-006']}),actor,stamp);n.groups[0].animalIds=[];assert.equal(filterResearch(n,{groupId:'demo-group'}).length,1);assert.equal(filterResearch(n,{animalId:'DEMO-006',date,search:'observation'}).length,1);assert.equal(filterResearch(n,{animalId:'DEMO-002'}).length,0);
});
test('student research writes are rejected and controls are absent',()=>{
 const s=seed();assert.throws(()=>saveResearch(s,entry(),{name:'Student',role:'student'},stamp),/Only researchers/);assert.doesNotMatch(researchPage(s,undefined,'student'),/data-action="research-add"/);
});
test('stale research forms cannot overwrite a newer same-day entry',()=>{
 const s=saveResearch(seed(),entry(),actor,stamp),old=s.researchEntries[0],n=saveResearch(s,{...old,notes:'Newer',baseUpdatedAt:old.updatedAt},actor,date+'T13:00:00Z');assert.throws(()=>saveResearch(n,{...old,notes:'Stale',baseUpdatedAt:old.updatedAt},actor,date+'T14:00:00Z'),/changed after/);
});
test('research display escapes free text and date follows UTC',()=>{
 const n=saveResearch(seed(),entry({notes:'<img src=x onerror=bad>'}),actor,stamp);assert.ok(researchPage(n).includes('&lt;img'));assert.ok(!researchPage(n).includes('<img src=x'));
 assert.ok(validateResearch(seed(),entry(), '2026-10-07T23:30:00-02:00').some(e=>e.includes('dated today')));
});
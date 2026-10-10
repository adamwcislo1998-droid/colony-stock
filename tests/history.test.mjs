import test from 'node:test';
import assert from 'node:assert/strict';
import {eventAnimalIds,eventChanges,historySummary,filterHistory} from '../dist/history.mjs';
const stamp='2026-10-07T12:00:00Z';
const event=(id,overrides={})=>({id,at:stamp,action:'Record updated',actor:'Researcher A',animalId:'BAT-001',...overrides});

test('animal changes preserve zero and false while optional blank values are equivalent',()=>{
 const changes=eventChanges(event('animal',{before:{id:'BAT-001',notes:'',cage:'',room:'A',extra:{custom_weight:2,custom_verified:true,custom_blank:null}},after:{id:'BAT-001',notes:undefined,cage:undefined,room:'A',extra:{custom_weight:0,custom_verified:false,custom_blank:''}}}),[{key:'custom_weight',label:'Weight'},{key:'custom_verified',label:'Verified'}]);
 assert.deepEqual(changes,[{label:'Weight',before:'2',after:'0'},{label:'Verified',before:'Yes',after:'No'}]);
});
test('animal location is readable, and private snapshot values never enter changes or search',()=>{
 const value=event('move',{before:{id:'BAT-001',room:'Room A',cage:'A-01'},after:{id:'BAT-001',room:'Room B',cage:''},snapshot:[{id:'BAT-999',notes:'hidden snapshot marker'}]});
 assert.deepEqual(eventChanges(value),[{label:'Location',before:'Room A / cage A-01',after:'Room B / communal'}]);
 assert.deepEqual(eventAnimalIds(value),['BAT-001']);assert.equal(filterHistory([value],{search:'hidden snapshot marker'}).length,0);
 assert.equal(filterHistory([value],{animalId:'BAT-999'}).length,0);
});
test('research association keeps removed animals and frozen labels, cohort context and literal notes',()=>{
 const value=event('research',{animalId:'',animalIds:['BAT-002'],before:null,after:null,researchBefore:{type:'Behaviour',date:'2026-10-07',animalIds:['BAT-001'],notes:'Before',fields:{research_count:3},fieldDefinitions:[{key:'research_count',label:'Observed calls'}],groupMembership:[{id:'g',name:'Flight cohort'}]},researchAfter:{type:'Swab sampling',date:'2026-10-07',animalIds:['BAT-002'],notes:'<b>Recorded only</b>',fields:{research_count:0},fieldDefinitions:[{key:'research_count',label:'Observed calls'}],groupMembership:[{id:'g',name:'Flight cohort'}]}});
 assert.deepEqual(eventAnimalIds(value),['BAT-002','BAT-001']);
 assert.ok(eventChanges(value).some(change=>change.label==='Observed calls'&&change.after==='0'));
 assert.ok(eventChanges(value).some(change=>change.after==='<b>Recorded only</b>'));
 assert.ok(historySummary(value).includes('Flight cohort'));assert.equal(filterHistory([value],{animalId:'BAT-001',search:'swab'}).length,1);
 assert.equal(filterHistory([value],{search:'Observed calls'}).length,1);
});
test('group changes use historical membership and suppress mere member reordering',()=>{
 const value=event('group',{animalId:'',groupBefore:{name:'Control',notes:'old',animalIds:['BAT-001','BAT-002']},groupAfter:{name:'Treatment',notes:'new',animalIds:['BAT-002','BAT-003']}});
 assert.deepEqual(eventAnimalIds(value),['BAT-001','BAT-002','BAT-003']);
 assert.ok(eventChanges(value).some(change=>change.label==='Group members'&&change.after==='BAT-002, BAT-003'));
 assert.equal(filterHistory([value],{search:'Treatment',animalId:'BAT-001'}).length,1);
 assert.equal(eventChanges({...value,groupAfter:{...value.groupBefore,animalIds:['BAT-002','BAT-001']}}).length,0);
});
test('daily replacement exposes source, version and exact counts including zero',()=>{
 const value=event('daily',{animalId:'',dailyBefore:{date:'2026-10-07',source:'automatic',revision:1,tables:{stock:[{}],births:[{}],deaths:[]}},dailyAfter:{date:'2026-10-07',source:'manual',revision:2,tables:{stock:[],births:[],deaths:[{}]}}});
 assert.deepEqual(eventChanges(value),[{label:'Save source',before:'automatic',after:'manual'},{label:'Record version',before:'1',after:'2'},{label:'Current stock',before:'1',after:'0'},{label:'Births',before:'1',after:'0'},{label:'Deaths',before:'0',after:'1'}]);
 assert.match(historySummary(value),/2026-10-07 · manual v2 · 0 stock, 0 births, 1 deaths/);
 assert.deepEqual(eventAnimalIds(value),[]);
});
test('schema changes describe configuration and choice changes without dumping objects',()=>{
 const value=event('schema',{animalId:'',schemaBefore:{columns:[{key:'sex',label:'Sex',type:'select',options:['Female','Male'],visible:true},{key:'custom_weight',label:'Weight',type:'number'}],researchFields:[],researchTypes:['Behaviour']},schemaAfter:{columns:[{key:'custom_weight',label:'Weight',type:'number'},{key:'sex',label:'Sex assessment',type:'select',options:['Female','Male','Uncertain'],required:true,visible:false}],researchFields:[{key:'research_confidence',label:'Confidence',type:'select',options:['Known','Uncertain']}],researchTypes:['Behaviour','Swab sampling']}});
 const changes=eventChanges(value);assert.ok(changes.some(change=>change.label==='Animal field: Sex assessment'&&change.after.includes('required · hidden · choices: Female, Male, Uncertain')));
 assert.ok(changes.some(change=>change.label==='Animal field order'));assert.ok(changes.some(change=>change.label==='Research field: Confidence'));
 assert.equal(filterHistory([value],{search:'Uncertain'}).length,1);assert.ok(changes.every(change=>typeof change.before==='string'&&typeof change.after==='string'));
});
test('recovery summary associates only changed animals and records archived count',()=>{
 const value=event('recovery',{animalId:'',recoveryDate:'2026-10-06',beforeAnimals:[{id:'BAT-001',notes:'new'},{id:'BAT-002',notes:'same'},{id:'BAT-003',notes:'later'}],snapshot:[{id:'BAT-001',notes:'old'},{id:'BAT-002',notes:'same'},{id:'BAT-003',notes:'later',archived:true}]});
 assert.deepEqual(eventAnimalIds(value),['BAT-001','BAT-003']);assert.match(historySummary(value),/2 animals changed · 1 archived/);
 assert.equal(filterHistory([value],{animalId:'BAT-002'}).length,0);assert.ok(eventChanges(value).some(change=>change.after.includes('2 changed · 1 archived')));
});
test('history filtering combines exact fields, inclusive dates and case insensitive readable search',()=>{
 const events=[event('early',{at:'2026-10-06T23:59:59Z'}),event('begin',{at:'2026-10-07T00:00:00Z',before:{id:'BAT-001',notes:'uncertain'},after:{id:'BAT-001',notes:'confirmed'}}),event('end',{at:'2026-10-07T23:59:59.999Z',actor:{name:'Researcher A'},before:{id:'BAT-001',notes:'uncertain'},after:{id:'BAT-001',notes:'recorded'}}),event('later',{at:'2026-10-08T00:00:00Z'}),event('different',{actor:'Researcher B',action:'Death recorded'})];
 const original=structuredClone(events),found=filterHistory(events,{from:'2026-10-07',to:'2026-10-07',actor:'Researcher A',action:'Record updated',animalId:'BAT-001',search:' UNCERTAIN '});
 assert.deepEqual(found.map(value=>value.id),['end','begin']);assert.deepEqual(events,original);
 assert.equal(filterHistory(events,{actor:'researcher a'}).length,0);assert.equal(filterHistory(events,{animalId:'BAT-01'}).length,0);
});
test('timestamp sorting has deterministic insertion order for ties in both directions',()=>{
 const events=[event('first'),event('second'),event('earlier',{at:'2026-10-06T10:00:00Z'}),event('third')];
 assert.deepEqual(filterHistory(events).map(value=>value.id),['third','second','first','earlier']);
 assert.deepEqual(filterHistory(events,{sort:'oldest'}).map(value=>value.id),['earlier','first','second','third']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeEventChanges} from '../dist/record-review.mjs';
test('death and departure require review even for a single changed field',()=>{
 assert.deepEqual(lifeEventChanges({dod:''},{dod:'2026-10-10'}),['Death date: Not recorded → 2026-10-10']);
 assert.deepEqual(lifeEventChanges({}, {departed:'2026-10-10'}),['Departure date: Not recorded → 2026-10-10']);
});
test('corrections and removal also require review',()=>{
 assert.deepEqual(lifeEventChanges({dod:'2026-10-09'},{dod:'2026-10-10'}),['Death date: 2026-10-09 → 2026-10-10']);
 assert.deepEqual(lifeEventChanges({dod:'2026-10-10'},{dod:''}),['Death date: 2026-10-10 → Removed']);
});
test('ordinary edits and unchanged life events do not require review',()=>{
 assert.deepEqual(lifeEventChanges({dod:'2026-10-10',notes:'old'},{dod:'2026-10-10',notes:'new'}),[]);
 assert.deepEqual(lifeEventChanges(null,{dod:'',departed:''}),[]);
});
test('new deceased records and both life events are reviewed',()=>{
 assert.equal(lifeEventChanges(null,{dod:'2026-10-10'}).length,1);
 assert.equal(lifeEventChanges({}, {dod:'2026-10-10',departed:'2026-10-09'}).length,2);
});

import {initialState,filterAnimals,saveAnimal} from '../dist/core.mjs';
import {saveDaily} from '../dist/daily.mjs';
import {eventAnimalIds,eventChanges,filterHistory} from '../dist/history.mjs';
import {pendingRecordReviews,reviewMatchesAnimal,saveAnimalWithReview,approveRecordReviews,undoRecordReview,validateReviewedEventDates} from '../dist/record-review.mjs';
const date='2026-10-10',at=date+'T12:00:00.000Z',later='2026-10-11T12:00:00.000Z';
const seed=()=>initialState(date),animal=(s,id='DEMO-001')=>s.animals.find(a=>a.id===id);
const change=(s,fields,id='DEMO-001',time=at)=>saveAnimalWithReview(s,{...animal(s,id),...fields},'Recorder',time,id);
const selection=r=>({id:r.id,revision:r.revision});
const pending=s=>pendingRecordReviews(s)[0];
test('pending approvals survive JSON storage round trips and exclude deceased animals only from live stock',()=>{
 const original=seed(),saved=change(original,{dod:date}),loaded=JSON.parse(JSON.stringify(saved));
 assert.equal(pendingRecordReviews(original).length,0);
 assert.equal(pendingRecordReviews(loaded).length,1);
 assert.equal(pending(loaded).animalId,'DEMO-001');
 assert.equal(pending(loaded).before.dod,'');assert.equal(pending(loaded).after.dod,date);
 assert.ok(!filterAnimals(loaded.animals,{status:'living'}).some(a=>a.id==='DEMO-001'));
 assert.equal(reviewMatchesAnimal(loaded,pending(loaded)),true);
});
test('approval of one entry preserves the other pending entry, animal values and reviewer history',()=>{
 const saved=change(change(seed(),{dod:date}),{departed:date},'DEMO-002');
 const result=approveRecordReviews(saved,[selection(pending(saved))],'Reviewer',later);
 assert.deepEqual(result.animals,saved.animals);
 assert.equal(pendingRecordReviews(result).length,1);assert.equal(pending(result).animalId,'DEMO-002');
 const approved=result.recordReviews.find(r=>r.status==='approved');
 assert.equal(approved.reviewedBy,'Reviewer');assert.equal(approved.reviewedAt,later);
 assert.equal(result.events.at(-1).action,'Life event changes approved');
 assert.equal(pendingRecordReviews(saved).length,2);
});
test('approve all completes an atomic batch with searchable history for every animal',()=>{
 const saved=change(change(seed(),{dod:date}),{departed:date},'DEMO-002');
 const result=approveRecordReviews(saved,pendingRecordReviews(saved).map(selection),'Reviewer',later);
 assert.equal(pendingRecordReviews(JSON.parse(JSON.stringify(result))).length,0);
 const event=result.events.at(-1);
 assert.deepEqual(eventAnimalIds(event),['DEMO-001','DEMO-002']);
 assert.ok(eventChanges(event).some(c=>c.label==='Approval for DEMO-001'&&c.after==='Approved'));
 assert.ok(filterHistory(result.events,{animalId:'DEMO-002',action:'Life event changes approved'}).includes(event));
});
test('undo after midnight restores only queued life-event fields and keeps later notes and housing',()=>{
 const saved=change(seed(),{dod:date});
 const laterEdit=change(saved,{notes:'Keep this note',room:'Room B',cage:'B-01',arrived:'2026-10-11'},'DEMO-001',later);
 const result=undoRecordReview(laterEdit,selection(pending(laterEdit)),'Reviewer',later);
 assert.equal(animal(result).dod,'');assert.equal(animal(result).notes,'Keep this note');
 assert.equal(animal(result).room,'Room B');assert.equal(animal(result).cage,'B-01');assert.equal(animal(result).arrived,'2026-10-11');
 assert.equal(pendingRecordReviews(result).length,0);assert.equal(result.recordReviews[0].status,'reverted');
 assert.ok(filterAnimals(result.animals,{status:'living'}).some(a=>a.id==='DEMO-001'));
 assert.equal(result.events.at(-1).action,'Life event changes reverted');
 assert.equal(animal(laterEdit).dod,date);
});
test('repeated life-event edits retain the original baseline and invalidate stale approvals',()=>{
 const saved=change(seed(),{dod:date}),old=selection(pending(saved));
 const updated=change(saved,{departed:date});
 assert.equal(pendingRecordReviews(updated).length,1);
 assert.equal(pending(updated).id,old.id);assert.equal(pending(updated).revision,old.revision+1);
 assert.deepEqual(pending(updated).fields,['dod','departed']);
 assert.equal(pending(updated).before.dod,'');assert.equal(pending(updated).before.departed,'');
 assert.throws(()=>approveRecordReviews(updated,[old],'Reviewer',at),/latest values/);
 const restored=undoRecordReview(updated,selection(pending(updated)),'Reviewer',later);
 assert.equal(animal(restored).dod,'');assert.equal(animal(restored).departed,'');
});
test('editing dates back to the baseline resolves the pending entry instead of making another pending change',()=>{
 const saved=change(seed(),{dod:date});
 const restored=change(saved,{dod:''},'DEMO-001',later);
 assert.equal(pendingRecordReviews(restored).length,0);assert.equal(restored.recordReviews[0].status,'reverted');
 assert.equal(restored.events.at(-1).action,'Life event changes reverted');
});
test('partial reversal retains other pending fields until they are approved or undone',()=>{
 const saved=change(seed(),{dod:date,departed:date}),partial=change(saved,{dod:''},'DEMO-001',later);
 assert.equal(pendingRecordReviews(partial).length,1);assert.equal(pending(partial).before.departed,'');
 const restored=undoRecordReview(partial,selection(pending(partial)),'Reviewer',later);
 assert.equal(animal(restored).dod,'');assert.equal(animal(restored).departed,'');
});
test('pending date corrections remain possible next day; new backdating and approved historical edits remain blocked',()=>{
 const saved=change(seed(),{dod:date});
 assert.deepEqual(validateReviewedEventDates(saved,animal(saved),{...animal(saved),dod:''},'2026-10-11'),[]);
 const corrected=change(saved,{dod:'2026-10-11'},'DEMO-001',later);
 assert.equal(pending(corrected).before.dod,'');assert.equal(pending(corrected).after.dod,'2026-10-11');
 assert.throws(()=>change(saved,{dod:'2026-10-09'},'DEMO-001',later),/Past event dates/);
 const approved=approveRecordReviews(saved,[selection(pending(saved))],'Reviewer',later);
 assert.throws(()=>change(approved,{dod:''},'DEMO-001',later),/Past event dates/);
});
test('new deceased records create pending reviews and legacy states tolerate an absent queue',()=>{
 const original=seed(),added=saveAnimalWithReview(original,{...animal(original),id:'NEW',dod:date},'Recorder',at);
 assert.equal(pending(added).animalId,'NEW');assert.equal(pending(added).before.dod,'');
 assert.deepEqual(pendingRecordReviews(original),[]);
 assert.equal(pendingRecordReviews(change(original,{notes:'Ordinary edit'})).length,0);
});
test('read-only roles cannot save, approve or undo pending changes',()=>{
 const saved=change(seed(),{dod:date}),selected=selection(pending(saved));
 assert.throws(()=>approveRecordReviews(saved,[selected],'Student',at,'student'),/Read-only/);
 assert.throws(()=>undoRecordReview(saved,selected,'Student',at,'student'),/Read-only/);
 assert.throws(()=>saveAnimalWithReview(saved,{...animal(saved),dod:''},'Student',at,'DEMO-001','student'),/Read-only/);
});
test('stale and conflicting batches reject all approvals without changing state',()=>{
 const saved=change(change(seed(),{dod:date}),{departed:date},'DEMO-002'),selections=pendingRecordReviews(saved).map(selection);
 const outside=saveAnimal(saved,{...animal(saved,'DEMO-002'),departed:''},'External',at,'DEMO-002'),json=JSON.stringify(outside);
 assert.throws(()=>approveRecordReviews(outside,selections,'Reviewer',at),/outside this review/);
 assert.equal(JSON.stringify(outside),json);
 assert.throws(()=>undoRecordReview(outside,selections[1],'Reviewer',at),/outside this review/);
 const approved=approveRecordReviews(saved,selections,'Reviewer',at);
 assert.throws(()=>approveRecordReviews(approved,selections,'Reviewer',at),/latest values/);
 assert.throws(()=>approveRecordReviews(saved,[selections[0],selections[0]],'Reviewer',at),/Select pending/);
});
test('undo validates current housing and refuses to restore an animal to a removed location',()=>{
 const saved=change(seed(),{dod:date});
 saved.locations=saved.locations.filter(l=>l.room!==animal(saved).room);
 assert.throws(()=>undoRecordReview(saved,selection(pending(saved)),'Reviewer',later),/Edit the record before undoing/);
 assert.equal(pendingRecordReviews(saved).length,1);
});
test('approval and undo preserve previously saved daily snapshots',()=>{
 const saved=saveDaily(change(seed(),{dod:date}),{actor:'Recorder',at,source:'manual'}),frozen=structuredClone(saved.dailyRecords);
 const approved=approveRecordReviews(saved,[selection(pending(saved))],'Reviewer',later);
 const undone=undoRecordReview(saved,selection(pending(saved)),'Reviewer',later);
 assert.deepEqual(approved.dailyRecords,frozen);assert.deepEqual(undone.dailyRecords,frozen);
 assert.ok(undone.dailyRecords[0].animals.find(a=>a.id==='DEMO-001').dod);
 assert.equal(animal(undone).dod,'');
});

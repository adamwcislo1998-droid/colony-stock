import {saveAnimal,validateAnimal} from './core.mjs';
import {validateEventDates} from './extensions.mjs';
import {utcDay} from './daily.mjs';
const lifeFields=[['dod','Death date'],['departed','Departure date']];
const value=(animal,key)=>animal?.[key]||'';
const lifeValues=animal=>Object.fromEntries(lifeFields.map(([key])=>[key,value(animal,key)]));
export function lifeEventChanges(before,after){
 return lifeFields.filter(([key])=>value(before,key)!==value(after,key))
  .map(([key,label])=>label+': '+(value(before,key)||'Not recorded')+' → '+(value(after,key)||'Removed'));
}
export function pendingRecordReviews(state){return (state.recordReviews||[]).filter(review=>review.status==='pending');}
export function reviewMatchesAnimal(state,review){
 const animal=state.animals.find(a=>a.id===review.animalId);
 return !!animal&&!animal.archived&&review.fields.every(key=>value(animal,key)===value(review.after,key));
}
function requireWriter(role){if(!['researcher','administrator'].includes(role))throw new Error('Read-only users cannot change or approve records.');}
function reviewEvent(next,reviews,action,actor,at){
 next.events.push({id:crypto.randomUUID(),at,actor,action,animalId:reviews.length===1?reviews[0].animalId:'',animalIds:reviews.map(r=>r.animalId),recordReviews:structuredClone(reviews),snapshot:structuredClone(next.animals)});
}
// Only unapproved life-event fields may be corrected after their recording day.
// Original values may be restored; new backdated events remain disallowed.
export function validateReviewedEventDates(state,before,after,date=utcDay()){
 const review=before&&pendingRecordReviews(state).find(r=>r.animalId===before.id);
 if(!review)return validateEventDates(before,after,date);
 const adjusted={...before};
 for(const key of review.fields){
  if(value(before,key)!==value(after,key))adjusted[key]=value(after,key)===value(review.before,key)?value(after,key):'';
 }
 return validateEventDates(adjusted,after,date);
}
export function saveAnimalWithReview(state,animal,actor,at=new Date().toISOString(),originalId=null,role='researcher'){
 requireWriter(role);
 const before=originalId?state.animals.find(a=>a.id===originalId):null;
 const errors=[...validateAnimal(animal,state.animals,state.locations,originalId,utcDay(at),state.columns),...validateReviewedEventDates(state,before,animal,utcDay(at))];
 if(errors.length)throw new Error([...new Set(errors)].join(' '));
 const next=saveAnimal(state,animal,actor,at,originalId);
 next.recordReviews??=[];
 const changed=lifeFields.filter(([key])=>value(before,key)!==value(animal,key)).map(([key])=>key);
 if(!changed.length)return next;
 let review=next.recordReviews.find(r=>r.status==='pending'&&r.animalId===animal.id);
 if(!review){
  review={id:crypto.randomUUID(),animalId:animal.id,status:'pending',fields:[],before:lifeValues(before),after:lifeValues(animal),createdAt:at,createdBy:actor,revision:0};
  next.recordReviews.push(review);
 }
 for(const key of changed){if(!review.fields.includes(key)){review.fields.push(key);review.before[key]=value(before,key);}}
 review.after=lifeValues(animal);review.updatedAt=at;review.updatedBy=actor;review.revision++;
 review.sourceEventId=next.events.at(-1).id;
 if(review.fields.every(key=>value(review.before,key)===value(review.after,key))){
  review.status='reverted';review.reviewedAt=at;review.reviewedBy=actor;
  reviewEvent(next,[review],'Life event changes reverted',actor,at);
 }
 return next;
}
function selectedReviews(state,selections){
 if(!selections.length||new Set(selections.map(s=>s.id)).size!==selections.length)throw new Error('Select pending changes to review.');
 return selections.map(selection=>{
  const review=pendingRecordReviews(state).find(r=>r.id===selection.id);
  if(!review||review.revision!==selection.revision)throw new Error('The pending change has changed. Reload and review the latest values.');
  if(!reviewMatchesAnimal(state,review))throw new Error('The animal has changed outside this review. Open and edit its life events before approving or undoing.');
  return review;
 });
}
export function approveRecordReviews(state,selections,actor,at=new Date().toISOString(),role='researcher'){
 requireWriter(role);selectedReviews(state,selections);
 const next=structuredClone(state),ids=new Set(selections.map(s=>s.id));
 const reviewed=next.recordReviews.filter(r=>ids.has(r.id));
 for(const review of reviewed){review.status='approved';review.reviewedAt=at;review.reviewedBy=actor;}
 reviewEvent(next,reviewed,'Life event changes approved',actor,at);
 return next;
}
export function undoRecordReview(state,selection,actor,at=new Date().toISOString(),role='researcher'){
 requireWriter(role);
 const [review]=selectedReviews(state,[selection]),animal=state.animals.find(a=>a.id===review.animalId),restored=structuredClone(animal);
 for(const key of review.fields)restored[key]=value(review.before,key);
 const errors=[...validateAnimal(restored,state.animals,state.locations,animal.id,utcDay(at),state.columns),...validateReviewedEventDates(state,animal,restored,utcDay(at))];
 if(errors.length)throw new Error('Edit the record before undoing: '+[...new Set(errors)].join(' '));
 const next=saveAnimal(state,restored,actor,at,animal.id),resolved=next.recordReviews.find(r=>r.id===review.id);
 resolved.status='reverted';resolved.reviewedAt=at;resolved.reviewedBy=actor;
 reviewEvent(next,[resolved],'Life event changes reverted',actor,at);
 return next;
}

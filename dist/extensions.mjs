import {validDate,saveAnimal} from './core.mjs';
export const utcDate=()=>new Date().toISOString().slice(0,10);
export function validateEventDates(before,after,date=utcDate()) {
 const errors=[];
 for(const key of ['dob','dod','arrived','departed']) {
  const value=after[key]||'',old=before?.[key]||'';
  if(value&&!validDate(value))errors.push('Enter a valid '+({dob:'birth',dod:'death',arrived:'arrival',departed:'departure'}[key])+' date.');
  if(value>date)errors.push('Event dates cannot be in the future.');
  if(value===old)continue;
  // A new arrival may have an older birth date as background information.
  if(!before&&key==='dob')continue;
  if((old&&old<date)||(value&&value<date))errors.push('Past event dates are final. Record new events on the current day; late corrections are not allowed.');
 }
 if(after.arrived&&after.departed&&after.departed<after.arrived)errors.push('Departure cannot be before arrival.');
 if(after.dob&&after.arrived&&after.arrived<after.dob)errors.push('Arrival cannot be before birth.');
 return [...new Set(errors)];
}
export function recoveryPreview(state,date) {
 const record=state.dailyRecords?.find(r=>r.date===date);
 if(!record)throw new Error('Choose a saved daily record.');
 const target=record.animals;
 if(!Array.isArray(target))throw new Error('This daily record does not contain a recoverable animal baseline.');
 const targetMap=new Map(target.map(a=>[a.id,a]));
 const changes=state.animals.filter(a=>JSON.stringify(a)!==JSON.stringify(targetMap.get(a.id)||{...a,archived:true}));
 const details=changes.map(a=>{const baseline=targetMap.get(a.id);if(!baseline)return a.id+' · archive later animal';const fields=Object.keys({...a,...baseline}).filter(key=>key!=='extra'&&String(a[key]??'')!==String(baseline[key]??''));for(const key of Object.keys(baseline.extra||{}))if(String(a.extra?.[key]??'')!==String(baseline.extra[key]??''))fields.push(state.columns.find(c=>c.key===key)?.label||key);return a.id+' · '+(fields.join(', ')||'saved field structure');});
 return {date,target:structuredClone(target),changed:changes.length,details,archive:state.animals.filter(a=>!targetMap.has(a.id)&&!a.archived).map(a=>a.id)};
}
export function recoverAnimals(state,date,actor,at=new Date().toISOString()) {
 const preview=recoveryPreview(state,date),next=structuredClone(state),target=new Map(preview.target.map(a=>[a.id,a]));
 next.animals=next.animals.map(a=>target.has(a.id)?structuredClone(target.get(a.id)):{...a,archived:true});
 // Keep current field definitions; preserve fields added since the saved baseline.
 for(const animal of next.animals){const current=state.animals.find(a=>a.id===animal.id);animal.extra={...current?.extra,...animal.extra};}
 next.events.push({id:crypto.randomUUID(),at,actor,action:'Animal baseline recovered',recoveryDate:date,beforeAnimals:structuredClone(state.animals),snapshot:structuredClone(next.animals),animalId:'',before:null,after:null});
 return next;
}
export function moveCage(state,room,cage,targetRoom,actor,at=new Date().toISOString()) {
 if(!cage||room===targetRoom||!state.locations.some(l=>l.room===room&&l.cage===cage)||!state.locations.some(l=>l.room===targetRoom))throw new Error('Select an existing cage and a different destination room.');
 if(state.locations.some(l=>l.room===targetRoom&&l.cage===cage))throw new Error('A cage with that ID already exists in the destination room.');
 let next=structuredClone(state);
 next.locations=next.locations.filter(l=>!(l.room===room&&l.cage===cage));
 if(!next.locations.some(l=>l.room===room))next.locations.push({room,cage:''});
 next.locations.push({room:targetRoom,cage});
 for(const animal of state.animals.filter(a=>a.room===room&&a.cage===cage&&!a.dod&&!a.departed&&!a.archived))next=saveAnimal(next,{...animal,room:targetRoom},actor,at,animal.id);
 next.events.push({id:crypto.randomUUID(),at,actor,action:'Cage moved',locationBefore:{room,cage},locationAfter:{room:targetRoom,cage},animalId:'',before:null,after:null,snapshot:structuredClone(next.animals)});
 return next;
}
export function pedigreeMarkup(animals,id,esc) {
 const map=new Map(animals.map(a=>[a.id,a]));
 function node(key,depth,path=new Set()) {
  if(!key)return '<li><span class="pedigree-unknown">Unknown parent</span></li>';
  const a=map.get(key);if(!a)return '<li>'+esc(key)+' (not in register)</li>';
  if(path.has(key))return '<li>Relationship cycle</li>';
  const nextPath=new Set(path);nextPath.add(key);
  return '<li><button class="pedigree-node" data-detail="'+esc(key)+'"><strong>'+esc(key)+'</strong><small>'+esc(a.sex||'Unknown')+(a.dod?' · deceased':a.departed?' · departed':'')+'</small></button>'+(depth>0&&(a.mother||a.father)?'<ul>'+node(a.mother,depth-1,nextPath)+node(a.father,depth-1,nextPath)+'</ul>':'')+'</li>';
 }
 const children=animals.filter(a=>a.mother===id||a.father===id);
 return '<div class="pedigree"><h3>Ancestors</h3><p class="subtle">Up to four generations. Select an animal to inspect its own tree.</p><ul>'+node(id,3)+'</ul><h3>Children</h3><div class="pedigree-children">'+(children.length?children.map(a=>'<button class="pedigree-node" data-detail="'+esc(a.id)+'">'+esc(a.id)+'</button>').join(''):'<p class="subtle">No recorded children.</p>')+'</div></div>';
}
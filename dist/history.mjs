const blank=value=>value==null||(typeof value==='string'&&!value.trim());
const normalize=value=>blank(value)?'':value;
const readable=value=>blank(value)?'Not specified':typeof value==='boolean'?(value?'Yes':'No'):Array.isArray(value)?(value.length?value.map(readable).join(', '):'Not specified'):typeof value==='object'?'Recorded value':String(value);
const list=value=>Array.isArray(value)?value:[];
const ids=value=>[...new Set(list(value).filter(id=>typeof id==='string'&&id.trim()))].sort();
const actorName=event=>typeof event.actor==='object'?String(event.actor?.name||''):String(event.actor??'');
const animalLabels={id:'Animal ID',species:'Species',sex:'Sex',line:'Line / strain',pob:'Place of birth',mother:'Parent 1',father:'Parent 2',dob:'Date of birth',dod:'Date of death',arrived:'Arrival date',departed:'Departure date',notes:'Notes',archived:'Archived'};
const fieldLabel=(key,columns=[])=>list(columns).find(field=>field.key===key)?.label||animalLabels[key]||key.replace(/^(custom_|research_)/,'').replaceAll('_',' ');
const same=(before,after)=>JSON.stringify(normalize(before))===JSON.stringify(normalize(after));
function location(value,roomOnly=false){return value?(value.room?(value.room+(roomOnly?'':value.cage?' / cage '+value.cage:' / communal')):value.cage?'Cage '+value.cage:''):'';}
function addChange(changes,label,before,after){if(!same(before,after))changes.push({label,before:readable(before),after:readable(after)});}
function animalChanges(before,after,columns){
 const changes=[];
 for(const key of Object.keys(animalLabels))addChange(changes,fieldLabel(key,columns),before?.[key],after?.[key]);
 addChange(changes,'Location',location(before),location(after));
 for(const key of new Set([...Object.keys(before?.extra||{}),...Object.keys(after?.extra||{})]))addChange(changes,fieldLabel(key,columns),before?.extra?.[key],after?.extra?.[key]);
 return changes;
}
function recoveryDetails(event){
 const before=list(event.beforeAnimals),after=list(event.snapshot),old=new Map(before.map(animal=>[animal.id,animal]));
 const changed=after.filter(animal=>animalChanges(old.get(animal.id),animal,[]).length),remaining=new Set(after.map(animal=>animal.id));
 return {changed:[...changed.map(animal=>animal.id),...before.filter(animal=>!remaining.has(animal.id)).map(animal=>animal.id)],archived:changed.filter(animal=>animal.archived&&!old.get(animal.id)?.archived).length,before:before.length,after:after.length};
}
export function eventAnimalIds(event={}){
 const related=[event.animalId,...list(event.animalIds),...list(event.recordReviews).map(r=>r.animalId),...list(event.researchBefore?.animalIds),...list(event.researchAfter?.animalIds),...list(event.groupBefore?.animalIds),...list(event.groupAfter?.animalIds)];
 if(Array.isArray(event.beforeAnimals)&&Array.isArray(event.snapshot))related.push(...recoveryDetails(event).changed);
 return [...new Set(related.filter(id=>typeof id==='string'&&id.trim()))];
}
function researchChanges(event){
 const before=event.researchBefore,after=event.researchAfter,changes=[];
 for(const [key,label] of [['type','Research category'],['date','Research date'],['notes','Research notes']])addChange(changes,label,before?.[key],after?.[key]);
 addChange(changes,'Research animals',ids(before?.animalIds).join(', '),ids(after?.animalIds).join(', '));
 const cohorts=entry=>[...new Set(list(entry?.groupMembership).map(group=>group.name||group.id).filter(Boolean))].sort().join(', ');
 addChange(changes,'Research cohorts',cohorts(before),cohorts(after));
 const definitions=[...list(after?.fieldDefinitions),...list(before?.fieldDefinitions)];
 for(const key of new Set([...Object.keys(before?.fields||{}),...Object.keys(after?.fields||{})]))addChange(changes,fieldLabel(key,definitions),before?.fields?.[key],after?.fields?.[key]);
 return changes;
}
function count(record,key){if(!record)return null;if(Array.isArray(record.tables?.[key]))return record.tables[key].length;if(Array.isArray(record.rows?.[key]))return Math.max(0,record.rows[key].length-1);return null;}
function fieldDescription(field){
 if(!field)return '';
 return [field.label||field.key,field.type||'text',field.required?'required':'optional',field.visible===false?'hidden':'visible',...(list(field.options).length?['choices: '+field.options.join(', ')]:[]),...(field.allowNew?['new choices allowed']:[]),...(field.defaultValue?['default: '+field.defaultValue]:[]),...(field.min!==''&&field.min!=null?['minimum: '+field.min]:[]),...(field.max!==''&&field.max!=null?['maximum: '+field.max]:[]),...(field.description?['guidance: '+field.description]:[])].join(' · ');
}
export function eventChanges(event={},columns=[]){
 if(event.columnsBefore||event.columnsAfter)event={...event,schemaBefore:event.schemaBefore||{columns:event.columnsBefore},schemaAfter:event.schemaAfter||{columns:event.columnsAfter}};
 const changes=[];
 for(const review of list(event.recordReviews)){
  addChange(changes,'Approval for '+review.animalId,'Pending',review.status==='approved'?'Approved':'Reverted');
  for(const key of review.fields||[])addChange(changes,review.animalId+' · '+fieldLabel(key,columns),review.status==='reverted'?review.after?.[key]:review.before?.[key],review.status==='reverted'?review.before?.[key]:review.after?.[key]);
 }
 if(event.before||event.after)changes.push(...animalChanges(event.before,event.after,columns));
 if(event.researchBefore||event.researchAfter)changes.push(...researchChanges(event));
 if(event.groupBefore||event.groupAfter){
  for(const [key,label] of [['name','Group name'],['notes','Group notes']])addChange(changes,label,event.groupBefore?.[key],event.groupAfter?.[key]);
  addChange(changes,'Group members',ids(event.groupBefore?.animalIds).join(', '),ids(event.groupAfter?.animalIds).join(', '));
 }
 if(event.dailyBefore||event.dailyAfter||event.dailyDate){
  const before=event.dailyBefore,after=event.dailyAfter;
  addChange(changes,'Daily record date',before?.date,after?.date||event.dailyDate);
  addChange(changes,'Save source',before?.source,after?.source||event.dailySource);
  addChange(changes,'Record version',before?.revision,after?.revision??event.dailyRevision);
  for(const [key,label] of [['stock','Current stock'],['births','Births'],['deaths','Deaths']])addChange(changes,label,count(before,key),count(after,key));
 }
 if(event.locationBefore||event.locationAfter)addChange(changes,'Location',location(event.locationBefore,event.action==='Room removed'),location(event.locationAfter,event.action==='Room removed'));
 if(event.schemaBefore||event.schemaAfter){
  for(const [key,label] of [['columns','Animal field'],['researchFields','Research field']]){
   const before=list(event.schemaBefore?.[key]),after=list(event.schemaAfter?.[key]);
   for(const fieldKey of new Set([...before.map(field=>field.key),...after.map(field=>field.key)])){
    const old=before.find(field=>field.key===fieldKey),next=after.find(field=>field.key===fieldKey);
    addChange(changes,label+': '+(next?.label||old?.label||fieldKey),fieldDescription(old),fieldDescription(next));
   }
   // Report a changed order even when the field definitions are unchanged.
   if(before.length&&after.length&&same([...before.map(field=>field.key)].sort(),[...after.map(field=>field.key)].sort())&&!same(before.map(field=>field.key),after.map(field=>field.key)))addChange(changes,label+' order',before.map(field=>field.label||field.key).join(', '),after.map(field=>field.label||field.key).join(', '));
  }
  addChange(changes,'Research categories',list(event.schemaBefore?.researchTypes).join(', '),list(event.schemaAfter?.researchTypes).join(', '));
 }
 if(Array.isArray(event.beforeAnimals)&&Array.isArray(event.snapshot)){
  const recovery=recoveryDetails(event);
  addChange(changes,'Recovery baseline',null,event.recoveryDate);
  addChange(changes,'Recovery scope',recovery.before+' animal records',recovery.after+' animal records · '+recovery.changed.length+' changed · '+recovery.archived+' archived');
 }
 return changes;
}
function changedLabels(event,columns){const labels=eventChanges(event,columns).map(change=>change.label);return labels.slice(0,4).join(', ')+(labels.length>4?' + '+(labels.length-4)+' more':'');}
export function historySummary(event={},columns=[]){
 if(list(event.recordReviews).length)return event.recordReviews.map(r=>r.animalId+' · '+(r.status==='approved'?'Approved':'Reverted')).join(', ');
 if(event.dailyAfter||event.dailyDate){const record=event.dailyAfter,counts=['stock','births','deaths'].filter(key=>count(record,key)!=null).map(key=>count(record,key)+' '+key).join(', ');return [record?.date||event.dailyDate,(record?.source||event.dailySource||'Saved')+' v'+(record?.revision??event.dailyRevision??1),counts].filter(Boolean).join(' · ');}
 if(event.researchAfter||event.researchBefore){const entry=event.researchAfter||event.researchBefore,cohorts=list(entry.groupMembership).map(group=>group.name||group.id).filter(Boolean).join(', ');return [entry.type,entry.date,ids(entry.animalIds).length+' animal'+(ids(entry.animalIds).length===1?'':'s'),cohorts,event.researchBefore?changedLabels(event,columns):''].filter(Boolean).join(' · ');}
 if(event.groupAfter||event.groupBefore){const group=event.groupAfter||event.groupBefore;return [group.name,ids(group.animalIds).length+' animals',changedLabels(event,columns)].filter(Boolean).join(' · ');}
 if(Array.isArray(event.beforeAnimals)&&Array.isArray(event.snapshot)){const recovery=recoveryDetails(event);return ['Baseline '+(event.recoveryDate||'not recorded'),recovery.changed.length+' animals changed',recovery.archived+' archived'].join(' · ');}
 if(event.locationBefore||event.locationAfter)return [location(event.locationBefore,event.action==='Room removed'),location(event.locationAfter,event.action==='Room removed')].filter(Boolean).join(' → ');
 const changes=changedLabels(event,columns);
 return [event.animalId,changes].filter(Boolean).join(' · ')||event.action||'No field changes recorded';
}
export function filterHistory(events=[],filters={}){
 const query=String(filters.search||'').trim().toLowerCase(),columns=filters.columns||[],oldest=filters.sort==='oldest';
 return list(events).map((event,index)=>({event,index,time:Date.parse(event.at)||0})).filter(({event})=>{
  const related=eventAnimalIds(event),date=String(event.at||'').slice(0,10);
  if(filters.animalId&&!related.includes(filters.animalId)||filters.action&&event.action!==filters.action||filters.actor&&actorName(event)!==filters.actor)return false;
  if(filters.from&&(!date||date<filters.from)||filters.to&&(!date||date>filters.to))return false;
  if(!query)return true;
  const changes=eventChanges(event,columns);
  return [event.action,actorName(event),...related,historySummary(event,columns),...changes.flatMap(change=>[change.label,change.before,change.after])].some(value=>String(value??'').toLowerCase().includes(query));
 }).sort((a,b)=>oldest?(a.time-b.time||a.index-b.index):(b.time-a.time||b.index-a.index)).map(({event})=>event);
}

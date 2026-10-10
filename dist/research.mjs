import {validDate} from './core.mjs';
export const starterResearchTypes=['Behaviour','Surgery','Harvest','Swab sampling','Wing punch','Other'];
const defaultEscape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const missing=value=>value==null||(typeof value==='string'&&!value.trim());
const recordingDate=at=>typeof at==='string'&&Number.isFinite(Date.parse(at))?new Date(at).toISOString().slice(0,10):'';
const currentDate=()=>new Date().toISOString().slice(0,10);
export const researchTypes=state=>Array.isArray(state.researchTypes)?[...new Set(state.researchTypes.filter(value=>typeof value==='string'&&value.trim()))]:[...starterResearchTypes];
export const canRecordResearch=role=>['researcher','admin','administrator'].includes(role);
const entrySchema=(state,before)=>before?.fieldDefinitions||state.researchFields||[];
export function validateResearch(state,entry,at=new Date().toISOString()){
 const errors=[],date=recordingDate(at),entries=state.researchEntries||[];
 if(!entry||typeof entry!=='object')return ['Enter a research record.'];
 if(!validDate(date))return ['The recording time is invalid.'];
 const before=entry.id?entries.find(value=>value.id===entry.id):null;
 if(!validDate(entry.date))errors.push('Enter a valid research date.');
 else if(entry.date!==date)errors.push('Research records must be dated today; earlier days cannot be changed.');
 if(before&&before.date!==date)errors.push('Previous research records are final and cannot be changed.');
 if(before&&entry.baseUpdatedAt!==undefined&&entry.baseUpdatedAt!==before.updatedAt)errors.push('This research record changed after you opened it. Reopen it before saving.');
 if(!researchTypes(state).includes(entry.type)&&!(before&&entry.type===before.type))errors.push('Choose a configured research category.');
 if(!Array.isArray(entry.animalIds)||!entry.animalIds.length)errors.push('Select at least one animal.');
 else{if(new Set(entry.animalIds).size!==entry.animalIds.length)errors.push('Select each animal only once.');for(const id of entry.animalIds)if(!state.animals.some(animal=>animal.id===id))errors.push('Animal '+String(id)+' is not in the register.');}
 if(entry.notes!=null&&(typeof entry.notes!=='string'||entry.notes.length>10000))errors.push('Notes must be text with no more than 10,000 characters.');
 const schema=entrySchema(state,before),fields=entry.fields||{};
 if(!fields||Array.isArray(fields)||typeof fields!=='object')errors.push('Research field values are invalid.');
 else{
  for(const key of Object.keys(fields))if(!schema.some(field=>field.key===key))errors.push('Research field '+key+' is not configured for this record.');
  for(const field of schema){const value=fields[field.key],label=field.label||field.key;
   if(missing(value)){if(field.required)errors.push(label+' is required.');continue;}
   if(field.type==='number'&&(typeof value==='boolean'||!['string','number'].includes(typeof value)||!Number.isFinite(Number(value))))errors.push(label+' must be a number.');
   else if(field.type==='date'&&!validDate(value))errors.push(label+' must be a valid date.');
   else if(field.type==='select'&&!(field.options||[]).includes(value))errors.push('Choose a configured value for '+label+'.');
   else if(field.type==='boolean'&&typeof value!=='boolean')errors.push(label+' must be Yes or No.');
   else if(field.type==='text'&&(typeof value!=='string'||value.length>3000))errors.push(label+' must be text with no more than 3,000 characters.');
   else if(!['number','date','select','boolean','text'].includes(field.type))errors.push(label+' has an unsupported field type.');
  }
 }
 return [...new Set(errors)];
}
export function saveResearch(state,entry,actor,at=new Date().toISOString()){
 const role=typeof actor==='object'?actor?.role:'researcher';if(!canRecordResearch(role))throw new Error('Only researchers and administrators can record research notes.');
 const name=typeof actor==='object'?actor?.name:actor;if(typeof name!=='string'||!name.trim())throw new Error('A named researcher is required.');
 const errors=validateResearch(state,entry,at);if(errors.length)throw new Error(errors.join(' '));
 const next=structuredClone(state),before=(state.researchEntries||[]).find(value=>value.id===entry.id)||null;
 const stamp=at.length===10?at+'T12:00:00.000Z':new Date(at).toISOString();
 const membership=(state.groups||[]).filter(group=>group.animalIds.some(id=>entry.animalIds.includes(id))).map(group=>({id:group.id,name:group.name,animalIds:group.animalIds.filter(id=>entry.animalIds.includes(id))}));
 const after={id:before?.id||entry.id||crypto.randomUUID(),date:entry.date,type:entry.type,animalIds:[...entry.animalIds],notes:(entry.notes||'').trim(),fields:structuredClone(entry.fields||{}),fieldDefinitions:structuredClone(entrySchema(state,before)),groupMembership:membership,createdAt:before?.createdAt||stamp,createdBy:before?.createdBy||name.trim(),updatedAt:stamp,updatedBy:name.trim()};
 next.researchEntries=before?next.researchEntries.map(value=>value.id===before.id?after:value):[...(next.researchEntries||[]),after];
 next.events.push({id:crypto.randomUUID(),at:stamp,actor:name.trim(),action:before?'Research note updated':'Research note recorded',animalId:after.animalIds.length===1?after.animalIds[0]:'',animalIds:[...after.animalIds],researchBefore:structuredClone(before),researchAfter:structuredClone(after),before:null,after:null,snapshot:structuredClone(next.animals)});return next;
}
export function filterResearch(state,filters={}){
 const query=(filters.search||'').trim().toLowerCase();
 return [...(state.researchEntries||[])].filter(entry=>(!filters.date||entry.date===filters.date)&&(!filters.animalId||entry.animalIds.includes(filters.animalId))&&(!filters.groupId||(entry.groupMembership||[]).some(group=>group.id===filters.groupId))&&(!filters.type||entry.type===filters.type)&&(!query||[entry.type,entry.notes,entry.createdBy,...entry.animalIds,...Object.values(entry.fields||{}),...(entry.groupMembership||[]).map(group=>group.name)].some(value=>String(value??'').toLowerCase().includes(query)))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export function researchPage(state,esc=defaultEscape,role='researcher',filters={}){
 const entries=filterResearch(state,filters),types=researchTypes(state),today=currentDate();
 const option=(value,label,selected)=>'<option value="'+esc(value)+'"'+(value===selected?' selected':'')+'>'+esc(label)+'</option>';
 const rows=entries.map(entry=>'<tr><td>'+esc(entry.date)+'</td><td>'+esc(entry.type)+'</td><td>'+entry.animalIds.map(id=>'<button class="id-link" data-detail="'+esc(id)+'">'+esc(id)+'</button>').join(', ')+'</td><td class="research-notes">'+esc(entry.notes||'No notes')+((entry.fieldDefinitions||[]).length?'<details><summary>Recorded fields</summary><dl>'+entry.fieldDefinitions.map(field=>'<dt>'+esc(field.label)+'</dt><dd>'+esc(entry.fields?.[field.key]===false?'No':entry.fields?.[field.key]===true?'Yes':entry.fields?.[field.key]??'Not specified')+'</dd>').join('')+'</dl></details>':'')+'</td><td>'+esc(entry.updatedBy||entry.createdBy)+'</td><td>'+(entry.date===today&&canRecordResearch(role)?'<button class="text-button" data-research-edit="'+esc(entry.id)+'">Edit today’s note</button>':'<span class="tag">'+(entry.date===today?'Today · read only':'Final')+'</span>')+'</td></tr>').join('');
 return '<div class="page-heading"><div><div class="eyebrow">COLONY MANAGEMENT</div><h1>Research log</h1><p class="subtle">Dated observations and research records for individuals and cohorts.</p></div><div class="heading-actions"><button class="help-button" data-help="research" aria-label="Help for Research log">i</button>'+(canRecordResearch(role)?'<button class="button primary" data-action="research-add">＋ Record research</button>':'')+'</div></div><div class="callout">Record research categories and notes without changing stock. Today’s notes can be edited; previous dates are final. Cohort filtering uses membership when the note was saved.</div><section class="panel"><div class="toolbar"><div class="search-wrap"><input data-research-filter="search" aria-label="Search research records" placeholder="Search research, animals or notes…" value="'+esc(filters.search||'')+'"></div><input type="date" data-research-filter="date" aria-label="Research date" value="'+esc(filters.date||'')+'" max="'+today+'"><select data-research-filter="animalId" aria-label="Research animal">'+option('','All animals',filters.animalId)+(state.animals||[]).map(animal=>option(animal.id,animal.id,filters.animalId)).join('')+'</select><select data-research-filter="groupId" aria-label="Research cohort">'+option('','All cohorts',filters.groupId)+(state.groups||[]).map(group=>option(group.id,group.name,filters.groupId)).join('')+'</select><select data-research-filter="type" aria-label="Research category">'+option('','All categories',filters.type)+[...new Set([...types,...(state.researchEntries||[]).map(entry=>entry.type)])].map(type=>option(type,type,filters.type)).join('')+'</select><button class="text-button" data-action="research-clear">Clear filters</button></div>'+(entries.length?'<div class="table-wrap" tabindex="0" role="region" aria-label="Research records table. Use arrow keys to scroll."><table><thead><tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Animals</th><th scope="col">Notes & fields</th><th scope="col">Recorded by</th><th scope="col">Status</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="table-foot">'+entries.length+' research record'+(entries.length===1?'':'s')+'</div>':'<div class="empty"><strong>No research records</strong>Change the filters or record today’s research.</div>')+'</section>';
}
export function renderResearchForm(state,esc=defaultEscape,entry=null,atDate=currentDate()){
 const date=atDate||currentDate(),types=[...new Set([...researchTypes(state),...(entry?[entry.type]:[])])],schema=entrySchema(state,entry);
 const custom=schema.map(field=>{const value=entry?.fields?.[field.key],attrs=' name="'+esc(field.key)+'"'+(field.required?' required':'');let input;
  if(field.type==='select')input='<select'+attrs+'><option value="">Not specified</option>'+(field.options||[]).map(option=>'<option value="'+esc(option)+'"'+(value===option?' selected':'')+'>'+esc(option)+'</option>').join('')+'</select>';
  else if(field.type==='boolean')input='<select'+attrs+'><option value="">Not specified</option><option value="true"'+(value===true?' selected':'')+'>Yes</option><option value="false"'+(value===false?' selected':'')+'>No</option></select>';
  else input='<input'+attrs+' type="'+(['date','number'].includes(field.type)?field.type:'text')+'"'+(field.type==='number'?' step="any"':field.type==='text'?' maxlength="3000"':'')+' value="'+esc(value??'')+'">';
  return '<label>'+esc(field.label)+(field.required?' *':'')+input+'</label>';
 }).join('');
 return '<form id="research-form"><div class="dialog-heading"><div><div class="eyebrow">RESEARCH RECORD</div><h2>'+(entry?'Edit today’s research':'Record research')+'</h2></div><button type="button" class="icon-button" data-close="research-dialog" aria-label="Close research form">×</button></div><input type="hidden" name="entryId" value="'+esc(entry?.id||'')+'"><input type="hidden" name="baseUpdatedAt" value="'+esc(entry?.updatedAt||'')+'"><p class="subtle">Research categories do not automatically record births, deaths or departures.</p><div class="form-grid"><label>Date<input name="date" type="date" value="'+esc(entry?.date||date)+'" readonly required></label><label>Category<select name="type" required><option value="">Choose category</option>'+types.map(type=>'<option value="'+esc(type)+'"'+(entry?.type===type?' selected':'')+'>'+esc(type)+'</option>').join('')+'</select></label>'+custom+'</div><label>Select cohort members<select data-research-group><option value="">Choose cohort (optional)</option>'+(state.groups||[]).map(group=>'<option value="'+esc(group.id)+'">'+esc(group.name)+'</option>').join('')+'</select></label><fieldset id="research-animals" class="member-list"><legend>Animals *</legend>'+state.animals.map(animal=>'<label><input type="checkbox" name="animalIds" value="'+esc(animal.id)+'"'+(entry?.animalIds.includes(animal.id)?' checked':'')+'>'+esc(animal.id)+(animal.dod?' · deceased':animal.archived?' · archived':animal.departed?' · departed':'')+'</label>').join('')+'</fieldset><label>Research notes<textarea name="notes" rows="4" maxlength="10000">'+esc(entry?.notes||'')+'</textarea></label><div id="research-error" role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-close="research-dialog">Cancel</button><button type="submit" class="button primary">Save research record</button></div></form>';
}
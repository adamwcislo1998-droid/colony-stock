import {today,age,initialState,validateAnimal,saveAnimal,asOf,filterAnimals,cell,exportRows,csv,defaultColumns,saveGroup,groupTimeline} from './core.mjs';
import {workbook} from './xlsx.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const key='st-andrews-colony-v1',pages=['overview','stock','housing','reports','groups','favourites','history','brief'];
let raw=null,state,storageIssue='',page='overview',filter={status:'living'},tablePage=1,reportType='full',reportDate=today(),allDates=false,currentRows=[],editId=null,columnDraft=[],pendingFilter=null,toastTimer,selectedGroupId=null,editingGroupId=null;
try{
 raw=localStorage.getItem(key);state=raw?JSON.parse(raw):initialState();
 if(state.version!==1||!Array.isArray(state.animals)||!Array.isArray(state.events)||!Array.isArray(state.locations)||!Array.isArray(state.groups)||!Array.isArray(state.favourites))throw new Error('Unsupported demo data.');
 if(!Array.isArray(state.columns))state.columns=defaultColumns();
}catch{state=initialState();storageIssue='Saved data could not be read. Demo records are shown in memory; existing browser data has not been overwritten.';}
function notify(s){$('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function commit(next){
 if(storageIssue){notify('Storage is unavailable. Download a backup before continuing.');return false;}
 try{
  const latest=localStorage.getItem(key);
  if(latest!==raw){notify('This demo changed in another tab. Reload before saving.');return false;}
  const text=JSON.stringify(next);localStorage.setItem(key,text);raw=text;state=next;return true;
 }catch{notify('The save failed: browser storage is unavailable or full. Your previous data is unchanged.');return false;}
}
function mutate(fn){const n=structuredClone(state);fn(n);return commit(n);}
const rooms=()=>[...new Set(state.locations.map(x=>x.room))];
const options=(items,selected='',first='')=>(first?'<option value="">'+esc(first)+'</option>':'')+items.map(v=>'<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
function heading(title,subtitle,actions=''){return '<div class="page-heading"><div><div class="eyebrow">COLONY MANAGEMENT</div><h1>'+esc(title)+'</h1><p class="subtle">'+esc(subtitle)+'</p></div><div class="heading-actions">'+actions+'</div></div>';}
const addButton='<button class="button primary" data-action="add">＋ Add animal</button>';
const exportButtons='<button class="button secondary" data-action="xlsx">↓ Export Excel</button><button class="text-button" data-action="csv">CSV</button>';
function table(rows,at=today()){
 currentRows=rows;const c=state.columns.filter(x=>x.visible),max=Math.max(1,Math.ceil(rows.length/25));tablePage=Math.min(tablePage,max);
 if(!c.length)return '<div class="empty">Configure at least one visible column.</div>';
 if(!rows.length)return '<div class="empty"><strong>No matching records</strong>Change the filters, select another date or add an animal.</div>';
 const chunk=rows.slice((tablePage-1)*25,tablePage*25);
 return '<div class="table-wrap"><table><thead><tr><th aria-label="Favourite"></th>'+c.map(x=>'<th scope="col">'+esc(x.label)+'</th>').join('')+'<th scope="col">Status</th><th scope="col">Record</th></tr></thead><tbody>'+chunk.map(a=>'<tr><td><button class="star '+(state.favourites.includes(a.id)?'saved':'')+'" data-star="'+esc(a.id)+'" aria-label="'+(state.favourites.includes(a.id)?'Remove':'Add')+' favourite '+esc(a.id)+'" aria-pressed="'+state.favourites.includes(a.id)+'">'+(state.favourites.includes(a.id)?'★':'☆')+'</button></td>'+c.map(x=>'<td class="'+(x.key==='notes'?'note-cell':'')+'" title="'+esc(cell(a,x.key,at))+'">'+(x.key==='id'?'<button class="id-link" data-detail="'+esc(a.id)+'">'+esc(a.id)+'</button>':esc(cell(a,x.key,at))||'—')+'</td>').join('')+'<td><span class="tag '+(a.dod?'deceased':'')+'">'+(a.dod?'Deceased':'Living')+'</span></td><td><button class="text-button" data-detail="'+esc(a.id)+'">Details ↗</button></td></tr>').join('')+'</tbody></table></div><div class="table-foot"><span>'+rows.length+' matching record'+(rows.length!==1?'s':'')+' · exports include all matching rows</span><div class="pagination"><button data-pagination="-1"'+(tablePage===1?' disabled':'')+'>Previous</button><span>'+tablePage+' / '+max+'</span><button data-pagination="1"'+(tablePage===max?' disabled':'')+'>Next</button></div></div>';
}
function overview(){
 const living=state.animals.filter(a=>!a.dod),d=today(),week=new Date(d+'T12:00:00Z');week.setUTCDate(week.getUTCDate()-6);const start=week.toISOString().slice(0,10);
 const metrics=[['Living animals',living.length,'Across '+rooms().length+' rooms','◇'],['Occupied cages',new Set(living.map(a=>a.room+'/'+a.cage)).size,'Of '+state.locations.length+' configured cages','▦'],['Births this week',state.animals.filter(a=>a.dob>=start&&a.dob<=d).length,'By recorded birth date · last 7 days','＋'],['Deaths this week',state.animals.filter(a=>a.dod>=start&&a.dod<=d).length,'Historical records are retained','↺']];
 return heading('Colony overview','A clear view of your animals, locations and recent changes.',addButton)+'<div class="metrics">'+metrics.map(([t,n,note,sym])=>'<div class="metric"><div class="metric-top">'+t+'<span class="metric-symbol">'+sym+'</span></div><div class="metric-value">'+n+'</div><div class="metric-bottom">'+note+'</div></div>').join('')+'</div><div class="overview-grid"><section class="panel"><div class="panel-head"><div><h2>Animals by room</h2><p class="subtle">Current living stock</p></div><a href="#housing" class="text-button">View housing ↗</a></div><div class="room-summary">'+rooms().map(r=>'<a class="room-row" href="#stock" data-room="'+esc(r)+'"><span class="room-icon">▦</span><span class="room-info"><h3>'+esc(r)+'</h3><small>'+state.locations.filter(x=>x.room===r).length+' cages · Bat colony demo</small></span><span class="room-count">'+living.filter(x=>x.room===r).length+'<small>animals ↗</small></span></a>').join('')+'</div></section><section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p class="subtle">Every record change has a history</p></div><a href="#history" class="text-button">View all ↗</a></div><div class="activity">'+state.events.filter(e=>e.animalId).slice(-4).reverse().map(e=>'<div class="activity-item"><span class="event-dot"></span><div><p>'+esc(e.action)+' · <button class="id-link" data-detail="'+esc(e.animalId)+'">'+esc(e.animalId)+'</button></p><small>'+esc(e.at.slice(0,10))+' · '+esc(e.actor)+'</small></div></div>').join('')+'</div></section></div><div class="section-caption">EVERYDAY WORKFLOWS</div><div class="quick-links"><a class="quick-link" href="#stock"><span class="quick-icon">▤</span><div><h3>Browse the register</h3><small>Find and update animal records</small></div><span class="arrow">↗</span></a><a class="quick-link" href="#reports"><span class="quick-icon">◷</span><div><h3>Prepare a daily report</h3><small>Births, deaths and saved stock</small></div><span class="arrow">↗</span></a><button class="quick-link" data-action="columns"><span class="quick-icon">⚙</span><div style="text-align:left"><h3>Make it your own</h3><small>Configure columns and data fields</small></div><span class="arrow">↗</span></button></div>';
}
function register(){
 const title=page==='favourites'?'Favourites':filter.groupId?(state.groups.find(g=>g.id===filter.groupId)?.name||'Group'):'Animal register';
 const rows=filterAnimals(state.animals,{...filter,favourites:page==='favourites'?state.favourites:null,group:filter.groupId?state.groups.find(g=>g.id===filter.groupId)?.animalIds:null});
 return heading(title,'Find animals by ID, room, cage, lineage or notes.','<button class="button secondary" data-action="columns">⚙ Columns</button>'+exportButtons+addButton)+'<section class="panel"><div class="toolbar"><div class="search-wrap"><span aria-hidden="true">⌕</span><input id="search" aria-label="Search animal register" placeholder="Search animals, locations or notes…" value="'+esc(filter.search||'')+'"></div><select data-filter="room" aria-label="Filter by room">'+options(rooms(),filter.room,'All rooms')+'</select><select data-filter="cage" aria-label="Filter by cage">'+options(state.locations.filter(x=>!filter.room||x.room===filter.room).map(x=>x.cage),filter.cage,'All cages')+'</select><select data-filter="sex" aria-label="Filter by sex">'+options(['Female','Male','Unknown'],filter.sex,'All sexes')+'</select><select data-filter="line" aria-label="Filter by line">'+options([...new Set(state.animals.map(a=>a.line).filter(Boolean))],filter.line,'All lines')+'</select><select data-filter="status" aria-label="Filter by status"><option value="living"'+(filter.status==='living'?' selected':'')+'>Living</option><option value="deceased"'+(filter.status==='deceased'?' selected':'')+'>Deceased</option><option value="all"'+(filter.status==='all'?' selected':'')+'>All records</option></select><button class="text-button" data-action="clear">Clear filters</button></div><div id="register-table">'+table(rows)+'</div></section>';
}
function housing(){
 const living=state.animals.filter(a=>!a.dod);
 return heading('Rooms & cages','Browse living stock through its current location.',addButton)+'<div class="housing-grid">'+rooms().map(r=>'<section class="panel housing-panel"><div class="housing-title"><div class="room-icon">▦</div><div><h2>'+esc(r)+'</h2><p class="subtle">'+state.locations.filter(x=>x.room===r).length+' configured cages</p></div><span class="room-total">'+living.filter(a=>a.room===r).length+'</span></div>'+state.locations.filter(x=>x.room===r).map(x=>'<div class="cage-row"><span>'+esc(x.cage)+'</span><span>'+living.filter(a=>a.room===r&&a.cage===x.cage).length+' animals</span><button data-room="'+esc(r)+'" data-cage="'+esc(x.cage)+'">View records ↗</button></div>').join('')+'</section>').join('')+'</div><p class="subtle" style="margin-top:20px">Locations are demonstration settings. Real room and cage configuration will be agreed with the team.</p>';
}
function reports(){
 let rows;if(reportType==='full')rows=asOf(state,reportDate);else rows=state.animals.filter(a=>a[reportType==='birth'?'dob':'dod']&&(allDates||a[reportType==='birth'?'dob':'dod']===reportDate));
 const note=reportType==='full'?'Saved state known at the end of this day (UTC).':allDates?'Complete list, using currently known event dates.':'Events on this date, including later corrections.';
 return heading('Daily reports','Births, deaths and the complete saved register for a selected day.',exportButtons)+'<div class="callout">Full stock is a saved-state snapshot. Birth and death reports use the event date on the current record, including backdated corrections.</div><section class="panel"><div class="tabs" role="tablist" aria-label="Report type">'+[['full','Full stock'],['birth','Births'],['death','Deaths']].map(([k,t])=>'<button role="tab" aria-selected="'+(reportType===k)+'" class="tab '+(reportType===k?'active':'')+'" data-report="'+k+'">'+t+'</button>').join('')+'</div><div class="report-controls"><label for="report-date">Report date</label><input id="report-date" type="date" value="'+reportDate+'" max="'+today()+'"'+(allDates&&reportType!=='full'?' disabled':'')+'>'+(reportType!=='full'?'<label style="flex-direction:row;align-items:center"><input id="all-dates" type="checkbox"'+(allDates?' checked':'')+'> Show all dates</label>':'')+'<span class="report-note">'+note+'</span></div>'+ (rows===null?'<div class="empty"><strong>No snapshot available for this date</strong>The first saved state is '+esc(state.events[0].at.slice(0,10))+'.</div>':table(rows,reportType==="full"?reportDate:today()))+'</section>';
}
function openGroupForm(id=null){
 editingGroupId=id;const g=id?state.groups.find(x=>x.id===id):null;
 $('#group-form').reset();$('#group-title').textContent=g?'Edit research group':'Create research group';$('#group-form').querySelector('[type=submit]').textContent=g?'Save group':'Create group';$('#group-error').textContent='';
 $('#group-form').elements.name.value=g?.name||'';$('#group-form').elements.notes.value=g?.notes||'';
 $('#group-members').innerHTML='<legend>Animals</legend>'+state.animals.map(a=>'<label><input type="checkbox" name="members" value="'+esc(a.id)+'"'+(g?.animalIds.includes(a.id)?' checked':'')+'>'+esc(a.id)+' · '+esc(a.room)+' / '+esc(a.cage)+(a.dod?' · deceased':'')+'</label>').join('');
 $('#group-dialog').showModal();
}
function groups(){
 return heading('Research groups','Create cohorts and follow their membership and animal records over time.','<button class="button primary" data-action="group">＋ Create group</button>')+'<div class="groups-grid">'+state.groups.map(g=>'<section class="panel group-card"><div class="eyebrow">RESEARCH COHORT</div><h2>'+esc(g.name)+'</h2><p>'+esc(g.notes||'')+'</p><p>'+g.animalIds.length+' animal records · '+g.animalIds.filter(id=>state.animals.find(a=>a.id===id&&!a.dod)).length+' living</p><div>'+g.animalIds.slice(0,3).map(id=>'<span class="tag">'+esc(id)+'</span> ').join('')+'</div><button class="button secondary" data-track="'+esc(g.id)+'">Track group ↗</button> <button class="text-button" data-group="'+esc(g.id)+'">View stock</button></section>').join('')+'</div>';
}
function trackGroup(){
 const g=state.groups.find(x=>x.id===selectedGroupId);if(!g){selectedGroupId=null;return groups();}
 const timeline=groupTimeline(state,g.id);
 return heading(g.name,g.notes||'Research cohort tracking','<button class="button secondary" data-action="all-groups">All groups</button><button class="button secondary" data-group="'+esc(g.id)+'">View stock & export</button><button class="button primary" data-edit-group="'+esc(g.id)+'">Edit membership</button>')+'<div class="callout">Counts reflect saved group membership and animal state at each recorded day. Activity includes changes made while an animal was a member. All times are UTC.</div><div class="overview-grid"><section class="panel"><div class="panel-head"><h2>Group over time</h2></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Members</th><th>Living</th><th>Deceased</th></tr></thead><tbody>'+timeline.days.map(d=>'<tr><td>'+d.date+'</td><td>'+d.members+'</td><td>'+d.living+'</td><td>'+d.deceased+'</td></tr>').join('')+'</tbody></table></div></section><section class="panel"><div class="panel-head"><h2>Current membership</h2><span class="tag">'+g.animalIds.length+' records</span></div><div class="activity">'+g.animalIds.map(id=>{const a=state.animals.find(x=>x.id===id);return '<div class="activity-item"><span class="event-dot"></span><div><button class="id-link" data-detail="'+esc(id)+'">'+esc(id)+'</button><p class="subtle">'+esc(a?.room||'Unknown')+' / '+esc(a?.cage||'Unknown')+' · '+(a?.dod?'Deceased':'Living')+'</p></div></div>';}).join('')+'</div></section></div><section class="panel"><div class="panel-head"><h2>Cohort activity & membership history</h2></div>'+timeline.events.reverse().map(historyItem).join('')+'</section>';
}
function historyItem(e){
 const labels={id:'Animal ID',species:'Species',sex:'Sex',room:'Room',cage:'Cage',line:'Line',pob:'Place of birth',mother:'Parent 1',father:'Parent 2',dob:'Date of birth',dod:'Date of death',notes:'Notes'};
 let changes=[];
 if(e.before&&e.after){for(const k of Object.keys(labels))if(e.before[k]!==e.after[k])changes.push(labels[k]+': '+(e.before[k]||'—')+' → '+(e.after[k]||'—'));for(const f of state.columns.filter(x=>x.custom))if((e.before.extra?.[f.key]||'')!==(e.after.extra?.[f.key]||''))changes.push(f.label+': '+(e.before.extra?.[f.key]||'—')+' → '+(e.after.extra?.[f.key]||'—'));}
 else if(e.groupAfter){const before=e.groupBefore?.animalIds||[],after=e.groupAfter.animalIds;changes=['Group: '+e.groupAfter.name];const added=after.filter(id=>!before.includes(id)),removed=before.filter(id=>!after.includes(id));if(added.length)changes.push('Members added: '+added.join(', '));if(removed.length)changes.push('Members removed: '+removed.join(', '));if(e.groupBefore?.notes!==e.groupAfter.notes)changes.push('Research notes: '+(e.groupAfter.notes||'—'));}
 else changes=[e.action==='Demo baseline'?'Initial synthetic records.':e.action==='Columns updated'?'Column layout or field definitions changed.':'A new record was added.'];
 return '<div class="history-row"><div class="history-time">'+esc(e.at.slice(0,10))+'<span>'+esc(e.at.slice(11,16))+' UTC · '+esc(e.actor)+'</span></div><div><div class="history-title">'+esc(e.action)+(e.animalId?' · '+esc(e.animalId):'')+'</div><div class="history-changes">'+esc(changes.length?changes.join('\n'):'No data values changed.')+'</div></div></div>';
}
function history(){return heading('Record history','Before-and-after values for animal edits, with the time they were saved.')+'<div class="callout">The shared system must preserve a rolling five-year history of all bat data and changes. This browser-local demo does not guarantee that retention; protected shared storage and authenticated users are still required.</div><section class="panel">'+[...state.events].reverse().map(historyItem).join('')+'</section>';}
function brief(){
 return heading('Project brief','A working interpretation of the meeting notes, ready for team review.')+'<div class="brief-grid">'+[
 ['01 · AGREED DIRECTION','Bats first. Ready to expand.',['Individual animal stock, rooms, cages and place of birth.','Species is stored per animal to support other animals in future.','Everyone on the team can view and edit.','Columns, labels and custom data fields are configurable.']],
 ['02 · WORKING PROTOTYPE','Everyday colony management',['Search, location/sex/line/status filters and favourites.','Animal records, birth/death dates and named groups.','Daily Birth, Death and Full stock reports.','Readable Excel export in the configured column order.']],
 ['03 · TO CONFIRM','Decisions for the next iteration',['The precise bat species and any genetics fields.','ID format, estimated dates and custom field definitions.','Research cohort tracking and membership conventions.','Retention triggers and any longer required retention periods.']],
 ['04 · NEXT BUILD','Shared university workspace',['Choose university hosting and institutional sign-in.','Build shared storage with protected history and five-year retention.','Validate spreadsheet imports and duplicates.','Pilot with representative anonymised data.']],
 ['05 · REQUIRED HISTORY','Rolling five-year records',['Retain all bat data and changes for a rolling five years.','Keep actor, original/corrected values and event/save dates.','Preserve field definitions and research-group membership history.','Confirm legal retention triggers before any record disposal.']]
 ].map(([s,t,items])=>'<section class="panel brief-card"><div class="step">'+s+'</div><h2>'+t+'</h2><ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>').join('')+'</div>';
}
function render(){ currentRows=[];
 page=pages.includes(location.hash.slice(1))?location.hash.slice(1):'overview';
 document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#nav-count').textContent=state.animals.filter(a=>!a.dod).length;
 const screens={overview,stock:register,housing,reports,groups:()=>selectedGroupId?trackGroup():groups(),favourites:register,history,brief};
 $('#main').innerHTML=(storageIssue?'<div class="callout storage-error">'+esc(storageIssue)+'</div>':'')+screens[page]();
}
function go(target,nextFilter){if(nextFilter)pendingFilter=nextFilter;if(page===target){if(nextFilter)filter=nextFilter;pendingFilter=null;tablePage=1;render();}else location.hash=target;}
window.addEventListener('hashchange',()=>{filter=pendingFilter||{status:location.hash==='#favourites'?'all':'living'};pendingFilter=null;tablePage=1;render();});
function cages(room,selected=''){const c=state.locations.filter(x=>x.room===room).map(x=>x.cage);$('#record-form').elements.cage.innerHTML=options(c,selected);}
function openRecord(id=null){
 editId=id;const a=id?state.animals.find(x=>x.id===id):null,f=$('#record-form');f.reset();$('#form-errors').textContent='';$('#record-title').textContent=id?'Edit '+id:'Add animal';f.elements.id.readOnly=!!id;
 f.elements.room.innerHTML=options(rooms(),a?.room||rooms()[0]);cages(f.elements.room.value,a?.cage);
 for(const k of ['id','species','sex','line','room','cage','dob','dod','mother','father','pob','notes'])f.elements[k].value=a?.[k]??(k==='sex'?'Unknown':k==='species'?'Bat':k==='room'?rooms()[0]:k==='cage'?state.locations[0].cage:'');
 f.elements.dob.max=today();f.elements.dod.max=today();
 $('#parent-ids').innerHTML=state.animals.filter(x=>x.id!==id).map(x=>'<option value="'+esc(x.id)+'"></option>').join('');
 $('#custom-inputs').innerHTML=state.columns.filter(x=>x.custom).map(x=>'<label>'+esc(x.label)+(x.type==='select'?'<select name="'+x.key+'">'+options(x.options,a?.extra?.[x.key],'Not specified')+'</select>':'<input name="'+x.key+'" type="'+(x.type==='text'?'text':x.type)+'"'+(x.type==='number'?' step="any"':' maxlength="1000"')+' value="'+esc(a?.extra?.[x.key]??'')+'">')+'</label>').join('');
 $('#record-dialog').showModal();
}
function detail(id){
 const a=currentRows.find(x=>x.id===id)||state.animals.find(x=>x.id===id);if(!a)return;
 const historical=page==='reports'&&reportType==='full';
 const fields=[['Species',a.species],['Sex',a.sex],['Room / cage',a.room+' / '+a.cage],['Line',a.line],['Age',age(a.dob,historical?reportDate:today(),a.dod)],['Birth date',a.dob],['Death date',a.dod],['Parent 1',a.mother],['Parent 2',a.father],['Place of birth',a.pob],...state.columns.filter(x=>x.custom).map(f=>[f.label,a.extra?.[f.key]])];
 $('#detail-content').innerHTML='<div class="dialog-heading"><div><div class="eyebrow">'+(historical?'SAVED STATE · '+reportDate:'ANIMAL RECORD')+'</div><h2>'+esc(a.id)+'</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Close animal details">×</button></div><dl class="detail-grid">'+fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v||'Unknown / not specified')+'</dd></div>').join('')+'</dl><h3>Notes</h3><p class="detail-notes">'+esc(a.notes||'No notes recorded.')+'</p>'+(historical?'<p class="subtle">This is the saved record at the selected date. Open the current register to edit.</p>':'<button class="button primary" data-edit="'+esc(a.id)+'">Edit record</button>')+'<div class="detail-history"><h3>Record history</h3>'+state.events.filter(e=>e.animalId===id&&(!historical||e.at.slice(0,10)<=reportDate)).reverse().map(historyItem).join('')+'</div>';
 $('#detail-dialog').showModal();
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportFile(format){
 if(page==='reports'&&reportType==='full'&&asOf(state,reportDate)===null){notify('No snapshot is available for this date.');return;}
 if(!state.columns.some(x=>x.visible)){notify('Choose at least one visible column.');return;}
 const at=page==='reports'&&reportType==='full'?reportDate:today(),rows=exportRows(currentRows,at,state.columns);
 const name='colony-'+(page==='reports'?reportType+'-'+(allDates&&reportType!=='full'?'all-dates':reportDate):page+'-'+today());
 download(format==='xlsx'?workbook(rows):csv(rows),name+'.'+format,format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8');
 notify('Exported '+currentRows.length+' records in your column order.');
}
function renderColumns(){
 $('#column-list').innerHTML=columnDraft.map((c,i)=>'<div class="column-row"><input type="checkbox" data-visible="'+i+'" aria-label="Show '+esc(c.label)+'"'+(c.visible?' checked':'')+'><input type="text" data-label="'+i+'" aria-label="Heading for '+esc(c.label)+'" maxlength="60" value="'+esc(c.label)+'"><small>'+esc(c.custom?c.type:'standard')+'</small><button data-move="'+i+'" data-direction="-1" aria-label="Move '+esc(c.label)+' up"'+(i===0?' disabled':'')+'>↑</button><button data-move="'+i+'" data-direction="1" aria-label="Move '+esc(c.label)+' down"'+(i===columnDraft.length-1?' disabled':'')+'>↓</button></div>').join('');
}
function openColumns(){columnDraft=structuredClone(state.columns);$('#field-form').reset();$('#field-error').textContent='';renderColumns();$('#columns-dialog').showModal();}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,a');if(!b)return;
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(b.dataset.action){
  const a=b.dataset.action;
  if(a==='add')openRecord();
  if(a==='columns')openColumns();
  if(a==='xlsx'||a==='csv')exportFile(a);
  if(a==='clear'){filter={status:page==='favourites'?'all':'living'};tablePage=1;render();}
  if(a==='group')openGroupForm();
  if(a==='all-groups'){selectedGroupId=null;render();}
 }
 if(b.dataset.detail)detail(b.dataset.detail);
 if(b.dataset.edit){$('#detail-dialog').close();openRecord(b.dataset.edit);}
 if(b.dataset.star){if(mutate(n=>{n.favourites=n.favourites.includes(b.dataset.star)?n.favourites.filter(x=>x!==b.dataset.star):[...n.favourites,b.dataset.star];}))render();}
 if(b.dataset.room){e.preventDefault();go('stock',{status:'living',room:b.dataset.room,cage:b.dataset.cage||''});}
 if(b.dataset.track){selectedGroupId=b.dataset.track;go('groups');}
 if(b.dataset.editGroup)openGroupForm(b.dataset.editGroup);
 if(b.dataset.group)go('stock',{status:'all',groupId:b.dataset.group});
 if(b.dataset.pagination){tablePage+=Number(b.dataset.pagination);render();}
 if(b.dataset.report){reportType=b.dataset.report;tablePage=1;render();}
 if(b.dataset.move){const i=Number(b.dataset.move),j=i+Number(b.dataset.direction);[columnDraft[i],columnDraft[j]]=[columnDraft[j],columnDraft[i]];renderColumns();}
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.id==='search'){filter.search=el.value;tablePage=1;$('#register-table').innerHTML=table(filterAnimals(state.animals,{...filter,favourites:page==='favourites'?state.favourites:null,group:filter.groupId?state.groups.find(g=>g.id===filter.groupId)?.animalIds:null}));}
 if(el.dataset.label!==undefined)columnDraft[Number(el.dataset.label)].label=el.value;
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.dataset.filter){filter[el.dataset.filter]=el.value;if(el.dataset.filter==='room')filter.cage='';tablePage=1;render();}
 if(el.id==='report-date'){if(!el.value||el.value>today()){notify('Choose a valid date up to today.');return;}reportDate=el.value;tablePage=1;render();}
 if(el.id==='all-dates'){allDates=el.checked;tablePage=1;render();}
 if(el.dataset.visible!==undefined)columnDraft[Number(el.dataset.visible)].visible=el.checked;
});
$('#record-form').elements.room.addEventListener('change',e=>cages(e.target.value));
$('#record-form').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,a={extra:{}};
 for(const k of ['id','species','sex','line','room','cage','dob','dod','mother','father','pob','notes'])a[k]=f.elements[k].value.trim();
 for(const c of state.columns.filter(x=>x.custom))a.extra[c.key]=f.elements[c.key].value.trim();
 const errors=validateAnimal(a,state.animals,state.locations,editId,today(),state.columns);
 if(errors.length){$('#form-errors').innerHTML='<ul>'+errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';return;}
 if(commit(saveAnimal(state,a,'Demo researcher',new Date().toISOString(),editId))){$('#record-dialog').close();render();notify('Record saved with its change history.');}
});
$('#group-form').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,name=f.elements.name.value.trim(),members=[...f.querySelectorAll('[name=members]:checked')].map(x=>x.value);
 if(!name||!members.length||state.groups.some(g=>g.id!==editingGroupId&&g.name.toLowerCase()===name.toLowerCase())){$('#group-error').textContent='Enter a unique group name and select at least one animal.';return;}
 const group={id:editingGroupId||crypto.randomUUID(),name,notes:f.elements.notes.value.trim(),animalIds:members};
 if(commit(saveGroup(state,group,'Demo researcher'))){selectedGroupId=group.id;$('#group-dialog').close();render();notify('Research group saved with membership history.');}
});
$('#field-form').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,label=f.elements.label.value.trim(),type=f.elements.type.value,opts=[...new Set(f.elements.options.value.split(',').map(x=>x.trim()).filter(Boolean))];
 if(!label||columnDraft.some(c=>c.label.toLowerCase()===label.toLowerCase())||(type==='select'&&!opts.length)){$('#field-error').textContent='Use a unique heading and supply choices for a dropdown.';return;}
 columnDraft.push({key:'custom_'+crypto.randomUUID().replaceAll('-',''),label,type,options:opts,custom:true,visible:true});f.reset();$('#field-error').textContent='';renderColumns();
});
$('#save-columns').addEventListener('click',()=>{
 if(!columnDraft.some(c=>c.visible)||columnDraft.some(c=>!c.label.trim())||new Set(columnDraft.map(c=>c.label.trim().toLowerCase())).size!==columnDraft.length){$('#field-error').textContent='Keep at least one visible column and use non-empty, unique headings.';return;}
 if(mutate(n=>{n.columns=columnDraft.map(c=>({...c,label:c.label.trim()}));n.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor:'Demo researcher',action:'Columns updated',animalId:'',before:null,after:null,snapshot:structuredClone(n.animals)});})){ $('#columns-dialog').close();render();notify('Column layout saved. The register and exports now use this layout.');}
});
$('#backup').addEventListener('click',()=>download(JSON.stringify(state,null,2),'colony-demo-backup-'+today()+'.json','application/json'));
window.addEventListener('storage',e=>{if(e.key===key)notify('Data changed in another tab. Reload to use its latest saved state.');});
render();

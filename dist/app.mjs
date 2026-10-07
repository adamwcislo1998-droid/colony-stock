import {utcDay,dailyTables,saveDaily,automaticDaily,isPresent} from './daily.mjs';
import {validateResearch,saveResearch,researchPage,renderResearchForm} from './research.mjs';
import {validateEventDates,recoveryPreview,recoverAnimals,moveCage,pedigreeMarkup} from './extensions.mjs';
import {today,age,initialState,validateAnimal,saveAnimal,asOf,filterAnimals,cell,exportRows,csv,defaultColumns,saveGroup,groupTimeline} from './core.mjs';
import {workbook,zip} from './xlsx.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const key='st-andrews-colony-v1',pages=['overview','stock','housing','reports','groups','favourites','history','brief','research','recovery'];
let raw=null,state,storageIssue='',page='overview',filter={status:'living'},tablePage=1,reportType='full',reportDate=utcDay(),allDates=false,currentRows=[],editId=null,columnDraft=[],pendingFilter=null,toastTimer,selectedGroupId=null,editingGroupId=null,formRevision=null,groupRevision=null,researchRevision=null,researchFieldDraft=[],role='researcher',researchFilters={},editingResearchId=null;
try{
 raw=localStorage.getItem(key);state=raw?JSON.parse(raw):initialState();
 if(state.version!==1||!Array.isArray(state.animals)||!Array.isArray(state.events)||!Array.isArray(state.locations)||!Array.isArray(state.groups)||!Array.isArray(state.favourites))throw new Error('Unsupported demo data.');
 if(!Array.isArray(state.columns))state.columns=defaultColumns();
}catch{state=initialState();storageIssue='Saved data could not be read. Demo records are shown in memory; existing browser data has not been overwritten.';}
const actor=()=>({name:'Demo '+role,role});
const actorName=()=>actor().name;
const canEdit=()=>role!=='student';
const sexChoices=()=>state.columns.find(c=>c.key==='sex')?.options||['Female','Male','Unknown'];
state.dailyRecords??=[];state.researchEntries??=[];state.researchFields??=[];
state.researchTypes??=['Behaviour','Surgery','Harvest','Swab sampling','Wing punch','Other'];
state.settings??={autoDaily:true};state.automaticStarted??=utcDay();
if(!state.locations.some(l=>l.room==='Communal room'))state.locations.push({room:'Communal room',cage:''});
for(const [key,label] of [['arrived','Arrival date'],['departed','Departure date']])if(!state.columns.some(c=>c.key===key))state.columns.push({key,label,visible:false,type:'date',custom:false});
function notify(s){$('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
async function commit(next,expected=raw){
 if(storageIssue){notify('Storage is unavailable. Download a backup before continuing.');return false;}
 if(!navigator.locks){notify('Safe saving needs a browser with Web Locks on localhost or HTTPS. Download a backup.');return false;}
 return navigator.locks.request(key,async()=>{
  try{
   if(raw!==expected||localStorage.getItem(key)!==expected){notify('Data changed while you were working. Reload to reconcile; your form is still open.');return false;}
   const text=JSON.stringify(next);localStorage.setItem(key,text);raw=text;state=next;return true;
  }catch{notify('The save failed: browser storage is unavailable or full. Your previous data is unchanged.');return false;}
 });
}
async function mutate(fn){const n=structuredClone(state);fn(n);return commit(n);}
const rooms=()=>[...new Set(state.locations.map(x=>x.room))];
const options=(items,selected='',first='')=>(first?'<option value="">'+esc(first)+'</option>':'')+items.map(v=>'<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
function heading(title,subtitle,actions=''){actions='<button class="help-button" data-help="'+page+'" aria-label="Help for '+esc(title)+'">i</button>'+actions;return '<div class="page-heading"><div><div class="eyebrow">COLONY MANAGEMENT</div><h1>'+esc(title)+'</h1><p class="subtle">'+esc(subtitle)+'</p></div><div class="heading-actions">'+actions+'</div></div>';}
const addButton='<button class="button primary" data-action="add">＋ Add animal</button>';
const exportButtons='<button class="button secondary" data-action="xlsx">↓ Export Excel</button><button class="text-button" data-action="csv">CSV</button>';
function table(rows,at=utcDay(),schema=state.columns){
 currentRows=rows;const c=schema.filter(x=>x.visible!==false),max=Math.max(1,Math.ceil(rows.length/25));tablePage=Math.min(tablePage,max);
 if(!c.length)return '<div class="empty">Configure at least one visible column.</div>';
 if(!rows.length)return '<div class="empty"><strong>No matching records</strong>Change the filters, select another date or add an animal.</div>';
 const chunk=rows.slice((tablePage-1)*25,tablePage*25);
 return '<div class="table-wrap"><table><thead><tr><th aria-label="Favourite"></th>'+c.map(x=>'<th scope="col">'+esc(x.label)+'</th>').join('')+'<th scope="col">Status</th><th scope="col">Record</th></tr></thead><tbody>'+chunk.map(a=>'<tr><td><button class="star '+(state.favourites.includes(a.id)?'saved':'')+'" data-star="'+esc(a.id)+'" aria-label="'+(state.favourites.includes(a.id)?'Remove':'Add')+' favourite '+esc(a.id)+'" aria-pressed="'+state.favourites.includes(a.id)+'">'+(state.favourites.includes(a.id)?'★':'☆')+'</button></td>'+c.map(x=>'<td class="'+(x.key==='notes'?'note-cell':'')+'" title="'+esc(cell(a,x.key,at))+'">'+(x.key==='id'?'<button class="id-link" data-detail="'+esc(a.id)+'">'+esc(a.id)+'</button>':esc(cell(a,x.key,at))||'—')+'</td>').join('')+'<td><span class="tag '+(a.dod?'deceased':'')+'">'+(a.archived?'Archived':a.dod?'Deceased':a.departed?'Departed':'Living')+'</span></td><td><button class="text-button" data-detail="'+esc(a.id)+'">Details ↗</button></td></tr>').join('')+'</tbody></table></div><div class="table-foot"><span>'+rows.length+' matching record'+(rows.length!==1?'s':'')+' · exports include all matching rows</span><div class="pagination"><button data-pagination="-1"'+(tablePage===1?' disabled':'')+'>Previous</button><span>'+tablePage+' / '+max+'</span><button data-pagination="1"'+(tablePage===max?' disabled':'')+'>Next</button></div></div>';
}
function overview(){
 const living=state.animals.filter(a=>isPresent(a,utcDay())),d=utcDay(),week=new Date(d+'T12:00:00Z');week.setUTCDate(week.getUTCDate()-6);const start=week.toISOString().slice(0,10);
 const metrics=[['Living animals',living.length,'Across '+rooms().length+' rooms','◇'],['Occupied cages',new Set(living.filter(a=>a.cage).map(a=>a.room+'/'+a.cage)).size,'Of '+state.locations.filter(x=>x.cage).length+' configured cages','▦'],['Births this week',state.animals.filter(a=>a.dob>=start&&a.dob<=d).length,'By recorded birth date · last 7 days','＋'],['Deaths this week',state.animals.filter(a=>a.dod>=start&&a.dod<=d).length,'Historical records are retained','↺']];
 return heading('Colony overview','A clear view of your animals, locations and recent changes.',addButton)+'<div class="metrics">'+metrics.map(([t,n,note,sym])=>'<div class="metric"><div class="metric-top">'+t+'<span class="metric-symbol">'+sym+'</span></div><div class="metric-value">'+n+'</div><div class="metric-bottom">'+note+'</div></div>').join('')+'</div><div class="overview-grid"><section class="panel"><div class="panel-head"><div><h2>Animals by room</h2><p class="subtle">Current living stock</p></div><a href="#housing" class="text-button">View housing ↗</a></div><div class="room-summary">'+rooms().map(r=>'<a class="room-row" href="#stock" data-room="'+esc(r)+'"><span class="room-icon">▦</span><span class="room-info"><h3>'+esc(r)+'</h3><small>'+state.locations.filter(x=>x.room===r&&x.cage).length+' cages · Bat colony demo</small></span><span class="room-count">'+living.filter(x=>x.room===r).length+'<small>animals ↗</small></span></a>').join('')+'</div></section><section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p class="subtle">Every record change has a history</p></div><a href="#history" class="text-button">View all ↗</a></div><div class="activity">'+state.events.filter(e=>e.animalId).slice(-4).reverse().map(e=>'<div class="activity-item"><span class="event-dot"></span><div><p>'+esc(e.action)+' · <button class="id-link" data-detail="'+esc(e.animalId)+'">'+esc(e.animalId)+'</button></p><small>'+esc(e.at.slice(0,10))+' · '+esc(e.actor)+'</small></div></div>').join('')+'</div></section></div><div class="section-caption">EVERYDAY WORKFLOWS</div><div class="quick-links"><a class="quick-link" href="#stock"><span class="quick-icon">▤</span><div><h3>Browse the register</h3><small>Find and update animal records</small></div><span class="arrow">↗</span></a><a class="quick-link" href="#reports"><span class="quick-icon">◷</span><div><h3>Prepare a daily report</h3><small>Births, deaths and saved stock</small></div><span class="arrow">↗</span></a><button class="quick-link" data-action="columns"><span class="quick-icon">⚙</span><div style="text-align:left"><h3>Make it your own</h3><small>Configure columns and data fields</small></div><span class="arrow">↗</span></button></div>';
}
function register(){
 const title=page==='favourites'?'Favourites':filter.groupId?(state.groups.find(g=>g.id===filter.groupId)?.name||'Group'):'Animal register';
 const rows=filterAnimals(state.animals,{...filter,favourites:page==='favourites'?state.favourites:null,group:filter.groupId?state.groups.find(g=>g.id===filter.groupId)?.animalIds:null});
 return heading(title,'Find animals by ID, room, cage, lineage or notes.','<button class="button secondary" data-action="columns">⚙ Columns</button>'+exportButtons+addButton)+'<section class="panel"><div class="toolbar"><div class="search-wrap"><span aria-hidden="true">⌕</span><input id="search" aria-label="Search animal register" placeholder="Search animals, locations or notes…" value="'+esc(filter.search||'')+'"></div><select data-filter="room" aria-label="Filter by room">'+options(rooms(),filter.room,'All rooms')+'</select><select data-filter="cage" aria-label="Filter by cage">'+options([...new Set(state.locations.filter(x=>x.cage&&(!filter.room||x.room===filter.room)).map(x=>x.cage))],filter.cage,'All cages')+'</select><select data-filter="sex" aria-label="Filter by sex">'+options(sexChoices(),filter.sex,'All sexes')+'</select><select data-filter="line" aria-label="Filter by line">'+options([...new Set(state.animals.map(a=>a.line).filter(Boolean))],filter.line,'All lines')+'</select><select data-filter="status" aria-label="Filter by status"><option value="living"'+(filter.status==='living'?' selected':'')+'>Living</option><option value="deceased"'+(filter.status==='deceased'?' selected':'')+'>Deceased</option><option value="departed"'+(filter.status==='departed'?' selected':'')+'>Departed</option><option value="all"'+(filter.status==='all'?' selected':'')+'>All records</option></select><button class="text-button" data-action="clear">Clear filters</button></div><div id="register-table">'+table(rows)+'</div></section>';
}
function housing(){
 const living=state.animals.filter(a=>isPresent(a,utcDay()));
 return heading('Rooms & cages','Locate animals in cages or communal accommodation.','<button class="button secondary" data-action="location-add">＋ Add room / cage</button>'+addButton)+'<div class="housing-grid">'+rooms().map(r=>'<section class="panel housing-panel"><div class="housing-title"><div class="room-icon">▦</div><div><h2>'+esc(r)+'</h2><p class="subtle">'+state.locations.filter(x=>x.room===r&&x.cage).length+' cages · '+living.filter(a=>a.room===r&&!a.cage).length+' uncaged</p></div><span class="room-total">'+living.filter(a=>a.room===r).length+'</span></div><div class="cage-row"><span>Whole room</span><button data-room="'+esc(r)+'">View all occupants ↗</button></div><div class="cage-row"><span>Communal / no cage</span><span>'+living.filter(a=>a.room===r&&!a.cage).length+' animals</span><button data-communal="'+esc(r)+'">View records ↗</button></div>'+state.locations.filter(x=>x.room===r&&x.cage).map(x=>'<div class="cage-row"><span>'+esc(x.cage)+'</span><span>'+living.filter(a=>a.room===r&&a.cage===x.cage).length+' animals</span><button data-room="'+esc(r)+'" data-cage="'+esc(x.cage)+'">View ↗</button></div><div class="cage-row"><label>Move cage<select data-cage-target="'+esc(x.cage)+'" data-source-room="'+esc(r)+'">'+options(rooms().filter(room=>room!==r),'','Select destination')+'</select></label><button data-move-cage="'+esc(x.cage)+'" data-source-room="'+esc(r)+'">Review move</button></div>').join('')+'</section>').join('')+'</div>';
}
const reportKey=()=>({full:'stock',birth:'births',death:'deaths'}[reportType]);
function reports(){
 const record=state.dailyRecords.find(r=>r.date===reportDate),current=reportDate===utcDay(),tables=record?.tables||(current?dailyTables(state.animals,reportDate):null),rows=tables?.[reportKey()]||null;
 const unsaved=record&&current&&JSON.stringify(record.animals)!==JSON.stringify(state.animals);
 const status=record?(record.source==='automatic'?'Automatic':'Manual')+' · version '+record.revision+' · '+(current?'Replaceable today':'Final'):current?'Not saved · live preview':'No saved daily record';
 return heading('Daily reports','One daily set: stock, births and deaths. Dates use UTC in this prototype.','<button class="button secondary" data-action="daily-csv"'+(!record?' disabled':'')+'>↓ Three CSV tables</button>'+exportButtons+(current?'<button class="button primary" data-action="save-daily">'+(record?'Replace today’s record':'Save today’s record')+'</button>':''))+'<div class="callout">Same-day saves replace the daily set. Earlier days are final. Changes made after a manual save appear here when you save again; midnight keeps an existing manual record.</div><section class="panel"><div class="daily-summary"><strong>'+esc(reportDate)+'</strong><span class="daily-status '+(record?.source==='automatic'?'auto':'')+'">'+esc(status)+'</span>'+(record?'<span class="subtle">'+(unsaved?'<strong>Changes since save — save again.</strong> ':'')+'Captured '+esc(record.savedAt)+' by '+esc(record.actor)+'</span>':'')+'</div><div class="tabs" role="tablist" aria-label="Report type">'+[['full','Current stock'],['birth','Births'],['death','Deaths']].map(([k,t])=>'<button role="tab" aria-selected="'+(reportType===k)+'" class="tab '+(reportType===k?'active':'')+'" data-report="'+k+'">'+t+(tables?' · '+tables[({full:'stock',birth:'births',death:'deaths'}[k])].length:'')+'</button>').join('')+'</div><div class="report-controls"><label for="report-date">Report date</label><input id="report-date" type="date" value="'+reportDate+'" max="'+utcDay()+'"><label class="inline-check"><input id="auto-daily" type="checkbox"'+(state.settings.autoDaily!==false?' checked':'')+' '+(role!=='administrator'?'disabled':'')+'> Automatic fallback enabled</label><span class="report-note">Automatic fallback runs while this tab is open, or checks yesterday on reopening.</span></div>'+(rows===null?'<div class="empty"><strong>No daily record was saved</strong>Past records cannot be created retrospectively.</div>':table(rows,reportDate,record?.exportColumns||state.columns))+'</section><section class="panel" style="margin-top:20px"><div class="panel-head"><h2>Saved dates</h2></div><div class="activity">'+[...state.dailyRecords].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(r=>'<div class="activity-item"><button class="id-link" data-daily-date="'+r.date+'">'+r.date+'</button><span class="tag">'+esc(r.source)+' · v'+r.revision+'</span><span>'+r.tables.stock.length+' stock · '+r.tables.births.length+' births · '+r.tables.deaths.length+' deaths</span></div>').join('')+'</div></section>';
}
function openGroupForm(id=null){
 groupRevision=raw;editingGroupId=id;const g=id?state.groups.find(x=>x.id===id):null;
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
 const labels={arrived:'Arrival date',departed:'Departure date',id:'Animal ID',species:'Species',sex:'Sex',room:'Room',cage:'Cage',line:'Line',pob:'Place of birth',mother:'Parent 1',father:'Parent 2',dob:'Date of birth',dod:'Date of death',notes:'Notes'};
 let changes=[];
 if(e.researchAfter){changes=['Activity: '+e.researchAfter.type,'Animals: '+e.researchAfter.animalIds.join(', '),e.researchAfter.notes||''];}
 else if(e.dailyAfter){changes=['Daily '+e.dailyAfter.date+' · '+e.dailyAfter.source+' · revision '+e.dailyAfter.revision];}
 else if(e.recoveryDate){changes=['Recovered animal baseline from '+e.recoveryDate+'. Daily records and research entries were preserved.'];}
 else if(e.locationAfter){changes=['Location: '+JSON.stringify(e.locationBefore||'new')+' → '+JSON.stringify(e.locationAfter)];}
 else if(e.before&&e.after){for(const k of Object.keys(labels))if(e.before[k]!==e.after[k])changes.push(labels[k]+': '+(e.before[k]||'—')+' → '+(e.after[k]||'—'));for(const f of state.columns.filter(x=>x.custom))if((e.before.extra?.[f.key]||'')!==(e.after.extra?.[f.key]||''))changes.push(f.label+': '+(e.before.extra?.[f.key]||'—')+' → '+(e.after.extra?.[f.key]||'—'));}
 else if(e.groupAfter){const before=e.groupBefore?.animalIds||[],after=e.groupAfter.animalIds;changes=['Group: '+e.groupAfter.name];const added=after.filter(id=>!before.includes(id)),removed=before.filter(id=>!after.includes(id));if(added.length)changes.push('Members added: '+added.join(', '));if(removed.length)changes.push('Members removed: '+removed.join(', '));if(e.groupBefore?.notes!==e.groupAfter.notes)changes.push('Research notes: '+(e.groupAfter.notes||'—'));}
 else if(e.schemaAfter){changes=['Animal and research field definitions saved, including their previous definitions.'];}
 else changes=[e.action==='Demo baseline'?'Initial synthetic records.':e.action==='Columns updated'?'Column layout or field definitions changed.':'A new record was added.'];
 return '<div class="history-row"><div class="history-time">'+esc(e.at.slice(0,10))+'<span>'+esc(e.at.slice(11,16))+' UTC · '+esc(e.actor)+'</span></div><div><div class="history-title">'+esc(e.action)+(e.animalId?' · '+esc(e.animalId):'')+'</div><div class="history-changes">'+esc(changes.length?changes.join('\n'):'No data values changed.')+'</div></div></div>';
}
function history(){return heading('Record history','Before-and-after values for animal edits, with the time they were saved.')+'<div class="callout">The shared system must preserve a rolling five-year history of all bat data and changes. This browser-local demo does not guarantee that retention; protected shared storage and authenticated users are still required.</div><section class="panel">'+[...state.events].reverse().map(historyItem).join('')+'</section>';}
function brief(){
 return heading('Project brief','Agreed scope and remaining production decisions.')+'<div class="brief-grid">'+[
 ['01 · DAILY RECORDS','Three tables per day',['Current stock, births today and deaths today, with readable CSV copies.','Manual saves replace the same-day set; earlier days are immutable.','Clearly labelled automatic fallback if no manual record exists.','UTC is the provisional cutoff. Automatic saving can be disabled.']],
 ['02 · RESEARCH','Individuals, cohorts and pedigree',['Track group membership and individual activity over time.','Starter activities: behaviour, surgery, harvest, swab sampling and wing punch.','Researchers define typed fields, choices and required values.','Pedigree shows recorded ancestors and children.']],
 ['03 · HOUSING','Rooms with optional cages',['Room-based stock with communal accommodation allowed.','Cages have room locations and occupant lists.','Move a cage and its occupants together, preserving history.','Record arrivals and departures alongside births and deaths.']],
 ['04 · SAFE EDITING','Controlled changes and recovery',['Student, researcher and administrator role previews.','Unique immutable animal IDs; configurable data and uncertainty choices.','Stale-tab detection and confirmation for large edits.','Recover an animal baseline without erasing daily records or history.']],
 ['05 · HANDOVER','Help and durable production storage',['Section information buttons and explanations of workflows.','A shared SQL database, protected history and encrypted backups are required.','CSV export is the reporting format; it is not a full application backup.','University hosting, sign-in, roles and support ownership remain to be agreed.']],
 ['06 · SCOPE','Prototype first',['Synthetic records in this browser; about 170 bats expected in real use.','Production decisions follow successful prototype review.','Multiple separate databases are deferred.','Browser role previews and local saving are not production security.']]
 ].map(([step,title,items])=>'<section class="panel brief-card"><div class="step">'+step+'</div><h2>'+title+'</h2><ul>'+items.map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul></section>').join('')+'</div>';
}
function render(){ currentRows=[];
 page=pages.includes(location.hash.slice(1))?location.hash.slice(1):'overview';
 document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#nav-count').textContent=state.animals.filter(a=>isPresent(a,utcDay())).length;
 const screens={overview,stock:register,housing,reports,groups:()=>selectedGroupId?trackGroup():groups(),favourites:register,history,brief,research:()=>researchPage(state,esc,role,researchFilters),recovery};
 $('#main').innerHTML=(storageIssue?'<div class="callout storage-error">'+esc(storageIssue)+'</div>':'')+'<p class="role-notice">Preview role: '+esc(role)+'. This demonstrates permissions; it is not institutional sign-in.</p>'+screens[page]();
 applyRole();
}
function go(target,nextFilter){if(nextFilter)pendingFilter=nextFilter;if(page===target){if(nextFilter)filter=nextFilter;pendingFilter=null;tablePage=1;render();}else location.hash=target;}
window.addEventListener('hashchange',()=>{filter=pendingFilter||{status:location.hash==='#favourites'?'all':'living'};pendingFilter=null;tablePage=1;render();});
function cages(room,selected=''){const c=state.locations.filter(x=>x.room===room&&x.cage).map(x=>x.cage);if(selected&&!c.includes(selected))c.push(selected);$('#record-form').elements.cage.innerHTML=options(c,selected,'Communal / no cage');}
function openRecord(id=null){
 formRevision=raw;editId=id;const a=id?state.animals.find(x=>x.id===id):null,f=$('#record-form');f.reset();$('#form-errors').textContent='';$('#record-title').textContent=id?'Edit '+id:'Add animal';f.elements.id.readOnly=!!id;
 f.elements.sex.innerHTML=options(sexChoices(),a?.sex||'Unknown');f.elements.room.innerHTML=options(rooms(),a?.room||rooms()[0]);cages(f.elements.room.value,a?.cage);
 for(const k of ['id','species','sex','line','room','cage','dob','dod','arrived','departed','mother','father','pob','notes'])f.elements[k].value=a?.[k]??(k==='sex'?'Unknown':k==='species'?'Bat':k==='room'?rooms()[0]:k==='cage'?'':'');
 for(const field of ['dob','dod','arrived','departed'])f.elements[field].max=utcDay();
 $('#parent-ids').innerHTML=state.animals.filter(x=>x.id!==id).map(x=>'<option value="'+esc(x.id)+'"></option>').join('');
 $('#custom-inputs').innerHTML=state.columns.filter(x=>x.custom).map(x=>'<label>'+esc(x.label)+(x.type==='select'?'<select name="'+x.key+'">'+options(x.options,a?.extra?.[x.key],'Not specified')+'</select>':'<input name="'+x.key+'" type="'+(x.type==='text'?'text':x.type)+'"'+(x.type==='number'?' step="any"':' maxlength="1000"')+' value="'+esc(a?.extra?.[x.key]??'')+'">')+'</label>').join('');
 $('#record-dialog').showModal();
}
function detail(id){
 const historicalRecord=page==='reports'?state.dailyRecords.find(r=>r.date===reportDate):null;
 const a=historicalRecord?historicalRecord.animals.find(x=>x.id===id):(currentRows.find(x=>x.id===id)||state.animals.find(x=>x.id===id));if(!a)return;
 const historical=!!historicalRecord;
 const fields=[['Species',a.species],['Sex',a.sex],['Room / cage',a.room+' / '+(a.cage||'Communal')],['Line',a.line],['Age',age(a.dob,historical?reportDate:utcDay(),a.dod)],['Birth date',a.dob],['Death date',a.dod],['Arrival date',a.arrived],['Departure date',a.departed],['Parent 1',a.mother],['Parent 2',a.father],['Place of birth',a.pob],...(historicalRecord?.columns||state.columns).filter(x=>x.custom).map(f=>[f.label,a.extra?.[f.key]])];
 $('#detail-content').innerHTML='<div class="dialog-heading"><div><div class="eyebrow">'+(historical?'SAVED STATE · '+reportDate:'ANIMAL RECORD')+'</div><h2>'+esc(a.id)+'</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Close animal details">×</button></div><dl class="detail-grid">'+fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v||'Unknown / not specified')+'</dd></div>').join('')+'</dl><h3>Notes</h3><p class="detail-notes">'+esc(a.notes||'No notes recorded.')+'</p>'+(historical?'<p class="subtle">This is the saved record at the selected date. Open the current register to edit.</p>':'<button class="button primary" data-edit="'+esc(a.id)+'">Edit record</button>')+pedigreeMarkup(historical?(state.dailyRecords.find(r=>r.date===reportDate)?.animals||state.animals):state.animals,id,esc)+'<div class="detail-history"><h3>Record history</h3>'+state.events.filter(e=>(e.animalId===id||e.animalIds?.includes(id))&&(!historical||e.at<=historicalRecord.savedAt)).reverse().map(historyItem).join('')+'</div>';
 if(!$('#detail-dialog').open)$('#detail-dialog').showModal();applyRole();
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportFile(format){
 const record=page==='reports'?state.dailyRecords.find(r=>r.date===reportDate):null;
 if(page==='reports'&&!record){notify('Save today’s daily record before exporting.');return;}
 const at=page==='reports'?reportDate:utcDay(),schema=record?.exportColumns||state.columns,rows=record?.rows?.[reportKey()]||exportRows(currentRows,at,schema);
 if(!rows[0]?.length){notify('Choose at least one visible column.');return;}
 const name='colony-'+(page==='reports'?reportKey()+'-'+reportDate:page+'-'+at);
 download(format==='xlsx'?workbook(rows):(record?.csv?.[reportKey()]||csv(rows)),name+'.'+format,format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8');
 notify('Exported '+(rows.length-1)+' records.');
}
function renderColumns(){
 $('#column-list').innerHTML=columnDraft.map((c,i)=>'<div class="column-row"><input type="checkbox" data-visible="'+i+'" aria-label="Show '+esc(c.label)+'"'+(c.visible?' checked':'')+'><input type="text" data-label="'+i+'" aria-label="Heading for '+esc(c.label)+'" maxlength="60" value="'+esc(c.label)+'"><small>'+esc(c.custom?c.type:'standard')+'</small><button data-move="'+i+'" data-direction="-1" aria-label="Move '+esc(c.label)+' up"'+(i===0?' disabled':'')+'>↑</button><button data-move="'+i+'" data-direction="1" aria-label="Move '+esc(c.label)+' down"'+(i===columnDraft.length-1?' disabled':'')+'>↓</button></div>').join('');
}
function openColumns(){formRevision=raw;columnDraft=structuredClone(state.columns);researchFieldDraft=structuredClone(state.researchFields);$('#sex-choices').value=sexChoices().join(', ');$('#research-types').value=state.researchTypes.join(', ');$('#field-form').reset();$('#field-error').textContent='';renderColumns();$('#columns-dialog').showModal();}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,a');if(!b)return;
 if(b.dataset.help){showHelp(b.dataset.help);return;}
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(isWriteAction(b)&&!canEdit()){notify('Student preview is read-only.');return;}
 if((b.dataset.action==='columns'||b.dataset.action==='location-add')&&role!=='administrator'){notify('Switch to Administrator preview to configure fields or locations.');return;}
 if(await extensionClick(b))return;
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
 if(b.dataset.star){if(await mutate(n=>{n.favourites=n.favourites.includes(b.dataset.star)?n.favourites.filter(x=>x!==b.dataset.star):[...n.favourites,b.dataset.star];}))render();}
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
document.addEventListener('change',async e=>{
 const el=e.target;
 if(await extensionChange(el))return;
 if(el.dataset.filter){filter[el.dataset.filter]=el.value;if(el.dataset.filter==='room')filter.cage='';tablePage=1;render();}
 if(el.id==='report-date'){if(!el.value||el.value>utcDay()){notify('Choose a valid date up to today.');return;}reportDate=el.value;tablePage=1;render();}
 if(el.id==='all-dates'){allDates=el.checked;tablePage=1;render();}
 if(el.dataset.visible!==undefined)columnDraft[Number(el.dataset.visible)].visible=el.checked;
});
$('#record-form').elements.room.addEventListener('change',e=>cages(e.target.value));
$('#record-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!canEdit())return;const f=e.target,before=state.animals.find(x=>x.id===editId),a={...before,extra:{...before?.extra}};
 for(const k of ['id','species','sex','line','room','cage','dob','dod','arrived','departed','mother','father','pob','notes'])a[k]=f.elements[k].value.trim();
 for(const c of state.columns.filter(x=>x.custom))a.extra[c.key]=f.elements[c.key].value.trim();
 const errors=[...validateAnimal(a,state.animals,state.locations,editId,utcDay(),state.columns),...validateEventDates(before,a,utcDay())];
 if(errors.length){$('#form-errors').innerHTML='<ul>'+errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';return;}
 const changes=before?[...Object.keys(a).filter(k=>k!=='extra'&&String(a[k]??'')!==String(before[k]??'')).map(k=>k+': '+(before[k]||'—')+' → '+(a[k]||'—')),...state.columns.filter(c=>c.custom&&String(a.extra[c.key]??'')!==String(before.extra?.[c.key]??'')).map(c=>c.label+': '+(before.extra?.[c.key]||'—')+' → '+(a.extra[c.key]||'—'))]:[];if(changes.length>=5&&!await confirmChanges('Review record changes','You are changing '+changes.length+' fields for '+a.id,changes))return;
 if(await commit(saveAnimal(state,a,actorName(),new Date().toISOString(),editId),formRevision)){$('#record-dialog').close();render();notify('Record saved with its change history.');}
});
$('#group-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!canEdit())return;const f=e.target,name=f.elements.name.value.trim(),members=[...f.querySelectorAll('[name=members]:checked')].map(x=>x.value);
 if(!name||!members.length||state.groups.some(g=>g.id!==editingGroupId&&g.name.toLowerCase()===name.toLowerCase())){$('#group-error').textContent='Enter a unique group name and select at least one animal.';return;}
 const old=state.groups.find(g=>g.id===editingGroupId),changedMembers=old?[...new Set([...old.animalIds,...members])].filter(id=>old.animalIds.includes(id)!==members.includes(id)):[];
 if(changedMembers.length>=5&&!await confirmChanges('Review membership changes','You are changing '+changedMembers.length+' memberships.',changedMembers))return;
 const group={id:editingGroupId||crypto.randomUUID(),name,notes:f.elements.notes.value.trim(),animalIds:members};
 if(await commit(saveGroup(state,group,actorName()),groupRevision)){selectedGroupId=group.id;$('#group-dialog').close();render();notify('Research group saved with membership history.');}
});
$('#field-form').addEventListener('submit',e=>{
 e.preventDefault();if(role!=='administrator')return;const f=e.target,label=f.elements.label.value.trim(),type=f.elements.type.value,opts=choices(f.elements.options.value),draft=f.elements.target.value==='research'?researchFieldDraft:columnDraft;
 if(!label||draft.some(c=>c.label.toLowerCase()===label.toLowerCase())||(type==='select'&&!opts.length)){$('#field-error').textContent='Use a unique heading and supply choices for a dropdown.';return;}
 draft.push({key:'custom_'+crypto.randomUUID().replaceAll('-',''),label,type,options:opts,required:f.elements.requiredField.checked,custom:true,visible:true});f.reset();$('#field-error').textContent='';renderColumns();
});
$('#save-columns').addEventListener('click',async()=>{
 if(role!=='administrator')return;
 const sex=choices($('#sex-choices').value),types=choices($('#research-types').value),all=[...columnDraft,...researchFieldDraft];
 const invalid=all.some(c=>!c.label.trim()||(c.type==='select'&&!c.options?.length));
 if(!columnDraft.some(c=>c.visible)||invalid||new Set(columnDraft.map(c=>c.label.trim().toLowerCase())).size!==columnDraft.length||new Set(researchFieldDraft.map(c=>c.label.trim().toLowerCase())).size!==researchFieldDraft.length||!sex.length||!types.length){$('#field-error').textContent='Keep visible columns, unique headings and valid dropdown choices.';return;}
 if(state.animals.some(a=>!sex.includes(a.sex))||state.researchEntries.some(entry=>!types.includes(entry.type))){$('#field-error').textContent='Keep sex choices and activity categories used by existing records.';return;}
 for(const field of columnDraft.filter(c=>c.type==='select'))if(state.animals.some(a=>a.extra?.[field.key]&&!field.options.includes(a.extra[field.key]))){$('#field-error').textContent='Keep choices currently used in '+field.label+'.';return;}
 for(const field of researchFieldDraft.filter(c=>c.type==='select'))if(state.researchEntries.some(entry=>entry.fields?.[field.key]&&!field.options.includes(entry.fields[field.key]))){$('#field-error').textContent='Keep choices currently used in '+field.label+'.';return;}
 const changes=all.filter(c=>JSON.stringify(c)!==JSON.stringify([...state.columns,...state.researchFields].find(x=>x.key===c.key))).map(c=>c.label);
 if(changes.length>=5&&!await confirmChanges('Review configuration changes','You are changing '+changes.length+' field definitions. Earlier daily records retain their own definitions.',changes))return;
 const next=structuredClone(state),sexField=columnDraft.find(c=>c.key==='sex');sexField.options=sex;
 next.columns=columnDraft.map(c=>({...c,label:c.label.trim()}));next.researchFields=researchFieldDraft.map(c=>({...c,label:c.label.trim()}));next.researchTypes=types;
 next.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor:actorName(),action:'Fields configured',schemaBefore:{columns:structuredClone(state.columns),researchFields:structuredClone(state.researchFields),researchTypes:state.researchTypes},schemaAfter:{columns:structuredClone(next.columns),researchFields:structuredClone(next.researchFields),researchTypes:types},animalId:'',snapshot:structuredClone(next.animals)});
 if(await commit(next,formRevision)){$('#columns-dialog').close();render();notify('Configuration saved with definition history.');}
});
$('#backup').addEventListener('click',()=>download(JSON.stringify(state,null,2),'colony-demo-backup-'+utcDay()+'.json','application/json'));
window.addEventListener('storage',e=>{if(e.key===key)notify('Data changed in another tab. Reload to use its latest saved state.');});

const choices=value=>[...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))];
const help={
 overview:['Colony overview','Counts show living animals currently present, excluding deaths, departures and archived records. The sample has 18 synthetic animals; approximately 170 is the expected real starting volume. Use the register to find a bat or open Rooms & cages to locate it.'],
 stock:['Animal register','Animal IDs are unique and cannot be renamed. Room is required; cage is optional. Unknown values can be represented using configured choices or blank optional fields. Event dates in earlier days are final. A newly arriving adult can have an earlier birth date as background information. Record its arrival today. Custom fields are designed in Administrator preview.'],
 housing:['Rooms and cages','Every housed bat has a room. Communal accommodation has no cage. A cage belongs to a room. Moving an occupied cage moves its current occupants together and records each move. Administrator preview can add rooms and cages.'],
 reports:['Daily records','Save today to capture three consistent tables: current stock, births today and deaths today. Saving again today replaces this daily set and keeps the replacement in history. At midnight UTC the set becomes final. Automatic fallback preserves an existing manual set; it only generates yesterday if missing and history is available. It runs while this tab is open or checks yesterday on reopening. It is not a server scheduler. Each saved set contains CSV copies with frozen headings; download all three as a ZIP. These copies are stored in this browser, so download a full backup as well.'],
 groups:['Research groups','Groups are changing research cohorts. Select members, add group context, and inspect membership and animal activity over time. Pedigree is a separate relationship structure. Research log entries can be recorded for a selected group’s members.'],
 research:['Research log','Record dated research activities for one animal or several selected animals. Behaviour, surgery, harvest, swab sampling and wing punch are starter categories from the lab discussion; administrators can configure categories and typed fields. Entries in earlier days are final. A category records the activity; it does not automatically record a birth, death or departure. Use the animal record for stock-changing events.'],
 recovery:['Recovery','Administrator preview can recover animal values from a saved daily baseline. Review the affected count first. Animals introduced later are archived rather than deleted, so IDs, pedigree references and history survive. Daily records, research entries, groups and current field definitions are preserved. This is an animal-data recovery demonstration, not full database disaster recovery. Download a full JSON backup before major changes.'],
 history:['Record history','Animal edits, membership, research entries, daily replacements and configuration changes retain their recorded history. Recovery adds a new history event. Browser storage is not a protected five-year institutional audit store.'],
 favourites:['Favourites','Star frequently used animals for quick access. In the prototype favourites belong to this browser; production favourites will belong to signed-in users.'],
 brief:['Project brief','This prototype demonstrates workflows using synthetic data. Production needs authenticated SQL storage, institution-managed backups, access enforcement and reliable scheduled exports. Multi-database support is deferred. The infrastructure decision follows prototype review.']
};
function showHelp(section){const [title,body]=help[section]||help.overview;$('#help-title').textContent=title;$('#help-content').innerHTML='<p>'+esc(body)+'</p>';$('#help-dialog').showModal();}
function isWriteAction(b){return ['add','group','columns','save-daily','research-add','location-add','recover'].includes(b.dataset.action)||b.dataset.edit||b.dataset.editGroup||b.dataset.researchEdit||b.dataset.moveCage;}
function applyRole(){
 document.querySelectorAll('[data-action="add"],[data-action="group"],[data-action="save-daily"],[data-action="research-add"],[data-edit],[data-edit-group],[data-research-edit],[data-move-cage]').forEach(b=>b.disabled=!canEdit());
 document.querySelectorAll('[data-action="columns"],[data-action="location-add"],[data-action="recover"]').forEach(b=>b.disabled=role!=='administrator');
 $('#role').value=role;
 const identity=$('.identity div');if(identity)identity.innerHTML=esc(actorName())+'<small>Prototype workspace</small>';
}
function confirmChanges(title,body,items=[]){
 const dialog=$('#confirm-dialog');if(dialog.open)return Promise.resolve(false);
 $('#confirm-title').textContent=title;$('#confirm-content').innerHTML='<p>'+esc(body)+'</p>'+(items.length?'<ul class="review-list">'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'');
 return new Promise(resolve=>{let accepted=false;$('#confirm-apply').onclick=()=>{accepted=true;dialog.close();};dialog.addEventListener('close',()=>{resolve(accepted);$('#confirm-apply').onclick=null;},{once:true});dialog.showModal();});
}
function recovery(){
 const dates=[...state.dailyRecords].sort((a,b)=>b.date.localeCompare(a.date));
 return heading('Recovery','Preview recovery of animal records from a saved day.')+'<div class="callout">Download a backup before recovery. Earlier daily reports, history and research entries stay preserved. Full production backup restoration is still required.</div><section class="panel recovery-panel"><h2>Recover an animal baseline</h2><p>Choose a saved date and review the changes before applying them. Animals added later are archived, preserving their identities.</p><label>Saved daily baseline<select id="recovery-date">'+dates.map(r=>'<option value="'+r.date+'">'+r.date+' · '+esc(r.source)+' · v'+r.revision+'</option>').join('')+'</select></label><button class="button primary" data-action="recover"'+(!dates.length?' disabled':'')+'>Preview recovery</button>'+(dates.length?'':'<p class="subtle">Save a daily record first.</p>')+'</section>';
}
const baseRenderColumns=renderColumns;
renderColumns=function(){
 baseRenderColumns();
 $('#column-list').innerHTML=columnDraft.map((c,i)=>'<div class="column-row"><input type="checkbox" data-visible="'+i+'" aria-label="Show '+esc(c.label)+'"'+(c.visible?' checked':'')+'><input type="text" data-label="'+i+'" aria-label="Heading for '+esc(c.label)+'" value="'+esc(c.label)+'" maxlength="60"><small>'+esc(c.custom?c.type:'protected')+'</small><button data-move="'+i+'" data-direction="-1"'+(i===0?' disabled':'')+' aria-label="Move '+esc(c.label)+' up">↑</button><button data-move="'+i+'" data-direction="1"'+(i===columnDraft.length-1?' disabled':'')+' aria-label="Move '+esc(c.label)+' down">↓</button></div>'+(c.custom?'<div class="column-details"><label class="inline-check"><input type="checkbox" data-required-field="'+i+'"'+(c.required?' checked':'')+'> Required</label>'+(c.type==='select'?'<label>Allowed choices<input data-field-choices="'+i+'" value="'+esc((c.options||[]).join(', '))+'"></label>':'')+'</div>':'')).join('');
 $('#research-field-list').innerHTML=researchFieldDraft.map((c,i)=>'<div class="column-row"><input type="text" data-research-label="'+i+'" aria-label="Research heading '+esc(c.label)+'" value="'+esc(c.label)+'" maxlength="60"><small>'+esc(c.type)+'</small></div><div class="column-details"><label class="inline-check"><input type="checkbox" data-research-required="'+i+'"'+(c.required?' checked':'')+'> Required</label>'+(c.type==='select'?'<label>Allowed choices<input data-research-choices="'+i+'" value="'+esc((c.options||[]).join(', '))+'"></label>':'')+'</div>').join('')||'<p class="subtle">Add fields below to define measurements or observations for research entries.</p>';
};
async function extensionClick(b){
 if(b.dataset.action==='research-clear'){researchFilters={};render();return true;}
 if(b.dataset.communal){go('stock',{status:'living',room:b.dataset.communal,communal:true});return true;}
 if(b.dataset.dailyDate){reportDate=b.dataset.dailyDate;tablePage=1;render();return true;}
 if(b.dataset.action==='save-daily'){
  try{if(await commit(saveDaily(state,{actor:actorName(),at:new Date().toISOString(),source:'manual'}))){render();notify('Daily stock, births, deaths and CSV copies saved together.');}}catch(error){notify(error.message);}return true;
 }
 if(b.dataset.action==='daily-csv'){
  const record=state.dailyRecords.find(r=>r.date===reportDate);if(!record){notify('No saved record for this date.');return true;}
  const files={};for(const name of ['stock','births','deaths'])files[name+'.csv']=record.csv[name];
  files['record.json']=JSON.stringify({date:record.date,source:record.source,savedAt:record.savedAt,actor:record.actor,revision:record.revision},null,2);
  download(zip(files),'colony-daily-'+record.date+'.zip','application/zip');notify('Downloaded three readable CSV tables.');return true;
 }
 if(b.dataset.action==='location-add'){formRevision=raw;$('#housing-form').reset();$('#housing-error').textContent='';$('#room-list').innerHTML=rooms().map(r=>'<option value="'+esc(r)+'">').join('');$('#housing-dialog').showModal();return true;}
 if(b.dataset.moveCage){
  const target=[...document.querySelectorAll('[data-cage-target]')].find(el=>el.dataset.cageTarget===b.dataset.moveCage&&el.dataset.sourceRoom===b.dataset.sourceRoom)?.value;
  if(!target){notify('Choose a destination room.');return true;}
  const expected=raw,count=state.animals.filter(a=>a.room===b.dataset.sourceRoom&&a.cage===b.dataset.moveCage&&isPresent(a,utcDay())).length;
  if(!await confirmChanges('Move occupied cage','Move '+b.dataset.moveCage+' from '+b.dataset.sourceRoom+' to '+target+' with '+count+' present animals?'))return true;
  try{if(await commit(moveCage(state,b.dataset.sourceRoom,b.dataset.moveCage,target,actorName()),expected)){render();notify('Cage and occupants moved together.');}}catch(error){notify(error.message);}return true;
 }
 if(b.dataset.action==='recover'){
  if(role!=='administrator')return true;const date=$('#recovery-date').value,expected=raw;
  try{const preview=recoveryPreview(state,date);if(!await confirmChanges('Recover animal baseline','Recover animal values from '+date+'. '+preview.changed+' records are affected. Daily records and research entries remain unchanged.',preview.details))return true;
   const next=recoverAnimals(state,date,actorName());
   // Recovered cage locations may have moved since this baseline; retain both known locations.
   for(const a of next.animals)if(!next.locations.some(l=>l.room===a.room&&l.cage===(a.cage||'')))next.locations.push({room:a.room,cage:a.cage||''});
   if(await commit(next,expected)){render();notify('Animal baseline recovered; the action was added to history.');}
  }catch(error){notify(error.message);}return true;
 }
 if(b.dataset.action==='research-add'||b.dataset.researchEdit){
  researchRevision=raw;editingResearchId=b.dataset.researchEdit||null;
  const entry=editingResearchId?state.researchEntries.find(x=>x.id===editingResearchId):null;
  $('#research-form-container').innerHTML=renderResearchForm(state,esc,entry,utcDay());$('#research-dialog').showModal();return true;
 }
 return false;
}
async function extensionChange(el){
 if(el.hasAttribute('data-research-group')){const group=state.groups.find(g=>g.id===el.value);if(group)document.querySelectorAll('#research-form [name=animalIds]').forEach(box=>box.checked=group.animalIds.includes(box.value));return true;}
 if(el.id==='role'){role=el.value;for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();render();return true;}
 if(el.id==='auto-daily'){
  if(role!=='administrator'){render();return true;}
  if(await mutate(n=>{if(el.checked&&n.settings.autoDaily===false)n.automaticStarted=utcDay();n.settings.autoDaily=el.checked;n.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor:actorName(),action:el.checked?'Automatic fallback enabled':'Automatic fallback disabled',animalId:'',snapshot:structuredClone(n.animals)});})){render();notify('Automatic fallback setting saved.');}else render();return true;
 }
 if(el.dataset.researchFilter){researchFilters[el.dataset.researchFilter]=el.value;render();return true;}
 if(el.dataset.requiredField!==undefined){columnDraft[+el.dataset.requiredField].required=el.checked;return true;}
 if(el.dataset.researchRequired!==undefined){researchFieldDraft[+el.dataset.researchRequired].required=el.checked;return true;}
 return false;
}
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.fieldChoices!==undefined)columnDraft[+el.dataset.fieldChoices].options=choices(el.value);
 if(el.dataset.researchChoices!==undefined)researchFieldDraft[+el.dataset.researchChoices].options=choices(el.value);
 if(el.dataset.researchLabel!==undefined)researchFieldDraft[+el.dataset.researchLabel].label=el.value;
});
$('#housing-form').addEventListener('submit',async e=>{
 e.preventDefault();if(role!=='administrator')return;const room=e.target.elements.room.value.trim(),cage=e.target.elements.cage.value.trim();
 if(!room||state.locations.some(l=>l.room===room&&l.cage===cage)){$('#housing-error').textContent='Use a room name and a location that does not already exist.';return;}
 const next=structuredClone(state);next.locations.push({room,cage});next.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor:actorName(),action:'Location added',locationAfter:{room,cage},animalId:'',snapshot:structuredClone(next.animals)});
 if(await commit(next,formRevision)){$('#housing-dialog').close();render();notify('Location added.');}
});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='research-form')return;e.preventDefault();if(!canEdit())return;
 const form=e.target,fields={},existing=state.researchEntries.find(x=>x.id===editingResearchId);for(const field of existing?.fieldDefinitions||state.researchFields){const value=form.elements[field.key]?.value.trim()||'';fields[field.key]=field.type==='boolean'&&value?value==='true':value;}
 const entry={id:editingResearchId||undefined,baseUpdatedAt:editingResearchId?form.elements.baseUpdatedAt.value:undefined,date:form.elements.date.value,type:form.elements.type.value,animalIds:[...form.querySelectorAll('[name="animalIds"]:checked')].map(el=>el.value),notes:form.elements.notes.value.trim(),fields};
 const errors=validateResearch(state,entry,new Date().toISOString());if(errors.length){$('#research-error').textContent=errors.join(' ');return;}
 try{if(await commit(saveResearch(state,entry,actor(),new Date().toISOString()),researchRevision)){$('#research-dialog').close();render();notify('Research activity saved with its field definitions and history.');}}catch(error){$('#research-error').textContent=error.message;}
});
let automaticRunning=false;
async function checkAutomatic(){
 if(automaticRunning||storageIssue)return;automaticRunning=true;
 try{const next=automaticDaily(state,new Date().toISOString());if(next.dailyRecords.length!==state.dailyRecords.length){if(await commit(next)){render();notify('Automatic daily record saved from yesterday’s recorded state.');}}}catch(error){notify('Automatic record failed: '+error.message);}finally{automaticRunning=false;}
}
render();
// Persist the tracking start once; no synthetic historic daily records are invented.
if(!storageIssue&&(!raw||!JSON.parse(raw).automaticStarted))await commit(structuredClone(state));
await checkAutomatic();
setInterval(()=>{checkAutomatic();if(page==='reports'&&!document.querySelector('dialog[open]'))render();},30000);
import {fieldTypes,configurable,choices,fieldValue,schemaErrors} from './fields.mjs';
import {familyTree} from './pedigree.mjs';
import {lifeEventChanges,pendingRecordReviews,reviewMatchesAnimal,validateReviewedEventDates,saveAnimalWithReview,approveRecordReviews,undoRecordReview} from './record-review.mjs';
import {utcDay,dailyReportView,saveDaily,automaticDaily,isPresent} from './daily.mjs';
import {eventAnimalIds,eventChanges,historySummary,filterHistory} from './history.mjs';
import {validateResearch,saveResearch,researchPage,renderResearchForm} from './research.mjs';
import {validateEventDates,recoveryPreview,recoverAnimals,moveCage,removeCage,removeRoom,pedigreeMarkup} from './extensions.mjs';
import {today,age,initialState,expandDemo,validateAnimal,saveAnimal,asOf,filterAnimals,cell,exportRows,csv,defaultColumns,saveGroup,groupTimeline} from './core.mjs';
import {workbook,zip} from './xlsx.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const key='st-andrews-colony-v1',pages=['overview','stock','housing','reports','groups','favourites','history','brief','research','recovery'];
let raw=null,state,storageIssue='',page='overview',filter={status:'living'},tablePage=1,reportType='full',reportDate=utcDay(),allDates=false,currentRows=[],editId=null,columnDraft=[],pendingFilter=null,toastTimer,selectedGroupId=null,editingGroupId=null,formRevision=null,groupRevision=null,researchRevision=null,researchFieldDraft=[],role='researcher',researchFilters={},editingResearchId=null;
let reportMode='live',registerView='summary',historyFilters={sort:'newest'},historyPage=1;
try{
 raw=localStorage.getItem(key);state=raw?JSON.parse(raw):initialState();
 if(state.version!==1||!Array.isArray(state.animals)||!Array.isArray(state.events)||!Array.isArray(state.locations)||!Array.isArray(state.groups)||!Array.isArray(state.favourites))throw new Error('Unsupported demo data.');
 if(!Array.isArray(state.columns))state.columns=defaultColumns();
}catch{state=initialState();storageIssue='Saved data could not be read. Demo records are shown in memory; existing browser data has not been overwritten.';}
const actor=()=>({name:'Demo '+role,role});
const actorName=()=>actor().name;
const canEdit=()=>role!=='student';
const sexChoices=()=>state.columns.find(c=>c.key==='sex')?.options||['Female','Male','Unknown'];
state.recordReviews??=[];state.dailyRecords??=[];state.researchEntries??=[];state.researchFields??=[];
state.researchTypes??=['Behaviour','Surgery','Harvest','Swab sampling','Wing punch','Other'];
state.settings??={autoDaily:true};state.automaticStarted??=utcDay();
if(!state.settings.housingInitialized){
 if(!state.locations.some(l=>l.room==='Communal room'))state.locations.push({room:'Communal room',cage:''});
 state.settings.housingInitialized=true;
}
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
const exportButtons='<details class="export-menu"><summary class="button secondary">Export</summary><div role="group" aria-label="Export format"><button class="button secondary" data-action="csv">CSV</button><button class="button secondary" data-action="xlsx">Excel</button></div></details>';
function table(rows,at=utcDay(),schema=state.columns,{editable=true,emptyTitle='No matching records',emptyDescription='Change the filters, select another date or add an animal.'}={}){
 currentRows=rows;const c=schema.filter(x=>x.visible!==false),max=Math.max(1,Math.ceil(rows.length/25));tablePage=Math.min(tablePage,max);
 if(!c.length)return '<div class="empty">Configure at least one visible column.</div>';
 if(!rows.length)return '<div class="empty"><strong>'+esc(emptyTitle)+'</strong>'+esc(emptyDescription)+'</div>';
 const chunk=rows.slice((tablePage-1)*25,tablePage*25);
 return '<div class="table-wrap" tabindex="0" role="region" aria-label="Animal records table. Use arrow keys to scroll."><table class="animal-table"><thead><tr><th class="animal-favourite" scope="col" aria-label="Favourite"></th>'+c.map(x=>'<th scope="col" class="'+(x.key==='id'?'animal-id':'')+'">'+esc(x.label)+'</th>').join('')+'<th scope="col">Status</th><th scope="col" class="record-actions">Record actions</th></tr></thead><tbody>'+chunk.map(a=>'<tr><td class="animal-favourite"><button class="star '+(state.favourites.includes(a.id)?'saved':'')+'" data-star="'+esc(a.id)+'" aria-label="'+(state.favourites.includes(a.id)?'Remove':'Add')+' favourite '+esc(a.id)+'" aria-pressed="'+state.favourites.includes(a.id)+'">'+(state.favourites.includes(a.id)?'★':'☆')+'</button></td>'+c.map(x=>'<td class="'+(x.key==='notes'?'note-cell':x.key==='id'?'animal-id':'')+'" title="'+esc(cell(a,x.key,at))+'">'+(x.key==='id'?'<button class="id-link" data-detail="'+esc(a.id)+'" aria-label="Open record '+esc(a.id)+'">'+esc(a.id)+'</button>':esc(cell(a,x.key,at))||'—')+'</td>').join('')+'<td>'+animalStatus(a)+'</td><td class="record-actions"><button class="button secondary" data-detail="'+esc(a.id)+'" aria-label="Open '+esc(a.id)+'">Open</button>'+(editable&&canEdit()?' <button class="button secondary" data-edit="'+esc(a.id)+'" aria-label="Edit '+esc(a.id)+'">Edit</button>':'')+'</td></tr>').join('')+'</tbody></table></div><div class="table-foot"><span>'+rows.length+' matching record'+(rows.length!==1?'s':'')+' · exports include all matching rows</span><div class="pagination"><button data-pagination="-1"'+(tablePage===1?' disabled':'')+'>Previous</button><span>'+tablePage+' / '+max+'</span><button data-pagination="1"'+(tablePage===max?' disabled':'')+'>Next</button></div></div>';
}
function animalStatus(a){return '<span class="tag '+(a.dod?'deceased':'')+'">'+(a.archived?'Archived':a.dod?'Deceased':a.departed?'Departed':'Living')+'</span>';}
function quickColumns(schema=state.columns){const id=schema.find(c=>c.key==='id')||{key:'id',label:'Animal ID'};return [{...id,visible:true},...schema.filter(c=>c.visible!==false&&['sex','room','cage','line','age'].includes(c.key))];}
function savedRecordReview(){
 const reviews=pendingRecordReviews(state);
 if(!reviews.length)return '';
 return '<section class="panel pending-reviews" id="pending-reviews" aria-labelledby="pending-review-title"><div class="section-heading"><div><h2 id="pending-review-title">Changes awaiting approval <span class="tag">'+reviews.length+'</span></h2><p class="subtle">Saved changes stay here across refreshes, independently of the filters below. Stock and live reports already use the saved values. Approve after checking, or edit or undo a change.</p></div>'+(canEdit()?'<button class="button primary" data-approve-all-reviews>Approve all ('+reviews.length+')</button>':'')+'</div>'+reviews.map(review=>{
  const animal=state.animals.find(a=>a.id===review.animalId),matches=reviewMatchesAnimal(state,review);
  return '<article class="pending-review" aria-label="Pending changes for '+esc(review.animalId)+'"><div class="pending-review-heading"><h3>'+esc(review.animalId)+'</h3>'+(animal?animalStatus(animal):'<span class="tag">Record unavailable</span>')+'</div><p class="subtle">Saved '+esc(formatTime(review.updatedAt))+' by '+esc(review.updatedBy)+'</p><ul class="review-list">'+lifeEventChanges(review.before,review.after).map(change=>'<li>'+esc(change)+'</li>').join('')+'</ul>'+(!matches?'<p class="storage-error">This record changed outside the review. Open and edit its life events to reconcile the values first.</p>':'')+'<div class="pending-review-actions">'+(animal?'<button class="button secondary" data-detail="'+esc(animal.id)+'" aria-label="Open '+esc(animal.id)+'">Open</button>':'')+(canEdit()?'<button class="button secondary" data-edit="'+esc(review.animalId)+'" aria-label="Edit '+esc(review.animalId)+'">Edit</button><button class="button secondary" data-undo-review="'+esc(review.id)+'" aria-label="Undo changes for '+esc(review.animalId)+'"'+(!matches?' disabled':'')+'>Undo change</button><button class="button primary" data-approve-review="'+esc(review.id)+'" aria-label="Approve changes for '+esc(review.animalId)+'"'+(!matches?' disabled':'')+'>Approve</button>':'')+'</div></article>';
 }).join('')+'</section>';
}
async function handleRecordReview(b){
 const undo=b.dataset.undoReview,all=b.hasAttribute('data-approve-all-reviews');
 if(!undo&&!all&&!b.dataset.approveReview)return false;
 if(!canEdit()){notify('Student preview is read-only.');return true;}
 const reviews=pendingRecordReviews(state).filter(r=>all||r.id===(undo||b.dataset.approveReview));
 if(!reviews.length){render();return true;}
 const selections=reviews.map(r=>({id:r.id,revision:r.revision})),expected=raw;
 const items=reviews.flatMap(r=>[r.animalId,...lifeEventChanges(undo?r.after:r.before,undo?r.before:r.after).map(change=>'  '+change)]);
 if(!await confirmChanges(undo?'Undo life event for '+reviews[0].animalId:all?'Approve all pending changes':'Approve changes for '+reviews[0].animalId,undo?'Restore the dates shown below. Later changes to notes, housing and other fields are kept. The reversal will be recorded in history.':'Check the animal IDs and dates below. Approval closes these pending entries and is recorded in history.',items,undo?'Undo change':all?'Approve all ('+reviews.length+')':'Approve change'))return true;
 if(!canEdit())return true;
 try{
  const next=undo?undoRecordReview(state,selections[0],actorName(),new Date().toISOString(),role):approveRecordReviews(state,selections,actorName(),new Date().toISOString(),role);
  if(await commit(next,expected)){render();notify(undo?'Life event undone; other record changes are kept.':reviews.length+' change'+(reviews.length===1?'':'s')+' approved.');}
 }catch(error){notify(error.message);}
 return true;
}
function registerResults(rows){return '<div class="section-heading"><div><h2>Animal records <span class="tag">'+rows.length+'</span></h2><p class="subtle">Open a record to read its history, or choose Edit to update it.</p></div><div class="report-view-switch" aria-label="Register columns">'+[['summary','Quick view'],['full','All columns']].map(([v,label])=>'<button data-register-view="'+v+'" aria-pressed="'+(registerView===v)+'">'+label+'</button>').join('')+'</div></div>'+table(rows,utcDay(),registerView==='summary'?quickColumns():state.columns);}
function overview(){
 const living=state.animals.filter(a=>isPresent(a,utcDay())),d=utcDay(),week=new Date(d+'T12:00:00Z');week.setUTCDate(week.getUTCDate()-6);const start=week.toISOString().slice(0,10);
 const metrics=[['Living animals',living.length,'Across '+rooms().length+' rooms','◇'],['Occupied cages',new Set(living.filter(a=>a.cage).map(a=>a.room+'/'+a.cage)).size,'Of '+state.locations.filter(x=>x.cage).length+' configured cages','▦'],['Births this week',state.animals.filter(a=>a.dob>=start&&a.dob<=d).length,'By recorded birth date · last 7 days','＋'],['Deaths this week',state.animals.filter(a=>a.dod>=start&&a.dod<=d).length,'Historical records are retained','↺']];
 return heading('Colony overview','A clear view of your animals, locations and recent changes.',addButton)+'<div class="metrics">'+metrics.map(([t,n,note,sym])=>'<div class="metric"><div class="metric-top">'+t+'<span class="metric-symbol">'+sym+'</span></div><div class="metric-value">'+n+'</div><div class="metric-bottom">'+note+'</div></div>').join('')+'</div><div class="overview-grid"><section class="panel"><div class="panel-head"><div><h2>Animals by room</h2><p class="subtle">Current living stock</p></div><a href="#housing" class="text-button">View housing ↗</a></div><div class="room-summary">'+rooms().map(r=>'<a class="room-row" href="#stock" data-room="'+esc(r)+'"><span class="room-icon">▦</span><span class="room-info"><h3>'+esc(r)+'</h3><small>'+state.locations.filter(x=>x.room===r&&x.cage).length+' cages · Bat colony demo</small></span><span class="room-count">'+living.filter(x=>x.room===r).length+'<small>animals ↗</small></span></a>').join('')+'</div></section><section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p class="subtle">Every record change has a history</p></div><a href="#history" class="text-button">View all ↗</a></div><div class="activity">'+state.events.filter(e=>e.animalId).slice(-4).reverse().map(e=>'<div class="activity-item"><span class="event-dot"></span><div><p>'+esc(e.action)+' · <button class="id-link" data-detail="'+esc(e.animalId)+'">'+esc(e.animalId)+'</button></p><small>'+esc(e.at.slice(0,10))+' · '+esc(e.actor)+'</small></div></div>').join('')+'</div></section></div><div class="section-caption">EVERYDAY WORKFLOWS</div><div class="quick-links"><a class="quick-link" href="#stock"><span class="quick-icon">▤</span><div><h3>Browse the register</h3><small>Find and update animal records</small></div><span class="arrow">↗</span></a><a class="quick-link" href="#reports"><span class="quick-icon">◷</span><div><h3>Prepare a daily report</h3><small>Births, deaths and saved stock</small></div><span class="arrow">↗</span></a><button class="quick-link" data-action="columns"><span class="quick-icon">⚙</span><div style="text-align:left"><h3>Make it your own</h3><small>Configure columns and data fields</small></div><span class="arrow">↗</span></button></div>';
}
function register(){
 const title=page==='favourites'?'Favourites':filter.groupId?(state.groups.find(g=>g.id===filter.groupId)?.name||'Group'):'Animal register';
 const rows=filterAnimals(state.animals,{...filter,favourites:page==='favourites'?state.favourites:null,group:filter.groupId?state.groups.find(g=>g.id===filter.groupId)?.animalIds:null});
 const select=(key,label,items,first)=>'<label>'+label+'<select data-filter="'+key+'" aria-label="Filter by '+label.toLowerCase()+'">'+options(items,filter[key],first)+'</select></label>';
 return heading(title,'Living stock excludes deceased and departed animals. Their records remain available under All records or Deceased.',addButton+exportButtons+(role==='administrator'?'<button class="button secondary" data-action="columns">Columns</button>':''))+
 '<section class="panel"><div class="section-heading"><div><h2>Find a bat</h2><p class="subtle">Search by animal ID, room, lineage or notes.</p></div><button class="text-button" data-action="clear">Clear filters</button></div><div class="toolbar register-filters"><label class="search-wrap">Search<input id="search" aria-label="Search animal register" placeholder="Animal ID or keywords" value="'+esc(filter.search||'')+'"></label><label>Status<select data-filter="status" aria-label="Filter by status">'+[['living','Living stock'],['deceased','Deceased'],['departed','Departed'],['all','All records']].map(([v,label])=>'<option value="'+v+'"'+(filter.status===v?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+select('room','Room',rooms(),'All rooms')+select('cage','Cage',[...new Set(state.locations.filter(x=>x.cage&&(!filter.room||x.room===filter.room)).map(x=>x.cage))],'All cages')+select('sex','Sex',sexChoices(),'All sexes')+select('line','Line',[...new Set(state.animals.map(a=>a.line).filter(Boolean))],'All lines')+'</div></section>'+savedRecordReview()+'<section class="panel record-section" id="register-table">'+registerResults(rows)+'</section>';
}
function housing(){
 const living=state.animals.filter(a=>isPresent(a,utcDay()));
 const removal=(r,cage,count)=>role==='administrator'?'<button class="button secondary location-remove" '+(cage?'data-remove-cage="'+esc(cage)+'" data-source-room="'+esc(r)+'"':'data-remove-room="'+esc(r)+'"')+' aria-label="Remove '+(cage?'cage '+esc(cage)+' from ':'room ')+esc(r)+'"'+(count?' disabled title="Move all occupants first"':'')+'>Remove '+(cage?'cage':'room')+'</button>':'';
 return heading('Rooms & cages','Locate animals in cages or communal accommodation.','<button class="button secondary" data-action="location-add">＋ Add room / cage</button>'+addButton)+'<p class="housing-guidance">'+(role==='administrator'?'Remove empty cages or rooms below. Move all occupants first; historical locations are retained.':'Choose Administrator in Preview role to add or remove locations. Rooms and cages must be empty before removal.')+'</p>'+(rooms().length?'<div class="housing-grid">'+rooms().map(r=>{
  const count=living.filter(a=>a.room===r).length,cages=state.locations.filter(x=>x.room===r&&x.cage);
  return '<section class="panel housing-panel"><div class="housing-title"><div class="room-icon">▦</div><div><h2>'+esc(r)+'</h2><p class="subtle">'+cages.length+' cages · '+living.filter(a=>a.room===r&&!a.cage).length+' uncaged</p></div><span class="room-total">'+count+'</span></div><div class="cage-row"><span>Whole room</span><button data-room="'+esc(r)+'">View all occupants ↗</button></div><div class="cage-row"><span>Communal / no cage</span><span>'+living.filter(a=>a.room===r&&!a.cage).length+' animals</span><button data-communal="'+esc(r)+'">View records ↗</button></div>'+cages.map(x=>{
   const occupants=living.filter(a=>a.room===r&&a.cage===x.cage).length;
   return '<section class="housing-cage" aria-label="Cage '+esc(x.cage)+' in '+esc(r)+'"><div class="housing-cage-title"><h3>'+esc(x.cage)+'</h3><span>'+occupants+' animals</span></div><div class="housing-cage-actions"><button class="button secondary" data-room="'+esc(r)+'" data-cage="'+esc(x.cage)+'">View occupants</button>'+removal(r,x.cage,occupants)+'</div>'+(role==='administrator'&&occupants?'<p class="housing-removal-note">Move occupants before removing this cage.</p>':'')+'<div class="housing-cage-move"><label>Move cage to<select data-cage-target="'+esc(x.cage)+'" data-source-room="'+esc(r)+'">'+options(rooms().filter(room=>room!==r),'','Select destination')+'</select></label><button class="button secondary" data-move-cage="'+esc(x.cage)+'" data-source-room="'+esc(r)+'">Review move</button></div></section>';
  }).join('')+(role==='administrator'?'<div class="housing-room-actions">'+removal(r,'',count)+'<p class="housing-removal-note">'+(count?'Move all occupants before removing this room.':'Removing this room also removes its '+cages.length+' empty cage'+(cages.length===1?'':'s')+'.')+'</p></div>':'')+'</section>';
 }).join('')+'</div>':'<section class="panel empty"><strong>No rooms configured</strong>Add a room to start assigning animal locations.</section>');
}
const reportKey=()=>({full:'stock',birth:'births',death:'deaths'}[reportType]);
function reports(){
 const {record,current,tables,mode,unsaved}=dailyReportView(state,reportDate,{view:reportMode}),rows=tables?.[reportKey()]||null;
 const status=record?(record.source==='automatic'?'Automatic':'Manual')+' · version '+record.revision+' · '+(current?'Replaceable today':'Final'):'No saved report yet';
 const saveLabel=record?'Update today’s saved set':'Save today’s 3 tables';
 const actions='<button class="button secondary" data-action="daily-csv"'+(!record?' disabled':'')+'>Download saved CSV set</button>'+(tables?exportButtons:'')+(current?'<button class="button primary" data-action="save-daily">'+saveLabel+'</button>':'');
 const viewNote=mode==='live'?'<div class="report-live-note"><strong>Live working data</strong><p>Births and deaths appear here as soon as you save an animal. This view keeps updating throughout the day.</p></div>':mode==='saved'?'<div class="report-saved-note"><strong>Saved report · '+esc(status)+'</strong><p>Captured '+esc(formatTime(record.savedAt))+' by '+esc(record.actor)+'. '+(current?'Use Live today to see later changes.':'This day is final.')+'</p></div>':'';
 const savedNote=current?'<div class="report-state"><div><strong>'+esc(status)+'</strong><p>'+(record?(unsaved?'New changes are waiting. Update today’s saved set to include them.':'The saved set matches the current animal records.'):'Save today to capture stock, births and deaths together.')+'</p></div>'+(record&&unsaved?'<span class="history-badge">Unsaved report changes</span>':'')+'</div>':'';
 return heading('Daily reports','Today’s live lists and saved daily records. Reporting dates use UTC.',actions)+'<section class="panel"><div class="report-controls"><label>Report date<input id="report-date" type="date" value="'+reportDate+'" max="'+utcDay()+'"></label>'+(current?'<div class="report-view-switch" aria-label="Daily report view"><button data-report-view="live" aria-pressed="'+(mode==='live')+'">Live today</button><button data-report-view="saved" aria-pressed="'+(mode==='saved')+'"'+(!record?' disabled':'')+'>Saved report</button></div>':'<span class="tag">Historical saved report</span>')+'</div>'+viewNote+savedNote+'<div class="tabs" role="tablist" aria-label="Report type">'+[['full','Current stock'],['birth','Births today'],['death','Deaths today']].map(([k,t])=>'<button role="tab" aria-selected="'+(reportType===k)+'" class="tab '+(reportType===k?'active':'')+'" data-report="'+k+'">'+(current?t:t.replace(' today',''))+(tables?' · '+tables[({full:'stock',birth:'births',death:'deaths'}[k])].length:'')+'</button>').join('')+'</div>'+(rows===null?'<div class="empty"><strong>No saved report for this date</strong>Earlier days cannot be created retrospectively.</div>':table(rows,reportDate,quickColumns(mode==='saved'?record.columns:state.columns),{editable:mode==='live',emptyTitle:reportType==='full'?'No animals in stock':'No '+(reportType==='birth'?'births':'deaths')+' recorded for this day',emptyDescription:mode==='saved'?'These are the captured values. Choose Live today to see current changes.':'Save an animal’s birth or death date to update the live list.'}))+'</section><section class="panel record-section"><div class="section-heading"><div><h2>Saved reports</h2><p class="subtle">One set per day. Today can be replaced; earlier days are final.</p></div></div><div class="activity">'+([...state.dailyRecords].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(r=>'<div class="activity-item"><button class="id-link" data-daily-date="'+r.date+'">'+r.date+'</button><span class="tag">'+esc(r.source)+' · v'+r.revision+'</span><span>'+r.tables.stock.length+' stock · '+r.tables.births.length+' births · '+r.tables.deaths.length+' deaths</span></div>').join('')||'<div class="empty">No daily reports have been saved yet.</div>')+'</div></section><details class="panel report-settings"><summary>Daily save settings</summary><div class="report-controls"><label class="inline-check"><input id="auto-daily" type="checkbox"'+(state.settings.autoDaily!==false?' checked':'')+' '+(role!=='administrator'?'disabled':'')+'> Automatic fallback enabled</label><p>Midnight preserves an existing manual set. If none exists, the prototype checks yesterday while open or on reopening.</p></div></details>';
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
 return heading(g.name,g.notes||'Research cohort tracking','<button class="button secondary" data-action="all-groups">All groups</button><button class="button secondary" data-group="'+esc(g.id)+'">View stock & export</button><button class="button primary" data-edit-group="'+esc(g.id)+'">Edit membership</button>')+'<div class="callout">Counts reflect saved group membership and animal state at each recorded day. Activity includes changes made while an animal was a member. All times are UTC.</div><div class="overview-grid"><section class="panel"><div class="panel-head"><h2>Group over time</h2></div><div class="table-wrap" tabindex="0" role="region" aria-label="Group counts table. Use arrow keys to scroll."><table><thead><tr><th scope="col">Date</th><th scope="col">Members</th><th scope="col">Living</th><th scope="col">Deceased</th></tr></thead><tbody>'+timeline.days.map(d=>'<tr><td>'+d.date+'</td><td>'+d.members+'</td><td>'+d.living+'</td><td>'+d.deceased+'</td></tr>').join('')+'</tbody></table></div></section><section class="panel"><div class="panel-head"><h2>Current membership</h2><span class="tag">'+g.animalIds.length+' records</span></div><div class="activity">'+g.animalIds.map(id=>{const a=state.animals.find(x=>x.id===id);return '<div class="activity-item"><span class="event-dot"></span><div><button class="id-link" data-detail="'+esc(id)+'">'+esc(id)+'</button><p class="subtle">'+esc(a?.room||'Unknown')+' / '+esc(a?.cage||'Unknown')+' · '+(a?.dod?'Deceased':'Living')+'</p></div></div>';}).join('')+'</div></section></div><section class="panel"><div class="panel-head"><h2>Cohort activity & membership history</h2></div>'+timeline.events.reverse().map(historyItem).join('')+'</section>';
}
function formatTime(value){const date=new Date(value);return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(date)+' UTC';}
function historyItem(e){
 const changes=eventChanges(e,state.columns),ids=eventAnimalIds(e);
 return '<article class="history-entry"><div class="history-meta"><time datetime="'+esc(e.at)+'">'+esc(formatTime(e.at))+'</time><span>'+esc(e.actor||'Unknown user')+'</span></div><div class="history-title"><strong>'+esc(e.action)+'</strong>'+(e.animalId?' <button class="button secondary history-animal-button" data-detail="'+esc(e.animalId)+'">Open animal '+esc(e.animalId)+'</button>':'')+'</div><p class="history-summary">'+esc(historySummary(e,state.columns))+'</p>'+(ids.length&&!e.animalId?'<div class="history-animals">'+ids.slice(0,8).map(id=>'<button class="button secondary history-animal-button" data-detail="'+esc(id)+'">Open animal '+esc(id)+'</button>').join(' ')+(ids.length>8?'<span> + '+(ids.length-8)+' more</span>':'')+'</div>':'')+(changes.length?'<details class="history-detail"><summary>View '+changes.length+' recorded change'+(changes.length===1?'':'s')+'</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Recorded changes table. Use arrow keys to scroll."><table class="history-diff"><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>'+changes.map(c=>'<tr><th scope="row">'+esc(c.label)+'</th><td>'+esc(c.before)+'</td><td>'+esc(c.after)+'</td></tr>').join('')+'</tbody></table></div></details>':'')+'</article>';
}
function historyResults(){
 const events=filterHistory(state.events,{...historyFilters,columns:state.columns}),max=Math.max(1,Math.ceil(events.length/20));historyPage=Math.min(historyPage,max);
 const from=(historyPage-1)*20,rows=events.slice(from,from+20);
 return '<div class="section-heading history-results"><h2>'+events.length+' matching event'+(events.length===1?'':'s')+'</h2><span>'+esc(historyFilters.sort==='oldest'?'Oldest first':'Newest first')+'</span></div>'+(rows.length?rows.map(historyItem).join(''):'<div class="empty"><strong>No history matches these filters</strong>Change the search or clear the filters.</div>')+'<div class="table-foot"><span>'+(events.length?'Showing '+(from+1)+'–'+(from+rows.length)+' of '+events.length:'No events')+'</span><div class="pagination"><button data-history-page="-1"'+(historyPage===1?' disabled':'')+'>Previous</button><span>'+historyPage+' / '+max+'</span><button data-history-page="1"'+(historyPage===max?' disabled':'')+'>Next</button></div></div>';
}
function history(){
 const unique=key=>[...new Set(state.events.map(e=>e[key]).filter(Boolean))].sort();
 const select=(key,label,items,first)=>'<label>'+label+'<select data-history-filter="'+key+'" aria-label="'+esc(label)+'">'+options(items,historyFilters[key],first)+'</select></label>';
 return heading('Record history','Find changes by animal, activity, user or date. Expand an event to compare before and after.')+'<section class="panel"><div class="section-heading"><div><h2>Find recorded changes</h2><p class="subtle">Dates and times are shown in UTC.</p></div><button class="text-button" data-action="history-clear">Clear filters</button></div><div class="history-controls"><label>Search history<input id="history-search" placeholder="Animal ID, notes or changed values" value="'+esc(historyFilters.search||'')+'"></label>'+select('animalId','Animal',state.animals.map(a=>a.id).sort(),'All animals')+select('action','Activity',unique('action'),'All activities')+select('actor','Recorded by',unique('actor'),'All users')+'<label>From date<input type="date" data-history-filter="from" value="'+esc(historyFilters.from||'')+'"></label><label>To date<input type="date" data-history-filter="to" value="'+esc(historyFilters.to||'')+'"></label><label>Sort order<select data-history-filter="sort" aria-label="Sort order"><option value="newest"'+(historyFilters.sort!=='oldest'?' selected':'')+'>Newest first</option><option value="oldest"'+(historyFilters.sort==='oldest'?' selected':'')+'>Oldest first</option></select></label></div></section><section class="panel record-section" id="history-results" aria-live="polite">'+historyResults()+'</section>';
}

function brief(){
 return heading('Project brief','Agreed scope and remaining production decisions.')+'<div class="brief-grid">'+[
 ['01 · DAILY RECORDS','Three tables per day',['Current stock, births today and deaths today, with readable CSV copies.','Manual saves replace the same-day set; earlier days are immutable.','Clearly labelled automatic fallback if no manual record exists.','UTC is the provisional cutoff. Automatic saving can be disabled.']],
 ['02 · RESEARCH','Individuals, cohorts and pedigree',['Track group membership and individual activity over time.','Starter activities: behaviour, surgery, harvest, swab sampling and wing punch.','Researchers define typed fields, choices and required values.','Pedigree shows recorded ancestors and children.']],
 ['03 · HOUSING','Rooms with optional cages',['Room-based stock with communal accommodation allowed.','Cages have room locations and occupant lists.','Move a cage and its occupants together, preserving history.','Administrators can remove empty locations while retaining historical records.','Record arrivals and departures alongside births and deaths.']],
 ['04 · SAFE EDITING','Controlled changes and recovery',['Student, researcher and administrator role previews.','Unique immutable animal IDs; configurable data and uncertainty choices.','Stale-tab detection and confirmation for large edits.','Recover an animal baseline without erasing daily records or history.']],
 ['05 · HANDOVER','Help and durable production storage',['Section information buttons and explanations of workflows.','A shared SQL database, protected history and encrypted backups are required.','CSV export is the reporting format; it is not a full application backup.','University hosting, sign-in, roles and support ownership remain to be agreed.']],
 ['06 · SCOPE','Prototype first',['Synthetic records in this browser; about 170 bats expected in real use.','Production decisions follow successful prototype review.','Multiple separate databases are deferred.','Browser role previews and local saving are not production security.']]
 ].map(([step,title,items])=>'<section class="panel brief-card"><div class="step">'+step+'</div><h2>'+title+'</h2><ul>'+items.map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul></section>').join('')+'</div>';
}
function render(){ currentRows=[];
 page=pages.includes(location.hash.slice(1))?location.hash.slice(1):'overview';
 document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#nav-count').textContent=state.animals.filter(a=>isPresent(a,utcDay())).length;
 const pendingCount=pendingRecordReviews(state).length;
 const reviewReminder=pendingCount&&!['stock','favourites'].includes(page)?'<div class="callout pending-review-reminder"><span>'+pendingCount+' life event change'+(pendingCount===1?'':'s')+' awaiting approval</span><button class="button secondary" data-action="review-pending">Review changes</button></div>':'';
 const screens={overview,stock:register,housing,reports,groups:()=>selectedGroupId?trackGroup():groups(),favourites:register,history,brief,research:()=>researchPage(state,esc,role,researchFilters),recovery};
 $('#main').innerHTML=(storageIssue?'<div class="callout storage-error">'+esc(storageIssue)+'</div>':'')+(role==='student'?'<p class="role-notice">Student preview · read-only access</p>':'')+reviewReminder+screens[page]();
 applyRole();
}
function go(target,nextFilter){if(nextFilter)pendingFilter=nextFilter;if(page===target){if(nextFilter)filter=nextFilter;pendingFilter=null;tablePage=1;render();}else location.hash=target;}
window.addEventListener('hashchange',()=>{filter=pendingFilter||{status:location.hash==='#favourites'?'all':'living'};pendingFilter=null;tablePage=1;render();});
function cages(room,selected=''){const c=state.locations.filter(x=>x.room===room&&x.cage).map(x=>x.cage);if(selected&&!c.includes(selected))c.push(selected);$('#record-form').elements.cage.innerHTML=options(c,selected,'Communal / no cage');}
function fieldControl(c,value,attr){
 const id='choices_'+c.key,attrs=attr+' aria-label="'+esc(c.label)+'"'+(c.required?' required':'');
 if(c.type==='select'&&!c.allowNew)return '<select '+attrs+'>'+options(c.options||[],String(value??''),'Not specified')+'</select>';
 if(c.type==='textarea'||c.key==='notes'&&c.type==='text')return '<textarea '+attrs+' rows="3">'+esc(value)+'</textarea>';
 return '<input '+attrs+' type="'+(c.type==='select'?'text':c.type||'text')+'" value="'+esc(value)+'"'+(c.type==='number'?' step="any"'+(c.min!==''&&c.min!=null?' min="'+esc(c.min)+'"':'')+(c.max!==''&&c.max!=null?' max="'+esc(c.max)+'"':''):'')+(c.type==='select'?' list="'+id+'"':'')+'>'+(c.type==='select'?'<datalist id="'+id+'">'+options(c.options||[])+'</datalist>':'');
}
function openRecord(id=null){
 formRevision=raw;editId=id;const a=id?state.animals.find(x=>x.id===id):null,f=$('#record-form');f.reset();$('#form-errors').textContent='';$('#record-title').textContent=id?'Edit '+id:'Add animal';f.elements.id.readOnly=!!id;
 $('#record-form .form-nav strong').textContent=id?'Editing '+id+' · Jump to section':'New animal · Jump to section';
 f.elements.sex.innerHTML=options(sexChoices(),a?.sex||'Unknown');f.elements.room.innerHTML=options(rooms(),a?.room||rooms()[0]);
 if(a?.room&&!rooms().includes(a.room))f.elements.room.add(new Option(a.room+' (historical)',a.room,true,true));
 cages(f.elements.room.value,a?.cage);
 for(const k of ['id','species','sex','line','room','cage','dob','dod','arrived','departed','mother','father','pob','notes'])f.elements[k].value=a?.[k]??(k==='sex'?'Unknown':k==='species'?'Bat':k==='room'?rooms()[0]:k==='cage'?'':'');
 for(const field of ['dob','dod','arrived','departed'])f.elements[field].max=utcDay();
 $('#parent-ids').innerHTML=state.animals.filter(x=>x.id!==id).map(x=>'<option value="'+esc(x.id)+'"></option>').join('');
 $('#custom-inputs').innerHTML=state.columns.filter(x=>x.custom).map(c=>'<label>'+esc(c.label)+(c.required?' *':'')+fieldControl(c,a?fieldValue(a,c):c.defaultValue||'','name="'+c.key+'"')+'<small>'+esc(c.description||'')+'</small></label>').join('');
 for(const c of state.columns.filter(c=>configurable(c)&&!c.custom)){const el=f.elements[c.key];el.outerHTML=fieldControl(c,a?fieldValue(a,c):c.defaultValue||el.value,'name="'+c.key+'"');}
 $('#record-dialog').showModal();
}
let treeFull=false,treeAnimalId=null,treeZoom=1;
function detail(id){
 treeAnimalId=id;treeZoom=1;
 const view=page==='reports'?dailyReportView(state,reportDate,{view:reportMode}):null,historicalRecord=view?.mode==='saved'?view.record:null;
 const a=historicalRecord?historicalRecord.animals.find(x=>x.id===id):state.animals.find(x=>x.id===id);if(!a)return;
 const historical=!!historicalRecord,schema=historicalRecord?.columns||state.columns;
 const fields=items=>'<dl class="detail-grid">'+items.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value==null||value===''?'Not specified':value)+'</dd></div>').join('')+'</dl>';
 const section=(title,items)=>'<section class="record-detail-section"><h3>'+title+'</h3>'+fields(items)+'</section>';
 const events=state.events.filter(e=>eventAnimalIds(e).includes(id)&&(!historical||(e.at.slice(0,10)<=reportDate&&e.at<=historicalRecord.savedAt))).sort((a,b)=>b.at.localeCompare(a.at));
 $('#detail-content').innerHTML='<div class="dialog-heading"><div><div class="eyebrow">'+(historical?'SAVED REPORT · '+reportDate:'ANIMAL RECORD')+'</div><h2>'+esc(a.id)+'</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Close animal details">×</button></div><div class="record-summary" role="group" aria-label="Record actions">'+(!historical&&canEdit()?'<button class="button primary" data-edit="'+esc(a.id)+'">Edit '+esc(a.id)+'</button>':'')+'<button class="button secondary" data-action="family-tree">View family tree</button>'+animalStatus(a)+(historical?'<span>Read-only saved state</span>':'')+'</div>'+section('Identity & location',[['Species',a.species],['Sex',a.sex],['Line',a.line],['Room',a.room],['Cage',a.cage||'Communal / no cage'],['Age',age(a.dob,historical?reportDate:utcDay(),a.dod)]])+section('Life events',[['Birth date',a.dob],['Arrival date',a.arrived],['Death date',a.dod],['Departure date',a.departed]])+section('Family',[['Parent 1',a.mother],['Parent 2',a.father],['Place of birth',a.pob]])+'<section class="record-detail-section"><h3>Notes</h3><p class="detail-notes">'+esc(a.notes||'No notes recorded.')+'</p>'+fields(schema.filter(x=>x.custom).map(f=>[f.label,a.extra?.[f.key]]))+'</section>'+familyTree(a,historical?historicalRecord.animals:state.animals,esc,treeFull)+'<section class="detail-history"><div class="section-heading"><h3>Record history</h3><button class="text-button" data-history-animal="'+esc(id)+'">Filter all history for this bat</button></div>'+events.slice(0,8).map(historyItem).join('')+(events.length>8?'<p class="subtle">Showing the latest 8 of '+events.length+' events. Use the history filter to see all.</p>':'')+'</section>';
 if(!$('#detail-dialog').open)$('#detail-dialog').showModal();applyRole();
}
function zoomTree(value){treeZoom=Math.max(.1,Math.min(2,value));const canvas=$('.family-canvas');if(canvas)canvas.style.zoom=treeZoom;const output=$('#tree-zoom-value');if(output)output.textContent=Math.round(treeZoom*100)+'%';}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.treeMode){treeFull=b.dataset.treeMode==='full';detail(treeAnimalId);}
 if(b.dataset.treeZoom)zoomTree(treeZoom+Number(b.dataset.treeZoom));
 if(b.hasAttribute('data-tree-fit')){zoomTree(1);const viewport=$('.family-scroll'),canvas=$('.family-canvas');zoomTree(Math.min(1,(viewport.clientWidth-24)/canvas.scrollWidth));viewport.scrollTo(0,0);}
 if(b.hasAttribute('data-tree-expand')){$('#detail-dialog').classList.toggle('expanded-tree');b.textContent=$('#detail-dialog').classList.contains('expanded-tree')?'Restore view':'Expand view';}
});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportFile(format){
 const view=page==='reports'?dailyReportView(state,reportDate,{view:reportMode}):null,record=view?.mode==='saved'?view.record:null;
 if(view?.mode==='missing'){notify('No saved report exists for this date.');return;}
 const at=page==='reports'?reportDate:utcDay(),schema=record?.exportColumns||state.columns,rows=record?.rows?.[reportKey()]||exportRows(currentRows,at,schema);
 if(!rows[0]?.length){notify('Choose at least one visible column.');return;}
 const name='colony-'+(page==='reports'?view.mode+'-'+reportKey()+'-'+reportDate:page+'-'+at);
 download(format==='xlsx'?workbook(rows):(record?.csv?.[reportKey()]||csv(rows)),name+'.'+format,format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8');
 notify('Exported '+(rows.length-1)+' records'+(view?' from the '+view.mode+' view.':'.'));
}
function renderColumns(){
 $('#column-list').innerHTML=columnDraft.map((c,i)=>'<div class="field-card" data-row-tone="'+(i%2?'alternate':'base')+'"><div class="column-row"><input type="checkbox" data-visible="'+i+'" aria-label="Show '+esc(c.label)+'"'+(c.visible?' checked':'')+'><input type="text" data-label="'+i+'" aria-label="Heading for '+esc(c.label)+'" maxlength="60" value="'+esc(c.label)+'"><button data-move="'+i+'" data-direction="-1" aria-label="Move '+esc(c.label)+' up"'+(i===0?' disabled':'')+'>↑</button><button data-move="'+i+'" data-direction="1" aria-label="Move '+esc(c.label)+' down"'+(i===columnDraft.length-1?' disabled':'')+'>↓</button></div>'+(configurable(c)?'<details><summary>Value settings · '+esc(fieldTypes.find(([t])=>t===c.type)?.[1]||c.type)+'</summary><div class="form-grid">'+fieldSettings(c,i)+'</div></details>':'<small class="subtle">'+(['id','age'].includes(c.key)?'Identity or calculated value':'Uses colony rules for locations, sex, dates or parent records')+'</small>')+'</div>').join('');
}
function fieldSettings(c,i){
 const setting=(k)=>'data-setting="'+k+'" data-index="'+i+'"';
 return '<label>Value type<select '+setting('type')+'>'+fieldTypes.map(([k,label])=>'<option value="'+k+'"'+(c.type===k?' selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Default for new animals<input '+setting('defaultValue')+' value="'+esc(c.defaultValue||'')+'"></label><label class="check-label"><input type="checkbox" '+setting('required')+(c.required?' checked':'')+'> Value required</label><label>Description / guidance<input '+setting('description')+' value="'+esc(c.description||'')+'"></label>'+(c.type==='select'?'<label class="full">Choices (one per line)<textarea '+setting('options')+' rows="4">'+esc((c.options||[]).join('\n'))+'</textarea><button type="button" class="text-button" data-values="'+i+'">Add choices from existing values</button></label><label class="check-label full"><input type="checkbox" '+setting('allowNew')+(c.allowNew?' checked':'')+'> Allow typing new choices · new values join the list when saved</label>':'')+(c.type==='number'?'<label>Minimum (optional)<input type="number" step="any" '+setting('min')+' value="'+esc(c.min??'')+'"></label><label>Maximum (optional)<input type="number" step="any" '+setting('max')+' value="'+esc(c.max??'')+'"></label>':'');
}
function openColumns(){formRevision=raw;columnDraft=structuredClone(state.columns);researchFieldDraft=structuredClone(state.researchFields);$('#sex-choices').value=sexChoices().join(', ');$('#research-types').value=state.researchTypes.join(', ');$('#field-form').reset();$('#field-error').textContent='';renderColumns();$('#columns-dialog').showModal();}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,a');if(!b)return;
 if(b.dataset.help){showHelp(b.dataset.help);return;}
 if(b.dataset.values!==undefined){const i=Number(b.dataset.values),c=columnDraft[i];c.options=[...new Set([...(c.options||[]),...state.animals.map(a=>String(fieldValue(a,c))).filter(Boolean)])];renderColumns();$('#column-list').children[i].querySelector('details').open=true;return;}
 if(await handleRecordReview(b))return;
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(isWriteAction(b)&&!canEdit()){notify('Student preview is read-only.');return;}
 if((b.dataset.action==='columns'||b.dataset.action==='location-add'||b.dataset.removeCage||b.dataset.removeRoom)&&role!=='administrator'){notify('Switch to Administrator preview to configure fields or locations.');return;}
 if(await extensionClick(b))return;
 if(b.dataset.action){
  const a=b.dataset.action;
  if(a==='add')openRecord();
  if(a==='review-pending'){go('stock');requestAnimationFrame(()=>$('#pending-reviews')?.scrollIntoView({block:'start'}));}
  if(a==='family-tree'){const tree=$('#detail-dialog .pedigree');if(tree){tree.focus({preventScroll:true});tree.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
  if(a==='columns')openColumns();
  if(a==='xlsx'||a==='csv'){exportFile(a);b.closest('.export-menu')?.removeAttribute('open');}
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
 if(b.dataset.recordSection){const section=$('#'+b.dataset.recordSection);if(section){section.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
 if(b.dataset.reportView){reportMode=b.dataset.reportView;tablePage=1;render();}
 if(b.dataset.registerView){registerView=b.dataset.registerView;tablePage=1;render();}
 if(b.dataset.historyPage){historyPage+=Number(b.dataset.historyPage);$('#history-results').innerHTML=historyResults();}
 if(b.dataset.historyAnimal){historyFilters={animalId:b.dataset.historyAnimal,sort:'newest'};historyPage=1;$('#detail-dialog').close();go('history');}
 if(b.dataset.action==='history-clear'){historyFilters={sort:'newest'};historyPage=1;render();}
 if(b.dataset.move){const i=Number(b.dataset.move),j=i+Number(b.dataset.direction);[columnDraft[i],columnDraft[j]]=[columnDraft[j],columnDraft[i]];renderColumns();}
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.setting){const c=columnDraft[Number(el.dataset.index)],k=el.dataset.setting;c[k]=el.type==='checkbox'?el.checked:k==='options'?choices(el.value):el.value;}
 if(el.id==='search'){filter.search=el.value;tablePage=1;$('#register-table').innerHTML=registerResults(filterAnimals(state.animals,{...filter,favourites:page==='favourites'?state.favourites:null,group:filter.groupId?state.groups.find(g=>g.id===filter.groupId)?.animalIds:null}));}
 if(el.dataset.label!==undefined)columnDraft[Number(el.dataset.label)].label=el.value;
 if(el.id==='history-search'){historyFilters.search=el.value;historyPage=1;$('#history-results').innerHTML=historyResults();}
});
document.addEventListener('change',async e=>{
 const el=e.target;
 if(await extensionChange(el))return;
 if(el.dataset.filter){filter[el.dataset.filter]=el.value;if(el.dataset.filter==='room')filter.cage='';tablePage=1;render();}
 if(el.id==='report-date'){if(!el.value||el.value>utcDay()){notify('Choose a valid date up to today.');return;}reportDate=el.value;reportMode=reportDate===utcDay()?'live':'saved';tablePage=1;render();}
 if(el.dataset.historyFilter){historyFilters[el.dataset.historyFilter]=el.value;historyPage=1;$('#history-results').innerHTML=historyResults();}
 if(el.id==='all-dates'){allDates=el.checked;tablePage=1;render();}
 if(el.dataset.visible!==undefined)columnDraft[Number(el.dataset.visible)].visible=el.checked;
});
$('#record-form').elements.room.addEventListener('change',e=>cages(e.target.value));
$('#record-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!canEdit())return;const f=e.target,before=state.animals.find(x=>x.id===editId),a={...before,extra:{...before?.extra}};
 for(const k of ['id','species','sex','line','room','cage','dob','dod','arrived','departed','mother','father','pob','notes'])a[k]=f.elements[k].value.trim();
 for(const c of state.columns.filter(x=>x.custom))a.extra[c.key]=f.elements[c.key].value.trim();
 const errors=[...validateAnimal(a,state.animals,state.locations,editId,utcDay(),state.columns),...validateReviewedEventDates(state,before,a,utcDay())];
 if(errors.length){$('#form-errors').innerHTML='<ul>'+errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';return;}
 const lifeChanges=lifeEventChanges(before,a);
 if(lifeChanges.length&&!await confirmChanges('Confirm life event for '+a.id,'Check the animal ID and dates before saving. Death and departure remove this animal from Living stock. The change will remain in Changes awaiting approval across refreshes until you approve it or undo it.',lifeChanges))return;
 const changes=before?[...Object.keys(a).filter(k=>k!=='extra'&&String(a[k]??'')!==String(before[k]??'')).map(k=>k+': '+(before[k]||'—')+' → '+(a[k]||'—')),...state.columns.filter(c=>c.custom&&String(a.extra[c.key]??'')!==String(before.extra?.[c.key]??'')).map(c=>c.label+': '+(before.extra?.[c.key]||'—')+' → '+(a.extra[c.key]||'—'))]:[];if(!lifeChanges.length&&changes.length>=5&&!await confirmChanges('Review record changes','You are changing '+changes.length+' fields for '+a.id,changes))return;
 try{if(await commit(saveAnimalWithReview(state,a,actorName(),new Date().toISOString(),editId,role),formRevision)){$('#record-dialog').close();render();notify(lifeChanges.length?'Life event saved for '+a.id+'. Pending changes remain in the register until approved or undone.':'Record saved with its change history.');}}catch(error){$('#form-errors').textContent=error.message;}
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
 e.preventDefault();if(role!=='administrator')return;const f=e.target,label=f.elements.label.value.trim(),type=f.elements.type.value==='textarea'&&f.elements.target.value==='research'?'text':f.elements.type.value,allowNew=f.elements.target.value==='animal'&&f.elements.allowNew.checked,opts=choices(f.elements.options.value),draft=f.elements.target.value==='research'?researchFieldDraft:columnDraft;
 if(!label||draft.some(c=>c.label.toLowerCase()===label.toLowerCase())||(type==='select'&&!allowNew&&!opts.length)){$('#field-error').textContent='Use a unique heading and supply choices for a dropdown.';return;}
 draft.push({key:'custom_'+crypto.randomUUID().replaceAll('-',''),label,type,allowNew,options:opts,required:f.elements.requiredField.checked,custom:true,visible:true});f.reset();$('#field-error').textContent='';renderColumns();
});
$('#save-columns').addEventListener('click',async()=>{
 if(role!=='administrator')return;
 const sex=choices($('#sex-choices').value),types=choices($('#research-types').value),all=[...columnDraft,...researchFieldDraft];
 const schemaIssues=schemaErrors(columnDraft,state.animals);
 if(schemaIssues.length){$('#field-error').textContent=schemaIssues.join(' ');return;}
 const invalid=all.some(c=>!c.label.trim()||(c.type==='select'&&!c.allowNew&&!c.options?.length));
 if(!columnDraft.some(c=>c.visible)||invalid||new Set(columnDraft.map(c=>c.label.trim().toLowerCase())).size!==columnDraft.length||new Set(researchFieldDraft.map(c=>c.label.trim().toLowerCase())).size!==researchFieldDraft.length||!sex.length||!types.length){$('#field-error').textContent='Keep visible columns, unique headings and valid dropdown choices.';return;}
 if(state.animals.some(a=>!sex.includes(a.sex))||state.researchEntries.some(entry=>!types.includes(entry.type))){$('#field-error').textContent='Keep sex choices and activity categories used by existing records.';return;}

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


const help={
 overview:['Colony overview','Counts show living animals currently present, excluding deaths, departures and archived records. The sample has 170 synthetic animals across several family generations. Use the register to find a bat or open Rooms & cages to locate it.'],
 stock:['Animal register','Death and departure changes remain in Changes awaiting approval across refreshes. Open, edit, undo or approve them individually, or approve all after reviewing the list. Pending changes affect live stock and reports immediately; approval closes the queue and records who checked them. Unapproved dates can be corrected or undone after their recording day. Animal IDs are unique and cannot be renamed. Room is required; cage is optional. Unknown values can be represented using configured choices or blank optional fields. Event dates in earlier days are final. A newly arriving adult can have an earlier birth date as background information. Record its arrival today. Custom fields are designed in Administrator preview.'],
 housing:['Rooms and cages','Every housed bat has a room. Communal accommodation has no cage. A cage belongs to a room. Moving an occupied cage moves its current occupants together and records each move. Administrator preview can add locations and remove empty rooms or cages after review. Move all present animals first. Removing a room also removes its empty cages. Animal records, historical locations and saved daily reports are retained.'],
 reports:['Daily records','Live today updates immediately after each animal save, including births and deaths. Saved report shows your last capture, with frozen values and headings. Download saved CSV set always exports the capture; the individual CSV and Excel buttons export the selected view. Save today to capture three consistent tables: current stock, births today and deaths today. Saving again today replaces this daily set and keeps the replacement in history. At midnight UTC the set becomes final. Automatic fallback preserves an existing manual set; it only generates yesterday if missing and history is available. It runs while this tab is open or checks yesterday on reopening. It is not a server scheduler. Each saved set contains CSV copies with frozen headings; download all three as a ZIP. These copies are stored in this browser, so download a full backup as well.'],
 groups:['Research groups','Groups are changing research cohorts. Select members, add group context, and inspect membership and animal activity over time. Pedigree is a separate relationship structure. Research log entries can be recorded for a selected group’s members.'],
 research:['Research log','Record dated research activities for one animal or several selected animals. Behaviour, surgery, harvest, swab sampling and wing punch are starter categories from the lab discussion; administrators can configure categories and typed fields. Entries in earlier days are final. A category records the activity; it does not automatically record a birth, death or departure. Use the animal record for stock-changing events.'],
 recovery:['Recovery','Administrator preview can recover animal values from a saved daily baseline. Review the affected count first. Animals introduced later are archived rather than deleted, so IDs, pedigree references and history survive. Daily records, research entries, groups and current field definitions are preserved. This is an animal-data recovery demonstration, not full database disaster recovery. Download a full JSON backup before major changes.'],
 history:['Record history','Search animal IDs, notes and changed values. Combine animal, activity, user and inclusive date filters, then choose newest or oldest first. Expand an event to compare each recorded value before and after. An animal’s history includes its research and cohort activity. Recovery adds a new event. Browser storage is not a protected five-year institutional audit store.'],
 favourites:['Favourites','Star frequently used animals for quick access. In the prototype favourites belong to this browser; production favourites will belong to signed-in users.'],
 brief:['Project brief','This prototype demonstrates workflows using synthetic data. Production needs authenticated SQL storage, institution-managed backups, access enforcement and reliable scheduled exports. Multi-database support is deferred. The infrastructure decision follows prototype review.']
};
function showHelp(section){const [title,body]=help[section]||help.overview;$('#help-title').textContent=title;$('#help-content').innerHTML='<p>'+esc(body)+'</p>';$('#help-dialog').showModal();}
function isWriteAction(b){return ['add','group','columns','save-daily','research-add','location-add','recover'].includes(b.dataset.action)||b.dataset.edit||b.dataset.editGroup||b.dataset.researchEdit||b.dataset.moveCage||b.dataset.removeCage||b.dataset.removeRoom;}
function applyRole(){
 document.querySelectorAll('[data-action="add"],[data-action="group"],[data-action="save-daily"],[data-action="research-add"],[data-edit],[data-edit-group],[data-research-edit],[data-move-cage]').forEach(b=>b.disabled=!canEdit());
 document.querySelectorAll('[data-action="columns"],[data-action="location-add"],[data-action="recover"]').forEach(b=>b.disabled=role!=='administrator');
 $('#role').value=role;
 const identity=$('.identity div');if(identity)identity.innerHTML=esc(actorName())+'<small>Prototype workspace</small>';
}
function confirmChanges(title,body,items=[],applyLabel='Apply changes'){
 const dialog=$('#confirm-dialog');if(dialog.open)return Promise.resolve(false);
 $('#confirm-apply').textContent=applyLabel;$('#confirm-title').textContent=title;$('#confirm-content').innerHTML='<p>'+esc(body)+'</p>'+(items.length?'<ul class="review-list">'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'');
 return new Promise(resolve=>{let accepted=false;$('#confirm-apply').onclick=()=>{accepted=true;dialog.close();};dialog.addEventListener('close',()=>{resolve(accepted);$('#confirm-apply').onclick=null;$('#confirm-apply').textContent='Apply changes';},{once:true});dialog.showModal();});
}
function recovery(){
 const dates=[...state.dailyRecords].sort((a,b)=>b.date.localeCompare(a.date));
 return heading('Recovery','Preview recovery of animal records from a saved day.')+'<div class="callout">Download a backup before recovery. Earlier daily reports, history and research entries stay preserved. Full production backup restoration is still required.</div><section class="panel recovery-panel"><h2>Recover an animal baseline</h2><p>Choose a saved date and review the changes before applying them. Animals added later are archived, preserving their identities.</p><label>Saved daily baseline<select id="recovery-date">'+dates.map(r=>'<option value="'+r.date+'">'+r.date+' · '+esc(r.source)+' · v'+r.revision+'</option>').join('')+'</select></label><button class="button primary" data-action="recover"'+(!dates.length?' disabled':'')+'>Preview recovery</button>'+(dates.length?'':'<p class="subtle">Save a daily record first.</p>')+'</section>';
}
const baseRenderColumns=renderColumns;
renderColumns=function(){
 baseRenderColumns();

 $('#research-field-list').innerHTML=researchFieldDraft.map((c,i)=>'<div class="column-row" data-row-tone="'+(i%2?'alternate':'base')+'"><input type="text" data-research-label="'+i+'" aria-label="Research heading '+esc(c.label)+'" value="'+esc(c.label)+'" maxlength="60"><small>'+esc(c.type)+'</small></div><div class="column-details" data-row-tone="'+(i%2?'alternate':'base')+'"><label class="inline-check"><input type="checkbox" data-research-required="'+i+'"'+(c.required?' checked':'')+'> Required</label>'+(c.type==='select'?'<label>Allowed choices<input data-research-choices="'+i+'" value="'+esc((c.options||[]).join(', '))+'"></label>':'')+'</div>').join('')||'<p class="subtle">Add fields below to define measurements or observations for research entries.</p>';
};
async function extensionClick(b){
 if(b.dataset.action==='research-clear'){researchFilters={};render();return true;}
 if(b.dataset.communal){go('stock',{status:'living',room:b.dataset.communal,communal:true});return true;}
 if(b.dataset.dailyDate){reportDate=b.dataset.dailyDate;reportMode='saved';tablePage=1;render();return true;}
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
 if(b.dataset.removeCage||b.dataset.removeRoom){
  const expected=raw,cage=b.dataset.removeCage||'',room=b.dataset.sourceRoom||b.dataset.removeRoom;
  const cageCount=state.locations.filter(l=>l.room===room&&l.cage).length;
  if(!await confirmChanges(cage?'Remove cage':'Remove room',cage?'Remove cage '+cage+' from '+room+'? The room stays available.':'Remove '+room+' and its '+cageCount+' empty cage'+(cageCount===1?'':'s')+'?', ['Animal records, recorded locations and saved daily reports are retained.','This removal will be recorded in the changes log.']))return true;
  if(role!=='administrator'){notify('Administrator preview is required to remove locations.');return true;}
  try{const next=cage?removeCage(state,room,cage,actorName()):removeRoom(state,room,actorName());if(await commit(next,expected)){render();notify((cage?'Cage':'Room')+' removed from active housing. Historical records retained.');}}catch(error){notify(error.message);}return true;
 }
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
 if(el.dataset.setting==='type'){const i=Number(el.dataset.index);columnDraft[i].type=el.value;renderColumns();$('#column-list').children[i].querySelector('details').open=true;return true;}
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
const expanded=expandDemo(state);
if(expanded!==state&&!storageIssue)await commit(expanded);
render();
// Persist the tracking start once; no synthetic historic daily records are invented.
if(!storageIssue&&(!raw||!JSON.parse(raw).automaticStarted))await commit(structuredClone(state));
await checkAutomatic();
setInterval(()=>{checkAutomatic();if(page==='reports'&&!document.querySelector('dialog[open]'))render();},30000);

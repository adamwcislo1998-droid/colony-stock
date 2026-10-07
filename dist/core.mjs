export const columns = [
 ['sex','Sex'],['id','Animal ID'],['room','Room'],['cage','Cage'],['line','Line'],['pob','PoB'],
 ['parents','Parents'],['age','Age'],['notes','Notes'],['dob','Date of birth'],['dod','Date of death']
];
export const defaultColumns=()=>[...columns.map(([key,label])=>({key,label:key==='pob'?'Place of birth':label,visible:true,type:'text',custom:false})),{key:'species',label:'Species',visible:false,type:'text',custom:false}];
export function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export function age(dob,at=today(),dod=''){
 if(!dob)return 'Unknown';
 const end=dod&&dod<at?dod:at,a=new Date(dob+'T00:00:00Z'),b=new Date(end+'T00:00:00Z'),days=Math.floor((b-a)/86400000);
 if(days<0)return 'Not yet born';if(days<60)return days+(days===1?' day':' days');
 let m=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();if(b.getUTCDate()<a.getUTCDate())m--;
 return m<24?m+' months':Math.floor(m/12)+' yr '+m%12+' mo';
}
export function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;}
export function validateAnimal(a,animals,locations,originalId=null,at=today(),schema=[]){
 const errors=[];
 if(!a.id?.trim())errors.push('Animal ID is required.');
 if(a.id?.length>60)errors.push('Animal ID must be 60 characters or fewer.');
 if(animals.some(x=>x.id===a.id&&x.id!==originalId))errors.push('That Animal ID already exists.');
 if(originalId&&a.id!==originalId)errors.push('Animal ID cannot be changed in this prototype.');
 if(!['Female','Male','Unknown'].includes(a.sex))errors.push('Choose a valid sex.');
 if(!a.species?.trim())errors.push('Species is required; use Unknown if unconfirmed.');
 if(!locations.some(x=>x.room===a.room&&x.cage===a.cage))errors.push('Select a cage within its room.');
 for(const key of ['dob','dod']){
  if(a[key]&&!validDate(a[key]))errors.push('Enter a valid '+(key==='dob'?'birth':'death')+' date.');
  else if(a[key]&&a[key]>at)errors.push('Birth and death dates cannot be in the future.');
 }
 if(a.dob&&a.dod&&a.dod<a.dob)errors.push('Death cannot be before birth.');
 const graph=new Map(animals.map(x=>[x.id,x]));graph.set(a.id,a);const stack=new Set(),complete=new Set();
 function cycle(id){if(stack.has(id))return true;if(complete.has(id))return false;const n=graph.get(id);if(!n)return false;stack.add(id);for(const p of [n.mother,n.father].filter(Boolean))if(cycle(p))return true;stack.delete(id);complete.add(id);return false;}
 if(cycle(a.id))errors.push('Parent references cannot create a family-tree cycle.');
 if(a.mother&&a.mother===a.father)errors.push('The two parent references must be different.');
 for(const id of [a.mother,a.father].filter(Boolean)){const p=graph.get(id);if(!p)errors.push('Parent '+id+' is not in the register.');else if(p.dob&&a.dob&&p.dob>a.dob)errors.push('A parent cannot be born after this animal.');}
 for(const f of schema.filter(x=>x.custom)){
  const v=a.extra?.[f.key];if(v===''||v==null)continue;
  if(f.type==='number'&&!Number.isFinite(Number(v)))errors.push(f.label+' must be a number.');
  if(f.type==='date'&&!validDate(v))errors.push(f.label+' must be a valid date.');
  if(f.type==='select'&&!f.options.includes(v))errors.push('Choose a valid value for '+f.label+'.');
 }
 for(const child of graph.values())for(const id of [child.mother,child.father].filter(Boolean)){const p=graph.get(id);if(p?.dob&&child.dob&&p.dob>child.dob)errors.push('A parent cannot be born after offspring '+child.id+'.');}
 return [...new Set(errors)];
}
export function initialState(at=new Date().toISOString().slice(0,10)){
 const day=n=>{const d=new Date(at+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const locations=[{room:'Room A',cage:'A-01'},{room:'Room A',cage:'A-02'},{room:'Room A',cage:'A-03'},{room:'Room B',cage:'B-01'},{room:'Room B',cage:'B-02'},{room:'Room C',cage:'C-01'},{room:'Room C',cage:'C-02'}];
 const animals=Array.from({length:18},(_,i)=>({id:'DEMO-'+String(i+1).padStart(3,'0'),species:'Bat (species to be specified)',sex:i%3===0?'Male':i%3===1?'Female':'Unknown',...locations[i%locations.length],line:i%2?'Line B':'Line A',pob:'',mother:i>11?'DEMO-002':'',father:i>11?'DEMO-001':'',dob:i>14?day(-(i-15)):day(-420-i*17),dod:i===13?day(-1):i===14?day(-6):'',notes:i===0?'Synthetic parent record.':i===15?'Synthetic birth record for reviewing the workflow.':'Demonstration record.',extra:{}}));
 // Demo parents must be older than their offspring.
 animals[0].dob=day(-1600);animals[1].dob=day(-1500);
 const baseline={id:'seed',at:day(-7)+'T00:00:00.000Z',actor:'Demo data',action:'Demo baseline',animalId:'',before:null,after:null,snapshot:animals.filter(a=>a.dob<=day(-7)).map(a=>({...a,dod:''}))},events=[baseline];
 const changes=animals.filter(a=>a.dob>day(-7)||a.dod).map(a=>({a,date:a.dod||a.dob})).sort((a,b)=>a.date.localeCompare(b.date));
 let snapshot=structuredClone(baseline.snapshot);
 for(const {a,date}of changes){const prev=snapshot.find(x=>x.id===a.id)||null;snapshot=prev?snapshot.map(x=>x.id===a.id?a:x):[...snapshot,a];events.push({id:'seed-'+a.id,at:date+'T00:00:00.000Z',actor:'Demo data',action:prev?'Death recorded':'Animal added',animalId:a.id,before:prev,after:a,snapshot:structuredClone(snapshot)});}
 const groups=[{id:'demo-group',name:'Example study group',notes:'Synthetic cohort for reviewing research group tracking.',animalIds:['DEMO-001','DEMO-002','DEMO-006']}];
 events.splice(1,0,{...baseline,id:'seed-group',action:'Group created',groupId:'demo-group',groupBefore:null,groupAfter:structuredClone(groups[0])});
 return {version:1,animals,locations,events,columns:defaultColumns(),favourites:['DEMO-001','DEMO-002'],groups};
}
export function saveAnimal(state,a,actor,at=new Date().toISOString(),originalId=null){
 const before=originalId?state.animals.find(x=>x.id===originalId):null;if(originalId&&!before)throw new Error('This record no longer exists.');
 const next=structuredClone(state);next.animals=before?next.animals.map(x=>x.id===originalId?structuredClone(a):x):[...next.animals,structuredClone(a)];
 const action=!before?'Animal added':!before.dod&&a.dod?'Death recorded':before.dod&&!a.dod?'Death corrected':'Record updated';
 next.events.push({id:crypto.randomUUID(),at,actor,action,animalId:a.id,before:before?structuredClone(before):null,after:structuredClone(a),snapshot:structuredClone(next.animals)});return next;
}
export function asOf(state,date){const events=state.events.filter(e=>e.at.slice(0,10)<=date).sort((a,b)=>a.at.localeCompare(b.at));return events.length?structuredClone(events.at(-1).snapshot):null;}
export function filterAnimals(animals,f={}){
 const q=(f.search||'').trim().toLowerCase();
 return animals.filter(a=>(!q||[a.id,a.species,a.room,a.cage,a.line,a.notes,a.mother,a.father,...Object.values(a.extra||{})].some(v=>String(v||'').toLowerCase().includes(q)))&&(!f.room||a.room===f.room)&&(!f.cage||a.cage===f.cage)&&(!f.sex||a.sex===f.sex)&&(!f.line||a.line===f.line)&&(!f.status||f.status==='all'||(f.status==='living'?!a.dod:!!a.dod))&&(!f.favourites||f.favourites.includes(a.id))&&(!f.group||f.group.includes(a.id)));
}
export function cell(a,key,at=today()){
 return key==='parents'?[a.mother,a.father].filter(Boolean).join(' / '):key==='age'?age(a.dob,at,a.dod):key.startsWith('custom_')?(a.extra?.[key]??''):(a[key]||'');
}
export function exportRows(animals,at=today(),schema=defaultColumns()){const c=schema.filter(x=>x.visible);return[c.map(x=>x.label),...animals.map(a=>c.map(x=>cell(a,x.key,at)))];}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}

export function saveGroup(state,group,actor,at=new Date().toISOString()){
 const next=structuredClone(state),before=next.groups.find(g=>g.id===group.id)||null;
 next.groups=before?next.groups.map(g=>g.id===group.id?structuredClone(group):g):[...next.groups,structuredClone(group)];
 next.events.push({id:crypto.randomUUID(),at,actor,action:before?'Group updated':'Group created',groupId:group.id,groupBefore:structuredClone(before),groupAfter:structuredClone(group),animalId:'',before:null,after:null,snapshot:structuredClone(next.animals)});
 return next;
}
export function groupTimeline(state,id){
 let members=null;const days=new Map(),events=[];
 for(const e of [...state.events].sort((a,b)=>a.at.localeCompare(b.at))){
  if(e.groupId===id){members=e.groupAfter.animalIds;events.push(e);}
  if(members===null)continue;
  if(e.animalId&&members.includes(e.animalId))events.push(e);
  const records=e.snapshot.filter(a=>members.includes(a.id));
  days.set(e.at.slice(0,10),{date:e.at.slice(0,10),members:members.length,living:records.filter(a=>!a.dod).length,deceased:records.filter(a=>a.dod).length});
 }
 return {days:[...days.values()],events};
}

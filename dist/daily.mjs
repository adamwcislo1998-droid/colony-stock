import {validDate,asOf,exportRows,csv,defaultColumns} from './core.mjs';
export function utcDay(at=new Date()){
 const value=new Date(at);if(Number.isNaN(value.valueOf()))throw new Error('A valid save timestamp is required.');return value.toISOString().slice(0,10);
}
function previousDay(date){const value=new Date(date+'T00:00:00Z');value.setUTCDate(value.getUTCDate()-1);return value.toISOString().slice(0,10);}
function checkDate(date){if(!validDate(date))throw new Error('A valid daily record date is required.');}
export function isPresent(animal,date=utcDay()){
 return !animal.archived&&(!animal.dob||animal.dob<=date)&&(!animal.arrived||animal.arrived<=date)&&(!animal.dod||animal.dod>date)&&(!animal.departed||animal.departed>date);
}
export function dailyTables(animals,date){
 checkDate(date);return structuredClone({stock:animals.filter(a=>isPresent(a,date)),births:animals.filter(a=>a.dob===date),deaths:animals.filter(a=>a.dod===date)});
}
export function dailyReportView(state,date,{view='live',at=new Date()}={}){
 checkDate(date);
 if(!['live','saved'].includes(view))throw new Error('Choose the live or saved daily report.');
 const current=date===utcDay(at),record=(state.dailyRecords||[]).find(r=>r.date===date)||null;
 const unsaved=current&&(!record||JSON.stringify(record.animals)!==JSON.stringify(state.animals)||JSON.stringify(record.columns)!==JSON.stringify(state.columns||defaultColumns()));
 const mode=current&&view==='live'?'live':record?'saved':'missing';
 return {record:record?structuredClone(record):null,tables:mode==='live'?dailyTables(state.animals,date):mode==='saved'?structuredClone(record.tables):null,mode,unsaved,current};
}
function columnsAt(state,date){
 const definitions=state.events.filter(e=>e.schemaAfter?.columns||e.columnsAfter).map(e=>({...e,schemaBefore:e.schemaBefore||{columns:e.columnsBefore},schemaAfter:e.schemaAfter||{columns:e.columnsAfter}})).sort((a,b)=>a.at.localeCompare(b.at));
 const previous=definitions.filter(e=>e.at.slice(0,10)<=date).at(-1);
 return previous?.schemaAfter.columns||definitions.find(e=>e.at.slice(0,10)>date)?.schemaBefore?.columns||state.columns||defaultColumns();
}
export function saveDaily(state,{at=new Date().toISOString(),actor='Demo user',source='manual',date}={}){
 const savedAt=new Date(at).toISOString(),currentDay=utcDay(savedAt);
 if(!['manual','automatic'].includes(source))throw new Error('Choose a manual or automatic save.');
 date=date||(source==='automatic'?previousDay(currentDay):currentDay);checkDate(date);
 if(source==='manual'&&date!==currentDay)throw new Error('Only today can be manually saved. Earlier daily records are final.');
 if(source==='automatic'&&date!==previousDay(currentDay))throw new Error('Automatic fallback can save yesterday only.');
 const previous=(state.dailyRecords||[]).find(r=>r.date===date);
 if(previous&&source==='automatic')return structuredClone(state);
 const animals=source==='manual'?structuredClone(state.animals):asOf(state,date);
 if(animals===null)throw new Error('No recorded baseline exists for this day. A daily record cannot be invented.');
 const columns=structuredClone(source==='automatic'?columnsAt(state,date):(state.columns||defaultColumns()));
 const exportColumns=columns.map(c=>({...structuredClone(c),visible:true}));
 if(!exportColumns.some(c=>c.key==='id'))exportColumns.unshift({key:'id',label:'Animal ID',type:'text',custom:false,visible:true});
 const tables=dailyTables(animals,date),rows={},files={};
 for(const key of ['stock','births','deaths']){rows[key]=exportRows(tables[key],date,exportColumns);files[key]=csv(rows[key]);}
 const record={date,source,savedAt,actor,revision:(previous?.revision||0)+1,columns,exportColumns,animals:structuredClone(animals),tables,rows,csv:files,timezone:'UTC'};
 const next=structuredClone(state);next.dailyRecords=[...(next.dailyRecords||[]).filter(r=>r.date!==date),record].sort((a,b)=>a.date.localeCompare(b.date));
 next.events.push({id:crypto.randomUUID(),at:savedAt,actor,action:previous?'Daily record replaced':'Daily record saved',dailyDate:date,dailySource:source,dailyRevision:record.revision,dailyBefore:previous?structuredClone(previous):null,dailyAfter:structuredClone(record),animalId:'',before:null,after:null,snapshot:structuredClone(next.animals)});
 return next;
}
export function automaticDaily(state,at=new Date().toISOString()){
 const date=previousDay(utcDay(at));
 if(state.settings?.autoDaily===false||!validDate(state.automaticStarted)||date<state.automaticStarted||(state.dailyRecords||[]).some(r=>r.date===date)||asOf(state,date)===null)return structuredClone(state);
 return saveDaily(state,{at,actor:'Automatic demo save',source:'automatic',date});
}

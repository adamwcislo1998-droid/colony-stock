export const fieldTypes=[['text','Free text'],['textarea','Long text'],['number','Number'],['date','Date'],['select','Choices']];
export const configurable=c=>c.custom||['species','line','pob','notes'].includes(c.key);
export const choices=text=>[...new Set(String(text||'').split(/[\n,]/).map(x=>x.trim()).filter(Boolean))];
export const fieldValue=(a,c)=>c.custom?a.extra?.[c.key]??'':a[c.key]??'';
export function fieldErrors(value,c){
 const v=String(value??'').trim(),errors=[];
 if(!v){if(c.required)errors.push(c.label+' is required.');return errors;}
 if(c.type==='number'){
  if(!Number.isFinite(Number(v)))errors.push(c.label+' must be a number.');
  else {if(c.min!==''&&c.min!=null&&Number(v)<Number(c.min))errors.push(c.label+' must be at least '+c.min+'.');if(c.max!==''&&c.max!=null&&Number(v)>Number(c.max))errors.push(c.label+' must be at most '+c.max+'.');}
 }
 if(c.type==='date'){const d=new Date(v+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==v)errors.push(c.label+' must be a valid date.');}
 if(c.type==='select'&&!c.allowNew&&!c.options?.includes(v))errors.push('Choose a listed value for '+c.label+'.');
 return errors;
}
export function schemaErrors(columns,animals){
 const errors=[];
 if(!columns.some(c=>c.visible))errors.push('Keep at least one visible column.');
 if(columns.some(c=>!c.label.trim())||new Set(columns.map(c=>c.label.trim().toLowerCase())).size!==columns.length)errors.push('Use non-empty, unique headings.');
 for(const c of columns.filter(configurable)){
  if(!fieldTypes.some(([t])=>t===c.type))errors.push('Choose a valid type for '+c.label+'.');
  if(c.type==='select'&&!c.allowNew&&!c.options?.length)errors.push('Add at least one choice for '+c.label+'.');
  if(c.type==='number'&&((c.min!==''&&c.min!=null&&!Number.isFinite(Number(c.min)))||(c.max!==''&&c.max!=null&&!Number.isFinite(Number(c.max)))))errors.push('Use numeric limits for '+c.label+'.');
  if(c.type==='number'&&c.min!==''&&c.min!=null&&c.max!==''&&c.max!=null&&Number(c.min)>Number(c.max))errors.push(c.label+': minimum cannot exceed maximum.');
  if(c.defaultValue)errors.push(...fieldErrors(c.defaultValue,c).map(e=>'Default: '+e));
  const invalid=animals.filter(a=>fieldErrors(fieldValue(a,c),c).length);
  if(invalid.length)errors.push(c.label+': '+invalid.length+' existing record(s) do not meet these rules (e.g. '+invalid[0].id+'). Adjust the rules or update those values first.');
 }
 return errors;
}
export function saveColumns(state,columns,actor,at=new Date().toISOString()){
 const next=structuredClone(state);next.columns=structuredClone(columns);
 next.events.push({id:crypto.randomUUID(),at,actor,action:'Columns updated',animalId:'',before:null,after:null,columnsBefore:structuredClone(state.columns),columnsAfter:structuredClone(columns),snapshot:structuredClone(state.animals)});return next;
}

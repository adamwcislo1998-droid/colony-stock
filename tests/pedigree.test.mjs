import test from 'node:test';
import assert from 'node:assert/strict';
import {ancestorTree,familyTree} from '../dist/pedigree.mjs';
const records=Array.from({length:80},(_,i)=>({id:String(i),mother:i<79?String(i+1):'',father:i<78?String(i+2):'',sex:'Female',room:'Room A',cage:'A-01'}));
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.parents||[])]);
test('full ancestry reaches founders and shared ancestors do not multiply branches',()=>{
 const nodes=flatten(ancestorTree(records[0],records));
 assert.ok(nodes.some(n=>n.animal?.id==='79'));assert.equal(nodes.filter(n=>n.animal&&!n.repeated).length,79);assert.ok(nodes.length<=160);assert.ok(nodes.some(n=>n.repeated));
});
test('compact view stops at grandparents and shows further ancestry',()=>{
 const nodes=flatten(ancestorTree(records[0],records,2));assert.ok(nodes.some(n=>n.limited));assert.ok(nodes.every(n=>!n.parents?.some(p=>p.parents?.length)));
});
test('unknown parents and corrupt cyclic records terminate safely',()=>{
 const nodes=flatten(ancestorTree({id:'root',mother:'root',father:'missing'},[{id:'root',mother:'root'}]));assert.equal(nodes.length,2);assert.equal(nodes[0].repeated,true);assert.equal(nodes[1].animal,null);
});
test('full tree exposes navigation controls and remains escaped',()=>{
 const a={id:'<root>',mother:'',father:''};const html=familyTree(a,[a],s=>String(s).replaceAll('<','&lt;'),true);assert.ok(html.includes('All recorded ancestry'));assert.ok(html.includes('data-tree-fit'));assert.ok(html.includes('data-tree-expand'));assert.ok(!html.includes('<root>'));
});

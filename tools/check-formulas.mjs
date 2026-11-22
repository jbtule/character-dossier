// Quick check: evaluates a system spec against a character with Filtrex and prints derived values and dice pools.
// Usage: node tools/check-formulas.mjs systems/eote/system.json tests/fixtures/sample-character.json  (needs: npm i filtrex@3)
import { compileExpression, useDotAccessOperator } from "filtrex";
import fs from "fs";
const sys=JSON.parse(fs.readFileSync(process.argv[2]));const ch=JSON.parse(fs.readFileSync(process.argv[3]));
const opt=(extra={})=>({customProp:useDotAccessOperator,extraFunctions:extra});
const items=Object.fromEntries(Object.entries(ch.lists).map(([k,arr])=>{const f=sys.lists[k]?.itemFormulas||{};
 return [k,arr.map(it=>{const ctx={soak:0,worn:false,...it};const o={...ctx};for(const[n,e]of Object.entries(f))o[n]=compileExpression(e,opt())(ctx);return o})]}));
const sumOf=(l,f)=>items[l].reduce((a,x)=>a+(+x[f]||0),0);
const ctx={...ch.characteristics,species:sys.species[ch.species]};
for(const[k,d]of Object.entries(sys.derived)){ctx[k]=compileExpression(d.formula,opt({sumOf}))(ctx);console.log(k,ctx[k])}
for(const s of ["computers","deception","rangedHeavy","astrogation"]){const sk=sys.skills.find(x=>x.id===s);const c={characteristic:ch.characteristics[sk.characteristic],rank:ch.skills[s]||0};
 console.log(s,Object.fromEntries(Object.entries(sys.skillRoll).map(([d,e])=>[d,compileExpression(e,opt())(c)])))}

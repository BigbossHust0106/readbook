export type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
export const clean = <T>(value:T):T => JSON.parse(JSON.stringify(value));
function object(value:unknown):value is Record<string,Json>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function equal(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
 if(object(a)&&object(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}
 return false;
}
// Conflicting fields keep the local value until the user makes an explicit choice.
export function mergeDocuments(base:Json,local:Json,remote:Json):{value:Json;conflicts:string[]} {
 const conflicts:string[]=[];
 function merge(b:Json|undefined,l:Json|undefined,r:Json|undefined,path:string):Json|undefined {
  if(equal(l,b))return r;if(equal(r,b)||equal(l,r))return l;
  const translation=object(l)&&'provider' in l&&'text' in l;
  if(object(l)&&object(r)&&(object(b)||b===undefined)&&!translation){
   const out:Record<string,Json>={};for(const k of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])) {
    const v=merge(b?.[k],l[k],r[k],path?`${path}.${k}`:k);if(v!==undefined)out[k]=v;
   }return out;
  }
  conflicts.push(path||'document');return l;
 }
 return {value:merge(base,local,remote,'')??null,conflicts};
}

import {expect,it} from 'vitest';
import {mergeDocuments,equal} from '../src/merge';
it('merges different paragraph fields without losing either device edits',()=>{
 const base={overrides:{p:{note:'old',highlight:false},q:{note:'other'}}};
 const local={overrides:{p:{note:'mine',highlight:false},q:{note:'other'}}};
 const remote={overrides:{p:{note:'old',highlight:true},q:{note:'new'}}};
 expect(mergeDocuments(base,local,remote)).toEqual({value:{overrides:{p:{note:'mine',highlight:true},q:{note:'new'}}},conflicts:[]});
});
it('preserves both alternatives when the same field is changed',()=>{
 expect(mergeDocuments({meaning:'old'},{meaning:'mine'},{meaning:'theirs'})).toEqual({value:{meaning:'mine'},conflicts:['meaning']});
 expect(mergeDocuments({id:'word'},null,{id:'word',meaning:'edited'}).conflicts).toEqual(['document']);
});
it('does not mix translation text with another version provider or lock',()=>{
 const a={text:'A',provider:'manual',locked:false},b={...a,text:'B'},c={...a,locked:true};
 expect(mergeDocuments({en:a},{en:b},{en:c})).toEqual({value:{en:b},conflicts:['en']});
});
it('handles deletion, retry idempotence and object key order',()=>{
 expect(mergeDocuments({a:1,b:2},{b:2},{a:1,b:3})).toEqual({value:{b:3},conflicts:[]});
 expect(mergeDocuments(null,{id:'new'},{id:'new'})).toEqual({value:{id:'new'},conflicts:[]});
 expect(equal({a:1,b:[2]},{b:[2],a:1})).toBe(true);
 expect(mergeDocuments({id:'old'},{id:'old',note:'mine'},null).conflicts).toHaveLength(1);
});

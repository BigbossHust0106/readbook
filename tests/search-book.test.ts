import {it,expect} from 'vitest';
import {searchBook} from '../src/searchBook';
import type {Book} from '../src/model';
const book={chapters:[{title:'Một',paragraphs:[{text:'Tôi đọc sách mỗi ngày.',translations:{}},{text:'Không dấu vẫn tìm thấy.',translations:{en:{text:'Find the missing word.'}}}]},{title:'Hai',paragraphs:[{text:'中文阅读。',translations:{}}]}]} as Book;
it('finds Vietnamese without accents and returns offsets in original text',()=>{const result=searchBook(book,'doc sach');expect(result.matches[0]).toMatchObject({chapter:0,paragraph:0,offset:4,translated:false});expect(result.matches[0].snippet).toContain('đọc sách');});
it('searches translations and chapters not currently displayed, including Chinese',()=>{expect(searchBook(book,'missing').matches[0]).toMatchObject({paragraph:1,translated:true,offset:0});expect(searchBook(book,'阅读').matches[0]).toMatchObject({chapter:1,offset:2});});
it('allows progressively loading results rather than silently dropping later paragraphs',()=>{expect(searchBook(book,'',1).matches).toEqual([]);expect(searchBook(book,'a',1).more).toBe(true);expect(searchBook(book,'a',5).matches).toHaveLength(2);});

import type { Book, Paragraph } from './model';
export type Overrides = Record<string, Pick<Paragraph, 'note' | 'highlight' | 'translations'>>;
export type PersonalState = { book_id: string; position: Book['position']; shelf: Book['shelf']; overrides: Overrides; approved_children: string[]; position_updated_at?: string; last_opened_at?: string };
export function canonicalBook(book: Book): Book {
  return { id:book.id,title:book.title,author:book.author,language:book.language,genre:book.genre,hash:book.hash,createdAt:book.createdAt,
    originalName:book.originalName,originalType:book.originalType,position:{chapter:0,paragraph:0},shelf:'reading',approvedChildren:[],
    chapters:book.chapters.map(c=>({...c,paragraphs:c.paragraphs.map(p=>({id:p.id,text:p.text,translations:{}}))})) };
}
export function personalState(book: Book): Overrides {
  return Object.fromEntries(book.chapters.flatMap(c=>c.paragraphs.filter(p=>p.note || p.highlight || Object.keys(p.translations).length).map(p=>[p.id,{note:p.note,highlight:p.highlight,translations:p.translations}])));
}
export function applyPersonal(book: Book, state?: Partial<PersonalState>): Book {
  return { ...book,position:state?.position || {chapter:0,paragraph:0},shelf:state?.shelf || 'reading',approvedChildren:state?.approved_children || [],
    chapters:book.chapters.map(c=>({...c,paragraphs:c.paragraphs.map(p=>({...p,...state?.overrides?.[p.id],id:p.id,text:p.text}))})) };
}

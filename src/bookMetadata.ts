export function splitBookName(value:string):{title:string;author:string}{
 const name=value.trim(),separators=[...name.matchAll(/\s+-\s+/g)],last=separators.at(-1);
 if(!last)return {title:name,author:''};
 const title=name.slice(0,last.index).trim(),author=name.slice(last.index!+last[0].length).trim();
 return title&&author?{title,author}:{title:name,author:''};
}
export function bookFileMetadata(name:string){return splitBookName(name.replace(/\.(pdf|epub|txt|docx|html|htm)$/i,''));}

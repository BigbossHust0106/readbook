import {useEffect,useRef,useState} from 'react';
import {MessageCircle,Star,RefreshCw,Send} from 'lucide-react';
import {Modal} from './Modal';
import {rpc,type GroupDiscussion as Discussion,type GroupComment} from './groups';
import type {Book} from './model';
export function GroupDiscussion({gid,book,uid,ownerId,onClose,onRated}:{gid:string;book:Book;uid:string;ownerId:string;onClose:()=>void;onRated:()=>void}){
 const [data,setData]=useState<Discussion|null>(null),[draft,setDraft]=useState(''),[editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[status,setStatus]=useState('');
 const sequence=useRef(0),mounted=useRef(true),older=useRef(false),writing=useRef(false),attempt=useRef<{body:string;id:string}|null>(null),snapshot=useRef<Discussion|null>(null);
 async function load(append=false){
  const serial=++sequence.current;setLoading(true);const rows=snapshot.current?.comments||[],last=rows.at(-1);
  try{
   const result=await rpc<Discussion>('group_book_discussion',{gid,bid:book.id,...(append&&last?{before_created_at:last.created_at,before_comment_id:last.id}:{})});
   if(!mounted.current||serial!==sequence.current)return;
   const next={...result,comments:append?[...rows,...result.comments.filter(c=>!rows.some(old=>old.id===c.id))]:result.comments};
   older.current=append;snapshot.current=next;setData(next);setError('');
  }catch(e){if(mounted.current&&serial===sequence.current)setError((e as Error).message||'Chưa tải được thảo luận. Hãy thử lại.');}
  finally{if(mounted.current&&serial===sequence.current)setLoading(false);}
 }
 useEffect(()=>{
  mounted.current=true;void load();
  const timer=setInterval(()=>{if(!older.current&&!writing.current&&!document.hidden&&navigator.onLine)void load();},10000);
  return()=>{mounted.current=false;sequence.current++;clearInterval(timer);};
 },[]);
 async function mutate(action:()=>Promise<unknown>,done:()=>void,message:string){
  if(writing.current)return;writing.current=true;setBusy(true);setError('');setStatus('');
  // Invalidate an older poll so it cannot paint pre-write data over the result.
  sequence.current++;setLoading(false);
  try{await action();if(!mounted.current)return;done();setStatus(message);await load();}
  catch(e){if(mounted.current)setError((e as Error).message||'Chưa lưu được. Nội dung đã nhập vẫn được giữ.');}
  finally{writing.current=false;if(mounted.current)setBusy(false);}
 }
 function send(){
  const body=draft.trim();if(!body)return;
  if(!attempt.current||attempt.current.body!==body)attempt.current={body,id:crypto.randomUUID()};
  const commentId=editing||attempt.current.id;
  void mutate(()=>rpc('save_group_book_comment',{gid,bid:book.id,comment_id:commentId,comment_body:body}),()=>{setDraft('');setEditing(null);attempt.current=null;},editing?'Đã cập nhật bình luận.':'Đã gửi cảm nghĩ tới nhóm.');
 }
 function edit(comment:GroupComment){setEditing(comment.id);setDraft(comment.body);setStatus('');setError('');}
 return <Modal title={`${book.title} · Thảo luận & đánh giá`} onClose={onClose}>
  <div className="group-discussion">
   <section className="book-rating" aria-label="Đánh giá sách trong nhóm">
    <div><span className="rating-number">{data?.average_rating!=null?Number(data.average_rating).toFixed(1):'—'}</span><span> / 5 <Star size={18} fill="currentColor"/></span><p>{data?.rating_count||0} lượt đánh giá trong nhóm</p></div>
    <div><strong>Đánh giá của bạn</strong><div className="rating-stars" role="radiogroup" aria-label="Đánh giá của bạn">{[1,2,3,4,5].map(score=><button role="radio" aria-checked={data?.my_rating===score} aria-label={`${score} sao`} title={`${score} sao`} key={score} disabled={busy||loading||!data} onClick={()=>void mutate(()=>rpc('rate_group_book',{gid,bid:book.id,rating_score:score}),onRated,'Đã lưu đánh giá của bạn.')}><Star fill={score<=(data?.my_rating||0)?'currentColor':'none'}/></button>)}</div>{!!data?.my_rating&&<button className="rating-remove" disabled={busy||loading} onClick={()=>void mutate(()=>rpc('rate_group_book',{gid,bid:book.id,rating_score:null}),onRated,'Đã bỏ đánh giá của bạn.')}>Bỏ đánh giá</button>}</div>
   </section>
   <form className="comment-compose" onSubmit={e=>{e.preventDefault();send();}}>
    <label>{editing?'Chỉnh sửa bình luận':'Chia sẻ cảm nghĩ của bạn'}<textarea aria-label="Cảm nghĩ về cuốn sách" rows={3} maxLength={2000} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} placeholder="Điều gì trong cuốn sách khiến bạn ấn tượng?"/></label>
    <div className="row"><small>{draft.length}/2.000</small><button className="primary" disabled={busy||!draft.trim()||!data}><Send size={16}/>{editing?'Lưu bình luận':'Gửi bình luận'}</button>{editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setDraft('');attempt.current=null;}}>Hủy sửa</button>}</div>
   </form>
   {error&&<p role="alert" className="notice">{error}</p>}{status&&<p role="status">{status}</p>}
   <div className="discussion-heading"><h3><MessageCircle size={19}/> Cảm nghĩ của nhóm</h3><button aria-label="Làm mới thảo luận" disabled={busy||loading} onClick={()=>void load()}><RefreshCw size={16}/> Làm mới</button></div>
   {loading&&<p role="status">Đang tải bình luận…</p>}
   {data&&!data.comments.length&&<p className="comment-empty">Chưa có cảm nghĩ nào. Hãy mở đầu cuộc trò chuyện về cuốn sách này.</p>}
   <div className="comment-list">{data?.comments.map(comment=><article className="group-comment" key={comment.id}>
    <header><span className="comment-avatar" aria-hidden="true">{comment.nickname.slice(0,1).toLocaleUpperCase()}</span><div><strong>{comment.nickname}{comment.author_id===uid?' · Bạn':''}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'})}{comment.updated_at!==comment.created_at?' · đã chỉnh sửa':''}</time></div></header>
    <p>{comment.body}</p><div className="comment-actions">{comment.author_id===uid&&<button disabled={busy} onClick={()=>edit(comment)}>Sửa</button>}{(comment.author_id===uid||ownerId===uid)&&<button className="danger" disabled={busy} onClick={()=>{if(confirm('Xóa bình luận này khỏi nhóm?'))void mutate(()=>rpc('delete_group_book_comment',{gid,bid:book.id,comment_id:comment.id}),()=>{if(editing===comment.id){setEditing(null);setDraft('');}onRated();},'Đã xóa bình luận.');}}>Xóa</button>}</div>
   </article>)}</div>
   {data?.has_more&&<button className="comment-load-more" disabled={busy||loading} onClick={()=>void load(true)}>Xem bình luận cũ hơn</button>}
  </div>
 </Modal>;
}

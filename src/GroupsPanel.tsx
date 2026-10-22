import {Star,MessageCircle} from 'lucide-react';
import {GroupDiscussion} from './GroupDiscussion';
import { useEffect, useState } from 'react';
import * as store from './store';
import { listGroups, rpc, type ReadingGroup, type GroupProgress, type GroupBookRating } from './groups';
import type { Book } from './model';
import {CloudBookPicker} from './CloudBookPicker';
export function GroupsPanel({refreshVersion,cloud,books,onLogin,onRead,onUpload,onRefresh,notify}:{refreshVersion:number;cloud:boolean;books:Book[];onLogin:()=>void;onRead:(id:string)=>void;onUpload:(gid:string)=>void;onRefresh:()=>Promise<void>;notify:(text:string)=>void}) {
  const [groups,setGroups]=useState<ReadingGroup[]>([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[nickname,setNickname]=useState('Người đọc'),[code,setCode]=useState(()=>new URLSearchParams(location.search).get('join')||''),[invite,setInvite]=useState(''),[uid,setUid]=useState(''),[busy,setBusy]=useState(false),[activeBook,setActiveBook]=useState(''),[progress,setProgress]=useState<GroupProgress[]>([]);
  const group=groups.find(g=>g.id===selected);
  const [picker,setPicker]=useState(false),[discussion,setDiscussion]=useState('');
  const [ratings,setRatings]=useState<GroupBookRating[]>([]),[ratingError,setRatingError]=useState(''),[ratingsVersion,setRatingsVersion]=useState(0);
  const discussionBook=group?.bookIds.includes(discussion)?books.find(b=>b.id===discussion):undefined;
  useEffect(()=>{
    let valid=true;setRatings([]);setRatingError('');
    if(!cloud||!selected)return;
    const load=async()=>{try{const rows=await rpc<GroupBookRating[]>('reading_group_book_ratings',{gid:selected});if(valid){setRatings(rows);setRatingError('');}}catch(e){if(valid)setRatingError((e as Error).message||'Chưa tải được đánh giá.');}};
    void load();const timer=setInterval(()=>{if(!document.hidden&&navigator.onLine)void load();},15000);return()=>{valid=false;clearInterval(timer);};
  },[cloud,selected,ratingsVersion,group?.bookIds.join(',')]);
  async function refresh(){ const list=await listGroups();setGroups(list);setSelected(id=>list.some(g=>g.id===id)?id:list[0]?.id||''); }
  async function act(fn:()=>Promise<void>) {setBusy(true);try{await fn();}catch(e){notify((e as Error).message || 'Chưa thực hiện được thao tác nhóm.');}finally{setBusy(false);} }
  useEffect(()=>{if(!cloud)return;void act(async()=>{setUid(await store.userId());await refresh();});const timer=setInterval(()=>void refresh().catch(()=>{}),15000);return()=>clearInterval(timer);},[cloud]);
  useEffect(()=>{if(cloud)void refresh().catch(()=>{});},[refreshVersion]);
  useEffect(()=>{
    let valid=true;
    const load=async()=>{if(!selected||!activeBook||!group?.bookIds.includes(activeBook)){setProgress([]);return;}const rows=await rpc<GroupProgress[]>('reading_group_progress',{gid:selected,bid:activeBook});if(valid)setProgress(rows);};
    void load().catch(e=>notify(e.message));const timer=setInterval(()=>void load().catch(()=>{}),10000);return()=>{valid=false;clearInterval(timer);};
  },[selected,activeBook,groups.map(g=>g.bookIds.join(',')).join(';')]);
  return <><div className="page-heading"><div><p className="eyebrow">ĐỌC CÙNG NHAU</p><h1>Nhóm đọc & cloud.</h1><p>Một bản sách dùng chung; vị trí, ghi chú và từ vựng riêng theo tài khoản.</p></div></div>
    {!cloud ? <section className="panel"><p>Đăng nhập để tạo nhóm, tham gia và đọc đồng bộ trên mọi thiết bị.</p><button className="primary" onClick={onLogin}>Đăng nhập cloud</button></section> : <>
      <section className="panel group-forms"><label>Tên hiển thị trong nhóm<input maxLength={60} value={nickname} onChange={e=>setNickname(e.target.value)} /></label>
        <div className="form-grid"><form onSubmit={e=>{e.preventDefault();void act(async()=>{const gid=await rpc<string>('create_reading_group',{group_name:name,display_name:nickname});await refresh();setSelected(gid);setName('');notify('Đã tạo nhóm đọc.');});}}><label>Tên nhóm mới<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label><button disabled={busy||!nickname.trim()} className="primary">Tạo nhóm</button></form>
        <form onSubmit={e=>{e.preventDefault();void act(async()=>{const gid=await rpc<string>('join_reading_group',{invite_code:code.trim(),display_name:nickname});await refresh();setSelected(gid);await onRefresh();notify('Đã tham gia nhóm và tải thư viện chung.');});}}><label>Mã mời nhóm<input required value={code} onChange={e=>setCode(e.target.value)} /></label><button disabled={busy||!nickname.trim()}>Tham gia nhóm</button></form></div>
      </section>
      <section className="panel"><label>Nhóm đang xem<select value={selected} onChange={e=>{setSelected(e.target.value);setInvite('');setActiveBook('');setDiscussion('');}}><option value="">Chọn nhóm</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
      {group && <><div className="row"><button className="primary" disabled={busy} onClick={()=>onUpload(group.id)}>Thêm sách vào nhóm</button><button disabled={busy} onClick={()=>setPicker(true)}>Chọn sách từ cloud của tôi</button><button disabled={busy} onClick={()=>void act(async()=>{await onRefresh();await refresh();})}>Đồng bộ ngay</button>
        {group.owner_id===uid ? <><button disabled={busy} onClick={()=>void act(async()=>setInvite(await rpc<string>('create_reading_invite',{gid:group.id})))}>Tạo mã mời 7 ngày</button><button onClick={()=>{if(confirm('Xóa nhóm? Sách riêng của người tải lên vẫn được giữ.'))void act(async()=>{await rpc('delete_reading_group',{gid:group.id});await refresh();await onRefresh();});}}>Xóa nhóm</button></> : <button onClick={()=>{if(confirm('Rời nhóm này?'))void act(async()=>{await rpc('leave_reading_group',{gid:group.id});await refresh();await onRefresh();});}}>Rời nhóm</button>}
      </div>{invite && <div className="notice"><p>Mã mời: <code>{invite}</code></p><div className="row"><button onClick={()=>void navigator.clipboard.writeText(`${location.origin}/?join=${invite}`).then(()=>notify('Đã sao chép liên kết mời.')).catch(()=>notify('Hãy sao chép mã mời thủ công.'))}>Sao chép liên kết mời</button><button onClick={()=>void act(async()=>{await rpc('revoke_reading_invite',{invite_code:invite});setInvite('');notify('Đã thu hồi mã mời.');})}>Thu hồi mã mời</button></div></div>}
      <div className="group-members">{group.members.map(m=><span className="pill" key={m.user_id}>{m.nickname}{m.user_id===uid?' · Bạn':''}{group.owner_id===uid&&m.user_id!==uid&&<button aria-label={`Xóa thành viên ${m.nickname}`} onClick={()=>{if(confirm('Xóa thành viên khỏi nhóm?'))void act(async()=>{await rpc('remove_reading_member',{gid:group.id,member_id:m.user_id});await refresh();});}}>×</button>}</span>)}</div>
      {ratingError&&<p role="alert" className="notice">{ratingError}</p>}<div className="group-book-list">{group.bookIds.map(id=>{const book=books.find(b=>b.id===id),rating=ratings.find(r=>r.book_id===id);return book?<article key={id}><strong>{book.title}</strong><div className="group-book-rating"><Star size={15} fill={rating?.rating_count?"currentColor":"none"}/>{rating?.rating_count?`${Number(rating.average_rating).toFixed(1)}/5 · ${rating.rating_count} lượt đánh giá`:"Chưa có đánh giá"}</div><div className="row"><button onClick={()=>setDiscussion(id)}><MessageCircle size={16}/> Thảo luận & đánh giá</button><button onClick={()=>onRead(id)}>Đọc sách</button><button onClick={()=>setActiveBook(id)}>Xem tag tiến độ</button>{(group.owner_id===uid||store.canEditBook(id))&&<button onClick={()=>{if(confirm('Bỏ sách này khỏi nhóm? Bản riêng không bị xóa.'))void act(async()=>{await rpc('remove_group_book',{gid:group.id,bid:id});await refresh();await onRefresh();});}}>Bỏ khỏi nhóm</button>}</div>{activeBook===id&&<div className="progress-tags">{progress.map(p=><span className="pill" key={p.user_id}>{p.nickname}: {p.updated_at ? `${book.chapters[p.position.chapter]?.title || 'Nội dung'}, đoạn ${Number(p.position.paragraph)+1}` : 'Chưa bắt đầu'}</span>)}</div>}</article>:null;})}{!group.bookIds.length&&<p>Nhóm chưa có sách. Thêm tệp một lần để các thành viên cùng đọc.</p>}</div>
      {discussionBook&&<GroupDiscussion key={`${group.id}:${discussionBook.id}`} gid={group.id} book={discussionBook} uid={uid} ownerId={group.owner_id} onClose={()=>setDiscussion('')} onRated={()=>setRatingsVersion(v=>v+1)}/>}
      {picker&&<CloudBookPicker group={group} books={books} onClose={()=>setPicker(false)} notify={notify} onRefresh={async()=>{await onRefresh();await refresh();}}/>}
      </>}{!groups.length&&<p>Tạo nhóm mới hoặc nhập mã mời từ chủ nhóm.</p>}</section>
    </>}
  </>;
}

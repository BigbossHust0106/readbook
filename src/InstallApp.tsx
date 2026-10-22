import {useEffect,useRef,useState} from 'react';
import {Download,Smartphone,CheckCircle2} from 'lucide-react';

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;

export function useAppInstall(){
  const pending=useRef<InstallPrompt|null>(null),running=useRef(false);
  const [available,setAvailable]=useState(false),[installed,setInstalled]=useState(standalone),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const media=window.matchMedia('(display-mode: standalone)');
    const update=()=>setInstalled(standalone());
    const ready=(event:Event)=>{event.preventDefault();pending.current=event as InstallPrompt;setAvailable(true);setMessage('');};
    const done=()=>{pending.current=null;setAvailable(false);setInstalled(true);setMessage('');};
    window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);media.addEventListener('change',update);
    return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);media.removeEventListener('change',update);};
  },[]);
  async function install(){
    const event=pending.current;if(!event||running.current)return;
    running.current=true;pending.current=null;setAvailable(false);setBusy(true);setMessage('');
    try{
      await event.prompt();const choice=await event.userChoice;
      setMessage(choice.outcome==='accepted'?'Đã xác nhận yêu cầu cài. Hãy hoàn tất hộp thoại của trình duyệt rồi mở Lá sách từ màn hình chính.':'Bạn đã đóng hộp thoại cài. Bạn vẫn có thể cài từ menu của trình duyệt theo hướng dẫn bên dưới.');
    }catch{setMessage('Chưa mở được hộp thoại cài. Hãy dùng menu trình duyệt theo hướng dẫn bên dưới.');}
    finally{running.current=false;setBusy(false);}
  }
  return {available,installed,busy,message,install};
}

export function InstallAppContent({state}:{state:ReturnType<typeof useAppInstall>}){
  const ua=navigator.userAgent;
  const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  const inApp=/FBAN|FBAV|Instagram|Zalo|Line\//i.test(ua);
  return <div className="install-app">
    <div className="install-app-intro"><img src="/icons/app-192.png" alt="" width={56} height={56}/><p>Đưa <strong>Lá sách</strong> lên màn hình chính để mở nhanh như một ứng dụng.</p></div>
    {state.installed?<p role="status" className="install-app-status"><CheckCircle2 size={20}/> Lá sách đã được cài hoặc đang mở ở chế độ ứng dụng trên thiết bị này.</p>:<>
      {state.available||state.busy?<button className="primary" disabled={state.busy} onClick={()=>void state.install()}><Download size={18}/>{state.busy?'Đang mở hộp thoại cài…':'Cài Lá sách'}</button>:<p className="muted">Nếu chưa thấy hộp thoại cài tự động, hãy làm theo hướng dẫn bên dưới. Nếu đã cài, bạn có thể mở từ biểu tượng Lá sách trên màn hình chính.</p>}
      {state.message&&<p role="status">{state.message}</p>}
      {inApp&&<p className="notice">Bạn đang dùng trình duyệt trong ứng dụng. Hãy mở trang này bằng {ios?'Safari':'Chrome'} rồi thực hiện các bước cài.</p>}
      <div className="install-instructions">
        {(ios||!android)&&<section><h3><Smartphone size={18}/> iPhone / iPad · Safari</h3><ol><li>Mở website này trong <strong>Safari</strong>.</li><li>Bấm <strong>Chia sẻ</strong> (hình vuông có mũi tên hướng lên).</li><li>Chọn <strong>Thêm vào MH chính</strong> (Add to Home Screen). Bật <strong>Mở dưới dạng ứng dụng web</strong> nếu có.</li><li>Bấm <strong>Thêm</strong>, rồi mở biểu tượng Lá sách trên màn hình chính.</li></ol></section>}
        {!ios&&<section><h3><Smartphone size={18}/> {android?'Android · Chrome':'Android / máy tính · Chrome hoặc Edge'}</h3><ol><li>Mở website này bằng <strong>Chrome</strong> hoặc <strong>Edge</strong>.</li><li>Mở menu <strong>⋮</strong> hoặc <strong>…</strong> của trình duyệt.</li><li>Chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>, rồi xác nhận cài.</li></ol></section>}
      </div>
    </>}
    <p className="muted">Sách đã lưu trên thiết bị có thể đọc ngoại tuyến. Đăng nhập và đồng bộ cloud nếu muốn đọc tiếp trên thiết bị khác; dịch và giọng đọc Google cần Internet.</p>
  </div>;
}

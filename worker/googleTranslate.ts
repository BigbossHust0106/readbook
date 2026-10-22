import {utf8Chunks} from './mymemory';
const codes:Record<string,string>={vi:'vi',en:'en',zh:'zh-CN'};
export async function googleTranslate(request:Request){
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 try{
  const raw=await request.text();if(raw.length>24000)return reply({error:'Yêu cầu quá lớn.'},413);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'Yêu cầu dịch không hợp lệ.'},400);}
  const {text,source,target}=body||{};
  if(typeof text!=='string'||!text.trim()||text.length>4000||!Object.hasOwn(codes,source)||!Object.hasOwn(codes,target)||source===target)return reply({error:'Văn bản tối đa 4.000 ký tự; chọn hai ngôn ngữ khác nhau trong vi, zh, en.'},400);
  const parts:string[]=[],deadline=AbortSignal.timeout(45000);
  for(const chunk of utf8Chunks(text,1000)){
   if(!chunk.trim()){parts.push(chunk);continue;}
   const url=new URL('https://translate.googleapis.com/translate_a/single');
   url.search=new URLSearchParams({client:'gtx',sl:codes[source],tl:codes[target],dt:'t',q:chunk}).toString();
   const response=await fetch(url,{redirect:'manual',signal:AbortSignal.any([request.signal,deadline,AbortSignal.timeout(12000)]),headers:{Accept:'application/json'}});
   if(!response.ok){await response.body?.cancel();return reply({error:response.status===429?'Google đang giới hạn lượt dịch. Hãy thử lại sau; nghĩa đã nhập vẫn được giữ.':'Google Dịch tạm thời không trả kết quả. Hãy thử lại; bản dịch đã lưu vẫn được giữ.',code:response.status===429?'GOOGLE_RATE_LIMIT':'GOOGLE_UNAVAILABLE'},response.status===429?429:502);}
   const data=await response.json() as unknown;
   if(!Array.isArray(data)||!Array.isArray(data[0]))throw new Error('Invalid translation');
   const translated=data[0].filter((row:unknown)=>Array.isArray(row)&&typeof row[0]==='string').map((row:string[])=>row[0]).join('');
   if(!translated.trim())throw new Error('Empty translation');parts.push(translated);
  }
  return reply({text:parts.join(target==='zh'?'':' '),provider:'Google Translate',at:new Date().toISOString()});
 }catch{return reply({error:'Không kết nối được Google Dịch. Kiểm tra mạng rồi bấm Dịch bằng Google để thử lại; nghĩa bạn nhập vẫn được giữ.',code:'GOOGLE_CONNECTION'},502);}
}

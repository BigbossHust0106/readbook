/** Official DeepL API. Credentials never enter browser responses or URLs. */
type DeepLEnv = { DEEPL_API_KEY?: string };
type Pair = {source:string;targets:string[]};
type Language = {lang:string;usable_as_source:boolean;usable_as_target:boolean};
const languages=['vi','zh','en'];
const sourceCodes:Record<string,string>={vi:'VI',zh:'ZH',en:'EN'};
const targetCandidates:Record<string,string[]>={vi:['VI'],zh:['ZH-HANS','ZH'],en:['EN-US','EN']};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
class DeepLError extends Error {constructor(message:string,readonly code:string,readonly status=503){super(message);}}
function config(env:DeepLEnv){
 const key=env.DEEPL_API_KEY?.trim();
 if(!key)throw new DeepLError('Chưa cấu hình DeepL. Thêm Secret DEEPL_API_KEY trong Cloudflare Worker readbook, rồi lưu và triển khai.','DEEPL_NOT_CONFIGURED');
 return {key,base:key.endsWith(':fx')?'https://api-free.deepl.com':'https://api.deepl.com'};
}
function upstreamError(status:number):never {
 if(status===401||status===403)throw new DeepLError('DeepL từ chối khóa API. Kiểm tra Secret DEEPL_API_KEY: cần khóa DeepL API Free hoặc API Pro, không phải gói dịch trên website.','DEEPL_AUTH');
 if(status===456)throw new DeepLError('Tài khoản DeepL đã chạm hạn mức ký tự hoặc giới hạn chi phí. Kiểm tra Usage trong tài khoản DeepL.','DEEPL_QUOTA',429);
 if(status===429)throw new DeepLError('DeepL đang nhận quá nhiều yêu cầu. Chờ một lát rồi bấm Thử dịch lại.','DEEPL_RATE_LIMIT',429);
 if(status===400||status===422)throw new DeepLError('DeepL không hỗ trợ yêu cầu hoặc cặp ngôn ngữ này. Kiểm tra ngôn ngữ sách và ngôn ngữ đích.','DEEPL_LANGUAGE',422);
 throw new DeepLError('DeepL tạm thời không sẵn sàng. Hãy thử dịch lại.','DEEPL_UNAVAILABLE',502);
}
function failure(error:unknown){
 return error instanceof DeepLError?json({error:error.message,code:error.code},error.status):json({error:'Không kết nối được DeepL hoặc phản hồi không hợp lệ. Kiểm tra mạng rồi thử dịch lại; nghĩa đã nhập vẫn được giữ.',code:'DEEPL_CONNECTION'},502);
}
// Cache only verified language metadata, never errors, credentials in responses, or selected text.
let cached:{key:string;expires:number;value:{pairs:Pair[];targets:Record<string,string>}}|undefined;
async function supported(env:DeepLEnv,signal?:AbortSignal){
 const {base,key}=config(env);
 if(cached?.key===key&&cached.expires>Date.now())return cached.value;
 const r=await fetch(`${base}/v3/languages?resource=translate_text`,{headers:{Authorization:`DeepL-Auth-Key ${key}`},redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
 if(!r.ok)upstreamError(r.status);
 const data:unknown=await r.json();
 if(!Array.isArray(data)||!data.length||!data.every(l=>l&&typeof l.lang==='string'&&typeof l.usable_as_source==='boolean'&&typeof l.usable_as_target==='boolean'))throw new Error('Invalid languages');
 const rows=data as Language[];
 const sources=new Set(rows.filter(l=>l.usable_as_source).map(l=>l.lang.toUpperCase()));
 const targets:Record<string,string>={};
 for(const lang of languages){const code=targetCandidates[lang].find(code=>rows.some(l=>l.usable_as_target&&l.lang.toUpperCase()===code));if(code)targets[lang]=code;}
 const pairs=languages.filter(lang=>sources.has(sourceCodes[lang])).map(source=>({source,targets:languages.filter(target=>target!==source&&targets[target])})).filter(pair=>pair.targets.length);
 const value={pairs,targets};cached={key,expires:Date.now()+5*60000,value};return value;
}
export async function deepLCapabilities(env:DeepLEnv){
 try{return json({configured:true,provider:'DeepL',pairs:(await supported(env)).pairs,reason:'DeepL API chính thức · dịch ngay trong trình đọc. Hạn mức ký tự và chi phí theo tài khoản DeepL của bạn.'});}
 catch(error){const response=failure(error);const data=await response.json() as {error:string;code:string};return json({configured:false,provider:'DeepL',pairs:[],reason:data.error,code:data.code});}
}
export async function deepLTranslate(request:Request,env:DeepLEnv){
 try{
  config(env);
  if(Number(request.headers.get('Content-Length')||0)>24000)return json({error:'Yêu cầu quá lớn.'},413);
  const raw=await request.text();if(raw.length>24000)return json({error:'Yêu cầu quá lớn.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Dữ liệu dịch không hợp lệ.'},400);}
  const {text,source,target}=body||{};
  if(typeof text!=='string'||!text.trim()||text.length>4000||!languages.includes(source)||!languages.includes(target)||source===target)return json({error:'Văn bản tối đa 4.000 ký tự; chọn hai ngôn ngữ khác nhau trong vi, zh, en.'},400);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(40000)]);
  const model=await supported(env,signal);
  if(!model.pairs.some(pair=>pair.source===source&&pair.targets.includes(target)))return json({error:'DeepL chưa hỗ trợ cặp ngôn ngữ này cho tài khoản của bạn.',code:'DEEPL_LANGUAGE'},422);
  const {base,key}=config(env);
  const r=await fetch(`${base}/v2/translate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`DeepL-Auth-Key ${key}`},body:JSON.stringify({text:[text],source_lang:sourceCodes[source],target_lang:model.targets[target],model_type:'quality_optimized'}),redirect:'manual',signal});
  if(!r.ok)upstreamError(r.status);
  const data=await r.json() as {translations?:{text?:string}[]};
  if(data.translations?.length!==1||typeof data.translations[0].text!=='string'||!data.translations[0].text.trim())throw new Error('Invalid translation');
  return json({text:data.translations[0].text,provider:'DeepL',at:new Date().toISOString()});
 }catch(error){return failure(error);}
}

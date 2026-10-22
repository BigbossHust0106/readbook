export const readerFonts=[
 {id:'noto',label:'Noto Sans · rõ nét',family:'"Noto Sans", sans-serif'},
 {id:'noto-serif',label:'Noto Serif · sách in',family:'"Noto Serif", "Noto Sans", serif'},
 {id:'lora',label:'Lora · mềm mại',family:'"Lora", "Noto Sans", serif'},
 {id:'be-vietnam',label:'Be Vietnam Pro · hiện đại',family:'"Be Vietnam Pro", "Noto Sans", sans-serif'},
 {id:'serif',label:'Georgia · cổ điển',family:'Georgia, "Times New Roman", "Noto Sans", serif'},
 {id:'system',label:'Phông hệ thống',family:'system-ui, "Noto Sans", sans-serif'},
];
export const readerThemes=[
 {id:'light',label:'Trắng dịu',paper:'#fffdf8',ink:'#2d4434'},
 {id:'sepia',label:'Giấy vàng',paper:'#f2e9d4',ink:'#5a4c35'},
 {id:'cream',label:'Kem ấm',paper:'#faf1df',ink:'#52442f'},
 {id:'sage',label:'Xanh lá nhạt',paper:'#eaf1e5',ink:'#344a37'},
 {id:'mist',label:'Xanh lam nhạt',paper:'#e8f0f5',ink:'#344858'},
 {id:'rose',label:'Hồng nhạt',paper:'#f6e9e6',ink:'#654945'},
 {id:'dark',label:'Tối',paper:'#202b25',ink:'#e3e6da'},
 {id:'midnight',label:'Xanh đêm',paper:'#15212c',ink:'#d4e0eb'},
];
export const readerFontFamilies=Object.fromEntries(readerFonts.map(font=>[font.id,font.family]));
// Load the actual Vietnamese and Latin subsets before measuring a new layout.
export async function loadReaderFont(family:string,size:number){
 await document.fonts.load(`${size}px ${family}`,'Tiếng Việt: Những trang sách mở ra một thế giới. Aa 0123');
}

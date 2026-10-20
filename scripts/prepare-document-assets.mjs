import { copyFile, cp, mkdir, readdir } from 'node:fs/promises';
// Self-host the runtime and language models: documents never leave the browser for OCR.
await mkdir('public/ocr/core', { recursive: true });
await mkdir('public/pdf', { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (file.includes('lstm') && /\.(js|wasm)$/.test(file))
    await copyFile(`node_modules/tesseract.js-core/${file}`, `public/ocr/core/${file}`);
}
for (const lang of ['eng', 'vie', 'chi_sim'])
  await copyFile(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `public/ocr/${lang}.traineddata.gz`);
for (const folder of ['cmaps', 'standard_fonts', 'wasm'])
  await cp(`node_modules/pdfjs-dist/${folder}`, `public/pdf/${folder}`, { recursive: true });
await copyFile('node_modules/pdfjs-dist/LICENSE', 'public/pdf/LICENSE');
await copyFile('node_modules/tesseract.js-core/LICENSE', 'public/ocr/LICENSE-core');

await copyFile('node_modules/tesseract.js/LICENSE.md', 'public/ocr/LICENSE-tesseract.md');
await copyFile('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt', 'public/ocr/worker.min.js.LICENSE.txt');

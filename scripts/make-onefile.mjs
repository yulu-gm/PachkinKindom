import{readdir,readFile,rm,mkdir,writeFile}from'node:fs/promises';
import{extname,join,resolve}from'node:path';
import{fileURLToPath}from'node:url';

const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const distDir=join(projectRoot,'dist');
const spriteDir=join(distDir,'assets','sprites');
const outputDir=join(projectRoot,'dist-onefile');
const outputFile=join(outputDir,'PachinkoKingdom.html');

const mimeType=file=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml'}[extname(file).toLowerCase()]??'application/octet-stream');
const dataUrl=async file=>`data:${mimeType(file)};base64,${(await readFile(file)).toString('base64')}`;
const escapeScript=value=>value.replaceAll('</script','<\\/script');
const escapeStyle=value=>value.replaceAll('</style','<\\/style');

let html=await readFile(join(distDir,'index.html'),'utf8');
const assetMap={};
for(const name of await readdir(spriteDir)){
  if(!['.png','.jpg','.jpeg','.gif','.webp','.svg'].includes(extname(name).toLowerCase()))continue;
  assetMap[`assets/sprites/${name}`]=await dataUrl(join(spriteDir,name));
}

const cssLinks=[...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/g)];
for(const match of cssLinks){
  const css=await readFile(join(distDir,match[1].replace(/^\.?\//,'')),'utf8');
  html=html.replace(match[0],()=>`<style>${escapeStyle(css)}</style>`);
}

const moduleScripts=[...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/g)];
if(moduleScripts.length!==1)throw new Error(`Expected one module script, found ${moduleScripts.length}`);
for(const match of moduleScripts){
  const js=await readFile(join(distDir,match[1].replace(/^\.?\//,'')),'utf8');
  const inlineAssets=`window.__PK_INLINE_ASSETS__=Object.freeze(${JSON.stringify(assetMap)});`;
  html=html.replace(match[0],()=>`<script>${escapeScript(inlineAssets)}</script><script type="module">${escapeScript(js)}</script>`);
}

html=html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g,'');
if(/<(?:script|link)\b[^>]*(?:src|href)=["'](?!data:)[^"']+["']/i.test(html))throw new Error('Generated HTML still contains an external script or stylesheet');
if(!html.includes('data:image/png;base64,'))throw new Error('Generated HTML does not contain embedded sprites');

if(resolve(outputDir)!==resolve(projectRoot,'dist-onefile'))throw new Error('Refusing to clear an unexpected output directory');
await rm(outputDir,{recursive:true,force:true});
await mkdir(outputDir,{recursive:true});
await writeFile(outputFile,html);
console.log(`OneFile HTML: ${outputFile} (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB)`);

import http from'node:http';
import{mkdirSync,writeFileSync}from'node:fs';
import{resolve}from'node:path';

const outputDir=resolve('docs/screenshots');
mkdirSync(outputDir,{recursive:true});
const server=http.createServer((request,response)=>{
  response.setHeader('Access-Control-Allow-Origin','*');
  if(request.method==='GET'&&request.url==='/ready'){response.writeHead(200).end('ready');return}
  if(request.method==='POST'&&request.url?.startsWith('/capture/')){
    let body='';
    request.setEncoding('utf8');
    request.on('data',chunk=>body+=chunk);
    request.on('end',()=>{
      const name=request.url?.slice('/capture/'.length).replace(/[^a-z0-9-]/gi,'')||'frame';
      writeFileSync(resolve(outputDir,`effects-review-${name}.png`),Buffer.from(body.replace(/^data:image\/png;base64,/,''),'base64'));
      response.writeHead(200).end('saved');
    });
    return;
  }
  if(request.method==='POST'&&request.url==='/log'){
    let body='';
    request.setEncoding('utf8');
    request.on('data',chunk=>body+=chunk);
    request.on('end',()=>{console.log('browser:',body);response.writeHead(200).end('logged')});
    return;
  }
  response.writeHead(404).end();
});
server.listen(63480,'127.0.0.1',()=>console.log('qa capture ready'));

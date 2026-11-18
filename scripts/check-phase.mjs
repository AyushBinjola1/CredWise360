import {spawn,spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {mkdirSync,openSync,existsSync,closeSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const windows=process.platform==='win32';
const port=Number(process.env.CHECK_WEB_PORT||3101);
const apiPort=Number(process.env.CHECK_CORE_PORT||8788);
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',DEMO_MODE:'1',CORE_PORT:String(apiPort),CORE_URL:'http://127.0.0.1:'+apiPort,WEB_URL:'http://127.0.0.1:'+port,WEB_ORIGINS:'http://127.0.0.1:'+port};
if(windows&&!env.CHROMIUM_PATH&&env.LOCALAPPDATA){
 const folder=join(env.LOCALAPPDATA,'ms-playwright');
 if(existsSync(folder))env.CHROMIUM_PATH=readdirSync(folder).filter(n=>n.startsWith('chromium_headless_shell-')).sort().reverse().map(n=>join(folder,n,'chrome-headless-shell-win64','chrome-headless-shell.exe')).find(existsSync);
}
const core=resolve('build/services/core/credwise'+(windows?'.exe':''));
const next=resolve('node_modules/next/dist/bin/next');
const children=[];
const handles=[];
function run(executable,args,cwd=root){
 const result=spawnSync(executable,args,{cwd,env,stdio:'inherit',windowsHide:true});
 if(result.error||result.status!==0)throw Error(executable+' failed: '+(result.error?.message??result.status));
}
function start(name,executable,args,cwd=root){
 const fd=openSync(resolve('.local/logs/check-'+name+'.log'),'w');handles.push(fd);
 const child=spawn(executable,args,{cwd,env,stdio:['ignore',fd,fd],windowsHide:true});
 children.push(child);return child;
}
async function ready(child,url){
 for(let attempt=0;attempt<80;attempt++){
  if(child.exitCode!==null)throw Error('Service exited. Inspect .local/logs/check-*.log');
  try{if((await fetch(url,{signal:AbortSignal.timeout(1500)})).ok)return;}catch{}
  await new Promise(done=>setTimeout(done,250));
 }
 throw Error('Readiness check failed: '+url);
}
try{
 mkdirSync('.local/logs',{recursive:true});
 run('cmake',['-S','.','-B','build','-G','Ninja']);
 run('cmake',['--build','build','--parallel','3']);
 run('ctest',['--test-dir','build','--output-on-failure']);
 run(core,['--migrate']);run(core,['--migrate']);
 const native=start('core',core,[]);await ready(native,env.CORE_URL+'/api/health');
 run(process.execPath,[next,'build','--webpack'],resolve('apps/web'));
 const web=start('web',process.execPath,[next,'start','--hostname','127.0.0.1','--port',String(port)],resolve('apps/web'));
 await ready(web,env.WEB_URL+'/api/health');
 const apitests=readdirSync('tests').filter(n=>n.endsWith('.test.mjs')).sort().map(n=>join('tests',n));
 run(process.execPath,['--test','--test-concurrency=1',...apitests]);
 run(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test']);
}finally{
 for(const child of children.reverse())child.kill();
 for(const fd of handles)closeSync(fd);
}

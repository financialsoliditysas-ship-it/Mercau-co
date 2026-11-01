const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
function load(file){const mod=new Module(file);mod.require=require;mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const saved=Object.fromEntries(['window','document','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
 const win=new EventTarget(),doc=new EventTarget(),worker=new EventTarget();doc.visibilityState='visible';
 for(const [key,value] of Object.entries({window:win,document:doc,navigator:{serviceWorker:worker}}))Object.defineProperty(global,key,{value,configurable:true});
 let polling;
 try{
  const {startCustomerOrderPolling}=load('lib/customer-order-polling.ts');let calls=0,errors=0,resolveOld;
  const values=[];
  polling=startCustomerOrderPolling({timeoutMs:20,intervalMs:1000,request:()=>{calls++;return calls===1?new Promise(resolve=>resolveOld=resolve):Promise.resolve(calls===2?'accepted':'delivered');},onData:value=>values.push(value),onError:()=>errors++});
  await wait(60);assert.equal(errors,1,'Hung session or fetch must release the polling lock');
  polling.refresh();await wait(5);assert.deepEqual(values,['accepted']);
  resolveOld('pending');await wait(5);assert.deepEqual(values,['accepted'],'A late response must not replace current status');
  doc.visibilityState='hidden';polling.refresh();await wait(5);assert.equal(calls,2);
  doc.visibilityState='visible';win.dispatchEvent(new Event('online'));await wait(5);assert.deepEqual(values,['accepted','delivered']);
  polling.stop();win.dispatchEvent(new Event('focus'));await wait(5);assert.equal(calls,3);
  let finish;polling=startCustomerOrderPolling({timeoutMs:1000,request:()=>new Promise(resolve=>finish=resolve),onData:value=>values.push(value),onError:()=>errors++});await wait(5);polling.stop();finish('foreign-session');await wait(5);assert(!values.includes('foreign-session'));assert.equal(errors,1);
  const component=fs.readFileSync('components/buyer/BuyerExperience.tsx','utf8');assert(component.includes('[section,orderUserId,account.request]'),'Token refresh must not reset the open detail');
  const modal=fs.readFileSync('components/buyer/BuyerOrderList.tsx','utf8');assert(modal.includes('orders.find(order=>order.public_id===selectedId)'));assert(modal.includes('Actualizar estado'));assert(modal.includes('role="alert"'));
  console.log('PASS customer polling: hung-read recovery, late-response isolation, reconnect, visibility, cleanup, stable account identity and visible detail recovery controls. No services contacted.');
 }finally{polling?.stop();for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(global,key,descriptor);else delete global[key];}}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

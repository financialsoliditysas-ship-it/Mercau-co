const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const file=path.resolve(__dirname,'../components/presentation/HomeEntry.tsx');
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const previous=global.window;
function mount(url,{metricFails=false}={}){
  const replaced=[],listeners=new Map();let cleanup;
  global.window={location:new URL(url),addEventListener:(key,callback)=>listeners.set(key,callback),removeEventListener:key=>listeners.delete(key)};
  const mod=new Module(file);
  mod.require=id=>id==='react'?{useRef:()=>({current:false}),useEffect:callback=>{cleanup=callback();}}:id==='next/navigation'?{useRouter:()=>({replace:value=>replaced.push(value)})}:id==='@/lib/marketing-attribution'?{trackPublicMetric(){if(metricFails)throw Error('Optional metric failure');}}:require(id);
  mod._compile(code,file+'.cjs');mod.exports.default();return{replaced,listeners,cleanup};
}
try{
  for(const [hash,target]of [['directorio','/comprar/explorar'],['favoritos','/comprar/favoritos'],['cuenta','/mi-cuenta?entry=general'],['inscripcion','/negocios/registro']]){
    const state=mount('https://www.mercau.co/#'+hash,{metricFails:true});assert.deepEqual(state.replaced,[target]);state.cleanup();assert.equal(state.listeners.size,0);
  }
  assert.deepEqual(mount('https://www.mercau.co/comprar#directorio').replaced,[]);
  assert.deepEqual(mount('https://www.mercau.co/#instalar').replaced,[]);
  assert.deepEqual(mount('https://www.mercau.co/#https://example.invalid').replaced,[]);
  const campaign=mount('https://www.mercau.co/?utm_source=qr&returnTo=https://example.invalid#cuenta');
  assert.equal(campaign.replaced[0],'/mi-cuenta?entry=general&utm_source=qr');
  const dynamic=mount('https://www.mercau.co/');global.window.location.hash='favoritos';dynamic.listeners.get('hashchange')();assert.deepEqual(dynamic.replaced,['/comprar/favoritos']);
  console.log('PASS HomeEntry unit: fixed aliases, UTM allowlist, unknown hashes, non-Home paths, hashchange, cleanup and navigation despite metric failure. Hooks and metrics mocked.');
}finally{if(previous===undefined)delete global.window;else global.window=previous;}

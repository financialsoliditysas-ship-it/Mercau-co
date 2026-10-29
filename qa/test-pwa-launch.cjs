const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),vm=require('node:vm'),ts=require('typescript');
const file=path.resolve(__dirname,'../lib/pwa-launch.ts'),mod=new Module(file);
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');
const {pwaLaunchTarget:target,pwaLaunchScript:script}=mod.exports;
assert.equal(target('/','','',false),null);assert.equal(target('/','','',true),'/comprar');
assert.equal(target('/','?utm_source=tarjeta&foo=bar','',true),'/comprar?utm_source=tarjeta&foo=bar');
for(const hash of ['#instalar','#como-funciona','#cobertura','#para-negocios','#presentacion-contenido'])assert.equal(target('/','',hash,true),'/comprar');
for(const hash of ['#directorio','#cuenta','#inscripcion','#favoritos','#access_token=qa','#unknown'])assert.equal(target('/','',hash,true),null);
for(const query of ['?code=qa','?access_token=qa','?refresh_token=qa','?type=recovery','?error=qa','?error_code=qa'])assert.equal(target('/',query,'',true),null);
for(const route of ['/comprar','/comprar/cuenta','/negocios/ejemplo/catalogo','/mi-cuenta/negocio','/envio/privado','/actualizar/token'])assert.equal(target(route,'','',true),null);
function bootstrap({standalone=false,ios=false,fail=false}={}){
  const replaced=[],root={dataset:{},style:{removeProperty(key){delete this[key];}}};let fallback;
  const location={pathname:'/',search:'?utm_source=qa',hash:'',replace(url){if(fail)throw Error('blocked');replaced.push(url);}};
  vm.runInNewContext(script,{window:{matchMedia:()=>({matches:standalone}),navigator:{standalone:ios}},location,document:{documentElement:root},URLSearchParams,setTimeout:callback=>{fallback=callback;return 1;},clearTimeout(){}});
  return{replaced,root,fallback};
}
assert.deepEqual(bootstrap().replaced,[]);
for(const options of [{standalone:true},{ios:true}]){
  const result=bootstrap(options);assert.deepEqual(result.replaced,['/comprar?utm_source=qa']);assert.equal(result.root.style.visibility,'hidden');assert.equal(result.root.dataset.mercauPwaLaunching,'true');
  result.fallback();assert.equal(result.root.style.visibility,undefined);assert.equal(result.root.dataset.mercauPwaLaunching,undefined);
}
const failed=bootstrap({standalone:true,fail:true});assert.equal(failed.root.style.visibility,undefined);assert.equal(failed.root.dataset.mercauPwaLaunching,undefined);
console.log('PASS PWA target and early bootstrap: browser unchanged, standalone/iOS root, deep links, auth exceptions, query preservation, hidden intro and failed/stalled navigation fallback. Pure/VM tests only.');

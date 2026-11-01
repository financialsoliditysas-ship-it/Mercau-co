const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
async function main(){
 const {businessOrderHours}=load('lib/business-order-hours.ts');
 const schedule=[{closed:true,periods:[]},...[1,2,3,4,5,6].map(day=>({closed:false,periods:[{start:day===6?'08:08':'08:00',end:'11:00'},{start:'15:00',end:day>=5?'20:00':'19:00'}]}))];
 const data={schedule},at=(date,time)=>new Date(`${date}T${time}:00-05:00`);
 for(const [time,open]of [['07:59',false],['08:00',true],['10:59',true],['11:00',false],['11:01',false],['14:59',false],['15:00',true],['18:59',true],['19:00',false]])assert.equal(businessOrderHours(data,at('2026-10-30',time)).open,open,time);
 assert.equal(businessOrderHours(data,at('2026-10-31','19:59')).open,true);assert.equal(businessOrderHours(data,at('2026-10-31','20:00')).open,false);
 assert.equal(businessOrderHours(data,at('2026-11-01','08:00')).open,false,'Never silently change saved Sunday 08:08');assert.equal(businessOrderHours(data,at('2026-11-01','08:08')).open,true);assert.equal(businessOrderHours(data,at('2026-11-01','20:00')).open,false);
 assert.equal(businessOrderHours(data,at('2026-11-02','09:00')).open,false);
 assert.equal(businessOrderHours({...data,temporaryClosed:true},at('2026-10-30','09:00')).open,false);
 assert.equal(businessOrderHours({...data,specialHours:[{date:'2026-10-30',closed:true,periods:[]}]},at('2026-10-30','09:00')).open,false);
 assert.equal(businessOrderHours({...data,specialHours:[{date:'2026-11-02',closed:false,periods:[{start:'09:00',end:'10:00'}]}]},at('2026-11-02','09:30')).open,true);
 assert.equal(businessOrderHours(null).open,true,'Do not invent hours for businesses without a structured schedule');assert.equal(businessOrderHours({schedule:[]}).open,false);
 const route=load('app/api/piloto/restaurante/route.ts',{'@/lib/restaurant-pilot':{pilotId:'demo',pilotRestaurant:async()=>({name:'QA',menu:[],enabled:true,schedule_open:false,availability_message:'Cerrado',is_live:true})}});
 for(const mode of ['menu','availability']){const response=await route.GET(new Request(`https://example.invalid?mode=${mode}`));assert.equal(response.status,200);const body=await response.json();assert.equal(body.enabled,false);assert.equal(body.availabilityMessage,'Cerrado');assert.equal(response.headers.get('cache-control'),'no-store');}
 console.log('PASS saved split hours, Colombia timezone, exact closing boundaries, Sunday 08:08 preserved, Monday, special/temporary closure, unknown schedules and closed menu/availability API. No services contacted.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

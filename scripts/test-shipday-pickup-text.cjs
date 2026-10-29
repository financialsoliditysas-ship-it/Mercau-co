const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
const text=load('lib/shipday-pickup-text.ts');
const prefix='Recoger pedido confirmado. Entregar al negocio COP ';
const endings=['Pago del cliente confirmado por Mercáu.','Cobro al cliente mediante transferencia Bre-B.','Cobro al cliente en efectivo.'];
async function main(){
 for(const ending of endings)assert.equal(text.merchantPickupText(prefix+'51000. '+ending),`ENTREGAR AL NEGOCIO: $51.000 COP\n\nRecoger pedido confirmado.\n${ending}`);
 for(const [amount,formatted]of [['0','0'],['1','1'],['999','999'],['1000','1.000'],['9007199254740993','9.007.199.254.740.993']])assert(text.merchantPickupText(prefix+amount+'. '+endings[2]).startsWith('ENTREGAR AL NEGOCIO: $'+formatted+' COP\n\n'));
 for(const unchanged of [undefined,null,'','Preguntar por caja',prefix+'51000.50. '+endings[2],prefix+'-1. '+endings[2],prefix+'51000. Otra instrucción.','ENTREGAR AL NEGOCIO: $51.000 COP\n\nRecoger pedido confirmado.'])assert.equal(text.merchantPickupText(unchanged),unchanged);
 const realFetch=global.fetch,oldKey=process.env.SHIPDAY_API_KEY;let calls=0;
 try{
  process.env.SHIPDAY_API_KEY='test-only-not-a-real-key';let payload;
  global.fetch=async(_url,options)=>{calls++;payload=JSON.parse(options.body);return Response.json({success:true,orderId:123});};
  const {ShipdayProvider}=load('lib/shipday.ts',{'@/lib/shipday-pickup-text':text});
  const originalSource=fs.readFileSync('lib/shipday.ts','utf8').replace("import { merchantPickupText } from '@/lib/shipday-pickup-text';\n",'').replace('merchantPickupText(order.pickup_instructions),','order.pickup_instructions,');
  const originalModule=new Module('baseline-provider');originalModule.require=require;originalModule._compile(ts.transpileModule(originalSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,'baseline-provider.cjs');
  const order={id:'local-test',public_id:'MCU-TEST',pickup_name:'Negocio ficticio',pickup_address:'Origen ficticio',pickup_neighborhood:'Sector de prueba',delivery_address:'Destino ficticio',delivery_neighborhood:'Sector de prueba',pickup_phone:'3000000000',customer_phone:'3000000000',delivery_phone:'3000000000',pickup_latitude:8.1,pickup_longitude:-74.7,delivery_latitude:8.09,delivery_longitude:-74.78,delivery_fee:5000,commerce_subtotal:60000,commerce_items:[{name:'Producto ficticio',unitPrice:30000,quantity:2}],delivery_instructions:'Referencia ficticia'};
  for(const [payment,status,ending]of [['CASH','PENDING',endings[2]],['BREB_QR','PENDING',endings[1]],['BREB_QR','CONFIRMED',endings[0]]]){
   const input={...order,commerce_payment_method:payment,commerce_payment_status:status,pickup_instructions:prefix+'51000. '+ending};
   await new originalModule.exports.ShipdayProvider().createOrder(input);const before=payload;
   await new ShipdayProvider().createOrder(input);const after=payload;
   assert(after.pickupInstruction.startsWith(`ENTREGAR AL NEGOCIO: $51.000 COP\n\nRecoger pedido confirmado.\n${ending}`));
   assert(after.pickupInstruction.includes('Ubicación exacta de recogida:'));
   delete before.pickupInstruction;delete after.pickupInstruction;
   // Time-of-day fields are generated independently; assert their formats, not elapsed wall time.
   for(const key of ['expectedPickupTime','expectedDeliveryTime']){assert.equal(typeof after[key],'string');delete before[key];delete after[key];}
   assert.deepEqual(after,before,'Only pickup presentation may change');
  }
 }finally{global.fetch=realFetch;if(oldKey===undefined)delete process.env.SHIPDAY_API_KEY;else process.env.SHIPDAY_API_KEY=oldKey;}
 assert.equal(calls,6);console.log('PASS pickup amount first, COP grouping without rounding, free text preserved, cash/Bre-B/confirmed variants; all other provider fields unchanged. Six mocked calls, zero real dispatches.');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

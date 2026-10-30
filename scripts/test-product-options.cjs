const assert=require('node:assert/strict');
const fs=require('node:fs');const Module=require('node:module');const ts=require('typescript');
function load(path,mocks={}){const mod=new Module(path);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path+'.cjs');return mod.exports;}
const validation=load('lib/catalog-validation.ts');
const pilot=load('lib/restaurant-pilot.ts',{
  './order-changes-config':{orderChangesEnabled:()=>false},'./order-changes-model':{changeSelection:''},
  './pilot-order-finance':load('lib/pilot-order-finance.ts'),
  './supabase-admin':{},'./deliveries':{},'./business-push':{},'./catalog-validation':validation
});
const group={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Adiciones',type:'multiple',required:false,minSelections:0,maxSelections:2,choices:[
  {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Queso',priceDelta:3000,defaultSelected:false},
  {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Tocineta',priceDelta:4000,defaultSelected:false}
]};
const menu=[{id:'11111111-1111-4111-8111-111111111111',name:'Hamburguesa',description:'',category:'Comidas',price:20000,image:'',optionGroups:[group]}];
const base={confirmed:true,requestKey:'22222222-2222-4222-8222-222222222222',name:'Cliente',phone:'3147637745',address:'Calle 1',neighborhood:'Centro',paymentMethod:'CASH'};
const line={lineId:'33333333-3333-4333-8333-333333333333',productId:menu[0].id,quantity:2,selections:[{groupId:group.id,choiceIds:[group.choices[0].id]}],note:'Sin cebolla'};
const result=pilot.validatePilotOrder({...base,lines:[line]},menu);
assert.equal(result.lines[0].unitPrice,23000);assert.equal(result.subtotal,46000);assert.equal(result.lines[0].note,'Sin cebolla');assert.equal(result.lines[0].selections[0].choices[0].name,'Queso');
assert.throws(()=>pilot.validatePilotOrder({...base,lines:[{...line,selections:[{groupId:group.id,choiceIds:['dddddddd-dddd-4ddd-8ddd-dddddddddddd']}]}]},menu));
assert.throws(()=>pilot.validatePilotOrder({...base,lines:[{...line,selections:[{groupId:group.id,choiceIds:[group.choices[0].id,group.choices[1].id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd']}]}]},menu));
console.log('PASS product options: server price calculation, immutable snapshot, notes, unknown choices and selection limits.');

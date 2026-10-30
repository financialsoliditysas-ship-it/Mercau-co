const paymentFields='payment_method,payment_status';
const merchantFields='product_subtotal,merchant_commission_rate_bps,merchant_commission_total,merchant_net';

export function pilotOrderSelection(manager:boolean) {
  return `*,delivery:delivery_orders(public_id,status,shipday_order_id),history:pilot_food_history(status,created_at),finance:order_financial_snapshots(${paymentFields}${manager?','+merchantFields:''})`;
}

export function customerPaymentFinance(value:unknown):unknown {
  if(Array.isArray(value))return value.map(customerPaymentFinance);
  if(value===null||value===undefined)return value;
  if(typeof value!=='object')return null;
  const row=value as Record<string,unknown>;
  return {...(typeof row.payment_method==='string'?{payment_method:row.payment_method}:{}),...(typeof row.payment_status==='string'?{payment_status:row.payment_status}:{})};
}

function pesos(value:unknown):number|null {
  if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))return null;
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>=0?number:null;
}

export function merchantOrderPayout(value:unknown) {
  const item=Array.isArray(value)?(value.length===1?value[0]:null):value;
  if(!item||typeof item!=='object')return null;
  const row=item as Record<string,unknown>,net=pesos(row.merchant_net);
  if(net===null)return null;
  const rate=pesos(row.merchant_commission_rate_bps);
  return {net,subtotal:pesos(row.product_subtotal),commission:pesos(row.merchant_commission_total),rateBps:rate!==null&&rate<=10000?rate:null};
}

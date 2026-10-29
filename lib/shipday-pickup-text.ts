const paymentInstructions=new Set([
  'Pago del cliente confirmado por Mercáu.',
  'Cobro al cliente mediante transferencia Bre-B.',
  'Cobro al cliente en efectivo.',
]);

export function merchantPickupText(instruction:string|null|undefined) {
  if(!instruction)return instruction;
  const match=instruction.match(/^Recoger pedido confirmado\. Entregar al negocio COP (\d{1,20})\. (.+)$/);
  if(!match||!paymentInstructions.has(match[2]))return instruction;
  const amount=new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(BigInt(match[1]));
  return `ENTREGAR AL NEGOCIO: $${amount} COP\n\nRecoger pedido confirmado.\n${match[2]}`;
}

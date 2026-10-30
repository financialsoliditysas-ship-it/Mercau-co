export type ChangeLine = {
  lineId?: string; productId?: string; name: string; quantity: number; unitPrice: number;
  selections?: { groupName: string; choices: { name: string; priceDelta: number }[] }[]; note?: string;
};
export type OrderChange = {
  id: string; status: 'pending'|'accepted'|'declined'|'withdrawn'|'cancelled';
  old_lines: ChangeLine[]; new_lines: ChangeLine[]; old_subtotal: number; new_subtotal: number;
  created_at: string; responded_at: string|null;
};
export const changeSelection = 'id,status,old_lines,new_lines,old_subtotal,new_subtotal,created_at,responded_at';
export function latestChange(changes?: OrderChange[]) {
  return changes?.reduce<OrderChange|undefined>((latest,item)=>!latest||item.created_at>latest.created_at?item:latest,undefined);
}
export function unresolvedChange(changes?: OrderChange[]) {
  return changes?.some(change=>change.status==='pending'||change.status==='declined')===true;
}

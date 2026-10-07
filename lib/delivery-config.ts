export const DEFAULT_DELIVERY_FEE_COP = 5000;

export function getDeliveryFeeCop() {
  const raw = Number(process.env.DELIVERY_FEE_COP || DEFAULT_DELIVERY_FEE_COP);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DELIVERY_FEE_COP;
}

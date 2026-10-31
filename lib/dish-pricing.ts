import { catalogOptionGroups } from './catalog-validation';
export function dishStartingPrice(base: number, raw: unknown) {
  const groups = catalogOptionGroups(raw || []);
  const minimum = groups.reduce((sum, group) => sum + [...group.choices]
    .sort((a, b) => a.priceDelta - b.priceDelta).slice(0, Math.max(group.minSelections, group.required ? 1 : 0))
    .reduce((total, choice) => total + choice.priceDelta, 0), 0);
  const maximum = groups.reduce((sum, group) => sum + [...group.choices].sort((a, b) => b.priceDelta - a.priceDelta)
    .slice(0, group.maxSelections).reduce((total, choice) => total + choice.priceDelta, 0), 0);
  return { price: base + minimum, from: maximum > minimum };
}

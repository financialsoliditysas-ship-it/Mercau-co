import { catalogFields, validProductId, type CatalogFields } from './catalog-validation';

type ImportedGroup = {
  name:string; type:'single'|'multiple'; required:boolean; minSelections:number; maxSelections:number;
  choices:Array<{id:string;name:string;priceDelta:number;defaultSelected:boolean}>;
};

export function normalizeImportedOptionGroup<T extends ImportedGroup>(group:T):T {
  if (!group.choices.length) return group;
  const defaultCount=group.choices.filter(choice=>choice.defaultSelected).length;
  if(group.type==='single')return {...group,minSelections:group.required?1:Math.min(group.minSelections,1),maxSelections:1};
  const maxSelections=Math.min(group.choices.length,Math.max(1,group.maxSelections,defaultCount));
  const minSelections=Math.min(maxSelections,Math.max(group.required?1:0,group.minSelections));
  return {...group,minSelections,maxSelections};
}

export function draftRows(value: unknown, startPosition = 0): Array<{ id: string; fields: CatalogFields }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('Selecciona entre 1 y 100 productos.');
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Revisa los productos seleccionados.');
    const row = raw as Record<string, unknown>;
    if (!validProductId(row.id)) throw new Error('Uno de los productos perdió su identificador. Recarga la extracción.');
    return {
      id: String(row.id),
      fields: catalogFields({
        name: String(row.name || ''),
        description: String(row.description || ''),
        section: String(row.section || ''),
        price: Number(row.price),
        available: typeof row.available === 'boolean' ? row.available : true,
        status: 'draft',
        position: startPosition + index,
        optionGroups: row.optionGroups ?? []
      })
    };
  });
}


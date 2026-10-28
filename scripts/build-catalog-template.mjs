import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from 'file:///C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Productos');
sheet.showGridlines = false;

sheet.getRange('A1:F1').values = [['Plantilla para importar productos a Mercáu', null, null, null, null, null]];
sheet.getRange('A1:F1').format = {
  fill: '#D82016',
  font: { bold: true, color: '#FFFFFF', size: 14 },
  rowHeight: 28,
  verticalAlignment: 'center'
};
sheet.getRange('A2:F2').values = [['Completa una fila por producto. Usa el código para relacionar sus ingredientes, salsas, adiciones o grupos personalizados.', null, null, null, null, null]];
sheet.getRange('A2:F2').format = { font: { italic: true, color: '#475569', size: 10 }, rowHeight: 32, wrapText: true };
sheet.getRange('A4:F4').values = [['Código producto', 'Sección', 'Nombre del producto', 'Descripción', 'Precio', 'Disponible']];
sheet.getRange('A4:F4').format = {
  fill: '#991B1B',
  font: { bold: true, color: '#FFFFFF', size: 10 },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  rowHeight: 24
};
sheet.getRange('A5:F7').values = [
  ['P001', 'Comidas rápidas', 'Salchipapa especial', 'Salchicha, papa y salsas', 22000, 'Sí'],
  ['P002', 'Hamburguesas', 'Hamburguesa especial', 'Carne, queso y vegetales', 25000, 'Sí'],
  ['P003', 'Patacones', 'Patacón especial', 'Patacón con carne y queso', 20000, 'Sí']
];
sheet.getRange('A5:F104').format = { font: { size: 10 }, verticalAlignment: 'top' };
sheet.getRange('D5:D104').format.wrapText = true;
sheet.getRange('E5:E104').format.numberFormat = '$ #,##0';
sheet.getRange('A5:F104').format.rowHeight = 22;
sheet.getRange('A1:A1').format.columnWidth = 18;
sheet.getRange('B1:B1').format.columnWidth = 22;
sheet.getRange('C1:C1').format.columnWidth = 30;
sheet.getRange('D1:D1').format.columnWidth = 46;
sheet.getRange('E1:E1').format.columnWidth = 16;
sheet.getRange('F1:F1').format.columnWidth = 14;
sheet.freezePanes.freezeRows(4);

function formatRelationSheet(target, title, headers, rows, widths) {
  const last = String.fromCharCode(64 + headers.length);
  target.showGridlines = false;
  target.getRange(`A1:${last}1`).values = [[title, ...Array(headers.length - 1).fill(null)]];
  target.getRange(`A1:${last}1`).format = { fill: '#D82016', font: { bold: true, color: '#FFFFFF', size: 14 }, rowHeight: 28 };
  target.getRange(`A2:${last}2`).values = [['No cambies los encabezados ni los códigos de relación.', ...Array(headers.length - 1).fill(null)]];
  target.getRange(`A2:${last}2`).format = { font: { italic: true, color: '#475569' }, rowHeight: 24 };
  target.getRange(`A4:${last}4`).values = [headers];
  target.getRange(`A4:${last}4`).format = { fill: '#991B1B', font: { bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', rowHeight: 24 };
  target.getRange(`A5:${last}${4 + rows.length}`).values = rows;
  widths.forEach((width, index) => target.getRange(`${String.fromCharCode(65 + index)}1:${String.fromCharCode(65 + index)}1`).format.columnWidth = width);
  target.freezePanes.freezeRows(4);
}

const groups = workbook.worksheets.add('Grupos');
formatRelationSheet(groups, 'Grupos de personalización', ['Código grupo', 'Nombre del grupo', 'Tipo', 'Obligatorio', 'Mínimo', 'Máximo'], [
  ['G001', 'Adiciones', 'Múltiple', 'No', 0, 2],
  ['G002', 'Salsas', 'Múltiple', 'No', 0, 2],
  ['G003', 'Ingredientes', 'Múltiple', 'No', 0, 2]
], [18, 28, 18, 16, 12, 12]);

const options = workbook.worksheets.add('Opciones');
formatRelationSheet(options, 'Opciones de cada grupo', ['Código grupo', 'Opción', 'Precio adicional', 'Seleccionada inicialmente'], [
  ['G001', 'Queso extra', 3000, 'No'],
  ['G001', 'Tocineta', 4000, 'No'],
  ['G002', 'Salsa de ajo', 0, 'No'],
  ['G002', 'Salsa rosada', 0, 'No'],
  ['G003', 'Lechuga', 0, 'Sí'],
  ['G003', 'Tomate', 0, 'Sí']
], [18, 30, 20, 26]);
options.getRange('C5:C104').format.numberFormat = '$ #,##0';

const assignments = workbook.worksheets.add('Asignaciones');
formatRelationSheet(assignments, 'Asignación de grupos a productos', ['Código producto', 'Código grupo'], [
  ['P001', 'G001'], ['P001', 'G002'],
  ['P002', 'G001'], ['P002', 'G002'], ['P002', 'G003'],
  ['P003', 'G001'], ['P003', 'G002']
], [22, 22]);

const instructions = workbook.worksheets.add('Instrucciones');
instructions.showGridlines = false;
instructions.getRange('A1:B1').values = [['Cómo completar la plantilla', null]];
instructions.getRange('A1:B1').format = { fill: '#D82016', font: { bold: true, color: '#FFFFFF', size: 14 }, rowHeight: 28 };
instructions.getRange('A3:B12').values = [
  ['Campo', 'Regla'],
  ['Código producto', 'Código único dentro del archivo. Ejemplo: P001. Sirve para asignar grupos al producto.'],
  ['Sección', 'Categoría interna del menú o catálogo. Ejemplo: Hamburguesas, Bebidas o Servicios.'],
  ['Nombre del producto', 'Obligatorio. Máximo 120 caracteres.'],
  ['Descripción', 'Opcional. Máximo 600 caracteres.'],
  ['Precio', 'Obligatorio. Pesos colombianos sin centavos. Puede escribirse 20000 o 20.000.'],
  ['Disponible', 'Escribe Sí o No. Si queda vacío, se entenderá Sí.'],
  ['Grupo', 'Ingredientes, salsas, adiciones, tamaños u otro grupo personalizado.'],
  ['Tipo', 'Única permite una selección. Múltiple permite varias selecciones.'],
  ['Asignación', 'Relaciona un código de producto con un código de grupo. El mismo grupo puede asignarse a varios productos.']
];
instructions.getRange('A3:B3').format = { fill: '#991B1B', font: { bold: true, color: '#FFFFFF' } };
instructions.getRange('A3:B12').format.wrapText = true;
instructions.getRange('A1:A1').format.columnWidth = 25;
instructions.getRange('B1:B1').format.columnWidth = 72;
instructions.getRange('A3:B12').format.rowHeight = 34;

workbook.recalculate();
const output = await SpreadsheetFile.exportXlsx(workbook);
await fs.mkdir('public', { recursive: true });
await output.save('public/plantilla-importacion-catalogo-mercau.xlsx');


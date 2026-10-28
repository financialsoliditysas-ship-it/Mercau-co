const assert=require('node:assert/strict');
const fs=require('node:fs');

function source(path){return fs.readFileSync(path,'utf8');}
function reveals(path,ref){
  const text=source(path);
  assert(text.includes(`${ref}.current?.scrollIntoView({behavior:'smooth',block:'start'})`),`${path} no desplaza hacia la acción abierta`);
  assert(text.includes(`${ref}.current?.focus({preventScroll:true})`),`${path} no mueve el foco a la acción abierta`);
}

reveals('components/CatalogManager.tsx','editorRef');
reveals('components/MyBusinessDashboard.tsx','editorRef');
const workspace=source('components/account/BusinessWorkspace.tsx');
assert(workspace.includes("window.scrollTo({top,behavior:reduceMotion?'auto':'smooth'})"));
assert(workspace.includes("target.focus({preventScroll:true})"));
assert(workspace.includes('Anterior: ${previousTab}'));
assert(workspace.includes('Siguiente: ${nextTab}'));
assert(workspace.includes('Guardar y continuar'));
const registration=source('components/BusinessRegistration.tsx');
assert(registration.includes("formRef.current?.scrollIntoView({behavior:'smooth',block:'start'})"));
assert(registration.includes("firstVisible?.focus({preventScroll:true})"));
const checkout=source('components/RestaurantPilot.tsx');
assert(checkout.includes("target?.scrollIntoView({ behavior: 'smooth', block: 'start' })"));
assert(checkout.includes("firstMissing?.focus({ preventScroll: true })"));
const directory=source('components/MercauDirectory.tsx');
assert(directory.includes('<BottomNav onSearch={openPrimarySearch} />'));
assert(directory.includes('target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" })'));
assert(directory.includes('target.focus({ preventScroll: true })'));
assert(directory.includes('pt-[65px]'));
assert(directory.includes('md:pt-[73px]'));
assert(directory.includes('fixed inset-x-0 top-0 z-40'));
console.log('PASS action reveal: catalog, business editor, business sections, registration steps, checkout, fixed directory header and mobile search behavior.');

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'outputs/presentation-protected-before.json')));
let protectedCount=0;
for(const [file,expected]of Object.entries(baseline)){
  if(file==='app/page.tsx')continue;
  assert.equal(hash(file),expected,'Unexpected operational change: '+file);protectedCount++;
}
const sources=JSON.parse(fs.readFileSync(path.join(root,'outputs/visual-presentation-20261028-v2/manifest.json'))).files.filter(e=>e.role==='source').map(e=>e.source);
execFileSync('git',['diff','--exit-code','64ec94c','--',...sources,'components/MercauDirectory.tsx'],{cwd:root,stdio:'pipe'});
const home=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
assert.match(home,/<HomeEntry \/><Presentation \/>/);assert(!home.includes('MercauDirectory'));assert(!home.includes('notFound'));
assert.equal(fs.readFileSync(path.join(root,'app/manifest.ts'),'utf8').includes('start_url: "/"'),true);
console.log('PASS '+protectedCount+' operational files unchanged; only the authorized Home excluded. V3 visual source, assets, old directory, manifest and SW preserved.');

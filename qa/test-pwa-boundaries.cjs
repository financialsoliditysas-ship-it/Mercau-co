const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'outputs/presentation-protected-before.json')));let count=0;
for(const [file,expected]of Object.entries(baseline)){if(['app/page.tsx','app/layout.tsx'].includes(file))continue;assert.equal(hash(file),expected,file);count++;}
execFileSync('git',['diff','--exit-code','1fa88f0','--','app/manifest.ts','public/mercau-sw.js','app/page.tsx','components/presentation/Presentation.tsx','app/presentacion-revision/presentation.css','public/presentation','components/MercauDirectory.tsx'],{cwd:root,stdio:'pipe'});
const old=execFileSync('git',['show','1fa88f0:app/layout.tsx'],{cwd:root,encoding:'utf8'}),current=fs.readFileSync(path.join(root,'app/layout.tsx'),'utf8');
assert.equal(current.match(/<Script id="mercau-install-capture"[\s\S]*?<\/Script>/)[0].replace(/\r\n/g,'\n'),old.match(/<Script id="mercau-install-capture"[\s\S]*?<\/Script>/)[0].replace(/\r\n/g,'\n'));
console.log('PASS '+count+' operational files unchanged. Manifest, SW, registration, visual presentation, Home and cart/order/payment components preserved; only the authorized layout bridge excluded.');

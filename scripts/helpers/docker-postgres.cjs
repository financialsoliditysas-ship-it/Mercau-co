const assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
// Test adapter only. No production imports, host ports, external network or real credentials.
class DockerPostgres {
 constructor(id){
  assert(/^[a-f0-9]{64}$/.test(id),'Expected exact owned container ID');this.id=id;this.role=null;this.pids=new Set();
  const container=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8',windowsHide:true}))[0];
  assert.equal(container.Config.Labels['mercau.qa'],'logistics-20261030');assert.equal(container.HostConfig.NetworkMode,'none');
  assert(!container.Mounts.some(mount=>mount.Type==='bind'));assert(!Object.keys(container.HostConfig.PortBindings||{}).length);
 }
 run(sql,variables=[]){return new Promise((resolve,reject)=>{
  const args=['exec','-i',this.id,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','supabase_admin','-d','mercau_qa',...variables];
  const child=spawn('docker',args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',errors='';
  const timer=setTimeout(()=>{child.kill();reject(Error('Local PostgreSQL test timed out'));},60000);
  child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);child.on('error',error=>{clearTimeout(timer);reject(error);});
  child.on('close',code=>{clearTimeout(timer);if(code){const error=new Error(errors||'Local PostgreSQL command failed');error.code=/ERROR:\s+([A-Z0-9]{5}):/.exec(errors)?.[1];reject(error);}else resolve(output.trim());});
  child.stdin.end((this.role?'set role '+this.role+';\n':'')+sql);
 });}
 async exec(sql){
  const role=/^set role (anon|authenticated|service_role);?$/i.exec(sql.trim());if(role){this.role=role[1];return [];}
  if(/^reset role;?$/i.test(sql.trim())){this.role=null;return [];}
  await this.run(sql);return [];
 }
 async query(sql,params=[]){
  const variables=[];
  // psql performs value quoting, not JavaScript interpolation of SQL values.
  const bound=sql.replace(/\$(\d+)\b/g,(_,n)=>{
   const value=params[Number(n)-1];assert(value!==undefined,'Missing test SQL parameter');if(value===null)return 'NULL';
   const name='qa_param_'+n;variables.push('-v',name+'='+String(value));return ":'"+name+"'";
  }).trim().replace(/;$/,'');
  if(!/^\s*(select|with)\b/i.test(bound)&&!/\breturning\b/i.test(bound)){await this.run(bound+';',variables);return {rows:[]};}
  const result=JSON.parse(await this.run(`with qa_rows as (${bound}) select json_build_object('pid',pg_backend_pid(),'rows',coalesce(json_agg(qa_rows),'[]'::json)) from qa_rows;`,variables));
  this.pids.add(result.pid);return {rows:result.rows};
 }
 async close(){console.log('PostgreSQL independent backend sessions: '+this.pids.size);}
}
module.exports={DockerPostgres};

// Disposable plain PostgreSQL only. Never connects to the hosted project.
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
const name=`navi-accounts-test-${process.pid}`;
function docker(args,input){const r=spawnSync("docker",args,{input,encoding:"utf8",stdio:input?["pipe","inherit","inherit"]:"inherit"});if(r.status!==0)throw new Error(`Local database check failed: ${args[0]}`);}
try{
 docker(["run","--name",name,"--rm","--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-d","postgres:17-alpine"]);
 let ready=false;
 for(let i=0;i<30;i++){const r=spawnSync("docker",["exec",name,"pg_isready","-U","postgres"],{stdio:"ignore"});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
 if(!ready)throw new Error("Local PostgreSQL did not become ready");
 for(const file of ["supabase/tests/bootstrap.sql","supabase/migrations/202611040001_accounts.sql","supabase/tests/accounts.sql"])docker(["exec","-i",name,"psql","-U","postgres","-v","ON_ERROR_STOP=1"],readFileSync(file));
}finally{spawnSync("docker",["stop",name],{stdio:"inherit"});}

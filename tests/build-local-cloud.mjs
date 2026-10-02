import{execFileSync}from'node:child_process';
const s=JSON.parse(execFileSync('npx.cmd',['supabase','status','--output','json'],{encoding:'utf8',shell:true,stdio:['ignore','pipe','pipe']}));
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:s.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY};
execFileSync('npm.cmd',['run','build'],{env,shell:true,stdio:'inherit'});

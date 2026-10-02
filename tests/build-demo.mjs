import {execFileSync} from 'node:child_process';
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{shell:process.platform==='win32',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},stdio:'inherit'});

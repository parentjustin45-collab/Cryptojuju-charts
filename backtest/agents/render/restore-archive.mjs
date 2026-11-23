/*
 * Offline recovery of archived research results.
 * Run only in a private environment with DATABASE_URL set and pg installed.
 * Never expose database credentials or recovered files via public HTTP.
 */
import pg from 'pg';
import {restoreArchivedRun} from './archive.mjs';

const [agent,slot,destination]=process.argv.slice(2);
if(!agent||!slot||!destination){
  console.error('Usage: node restore-archive.mjs <agent> <UTC-hour-slot> <output-dir>');
  process.exitCode=2;
}else if(!process.env.DATABASE_URL){
  console.error('DATABASE_URL is required in a private environment.');
  process.exitCode=2;
}else{
  const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
  try{
    const receipt=await restoreArchivedRun(db,{agent,slot,destination});
    console.log(JSON.stringify({status:'RESTORED_AND_SHA256_VERIFIED',...receipt}));
  }catch(e){
    console.error('ARCHIVE_RESTORE_FAILED '+String(e?.message??e));
    process.exitCode=1;
  }finally{
    await db.end();
  }
}

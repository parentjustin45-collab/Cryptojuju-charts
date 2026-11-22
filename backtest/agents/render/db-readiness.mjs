/*
 * CryptoJuju Render — read-only internal PostgreSQL readiness check.
 * Never prints, returns, or persists DATABASE_URL, its password, or host.
 * This is a preflight, NOT evidence of live research execution.
 */
const errorKind=err=>{
  const code=String(err?.code??'');
  if(code==='28P01')return 'AUTH_FAILED';
  if(code==='42501')return 'DB_PERMISSION_DENIED';
  if(code==='ENOTFOUND'||code==='EAI_AGAIN')return 'DB_DNS_FAILED';
  if(code==='ECONNREFUSED'||code==='ETIMEDOUT'||code==='EHOSTUNREACH')return 'DB_UNREACHABLE';
  if(code==='SELF_SIGNED_CERT_IN_CHAIN'||code==='CERT_HAS_EXPIRED')return 'DB_TLS_FAILED';
  return 'DB_CONNECTION_FAILED';
};
function validUrl(value){
  if(typeof value!=='string'||!value.trim())return false;
  try {
    const u=new URL(value);
    return ['postgresql:','postgres:'].includes(u.protocol) &&
      !!u.hostname&&!!u.username&&!!u.password&&!!u.pathname&&u.pathname!=='/';
  }catch{return false;}
}
export async function probeDatabase({url=process.env.DATABASE_URL,PoolClass=null}={}){
  if(!validUrl(url))return {status:'BLOCKED',code:'DATABASE_URL_NOT_CONFIGURED_OR_INVALID'};
  let pool;
  try{
    const pg=PoolClass?null:(await import('pg')).default;
    pool=new (PoolClass??pg.Pool)({
      connectionString:url,max:1,connectionTimeoutMillis:5000,
      idleTimeoutMillis:2000,statement_timeout:5000,
      application_name:'cryptojuju_readonly_preflight'
    });
    const q=await pool.query(
      "SELECT current_setting('server_version_num')::integer AS version_num, "+
      "has_schema_privilege(current_user,'public','CREATE') AS can_create_tables, "+
      "pg_is_in_recovery() AS is_replica");
    const row=q.rows?.[0];
    if(!row || !Number.isFinite(Number(row.version_num)))
      return {status:'BLOCKED',code:'DB_UNEXPECTED_RESPONSE'};
    const major=Math.floor(Number(row.version_num)/10000);
    if(major<14)return {status:'BLOCKED',code:'DB_VERSION_UNSUPPORTED',versionMajor:major};
    if(row.is_replica===true)return {status:'BLOCKED',code:'DB_READ_ONLY_REPLICA',versionMajor:major};
    if(row.can_create_tables!==true)
      return {status:'BLOCKED',code:'DB_SCHEMA_CREATE_PERMISSION_MISSING',versionMajor:major};
    return {status:'READY_FOR_SCHEMA_INITIALIZATION',versionMajor:major,
      access:'READ_ONLY_PROBE_NO_TABLES_CREATED'};
  }catch(error){
    return {status:'BLOCKED',code:errorKind(error)};
  }finally{if(pool)try{await pool.end();}catch{/* no secret logging */}}
}
if(process.argv[1]?.endsWith('/db-readiness.mjs')){
  const result=await probeDatabase();
  // This object intentionally omits host, user, password and database name.
  console.log('CJ_DB_PRECHECK '+JSON.stringify(result));
  if(result.status!=='READY_FOR_SCHEMA_INITIALIZATION')process.exitCode=2;
}

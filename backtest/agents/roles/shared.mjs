/* Immutable role report shape. Pure functions: no network, secrets, writes or orders. */
export const record=(id,status,details={})=>({id,status,details});
export const finite=x=>typeof x==='number' && Number.isFinite(x);
export const safeList=x=>Array.isArray(x)?x:[];

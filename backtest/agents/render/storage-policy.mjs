/* Single conservative logical DB budget. Physical disk is monitored separately. */
export const DEFAULT_STORAGE_BUDGET=1073741824;
export const STORAGE_LIMIT_RATIO=.70;
export function storageBudget(env=process.env){
 const raw=env.CJ_ARCHIVE_DISK_BUDGET_BYTES??String(DEFAULT_STORAGE_BUDGET);
 if(!/^\d+$/.test(String(raw)))throw Error('INVALID_STORAGE_BUDGET');
 const bytes=Number(raw);
 if(!Number.isSafeInteger(bytes)||bytes<1000000)throw Error('INVALID_STORAGE_BUDGET');
 return bytes;
}
export function storageState(used,budget=storageBudget(),additional=0){
 if(!Number.isSafeInteger(budget)||budget<1000000)throw Error('INVALID_STORAGE_BUDGET');
 if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(additional)||additional<0)throw Error('DATABASE_STORAGE_USAGE_UNKNOWN');
 const thresholdBytes=Math.floor(budget*STORAGE_LIMIT_RATIO);
 return {dbBytes:used,configuredBudgetBytes:budget,thresholdBytes,ratio:used/budget,warning:used+additional>=thresholdBytes};
}

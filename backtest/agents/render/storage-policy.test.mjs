import test from 'node:test';import assert from 'node:assert/strict';
import {storageBudget,storageState} from './storage-policy.mjs';
test('default remains conservative unless explicitly configured',()=>{assert.equal(storageBudget({}),1073741824);assert.equal(storageBudget({CJ_ARCHIVE_DISK_BUDGET_BYTES:'10000000000'}),10000000000);});
test('10 decimal GB threshold and reserve',()=>{const b=10000000000;assert.equal(storageState(399316671,b).thresholdBytes,7000000000);assert.equal(storageState(6999999999,b).warning,false);assert.equal(storageState(6999999999,b,1).warning,true);assert.equal(storageState(7000000000,b).warning,true);});
test('invalid values fail closed',()=>{for(const x of ['','NaN','0','1e10','-10000000000','Infinity'])assert.throws(()=>storageBudget({CJ_ARCHIVE_DISK_BUDGET_BYTES:x}),/INVALID_STORAGE_BUDGET/);for(const x of [NaN,-1,Infinity])assert.throws(()=>storageState(x,10000000000),/DATABASE_STORAGE_USAGE_UNKNOWN/);});

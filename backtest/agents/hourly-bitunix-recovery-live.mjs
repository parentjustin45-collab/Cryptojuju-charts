import {fetchHourlyVerifiedWindow} from './hourly-bitunix-recovery.mjs';
import {makeBitunixFetchPage} from '../bitunix-adapter.mjs';
import {validateHistoricalSource} from './render/historical-library.mjs';
import {requireVerifiedInput} from './run-render-indicator-pilot.mjs';
const cases=[
  {
    "slot": "2026-11-25T02:00:00.000Z",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "endMs": 1795572000000,
    "oldest": 1793833200000
  },
  {
    "slot": "2026-11-25T18:00:00.000Z",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "endMs": 1795629600000,
    "oldest": 1793890800000
  },
  {
    "slot": "2026-11-25T19:00:00.000Z",
    "symbol": "BTCUSDT",
    "timeframe": "30m",
    "endMs": 1795633200000,
    "oldest": 1794763800000
  },
  {
    "slot": "2026-11-25T19:00:00.000Z",
    "symbol": "ETHUSDT",
    "timeframe": "30m",
    "endMs": 1795633200000,
    "oldest": 1794763800000
  },
  {
    "slot": "2026-11-26T00:00:00.000Z",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "endMs": 1795651200000,
    "oldest": 1793912400000
  },
  {
    "slot": "2026-11-26T04:00:00.000Z",
    "symbol": "1000PEPEUSDT",
    "timeframe": "15m",
    "endMs": 1795665600000,
    "oldest": 1795230900000
  },
  {
    "slot": "2026-11-26T06:00:00.000Z",
    "symbol": "ETHUSDT",
    "timeframe": "30m",
    "endMs": 1795672800000,
    "oldest": 1794803400000
  },
  {
    "slot": "2026-11-26T06:00:00.000Z",
    "symbol": "1000PEPEUSDT",
    "timeframe": "30m",
    "endMs": 1795672800000,
    "oldest": 1794803400000
  },
  {
    "slot": "2026-11-26T10:00:00.000Z",
    "symbol": "HYPEUSDT",
    "timeframe": "30m",
    "endMs": 1795687200000,
    "oldest": 1794817800000
  },
  {
    "slot": "2026-11-26T15:00:00.000Z",
    "symbol": "HYPEUSDT",
    "timeframe": "30m",
    "endMs": 1795705200000,
    "oldest": 1794835800000
  },
  {
    "slot": "2026-11-26T15:00:00.000Z",
    "symbol": "1000PEPEUSDT",
    "timeframe": "30m",
    "endMs": 1795705200000,
    "oldest": 1794835800000
  },
  {
    "slot": "2026-11-26T16:00:00.000Z",
    "symbol": "SOLUSDT",
    "timeframe": "15m",
    "endMs": 1795708800000,
    "oldest": 1795274100000
  },
  {
    "slot": "2026-11-27T02:00:00.000Z",
    "symbol": "ETHUSDT",
    "timeframe": "30m",
    "endMs": 1795744800000,
    "oldest": 1794875400000
  }
];
const fetchPage=makeBitunixFetchPage({fetchImpl:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(18000),cache:'no-store',credentials:'omit'})});
let passed=0,recovered=0;
for(const c of cases){
 const r=await fetchHourlyVerifiedWindow({symbol:c.symbol,timeframe:c.timeframe,closedBars:480,nowMs:Date.now(),historicalEndExclusiveMs:c.endMs,fetchPage});
 const stable=r.readback.status==='STABLE_TWO_READS';
 if(stable){validateHistoricalSource(r.first,r.readback);requireVerifiedInput(r.first,r.readback,c);if(r.first.historyWindow.endTime!==c.endMs)throw Error('WINDOW_MOVED');passed++;recovered+=Number(r.recovered);}
 console.log('CJ_HOURLY_RECOVERY_CASE '+JSON.stringify({...c,stable,anchorBars:r.anchorBars,recovered:r.recovered,reason:r.readback.reason,firstReason:r.first?.reason??null,checked:r.readback.checkedDerived??0}));
}
console.log('CJ_HOURLY_RECOVERY_LIVE '+JSON.stringify({passed,expected:cases.length,recovered}));
if(passed!==cases.length)process.exitCode=1;

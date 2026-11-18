/*
 * Offline CLI — accepts user-provided JSON with Bitunix provenance-checked,
 * CLOSED candles and causal experiment signals. No network, tokens, orders.
 * Usage: node backtest/agents/run-workshop.mjs path/to/input.json
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {runSixAgentWorkshop,formatWorkshopMarkdown} from './six-agent-workshop.mjs';

const filename=process.argv[2];
if(!filename||process.argv.length>4){
  console.error('Usage: node backtest/agents/run-workshop.mjs input.json [output-directory]');
  process.exitCode=2;
}else{
  try{
    const text=await readFile(filename,'utf8');
    if(text.length>20_000_000)throw Error('Input exceeds 20 MB research limit');
    const report=runSixAgentWorkshop(JSON.parse(text));
    const md=formatWorkshopMarkdown(report);
    if(process.argv[3]){
      const target=resolve(process.argv[3]);
      await mkdir(target,{recursive:true});
      await writeFile(resolve(target,'report.json'),JSON.stringify(report,null,2)+'\n');
      await writeFile(resolve(target,'report.md'),md);
    }
    console.log(md);
    if(report.status!=='RESEARCH_READY')process.exitCode=1;
  }catch(e){console.error('Workshop failed: '+String(e?.message??e));process.exitCode=2;}
}

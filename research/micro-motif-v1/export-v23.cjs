const fs=require('node:fs'),path=require('node:path'),{context}=require('../../pulse-tap/compare-v23.cjs');
const out=process.argv[2];if(!out)throw Error('Explicit scratch output required');
for(const name of ['alldat','cvb']){const c=context(name,23);fs.writeFileSync(path.join(out,name+'-v23.json'),JSON.stringify({selectedTimes:c.rows.filter(r=>r.selected).map(r=>r.targetTime)})+'\n');}

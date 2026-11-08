/* Author: GPT-6.1 Sol
Date: 06-November-2026
PURPOSE: Render Son's original Claude article chart definitions once in an offline DOM, then export script-free static HTML, SVG, PNG, readable source, Markdown and source data for Kaggle and ARC Explainer.
SRP/DRY check: Pass — reuses the original chart renderer/data and installed jsdom/sharp rather than approximating the plots. */
const fs=require('fs'),path=require('path');
const {JSDOM}=require('/Volumes/Team 4TB/loose-goose/test-runtime/node_modules/jsdom');
const sharp=require('/Users/macmini/GitHub/arc-explainer/node_modules/sharp');
const R=path.resolve(__dirname,'..'), S='/Users/macmini/GitHub/arc-explainer/client/public/specials', A=path.join(S,'arc3-solution-draft');
const raw=fs.readFileSync(path.join(R,'claude-original-frame.html'),'utf8');
const scripts=[...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
const chart=scripts.at(-1)[1];
if(!chart.includes('var TIME =')||!chart.includes('function drawAll()'))throw Error('Original renderer not found');
const dom=new JSDOM(raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{runScripts:'outside-only'}), w=dom.window,d=w.document;
Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 900;}});
// Execute only the inspected offline chart definitions; omit the animation/bootstrap section.
w.eval(chart.slice(0,chart.indexOf('/* ---------------- build-in animations'))+'\ndrawDelta2(); drawWF("decode"); drawWF("prefill"); drawWF("overhead"); drawThink(); drawLadder(); drawTime(); drawStep(); drawLanes(); drawMemory(); drawKaggle(); window.sourceData={TIME,LADDER,STEP,LANES,MEM,KAGGLE,THINK,WF,DELTA2};\n})();');
const O=path.join(R,'charts','original');fs.mkdirSync(O,{recursive:true});
fs.writeFileSync(path.join(O,'source-data.json'),JSON.stringify(w.sourceData,null,2));
fs.writeFileSync(path.join(R,'claude-original-readable.txt'),d.querySelector('main').textContent);
async function run(){
 for(const box of d.querySelectorAll('.chart')){
  const svg=box.querySelector('svg');if(!svg)continue;
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  // Inline inherited font/color choices so the standalone SVG and PNG match.
  svg.setAttribute('font-family','DejaVu Sans Mono, monospace');
  const txt=svg.outerHTML.replace(/JetBrains Mono/g,'DejaVu Sans Mono').replace(/Inter/g,'DejaVu Sans');
  const name=box.id.replace(/^chart-/,'');fs.writeFileSync(path.join(O,name+'.svg'),txt);
  await sharp(Buffer.from(txt)).resize({width:1800}).flatten({background:'#fbf1e6'}).png().toFile(path.join(O,name+'.png'));
  box.innerHTML=`<a href="arc3-solution-draft/charts/original/${name}.svg"><img src="arc3-solution-draft/charts/original/${name}.png" alt="${box.closest('figure').querySelector('.ft').textContent}" loading="lazy"></a>`;
 }
 for(const x of d.querySelectorAll('script,video,source,link,#tip'))x.remove();
 for(const el of d.querySelectorAll('*'))for(const at of [...el.attributes])if(/^on/i.test(at.name)||at.name.startsWith('data-a'))el.removeAttribute(at.name);
 d.querySelector('#fig-trim').remove(); // The following static trim/swap/wipe panel conveys the same actual settings without illustrative motion.
 d.querySelector('h1').textContent='Stuffing the Turducken';
 const headings={'Part 1. The harness':'The Harness','Part 2. The inference optimizations':'Inference Optimization','Part 3. RL: what we tried, and why none of it shipped':'RL','Part 4. What we learnt':'When speed no longer matters'};
 for(const h of [...d.querySelectorAll('h2')]){if(headings[h.textContent])h.textContent=headings[h.textContent];else {const n=d.createElement('h3');n.innerHTML=h.innerHTML;h.replaceWith(n);}}
 const pics=['01-harness-garage-v2','02-inference-v2','03-rl-v1','04-speed-plateau-v2'];
 d.querySelector('#fig-hero').remove();
 [...d.querySelectorAll('h2')].forEach((h,i)=>{const fig=d.createElement('figure');fig.className='hero';fig.innerHTML=`<img src="arc3-solution-draft/${pics[i]}-corners-only.png" alt="${['The game-playing harness','The inference stack','The reinforcement-learning pipeline','The Turducken stalls at its 56.02 plateau while Tufa Labs and Yi-Chia Chen fly far above and NVARC and XZ climb past it'][i]}" loading="lazy">`;h.after(fig);});
 const p=d.querySelector('main > p');p.innerHTML=p.innerHTML.replace('thank you.','thank you—and thank you to the organizers for the generous free RTX compute.');
 const close=[...d.querySelectorAll('p')].find(p=>p.textContent.startsWith('Thanks for reading'));close.innerHTML+=' It has been an honor for us to compete with everyone.';
 const regret=[...d.querySelectorAll('h3')].find(h=>h.textContent.startsWith('4.3'));
 const extra=d.createElement('p');extra.textContent='We should also have ablated backward: withdraw optimizations one at a time to see which capacity or precision was worth restoring for fewer, better tokens. And our objective narrowed our search. Because nearby tests beyond 32 lanes scored worse, we never tried the radical 110-lane regime ourselves. That remained an untested alternative for our stack, not a demonstrated failure.';regret.before(extra);
 const tested=[...d.querySelectorAll('p')].find(p=>p.textContent.includes('copycats tracked Kaggle best'));
 const games=d.createElement('p');games.innerHTML='Our custom-game effort also produced <a href="https://arc.markbarney.net/arc3/games">Mark’s authored game collection</a>. A correlation on a small retrospective sample did not make our board a reliable gate: it repeatedly liked packages that lost on Kaggle.';tested.after(games);
 const setup=d.createElement('div');setup.className='table-wrap';setup.innerHTML='<table><thead><tr><th>56.02 setup</th><th>Value</th></tr></thead><tbody>'+[['Context window','140k tokens (original draft’s rounded label)'],['History kept after trim','Approximately 52k tokens'],['Games admitted / decoding','34 / 32'],['History cache','NVFP4 · 3.80M tokens'],['Host cache copy','24 GB'],['Temperature / top-p / top-k','0.5 / 0.95 / 20'],['Experts kept','341 of 512 per layer'],['Drafter','MTP · 4 draft steps · per-game verify depth']].map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 d.querySelector('#fig-box').after(setup);
 const nav=d.createElement('nav');nav.innerHTML='<a href="/">ARC Explainer</a> · <a href="arc3-solution-draft/article-draft.md" download>Markdown</a> · <a href="arc3-solution-draft/charts/original/source-data.json" download>Original chart data</a>';d.querySelector('main').prepend(nav);
 const note=d.createElement('p');note.className='byline';note.textContent='Review draft · Original Claude artifact restored · Static charts, no animation. Author-reported measurements from the original draft; not newly reproduced benchmarks.';nav.after(note);
 const css=d.createElement('style');css.textContent='*{animation:none!important;transition:none!important;scroll-behavior:auto!important}svg,img{max-width:100%;height:auto} .chart{overflow:visible}.chart img{display:block;width:100%}details{margin:12px 0} .table-wrap{overflow-x:auto}figure.hero{padding:0;border:0;background:none}figure.hero img{border-radius:0}body{font-family:system-ui,sans-serif}h1,h2,h3{font-family:Georgia,serif}nav{font-size:14px;margin-bottom:18px}';d.head.append(css);
 d.querySelector('meta[name="viewport"]').after(Object.assign(d.createElement('meta'),{name:'robots',content:'noindex'}));
 // Keep numerical tables visible in Markdown; HTML disclosures remain usable without JavaScript.
 fs.writeFileSync(path.join(S,'2026-11-06-arc3-solution-draft.html'),'<!doctype html>\n<!-- Author: GPT-6.1 Sol; Date: 06-November-2026; PURPOSE: Restore Son’s original article with static original charts. SRP/DRY check: Pass — original renderer reused offline. -->\n'+d.documentElement.outerHTML);
 const main=d.querySelector('main').cloneNode(true);main.querySelectorAll('nav').forEach(x=>x.remove());
 const md=(node)=>{if(node.nodeType===3)return node.textContent; if(node.nodeType!==1)return '';const tag=node.tagName.toLowerCase(),v=[...node.childNodes].map(md).join('');if(/^h[123]$/.test(tag))return '\n\n'+'#'.repeat(+tag[1])+' '+v+'\n\n';if(tag==='img')return `\n\n![${node.alt}](${node.getAttribute('src').replace('arc3-solution-draft/','')})\n\n`;if(tag==='a')return `[${v}](${node.getAttribute('href').replace('arc3-solution-draft/','')})`;if(tag==='strong'||tag==='b')return '**'+v+'**';if(tag==='code')return '`'+v+'`';if(tag==='li')return '\n- '+v.trim();if(tag==='table'){const rows=[...node.querySelectorAll('tr')].map(r=>[...r.children].map(c=>c.textContent.trim().replace(/\|/g,'/').replace(/\s+/g,' ')));return '\n\n'+rows.map((r,i)=>'| '+r.join(' | ')+' |'+(i===0?'\n| '+r.map(()=> '---').join(' | ')+' |':'')).join('\n')+'\n\n';}if(['p','div','figure','ul','ol','figcaption','details'].includes(tag))return '\n\n'+v+'\n\n';if(tag==='summary')return '\n\n**Chart data**\n\n';return v;};
 fs.writeFileSync(path.join(R,'article-draft.md'),md(main).replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim()+'\n');
 fs.copyFileSync(path.join(R,'article-draft.md'),path.join(A,'article-draft.md'));
 fs.cpSync(O,path.join(A,'charts','original'),{recursive:true});
 console.log(JSON.stringify({pngs:fs.readdirSync(O).filter(f=>f.endsWith('.png')),h2:[...d.querySelectorAll('h2')].map(h=>h.textContent),scripts:d.scripts.length,videos:d.querySelectorAll('video').length}));
}
run().catch(e=>{console.error(e);process.exit(1)});

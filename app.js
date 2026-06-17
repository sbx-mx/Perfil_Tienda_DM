const D=window.PERFIL_DATA;
let mode='tienda', current=null, charts={}, mixMonth='YTD', optionItems=[];

const $=id=>document.getElementById(id);
const months=D.months;
const monthShort=months.map(m=>m.slice(0,3));
const directory=D.directory||[];
function normText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
const byCeco=Object.fromEntries(directory.map(d=>[String(d.ceco),d]));
const pctMetrics=new Set(['Rolling RY','Rolling RY AA','Labor','Labor PPTO','VMT%','VMT AA','OMT%','OMT AA','Conexion','Conexion AA','Calidad de la Bebida','Calidad de Bebida AA','Food Attach','Food Attach AA','SR','% SR AA','Venta Delivery','Delivery AA','Costo %','Costo % PPTO','EBITDA','EBITDA PPTO','ctc']);

function valid(v){return v!==null&&v!==undefined&&v!==''&&!Number.isNaN(Number(v));}
function avg(a){const x=a.filter(valid).map(Number);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
function sum(a){const x=a.filter(valid).map(Number);return x.length?x.reduce((s,v)=>s+v,0):null;}
function fmt(v,type='num'){
  if(!valid(v))return '—'; v=Number(v);
  if(type==='moneyM')return '$'+(v/1000000).toFixed(1)+'M';
  if(type==='moneyK')return '$'+(v/1000).toFixed(0)+'K';
  if(type==='money')return '$'+(Math.abs(v)>=1000000?(v/1000000).toFixed(1)+'M':Math.abs(v)>=1000?(v/1000).toFixed(0)+'K':v.toFixed(0));
  if(type==='ticket')return '$'+v.toFixed(1);
  if(type==='pct')return (v*100).toFixed(1)+'%';
  if(type==='pp')return (v*100>=0?'+':'')+(v*100).toFixed(1);
  if(type==='sec')return sec(v);
  return Math.abs(v)%1?Number(v).toFixed(1):String(Math.round(v));
}
function sec(v){if(!valid(v))return '—';let n=Math.abs(Number(v));let s=n>0&&n<1?Math.round(n*86400):Math.round(n);let h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;return h>0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;}
function toSeconds(v){if(!valid(v))return null;let n=Number(v);return Math.abs(n)>0&&Math.abs(n)<1?n*86400:n;}
function fmtDate(v){if(!v)return '—';const s=String(v).trim();let d=null;if(/^\d{4}-\d{2}-\d{2}/.test(s)){const [y,m,day]=s.slice(0,10).split('-');return `${day}/${m}/${y}`;}if(/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)){let [day,m,y]=s.split(/[\/ ]/);if(y.length===2)y='20'+y;return `${String(day).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;}d=new Date(s);return isNaN(d)?s:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;}
function cls(v,inverse=false){if(!valid(v))return'neutral';return (inverse?Number(v)<=0:Number(v)>=0)?'pos':'neg';}
function cleanLabel(s){return String(s||'').replace(/_/g,' ').trim();}
function destroy(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function makeChart(id,config){destroy(id);const ctx=$(id);if(ctx)charts[id]=new Chart(ctx,config);}
function yTick(v,type){
  if(type==='pct')return (v*100).toFixed(0)+'%';
  if(type==='pp')return (v*100).toFixed(0);
  if(type==='moneyM')return '$'+(v/1000000).toFixed(1)+'M';
  if(type==='moneyK')return '$'+(v/1000).toFixed(0)+'K';
  if(type==='ticket')return '$'+Number(v).toFixed(0);
  if(type==='sec')return sec(v);
  return Math.abs(v)%1?Number(v).toFixed(1):v;
}
function chartOpt(type){return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:16,usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw,type)}`}}},scales:{y:{beginAtZero:false,ticks:{maxTicksLimit:6,callback:v=>yTick(v,type)}},x:{grid:{display:false}}}};}
function resolveSelection(){
  const raw=$('selector').value.trim();
  if(mode==='tienda'){
    const c=(raw.match(/^\s*(\d{5})/)||[])[1];
    if(c&&byCeco[c])return c;
    const match=directory.find(d=>d.tienda.toLowerCase()===raw.toLowerCase())||directory.find(d=>raw.toLowerCase().includes(d.tienda.toLowerCase()));
    return match?String(match.ceco):null;
  }
  return raw;
}
function scopeCecos(){
  if(mode==='tienda')return current?[String(current)]:[];
  if(mode==='dm')return directory.filter(x=>x.dm===current).map(x=>String(x.ceco));
  return directory.filter(x=>x.rd===current).map(x=>String(x.ceco));
}
function scopeDMs(){
  if(mode==='dm')return [current];
  if(mode==='rd')return [...new Set(directory.filter(x=>x.rd===current).map(x=>x.dm).filter(Boolean))];
  const d=byCeco[current]; return d&&d.dm?[d.dm]:[];
}
function rowsByCeco(source,cecos){const set=new Set(cecos.map(String));return (source||[]).filter(r=>set.has(String(r.ceco)));}
function rowsByDM(source,dms){const set=new Set((dms||[]).map(normText));return (source||[]).filter(r=>set.has(normText(r.dm)));}
function groupByMonth(source,metric,agg='avg',key='ceco'){
  const rows=key==='dm'?rowsByDM(source,scopeDMs()):rowsByCeco(source,scopeCecos());
  const out=[]; for(let m=1;m<=12;m++){const vals=rows.filter(r=>r.m===m).map(r=>r[metric]);out.push(agg==='sum'?sum(vals):avg(vals));} return out;
}
function closedMaxMonth(){
  const base=[...(D.venta||[]),...(D.pcs||[]),...(D.adt||[]),...(D.ticket||[])].map(x=>x.m).filter(Boolean);
  const m=Math.max(...base);
  return isFinite(m)?m:12;
}
function closedSource(source){const max=closedMaxMonth();return (source||[]).filter(r=>!r.m||r.m<=max);}
function selectedLabel(){
  if(mode==='tienda'){const d=byCeco[current]||{};return `${d.ceco||current} · ${d.tienda||current}`;}
  return current||'';
}
function setSelectorValue(v,auto=false){$('selector').value=v||''; if(auto)applySelection();}
function exportPDF(){
  const label=String(mode==='tienda'?(byCeco[current]?.tienda||current):current||'Perfil').replace(/[\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim();
  const period=($('periodo')?.textContent||'YTD').replace(/\s*·\s*/g,'_').replace(/\s+/g,'_');
  document.title=`Perfil_${mode.toUpperCase()}_${label}_${period}`;
  window.print();
}
function latest(vals){for(let i=vals.length-1;i>=0;i--)if(valid(vals[i]))return vals[i];return null;}
function ytd(vals,agg='avg'){return agg==='sum'?sum(vals):avg(vals);}
function monthlyDiff(base,compare,mode='minus'){return base.map((v,i)=>valid(v)&&valid(compare[i])?(mode==='aaMinus'?compare[i]-v:v-compare[i]):null);}
function chartCard(cfg){
  const id='c'+Math.random().toString(36).slice(2);
  const vals=groupByMonth(cfg.source,cfg.metric,cfg.agg||'avg',cfg.key||'ceco');
  const type=cfg.type||(pctMetrics.has(cfg.metric)?'pct':'num');
  const k=cfg.ytd===false?latest(vals):(cfg.ytdAgg==='avg'?avg(vals):ytd(vals,cfg.agg||'avg'));
  let diffs=null,diffY=null;
  if(cfg.diffMetric){const comp=groupByMonth(cfg.source,cfg.diffMetric,cfg.diffAgg||cfg.agg||'avg',cfg.key||'ceco');diffs=monthlyDiff(vals,comp,cfg.diffMode);diffY=avg(diffs);}
  else if(cfg.diffSourceMetric){diffs=groupByMonth(cfg.diffSource||cfg.source,cfg.diffSourceMetric,cfg.diffAgg||'avg',cfg.diffKey||cfg.key||'ceco');diffY=avg(diffs);}
  const diffType=cfg.diffType||type;
  const chips=(diffs||[]).map((d,i)=>valid(d)?`<span class="pill ${cls(d,cfg.inverseDiff)}">${monthShort[i]} ${fmt(cfg.diffAbs?Math.abs(d):d,diffType)}</span>`:'').join('');
  const html=`<article class="card"><div class="card-head"><div><h3>${cfg.title}</h3><div class="note">${cfg.subtitle||'Tendencia mensual + YTD'}</div></div><div><div class="kpi">${fmt(k,type)}</div><div class="note">${cfg.ytd===false?'Último dato':'YTD'}</div></div></div><div class="canvas-wrap"><canvas id="${id}"></canvas></div>${valid(diffY)?`<span class="pill ${cls(diffY,cfg.inverseDiff)}">Dif YTD ${fmt(cfg.diffAbs?Math.abs(diffY):diffY,diffType)}</span>`:''}${diffs?`<div class="pill-row">${chips}</div>`:''}</article>`;
  setTimeout(()=>{const ds=[{label:cfg.title,data:vals,type:cfg.bar?'bar':'line',tension:.35,fill:false,borderWidth:3,pointRadius:3,borderColor:'#00754a',backgroundColor:'rgba(0,117,74,.16)'}];if(diffs)ds.push({label:'Dif',data:diffs.map(x=>cfg.diffAbs&&valid(x)?Math.abs(x):x),type:'bar',borderWidth:0,backgroundColor:'rgba(0,117,74,.14)'});makeChart(id,{type:cfg.bar?'bar':'line',data:{labels:monthShort,datasets:ds},options:chartOpt(type)});},0);
  return html;
}
function compareCard(title,source,a,b,opt={}){
  const id='c'+Math.random().toString(36).slice(2);
  const va=groupByMonth(source,a,opt.agg||'avg'), vb=groupByMonth(source,b,opt.agg||'avg'), d=monthlyDiff(va,vb);
  const type=opt.type||'pct', y=ytd(va,opt.agg||'avg'), yb=ytd(vb,opt.agg||'avg'), yd=valid(y)&&valid(yb)?y-yb:null;
  const chips=d.map((x,i)=>valid(x)?`<span class="pill ${cls(x,opt.inverseDiff)}">${monthShort[i]} ${fmt(x,opt.diffType||type)}</span>`:'').join('');
  const html=`<article class="card"><div class="card-head"><div><h3>${title}</h3><div class="note">Real vs referencia</div></div><div><div class="kpi">${fmt(y,type)}</div><div class="note">Ref ${fmt(yb,type)}</div></div></div><div class="canvas-wrap"><canvas id="${id}"></canvas></div>${valid(yd)?`<span class="pill ${cls(yd,opt.inverseDiff)}">Dif ${fmt(yd,opt.diffType||type)}</span>`:''}<div class="pill-row">${chips}</div></article>`;
  setTimeout(()=>makeChart(id,{type:'line',data:{labels:monthShort,datasets:[{label:'Real',data:va,tension:.35,borderWidth:3,borderColor:'#00754a'},{label:'Referencia',data:vb,tension:.35,borderWidth:2,borderColor:'#8b6f47'},{label:'Dif',data:d,type:'bar',backgroundColor:'rgba(0,117,74,.14)'}]},options:chartOpt(type)}),0);
  return html;
}
function setMode(m){
  mode=m;
  ['Tienda','DM','RD'].forEach(x=>$('tab'+x).classList.toggle('active',m===x.toLowerCase()));
  $('selector').placeholder=m==='tienda'?'Buscar o elige tienda por CeCo / nombre...':m==='dm'?'Buscar o elige DM...':'Buscar o elige RD...';
  fillOptions();
  applySelection();
}
function fillOptions(){
  if(mode==='tienda')optionItems=directory.map(d=>`${d.ceco} · ${d.tienda}`).sort();
  if(mode==='dm')optionItems=[...new Set(directory.map(x=>x.dm).filter(Boolean))].sort();
  if(mode==='rd')optionItems=[...new Set(directory.map(x=>x.rd).filter(Boolean))].sort();
  $('options').innerHTML=optionItems.map(x=>`<option value="${x}"></option>`).join('');
  const sel=$('selectorSelect');
  if(sel){sel.innerHTML=optionItems.map(x=>`<option value="${x}">${x}</option>`).join('');}
  if(!optionItems.includes($('selector').value))$('selector').value=optionItems[0]||'';
  if(sel)sel.value=$('selector').value;
  fillMonthFilter();
}
function fillMonthFilter(){const sel=$('mixMonth');if(!sel)return;sel.innerHTML=`<option value="YTD">YTD</option>`+months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');sel.value=mixMonth;}
function applySelection(){current=resolveSelection(); const sel=$('selectorSelect'); if(sel&&optionItems.includes($('selector').value))sel.value=$('selector').value; if(current)render();}
function period(){const all=[...rowsByCeco(D.pcs,scopeCecos()),...rowsByCeco(D.venta,scopeCecos()),...rowsByCeco(D.adt,scopeCecos()),...rowsByCeco(D.ticket,scopeCecos())].map(x=>x.m).filter(Boolean);let a=Math.min(...all),b=Math.max(...all);$('periodo').textContent=(isFinite(a)?months[a-1]:'Mes inicio')+' a '+(isFinite(b)?months[b-1]:'Último dato')+' · YTD';}
function baseItem(k,v){return `<div class="base-item"><small>${k}</small><b>${v||'—'}</b></div>`;}
function countMap(arr){const o={};arr.filter(Boolean).forEach(x=>o[x]=(o[x]||0)+1);return o;}
function topCount(o){const e=Object.entries(o).sort((a,b)=>b[1]-a[1])[0];return e?`${e[0]} · ${e[1]}`:'—';}
function renderTypeBars(rows){if(mode==='tienda'){$('typeVisualCard').classList.add('hidden');return;}$('typeVisualCard').classList.remove('hidden');const counts=countMap(rows.map(x=>x.tipo5));const max=Math.max(...Object.values(counts),1);$('typeBars').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div class="type-row"><span title="${k}">${k}</span><div class="type-bar"><span style="width:${(v/max*100).toFixed(0)}%"></span></div><b>${v}</b></div>`).join('');}
function renderBase(){const cecos=scopeCecos(), rows=directory.filter(x=>cecos.includes(String(x.ceco))), d=rows[0]||{};if(mode==='tienda'){$('baseGrid').innerHTML=[['Apertura',fmtDate(d.apertura)],['Tipo tienda 5',d.tipo5],['DM',d.dm],['Región',d.region],['Tier',d.tier],['Seating',`${d.seating||'—'}${d.seats_num!=null?' · '+d.seats_num:''}`]].map(x=>baseItem(x[0],x[1])).join('');$('staffCard').classList.remove('hidden');loadStaff();}else{const types=countMap(rows.map(x=>x.tipo5)), seating=countMap(rows.map(x=>x.seating)), tiers=countMap(rows.map(x=>x.tier));$('baseGrid').innerHTML=[['# tiendas',rows.length],['Tipo principal',topCount(types)],['Seating',topCount(seating)],['Tier principal',topCount(tiers)],['Región',mode==='rd'?[...new Set(rows.map(x=>x.region))].join(', '):[...new Set(rows.map(x=>x.region))].join(', ')],['División',[...new Set(rows.map(x=>x.division))].join(', ')]].map(x=>baseItem(x[0],x[1])).join('');$('staffCard').classList.add('hidden');}renderTypeBars(rows);}
function renderMixOnly(){mixMonth=$('mixMonth').value;renderMix();}
function renderMix(){const rows=rowsByCeco(D.mix,scopeCecos()).filter(x=>mixMonth==='YTD'||x.m===Number(mixMonth));const order={},cat={};rows.forEach(r=>{Object.entries(r.order||{}).forEach(([k,v])=>order[k]=(order[k]||0)+v);Object.entries(r.category||{}).forEach(([k,v])=>cat[k]=(cat[k]||0)+v);});const n=Math.max(rows.length,1);Object.keys(order).forEach(k=>order[k]/=n);Object.keys(cat).forEach(k=>cat[k]/=n);iconCards('orderIconCards',order,'order');iconCards('categoryIconCards',cat,'cat');dough('chartOrder',order);dough('chartCategory',cat);}
function iconFor(k,type){const s=k.toLowerCase();if(type==='order'){if(s.includes('drive'))return'DT';if(s.includes('pick')||s.includes('delivery'))return'PD';if(s.includes('lobby'))return'LB';}else{if(s.includes('filtrado')||s.includes('café')||s.includes('cafe'))return'CF';if(s.includes('espresso'))return'ESP';if(s.includes('food'))return'FD';if(s.includes('cbs'))return'CBS';if(s.includes('otro'))return'OT';}return'•';}
function mixColor(k,i,type){
  const s=normText(k);
  const order={'DRIVE THRU':'#006241','LOBBY':'#8B6F47','PICK UP DELIVERY':'#00A862','PICK UP DEL':'#00A862'};
  const cat={'CAFE FILTRADO':'#6F4E37','CBS':'#00754A','ESPRESSO':'#CBA258','FOOD':'#D4E9E2','OTRO':'#1E3932'};
  const pal=['#006241','#8B6F47','#00A862','#CBA258','#1E3932','#D4E9E2'];
  if(type==='order'){
    if(s.includes('DRIVE'))return order['DRIVE THRU'];
    if(s.includes('LOBBY'))return order.LOBBY;
    if(s.includes('PICK')||s.includes('DELIVERY'))return order['PICK UP DELIVERY'];
  }else{
    if(s.includes('FILTRADO')||s.includes('CAFE'))return cat['CAFE FILTRADO'];
    if(s.includes('CBS'))return cat.CBS;
    if(s.includes('ESPRESSO'))return cat.ESPRESSO;
    if(s.includes('FOOD'))return cat.FOOD;
    if(s.includes('OTRO'))return cat.OTRO;
  }
  return pal[i%pal.length];
}
function iconCards(id,obj,type){
  let entries=Object.entries(obj).filter(([k,v])=>valid(v)&&v>0);
  if(type==='cat'){
    const required=['Café filtrado','CBS','Espresso','Food','Otro'];
    required.forEach(k=>{if(!entries.some(([e])=>normText(e)===normText(k)))entries.push([k,0]);});
  }
  entries=entries.sort((a,b)=>b[1]-a[1]);
  $(id).innerHTML=entries.map(([k,v],i)=>`<div class="icon-card"><span class="icon-badge" style="background:${mixColor(k,i,type)}">${iconFor(k,type)}</span><div><b>${cleanLabel(k)}</b><small>${fmt(v,'pct')}</small></div></div>`).join('')||'<div class="note">Sin data disponible</div>';
}
function dough(id,obj){const labels=Object.keys(obj).filter(k=>valid(obj[k])&&obj[k]>0),vals=labels.map(k=>obj[k]);makeChart(id,{type:'doughnut',data:{labels,datasets:[{data:vals,borderWidth:2,backgroundColor:labels.map((k,i)=>mixColor(k,i,id==='chartOrder'?'order':'cat'))}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.raw,'pct')}`}}}}});}
function metricValue(source,metric,agg='avg',key='ceco'){return ytd(groupByMonth(source,metric,agg,key),agg);}function metricDiff(source,a,b,inverse=false){const va=groupByMonth(source,a),vb=groupByMonth(source,b),d=avg(monthlyDiff(va,vb));return {raw:d,score:valid(d)?(inverse?-d:d):null};}
function status(metric,value,diff){if(metric==='conexion')return value>=.60?'good':value>=.55?'warn':'bad';if(metric==='bebida')return value>=.71?'good':value>=.65?'warn':'bad';if(metric==='labor'||metric==='costo'||metric==='dt')return valid(diff)&&diff<=0?'good':'bad';if(metric==='ebitda')return valid(diff)&&diff>=0?'good':'bad';return 'good';}
function insightFmt(name,raw){
  if(name==='DT')return sec(Math.abs(toSeconds(raw)||0));
  return fmt(raw,'pp')+' pp';
}
function renderExecutive(){
  const ctcSrc=closedSource(mode==='tienda'?D.ctc:D.ctc_dm);
  const conn=metricValue(D.pcs,'Conexion'), beb=metricValue(D.pcs,'Calidad de la Bebida'), labor=metricValue(D.pcs,'Labor'), ebitda=metricValue(D.pcs,'EBITDA');
  const aws=avg(groupByMonth(D.venta,'aws','avg'));
  const ctcVal=mode==='tienda'?metricValue(ctcSrc,'ctc'):metricValue(ctcSrc,'ctc','avg','dm');
  const dl=metricDiff(D.pcs,'Labor','Labor PPTO',true).raw, de=metricDiff(D.pcs,'EBITDA','EBITDA PPTO').raw;
  const kpis=[['Conexión',fmt(conn,'pct'),status('conexion',conn),'Experiencia'],['Bebida',fmt(beb,'pct'),status('bebida',beb),'Calidad'],['Labor',fmt(labor,'pct'),status('labor',labor,dl),'Vs ppto'],['EBITDA',fmt(ebitda,'pct'),status('ebitda',ebitda,de),'Vs ppto'],['AWS',fmt(aws,'moneyK'),'good','Venta semanal'],['CTC',fmt(ctcVal,'pct'),'good','Cada Taza Cuenta']];
  const items=[['Conexión',metricDiff(D.pcs,'Conexion','Conexion AA')],['Bebida',metricDiff(D.pcs,'Calidad de la Bebida','Calidad de Bebida AA')],['Food Attach',metricDiff(D.pcs,'Food Attach','Food Attach AA')],['SR',metricDiff(D.pcs,'SR','% SR AA')],['Labor',metricDiff(D.pcs,'Labor','Labor PPTO',true)],['Costo',metricDiff(D.pcs,'Costo %','Costo % PPTO',true)],['EBITDA',metricDiff(D.pcs,'EBITDA','EBITDA PPTO')],['DT',metricDiff(D.pcs,'DT Time','Tiempo DT AA',true)]];
  const good=items.filter(x=>valid(x[1].score)&&x[1].score>0).sort((a,b)=>b[1].score-a[1].score).slice(0,3);
  const risk=items.filter(x=>valid(x[1].score)&&x[1].score<0).sort((a,b)=>a[1].score-b[1].score).slice(0,3);
  $('executivePanel').innerHTML=`<div class="exec-title"><div><h2>Resumen Ejecutivo</h2><p class="note">Lectura rápida para toma de decisiones</p></div><span class="pill neutral">${scopeCecos().length} tienda(s)</span></div><div class="exec-grid">${kpis.map(k=>`<div class="exec-kpi"><small>${k[0]}</small><b>${k[1]}</b><span class="status ${k[2]}">${k[3]}</span></div>`).join('')}</div><div class="insight-grid"><div class="insight-box"><h4>Fortalezas</h4><ul>${good.length?good.map(x=>`<li>${x[0]} · ${insightFmt(x[0],x[1].raw)}</li>`).join(''):'<li>Sin variaciones positivas relevantes</li>'}</ul></div><div class="insight-box"><h4>Oportunidades</h4><ul>${risk.length?risk.map(x=>`<li>${x[0]} · ${insightFmt(x[0],x[1].raw)}</li>`).join(''):'<li>Sin alertas críticas con datos disponibles</li>'}</ul></div></div>`;
}


function dtCompareCard(){
  const id='c'+Math.random().toString(36).slice(2);
  const dtRaw=groupByMonth(D.pcs,'DT Time');
  const aaRaw=groupByMonth(D.pcs,'Tiempo DT AA');
  const dt=dtRaw.map(toSeconds), aa=aaRaw.map(toSeconds);
  const dif=dt.map((v,i)=>valid(v)&&valid(aa[i])?Math.abs(v-aa[i]):null);
  const state=dt.map((v,i)=>valid(v)&&valid(aa[i])?v<=aa[i]:null);
  const yDt=avg(dt), yAa=avg(aa), yDif=valid(yDt)&&valid(yAa)?Math.abs(yDt-yAa):null;
  const better=valid(yDt)&&valid(yAa)?yDt<=yAa:null;
  const chips=dif.map((x,i)=>valid(x)?`<span class="pill ${state[i]?'pos':'neg'}">${monthShort[i]} ${sec(x)}</span>`:'').join('');
  const html=`<article class="card"><div class="card-head"><div><h3>DT Time</h3><div class="note">DT vs AA · menor tiempo es verde</div></div><div><div class="kpi ${better?'':'neg-text'}">${sec(yDt)}</div><div class="note">Promedio YTD</div></div></div><div class="dt-summary"><span class="pill neutral">DT ${sec(yDt)}</span><span class="pill neutral">AA ${sec(yAa)}</span><span class="pill ${better?'pos':'neg'}">Dif ${sec(yDif)}</span></div><div class="canvas-wrap"><canvas id="${id}"></canvas></div><div class="pill-row">${chips}</div></article>`;
  setTimeout(()=>makeChart(id,{type:'line',data:{labels:monthShort,datasets:[{label:'DT Time',data:dt,tension:.35,borderWidth:3,borderColor:'#006241',pointRadius:3},{label:'DT AA',data:aa,tension:.35,borderWidth:2,borderColor:'#8B6F47',pointRadius:3},{label:'Dif seg',data:dif,type:'bar',backgroundColor:state.map(v=>v===null?'rgba(216,208,196,.25)':v?'rgba(0,117,74,.18)':'rgba(194,65,12,.18)'),borderWidth:0}]},options:chartOpt('sec')}),0);
  return html;
}


function renderSections(){ $('partnerGrid').innerHTML=chartCard({title:'Rolling RY',source:D.pcs,metric:'Rolling RY',ytd:false,diffMetric:'Rolling RY AA',diffMode:'aaMinus',diffType:'pp',subtitle:'12M atrás · objetivo <30%'})+chartCard({title:'IPLH',source:D.pcs,metric:'IPLH'})+chartCard({title:'TPLH',source:D.pcs,metric:'TPLH'})+chartCard({title:'Labor %',source:D.pcs,metric:'Labor',diffMetric:'Labor PPTO',diffType:'pp',inverseDiff:true,subtitle:'Menor a presupuesto es ahorro'})+chartCard({title:'ICA Score',source:D.pcs,metric:'ICA Score',type:'num',bar:true,subtitle:'Auditorías disponibles'});$('customerGrid').innerHTML=chartCard({title:'Venta Mes',source:D.venta,metric:'venta_mes',type:'moneyM',agg:'sum',bar:true,subtitle:'Venta mensual'})+chartCard({title:'AWS',source:D.venta,metric:'aws',type:'moneyK',agg:'avg',ytdAgg:'avg',bar:true,subtitle:'Average Weekly Sales'})+chartCard({title:'ADT',source:D.adt,metric:'adt',type:'num',diffSourceMetric:'adt_diff',diffType:'num',subtitle:'ADT real + dif vs AA'})+chartCard({title:'Ticket Promedio',source:D.ticket,metric:'ticket',type:'ticket',diffSourceMetric:'ticket_diff',diffSource:D.ticket,diffType:'pp',subtitle:'Ticket + dif vs AA'})+chartCard({title:'VMT',source:D.pcs,metric:'VMT%'})+chartCard({title:'OMT',source:D.pcs,metric:'OMT%'})+chartCard({title:'Conexión',source:D.pcs,metric:'Conexion',diffMetric:'Conexion AA',diffType:'pp'})+chartCard({title:'Calidad Bebida',source:D.pcs,metric:'Calidad de la Bebida',diffMetric:'Calidad de Bebida AA',diffType:'pp'})+chartCard({title:'Food Attach',source:D.pcs,metric:'Food Attach',diffMetric:'Food Attach AA',diffType:'pp'})+chartCard({title:'Segundas Ventas',source:D.pcs,metric:'Segundas Ventas',type:'num'})+chartCard({title:'SR',source:D.pcs,metric:'SR',diffMetric:'% SR AA',diffType:'pp'})+chartCard({title:'Cada Taza Cuenta',source:closedSource(mode==='tienda'?D.ctc:D.ctc_dm),metric:'ctc',type:'pct',key:mode==='tienda'?'ceco':'dm',subtitle:'Participación mensual'});$('businessGrid').innerHTML=compareCard('Venta Delivery',D.pcs,'Venta Delivery','Delivery AA',{type:'pct',diffType:'pp'})+compareCard('Costo %',D.pcs,'Costo %','Costo % PPTO',{inverseDiff:true,type:'pct',diffType:'pp'})+compareCard('EBITDA',D.pcs,'EBITDA','EBITDA PPTO',{type:'pct',diffType:'pp'})+dtCompareCard();}
function render(){Object.keys(charts).forEach(destroy);const cecos=scopeCecos(), rows=directory.filter(x=>cecos.includes(String(x.ceco))), d=rows[0]||{};period();let title=current, sub='';if(mode==='tienda'){title=d.tienda||current;sub=`Gerente: ${d.gerente||'Vacante'}`;$('photoLabel').textContent='Colocar foto gerente';}else if(mode==='dm'){sub=`Región: ${[...new Set(rows.map(x=>x.region))].join(', ')}`;$('photoLabel').textContent='Colocar foto DM';}else{sub=`División: ${[...new Set(rows.map(x=>x.division))].join(', ')}`;$('photoLabel').textContent='Colocar foto RD';}$('profileName').textContent=title;$('profileSub').textContent=sub;renderBase();renderMix();renderExecutive();renderSections();restorePhoto();}
function photoKey(){return 'perfil_photo_v5_'+mode+'_'+current;}function loadPhoto(e){const f=e.target.files[0];if(!f||!current)return;const r=new FileReader();r.onload=()=>{localStorage.setItem(photoKey(),r.result);$('photoPreview').src=r.result;};r.readAsDataURL(f);}function resetPhoto(){if(current)localStorage.removeItem(photoKey());$('photoPreview').removeAttribute('src');}function restorePhoto(){const v=current&&localStorage.getItem(photoKey());if(v)$('photoPreview').src=v;else $('photoPreview').removeAttribute('src');}
function staffKey(){return 'staff_v5_'+current;}function saveStaff(){if(!current)return;localStorage.setItem(staffKey(),JSON.stringify({asm:$('staffASM').value,ss:$('staffSS').value,bb:$('staffBB').value}));}function loadStaff(){try{const v=JSON.parse(localStorage.getItem(staffKey())||'{}');$('staffASM').value=v.asm??1;$('staffSS').value=v.ss??1;$('staffBB').value=v.bb??3;}catch(e){}}
fillOptions();applySelection();

/* ================= Perfil RD · DM · Tienda 6.0 =================
   Ajustes finos: buscador intuitivo, AWS promedio semanal real,
   DT con lectura de mejora/oportunidad, ticket con eje de diferencia
   separado y resumen ejecutivo más consistente.
================================================================= */

function optionMeta(v){
  if(mode==='tienda'){
    const c=(String(v).match(/^\s*(\d{5})/)||[])[1];
    const d=byCeco[c]||{};
    return [d.dm,d.region].filter(Boolean).join(' · ');
  }
  if(mode==='dm'){
    const rows=directory.filter(x=>x.dm===v);
    const regs=[...new Set(rows.map(x=>x.region).filter(Boolean))].slice(0,2).join(', ');
    return `${rows.length} tienda(s)${regs?' · '+regs:''}`;
  }
  const rows=directory.filter(x=>x.rd===v);
  const divs=[...new Set(rows.map(x=>x.division).filter(Boolean))].join(', ');
  return `${rows.length} tienda(s)${divs?' · '+divs:''}`;
}
function showOptionPanel(){updateOptionPanel(true);}
function hideOptionPanel(){const p=$('optionsPanel'); if(p)p.classList.remove('open');}
function toggleOptionPanel(){const p=$('optionsPanel'); if(!p)return; if(p.classList.contains('open'))hideOptionPanel(); else showOptionPanel();}
function updateOptionPanel(force=false){
  const p=$('optionsPanel'); if(!p)return;
  const q=normText($('selector').value);
  const terms=q.split(' ').filter(Boolean);
  const scored=optionItems.map(v=>{
    const n=normText(v+' '+optionMeta(v));
    let score=terms.length?terms.reduce((s,t)=>s+(n.includes(t)?1:0),0):1;
    if(q&&n.startsWith(q))score+=3;
    if(q&&n.includes(q))score+=2;
    return {v,score};
  }).filter(x=>force||!q||x.score>0).sort((a,b)=>b.score-a.score||a.v.localeCompare(b.v)).slice(0,60);
  if(!scored.length){p.innerHTML='<div class="option-empty">Sin coincidencias. Intenta con CeCo, tienda, DM o RD.</div>';p.classList.add('open');return;}
  p.innerHTML=scored.map((x,i)=>`<div class="option-row ${i===0?'active':''}" data-value="${String(x.v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" onclick="chooseOption(this.dataset.value)"><span>${x.v}</span><small>${optionMeta(x.v)}</small></div>`).join('');
  p.classList.add('open');
}
function chooseOption(v){$('selector').value=v;hideOptionPanel();applySelection();}
function handleSearchKey(e){
  const p=$('optionsPanel');
  if(e.key==='Enter'){e.preventDefault();const a=p?.querySelector('.option-row.active')||p?.querySelector('.option-row'); if(a)chooseOption(a.dataset.value); else applySelection();return;}
  if(!p||!p.classList.contains('open'))return;
  const rows=[...p.querySelectorAll('.option-row')]; if(!rows.length)return;
  let i=rows.findIndex(r=>r.classList.contains('active'));
  if(e.key==='ArrowDown'){e.preventDefault();rows[i]?.classList.remove('active');i=(i+1+rows.length)%rows.length;rows[i].classList.add('active');rows[i].scrollIntoView({block:'nearest'});}
  if(e.key==='ArrowUp'){e.preventDefault();rows[i]?.classList.remove('active');i=(i-1+rows.length)%rows.length;rows[i].classList.add('active');rows[i].scrollIntoView({block:'nearest'});}
  if(e.key==='Escape')hideOptionPanel();
}
document.addEventListener('click',e=>{if(!$('smartSearch')?.contains(e.target))hideOptionPanel();});

function fillOptions(){
  if(mode==='tienda')optionItems=directory.map(d=>`${d.ceco} · ${d.tienda}`).sort((a,b)=>a.localeCompare(b,'es'));
  if(mode==='dm')optionItems=[...new Set(directory.map(x=>x.dm).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  if(mode==='rd')optionItems=[...new Set(directory.map(x=>x.rd).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const dl=$('options'); if(dl)dl.innerHTML=optionItems.map(x=>`<option value="${x}"></option>`).join('');
  if(!optionItems.includes($('selector').value))$('selector').value=optionItems[0]||'';
  fillMonthFilter();
  updateOptionPanel(false);
}
function applySelection(){current=resolveSelection(); hideOptionPanel(); if(current)render();}
function setMode(m){
  mode=m;
  ['Tienda','DM','RD'].forEach(x=>$('tab'+x).classList.toggle('active',m===x.toLowerCase()));
  $('selector').placeholder=m==='tienda'?'Busca por CeCo o nombre de tienda...':m==='dm'?'Busca por nombre de DM...':'Busca por nombre de RD...';
  fillOptions(); applySelection();
}

function daysInMonthNum(m){return [31,28,31,30,31,30,31,31,30,31,30,31][m-1]||30;}
function monthlySales(){return groupByMonth(D.venta,'venta_mes','sum');}
function awsSeries(){return monthlySales().map((v,i)=>valid(v)?(v/daysInMonthNum(i+1))*7:null);}
function awsYTD(){return avg(awsSeries());}
function awsCard(){
  const id='c'+Math.random().toString(36).slice(2);
  const vals=awsSeries(), k=awsYTD();
  const html=`<article class="card"><div class="card-head"><div><h3>AWS</h3><div class="note">Average Weekly Sales</div></div><div><div class="kpi">${fmt(k,'moneyK')}</div><div class="note">Promedio semanal YTD</div></div></div><div class="canvas-wrap"><canvas id="${id}"></canvas></div></article>`;
  setTimeout(()=>makeChart(id,{type:'bar',data:{labels:monthShort,datasets:[{label:'AWS',data:vals,borderColor:'#00754a',backgroundColor:'rgba(0,117,74,.16)',borderWidth:2}]},options:chartOpt('moneyK')}),0);
  return html;
}

function chartOptV6(type,hasDiff=false,diffType='pp'){
  const base=chartOpt(type);
  if(hasDiff){
    base.scales.y1={position:'right',display:false,grid:{display:false},ticks:{callback:v=>yTick(v,diffType)}};
  }
  return base;
}
function chartCard(cfg){
  const id='c'+Math.random().toString(36).slice(2);
  const vals=groupByMonth(cfg.source,cfg.metric,cfg.agg||'avg',cfg.key||'ceco');
  const type=cfg.type||(pctMetrics.has(cfg.metric)?'pct':'num');
  const k=cfg.ytd===false?latest(vals):(cfg.ytdAgg==='avg'?avg(vals):ytd(vals,cfg.agg||'avg'));
  let diffs=null,diffY=null;
  if(cfg.diffMetric){const comp=groupByMonth(cfg.source,cfg.diffMetric,cfg.diffAgg||cfg.agg||'avg',cfg.key||'ceco');diffs=monthlyDiff(vals,comp,cfg.diffMode);diffY=avg(diffs);}
  else if(cfg.diffSourceMetric){diffs=groupByMonth(cfg.diffSource||cfg.source,cfg.diffSourceMetric,cfg.diffAgg||'avg',cfg.diffKey||cfg.key||'ceco');diffY=avg(diffs);}
  const diffType=cfg.diffType||type;
  const chips=(diffs||[]).map((d,i)=>valid(d)?`<span class="pill ${cls(d,cfg.inverseDiff)}">${monthShort[i]} ${fmt(cfg.diffAbs?Math.abs(d):d,diffType)}${diffType==='pp'?' pp':''}</span>`:'').join('');
  const html=`<article class="card"><div class="card-head"><div><h3>${cfg.title}</h3><div class="note">${cfg.subtitle||'Tendencia mensual + YTD'}</div></div><div><div class="kpi">${fmt(k,type)}</div><div class="note">${cfg.ytd===false?'Último dato':'YTD'}</div></div></div><div class="canvas-wrap"><canvas id="${id}"></canvas></div>${valid(diffY)?`<span class="pill ${cls(diffY,cfg.inverseDiff)}">Dif YTD ${fmt(cfg.diffAbs?Math.abs(diffY):diffY,diffType)}${diffType==='pp'?' pp':''}</span>`:''}${diffs?`<div class="pill-row">${chips}</div>`:''}</article>`;
  setTimeout(()=>{const ds=[{label:cfg.title,data:vals,type:cfg.bar?'bar':'line',tension:.35,fill:false,borderWidth:3,pointRadius:3,borderColor:'#00754a',backgroundColor:'rgba(0,117,74,.16)',yAxisID:'y'}];if(diffs)ds.push({label:'Dif',data:diffs.map(x=>cfg.diffAbs&&valid(x)?Math.abs(x):x),type:'bar',borderWidth:0,backgroundColor:diffs.map(x=>cls(x,cfg.inverseDiff)==='pos'?'rgba(0,117,74,.14)':'rgba(194,65,12,.14)'),yAxisID:'y1'});makeChart(id,{type:cfg.bar?'bar':'line',data:{labels:monthShort,datasets:ds},options:chartOptV6(type,!!diffs,diffType)});},0);
  return html;
}

function signedDuration(seconds){
  if(!valid(seconds))return '—';
  const sign=Number(seconds)<0?'-':'+'; const a=Math.abs(Math.round(Number(seconds)));
  if(a<60)return `${sign}${a} seg`;
  if(a<3600){const m=Math.floor(a/60),s=a%60;return `${sign}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
  const h=Math.floor(a/3600),m=Math.floor((a%3600)/60),s=a%60;return `${sign}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function dtYTD(){
  const dt=groupByMonth(D.pcs,'DT Time').map(toSeconds), aa=groupByMonth(D.pcs,'Tiempo DT AA').map(toSeconds);
  const yDt=avg(dt), yAa=avg(aa); return {dt,aa,yDt,yAa,delta:valid(yDt)&&valid(yAa)?yDt-yAa:null};
}
function dtCompareCard(){
  const id='c'+Math.random().toString(36).slice(2);
  const d=dtYTD();
  const dif=d.dt.map((v,i)=>valid(v)&&valid(d.aa[i])?v-d.aa[i]:null);
  const abs=dif.map(x=>valid(x)?Math.abs(x):null), state=dif.map(x=>valid(x)?x<=0:null);
  const chips=dif.map((x,i)=>valid(x)?`<span class="pill ${state[i]?'pos':'neg'}">${monthShort[i]} ${signedDuration(x)}</span>`:'').join('');
  const better=valid(d.delta)?d.delta<=0:null;
  const html=`<article class="card"><div class="card-head"><div><h3>DT Time</h3><div class="note">DT vs AA · menor tiempo es verde</div></div><div><div class="kpi ${better?'':'neg-text'}">${sec(d.yDt)}</div><div class="note">Promedio YTD</div></div></div><div class="dt-summary"><span class="pill neutral">DT ${sec(d.yDt)}</span><span class="pill neutral">AA ${sec(d.yAa)}</span><span class="pill ${better?'pos':'neg'}">${better?'Mejora':'Oportunidad'} ${signedDuration(d.delta)}</span></div><div class="canvas-wrap"><canvas id="${id}"></canvas></div><div class="pill-row">${chips}</div></article>`;
  setTimeout(()=>makeChart(id,{type:'line',data:{labels:monthShort,datasets:[{label:'DT Time',data:d.dt,tension:.35,borderWidth:3,borderColor:'#006241',pointRadius:3,yAxisID:'y'},{label:'DT AA',data:d.aa,tension:.35,borderWidth:2,borderColor:'#8B6F47',pointRadius:3,yAxisID:'y'},{label:'Dif abs',data:abs,type:'bar',backgroundColor:state.map(v=>v===null?'rgba(216,208,196,.20)':v?'rgba(0,117,74,.16)':'rgba(194,65,12,.16)'),borderWidth:0,yAxisID:'y1'}]},options:chartOptV6('sec',true,'sec')}),0);
  return html;
}

function insightDisplay(name,raw){
  if(name==='DT')return signedDuration(raw);
  return `${fmt(raw,'pp')} pp`;
}
function renderExecutive(){
  const ctcSrc=closedSource(mode==='tienda'?D.ctc:D.ctc_dm);
  const conn=metricValue(D.pcs,'Conexion'), beb=metricValue(D.pcs,'Calidad de la Bebida'), labor=metricValue(D.pcs,'Labor'), ebitda=metricValue(D.pcs,'EBITDA');
  const aws=awsYTD();
  const ctcVal=mode==='tienda'?metricValue(ctcSrc,'ctc'):metricValue(ctcSrc,'ctc','avg','dm');
  const laborRaw=metricDiff(D.pcs,'Labor','Labor PPTO',true).raw, ebitdaRaw=metricDiff(D.pcs,'EBITDA','EBITDA PPTO').raw;
  const kpis=[['Conexión',fmt(conn,'pct'),status('conexion',conn),'Experiencia'],['Bebida',fmt(beb,'pct'),status('bebida',beb),'Calidad'],['Labor',fmt(labor,'pct'),status('labor',labor,laborRaw),'Vs ppto'],['EBITDA',fmt(ebitda,'pct'),status('ebitda',ebitda,ebitdaRaw),'Vs ppto'],['AWS',fmt(aws,'moneyK'),'good','Venta semanal'],['CTC',fmt(ctcVal,'pct'),'good','Cada Taza Cuenta']];
  const dt=dtYTD();
  const items=[['Conexión',metricDiff(D.pcs,'Conexion','Conexion AA')],['Bebida',metricDiff(D.pcs,'Calidad de la Bebida','Calidad de Bebida AA')],['Food Attach',metricDiff(D.pcs,'Food Attach','Food Attach AA')],['SR',metricDiff(D.pcs,'SR','% SR AA')],['Labor',metricDiff(D.pcs,'Labor','Labor PPTO',true)],['Costo',metricDiff(D.pcs,'Costo %','Costo % PPTO',true)],['EBITDA',metricDiff(D.pcs,'EBITDA','EBITDA PPTO')]];
  if(valid(dt.delta))items.push(['DT',{raw:dt.delta,score:-dt.delta/60}]);
  const good=items.filter(x=>valid(x[1].score)&&x[1].score>0).sort((a,b)=>b[1].score-a[1].score).slice(0,3);
  const risk=items.filter(x=>valid(x[1].score)&&x[1].score<0).sort((a,b)=>a[1].score-b[1].score).slice(0,3);
  $('executivePanel').innerHTML=`<div class="exec-title"><div><h2>Resumen Ejecutivo</h2><p class="note">Lectura rápida para toma de decisiones</p></div><span class="pill neutral">${scopeCecos().length} tienda(s)</span></div><div class="exec-grid">${kpis.map(k=>`<div class="exec-kpi"><small>${k[0]}</small><b>${k[1]}</b><span class="status ${k[2]}">${k[3]}</span></div>`).join('')}</div><div class="insight-grid"><div class="insight-box"><h4>Fortalezas</h4><ul>${good.length?good.map(x=>`<li>${x[0]} · ${insightDisplay(x[0],x[1].raw)}</li>`).join(''):'<li>Sin variaciones positivas relevantes</li>'}</ul></div><div class="insight-box"><h4>Oportunidades</h4><ul>${risk.length?risk.map(x=>`<li>${x[0]} · ${insightDisplay(x[0],x[1].raw)}</li>`).join(''):'<li>Sin alertas críticas con datos disponibles</li>'}</ul></div></div>`;
}

function renderSections(){
  $('partnerGrid').innerHTML=chartCard({title:'Rolling RY',source:D.pcs,metric:'Rolling RY',ytd:false,diffMetric:'Rolling RY AA',diffMode:'aaMinus',diffType:'pp',subtitle:'12M atrás · objetivo <30%'})+chartCard({title:'IPLH',source:D.pcs,metric:'IPLH'})+chartCard({title:'TPLH',source:D.pcs,metric:'TPLH'})+chartCard({title:'Labor %',source:D.pcs,metric:'Labor',diffMetric:'Labor PPTO',diffType:'pp',inverseDiff:true,subtitle:'Menor a presupuesto es ahorro'})+chartCard({title:'ICA Score',source:D.pcs,metric:'ICA Score',type:'num',bar:true,subtitle:'Auditorías disponibles'});
  $('customerGrid').innerHTML=chartCard({title:'Venta Mes',source:D.venta,metric:'venta_mes',type:'moneyM',agg:'sum',bar:true,subtitle:'Venta mensual'})+awsCard()+chartCard({title:'ADT',source:D.adt,metric:'adt',type:'num',diffSourceMetric:'adt_diff',diffType:'num',subtitle:'ADT real + dif vs AA'})+chartCard({title:'Ticket Promedio',source:D.ticket,metric:'ticket',type:'ticket',diffSourceMetric:'ticket_diff',diffSource:D.ticket,diffType:'pp',subtitle:'Ticket + dif vs AA'})+chartCard({title:'VMT',source:D.pcs,metric:'VMT%'})+chartCard({title:'OMT',source:D.pcs,metric:'OMT%'})+chartCard({title:'Conexión',source:D.pcs,metric:'Conexion',diffMetric:'Conexion AA',diffType:'pp'})+chartCard({title:'Calidad Bebida',source:D.pcs,metric:'Calidad de la Bebida',diffMetric:'Calidad de Bebida AA',diffType:'pp'})+chartCard({title:'Food Attach',source:D.pcs,metric:'Food Attach',diffMetric:'Food Attach AA',diffType:'pp'})+chartCard({title:'Segundas Ventas',source:D.pcs,metric:'Segundas Ventas',type:'num'})+chartCard({title:'SR',source:D.pcs,metric:'SR',diffMetric:'% SR AA',diffType:'pp'})+chartCard({title:'Cada Taza Cuenta',source:closedSource(mode==='tienda'?D.ctc:D.ctc_dm),metric:'ctc',type:'pct',key:mode==='tienda'?'ceco':'dm',subtitle:'Participación mensual'});
  $('businessGrid').innerHTML=compareCard('Venta Delivery',D.pcs,'Venta Delivery','Delivery AA',{type:'pct',diffType:'pp'})+compareCard('Costo %',D.pcs,'Costo %','Costo % PPTO',{inverseDiff:true,type:'pct',diffType:'pp'})+compareCard('EBITDA',D.pcs,'EBITDA','EBITDA PPTO',{type:'pct',diffType:'pp'})+dtCompareCard();
}

// reinicia con funciones 6.0
fillOptions(); applySelection();


/* AWS FIX 6.3: AWS DM/RD = promedio simple de AWS de tiendas; Venta Mes conserva suma. */

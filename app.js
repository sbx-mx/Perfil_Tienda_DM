(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { data:null, audit:null, scope:'store', selection:'', period:'YTD', pillar:'Partner', productivity:'IPLH' };
  const descriptions = {
    Partner:'Personas, productividad y eficiencia de la tienda.',
    Cliente:'Experiencia, conexión y comportamiento contra año anterior.',
    Negocio:'Venta, presupuesto, tráfico, rentabilidad y tiempos operativos.',
  };
  const BUSINESS_GRAPHS = [
    {id:'sales',pillar:'Negocio',title:'Venta',actual:'sales',reference:'salesBudget',referenceKind:'ppto',format:'currency',direction:'higher',ytd:'sum',subtitle:'Venta real vs presupuesto calculado desde la variación fuente'},
    {id:'adt',pillar:'Negocio',title:'ADT',actual:'adt',reference:'adtAa',referenceKind:'aa',format:'number',direction:'higher',ytd:'average',subtitle:'Transacciones reales vs año anterior'},
    {id:'aws',pillar:'Negocio',title:'AWS',actual:'aws',reference:null,referenceKind:'aa',format:'currency',direction:'higher',ytd:'average',subtitle:'Average Weekly Sales informado por el motor'},
    {id:'ticket',pillar:'Negocio',title:'Ticket promedio',actual:'ticket',reference:'ticketAa',referenceKind:'aa',format:'currency1',direction:'higher',ytd:'average',subtitle:'Ticket real vs año anterior'},
    {id:'omt-diff',pillar:'Negocio',title:'OMT vs AA',actual:'omtDiff',reference:null,referenceKind:'aa',format:'number',direction:'higher',ytd:'average',isDiffOnly:true,subtitle:'Diferencia informada por el motor; no se inventa referencia'},
  ];

  const valid = value => typeof value === 'number' && Number.isFinite(value);
  const avg = values => { const clean=values.filter(valid); return clean.length ? clean.reduce((sum,value)=>sum+value,0)/clean.length : null; };
  const sum = values => { const clean=values.filter(valid); return clean.length ? clean.reduce((total,value)=>total+value,0) : null; };
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();

  function fmt(value, type='number', signed=false) {
    if (!valid(value)) return '—';
    const sign = signed && value > 0 ? '+' : '';
    if (type === 'percent') return `${sign}${(value*100).toFixed(1)}%`;
    if (type === 'currency') return `${sign}${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(value)}`;
    if (type === 'currency1') return `${sign}${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:1,maximumFractionDigits:1}).format(value)}`;
    if (type === 'decimal') return `${sign}${value.toFixed(1)}`;
    if (type === 'duration') {
      const seconds=Math.abs(Math.round(value)), minutes=Math.floor(seconds/60), rest=seconds%60;
      return `${signed ? (value<0?'-':value>0?'+':'') : ''}${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
    }
    return `${sign}${new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(value)}`;
  }
  const formatDate = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)) : '—';
  const metricIndex = header => state.data.metricHeaders.indexOf(header);

  function scopeOptions() {
    const directory=state.data.directory;
    if (state.scope === 'store') return directory.map(item=>({value:item.cc,label:`${item.cc} · ${item.store}`,search:`${item.cc} ${item.store} ${item.dm} ${item.region}`}));
    if (state.scope === 'dm') return [...new Set(directory.map(item=>item.dm).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(value=>({value,label:value,search:value}));
    return [...new Set(directory.map(item=>item.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(value=>({value,label:value,search:value}));
  }

  function scopeStores() {
    if (state.scope === 'store') return state.data.directory.filter(item=>item.cc===state.selection);
    if (state.scope === 'dm') return state.data.directory.filter(item=>item.dm===state.selection);
    return state.data.directory.filter(item=>item.region===state.selection);
  }

  function fillOptions(preferred='') {
    const options=scopeOptions();
    $('profileOptions').innerHTML=options.map(item=>`<option value="${escapeHtml(item.label)}"></option>`).join('');
    let option=options.find(item=>item.value===preferred) || options.find(item=>item.value===state.selection) || options[0];
    if (!option) return;
    state.selection=option.value; $('profileSearch').value=option.label;
    $('profileSearch').placeholder=state.scope==='store'?'Busca por CeCo o tienda':state.scope==='dm'?'Busca un DM':'Busca una región';
  }

  function resolveSearch() {
    const raw=$('profileSearch').value.trim(), normalized=normalize(raw), options=scopeOptions();
    const exact=options.find(item=>normalize(item.label)===normalized || normalize(item.value)===normalized);
    const ceco=state.scope==='store' ? (raw.match(/\b\d{5}\b/)||[])[0] : null;
    const match=exact || (ceco ? options.find(item=>item.value===ceco) : null) || options.find(item=>normalize(item.search).includes(normalized));
    if (!match) { $('profileSearch').setCustomValidity('Selecciona una coincidencia válida.'); $('profileSearch').reportValidity(); return false; }
    $('profileSearch').setCustomValidity(''); state.selection=match.value; $('profileSearch').value=match.label; return true;
  }

  function seriesFromProfile(graph, cecos) {
    let actualHeader=graph.actual, referenceHeader=graph.reference;
    if (graph.id==='productividad' && state.productivity==='TPLH') { actualHeader='TPLH'; referenceHeader='TPLH AA'; }
    const ai=metricIndex(actualHeader), ri=referenceHeader ? metricIndex(referenceHeader) : -1;
    return state.data.months.map(month=>{
      const rows=cecos.map(cc=>state.data.profile[cc]?.[String(month.id)]).filter(Boolean);
      return {month,actual:avg(rows.map(row=>row[ai])),reference:ri>=0?avg(rows.map(row=>row[ri])):null};
    });
  }

  function seriesFromBusiness(graph, cecos) {
    return state.data.months.map(month=>{
      const rows=cecos.map(cc=>state.data.business[cc]?.[String(month.id)]).filter(Boolean);
      const aggregate=graph.id==='sales'?sum:avg;
      return {month,actual:aggregate(rows.map(row=>row[graph.actual])),reference:graph.reference?aggregate(rows.map(row=>row[graph.reference])):null};
    });
  }

  function selectedValue(series, key, graph) {
    if (state.period !== 'YTD') return series.find(item=>String(item.month.id)===String(state.period))?.[key] ?? null;
    if (graph.ytd === 'latest') {
      const values=[...series].reverse().map(item=>item[key]); return values.find(valid) ?? null;
    }
    return graph.ytd === 'sum' ? sum(series.map(item=>item[key])) : avg(series.map(item=>item[key]));
  }

  function deltaClass(delta, graph) {
    if (!valid(delta)) return 'neutral';
    const favorable=graph.direction==='lower' ? delta<=0 : delta>=0;
    return favorable?'good':'bad';
  }

  function niceBounds(values) {
    const clean=values.filter(valid);
    if (!clean.length) return null;
    let min=Math.min(...clean), max=Math.max(...clean);
    if (Math.abs(max-min)<1e-9) { const pad=Math.max(Math.abs(max)*.12,1); min-=pad; max+=pad; }
    else { const pad=(max-min)*.16; min-=pad; max+=pad; }
    return {min,max};
  }

  function chartSvg(series, graph) {
    const bounds=niceBounds(series.flatMap(item=>[item.actual,item.reference]));
    if (!bounds) return '<div class="empty-chart">Sin dato verificado para este alcance.</div>';
    const width=540,height=190,left=52,right=16,top=14,bottom=30,plotW=width-left-right,plotH=height-top-bottom;
    const x=index=>left+(series.length===1?plotW/2:index*plotW/(series.length-1));
    const y=value=>top+(bounds.max-value)*plotH/(bounds.max-bounds.min);
    const path=key=>{
      let output='',drawing=false;
      series.forEach((item,index)=>{const value=item[key];if(!valid(value)){drawing=false;return;}output+=`${drawing?' L':' M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`;drawing=true;});return output;
    };
    const ticks=Array.from({length:4},(_,index)=>bounds.min+(bounds.max-bounds.min)*(3-index)/3);
    const grid=ticks.map(value=>`<line class="grid" x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}"/><text x="${left-8}" y="${y(value)+3}" text-anchor="end">${escapeHtml(fmt(value,graph.format))}</text>`).join('');
    const labels=series.map((item,index)=>`<text x="${x(index)}" y="${height-8}" text-anchor="middle">${escapeHtml(item.month.short)}</text>`).join('');
    const actualPoints=series.map((item,index)=>valid(item.actual)?`<circle class="point-a" cx="${x(index)}" cy="${y(item.actual)}" r="3.5"><title>${escapeHtml(item.month.label)}: ${escapeHtml(fmt(item.actual,graph.format))}</title></circle>`:'').join('');
    const referencePoints=series.map((item,index)=>valid(item.reference)?`<circle class="point-r" cx="${x(index)}" cy="${y(item.reference)}" r="3"><title>${escapeHtml(item.month.label)}: ${escapeHtml(fmt(item.reference,graph.format))}</title></circle>`:'').join('');
    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendencia de ${escapeHtml(graph.title)}">${grid}${labels}<path class="actual" d="${path('actual')}"/>${graph.reference?`<path class="reference" d="${path('reference')}"/>`:''}${actualPoints}${referencePoints}</svg>`;
  }

  function renderMetricCard(graph, source='profile') {
    const cecos=scopeStores().map(item=>item.cc), series=source==='business'?seriesFromBusiness(graph,cecos):seriesFromProfile(graph,cecos);
    const actual=selectedValue(series,'actual',graph), reference=selectedValue(series,'reference',graph);
    const delta=valid(actual)&&valid(reference)?actual-reference:(graph.isDiffOnly?actual:null);
    const refLabel=graph.referenceKind==='ppto'?'PPTO':'AA';
    const title=graph.id==='productividad'?state.productivity:graph.title;
    const control=graph.id==='productividad'?`<select class="card-control" data-productivity aria-label="Métrica de productividad"><option${state.productivity==='IPLH'?' selected':''}>IPLH</option><option${state.productivity==='TPLH'?' selected':''}>TPLH</option></select>`:'';
    const subtitle=graph.subtitle||graph.note||`Real vs ${refLabel}`;
    const verdict=deltaClass(delta,graph);
    return `<article class="metric-card ${verdict}"><div class="metric-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div>${control}</div><div class="metric-values"><div><small>Real</small><strong>${fmt(actual,graph.format)}</strong></div><div><small>${graph.reference?refLabel:'Referencia'}</small><strong>${graph.reference?fmt(reference,graph.format):'—'}</strong></div><div class="delta ${verdict}"><small>Diferencia</small><strong>${fmt(delta,graph.format,true)}</strong></div></div>${chartSvg(series,{...graph,title})}<div class="legend"><span><i class="legend-a"></i>Real</span>${graph.reference?`<span><i class="legend-r"></i>${refLabel}</span>`:''}</div></article>`;
  }

  function operationalSnapshot() {
    const cecos=scopeStores().map(item=>item.cc);
    const entries=state.data.graphs.filter(graph=>graph.pillar===state.pillar).map(graph=>({graph,series:seriesFromProfile(graph,cecos)}));
    if (state.pillar==='Negocio') BUSINESS_GRAPHS.filter(graph=>graph.reference||graph.isDiffOnly).forEach(graph=>entries.push({graph,series:seriesFromBusiness(graph,cecos)}));
    const scored=entries.map(({graph,series})=>{
      const actual=selectedValue(series,'actual',graph), reference=selectedValue(series,'reference',graph);
      const delta=valid(actual)&&valid(reference)?actual-reference:(graph.isDiffOnly?actual:null);
      const favorable=valid(delta)?(graph.direction==='lower'?delta<=0:delta>=0):null;
      return {title:graph.title,format:graph.format,delta,favorable};
    }).filter(item=>item.favorable!==null);
    return {scored,favorable:scored.filter(item=>item.favorable).length};
  }

  function opsCallout(label,item,tone) {
    return `<div class="ops-callout ${tone}"><small>${label}</small><strong>${item?escapeHtml(item.title):'—'}</strong><span>${item?fmt(item.delta,item.format,true):'Sin dato comparable'}</span></div>`;
  }

  function renderOperational() {
    const result=operationalSnapshot(), total=result.scored.length;
    const strength=result.scored.filter(item=>item.favorable).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0];
    const opportunity=result.scored.filter(item=>!item.favorable).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0];
    const stores=scopeStores(), coverage=stores.length?Math.round(stores.filter(item=>state.data.profile[item.cc]||state.data.business[item.cc]).length*100/stores.length):0;
    const score=total?Math.round(result.favorable*100/total):0;
    $('operationalStrip').innerHTML=`<div class="ops-title"><span class="eyebrow">LECTURA OPERATIVA</span><h2>${total?`${result.favorable} de ${total} indicadores favorables`:'Sin comparativos disponibles'}</h2><p>Prioriza la oportunidad y después revisa la tendencia mensual.</p></div><div class="ops-score"><div class="score-ring" style="--score:${score}"><strong>${score}%</strong><span>favorable</span></div></div>${opsCallout('Fortaleza',strength,'good')}${opsCallout('Oportunidad',opportunity,'bad')}<div class="ops-callout neutral"><small>Cobertura</small><strong>${coverage}%</strong><span>${stores.length} tienda(s) en alcance</span></div>`;
  }

  function renderHero() {
    const stores=scopeStores(), first=stores[0]||{}, cecos=stores.map(item=>item.cc);
    const partner=aggregatePartners(cecos), businessSeries=seriesFromBusiness(BUSINESS_GRAPHS[0],cecos), sales=selectedValue(businessSeries,'actual',BUSINESS_GRAPHS[0]);
    const profileCount=cecos.filter(cc=>state.data.profile[cc]).length, businessCount=cecos.filter(cc=>state.data.business[cc]).length;
    const title=state.scope==='store'?`${first.cc} · ${first.store}`:state.selection;
    const sub=state.scope==='store'?`${first.dm||'DM sin dato'} · ${first.region||'Región sin dato'}`:`${stores.length} tiendas · ${[...new Set(stores.map(item=>item.region).filter(Boolean))].length} región(es)`;
    const details=state.scope==='store'?`${first.city||'Ciudad sin dato'} · Apertura ${formatDate(first.opened)}`:`Cobertura consolidada del alcance seleccionado`;
    $('profileHero').classList.remove('skeleton');
    $('profileHero').innerHTML=`<div class="profile-identity"><span class="eyebrow">${state.scope==='store'?'PERFIL DE TIENDA':state.scope==='dm'?'PERFIL DISTRITAL':'PERFIL REGIONAL'}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p><p>${escapeHtml(details)}</p></div>${heroStat('Tiendas',stores.length,'Directorio verificado')}${heroStat('Partners',partner.headcount,'Activos resumidos')}${heroStat('Venta',fmt(sales,'currency'),state.period==='YTD'?'Acumulado YTD':'Periodo seleccionado')}${heroStat('Perfil',`${profileCount}/${stores.length}`,'Tiendas con Excel base')}${heroStat('Negocio',`${businessCount}/${stores.length}`,'Tiendas con CSV negocio')}`;
  }
  const heroStat=(label,value,note)=>`<div class="hero-stat"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(note)}</span></div>`;

  function aggregatePartners(cecos) {
    const rows=cecos.map(cc=>state.data.partners[cc]).filter(Boolean), total=key=>sum(rows.map(row=>row[key]))||0;
    const weighted=(key,weight='headcount')=>{const denom=sum(rows.map(row=>valid(row[key])?row[weight]:null));return denom?sum(rows.map(row=>valid(row[key])?row[key]*row[weight]:null))/denom:null;};
    const roles={}; rows.forEach(row=>Object.entries(row.roles||{}).forEach(([key,value])=>roles[key]=(roles[key]||0)+value));
    return {headcount:total('headcount'),baristas:total('baristas'),supervisors:total('supervisors'),managers:total('managers'),female:total('female'),male:total('male'),avgAge:weighted('avgAge'),avgTenureMonths:weighted('avgTenureMonths'),birthdaysThisMonth:total('birthdaysThisMonth'),anniversariesThisMonth:total('anniversariesThisMonth'),roles};
  }

  function renderPartnerPanel() {
    const result=aggregatePartners(scopeStores().map(item=>item.cc));
    const roles=Object.entries(result.roles).sort((a,b)=>b[1]-a[1]).slice(0,7);
    $('partnerPanel').innerHTML=`<div class="panel-head"><div><span class="eyebrow">QUERY PARTNER</span><h2>Equipo resumido</h2></div><span class="source-status ready"><i></i>${result.headcount} activos</span></div><div class="partner-kpis">${miniKpi('Baristas',result.baristas)}${miniKpi('Supervisores',result.supervisors)}${miniKpi('Edad media',fmt(result.avgAge,'decimal'))}${miniKpi('Antigüedad',valid(result.avgTenureMonths)?`${(result.avgTenureMonths/12).toFixed(1)} años`:'—')}${miniKpi('Cumpleaños mes',result.birthdaysThisMonth)}${miniKpi('Aniversarios mes',result.anniversariesThisMonth)}${miniKpi('Mujeres',result.female)}${miniKpi('Hombres',result.male)}</div><div class="role-list">${roles.length?roles.map(([key,value])=>`<span>${escapeHtml(key)} · ${value}</span>`).join(''):'<span>Sin datos coincidentes</span>'}</div>`;
  }
  const miniKpi=(label,value)=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;

  function aggregateMix(cecos) {
    const category={},order={}; let total=0;
    const months=state.period==='YTD'?state.data.months.map(item=>String(item.id)):[String(state.period)];
    cecos.forEach(cc=>months.forEach(month=>{const row=state.data.mix[cc]?.[month];if(!row||!valid(row.total))return;total+=row.total;Object.entries(row.category||{}).forEach(([key,value])=>category[key]=(category[key]||0)+value*row.total);Object.entries(row.order||{}).forEach(([key,value])=>order[key]=(order[key]||0)+value*row.total);}));
    if (total) { Object.keys(category).forEach(key=>category[key]/=total); Object.keys(order).forEach(key=>order[key]/=total); }
    return {category,order,total};
  }
  function mixRows(values) { const entries=Object.entries(values).sort((a,b)=>b[1]-a[1]).slice(0,6); return entries.length?entries.map(([key,value])=>`<div class="mix-row"><span title="${escapeHtml(key)}">${escapeHtml(key)}</span><div class="mix-bar"><i style="width:${Math.min(100,value*100)}%"></i></div><b>${fmt(value,'percent')}</b></div>`).join(''):'<div class="empty-chart">Sin cruce exacto de Mix.</div>'; }
  function renderMixPanel() { const mix=aggregateMix(scopeStores().map(item=>item.cc)); $('mixPanel').innerHTML=`<div class="panel-head"><div><span class="eyebrow">BASE MIX</span><h2>Mix de venta</h2></div><span class="source-status ${mix.total?'ready':''}"><i></i>${mix.total?'Cruce verificado':'Sin coincidencia'}</span></div><div class="mix-layout"><div class="mix-block"><h3>Producto</h3>${mixRows(mix.category)}</div><div class="mix-block"><h3>Tipo de orden</h3>${mixRows(mix.order)}</div></div>`; }

  function renderMetrics() {
    let graphs=state.data.graphs.filter(graph=>graph.pillar===state.pillar);
    let html=graphs.map(graph=>renderMetricCard(graph,'profile')).join('');
    if (state.pillar==='Negocio') html+=BUSINESS_GRAPHS.map(graph=>renderMetricCard(graph,'business')).join('');
    $('metricGrid').innerHTML=html || '<div class="error-panel"><h2>Sin métricas clasificadas</h2><p>Revisa la pestaña Instrucciones_Ejemplo.</p></div>';
    document.querySelector('[data-productivity]')?.addEventListener('change',event=>{state.productivity=event.target.value;renderMetrics();});
  }

  function renderAll() {
    renderHero(); renderOperational(); renderMetrics(); renderPartnerPanel(); renderMixPanel();
    const number={Partner:'01',Cliente:'02',Negocio:'03'}[state.pillar];
    $('pillarEyebrow').textContent=`PILAR ${number}`; $('pillarTitle').textContent=state.pillar; $('pillarDescription').textContent=descriptions[state.pillar];
    document.querySelectorAll('[data-pillar]').forEach(button=>button.classList.toggle('active',button.dataset.pillar===state.pillar));
  }

  function showAudit() {
    const audit=state.audit;
    $('dialogTitle').textContent='Calidad de los motores';
    $('dialogContent').innerHTML=`<div class="dialog-body"><div class="audit-grid">${auditKpi('Errores',audit.issueCount)}${auditKpi('Advertencias',audit.warningCount)}${auditKpi('Tiendas',audit.directory.validStores)}${auditKpi('Meses',state.data.months.length)}${auditKpi('Perfil',audit.profile.matchedStores)}${auditKpi('Negocio',audit.business.matchedStores)}${auditKpi('Mix',audit.mix.matchedStores)}${auditKpi('Partner',audit.partners.matchedStores)}</div><ul class="warning-list">${audit.warnings.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
    $('detailsDialog').showModal();
  }
  const auditKpi=(label,value)=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
  function showInstructions() {
    $('dialogTitle').textContent='Instrucciones del motor';
    $('dialogContent').innerHTML=`<div class="dialog-body"><ul class="instruction-list">${state.data.instructions.map(item=>`<li><strong>${escapeHtml(item.pillar)} · ${escapeHtml(item.graph||item.header)}</strong><span>${escapeHtml(item.instruction||'Sin instrucción adicional')}${item.note?` — ${escapeHtml(item.note)}`:''}</span></li>`).join('')}</ul></div>`;
    $('detailsDialog').showModal();
  }

  function bindEvents() {
    document.querySelectorAll('[data-scope]').forEach(button=>button.addEventListener('click',()=>{state.scope=button.dataset.scope;document.querySelectorAll('[data-scope]').forEach(item=>item.classList.toggle('active',item===button));fillOptions();renderAll();}));
    document.querySelectorAll('[data-pillar]').forEach(button=>button.addEventListener('click',()=>{state.pillar=button.dataset.pillar;renderAll();}));
    $('profileSearch').addEventListener('change',()=>{if(resolveSearch())renderAll();});
    $('profileSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(resolveSearch())renderAll();}});
    $('periodSelect').addEventListener('change',event=>{state.period=event.target.value;renderAll();});
    $('printButton').addEventListener('click',()=>window.print()); $('qualityButton').addEventListener('click',showAudit); $('instructionsButton').addEventListener('click',showInstructions);
    $('dialogClose').addEventListener('click',()=>$('detailsDialog').close());
    const navigation=[...document.querySelectorAll('.quick-nav a')];
    navigation.forEach(link=>link.addEventListener('click',()=>navigation.forEach(item=>item.classList.toggle('active',item===link))));
    if ('IntersectionObserver' in window) {
      const observer=new IntersectionObserver(entries=>entries.filter(entry=>entry.isIntersecting).forEach(entry=>navigation.forEach(link=>link.classList.toggle('active',link.hash===`#${entry.target.id}`))),{rootMargin:'-20% 0px -65%'});
      ['resumen','indicadores','equipo-mix','uso'].map(id=>$(id)).filter(Boolean).forEach(section=>observer.observe(section));
    }
  }

  async function start() {
    try {
      const [dataResponse,auditResponse]=await Promise.all([fetch('data/dashboard.json',{cache:'no-store'}),fetch('data/audit.json',{cache:'no-store'})]);
      if (!dataResponse.ok || !auditResponse.ok) throw new Error(`No fue posible cargar los motores (${dataResponse.status}/${auditResponse.status}).`);
      state.data=await dataResponse.json(); state.audit=await auditResponse.json();
      if (state.data.schemaVersion!==2 || state.audit.issueCount) throw new Error('El contrato de datos no superó la auditoría.');
      state.data.directory.sort((a,b)=>a.cc.localeCompare(b.cc));
      const firstVerified=state.data.directory.find(item=>state.data.profile[item.cc]||state.data.business[item.cc]);
      fillOptions(firstVerified?.cc||'');
      $('periodSelect').innerHTML='<option value="YTD">YTD</option>'+state.data.months.map(month=>`<option value="${month.id}">${month.period} · ${escapeHtml(month.label)}</option>`).join('');
      $('sourceStatus').classList.add('ready'); $('sourceStatus').querySelector('span').textContent=`${state.data.months.length} meses · ${state.audit.warningCount} advertencias controladas`;
      bindEvents(); renderAll();
      if ('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('sw.js').catch(()=>{});
    } catch (error) {
      console.error(error); $('sourceStatus').querySelector('span').textContent='Error de carga';
      $('profileHero').classList.remove('skeleton'); $('profileHero').innerHTML=`<div class="error-panel"><h2>No se pudo abrir el perfil</h2><p>${escapeHtml(error instanceof Error?error.message:'Error inesperado')}</p></div>`;
    }
  }
  start();
})();

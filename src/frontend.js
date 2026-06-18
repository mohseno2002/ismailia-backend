// ============================================================
// frontend.js — الواجهة (تُخدَم من الـ Worker)
// ============================================================
export const INDEX_HTML = String.raw`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>التوأم الرقمي — ترعة الإسماعيلية (Backend)</title>
<style>
  :root { --navy:#0e3b5c; --bg:#f4f7fa; --card:#fff; --ok:#1a7f37; --warn:#b54708; }
  * { box-sizing:border-box; font-family:system-ui,"Segoe UI",Tahoma,sans-serif; }
  body { margin:0; background:var(--bg); color:#1b2733; }
  header { background:var(--navy); color:#fff; padding:14px 18px; display:flex;
           justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
  header h1 { font-size:18px; margin:0; }
  header input[type=date]{ padding:6px 10px; border-radius:8px; border:none; }
  .tabs { display:flex; gap:6px; padding:10px 14px; background:#fff; border-bottom:1px solid #e2e8f0;
          overflow-x:auto; }
  .tabs button { padding:8px 14px; border:none; background:#eef2f6; border-radius:20px;
                 cursor:pointer; white-space:nowrap; font-size:14px; }
  .tabs button.active { background:var(--navy); color:#fff; }
  main { padding:14px; max-width:1000px; margin:auto; }
  .card { background:var(--card); border:1px solid #e2e8f0; border-radius:14px;
          padding:14px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
  .card h3 { margin:0 0 4px; color:var(--navy); font-size:16px; }
  .km { color:#64748b; font-size:13px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-top:8px; }
  .grid label { font-size:12px; color:#475569; display:block; }
  .grid input { width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; }
  .q { margin-top:8px; font-size:15px; font-weight:700; }
  .q .calibrated { color:var(--ok); } .q .manning { color:var(--warn); } .q .manual { color:var(--navy); }
  .tag { font-size:11px; padding:2px 8px; border-radius:10px; background:#eef2f6; margin-inline-start:6px; }
  button.save { background:var(--ok); color:#fff; border:none; padding:8px 16px; border-radius:10px;
                cursor:pointer; margin-top:8px; }
  .balance { display:flex; gap:14px; flex-wrap:wrap; }
  .balance .box { flex:1; min-width:120px; text-align:center; padding:14px; border-radius:12px; background:#eef2f6; }
  .balance .box b { display:block; font-size:24px; color:var(--navy); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { border:1px solid #e2e8f0; padding:6px 8px; text-align:right; }
  th { background:var(--navy); color:#fff; }
  .hidden { display:none; }
  .muted { color:#94a3b8; font-size:13px; }
</style>
</head>
<body>
<header>
  <h1>🌊 التوأم الرقمي — ترعة الإسماعيلية</h1>
  <input type="date" id="dateSel">
</header>
<div class="tabs">
  <button class="active" data-tab="readings">📋 القراءات والتصرف</button>
  <button data-tab="balance">⚖️ الميزان الكتلي</button>
  <button data-tab="audit">🕓 سجل التغييرات</button>
</div>
<main>
  <div id="tab-readings"></div>
  <div id="tab-balance" class="hidden"></div>
  <div id="tab-audit" class="hidden"></div>
</main>

<script type="module">
const API = location.origin + '/api';
const dateSel = document.getElementById('dateSel');
dateSel.value = new Date().toISOString().slice(0,10);

let NODES = [];
let CURRENT = {};

function calibQ(node, r){
  if(node.curve_type==='power'){
    const head=(r.wl_dn??0)-node.h0; return head<=0?0:node.a*Math.pow(head,node.b);
  }
  if(node.curve_type==='linear'){
    return node.c_n*(r.gates_open??0)+node.c_up*(r.wl_up??0)+node.c_dn*(r.wl_dn??0)+node.intercept;
  }
  return null;
}
function manning(node,r){
  const y=(r.wl_dn??0)-(node.bed_level??0); if(y<=0)return 0;
  const b=node.gauge_width??node.bed_width, z=node.gauge_slope??node.side_slope,
        A=(b+z*y)*y, P=b+2*y*Math.sqrt(1+z*z), R=A/P;
  return (1/node.manning_n)*A*Math.pow(R,2/3)*Math.sqrt(node.bed_slope);
}
function resolveQ(node,r){
  if(r.q_manual!=null&&r.q_manual!=='')return{q:+r.q_manual,m:'manual'};
  const c=calibQ(node,r); if(c!=null&&isFinite(c)&&c>=0)return{q:c,m:'calibrated'};
  return{q:manning(node,r),m:'manning'};
}
const mName={manual:'يدوي',calibrated:'📐 معاير',manning:'📏 مانينج'};

async function loadNodes(){ NODES=await (await fetch(API+'/nodes')).json(); }
async function loadReadings(){
  const d=dateSel.value;
  const data=await (await fetch(API+'/readings?date='+d)).json();
  CURRENT=Object.fromEntries(data.nodes.map(n=>[n.id,n]));
  renderReadings();
}

function renderReadings(){
  const el=document.getElementById('tab-readings'); el.innerHTML='';
  NODES.forEach(node=>{
    const r=CURRENT[node.id]||{};
    const {q,m}=resolveQ(node,r);
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=\`
      <h3>\${node.name_ar} <span class="km">كم \${node.km}</span></h3>
      <div class="grid">
        <div><label>منسوب أمام</label><input type="number" step="0.01" data-f="wl_up" value="\${r.wl_up??''}"></div>
        <div><label>منسوب خلف</label><input type="number" step="0.01" data-f="wl_dn" value="\${r.wl_dn??''}"></div>
        \${node.curve_type==='linear'?'<div><label>عدد الحب المرفوع</label><input type="number" data-f="gates_open" value="'+(r.gates_open??'')+'"></div>':''}
        <div><label>تصرف يدوي (اختياري)</label><input type="number" step="0.01" data-f="q_manual" value="\${r.q_manual??''}"></div>
      </div>
      <div class="q">التصرف: <span class="\${m}">\${q.toFixed(3)} م³/ث</span>
        <span class="tag">\${mName[m]}</span>
        \${node.avg_error_pct?'<span class="tag">خطأ معايرة '+node.avg_error_pct+'%</span>':''}
      </div>
      <button class="save">💾 حفظ</button>\`;
    const inputs=card.querySelectorAll('input');
    const recalc=()=>{
      const rr={};
      inputs.forEach(i=>{ const v=i.value; rr[i.dataset.f]= v===''?null:+v; });
      const {q,m}=resolveQ(node,rr);
      const span=card.querySelector('.q span'); span.textContent=q.toFixed(3)+' م³/ث'; span.className=m;
      card.querySelector('.tag').textContent=mName[m];
    };
    inputs.forEach(i=>i.addEventListener('input',recalc));
    card.querySelector('.save').onclick=async()=>{
      const body={node_id:node.id,reading_date:dateSel.value};
      inputs.forEach(i=>{ body[i.dataset.f]= i.value===''?null:+i.value; });

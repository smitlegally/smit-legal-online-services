/* SMIT MASTER ADMIN ADD-ON
   Adds service creation, file queue/search, daily Excel report, and keeps existing admin flows intact.
*/
(function(){
  'use strict';
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function admin(){return $('#adminPanel') && getComputedStyle($('#adminPanel')).display!=='none';}
  function data(){ try{return typeof read==='function'?read():JSON.parse(localStorage.getItem('smitData')||'{}')}catch{return {services:[]}} }
  function save(d){ if(typeof write==='function') write(d); else localStorage.setItem('smitData',JSON.stringify(d)); window.dispatchEvent(new Event('smit-admin-data-updated')); }
  function ensureStyles(){if($('#smit-master-addon-style'))return; const st=document.createElement('style');st.id='smit-master-addon-style';st.textContent=`
  .smit-master-card{margin:14px 0;padding:16px;border:1px solid #ddd;border-radius:14px;background:var(--card,#fff)}
  .smit-master-card h3{margin:0 0 10px}.smit-master-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.smit-master-card input,.smit-master-card select,.smit-master-card textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #bbb;border-radius:9px}.smit-master-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.smit-master-list{display:grid;gap:8px;margin-top:10px}.smit-master-row{padding:10px;border:1px solid #ddd;border-radius:10px;display:flex;justify-content:space-between;gap:8px;align-items:center}.smit-master-muted{font-size:12px;opacity:.7}.smit-file-status{font-weight:700}.smit-pending{border-left:4px solid #d97706}.smit-completed{border-left:4px solid #16a34a}`;document.head.appendChild(st)}
  function addMainService(){
    const name=prompt('Main Service name'); if(!name?.trim())return;
    const desc=prompt('Description / guidance',''); const d=data(); d.services=d.services||[];
    d.services.push([name.trim(),desc||'',[]]); save(d); if(typeof renderAdmin==='function')renderAdmin(); alert('Main Service added and saved.');
  }
  function addSubService(i){
    const d=data(),svc=d.services?.[i]; if(!svc)return;
    const name=prompt('Sub-service name'); if(!name?.trim())return;
    const docs=prompt('Required documents',''); const charge=prompt('Charge',''); const solution=prompt('Suggestion / guidance','');
    svc[2]=svc[2]||[]; svc[2].push([name.trim(),solution||'',docs||'',charge||'']); save(d); if(typeof renderAdmin==='function')renderAdmin();
  }
  function injectServiceControls(){
    const wrap=$('#adminServices'); if(!wrap || $('#smitAddMain'))return;
    const box=document.createElement('div');box.id='smitAddMain';box.className='smit-master-card';box.innerHTML=`<h3>➕ Service Management</h3><p class="smit-master-muted">Add new Main Services and Sub-services without editing the code.</p><div class="smit-master-actions"><button type="button" class="primary-btn" id="smitAddMainBtn">＋ Add Main Service</button></div>`;
    wrap.parentNode.insertBefore(box,wrap);
    $('#smitAddMainBtn').onclick=addMainService;
  }
  function addSubButtons(){
    const wrap=$('#adminServices'); if(!wrap)return;
    wrap.querySelectorAll('[data-main-edit]').forEach(btn=>{
      const row=btn.closest('.admin-service-picker'); if(!row||row.querySelector('[data-addon-add-sub]'))return;
      const i=btn.dataset.mainEdit; const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.dataset.addonAddSub='1';b.textContent='＋ Sub-service';b.onclick=()=>addSubService(Number(i));row.appendChild(b);
    });
  }
  async function uploadFile(file, meta){
    const fd=new FormData();fd.append('file',file);Object.entries(meta||{}).forEach(([k,v])=>fd.append(k,v??''));
    const r=await fetch('/api/files/upload',{method:'POST',body:fd});if(!r.ok)throw new Error(await r.text());return r.json();
  }
  async function renderFileManager(){
    let box=$('#smitFileManager');if(!box){box=document.createElement('div');box.id='smitFileManager';box.className='smit-master-card';($('#adminPanel')||document.body).appendChild(box)}
    box.innerHTML=`<h3>📁 Customer Files</h3><div class="smit-master-grid"><label>Search Mobile / Order ID<input id="smitFileSearch" placeholder="e.g. 9876543210 or SMIT-2026"></label><label>Date<select id="smitFileDate"><option value="today">Today</option><option value="all">All</option></select></label><label>Upload<input id="smitFileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv"></label></div><div class="smit-master-actions"><button type="button" class="secondary-btn" id="smitFileRefresh">Refresh</button></div><div id="smitFileList" class="smit-master-list"></div>`;
    $('#smitFileInput').onchange=async e=>{const files=[...e.target.files];const phone=prompt('Customer mobile number (optional)','')||'';const order=prompt('Order ID (optional)','')||'';for(const f of files){try{await uploadFile(f,{phone,orderId:order,status:'pending'});}catch(err){alert('Upload failed: '+err.message)}}loadFiles()};
    $('#smitFileRefresh').onclick=loadFiles;$('#smitFileSearch').oninput=loadFiles;$('#smitFileDate').onchange=loadFiles;await loadFiles();
  }
  async function loadFiles(){const list=$('#smitFileList');if(!list)return;const q=($('#smitFileSearch')?.value||'').trim();const date=$('#smitFileDate')?.value||'today';const url='/api/files?status=pending&date='+encodeURIComponent(date)+(q?'&q='+encodeURIComponent(q):'');try{const r=await fetch(url);const j=await r.json();list.innerHTML='';if(!j.files.length){list.innerHTML='<div class="smit-master-muted">No pending files found.</div>';return}j.files.forEach(f=>{const row=document.createElement('div');row.className='smit-master-row smit-pending';row.innerHTML='<div><b>'+esc(f.originalName)+'</b><div class="smit-master-muted">'+esc(f.phone||'')+' · '+esc(f.orderId||'')+' · '+esc(f.uploadedAt||'')+'</div></div><div class="smit-master-actions"><a class="secondary-btn" href="'+esc(f.url)+'" target="_blank">Open</a><button type="button" class="secondary-btn">✓ Completed</button></div>';row.querySelector('button').onclick=async()=>{await fetch('/api/files/'+encodeURIComponent(f.id)+'/complete',{method:'POST'});loadFiles()};list.appendChild(row)})}catch(e){list.innerHTML='<div class="smit-master-muted">File server unavailable.</div>'}}
  function injectReports(){let box=$('#smitDailyMaster');if(box)return;box=document.createElement('div');box.id='smitDailyMaster';box.className='smit-master-card';box.innerHTML=`<h3>📊 Daily Sales / Excel</h3><div class="smit-master-grid"><label>Date<input id="smitReportDate" type="date"></label></div><div class="smit-master-actions"><button type="button" class="primary-btn" id="smitExcel">⬇️ Download Excel</button><button type="button" class="secondary-btn" id="smitGenReport">Generate + Deliver Now</button></div><div id="smitReportStatus" class="smit-master-muted"></div>`;($('#adminPanel')||document.body).appendChild(box);$('#smitExcel').onclick=()=>{const d=$('#smitReportDate').value;location.href='/api/daily-report.xlsx'+(d?'?date='+encodeURIComponent(d):'')};$('#smitGenReport').onclick=async()=>{const d=$('#smitReportDate').value;const r=await fetch('/api/daily-report/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:d||undefined})});$('#smitReportStatus').textContent=await r.text()};}
  function install(){if(!admin())return;ensureStyles();injectServiceControls();addSubButtons();injectReports();renderFileManager()}
  document.addEventListener('click',e=>{if(e.target?.id==='adminLoginBtn')setTimeout(install,500);if(e.target?.matches?.('[data-main-edit]'))setTimeout(addSubButtons,100)});
  setInterval(()=>{if(admin())install()},1200);
})();

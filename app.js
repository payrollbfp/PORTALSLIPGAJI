const API_URL = window.APP_CONFIG?.API_URL || "";
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const state = { token: sessionStorage.getItem("bfpToken") || "", user: null, employees: [], slips: [], pdfUrl: "", pdfName: "slip-gaji.pdf" };
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);
async function init(){
  $("copyrightYear").textContent = new Date().getFullYear();
  MONTHS.forEach((m,i)=>$("slipMonth").add(new Option(m,String(i+1))));
  bindEvents();
  if(state.token){ try { const data=await api("session"); state.user=data.user; showApp(); } catch { clearSession(); } }
}
function bindEvents(){
  $("loginForm").addEventListener("submit", login);
  $("togglePassword").addEventListener("click",()=>{const f=$("password");f.type=f.type==="password"?"text":"password";});
  document.querySelectorAll("[data-logout]").forEach(b=>b.addEventListener("click",logout));
  $("showSlipButton").addEventListener("click",showSlip);
  $("viewPdfButton").addEventListener("click",()=>state.pdfUrl&&window.open(state.pdfUrl,"_blank","noopener"));
  $("downloadPdfButton").addEventListener("click",downloadPdf);
  document.querySelectorAll("[data-admin-tab]").forEach(b=>b.addEventListener("click",()=>switchAdminTab(b.dataset.adminTab)));
  $("employeeSearch").addEventListener("input",renderEmployees);
  $("slipSearch").addEventListener("input",renderSlips);
  $("addEmployeeButton").addEventListener("click",()=>openEmployeeDialog());
  $("addSlipButton").addEventListener("click",()=>openSlipDialog());
  $("employeeForm").addEventListener("submit",saveEmployee);
  $("slipForm").addEventListener("submit",saveSlip);
  document.querySelectorAll("[data-close-dialog]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
}
async function api(action,payload={}){
  if(!API_URL || API_URL.includes("PASTE_URL")) throw new Error("URL backend belum diatur pada config.js");
  const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,token:state.token,...payload}),redirect:"follow"});
  const json=await res.json(); if(!json.ok) throw new Error(json.message||"Permintaan gagal"); return json.data;
}
async function login(e){
  e.preventDefault(); const btn=$("loginButton"); setLoading(btn,true,"Memeriksa...");
  try{const data=await api("login",{nik:$("nik").value.trim(),password:$("password").value});state.token=data.token;state.user=data.user;sessionStorage.setItem("bfpToken",state.token);showApp();toast("Login berhasil.");}
  catch(err){toast(err.message,true);} finally{setLoading(btn,false,"Masuk");}
}
function showApp(){
  $("loginView").classList.add("hidden");
  if(state.user.role==="ADMIN"){ $("adminApp").classList.remove("hidden"); loadAdmin(); }
  else { $("employeeApp").classList.remove("hidden"); $("employeeName").textContent=state.user.name; $("employeeProject").textContent=state.user.project; loadPeriods(); }
}
async function logout(){try{await api("logout");}catch{}clearSession();location.reload();}
function clearSession(){state.token="";state.user=null;sessionStorage.removeItem("bfpToken");}
async function loadPeriods(){
  try{const {periods}=await api("getPeriods"); const months=[...new Set(periods.map(p=>p.month))]; const years=[...new Set(periods.map(p=>p.year))].sort((a,b)=>b-a); fillSelect($("monthSelect"),months.map(v=>({v,label:MONTHS[v-1]})),"Pilih bulan"); fillSelect($("yearSelect"),years.map(v=>({v,label:v})),"Pilih tahun");}
  catch(err){toast(err.message,true);}
}
async function showSlip(){
  const month=$("monthSelect").value,year=$("yearSelect").value;if(!month||!year)return toast("Pilih bulan dan tahun terlebih dahulu.",true);
  const btn=$("showSlipButton");setLoading(btn,true,"Memuat...");revokePdf();
  try{const data=await api("getSlip",{month:Number(month),year:Number(year)});const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:"application/pdf"});state.pdfUrl=URL.createObjectURL(blob);state.pdfName=data.fileName||`Slip-${MONTHS[month-1]}-${year}.pdf`;$("pdfFrame").src=state.pdfUrl;$("pdfFrame").classList.remove("hidden");$("emptySlip").classList.add("hidden");$("viewPdfButton").disabled=false;$("downloadPdfButton").disabled=false;}
  catch(err){toast(err.message,true);}finally{setLoading(btn,false,"Tampilkan Slip Gaji");}
}
function downloadPdf(){if(!state.pdfUrl)return;const a=document.createElement("a");a.href=state.pdfUrl;a.download=state.pdfName;a.click();}
function revokePdf(){if(state.pdfUrl)URL.revokeObjectURL(state.pdfUrl);state.pdfUrl="";$("viewPdfButton").disabled=true;$("downloadPdfButton").disabled=true;}
async async function loadAdmin() {
  await loadEmployees();
}

async function loadEmployees() {
  try {
    const data = await api("adminListEmployees");

    state.employees = data.employees;
    renderEmployees();
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadSlips() {
  try {
    const data = await api("adminListSlips");

    state.slips = data.slips;
    renderSlips();
  } catch (err) {
    toast(err.message, true);
  }
}
async function switchAdminTab(tab) {
  document
    .querySelectorAll("[data-admin-tab]")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.adminTab === tab
      );
    });

  $("employeesTab").classList.toggle(
    "hidden",
    tab !== "employees"
  );

  $("slipsTab").classList.toggle(
    "hidden",
    tab !== "slips"
  );

  if (tab === "employees" && state.employees.length === 0) {
    await loadEmployees();
  }

  if (tab === "slips" && state.slips.length === 0) {
    await loadSlips();
  }
}
function renderEmployees(){const q=$("employeeSearch").value.toLowerCase();const rows=state.employees.filter(e=>[e.nik,e.nopeg,e.name,e.project].join(" ").toLowerCase().includes(q));$("employeeTableBody").innerHTML=rows.map(e=>`<tr><td>${esc(e.nik)}</td><td>${esc(e.nopeg)}</td><td>${esc(e.name)}</td><td>${esc(e.project)}</td><td>${esc(e.role)}</td><td><button class="action-button" onclick="editEmployee('${escAttr(e.nik)}')">Edit</button><button class="action-button danger" onclick="deleteEmployee('${escAttr(e.nik)}')">Hapus</button></td></tr>`).join("")||emptyRow(6);$("employeeCount").textContent=`${rows.length} Data Karyawan`;}
function renderSlips(){const q=$("slipSearch").value.toLowerCase();const rows=state.slips.filter(s=>[s.nik,s.name,s.fileName,s.month,s.year].join(" ").toLowerCase().includes(q));$("slipTableBody").innerHTML=rows.map(s=>`<tr><td>${esc(s.nik)}</td><td>${esc(s.name)}</td><td>${esc(MONTHS[s.month-1])} ${esc(s.year)}</td><td>${esc(s.fileName)}</td><td><button class="action-button" onclick="editSlip('${escAttr(s.id)}')">Edit</button><button class="action-button danger" onclick="deleteSlip('${escAttr(s.id)}')">Hapus</button></td></tr>`).join("")||emptyRow(5);$("slipCount").textContent=`${rows.length} Data Slip Gaji`;}
function openEmployeeDialog(e=null){$("employeeDialogTitle").textContent=e?"Edit Karyawan":"Tambah Karyawan";$("employeeOriginalNik").value=e?.nik||"";$("employeeNik").value=e?.nik||"";$("employeeNopeg").value=e?.nopeg||"";$("employeeFullName").value=e?.name||"";$("employeeProjectInput").value=e?.project||"";$("employeeRole").value=e?.role||"EMPLOYEE";$("employeeActive").value=String(e?.active??true).toUpperCase();$("employeePassword").value="";$("employeeDialog").showModal();}
window.editEmployee=nik=>openEmployeeDialog(state.employees.find(e=>e.nik===nik));
async function saveEmployee(e){e.preventDefault();try{await api("adminSaveEmployee",{employee:{originalNik:$("employeeOriginalNik").value,nik:$("employeeNik").value.trim(),nopeg:$("employeeNopeg").value.trim(),name:$("employeeFullName").value.trim(),project:$("employeeProjectInput").value.trim(),role:$("employeeRole").value,active:$("employeeActive").value==="TRUE",password:$("employeePassword").value}});$("employeeDialog").close();toast("Data karyawan tersimpan.");await loadAdmin();}catch(err){toast(err.message,true);}}
window.deleteEmployee=async nik=>{if(!confirm(`Hapus karyawan dengan NIK ${nik}?`))return;try{await api("adminDeleteEmployee",{nik});toast("Data karyawan dihapus.");await loadAdmin();}catch(err){toast(err.message,true);}};
function openSlipDialog(s=null){$("slipDialogTitle").textContent=s?"Edit Slip Gaji":"Tambah Slip Gaji";$("slipId").value=s?.id||"";$("slipNik").value=s?.nik||"";$("slipMonth").value=s?.month||String(new Date().getMonth()+1);$("slipYear").value=s?.year||new Date().getFullYear();$("driveFileId").value=s?.driveFileId||"";$("slipFileName").value=s?.fileName||"";$("slipDialog").showModal();}
window.editSlip=id=>openSlipDialog(state.slips.find(s=>s.id===id));
async function saveSlip(e){e.preventDefault();try{await api("adminSaveSlip",{slip:{id:$("slipId").value,nik:$("slipNik").value.trim(),month:Number($("slipMonth").value),year:Number($("slipYear").value),driveFileId:$("driveFileId").value.trim(),fileName:$("slipFileName").value.trim()}});$("slipDialog").close();toast("Data slip tersimpan.");await loadAdmin();}catch(err){toast(err.message,true);}}
window.deleteSlip=async id=>{if(!confirm("Hapus data slip gaji ini?"))return;try{await api("adminDeleteSlip",{id});toast("Data slip dihapus.");await loadAdmin();}catch(err){toast(err.message,true);}};
function fillSelect(el,items,placeholder){el.innerHTML=`<option value="">${placeholder}</option>`;items.forEach(i=>el.add(new Option(i.label,i.v)));}
function setLoading(btn,on,text){btn.disabled=on;btn.textContent=text;}
function toast(message,error=false){const t=$("toast");t.textContent=message;t.classList.toggle("error",error);t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),3500);}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}function escAttr(v){return esc(v).replace(/`/g,"&#96;");}function emptyRow(cols){return `<tr><td colspan="${cols}" style="text-align:center;color:#7a8495">Belum ada data.</td></tr>`;}

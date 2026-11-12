
"use strict";

const STORAGE_KEY = "healthMemoryApp_v1";
const DB_NAME = "HealthMemoryFiles";
const STORE = "documents";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let data = loadData();
let calendarDate = new Date();
let selectedDay = today();
let toastTimer;

function today(){return new Date().toISOString().slice(0,10)}
function uid(){return crypto.randomUUID()}
function escapeHTML(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatDate(v){return v?new Date(v+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):""}
function formatTime(v){if(!v)return "";let [h,m]=v.split(":");let d=new Date();d.setHours(+h,+m);return d.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}
function toast(msg){$("#toast").textContent=msg;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),2400)}
function defaultData(){return {profiles:[{id:"self",name:"My Profile",relation:"Self"}],activeProfile:"self",records:[],medicines:[],appointments:[],emergency:{},theme:"light"}}
function loadData(){try{let d=JSON.parse(localStorage.getItem(STORAGE_KEY));return d&&d.profiles?d:defaultData()}catch{return defaultData()}}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
function activeProfile(){return data.activeProfile||"self"}
function own(arr){return arr.filter(x=>x.profileId===activeProfile())}
function showForm(id){$(id).classList.remove("hidden");$(id).scrollIntoView({behavior:"smooth"})}
function hideForm(id){$(id).classList.add("hidden")}
function resetForm(id){$(id).reset();let h=$(id).querySelector('input[type="hidden"]');if(h)h.value=""}

/* Navigation */
const titles={home:"Home",records:"Medical Records",medicines:"Medicines",appointments:"Doctor Appointments",timeline:"Health Timeline",profile:"Profile",settings:"Settings",about:"How it works"};
function navigate(page){
 if(!titles[page])page="home";
 $$(".page").forEach(p=>p.classList.toggle("active",p.id===page));
 $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 $("#pageTitle").textContent=titles[page];$("#sidebar").classList.remove("open");
 history.replaceState(null,"","#"+page);renderAll();window.scrollTo({top:0,behavior:"smooth"});
}
$$("[data-page]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();navigate(b.dataset.page)}));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)));

/* IndexedDB document storage */
function openDB(){return new Promise((resolve,reject)=>{
 let r=indexedDB.open(DB_NAME,1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:"id"})};
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
})}
async function saveFile(file){if(!file)return null;let db=await openDB(),id=uid();return new Promise((resolve,reject)=>{
 let tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put({id,name:file.name,type:file.type,blob:file});
 tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error);
})}
async function getFile(id){if(!id)return null;let db=await openDB();return new Promise((resolve,reject)=>{
 let r=db.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
})}
async function deleteFile(id){if(!id)return;let db=await openDB();return new Promise(resolve=>{let tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);tx.oncomplete=resolve})}
async function clearFiles(){let db=await openDB();return new Promise(resolve=>{let tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).clear();tx.oncomplete=resolve})}

/* Records */
$("#toggleRecordForm").onclick=()=>showForm("#recordForm");
$("#cancelRecord").onclick=()=>{resetForm("recordForm");hideForm("#recordForm")};
$("#recordForm").onsubmit=async e=>{
 e.preventDefault();let id=$("#recordId").value,old=data.records.find(x=>x.id===id),file=$("#recordFile").files[0];
 let fileId=old?.fileId||null,fileName=old?.fileName||"";
 try{if(file){fileId=await saveFile(file);fileName=file.name}}catch{return toast("Unable to save file")}
 let r={id:id||uid(),profileId:activeProfile(),name:$("#recordName").value.trim(),type:$("#recordType").value,date:$("#recordDate").value,doctor:$("#recordDoctor").value.trim(),notes:$("#recordNotes").value.trim(),fileId,fileName};
 if(old)Object.assign(old,r);else data.records.push(r);
 saveData();resetForm("recordForm");hideForm("#recordForm");toast("Record saved");
};
$("#recordSearch").oninput=renderRecords;$("#recordFilter").onchange=renderRecords;
function renderRecords(){
 let q=$("#recordSearch").value.toLowerCase(),f=$("#recordFilter").value;
 let a=own(data.records).filter(r=>(`${r.name} ${r.doctor} ${r.notes}`).toLowerCase().includes(q)&&(f==="all"||r.type===f)).sort((x,y)=>y.date.localeCompare(x.date));
 $("#recordList").innerHTML=a.length?a.map(r=>`<article class="record-card"><div class="record-icon">▤</div><h3>${escapeHTML(r.name)}</h3><span class="badge">${escapeHTML(r.type)}</span><p>${formatDate(r.date)}</p><p>${escapeHTML(r.doctor||"")}</p><p>${escapeHTML(r.notes||"")}</p><small>${escapeHTML(r.fileName||"No document")}</small><div class="record-actions">${r.fileId?`<button class="small-btn" data-view="${r.id}">View</button>`:""}<button class="small-btn" data-edit-record="${r.id}">Edit</button><button class="small-btn" data-delete-record="${r.id}">Delete</button></div></article>`).join(""):`<div class="empty-state">No medical records found.</div>`;
}
$("#recordList").onclick=async e=>{
 if(e.target.dataset.view)await viewRecord(e.target.dataset.view);
 if(e.target.dataset.editRecord)editRecord(e.target.dataset.editRecord);
 if(e.target.dataset.deleteRecord)deleteRecord(e.target.dataset.deleteRecord);
};
async function viewRecord(id){
 let r=data.records.find(x=>x.id===id),f=await getFile(r?.fileId);if(!f)return toast("File not found");
 let url=URL.createObjectURL(f.blob);$("#viewerTitle").textContent=r.name;
 if(f.type==="application/pdf"){$("#pdfFrame").style.display="block";$("#imageFrame").style.display="none";$("#pdfFrame").src=url}
 else if(f.type.startsWith("image/")){$("#pdfFrame").style.display="none";$("#imageFrame").style.display="block";$("#imageFrame").src=url}
 else return toast("Unsupported file");
 $("#viewerDialog").showModal();$("#viewerDialog").addEventListener("close",()=>{URL.revokeObjectURL(url);$("#pdfFrame").src="";$("#imageFrame").src=""},{once:true});
}
$("#closeViewer").onclick=()=>$("#viewerDialog").close();
function editRecord(id){let r=data.records.find(x=>x.id===id);if(!r)return;
 $("#recordId").value=r.id;$("#recordName").value=r.name;$("#recordType").value=r.type;$("#recordDate").value=r.date;$("#recordDoctor").value=r.doctor;$("#recordNotes").value=r.notes;$("#recordFormTitle").textContent="Edit record";showForm("#recordForm")}
async function deleteRecord(id){if(!confirm("Delete this record?"))return;let r=data.records.find(x=>x.id===id);await deleteFile(r?.fileId);data.records=data.records.filter(x=>x.id!==id);saveData();toast("Record deleted")}

/* Medicines */
$("#toggleMedicineForm").onclick=()=>showForm("#medicineForm");
$("#cancelMedicine").onclick=()=>{resetForm("medicineForm");hideForm("#medicineForm");$("#medicineImagePreview").innerHTML=""};
function calculateEnd(){let s=$("#medicineStart").value,m=Number($("#medicineMonths").value);if(!s||!m)return $("#medicineEnd").value="";let d=new Date(s+"T00:00:00");d.setMonth(d.getMonth()+m);d.setDate(d.getDate()-1);$("#medicineEnd").value=d.toISOString().slice(0,10)}
$("#medicineStart").onchange=calculateEnd;$("#medicineMonths").oninput=calculateEnd;
$("#medicineImage").onchange=()=>{let f=$("#medicineImage").files[0];$("#medicineImagePreview").innerHTML=f?`<img src="${URL.createObjectURL(f)}" alt="Medicine photo preview">`:""};
$("#medicineForm").onsubmit=async e=>{
 e.preventDefault();let id=$("#medicineId").value,old=data.medicines.find(x=>x.id===id),file=$("#medicineImage").files[0],imageId=old?.imageId||null;
 try{if(file)imageId=await saveFile(file)}catch{return toast("Unable to save photo")}
 let m={id:id||uid(),profileId:activeProfile(),name:$("#medicineName").value.trim(),strength:$("#medicineStrength").value.trim(),purpose:$("#medicinePurpose").value.trim(),start:$("#medicineStart").value,months:+$("#medicineMonths").value,end:$("#medicineEnd").value,occasion:$("#medicineOccasion").value,times:[$("#medicineTime").value,$("#medicineTime2").value].filter(Boolean),instructions:$("#medicineInstructions").value.trim(),imageId,active:true,completed:old?.completed||{}};
 if(old)Object.assign(old,m);else data.medicines.push(m);
 saveData();resetForm("medicineForm");hideForm("#medicineForm");$("#medicineImagePreview").innerHTML="";toast("Medicine saved");
};
function medicineActive(m){return m.active&&today()>=m.start&&today()<=m.end}
async function renderMedicines(){
 let ms=own(data.medicines),active=ms.filter(medicineActive);
 $("#medicineList").innerHTML=active.length?active.map(m=>`<article class="medicine-card"><div class="medicine-image-holder" data-image="${m.imageId||""}">💊</div><h3>${escapeHTML(m.name)}</h3><span class="badge">${escapeHTML(m.strength||"Medicine")}</span><p>${escapeHTML(m.purpose||"")}</p><p>${escapeHTML(m.occasion)} · ${m.times.map(formatTime).join(", ")}</p><p>${formatDate(m.start)} – ${formatDate(m.end)}</p><p>${escapeHTML(m.instructions||"")}</p><div class="medicine-actions"><button class="small-btn" data-edit-medicine="${m.id}">Edit</button><button class="small-btn" data-stop-medicine="${m.id}">End plan</button></div></article>`).join(""):`<div class="empty-state">No active medicines.</div>`;
 $("#medicineHistory").innerHTML=ms.filter(m=>!m.active||today()>m.end).map(m=>`<div class="list-item"><div><h4>${escapeHTML(m.name)}</h4><p>${formatDate(m.start)} – ${formatDate(m.end)}</p></div><span class="badge">Completed plan</span></div>`).join("")||`<div class="empty-state">Medicine history will appear here.</div>`;
 // Show actual photos in medicine cards
 for(let holder of $$(".medicine-image-holder")){
  let id=holder.dataset.image;if(!id)continue;
  try{let f=await getFile(id);if(f){let url=URL.createObjectURL(f.blob);holder.innerHTML=`<img class="medicine-photo" src="${url}" alt="Medicine photo">`}}catch{}
 }
 await renderTodayDoses();
}
$("#medicineList").onclick=e=>{if(e.target.dataset.editMedicine)editMedicine(e.target.dataset.editMedicine);if(e.target.dataset.stopMedicine)stopMedicine(e.target.dataset.stopMedicine)};
function editMedicine(id){let m=data.medicines.find(x=>x.id===id);if(!m)return;
 $("#medicineId").value=m.id;$("#medicineName").value=m.name;$("#medicineStrength").value=m.strength;$("#medicinePurpose").value=m.purpose;$("#medicineStart").value=m.start;$("#medicineMonths").value=m.months;$("#medicineEnd").value=m.end;$("#medicineOccasion").value=m.occasion;$("#medicineTime").value=m.times[0]||"08:00";$("#medicineTime2").value=m.times[1]||"";$("#medicineInstructions").value=m.instructions;$("#medicineFormTitle").textContent="Edit medicine";showForm("#medicineForm")}
function stopMedicine(id){if(!confirm("End this medicine plan?"))return;data.medicines.find(x=>x.id===id).active=false;saveData();toast("Medicine plan ended")}

/* Today's doses with actual uploaded tablet images */
async function renderTodayDoses(){
 let doses=[];
 own(data.medicines).filter(medicineActive).forEach(m=>m.times.forEach((time,index)=>{
  let doseId=`${m.id}::${index}`;
  doses.push({medicine:m,time,doseId,done:m.completed[today()]?.includes(doseId)});
 }));
 doses.sort((a,b)=>Number(a.done)-Number(b.done)||a.time.localeCompare(b.time));
 if(!doses.length){$("#todayDoseList").innerHTML=`<div class="empty-state">No doses scheduled today.</div>`;return}
 let html=await Promise.all(doses.map(async d=>{
  let photo=`<div class="dose-photo-placeholder">💊</div>`;
  if(d.medicine.imageId){try{let f=await getFile(d.medicine.imageId);if(f){let url=URL.createObjectURL(f.blob);photo=`<img class="dose-photo" src="${url}" alt="${escapeHTML(d.medicine.name)} tablet">`}}catch{}}
  return `<div class="dose-row ${d.done?"done":""}">
   <div class="dose-medicine">${photo}<div class="dose-details"><strong>${escapeHTML(d.medicine.name)}</strong><p>${formatTime(d.time)} · ${escapeHTML(d.medicine.occasion)}</p><small>${escapeHTML(d.medicine.strength||"")}</small></div></div>
   <button class="small-btn" data-dose="${d.doseId}" ${d.done?"disabled":""}>${d.done?"✓ Done":"Mark done"}</button>
  </div>`;
 }));
 $("#todayDoseList").innerHTML=html.join("");
}
$("#todayDoseList").onclick=e=>{
 let doseId=e.target.dataset.dose;if(!doseId)return;
 let [medicineId,index]=doseId.split("::");
 let m=data.medicines.find(x=>x.id===medicineId);if(!m)return;
 m.completed[today()]||=[];
 if(!m.completed[today()].includes(doseId))m.completed[today()].push(doseId);
 saveData();toast("Dose marked done");
};

/* Appointments */
$("#toggleAppointmentForm").onclick=()=>showForm("#appointmentForm");
$("#cancelAppointment").onclick=()=>{resetForm("appointmentForm");hideForm("#appointmentForm")};
$("#appointmentForm").onsubmit=e=>{
 e.preventDefault();let id=$("#appointmentId").value;
 let a={id:id||uid(),profileId:activeProfile(),doctor:$("#doctorName").value.trim(),speciality:$("#doctorSpeciality").value,date:$("#appointmentDate").value,time:$("#appointmentTime").value,place:$("#appointmentPlace").value.trim(),phone:$("#appointmentPhone").value.trim(),notes:$("#appointmentNotes").value.trim()};
 let old=data.appointments.find(x=>x.id===id);if(old)Object.assign(old,a);else data.appointments.push(a);
 saveData();resetForm("appointmentForm");hideForm("#appointmentForm");toast("Appointment saved");
};
$("#appointmentPrev").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};
$("#appointmentNext").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};
function renderCalendar(){
 let y=calendarDate.getFullYear(),mo=calendarDate.getMonth(),first=new Date(y,mo,1).getDay(),days=new Date(y,mo+1,0).getDate();
 $("#appointmentMonthLabel").textContent=calendarDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
 let html="";for(let i=0;i<first;i++)html+="<span></span>";
 for(let d=1;d<=days;d++){let date=`${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,event=own(data.appointments).some(a=>a.date===date);
 html+=`<button class="calendar-day ${date===today()?"today":""} ${date===selectedDay?"selected":""} ${event?"has-event":""}" data-day="${date}">${d}</button>`}
 $("#appointmentCalendar").innerHTML=html;renderCalendarDetails();
}
$("#appointmentCalendar").onclick=e=>{if(e.target.dataset.day){selectedDay=e.target.dataset.day;renderCalendar()}};
function renderCalendarDetails(){let a=own(data.appointments).filter(x=>x.date===selectedDay).sort((x,y)=>x.time.localeCompare(y.time));
 $("#appointmentDayDetail").innerHTML=`<h4>${formatDate(selectedDay)}</h4>${a.length?a.map(x=>`<p><strong>${formatTime(x.time)}</strong> · ${escapeHTML(x.doctor)} (${escapeHTML(x.speciality)})</p>`).join(""):"<p>No appointments on this date.</p>"}`}
function renderAppointments(){
 let a=own(data.appointments).sort((x,y)=>x.date.localeCompare(y.date)||x.time.localeCompare(y.time));
 $("#appointmentList").innerHTML=a.length?a.map(x=>`<div class="list-item"><div><h4>${escapeHTML(x.doctor)} <span class="badge">${escapeHTML(x.speciality)}</span></h4><p>${formatDate(x.date)} · ${formatTime(x.time)}</p><p>${escapeHTML(x.place||"")}</p>${x.notes?`<p>${escapeHTML(x.notes)}</p>`:""}${x.place?`<a class="text-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.place)}">Open in Maps ↗</a>`:""}${x.phone?`<a class="text-btn" href="tel:${escapeHTML(x.phone)}">Call clinic</a>`:""}</div><div class="item-actions"><button class="small-btn" data-edit-appointment="${x.id}">Edit</button><button class="small-btn" data-delete-appointment="${x.id}">Delete</button></div></div>`).join(""):`<div class="empty-state">No appointments.</div>`;
 let next=a.find(x=>x.date>=today());$("#nextAppointment").innerHTML=next?`<strong>${escapeHTML(next.doctor)}</strong><p>${formatDate(next.date)} · ${formatTime(next.time)}</p><p>${escapeHTML(next.place||"")}</p>`:`<div class="empty-state">No upcoming appointment.</div>`;
}
$("#appointmentList").onclick=e=>{if(e.target.dataset.editAppointment)editAppointment(e.target.dataset.editAppointment);if(e.target.dataset.deleteAppointment)deleteAppointment(e.target.dataset.deleteAppointment)};
function editAppointment(id){let a=data.appointments.find(x=>x.id===id);if(!a)return;
 $("#appointmentId").value=a.id;$("#doctorName").value=a.doctor;$("#doctorSpeciality").value=a.speciality;$("#appointmentDate").value=a.date;$("#appointmentTime").value=a.time;$("#appointmentPlace").value=a.place;$("#appointmentPhone").value=a.phone;$("#appointmentNotes").value=a.notes;$("#appointmentFormTitle").textContent="Edit appointment";showForm("#appointmentForm")}
function deleteAppointment(id){if(!confirm("Delete appointment?"))return;data.appointments=data.appointments.filter(x=>x.id!==id);saveData();toast("Appointment deleted")}

/* Family profiles */
$("#profileForm").onsubmit=e=>{e.preventDefault();data.profiles.push({id:uid(),name:$("#profileName").value.trim(),relation:$("#profileRelation").value});$("#profileForm").reset();saveData();toast("Profile added")};
function renderProfiles(){
 $("#profileList").innerHTML=data.profiles.map(p=>`<div class="profile-card ${p.id===activeProfile()?"active-profile":""}"><div><strong>${escapeHTML(p.name)}</strong><p>${escapeHTML(p.relation)}</p></div><div class="item-actions"><button class="small-btn" data-select-profile="${p.id}">Select</button>${p.id!=="self"?`<button class="small-btn" data-delete-profile="${p.id}">Delete</button>`:""}</div></div>`).join("");
 $("#sidebarProfileName").textContent=data.profiles.find(p=>p.id===activeProfile())?.name||"My Profile";
}
$("#profileList").onclick=e=>{if(e.target.dataset.selectProfile){data.activeProfile=e.target.dataset.selectProfile;saveData();toast("Profile switched")}if(e.target.dataset.deleteProfile)deleteProfile(e.target.dataset.deleteProfile)};
async function deleteProfile(id){if(!confirm("Delete profile and its information?"))return;for(let r of data.records.filter(x=>x.profileId===id))await deleteFile(r.fileId);data.profiles=data.profiles.filter(x=>x.id!==id);data.records=data.records.filter(x=>x.profileId!==id);data.medicines=data.medicines.filter(x=>x.profileId!==id);data.appointments=data.appointments.filter(x=>x.profileId!==id);delete data.emergency[id];if(data.activeProfile===id)data.activeProfile="self";saveData();toast("Profile deleted")}

/* Emergency card */
function renderEmergency(){let e=data.emergency[activeProfile()]||{};$("#bloodGroup").value=e.bloodGroup||"";$("#emergencyAllergies").value=e.allergies||"";$("#emergencyConditions").value=e.conditions||"";$("#emergencyContactName").value=e.contactName||"";$("#emergencyRelationship").value=e.relationship||"";$("#emergencyCountry").value=e.country||"+91";$("#emergencyPhone").value=e.phone||"";$("#emergencySummary").textContent=e.contactName?`Emergency contact: ${e.contactName} · ${e.country} ${e.phone}`:"No emergency contact saved"}
$("#emergencyForm").onsubmit=e=>{e.preventDefault();let country=$("#emergencyCountry").value,phone=$("#emergencyPhone").value.trim();if(country==="+91"&&!/^[6-9]\d{9}$/.test(phone))return toast("Enter valid 10-digit Indian mobile number");data.emergency[activeProfile()]={bloodGroup:$("#bloodGroup").value,allergies:$("#emergencyAllergies").value.trim(),conditions:$("#emergencyConditions").value.trim(),contactName:$("#emergencyContactName").value.trim(),relationship:$("#emergencyRelationship").value.trim(),country,phone};saveData();toast("Emergency information saved")};

/* Timeline */
function renderTimeline(){let events=[...own(data.records).map(x=>({date:x.date,title:x.name,description:x.type,icon:"▤"})),...own(data.appointments).map(x=>({date:x.date,title:x.doctor,description:"Appointment · "+x.speciality,icon:"▦"})),...own(data.medicines).map(x=>({date:x.start,title:x.name,description:"Medicine plan started",icon:"💊"}))].sort((x,y)=>y.date.localeCompare(x.date));
 $("#timelineList").innerHTML=events.length?events.map(x=>`<article class="timeline-item"><span class="badge">${formatDate(x.date)}</span><h3>${x.icon} ${escapeHTML(x.title)}</h3><p>${escapeHTML(x.description)}</p></article>`).join(""):`<div class="empty-state">Your timeline will appear here.</div>`}

/* Settings and backup */
function applyTheme(){document.body.dataset.theme=data.theme||"light";$("#themeToggle").textContent=data.theme==="dark"?"☾":"☀"}
function toggleTheme(){data.theme=data.theme==="dark"?"light":"dark";applyTheme();saveData()}
$("#themeToggle").onclick=toggleTheme;$("#settingsTheme").onclick=toggleTheme;
$("#largeText").onchange=e=>document.body.classList.toggle("large-text",e.target.checked);
$("#downloadBackup").onclick=()=>{let url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=`HealthMemory-${today()}.json`;a.click();URL.revokeObjectURL(url);toast("Backup downloaded")};
$("#restoreBackup").onchange=async e=>{try{let d=JSON.parse(await e.target.files[0].text());if(!d.profiles||!Array.isArray(d.records)||!Array.isArray(d.medicines)||!Array.isArray(d.appointments))throw Error();if(confirm("Replace current data with backup?")){data=d;saveData();toast("Backup restored")}}catch{toast("Invalid backup")}e.target.value=""};
$("#clearData").onclick=async()=>{if(!confirm("Delete all HealthMemory data?"))return;if(!confirm("This cannot be undone. Continue?"))return;await clearFiles();data=defaultData();saveData();toast("Data cleared")};

/* Dashboard */
function renderHome(){$("#recordCount").textContent=own(data.records).length;$("#medicineCount").textContent=own(data.medicines).filter(medicineActive).length;$("#appointmentCount").textContent=own(data.appointments).filter(a=>a.date>=today()).length;$("#familyCount").textContent=data.profiles.length}
function renderAll(){renderHome();renderRecords();renderMedicines();renderAppointments();renderCalendar();renderProfiles();renderEmergency();renderTimeline();applyTheme()}
$("#todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
$("#recordDate").value=today();$("#medicineStart").value=today();$("#appointmentDate").value=today();calculateEnd();
if(location.hash&&titles[location.hash.slice(1)])navigate(location.hash.slice(1));else navigate("home");

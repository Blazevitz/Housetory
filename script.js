const $ = id => document.getElementById(id);
const SUPABASE_URL = window.HOUSETORY_SUPABASE_URL;
const SUPABASE_ANON_KEY = window.HOUSETORY_SUPABASE_ANON_KEY;
let supabase = null, items = [], selectedItemId = null, scanner = null, currentUser = null, currentProfile = null, realtimeChannel = null;
const money = n => "₱" + Number(n || 0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusClass = s => "status status-"+String(s).replace(/\s/g,"-");
const badge = s => `<span class="${statusClass(s)}">${esc(s)}</span>`;

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800);}
function setAuthMessage(msg){$("authMessage").textContent=msg;}
function showAuth(show){$("authGate").classList.toggle("hidden",!show);document.querySelector(".sidebar").classList.toggle("app-locked",show);document.querySelector(".main").classList.toggle("app-locked",show);}
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===name));document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===name));$("pageTitle").textContent={overview:"Overview",inventory:"Inventory",scanner:"QR Scanner",reports:"Reports"}[name]||"Overview";}
function render(){
  $("totalStat").textContent=items.length;
  $("availableStat").textContent=items.filter(x=>x.status==="Available").length;
  $("inUseStat").textContent=items.filter(x=>x.status==="In Use").length;
  $("attentionStat").textContent=items.filter(x=>["Damaged","Missing"].includes(x.status)).length;
  $("recentRows").innerHTML=items.slice(0,5).map(x=>`<tr><td class="item-cell">${esc(x.name)}</td><td>${esc(x.id)}</td><td>${esc(x.location||"—")}</td><td>${badge(x.status)}</td></tr>`).join("")||`<tr><td colspan="4">No inventory yet.</td></tr>`;
  const q=$("searchInput").value.toLowerCase(),st=$("statusFilter").value,cat=$("categoryFilter").value;
  const filtered=items.filter(x=>(x.name+" "+x.id).toLowerCase().includes(q)&&(!st||x.status===st)&&(!cat||x.category===cat));
  $("inventoryRows").innerHTML=filtered.map(x=>`<tr><td class="item-cell">${esc(x.name)}</td><td>${esc(x.id)}</td><td>${esc(x.category)}</td><td>${esc(x.location||"—")}</td><td>${badge(x.status)}</td><td>${money(x.value)}</td><td><div class="row-actions"><button class="mini-btn" data-detail="${esc(x.id)}">View / QR</button><button class="mini-btn" data-edit="${esc(x.id)}">Edit</button></div></td></tr>`).join("");
  $("emptyState").classList.toggle("hidden",filtered.length>0);
  $("valueStat").textContent=money(items.reduce((a,x)=>a+Number(x.value||0),0));
  $("damagedStat").textContent=items.filter(x=>x.status==="Damaged").length;
  $("missingStat").textContent=items.filter(x=>x.status==="Missing").length;
  const statuses=["Available","In Use","Damaged","Missing","In Laundry"];
  $("statusBars").innerHTML=statuses.map(s=>{let n=items.filter(x=>x.status===s).length,p=items.length?Math.round(n/items.length*100):0;return `<div class="bar-row"><span>${s}</span><div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div><b>${n}</b></div>`}).join("");
}
function normalizeRow(row){return {id:row.item_id,name:row.name,category:row.category,status:row.status,location:row.location||"",value:Number(row.value||0),notes:row.notes||"",created_at:row.created_at,updated_at:row.updated_at};}
async function loadItems(){
  const {data,error}=await supabase.from("inventory_items").select("*").order("created_at",{ascending:false});
  if(error){toast("Could not load inventory: "+error.message);return;}
  items=(data||[]).map(normalizeRow);render();
}
function toDatabase(item){return {item_id:item.id,name:item.name,category:item.category,status:item.status,location:item.location||null,value:Number(item.value||0),notes:item.notes||null,updated_by:currentUser.id};}
function openForm(item=null){
  $("itemForm").reset();$("editId").value=item?.id||"";$("modalTitle").textContent=item?"Edit item":"Register item";
  $("itemName").value=item?.name||"";$("itemId").value=item?.id||"";$("itemId").disabled=!!item;
  $("itemCategory").value=item?.category||"Bed Linen";$("itemStatus").value=item?.status||"Available";
  $("itemLocation").value=item?.location||"";$("itemValue").value=item?.value??"";$("itemNotes").value=item?.notes||"";
  $("itemModal").classList.remove("hidden");
}
function closeModals(){document.querySelectorAll(".modal-backdrop").forEach(x=>x.classList.add("hidden"));}
function showDetail(id){
  const x=items.find(i=>i.id.toLowerCase()===String(id).toLowerCase());
  if(!x){toast("No item found for that ID.");return;}
  selectedItemId=x.id;$("detailName").textContent=x.name;$("qrLabel").textContent=x.id;
  $("detailFields").innerHTML=[["Item ID",x.id],["Category",x.category],["Status",x.status],["Location / Room",x.location||"Not set"],["Item value",money(x.value)],["Notes",x.notes||"None"]].map(([a,b])=>`<div class="detail-field"><small>${a}</small><b>${esc(b)}</b></div>`).join("");
  $("qrCode").innerHTML="";
  if(window.QRCode){new QRCode($("qrCode"),{text:x.id,width:140,height:140,colorDark:"#17283e",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});}
  else $("qrCode").textContent="QR library unavailable. Check internet connection.";
  $("detailModal").classList.remove("hidden");
}
async function saveItem(e){
  e.preventDefault();
  const old=$("editId").value,id=$("itemId").value.trim();
  if(!old&&items.some(x=>x.id.toLowerCase()===id.toLowerCase())){toast("That item ID already exists.");return;}
  const item={name:$("itemName").value.trim(),id,category:$("itemCategory").value,status:$("itemStatus").value,location:$("itemLocation").value.trim(),value:Number($("itemValue").value||0),notes:$("itemNotes").value.trim()};
  const payload=toDatabase(item);
  const result=old
    ? await supabase.from("inventory_items").update(payload).eq("item_id",old).select().single()
    : await supabase.from("inventory_items").insert(payload).select().single();
  if(result.error){toast("Save failed: "+result.error.message);return;}
  closeModals();await loadItems();toast(old?"Item updated for all staff.":"Item registered for all staff.");
}
async function deleteSelected(){
  if(!selectedItemId||currentProfile?.role!=="admin"){toast("Only an administrator can delete inventory.");return;}
  if(!confirm(`Delete ${selectedItemId}? This cannot be undone.`))return;
  const {error}=await supabase.from("inventory_items").delete().eq("item_id",selectedItemId);
  if(error){toast("Delete failed: "+error.message);return;}
  closeModals();await loadItems();toast("Item deleted.");
}
async function signIn(e){
  e.preventDefault();$("loginBtn").disabled=true;setAuthMessage("Signing in…");
  const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
  $("loginBtn").disabled=false;
  if(error){setAuthMessage(error.message);return;}
  await activateSession(data.session);
}
async function activateSession(session){
  if(!session){currentUser=null;currentProfile=null;showAuth(true);$("currentUser").textContent="";return;}
  currentUser=session.user;
  const {data:profile,error}=await supabase.from("profiles").select("display_name,role").eq("id",currentUser.id).single();
  if(error){await supabase.auth.signOut();setAuthMessage("Your staff profile is not configured. Ask the administrator to check the profiles table.");showAuth(true);return;}
  currentProfile=profile;
  $("currentUser").textContent=`${profile.display_name||currentUser.email} · ${profile.role}`;
  $("deleteDetail").classList.toggle("hidden",profile.role!=="admin");
  showAuth(false);await loadItems();subscribeToChanges();
}
function subscribeToChanges(){
  if(realtimeChannel)supabase.removeChannel(realtimeChannel);
  realtimeChannel=supabase.channel("housetory-inventory-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"inventory_items"},()=>loadItems())
    .subscribe();
}
async function startApp(){
  $("today").textContent=new Date().toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
  if(!window.supabase||!SUPABASE_URL||!SUPABASE_ANON_KEY||SUPABASE_URL.includes("PASTE_YOUR")){
    showAuth(true);$("loginForm").classList.add("config-error");
    setAuthMessage("Setup required: add your Supabase Project URL and anon/public key in supabase-config.js, then redeploy.");
    $("loginBtn").disabled=true;return;
  }
  supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
    auth:{persistSession:true,autoRefreshToken:true}
  });
  $("loginForm").addEventListener("submit",signIn);
  $("signOutBtn").addEventListener("click",async()=>{if(scanner){try{await scanner.stop();}catch{}}await supabase.auth.signOut();if(realtimeChannel)supabase.removeChannel(realtimeChannel);showAuth(true);});
  const {data:{session}}=await supabase.auth.getSession();await activateSession(session);
  supabase.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>activateSession(session),0);});
}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.goto)));
$("addTop").onclick=$("addInventory").onclick=$("quickAdd").onclick=()=>openForm();
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeModals));
$("itemForm").addEventListener("submit",saveItem);
["searchInput","statusFilter","categoryFilter"].forEach(id=>$(id).addEventListener("input",render));
document.addEventListener("click",e=>{const d=e.target.closest("[data-detail]"),ed=e.target.closest("[data-edit]");if(d)showDetail(d.dataset.detail);if(ed){const item=items.find(x=>x.id===ed.dataset.edit);if(item)openForm(item);}});
$("editDetail").onclick=()=>{const x=items.find(i=>i.id===selectedItemId);closeModals();if(x)openForm(x);};
$("deleteDetail").onclick=deleteSelected;
$("lookupId").onclick=()=>showDetail($("manualId").value.trim());
$("manualId").addEventListener("keydown",e=>{if(e.key==="Enter")$("lookupId").click();});
$("printQr").onclick=()=>{const content=$("qrCode").innerHTML,label=$("qrLabel").textContent,w=window.open("","_blank","width=360,height=420");if(!w){toast("Allow pop-ups to print QR labels.");return;}w.document.write(`<html><head><title>QR ${esc(label)}</title><style>body{font-family:Arial;text-align:center;padding:30px}img{width:220px;height:220px}h3{font-size:18px}</style></head><body><h3>${esc(label)}</h3>${content}<p>Housetory Hotel Inventory</p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();};
$("exportCsv").onclick=()=>{const rows=[["Item Name","Item ID","Category","Location","Status","Value","Notes"],...items.map(x=>[x.name,x.id,x.category,x.location,x.status,x.value,x.notes])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));a.download="housetory-inventory.csv";a.click();URL.revokeObjectURL(a.href);};
$("startScan").onclick=async()=>{
  if(!window.Html5Qrcode){toast("Scanner library unavailable. Check internet.");return;}
  try{scanner=new Html5Qrcode("reader");await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:220}},async text=>{await scanner.stop();scanner=null;$("startScan").classList.remove("hidden");$("stopScan").classList.add("hidden");showDetail(text);},()=>{});$("startScan").classList.add("hidden");$("stopScan").classList.remove("hidden");}
  catch(err){toast("Camera unavailable. Use HTTPS and allow camera access.");}
};
$("stopScan").onclick=async()=>{if(scanner){await scanner.stop();scanner=null;}$("startScan").classList.remove("hidden");$("stopScan").classList.add("hidden");};
startApp();

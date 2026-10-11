(function(){
/* errori della pagina: nel registro (Documenti\\Tornei Fragmarathon\\errori.log) invece di bloccare tutto */
(function(){if(!window.desk||!window.desk.logError)return;var n=0;
  window.addEventListener("error",function(e){if(n++<50)window.desk.logError("errore",(e.message||"")+" @ "+(e.filename||"").split("/").pop()+":"+e.lineno+(e.error&&e.error.stack?"\n"+e.error.stack:""))});
  window.addEventListener("unhandledrejection",function(e){if(n++<50)window.desk.logError("promessa",String(e.reason&&e.reason.stack||e.reason))});
})();
/* tastiere cinese e giapponese: Invio ed Esc che confermano o annullano la composizione non sono comandi della pagina */
document.addEventListener("keydown",function(e){if(e.isComposing||e.keyCode===229)e.stopImmediatePropagation()},true);
var KEY="tornei-v2",WALL=/[?&]wall=1/.test(location.search);
var DEF={quake:{l:"QUAKE LIVE",m:"ffa",t:0},tf2:{l:"Team Fortress 2",m:"elim",t:1},wreck:{l:"Wreckfest",m:"ffa",t:0},cs2:{l:"Counter-Strike 2",m:"elim",t:1},fifa:{l:"FIFA 26",m:"ffa",t:0}};
var BUILTIN=Object.keys(DEF),ORIGL={},ORIGD=JSON.parse(JSON.stringify(DEF));BUILTIN.forEach(function(k){ORIGL[k]=DEF[k].l});
var UI0={title:"Tornei Fragmarathon",sub:"Gestione dei tornei del 27° Lanparty"};
function fresh(k){return{name:"",mode:DEF[k].m,ng:2,players:[],members:{},phase:"setup",groups:null,rounds:null}}
var S={cur:"quake",roster:[],games:{}};
try{var raw=localStorage.getItem(KEY);if(raw){var p=JSON.parse(raw);if(p&&p.games)S=p;}}catch(e){}
function initS(){S.v=2;if(!S.games||typeof S.games!=="object"||Array.isArray(S.games))S.games={};if(!S.roster)S.roster=[];if(!S.teams)S.teams=[];if(!S.ui)S.ui={};if(!S.names||typeof S.names!=="object")S.names={};if(!Array.isArray(S.custom))S.custom=[];if(!S.disc||typeof S.disc!=="object")S.disc={}}
function registerCustom(){
  Object.keys(DEF).forEach(function(k){delete DEF[k]});
  var off=Array.isArray(S.off)?S.off:[];BUILTIN.forEach(function(k){if(off.indexOf(k)<0)DEF[k]=JSON.parse(JSON.stringify(ORIGD[k]))});
  S.custom.forEach(function(c){if(!c||!c.k)return;DEF[c.k]={l:c.l,m:(["elim","double","swiss","rr"].indexOf(c.m)>=0?c.m:"ffa"),t:c.t}});
  Object.keys(S.names).forEach(function(k){if(DEF[k]&&S.names[k])DEF[k].l=S.names[k]});
}
function normGames(){Object.keys(DEF).forEach(function(k){if(!S.games[k]||typeof S.games[k]!=="object")S.games[k]=fresh(k);var gg=S.games[k];if(!Array.isArray(gg.players))gg.players=[];if(gg.mode==="gironi"||gg.mode==="solo"){gg.mode="ffa";if(gg.phase!=="setup"){gg.phase="setup";gg.running=false;gg.dirty=false;gg.groups=null;gg.rounds=null;gg.third=null}}if(gg.running===undefined)gg.running=gg.phase!=="setup";
  /* dati da file (Riprendi, backup): numeri come numeri e nomi dei campi FFA validi, così non finiscono come markup nella pagina */
  if(gg.sw&&typeof gg.sw==="object"){if(gg.sw.nr!=null)gg.sw.nr=+gg.sw.nr||0;if(gg.sw.top!=null)gg.sw.top=+gg.sw.top||0}
  if(gg.calc&&Array.isArray(gg.calc.fields))gg.calc.fields=gg.calc.fields.map(function(f){return{k:calcKey(f&&f.k),l:String((f&&f.l)||"")}})})}
function applyUi(){
  var h=document.querySelector(".brand h1"),tg=document.querySelector(".brand .tag"),t=S.ui.title||UI0.title;if(h)h.textContent=t;if(tg)tg.textContent=S.ui.sub||UI0.sub;document.title=t;
  /* logo dell'evento: quello caricato dall'utente o quello di base */
  var em=document.querySelector(".brand img.emblem"),lf=document.getElementById("logoFull");
  if(!applyUi.def)applyUi.def={em:em&&em.getAttribute("src"),lf:lf&&lf.getAttribute("src")};
  if(em)em.setAttribute("src",S.ui.logo||applyUi.def.em);if(lf)lf.setAttribute("src",S.ui.logo||applyUi.def.lf);
  /* CSS personalizzato: in fondo al <head>, sopra a tema e stili di base */
  var cs=document.getElementById("customcss");if(!cs){cs=document.createElement("style");cs.id="customcss";document.head.appendChild(cs)}
  if(cs.textContent!==(S.ui.css||""))cs.textContent=S.ui.css||"";
  /* lingua del torneo: proiettore, immagini, PDF e bot */
  if(window.I18N)I18N.setEv((S.ev&&S.ev.lang)||"it");
}
/* vista aperta: un gioco del torneo o una delle schede fisse; se non c'è più, il primo gioco */
var VIEWS=["roster","squadre","results","hof","sala"];
function fixCur(){if(!DEF[S.cur]&&VIEWS.indexOf(S.cur)<0)S.cur=Object.keys(DEF)[0]||"roster"}
initS();registerCustom();normGames();
fixCur();
var hist=[],lastJ=null,SWAP=0,swapQ=[];
function nk(j){return j.replace(/"cur":"[^"]*"/,"")}
function save(){if(SWAP)return;var j=JSON.stringify(S),jk=nk(j);
  /* "Annulla cancellazione" vale finché dopo la cancellazione non cambia altro: il primo salvataggio è quello della cancellazione */
  if(lastDel){if(lastDel.after==null)lastDel.after=jk;else if(jk!==lastDel.after){lastDel=null;clearTimeout(delT);setTimeout(undoBtn)}}
  if(lastJ!==null&&jk!==nk(lastJ)){hist.push(lastJ);if(hist.length>60)hist.shift()}lastJ=j;var ok=true;try{localStorage.setItem(KEY,j)}catch(e){ok=false}afterSave(ok)}
/* Cancellazioni: prima si fotografa lo stato; per un minuto compare "Annulla cancellazione". */
var lastDel=null,delT=null;
function delSnap(label){
  lastDel={label:label,j:JSON.stringify(S),ev:S.ev&&S.ev.id,after:null};clearTimeout(delT);
  delT=setTimeout(function(){lastDel=null;undoBtn()},60000);setTimeout(undoBtn);
}
function undoBtn(){
  var t=$("tabs0");if(!t)return;var b=$("undodel");
  if(!lastDel){if(b)b.remove();return}
  if(!b){b=document.createElement("button");b.className="tab undodel";b.id="undodel";var sv=t.querySelector(".savest");t.insertBefore(b,sv||null)}
  b.textContent="Annulla cancellazione";b.title="Rimetti: "+lastDel.label;
}
function undoDel(){
  if(!lastDel)return;
  /* l'istantanea è di un altro torneo (si è cambiato evento): non si rimette */
  if(lastDel.ev&&lastDel.ev!==(S.ev&&S.ev.id)){lastDel=null;clearTimeout(delT);undoBtn();return}
  var cur=S.cur,l=lastDel.label;S=JSON.parse(lastDel.j);S.cur=cur;lastDel=null;clearTimeout(delT);
  initS();registerCustom();normGames();applyUi();fixCur();
  save();renderRoster();render();undoBtn();toast("Rimesso: "+l+".");
}
/* Rinominare un giocatore o una squadra: cambia il nome ovunque (elenco, squadre, tutti i giochi, risultati). */
var RN_SKIP={name:1,mode:1,phase:1,plat:1,logo:1,calc:1,file:1,draft:1,l:1,cfg:1};
/* le chiavi si rinominano solo nelle mappe per nome (componenti delle squadre, punteggi dei gironi):
   altrove "p", "s", "a", "b"... sono campi, e un giocatore che si chiama così non deve toccarli. vo: solo i valori */
var RN_KEYED={members:1,s:1,v:1};
function renameDeep(o,a,b,pk,vo){
  if(Array.isArray(o)){for(var i=0;i<o.length;i++){if(o[i]===a)o[i]=b;else if(o[i]&&typeof o[i]==="object")renameDeep(o[i],a,b,"",vo)}return}
  if(!o||typeof o!=="object")return;
  Object.keys(o).forEach(function(k){
    if(RN_SKIP[k])return;var v=o[k];
    if(!vo&&RN_KEYED[pk]&&k===a&&!Object.prototype.hasOwnProperty.call(o,b)){delete o[k];o[b]=v;k=b}
    if(v===a)o[k]=b;else if(v&&typeof v==="object")renameDeep(v,a,b,k,vo);
  });
}
/* tutti i nomi in uso, anche quelli che stanno solo dentro un gioco: [nome, 1 se è una squadra] */
function namesInUse(){
  var o=[];function add(x,t){if(typeof x==="string")o.push([x,t])}
  S.roster.forEach(function(x){add(x,0)});S.teams.forEach(function(t){add(t.n,1);(t.m||[]).forEach(function(x){add(x,0)})});
  Object.keys(S.games).forEach(function(k){var g=S.games[k];if(!g)return;var tm=g.team!==undefined?!!g.team:!!(DEF[k]&&DEF[k].t),mb=g.members||{};
    (g.players||[]).forEach(function(x){add(x,tm?1:0)});Object.keys(mb).forEach(function(t){add(t,1);(Array.isArray(mb[t])?mb[t]:[]).forEach(function(x){add(x,0)})})});
  return o;
}
function renameName(kind,a,b){
  b=String(b||"").trim();if(!b||b===a)return false;
  var low=b.toLowerCase(),clash=namesInUse().filter(function(x){return x[0].toLowerCase()===low&&x[0]!==a})[0];
  if(clash){toast("C'è già "+(clash[1]?"una squadra":"un giocatore")+" che si chiama "+clash[0]+".");return false}
  if(kind==="team")S.teams.forEach(function(t){if(t.n===a)t.n=b});
  else{S.roster=S.roster.map(function(p){return p===a?b:p});S.teams.forEach(function(t){t.m=t.m.map(function(x){return x===a?b:x})})}
  Object.keys(S.games).forEach(function(k){renameDeep(S.games[k],a,b,"")});if(S.sala)renameDeep(S.sala,a,b,"",1);
  if(kind!=="team"&&S.disc&&Object.prototype.hasOwnProperty.call(S.disc,a)){S.disc[b]=S.disc[a];delete S.disc[a]}
  if(kind!=="team"&&DESK&&DESK.botConfig)DESK.botConfig({renamePlayer:{from:a,to:b}}).catch(function(){});
  save();renderRoster();render();toast((kind==="team"?"Squadra":"Giocatore")+" rinominato: "+a+" → "+b+".");return true;
}
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("button.rnm");if(!b||WALL)return;
  var a=b.getAttribute("data-old"),kind=b.getAttribute("data-kind"),i=document.createElement("input");
  i.type="text";i.className="rnin";i.value=a;i.setAttribute("aria-label","Nuovo nome per "+a);i.size=Math.max(6,a.length+2);
  var done=false;function fin(ok){if(done)return;done=true;if(!(ok&&renameName(kind,a,i.value)))(kind==="team"?renderRoster():renderRoster())}
  i.addEventListener("keydown",function(ev){if(ev.key==="Enter"){ev.preventDefault();fin(true)}else if(ev.key==="Escape"){ev.preventDefault();fin(false)}});
  i.addEventListener("blur",function(){fin(true)});
  b.replaceWith(i);i.focus();i.select();
});
function undo(){
  if(!hist.length)return;var cur=S.cur;S=JSON.parse(hist.pop());S.cur=cur;
  initS();registerCustom();normGames();applyUi();fixCur();lastJ=JSON.stringify(S);try{localStorage.setItem(KEY,lastJ)}catch(e){}
  /* come un salvataggio (bot, Discord, file dell'evento), ma senza toccare la cronologia; niente backup automatico per lo stato tornato indietro */
  renderRoster();render();lastStat=statusMap();afterSave();
}
var $=function(i){return document.getElementById(i)};
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
var ICON={generic:'<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11" r="1"/><circle cx="18.5" cy="13.5" r="1"/>',
quake:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
tf2:'<path d="M4 16a8 8 0 0 1 16 0z"/><path d="M2 19.5h20"/><path d="M12 8v4"/>',
wreck:'<path d="M3 15l2-5h14l2 5v3H3z"/><path d="M6 10l1.5-3h9L18 10"/><circle cx="7.5" cy="18" r="1.8"/><circle cx="16.5" cy="18" r="1.8"/>',
cs2:'<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
fifa:'<circle cx="12" cy="12" r="9"/><path d="M12 8l3.5 2.5-1.3 4H9.8l-1.3-4z"/><path d="M12 8V3M15.5 10.5 20 9M14.2 14.5l3 3.5M9.8 14.5l-3 3.5M8.5 10.5 4 9"/>'};
var IMG={quake:"data:image/webp;base64,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",wreck:"data:image/webp;base64,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",tf2:"data:image/webp;base64,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",cs2:"data:image/webp;base64,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",fifa:"data:image/webp;base64,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"};
var PLATS=[["","Piattaforma non specificata"],["pc","PC"],["xbox","Xbox Series X"],["ps4","PlayStation 4"],["ps5","PlayStation 5"],["switch","Nintendo Switch"]],PLATN={};
PLATS.forEach(function(p){PLATN[p[0]]=p[1]});
var PT='<text x="12" y="21" text-anchor="middle" font-size="8.5" font-weight="700" font-family="sans-serif" fill="currentColor" stroke="none">';
var PICON={
pc:'<rect x="2.5" y="5" width="13" height="9.5" rx="1.5"/><path d="M6 19h6M9 14.5V19"/><rect x="17.5" y="4" width="4" height="15" rx="1"/><path d="M19.5 15.5h.01"/>',
xbox:'<rect x="7" y="2.5" width="10" height="19" rx="1.5"/><circle cx="12" cy="7.5" r="2.4"/><path d="M9.5 13h5M9.5 15.5h5M9.5 18h5"/>',
ps4:'<path d="M3.5 11.5 5.5 4.5h15l-2 7z"/><path d="M7 8h10"/>'+PT+'PS4</text>',
ps5:'<rect x="8" y="2.5" width="8" height="10" rx="3"/><path d="M12 4.5v6"/>'+PT+'PS5</text>',
"switch":'<rect x="2.5" y="5" width="4" height="14" rx="2"/><rect x="7.5" y="5" width="9" height="14" rx="1"/><rect x="17.5" y="5" width="4" height="14" rx="2"/>'};
function psvg(p,sz){return'<svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(PICON[p]||"")+'</svg>'}
function platBadge(k){var p=S.games[k]&&S.games[k].plat;return p&&PICON[p]?'<span class="pl" title="'+esc(PLATN[p])+'">'+psvg(p,22)+'</span>':""}
function platOpts(cur){return PLATS.map(function(p){return'<option value="'+p[0]+'"'+(cur===p[0]?" selected":"")+'>'+p[1]+'</option>'}).join("")}
function ico(k,h){h=h||40;var lg=(S.games[k]&&S.games[k].logo)||IMG[k];if(lg)return'<img class="ico" src="'+esc(lg)+'" alt="" style="width:'+h+'px;height:'+h+'px;object-fit:contain">';return'<span class="ico gchip" style="width:'+h+'px;height:'+h+'px"><svg viewBox="0 0 24 24" width="'+Math.round(h*.62)+'" height="'+Math.round(h*.62)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON[k]||ICON.generic)+'</svg></span>'}
var armed=false;
function G(){var g=S.games[S.cur];if(!g.members)g.members={};if(g.team!==undefined)DEF[S.cur].t=g.team?1:0;return g}
function sub(n){if(!DEF[S.cur].t)return"";var m=G().members[n];return m&&m.length?'<span class="sub">'+m.map(esc).join(", ")+'</span>':""}

/* ---- eliminazione diretta ---- */
function setWinner(R,r,i,name){
  R[r][i].w=name;
  if(r+1<R.length){var nm=R[r+1][i>>1],k=i%2?"b":"a";if(nm[k]!==name){nm[k]=name;clearFrom(R,r+1,i>>1)}}
}
function unsetWinner(R,r,i){
  var m=R[r][i];
  if(m.w){m.w=null;if(r+1<R.length){var nm=R[r+1][i>>1];nm[i%2?"b":"a"]=null;clearFrom(R,r+1,i>>1)}}
}
function clearFrom(R,r,i){R[r][i].sa=R[r][i].sb=null;unsetWinner(R,r,i)}
function bracket(list){
  var n=list.length,size=2;while(size<n)size*=2;
  var ord=[1];while(ord.length<size){var L=ord.length*2,nx=[];ord.forEach(function(x){nx.push(x);nx.push(L+1-x)});ord=nx}
  var first=[];
  for(var k=0;k<size;k+=2)first.push({a:list[ord[k]-1]||null,b:list[ord[k+1]-1]||null,w:null});
  var R=[first],c=size/2;
  while(c>1){c/=2;var r=[];for(var q=0;q<c;q++)r.push({a:null,b:null,w:null});R.push(r)}
  first.forEach(function(m,i){if(m.a&&!m.b)setWinner(R,0,i,m.a)});
  return R;
}
function roundName(r,t){var l=t-r;return l===1?"Finale":l===2?"Semifinali":l===3?"Quarti di finale":"Turno "+(r+1)}

/* ---- gironi ---- */
function makeGroups(g){return rrGroups(g)}
function standings(gr,g){return TF.rrStandings(gr,rankFx(g||G()))}
function allDone(g){return g.groups.every(function(x){return x.matches.every(function(m){return m.sa!=null&&m.sb!=null})})}
function overall(g){
  var all=[];g.groups.forEach(function(x){standings(x,g).forEach(function(t){all.push(t)})});
  /* stesso ordine della classifica mostrata (punti, differenza, reti fatte, nome) */
  all.sort(TF.rrCmp);
  return all.map(function(t){return t.n});
}
function soloPodium(g){
  var o=overall(g),h='<div class="champ"><div>Podio '+esc(g.name||DEF[S.cur].l)+'</div>';
  ["🥇","🥈","🥉"].forEach(function(m,i){if(o[i])h+='<div style="margin-top:'+(i?6:0)+'px"><div class="mono'+(i?' s':'')+'">'+m+' '+esc(o[i])+'</div>'+sub(o[i])+'</div>'});
  return h+'</div>';
}
function qualifiers(g){
  var all=[];
  g.groups.forEach(function(x){standings(x,g).forEach(function(t,i){all.push({n:t.n,pos:i,pt:t.pt,d:t.gf-t.gs,gf:t.gf})})});
  all.sort(function(a,b){return a.pos-b.pos||b.pt-a.pt||b.d-a.d||b.gf-a.gf||a.n.localeCompare(b.n)});
  return all.slice(0,Math.min(g.nq||5,all.length)).map(function(x){return x.n});
}
function finals(g){g.rounds=bracket(qualifiers(g));g.phase="final";syncThird(g)}
function loser(m){return m.w&&m.a&&m.b?(m.w===m.a?m.b:m.a):null}
function syncThird(g){
  var R=g.rounds;if(!R||R.length<2){g.third=null;return}
  var sm=R[R.length-2],ls=sm.map(loser),real=sm.filter(function(m){return m.a&&m.b}).length;
  var t=g.third||{a:null,b:null,w:null,sa:null,sb:null};
  if(R.length===2&&real<2){t.match=false;t.auto=ls[0]||ls[1]||null;t.a=t.b=t.w=null;t.sa=t.sb=null}
  else{t.match=true;t.auto=null;if(t.a!==ls[0]||t.b!==ls[1]){t.w=null;t.sa=t.sb=null}t.a=ls[0];t.b=ls[1]}
  g.third=t;
}
function podium(g,f){
  var t=g.third,th=t?(t.auto||t.w):null,sec=f.a===f.w?f.b:f.a;
  function line(m,n,c){return'<div class="mono'+(c?' s':'')+'">'+m+' '+(DEF[S.cur].t?tico(n,c?22:30):"")+esc(n)+'</div>'+sub(n)}
  var h='<div class="champ"><div>Podio '+esc(g.name||DEF[S.cur].l)+'</div>'+line("🥇",f.w)+'<div style="margin-top:10px">'+line("🥈",sec,1)+'</div>';
  if(t)h+='<div style="margin-top:6px">'+(th?line("🥉",th,1):'<span class="hint">3º posto da definire</span>')+'</div>';
  return h+'</div>';
}
function thirdHtml(g){
  var t=g.third;if(!t||!t.match)return"";
  return'<div class="round" style="margin-top:18px;max-width:280px"><h3>Finale 3º/4º posto</h3><div class="match">'+srvSel(g,"e3")+slot(t,"t",0,"a")+slot(t,"t",0,"b")+'</div></div>';
}
/* ---- render ---- */
function renderTabs(){
  var svg='<svg class="ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var USERS=svg+'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>';
  var FLAG=svg+'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
  var STAR=svg+'<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  var HELPI=svg+'<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.8M12 17.2v.3"/></svg>';
  var MAPI=svg+'<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>';
  var TROPHY=svg+'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8"/></svg>';
  function t(k,ic,l){var dr=S.games[k]&&S.games[k].draft;return'<button class="tab'+(dr?" draft":"")+'" role="tab" data-k="'+k+'" aria-selected="'+(k===S.cur)+'"'+(dr?' title="In lavorazione"':'')+'>'+ic+l+'</button>'}
  $("tabs0").innerHTML=t("roster",USERS,"Partecipanti")+t("squadre",FLAG,"Squadre")+t("results",TROPHY,"Risultati finali")+t("hof",STAR,"Hall of Fame")+t("sala",MAPI,"Sala")+(window.desk&&window.desk.streamStatus?'<button class="tab" id="livebtn" title="Diretta su YouTube e Twitch"><span class="ldot" aria-hidden="true"></span>Diretta</button>':'')+'<button class="tab" id="helpbtn" title="Guida (F1)">'+HELPI+'Guida</button>'+(lastDel?'<button class="tab undodel" id="undodel" title="Rimetti: '+esc(lastDel.label)+'">Annulla cancellazione</button>':'')+'<label class="skinsel">Tema <select id="skin" aria-label="Tema dei colori">'+skinOpts((S.ui&&S.ui.skin)||"auto")+'</select></label><span class="savest" id="savest" role="status"'+(saveErr?' style="'+SAVERR+'"':'')+'>'+saveTxt()+'</span>';
  $("tabs").innerHTML=Object.keys(DEF).map(function(k){return t(k,ico(k),esc(DEF[k].l)+platBadge(k))}).join("")+'<button class="tab" id="plus" aria-label="Aggiungi un gioco" title="Aggiungi un gioco">+</button>';
}
function renderSetup(){
  var g=G(),d=DEF[S.cur],noun=d.t?"squadra":"giocatore",lock=!!g.running;
  var h='<h2'+(lock?' class="run"':'')+'>'+ico(S.cur,56)+esc(d.l)+helpBtn(g.mode)+'</h2><div class="row" style="margin-bottom:8px"><input type="text" id="tname" placeholder="Nome del torneo (facoltativo)" aria-label="Nome del torneo" value="'+esc(g.name)+'">'
   +'<select id="mode" aria-label="Formato del torneo"'+(lock?" disabled":"")+'>'+modeOpts(g.mode)+'</select><select id="team" aria-label="Tipo di partecipanti"'+(lock?" disabled":"")+'><option value="0"'+(!d.t?" selected":"")+'>Giocatori singoli</option><option value="1"'+(d.t?" selected":"")+'>A squadre</option></select><select id="plat" aria-label="Piattaforma">'+platOpts(g.plat||"")+'</select>';
  if(g.mode==="ffa"){var gsv=ffaGsOf(g);h+='<label class="row" style="gap:6px;color:var(--mut)">Giocatori per girone <input type="number" id="fgs" min="2" max="999" step="1" inputmode="numeric" style="width:84px" value="'+gsv+'"'+(lock?" disabled":"")+'></label><label class="row" style="gap:6px;color:var(--mut)">Passano per girone <input type="number" id="fadv" min="1" max="'+(gsv-1)+'" step="1" inputmode="numeric" style="width:84px" value="'+ffaAdvOf(g)+'"'+(lock?" disabled":"")+'></label>'}
  var dis=lock?" disabled":"";
  if(g.mode==="double")h+='<label class="row chk"><input type="checkbox" id="dereset"'+(g.deReset===false?"":" checked")+dis+'>Bella in finale se vince chi arriva dai perdenti</label>';
  if(g.mode==="swiss"){var swAuto=TF.swDefaultRounds(Math.max(2,g.players.length));h+='<label class="row" style="gap:6px;color:var(--mut)">Turni <input type="number" id="swr" min="1" max="30" step="1" inputmode="numeric" style="width:84px" value="'+(g.swR||swAuto)+'"'+dis+'></label><label class="row" style="gap:6px;color:var(--mut)">Playoff <select id="swtop"'+dis+'>'+[[0,"Nessuno: vale la classifica"],[2,"Finale tra i primi 2"],[4,"Primi 4"],[8,"Primi 8"],[16,"Primi 16"]].map(function(o){return'<option value="'+o[0]+'"'+((g.swTop||0)===o[0]?" selected":"")+'>'+o[1]+'</option>'}).join("")+'</select></label>'}
  if(g.mode==="rr")h+='<label class="row" style="gap:6px;color:var(--mut)">Gironi <input type="number" id="rrng" min="1" max="32" step="1" inputmode="numeric" style="width:84px" value="'+Math.max(1,g.ng||1)+'"'+dis+'></label><label class="row" style="gap:6px;color:var(--mut)">Playoff <select id="rrnq"'+dis+'>'+[[0,"Nessuno: vale la classifica"],[2,"Finale tra i primi 2"],[4,"Primi 4"],[8,"Primi 8"],[16,"Primi 16"]].map(function(o){return'<option value="'+o[0]+'"'+((g.nq||0)===o[0]?" selected":"")+'>'+o[1]+'</option>'}).join("")+'</select></label>';
  h+='</div><div class="row"><input type="text" id="pname" placeholder="Nome '+noun+'" aria-label="Nome '+noun+'"'+(lock?" disabled":"")+'><button class="p" id="add"'+(lock?" disabled":"")+'>Aggiungi '+noun+'</button></div><div class="chips">';
  if(!g.players.length)h+='<p class="empty">Nessuna '+(d.t?"squadra iscritta":"giocatore iscritto")+' per '+esc(d.l)+'.</p>';
  else if(d.t)h+=g.players.map(function(p,i){
    var ms=g.members[p]||[];
    return'<div class="team"><div class="row" style="justify-content:space-between"><strong>'+tico(p)+esc(p)+'</strong><button data-i="'+i+'" aria-label="Rimuovi squadra '+esc(p)+'"'+(lock?" disabled":"")+'>×</button></div><div class="chips">'
     +(ms.length?ms.map(function(m,j){return'<span class="chip">'+esc(m)+'<button class="mr" data-t="'+i+'" data-m="'+j+'" aria-label="Rimuovi '+esc(m)+'"'+(lock?" disabled":"")+'>×</button></span>'}).join(""):'<span class="hint" style="margin:0">Nessun giocatore in squadra</span>')
     +'</div><div class="row"><input type="text" class="mi" data-t="'+i+'" placeholder="Nome giocatore" aria-label="Aggiungi giocatore a '+esc(p)+'"'+(lock?" disabled":"")+'><button class="ma" data-t="'+i+'"'+(lock?" disabled":"")+'>Aggiungi</button></div></div>'}).join("");
  else h+=g.players.map(function(p,i){return'<span class="chip">'+esc(p)+'<button data-i="'+i+'" aria-label="Rimuovi '+esc(p)+'"'+(lock?" disabled":"")+'>×</button></span>'}).join("");
  h+='</div>'+bulkRow(g,d,lock)+'<div class="row" style="margin-top:14px"><button class="p" id="start"'+(lock||g.players.length<2?" disabled":"")+'>START</button><button id="pause"'+(lock?"":" disabled")+'>PAUSA</button><button id="logo">'+(g.logo?'Cambia logo':'Carica logo')+'</button>'+(g.logo?'<button id="nologo">Rimuovi logo</button>':'')+'<button id="reset">Azzera '+esc(d.l)+'</button><button id="gdraft" aria-pressed="'+(g.draft?"true":"false")+'" title="Nascosto ai partecipanti nel bot e sul proiettore: lo vedono solo amministratori e organizzatori">'+(g.draft?"In lavorazione: rendi visibile":"Segna in lavorazione")+'</button><span class="gdup"><button id="gdup">Duplica '+esc(d.l)+'</button></span><button id="gdel">Elimina '+esc(d.l)+'</button><input type="file" id="lf" accept="image/*" hidden></div>'+(g.draft?'<p class="hint draftnote">In lavorazione: i partecipanti non lo vedono nel bot né sul proiettore.</p>':'');
  h+=lock?'<p class="hint ok">Torneo in corso: giocatori e squadre sono bloccati. Premi PAUSA per modificarli.</p>':(g.phase!=="setup"?'<p class="hint">Torneo in pausa: puoi modificare giocatori e squadre.'+(g.dirty?" Dopo le modifiche, START rifà il sorteggio e i risultati attuali andranno persi.":" START riprende il torneo.")+'</p>':'');
  if(g.mode==="ffa"){var pl=ffaPlan(g.players.length,ffaGsOf(g),ffaAdvOf(g)),sz=ffaSizes(g.players.length,ffaGsOf(g));h+='<p class="hint">Free for all: in ogni girone i partecipanti giocano tutti insieme (non uno contro uno) e vince chi fa più punti. Passano i primi '+ffaAdvOf(g)+' di ogni girone e formano i gironi del turno dopo, fino a un solo girone finale: i primi 3 della finale sono i vincitori.'+(g.players.length>1?" Con "+g.players.length+" partecipanti: "+pl.map(function(k){return k===1?"finale":k+" gironi"}).join(" → ")+"."+(sz.length>1?" Primo turno: gironi da "+sz.join(", ")+".":""):"")+'</p>'}
  h+=modeHint(g)+renderCalc(g,lock)+renderCfg(g);
  $("setup").innerHTML=h;
}
function modeHint(g){
  var n=g.players.length,P=2;while(P<n)P*=2;
  if(g.mode==="elim")return'<p class="hint">Eliminazione diretta: chi perde esce. Si gioca anche la finale per il 3º posto.'+(n>1?" Con "+n+" partecipanti: tabellone da "+P+(P>n?", "+(P-n)+" passano il primo turno senza giocare":"")+".":"")+'</p>';
  if(g.mode==="double")return'<p class="hint">Doppia eliminazione (il formato di EVO e di molti Major): si esce solo alla seconda sconfitta. Chi perde nel tabellone vincenti (winner bracket) scende nel tabellone perdenti (loser bracket); i due vincitori si giocano la finale.'+(n>1?" Con "+n+" partecipanti si giocano al massimo "+(2*n-1)+" partite.":"")+'</p>';
  if(g.mode==="swiss"){var nr=g.swR||TF.swDefaultRounds(Math.max(2,n));return'<p class="hint">Sistema svizzero (la fase a gruppi dei Major di CS2): '+nr+' turni, a ogni turno si affronta chi ha un punteggio simile, senza rivincite. Vittoria 3 punti, pareggio 1. A pari punti decide il Buchholz, cioè la somma dei punti degli avversari affrontati.'+((g.swTop||0)>=2?" Poi playoff a eliminazione diretta tra i primi "+g.swTop+".":"")+'</p>'}
  if(g.mode==="rr"){var ng=Math.max(1,Math.min(g.ng||1,Math.floor(n/2)||1)),tot=0;for(var i=0;i<ng;i++){var sz=Math.floor(n/ng)+(i<n%ng?1:0);tot+=sz*(sz-1)/2}return'<p class="hint">Gironi all&#39;italiana (il formato di Worlds e dei campionati): nel girone tutti contro tutti, vittoria 3 punti, pareggio 1.'+(n>1?" Con "+n+" partecipanti in "+ng+(ng>1?" gironi":" girone")+": "+tot+" partite.":"")+((g.nq||0)>=2?" Poi playoff a eliminazione diretta tra i primi "+g.nq+" (prima i primi classificati di ogni girone).":" Vince chi chiude primo in classifica.")+'</p>'}
  return"";
}
function renderOut(){
  var g=G(),h="";
  if(g.ffa)h+=renderFfa(g);
  if(g.de)h+=renderDE(g);
  if(g.sw)h+=renderSW(g);
  if(g.groups){
    var noPO=rrNoPO(g),qs=noPO?overall(g).slice(0,3):qualifiers(g),team0=isTeam(g);
    if(noPO&&allDone(g))h+=soloPodium(g);
    h+='<section class="panel"><h2>'+(noPO?"Classifica":"Fase a gironi")+helpBtn("rr")+'</h2><div class="groups rr">';
    g.groups.forEach(function(x,gi){
      var free=g.phase==="groups"&&!x.matches.some(hasRes),dzg=free?' data-dz="r" data-g="'+gi+'"':'';
      h+='<div class="gbox"'+dzg+'><h3>'+(g.groups.length>1?"Girone "+letter(gi):"Girone unico")+'</h3><table><tr><th>'+(team0?"Squadra":"Giocatore")+'</th><th title="Partite giocate">G</th><th title="Vinte">V</th><th title="Pareggiate">N</th><th title="Perse">P</th><th title="Differenza punti">DR</th><th>Pt</th></tr>';
      standings(x,g).forEach(function(s){h+='<tr'+(qs.indexOf(s.n)>-1?' class="q"':'')+(free?' data-dz="r" data-g="'+gi+'" data-p="'+esc(s.n)+'"':'')+'><td>'+(free?GRIP:'')+(team0?tico(s.n,16):'')+esc(s.n)+sub(s.n)+'</td><td>'+s.g+'</td><td>'+s.w+'</td><td>'+s.d+'</td><td>'+s.l+'</td><td>'+(s.gf-s.gs>0?"+":"")+(s.gf-s.gs)+'</td><td><b>'+s.pt+'</b></td></tr>'});
      h+='</table>';
      var day=0;
      x.matches.forEach(function(m,mi){
        var dis=g.phase==="final"?" disabled":"";
        if(m.day&&m.day!==day){day=m.day;h+='<div class="day">Giornata '+day+'</div>'}
        h+=srvSel(g,"g"+gi+"-"+mi);
        h+='<div class="mt"><span>'+esc(m.a)+'</span><input type="number" min="0" class="sc" data-g="'+gi+'" data-m="'+mi+'" data-s="sa" aria-label="Punteggio '+esc(m.a)+'" value="'+(m.sa==null?"":esc(m.sa))+'"'+dis+'><span>:</span><input type="number" min="0" class="sc" data-g="'+gi+'" data-m="'+mi+'" data-s="sb" aria-label="Punteggio '+esc(m.b)+'" value="'+(m.sb==null?"":esc(m.sb))+'"'+dis+'><span>'+esc(m.b)+'</span></div>';
      });
      h+='</div>';
    });
    h+='</div>';
    if(!allDone(g))h+='<p class="hint">Inserisci i punteggi di ogni partita: a parità è pareggio. Prima dei risultati puoi trascinare ⠿ un partecipante su un altro girone o su un altro nome.</p>';
    if(g.phase==="groups"&&!noPO)h+='<div class="row" style="margin-top:14px"><button class="p" id="fin"'+(allDone(g)?"":" disabled")+'>Avvia playoff con i primi '+Math.min(g.nq,g.players.length)+'</button></div>';
    h+='</section>';
  }
  if(g.rounds){
    var R=g.rounds,f=R[R.length-1][0];
    if(f.w)h+=podium(g,f);
    h+='<section class="panel"><h2>'+(g.groups||g.sw?"Playoff":"Tabellone")+helpBtn(g.groups||g.sw?g.mode:"elim")+'</h2><div class="bracket">';
    R.forEach(function(rd,r){
      h+='<div class="round"><h3>'+roundName(r,R.length)+'</h3>';
      rd.forEach(function(m,i){h+='<div class="match">'+(m.a&&m.b?srvSel(g,"e"+r+"-"+i):"")+slot(m,r,i,"a")+slot(m,r,i,"b")+'</div>'});
      h+='</div>';
    });
    h+='</div>'+thirdHtml(g)+'<p class="hint">Inserisci i punteggi: vince il più alto e avanza da solo. In caso di parità inserisci un risultato diverso. Puoi anche toccare il nome per assegnare la vittoria. Finché una partita del primo turno non ha risultati, trascina ⠿ su un altro nome per scambiarli.</p></section>';
  }
  if(result(g,S.cur).status==="Concluso")h+='<div class="row" style="margin-bottom:16px"><button class="p" id="png">Scarica immagine (PNG)</button><span class="hint" id="pngmsg" style="margin:0"></span></div>';
  $("out").innerHTML=h;refocus();
}
function slot(m,r,i,k){
  var n=m[k],ready=m.a&&m.b,sk=k==="a"?"sa":"sb",mv=r===0&&r0Free(G().rounds,i),dz=mv?' data-dz="b" data-i="'+i+'" data-k="'+k+'"'+(n?' data-p="'+esc(n)+'"':''):'';
  if(!n)return'<div class="srow"'+dz+'><button class="slot" disabled><span class="tbd">'+(r===0?"Passa il turno":"Da definire")+'</span></button></div>';
  var c=m.w?(m.w===n?"w":"l"):"",v=m[sk];
  return'<div class="srow"'+dz+'>'+(mv?GRIP:'')+'<button class="slot '+c+'" data-r="'+r+'" data-i="'+i+'" data-n="'+esc(n)+'"'+(ready?"":" disabled")+'><span>'+esc(n)+sub(n)+'</span>'+(m.w===n?"<span>✓</span>":"")+'</button>'
   +(ready?'<input type="number" min="0" class="bs" data-r="'+r+'" data-i="'+i+'" data-s="'+sk+'" aria-label="Punteggio '+esc(n)+'" value="'+(v==null?"":esc(v))+'">':'')+'</div>';
}
function result(g,k){
  var team=g.team!==undefined?g.team:!!DEF[k].t,r={team:team,status:"Non ancora avviato",top:[]};
  if(g.phase==="setup")return r;
  if(g.ffa){
    var fr=g.ffa.rounds[g.ffa.rounds.length-1];
    if(fr.groups.length===1){var ev=gEval(fr.groups[0],true,g.ffa.adv);if(ev.ok){r.status="Concluso";var pd=ev.sorted.filter(function(x){return x.pos<=3});r.top=pd.map(function(x){return x.n});r.tpos=pd.map(function(x){return x.pos})}else r.status="Finale in corso"}
    else r.status="Turno "+g.ffa.rounds.length+" in corso";
    return r;
  }
  if(g.de){var E=deState(g).ev;if(E.done){r.status="Concluso";r.top=E.top}else r.status="Torneo in corso";return r}
  if(g.sw&&!g.rounds){var W=g.sw;if(swFinished(W)&&!(W.top>=2)){r.status="Concluso";r.top=TF.swStandings(g.players,W.rounds,rankFx(g)).slice(0,3).map(function(x){return x.n})}else r.status=swFinished(W)?"Svizzero concluso: avvia i playoff":"Turno "+W.rounds.length+" di "+W.nr;return r}
  if(g.rounds){
    var R=g.rounds,f=R[R.length-1][0];
    if(f.w){var t=g.third;r.status="Concluso";r.top=[f.w,f.a===f.w?f.b:f.a,t?(t.auto||t.w):null]}
    else{var ci=R.findIndex(function(rd){return rd.some(function(m){return m.a&&m.b&&!m.w})});r.status=(g.groups||g.sw?"Playoff: ":"")+(ci>=0?roundName(ci,R.length):"Finale")+" in corso"}
  }else if(g.groups){
    if(rrNoPO(g)&&allDone(g)){r.status="Concluso";r.top=overall(g).slice(0,3)}
    else r.status="Gironi in corso";
  }
  return r;
}
function renderSquadre(){
  var h='<div class="row" style="margin-bottom:14px"><button class="p" data-print="teams">Stampa elenco squadre (PDF A4)</button><span class="hint pmsg" style="margin:0"></span></div>';
  if(S.teams.length){
    h+='<section class="panel"><h2>Squadre fisse (valide per tutti i tornei)</h2><div class="sq">';
    S.teams.forEach(function(t){h+='<div class="team"><strong>'+tico(t.n)+esc(t.n)+'</strong> <span class="hint" style="margin:0">('+t.m.length+')</span><ul>'+(t.m.length?t.m.map(function(m){return"<li>"+esc(m)+"</li>"}).join(""):'<li class="hint">Nessun giocatore</li>')+'</ul></div>'});
    h+='</div></section>';
  }
  Object.keys(DEF).forEach(function(k){
    var g=S.games[k],team=g.team!==undefined?g.team:!!DEF[k].t;
    h+='<section class="panel"><h2>'+ico(k,44)+esc(DEF[k].l)+(g.name?" — "+esc(g.name):"")+'</h2>';
    if(!team){h+='<p class="empty">Gioco a giocatori singoli'+(g.players.length?": "+g.players.length+" iscritti ("+g.players.map(esc).join(", ")+")":"")+'.</p></section>';return}
    if(!g.players.length){h+='<p class="empty">Nessuna squadra creata: aprila dalla scheda del gioco e usa "Crea squadre casuali".</p></section>';return}
    var used={};h+='<div class="sq">';
    g.players.forEach(function(t){
      var ms=(g.members||{})[t]||[];ms.forEach(function(m){used[m.toLowerCase()]=1});
      h+='<div class="team"><strong>'+tico(t)+esc(t)+'</strong> <span class="hint" style="margin:0">('+ms.length+')</span><ul>'+(ms.length?ms.map(function(m){return"<li>"+esc(m)+"</li>"}).join(""):'<li class="hint">Nessun giocatore</li>')+'</ul></div>';
    });
    h+='</div>';
    var free=S.roster.filter(function(n){return!used[n.toLowerCase()]});
    if(free.length)h+='<p class="hint">Senza squadra: '+free.map(esc).join(", ")+'</p>';
    h+='</section>';
  });
  $("sqbox").innerHTML=h;
}
function gamePts(g){
  var m={};function add(n,p){if(n)m[n]=(m[n]||0)+p}
  var hf=hofFx(g);function mt(t){if(t&&t.a&&t.b&&t.sa!=null&&t.sb!=null){add(t.a,hf?hf.run(TF.fxMatchVars(t.sa,t.sb)):t.sa);add(t.b,hf?hf.run(TF.fxMatchVars(t.sb,t.sa)):t.sb)}}
  if(g.ffa)g.ffa.rounds.forEach(function(rd){rd.groups.forEach(function(gr){gr.p.forEach(function(n){if(gr.s[n]!=null)add(n,gr.s[n])})})});
  if(g.groups)g.groups.forEach(function(x){x.matches.forEach(mt)});
  if(g.rounds)g.rounds.forEach(function(rd){rd.forEach(mt)});
  if(g.sw)g.sw.rounds.forEach(function(rd){rd.forEach(function(x){if(x.b)mt(x)})});
  if(g.de){var E=deState(g).ev;Object.keys(E.M).forEach(function(id){var x=E.M[id];if(x.ready)mt(x)})}
  mt(g.third);return m;
}
function renderHof(){renderHof2()}
/* una cella di testo che comincia con = + - @ Excel la prende per una formula: davanti va un apostrofo (i numeri restano numeri) */
function csvSafe(v){var x=String(v==null?"":v);return typeof v==="string"&&/^[=+\-@\t\r]/.test(x)&&!/^[+-]?\d+(?:[.,]\d+)?$/.test(x)?"'"+x:x}
async function exportCsv(){
  var rows=[["Gioco","Torneo","Posizione","Nome","Componenti"]];
  /* posizione: quella condivisa a pari merito (FFA), come nella scheda Risultati */
  Object.keys(DEF).forEach(function(k){var g=S.games[k],r=result(g,k);r.top.forEach(function(n,i){if(n)rows.push([DEF[k].l,g.name||"",(r.tpos&&r.tpos[i])||i+1,n,r.team?((g.members||{})[n]||[]).join(", "):""])})});
  var csv="\ufeff"+rows.map(function(r){return r.map(function(v){return'"'+csvSafe(v).replace(/"/g,'""')+'"'}).join(";")}).join("\r\n"),blob=new Blob([csv],{type:"text/csv"});
  try{if(DL)await DL.save({filename:"risultati-fragmarathon.csv",data:blob});else dlBlob(blob,"risultati-fragmarathon.csv")}catch(e){}
}
function renderResults(){
  var h='<div class="row" style="margin-bottom:12px"><button id="csv">Esporta risultati (CSV)</button></div>',med=["🥇","🥈","🥉"];
  Object.keys(DEF).forEach(function(k){
    var g=S.games[k],r=result(g,k);
    h+='<section class="panel"><h2>'+ico(k,44)+esc(DEF[k].l)+(g.name?" — "+esc(g.name):"")+'</h2>';
    if(r.top.length){
      h+='<table class="res"><tr><th>Pos.</th><th>'+(r.team?"Squadra":"Giocatore")+'</th>'+(r.team?"<th>Componenti</th>":"")+'</tr>';
      r.top.forEach(function(n,i){
        if(!n)return;
        h+='<tr><td>'+med[Math.min(((r.tpos&&r.tpos[i])||i+1)-1,2)]+'</td><td>'+(r.team?tico(n,18):"")+esc(n)+'</td>'+(r.team?'<td>'+(((g.members||{})[n]||[]).map(esc).join(", ")||"—")+'</td>':"")+'</tr>';
      });
      h+='</table>';
    if(r.status==="Concluso")h+='<div class="row" style="margin-top:10px"><button data-png="'+k+'">Scarica immagine (PNG)</button></div>';
    }else h+='<p class="empty">'+r.status+'</p>';
    h+='</section>';
  });
  $("resbox").innerHTML=h;
}
function render(){
  renderTabs();
  var v=S.cur,isG=!!DEF[v];
  $("rosterBox").hidden=v!=="roster";$("resbox").hidden=v!=="results";$("sqbox").hidden=v!=="squadre";$("hofbox").hidden=v!=="hof";$("setup").hidden=!isG;$("out").hidden=!isG;
  var sb=$("salabox");if(sb)sb.hidden=v!=="sala";if(v==="sala"&&window.SALA)SALA.render();
  if(v==="hof")renderHof();else if(v==="results")renderResults();else if(v==="squadre")renderSquadre();else if(isG){renderSetup();renderOut()}
  strDot();renderArch();document.title=(S.ui.title||UI0.title)+(isG?" — "+DEF[v].l:"");
}

var TEAMS=["ALPHA","DELTA","BRAVO","FOX","OMEGA","WOLF","ACE","SKYNET","VIPER","GHOST","TITAN","RAVEN","COBRA","REAPER","HAWK","STORM","PHANTOM","BLADE"];
function renderRoster(){
  renderTeams();
  $("rcount").textContent="("+S.roster.length+")";
  $("rchips").innerHTML=S.roster.length?S.roster.map(function(p,i){return'<span class="chip"><button class="rnm" data-kind="player" data-old="'+esc(p)+'" title="Clicca per rinominare">'+esc(p)+'</button><button data-i="'+i+'" aria-label="Rimuovi '+esc(p)+'">×</button></span>'}).join(""):'<p class="empty">Nessun partecipante in lista.</p>';
}
$("rosterBox").onclick=function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.dataset.print){printDoc(b.dataset.print,b.parentNode.querySelector(".pmsg"));return}
  if(b.id==="radd"){
    /* celle copiate da Excel o Google Sheets: colonne separate da tabulazioni */
    if(/\t/.test($("rta").value)&&window.SHEETS){importRows(SHEETS.parseCsv($("rta").value,"\t"));$("rta").value="";return}
    $("rta").value.split(/[\n,;]+/).map(function(x){return x.trim()}).filter(Boolean).forEach(function(n){
      if(!S.roster.some(function(p){return p.toLowerCase()===n.toLowerCase()}))S.roster.push(n)});
    $("rta").value="";save();renderRoster();render();
  }else if(b.id==="rimp"){var gs=$("rgs");gs.hidden=!gs.hidden;$("rgshint").hidden=gs.hidden;if(!gs.hidden)$("rgsurl").focus()}
  else if(b.id==="rgsfile"){$("rfile").click()}
  else if(b.id==="rgsgo"){sheetFromLink($("rgsurl").value)}
  else if(b.id==="rxlsx"||b.id==="rcsv"){exportRoster(b.id==="rxlsx")}
  else if(b.id==="rtrand"){
    var sz=+$("rtsize").value||2,nm=shuffle(S.roster),nt=Math.max(1,Math.round(nm.length/sz));
    S.tsize=sz;S.teams=[];for(var i=0;i<nt;i++)S.teams.push({n:nextTeamName(),m:[]});
    nm.forEach(function(n,i){S.teams[i%nt].m.push(n)});save();renderRoster();
  }
  else if(b.id==="rtrest"){
    shuffle(S.roster.filter(function(n){return teamIdx(n)<0})).forEach(function(n){
      S.teams.slice().sort(function(x,y){return x.m.length-y.m.length})[0].m.push(n)});
    save();renderRoster();
  }
  else if(b.id==="rtadd"){
    var v=$("rtname").value.trim()||nextTeamName();
    if(S.teams.some(function(t){return t.n.toLowerCase()===v.toLowerCase()})){$("rtname").select();return}
    S.teams.push({n:v,m:[]});save();renderRoster();
  }
  else if(b.classList.contains("rtdel")){delSnap("squadra "+S.teams[+b.dataset.t].n);S.teams.splice(+b.dataset.t,1);save();renderRoster()}
  else if(b.classList.contains("rmm")){delSnap(S.teams[+b.dataset.t].m[+b.dataset.m]+" dalla squadra");S.teams[+b.dataset.t].m.splice(+b.dataset.m,1);save();renderRoster()}
  else if(b.classList.contains("rtgo")){
    var sel=document.querySelector('.rtsel[data-t="'+b.dataset.t+'"]');if(!sel||!sel.value)return;
    S.teams[+b.dataset.t].m.push(sel.value);save();renderRoster();
  }
  else if(b.dataset.i!==undefined){
    delSnap("giocatore "+S.roster[+b.dataset.i]);var rn=S.roster.splice(+b.dataset.i,1)[0];
    S.teams.forEach(function(t){t.m=t.m.filter(function(x){return x.toLowerCase()!==rn.toLowerCase()})});
    /* la sua postazione nella sala torna libera (ip e note restano) */
    if(S.sala&&S.sala.st)Object.keys(S.sala.st).forEach(function(k){var x=S.sala.st[k];if(x&&typeof x.player==="string"&&x.player.toLowerCase()===rn.toLowerCase())delete x.player});
    save();renderRoster();render();
  }
};
$("rosterBox").onkeydown=function(e){if(e.key==="Enter"&&e.target.id==="rtname")$("rtadd").click()};
$("rosterBox").onchange=function(e){if(e.target.id==="rtsize"){S.tsize=+e.target.value;save()}};
function bulkRow(g,d,lock){
  var dis=lock||!S.roster.length?" disabled":"",h='<div class="row" style="margin-top:14px">';
  if(d.t){h+='<label class="row" style="gap:6px;color:var(--mut)">Giocatori per squadra <select id="tsize"'+(lock?" disabled":"")+'>';for(var i=1;i<=8;i++)h+='<option'+((g.tsize||2)===i?" selected":"")+'>'+i+'</option>';h+='</select></label>'}
  h+='<button id="all"'+dis+'>'+(d.t?"Crea squadre casuali":"Aggiungi tutti")+'</button><button class="p" id="allgo"'+dis+'>'+(d.t?"Crea squadre e sorteggia":"Aggiungi tutti e sorteggia")+'</button>';
  if(d.t){var dp=lock||!S.teams.some(function(t){return t.m.length})?" disabled":"";h+='<button id="pair"'+dp+'>Abbina team</button><button class="p" id="pairgo"'+dp+'>Abbina team e sorteggia</button>'}
  if(!S.roster.length)h+='<span class="hint" style="margin:0">Inserisci prima i partecipanti nella scheda Partecipanti.</span>';
  return h+'</div>';
}
function fillAll(g){
  var d=DEF[S.cur],names=shuffle(S.roster);
  if(!d.t){names.forEach(function(n){if(!g.players.some(function(p){return p.toLowerCase()===n.toLowerCase()}))g.players.push(n)});return}
  var nt=Math.max(1,Math.round(names.length/(g.tsize||2)));
  g.players=[];g.members={};
  for(var i=0;i<nt;i++){var nm=TEAMS[i%TEAMS.length]+(i>=TEAMS.length?" "+(Math.floor(i/TEAMS.length)+1):"");g.players.push(nm);g.members[nm]=[]}
  names.forEach(function(n,i){g.members[g.players[i%nt]].push(n)});
}
function teamIdx(n){for(var i=0;i<S.teams.length;i++)if(S.teams[i].m.some(function(x){return x.toLowerCase()===n.toLowerCase()}))return i;return -1}
function nextTeamName(){for(var i=0;i<500;i++){var nm=TEAMS[i%TEAMS.length]+(i>=TEAMS.length?" "+(Math.floor(i/TEAMS.length)+1):"");if(!S.teams.some(function(t){return t.n===nm}))return nm}}
/* ---- elenco giocatori da e verso Excel / Google Sheets ---- */
function T_(s){return window.I18N?I18N.tr(s):s}
function importRows(rows){
  rows=(rows||[]).filter(function(r){return r&&r.some(Boolean)});
  if(!rows.length){toast("Nel foglio non ci sono nomi.");return}
  /* intestazione: la cella intera dev'essere un titolo noto ("Nome giocatore", "Nome squadra", "Team name"...), non solo cominciare
     così: "Team Rocket" o "Nick Rossi" sono dati. Squadra e Discord vengono prima del nome ("Nome squadra" non è la colonna dei giocatori). */
  var H=rows[0].map(function(x){return String(x).toLowerCase().replace(/\s+/g," ").trim()}),NAME=/^(nome|nick|nickname|giocatore|giocatori|player|players|name|partecipante|partecipanti|gamertag|nombre|jugador|jugadores|nom|joueur|joueurs|pseudo|spieler|spielername|teilnehmer|nume|jucător|jucator|participant|имя|игрок|ник|участник|姓名|名字|选手|玩家|名前|プレイヤー|選手|zogador|zogadori)( (e cognome|(del |di )?(giocatore|player|name|nome|gioco|in gioco)))? ?[:*]?$/u,TEAM=/^(nome (della |del )?)?(squadra|team|clan|gruppo|equipo|équipe|equipe|mannschaft|teamname|echipă|echipa|команда|клан|队伍|战队|チーム)( (name|nome))? ?[:*]?$/u;
  var DISC=/^(discord|account discord|utente discord|nome discord|discord id|discord username|discord user) ?[:*]?$/;
  var isD=function(x){return DISC.test(x)},isT=function(x){return!isD(x)&&TEAM.test(x)},isN=function(x){return!isD(x)&&!isT(x)&&NAME.test(x)};
  var head=H.some(function(x){return isN(x)||isT(x)||isD(x)}),ti=head?H.findIndex(isT):-1,di=head?H.findIndex(isD):-1,ni=head?H.findIndex(isN):0;
  /* nessun titolo per i nomi: la prima colonna che non è squadra o Discord */
  if(ni<0)ni=Math.max(0,H.findIndex(function(x,i){return i!==ti&&i!==di}));
  var added=0,teamsNew=0,inTeam=0,seen={};
  rows.slice(head?1:0).forEach(function(r){
    var n=String(r[ni]||"").replace(/\s+/g," ").trim().slice(0,40);if(!n||seen[n.toLowerCase()])return;seen[n.toLowerCase()]=1;
    var ex=S.roster.filter(function(p){return p.toLowerCase()===n.toLowerCase()})[0];
    if(!ex){S.roster.push(n);added++;ex=n}
    var dv=di>=0?dcOk(r[di]):"";if(dv){S.disc=S.disc||{};S.disc[ex]=dv}
    var tn=ti>=0?String(r[ti]||"").replace(/\s+/g," ").trim().slice(0,40):"";
    if(tn){var t=S.teams.filter(function(x){return x.n.toLowerCase()===tn.toLowerCase()})[0];if(!t){t={n:tn,m:[]};S.teams.push(t);teamsNew++}
      if(!S.teams.some(function(x){return x.m.some(function(m){return m.toLowerCase()===ex.toLowerCase()})})){t.m.push(ex);inTeam++}}
  });
  save();renderRoster();render();
  toast("Importati "+Object.keys(seen).length+" nomi: "+added+" nuovi"+(teamsNew?", "+teamsNew+" squadre nuove":"")+(inTeam?", "+inTeam+" messi in squadra":"")+".");
}
function sheetFromLink(link){
  var u=window.SHEETS&&SHEETS.gsheetCsvUrl(link);
  if(!u){toast("Incolla il link di un foglio Google Sheets (docs.google.com/spreadsheets/…).");return}
  if(DESK&&DESK.sheetFetch){DESK.sheetFetch(u).then(function(r){if(r&&r.text)importRows(SHEETS.parseCsv(r.text));else toast("Non riesco a leggere il foglio: "+((r&&r.error)||"errore")+".")});return}
  /* una pagina HTML al posto del CSV è quella di accesso di Google: il foglio non è condiviso con chi ha il link */
  fetch(u).then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){if(/^\s*</.test(t))throw 0;importRows(SHEETS.parseCsv(t))}).catch(function(){toast("Non riesco a leggere il foglio: controlla che sia condiviso con «Chiunque abbia il link», oppure scaricalo (File, Scarica, .xlsx o .csv) e usa Scegli un file.")});
}
function exportRoster(xlsx){
  if(!S.roster.length){toast("L'elenco dei partecipanti è vuoto.");return}
  var rows=[[T_("Giocatore"),T_("Squadra"),T_("Giochi"),"Discord"]];
  S.roster.forEach(function(n){
    var t=S.teams.filter(function(x){return x.m.indexOf(n)>=0})[0],tn=t?t.n:"";
    var g=Object.keys(DEF).filter(function(k){var gg=S.games[k];return gg&&(gg.players.indexOf(n)>=0||(tn&&gg.players.indexOf(tn)>=0)||Object.keys(gg.members||{}).some(function(m){return(gg.members[m]||[]).indexOf(n)>=0}))}).map(function(k){return DEF[k].l});
    rows.push([n,tn,g.join(", "),(S.disc&&S.disc[n])||""]);
  });
  var base="giocatori-"+String(S.ui.title||UI0.title).replace(/[^\w-]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
  if(xlsx)dlBlob(SHEETS.toXlsx(rows,T_("Giocatori")),base+".xlsx");else dlBlob(new Blob([SHEETS.toCsv(rows)],{type:"text/csv;charset=utf-8"}),base+".csv");
  toast("Elenco esportato: "+S.roster.length+" giocatori. Si apre con Excel o Google Sheets (File, Importa).");
}
function renderTeams(){
  var free=S.roster.filter(function(n){return teamIdx(n)<0}),h='<div class="row"><label class="row" style="gap:6px;color:var(--mut)">Giocatori per squadra <select id="rtsize">';
  for(var i=1;i<=8;i++)h+='<option'+((S.tsize||2)===i?" selected":"")+'>'+i+'</option>';
  h+='</select></label><button id="rtrand"'+(S.roster.length?"":" disabled")+'>Crea squadre casuali</button><button id="rtrest"'+(free.length&&S.teams.length?"":" disabled")+'>Assegna i rimanenti a caso</button></div>';
  h+='<div class="row" style="margin-top:8px"><input type="text" id="rtname" placeholder="Nome nuova squadra (facoltativo)" aria-label="Nome nuova squadra"><button id="rtadd">Aggiungi squadra</button></div><div class="sq" style="margin-top:12px">';
  S.teams.forEach(function(t,i){
    h+='<div class="team"><div class="row" style="justify-content:space-between"><strong>'+tico(t.n)+'<button class="rnm" data-kind="team" data-old="'+esc(t.n)+'" title="Clicca per rinominare">'+esc(t.n)+'</button></strong><button class="rtdel" data-t="'+i+'" aria-label="Elimina squadra '+esc(t.n)+'">×</button></div><div class="chips">'
     +(t.m.length?t.m.map(function(m,j){return'<span class="chip">'+esc(m)+'<button class="rmm" data-t="'+i+'" data-m="'+j+'" aria-label="Rimuovi '+esc(m)+'">×</button></span>'}).join(""):'<span class="hint" style="margin:0">Nessun giocatore</span>')
     +'</div><div class="row"><select class="rtsel" data-t="'+i+'" aria-label="Scegli giocatore per '+esc(t.n)+'"><option value="">Scegli giocatore…</option>'+free.map(function(n){return'<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join("")+'</select><button class="rtgo" data-t="'+i+'">Aggiungi</button></div></div>';
  });
  h+='</div>';
  if(!S.teams.length)h+='<p class="empty">Nessuna squadra creata.</p>';
  else if(free.length)h+='<p class="hint">Senza squadra: '+free.map(esc).join(", ")+'</p>';
  h+='<div class="row" style="margin-top:12px"><button data-print="teams">Stampa elenco squadre (PDF A4)</button><span class="hint pmsg" style="margin:0"></span></div>';
  $("rteams").innerHTML=h;
}
function pairTeams(g){
  var ts=S.teams.filter(function(t){return t.m.length});
  g.players=ts.map(function(t){return t.n});g.members={};
  ts.forEach(function(t){g.members[t.n]=t.m.slice()});
}
/* Numero di gironi: mai gironi da 1 solo partecipante (se servirebbero, i gironi diventano un po' più grandi). */
function ffaK(n,gs){var k=Math.ceil(n/gs);if(k>1&&Math.floor(n/k)<2)k=Math.max(1,Math.floor(n/2));return k}
function ffaSizes(n,gs){var k=ffaK(n,gs),o=[];for(var i=0;i<k;i++)o.push(Math.floor(n/k)+(i<n%k?1:0));return o}
function ffaGsOf(g){var v=parseInt(g.ffaGs,10);return v>=2?v:8}
function ffaAdvOf(g){var a=parseInt(g.ffaAdv,10);a=a>=1?a:3;return Math.min(a,ffaGsOf(g)-1)}
function ffaGroups(names,gs){var k=ffaK(names.length,gs),gr=[],i;for(i=0;i<k;i++)gr.push({p:[],s:{}});names.forEach(function(n,j){gr[j%k].p.push(n)});return gr}
function ffaPlan(n,gs,adv){var out=[];while(n>gs){var k=ffaK(n,gs),t=0;if(k===1)break;for(var i=0;i<k;i++){var sz=Math.floor(n/k)+(i<n%k?1:0);t+=Math.min(adv,sz-1)}out.push(k);n=t}out.push(1);return out}
function gEval(grp,fin,adv){
  /* Pareggi ammessi: punti uguali = stessa posizione (classifica "olimpica": 1,2,2,4). Non bloccano mai il torneo. */
  var arr=grp.p.map(function(n,i){return{n:n,s:grp.s[n],i:i}}),full=arr.every(function(x){return x.s!=null}),
  sorted=arr.slice().sort(function(a,b){return(b.s==null?-1:b.s)-(a.s==null?-1:a.s)||a.i-b.i}),
  na=fin?Math.min(3,sorted.length):Math.min(adv,sorted.length-1),rk={},tie=false,i,adn=[],fb=false;
  sorted.forEach(function(x,k){x.pos=(k>0&&x.s===sorted[k-1].s)?sorted[k-1].pos:k+1;rk[x.n]=x.pos;if(k>0&&x.pos===sorted[k-1].pos)tie=true});
  if(full){adn=sorted.filter(function(x){return x.pos<=na});
    if(!fin&&adn.length>=sorted.length){adn=sorted.slice(0,na);fb=true} /* tutti pari: passano i primi per ordine di inserimento */
  }
  var tied=full&&adn.length!==na&&!fin;
  return{sorted:sorted,full:full,tie:tie,ok:full,na:na,rk:rk,adv:adn.map(function(x){return x.n}),fb:fb,extra:full?Math.max(0,adn.length-na):0};
}
function nextRound(g){
  var F=g.ffa,rd=F.rounds[F.rounds.length-1],adv=[];
  rd.groups.forEach(function(gr){var e=gEval(gr,false,F.adv);if(e.ok)e.adv.forEach(function(n){adv.push(n)})});
  F.rounds.push({groups:ffaGroups(shuffle(adv),F.gs)});save();render();
}
var shufArm=null;
function ffaReshuffle(g,bal){
  var F=g.ffa,ri=F.rounds.length-1,rd=F.rounds[ri],names=[];
  rd.groups.forEach(function(gr){gr.p.forEach(function(n){names.push(n)})});
  if(bal&&ri>0){
    var pts={};names.forEach(function(n){pts[n]=0});
    for(var r=0;r<ri;r++)F.rounds[r].groups.forEach(function(gr){gr.p.forEach(function(n){if(gr.s[n]!=null&&pts[n]!=null)pts[n]+=gr.s[n]})});
    var ord=shuffle(names).sort(function(a,b){return pts[b]-pts[a]}),k=ffaK(ord.length,F.gs),gg=[],i;
    for(i=0;i<k;i++)gg.push({p:[],s:{}});
    ord.forEach(function(n,j){var row=Math.floor(j/k),col=j%k;if(row%2)col=k-1-col;gg[col].p.push(n)});
    gg.forEach(function(x){x.p=shuffle(x.p)});
    rd.groups=gg;
  }else rd.groups=ffaGroups(shuffle(names),F.gs);
  save();render();
}
function ffaPodium(g,top,tposArr){
  var team=g.team!==undefined?g.team:!!DEF[S.cur].t,med=["🥇","🥈","🥉"],h='<div class="champ"><div>Podio '+esc(g.name||DEF[S.cur].l)+'</div>';
  top.forEach(function(n,i){var pp=(tposArr&&tposArr[i]||i+1)-1,m3=med[Math.min(pp,2)];if(n)h+='<div style="margin-top:'+(i?8:0)+'px"><div class="mono'+(pp?' s':'')+'">'+m3+' '+(team?tico(n,pp?22:30)+' ':'')+esc(n)+'</div>'+sub(n)+'</div>'});
  return h+'</div>';
}
function renderFfa(g){
  var fxF=!!ffaFx(g),FF=ffaFields(g),frCols="grid-template-columns:24px minmax(5.5em,1fr) repeat("+FF.length+",minmax(40px,58px)) minmax(38px,54px) 22px",grMin=36+110+FF.length*58+62+30+8*(FF.length+3);
  var F=g.ffa,h="",team=g.team!==undefined?g.team:!!DEF[S.cur].t,res=result(g,S.cur);
  if(res.status==="Concluso")h+=ffaPodium(g,res.top,res.tpos);
  F.rounds.forEach(function(rd,ri){
    var fin=rd.groups.length===1,last=ri===F.rounds.length-1,ev=rd.groups.map(function(gr){return gEval(gr,fin,F.adv)});
    /* con più campi i gironi diventano più larghi: ne stanno meno per riga, senza sovrapporsi */
    h+='<section class="panel"><h2>'+(fin?"Finale":"Turno "+(ri+1))+'</h2><div class="groups"'+(fxF?' style="grid-template-columns:repeat(auto-fill,minmax(min(100%,'+grMin+'px),1fr))"':'')+'>';
    rd.groups.forEach(function(gr,gi){
      var e=ev[gi],rk={};e.sorted.forEach(function(x,i){rk[x.n]=i+1});
      h+='<div class="gbox"'+(last?' data-dz="f" data-g="'+gi+'"':'')+'><h3>'+(fin?"Finale · primi 3 vincitori":"Girone "+String.fromCharCode(65+gi)+" · passano i primi "+e.na)+'</h3>'+srvSel(g,"f"+ri+"-"+gi);
      if(fxF)h+='<div class="fr frh" style="'+frCols+'"><span></span><span></span>'+FF.map(function(f){return'<span>'+esc(f.l||f.k)+'</span>'}).join("")+'<span>Punti</span><span></span></div>';
      gr.p.forEach(function(n){
        var pos=e.full?e.rk[n]:null,ad=e.full&&e.adv.indexOf(n)>=0,tp=e.full&&e.sorted.some(function(x){return x.n!==n&&x.pos===pos});
        h+='<div class="fr'+(ad?' adv':'')+'"'+(fxF?' style="'+frCols+'"':'')+(last?' data-dz="f" data-g="'+gi+'" data-p="'+esc(n)+'"':'')+'><span class="fp">'+(pos?(tp?"=":"")+pos:"–")+'</span><span class="fn">'+(last?GRIP:'')+(team?tico(n,18):"")+esc(n)+sub(n)+'</span>'+(fxF?FF.map(function(f){var vv=((gr.v||{})[n]||{})[f.k];return'<input type="number" min="0" class="fsv" data-r="'+ri+'" data-g="'+gi+'" data-p="'+esc(n)+'" data-f="'+esc(f.k)+'" aria-label="'+esc(f.l||f.k)+' di '+esc(n)+'" value="'+(vv==null?"":esc(vv))+'"'+(last?"":" disabled")+'>'}).join("")+'<span class="fsc">'+(gr.s[n]==null?"–":esc(gr.s[n]))+'</span>':'<input type="number" min="0" class="fs" data-r="'+ri+'" data-g="'+gi+'" data-p="'+esc(n)+'" aria-label="Punteggio '+esc(n)+'" value="'+(gr.s[n]==null?"":esc(gr.s[n]))+'"'+(last?"":" disabled")+'>')+'<span class="fm">'+(ad?(fin?pos+"º":"✓"):"")+'</span></div>';
      });
      if(e.full&&e.fb)h+='<p class="hint">Tutti a pari punti: passano i primi '+e.na+' in ordine di inserimento.</p>';
      else if(e.full&&!fin&&e.extra)h+='<p class="hint">Parità sul limite di qualificazione: passano a pari merito '+e.adv.length+' giocatori.</p>';
      else if(e.full&&fin&&e.tie)h+='<p class="hint">Parità: i giocatori a pari punti condividono la posizione.</p>';
      h+='</div>';
    });
    h+='</div>';
    if(last&&!fin){
      var anySc=rd.groups.some(function(gr){return gr.p.some(function(n){return gr.s[n]!=null})}),ar=shufArm;
      h+='<div class="row" style="margin-top:14px"><button id="ffashuf" class="'+(ar==="r"?"p":"")+'">'+(ar==="r"?"Conferma: rimescola (punteggi di questo turno azzerati)":"Rimescola gironi di questo turno")+'</button>'+(ri>0?'<button id="ffabal" class="'+(ar==="b"?"p":"")+'">'+(ar==="b"?"Conferma: bilancia (punteggi di questo turno azzerati)":"Bilancia i gironi per punti")+'</button>':'')+'<span class="hint" style="margin:0">Cambia solo i gironi di questo turno: i turni precedenti restano com’erano. Puoi anche trascinare ⠿ su un altro partecipante per scambiarli, o su un girone per spostarlo lì.'+(ri>0?' «Bilancia» distribuisce i più forti in gironi diversi.':'')+'</span></div>';
      if(ev.every(function(e){return e.ok})){var tot=ev.reduce(function(a,e){return a+e.adv.length},0),ng=ffaK(tot,F.gs);
        h+='<div class="row" style="margin-top:14px"><button class="p" id="ffanext">Genera turno successivo</button><span class="hint" style="margin:0">Passano '+tot+' giocatori: '+(ng===1?"finale":ng+" gironi")+'.</span></div>'}
      else h+='<p class="hint">Inserisci i punteggi di tutti i giocatori (i pareggi sono ammessi: chi è a pari punti sul limite passa il turno) per passare al turno successivo.</p>';
    }
    h+='</section>';
  });
  return h;
}
/* ---- spostamento con trascinamento ---- */
var GRIP='<span class="grip" draggable="true" title="Trascina per spostare" aria-hidden="true">⠿</span>',DRAG=null,OVER=null;
function r0Free(R,i){if(!R)return false;var m=R[0][i];if(m.sa!=null||m.sb!=null)return false;if(m.w&&R.length>1){var nx=R[1][i>>1];if(nx.w||nx.sa!=null||nx.sb!=null)return false}return true}
function r0Fix(R,i){var m=R[0][i];clearFrom(R,0,i);if(!m.a&&m.b){m.a=m.b;m.b=null}if(m.a&&!m.b)setWinner(R,0,i,m.a)}
function toast(t){var el=$("toast");if(!el){el=document.createElement("div");el.id="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=t;el.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove("on")},3500)}
function moveBracket(g,src,dst){
  var R=g.rounds,si=+src.i,di=+dst.i,sk=src.k,dk=dst.k;
  if(si===di&&sk===dk)return false;
  if(!r0Free(R,si)||!r0Free(R,di)){toast("Si possono spostare solo i partecipanti di partite del primo turno senza risultati.");return false}
  var A=R[0][si],B=R[0][di],x=A[sk],y=B[dk];A[sk]=y;B[dk]=x;
  if((!A.a&&!A.b)||(!B.a&&!B.b)){A[sk]=x;B[dk]=y;toast("Ogni partita del primo turno deve avere almeno un partecipante.");return false}
  r0Fix(R,si);if(di!==si)r0Fix(R,di);syncThird(g);return true;
}
function moveFfa(g,src,dst){
  var rd=g.ffa.rounds[g.ffa.rounds.length-1],sg=rd.groups[+src.g],dg=rd.groups[+dst.g],sn=src.p,dn=dst.p;
  if(!sg||!dg||sn===dn)return false;
  var a=sg.p.indexOf(sn);if(a<0)return false;
  if(dn!==undefined){var b=dg.p.indexOf(dn);if(b<0)return false;sg.p[a]=dn;dg.p[b]=sn;if(sg!==dg){delete sg.s[sn];delete dg.s[dn]}}
  else if(sg===dg){sg.p.splice(a,1);sg.p.push(sn)}
  else{if(sg.p.length<=2){toast("Un girone deve avere almeno 2 partecipanti: trascina su un nome per scambiarli.");return false}sg.p.splice(a,1);delete sg.s[sn];dg.p.push(sn)}
  shufArm=null;return true;
}
function dzOver(el){if(OVER===el)return;if(OVER)OVER.classList.remove("dz-over");OVER=el;if(el)el.classList.add("dz-over")}
function dzEnd(){dzOver(null);var d=document.querySelector(".dragging");if(d)d.classList.remove("dragging");DRAG=null}
function touch(g){if(g.phase!=="setup"&&!g.running)g.dirty=true}
function startT(g){
  g.groups=null;g.rounds=null;g.third=null;g.ffa=null;g.de=null;g.sw=null;g.dirty=false;g.running=true;
  if(g.mode==="elim"){g.rounds=bracket(shuffle(g.players));g.phase="final";syncThird(g)}
  else if(g.mode==="double"){g.de={seeds:shuffle(g.players),res:{}};g.phase="de"}
  else if(g.mode==="swiss"){g.sw={nr:g.swR||TF.swDefaultRounds(g.players.length),top:Math.min(g.swTop||0,g.players.length),rounds:[TF.swPair(g.players,[],shuffle)]};g.phase="sw"}
  else if(g.mode==="rr"){g.groups=rrGroups(g);g.phase="groups"}
  else{var gs0=ffaGsOf(g);g.ffa={gs:gs0,adv:ffaAdvOf(g),rounds:[{groups:ffaGroups(shuffle(g.players),gs0)}]};g.phase="ffa"}
  save();render();
}
/* ---- immagine PNG del tabellone ---- */
function loadImg(src){return new Promise(function(r){var i=new Image();i.onload=function(){r(i)};i.onerror=function(){r(null)};i.src=src})}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
/* nomi e titoli scritti dall'utente: nelle immagini restano come sono, non si traducono nella lingua del torneo */
function K(s){return window.I18N&&I18N.keep?I18N.keep(s):s}
function uiTitle(){return S.ui.title?K(S.ui.title):UI0.title}
function uiSub(){return S.ui.sub?K(S.ui.sub):UI0.sub}
function fit(c,t,w){t=String(t);if(c.measureText(t).width<=w)return t;while(t.length>1&&c.measureText(t+"…").width>w)t=t.slice(0,-1);return t+"…"}
function wrap(c,t,w,max,u){
  var q=u?K:String,lines=[],cur="";
  String(t).split(" ").forEach(function(wd){var tt=cur?cur+" "+wd:wd;if(c.measureText(q(tt)).width>w&&cur){lines.push(cur);cur=wd}else cur=tt});
  if(cur)lines.push(cur);lines=lines.map(q);
  if(lines.length>max){lines=lines.slice(0,max);lines[max-1]=fit(c,lines[max-1]+"…",w)}
  return lines;
}
function drawM(c,m,x,y,w,h,BODY){
  c.fillStyle="#fff";rr(c,x,y,w,h,8);c.fill();
  [["a","sa"],["b","sb"]].forEach(function(p,i){
    var n=m[p[0]],ry=y+i*h/2,win=m.w&&m.w===n;
    if(win){c.save();rr(c,x,y,w,h,8);c.clip();c.fillStyle="rgba(255,90,31,.25)";c.fillRect(x,ry,w,h/2);c.restore()}
    c.textBaseline="middle";
    if(!n){c.fillStyle="#999";c.font="italic 15px "+BODY;c.fillText(i===1&&m.a&&!m.b?"Passa il turno":"Da definire",x+10,ry+h/4)}
    else{
      c.fillStyle=m.w&&!win?"#888":"#111";c.font=(win?"bold ":"")+"16px "+BODY;
      c.fillText(fit(c,K(n),w-62),x+10,ry+h/4);
      var sc=m[p[1]];if(sc!=null){c.textAlign="right";c.fillText(String(sc),x+w-10,ry+h/4);c.textAlign="left"}
    }
  });
  c.textBaseline="alphabetic";c.strokeStyle="#111";c.lineWidth=2;
  c.beginPath();c.moveTo(x,y+h/2);c.lineTo(x+w,y+h/2);c.stroke();rr(c,x,y,w,h,8);c.stroke();
}
async function makePng(k){
  var g=S.games[k],d=DEF[k],res=result(g,k),team=res.team,mem=g.members||{};
  var FONT='"FragDisplay","Arial Black",Impact,sans-serif',BODY='Inter,"Segoe UI",Arial,sans-serif';
  try{await document.fonts.load('24px "FragDisplay"')}catch(e){}
  var le=document.getElementById("logoFull"),logo=le?await loadImg(le.src):null,gi=await loadImg(g.logo||IMG[k]);
  var R=g.rounds,solo=false,M=40,colW=230,gx=46,mh=60,gy=22,SC=2;
  var nr=R?R.length:0,bw=nr?nr*colW+(nr-1)*gx:0,W=Math.max(1000,bw+2*M);
  var hHead=150,hPod=230,hBr=0,hTh=0,hSolo=0,bh=0;
  if(R){bh=R[0].length*mh+(R[0].length-1)*gy;hBr=50+bh;if(g.third&&g.third.match)hTh=40+mh+10}
  if(solo)g.groups.forEach(function(x){hSolo+=50+(x.players.length+1)*34+10});
  var hF=0;
  if(g.ffa){var per0=Math.max(1,Math.floor((W-2*M+20)/320));g.ffa.rounds.forEach(function(rd){var mx0=Math.max.apply(null,rd.groups.map(function(x){return x.p.length}));hF+=30+Math.ceil(rd.groups.length/per0)*(52+mx0*32+14+14)+22})}
  /* opzione del torneo (Impostazioni, Bot Telegram): nei tornei a squadre l'immagine elenca i giocatori di ogni squadra */
  var TL=team&&S.ev&&S.ev.pngTeams?g.players.slice():[],tcw=300,tcg=20,tper=Math.max(1,Math.floor((W-2*M+tcg)/(tcw+tcg))),tRows=[],hT=0;
  for(var ti=0;ti<TL.length;ti+=tper){var rowH=0;TL.slice(ti,ti+tper).forEach(function(t){rowH=Math.max(rowH,48+Math.max(1,(mem[t]||[]).length)*24+12)});tRows.push(rowH);hT+=rowH+14}
  if(TL.length)hT+=50;
  var H=hHead+hPod+hBr+hTh+hSolo+hF+hT+60;
  var cv=document.createElement("canvas");cv.width=W*SC;cv.height=H*SC;
  var c=cv.getContext("2d");c.scale(SC,SC);c.fillStyle="#fff";c.fillRect(0,0,W,H);
  c.fillStyle="#111";c.fillRect(0,0,W,hHead);c.fillStyle="#FF5A1F";c.fillRect(0,hHead-6,W,6);
  var lx=M;
  if(logo){var lh=104,lw=lh*logo.width/logo.height;c.fillStyle="#fff";rr(c,M,14,lw+20,lh+20,10);c.fill();c.drawImage(logo,M+10,24,lw,lh);lx=M+lw+50}
  var gw=0;
  if(gi){var bs=100;gw=bs;c.fillStyle="#fff";rr(c,W-M-bs,25,bs,bs,10);c.fill();var q=Math.min((bs-16)/gi.width,(bs-16)/gi.height),iw=gi.width*q,ih=gi.height*q;c.drawImage(gi,W-M-bs+(bs-iw)/2,25+(bs-ih)/2,iw,ih)}
  var tw=W-lx-M-(gi?gw+40:0);
  c.fillStyle="#fff";c.font="36px "+FONT;c.fillText(fit(c,K(g.name||d.l),tw),lx,72);
  c.font="18px "+BODY;c.fillStyle="#C8C8C8";
  c.fillText(fit(c,(g.name?K(d.l)+" · ":"")+(g.plat&&PLATN[g.plat]?PLATN[g.plat]+" · ":"")+uiTitle()+" · "+new Date().toLocaleDateString(evLoc(),{day:"numeric",month:"long",year:"numeric"}),tw),lx,104);
  var y=hHead+36;c.fillStyle="#111";c.font="22px "+FONT;c.fillText("Vincitori",M,y);
  var nPod=Math.min(6,Math.max(3,res.top.length)),cw=(W-2*M-20*(nPod-1))/nPod,cy=y+16,ch=150,lab=["1º","2º","3º"];
  var tIm={};if(team)for(var q=0;q<res.top.length;q++)if(res.top[q])tIm[res.top[q]]=await iconImg(res.top[q],"#111");
  res.top.forEach(function(n,i){
    if(!n||i>=6)return;var pp=(res.tpos&&res.tpos[i])||i+1,x=M+i*(cw+20),first=pp===1;
    c.fillStyle=first?"#FF5A1F":"#F2F2F2";rr(c,x,cy,cw,ch,12);c.fill();c.lineWidth=3;c.strokeStyle="#111";rr(c,x,cy,cw,ch,12);c.stroke();
    c.fillStyle="#111";c.font="30px "+FONT;c.fillText(lab[pp-1]||(pp+"º"),x+18,cy+44);
    c.font="26px "+FONT;c.fillText(fit(c,K(n),cw-36),x+18,cy+82);if(tIm[n])c.drawImage(tIm[n],x+cw-18-52,cy+14,52,52);
    if(team){c.font="15px "+BODY;c.fillStyle=first?"#111":"#444";wrap(c,(mem[n]||[]).join(", "),cw-36,3,true).forEach(function(l,j){c.fillText(l,x+18,cy+106+j*19)})}
  });
  var by=hHead+hPod;
  if(R){
    c.fillStyle="#111";c.font="22px "+FONT;c.fillText(g.groups?"Fase finale":"Tabellone",M,by+10);
    var top=by+50,Y=[],ox=(W-bw)/2;
    R.forEach(function(rd,r){Y[r]=[];rd.forEach(function(m,i){Y[r][i]=r===0?top+i*(mh+gy):(Y[r-1][2*i]+Y[r-1][2*i+1])/2})});
    R.forEach(function(rd,r){
      var x=ox+r*(colW+gx);c.fillStyle="#666";c.font="15px "+BODY;c.fillText(roundName(r,R.length),x,top-12);
      rd.forEach(function(m,i){
        if(r>0)[2*i,2*i+1].forEach(function(j){var px=x-gx,py=Y[r-1][j]+mh/2,ty=Y[r][i]+mh/2;c.strokeStyle="#999";c.lineWidth=2;c.beginPath();c.moveTo(px,py);c.lineTo(px+gx/2,py);c.lineTo(px+gx/2,ty);c.lineTo(x,ty);c.stroke()});
        drawM(c,m,x,Y[r][i],colW,mh,BODY);
      });
    });
    if(g.third&&g.third.match){var ty3=top+bh+40;c.fillStyle="#666";c.font="15px "+BODY;c.fillText("Finale 3º/4º posto",ox,ty3-12);drawM(c,g.third,ox,ty3,colW,mh,BODY)}
  }
  if(solo){
    var sy=by+10;
    g.groups.forEach(function(x,gn){
      c.fillStyle="#111";c.font="22px "+FONT;c.textBaseline="alphabetic";
      c.fillText(g.groups.length>1?"Classifica girone "+String.fromCharCode(65+gn):"Classifica",M,sy+10);
      var st=standings(x,g),ty=sy+30,tw2=W-2*M;
      c.fillStyle="#111";c.fillRect(M,ty,tw2,34);c.fillStyle="#fff";c.font="bold 15px "+BODY;c.textBaseline="middle";
      c.fillText("Pos.",M+12,ty+17);c.fillText(team?"Squadra":"Giocatore",M+80,ty+17);
      c.textAlign="right";c.fillText("G",M+tw2-120,ty+17);c.fillText("Punti",M+tw2-14,ty+17);c.textAlign="left";
      st.forEach(function(r,i){
        var ry=ty+34*(i+1);if(i<3){c.fillStyle="rgba(255,90,31,.22)";c.fillRect(M,ry,tw2,34)}
        c.fillStyle="#111";c.font=(i<3?"bold ":"")+"16px "+BODY;
        var ms=team&&mem[r.n]&&mem[r.n].length?" — "+K(mem[r.n].join(", ")):"";
        c.fillText(String(i+1),M+12,ry+17);c.fillText(fit(c,K(r.n)+ms,tw2-250),M+80,ry+17);
        c.textAlign="right";c.fillText(String(r.g),M+tw2-120,ry+17);c.fillText(String(r.pt),M+tw2-14,ry+17);c.textAlign="left";
        c.strokeStyle="#ddd";c.lineWidth=1;c.beginPath();c.moveTo(M,ry+34);c.lineTo(M+tw2,ry+34);c.stroke();
      });
      c.textBaseline="alphabetic";sy+=50+(x.players.length+1)*34+10;
    });
  }
  if(g.ffa){
    var cwd=300,cg=20,per=Math.max(1,Math.floor((W-2*M+cg)/(cwd+cg))),yy=by+10,F=g.ffa;
    F.rounds.forEach(function(rd,ri){
      var fin=rd.groups.length===1,mx=Math.max.apply(null,rd.groups.map(function(x){return x.p.length})),ch=52+mx*32+14;
      c.fillStyle="#111";c.font="26px "+FONT;c.textBaseline="alphabetic";c.fillText(fin?"Finale":"Turno "+(ri+1),M,yy+10);yy+=30;
      rd.groups.forEach(function(gr,gi){
        var col=gi%per,row=Math.floor(gi/per),x=M+col*(cwd+cg),y0=yy+row*(ch+14),e=gEval(gr,fin,F.adv),rk=e.rk;
        c.fillStyle="#F2F2F2";rr(c,x,y0,cwd,ch,10);c.fill();c.strokeStyle="#111";c.lineWidth=2;rr(c,x,y0,cwd,ch,10);c.stroke();
        c.fillStyle="#666";c.font="bold 16px "+BODY;c.fillText(fin?"Finale":"Girone "+String.fromCharCode(65+gi),x+14,y0+28);
        gr.p.forEach(function(n,k){
          var ry=y0+54+k*32,pos=e.full?rk[n]:null,ad=e.full&&e.adv.indexOf(n)>=0;
          if(ad){c.fillStyle="rgba(255,90,31,.25)";c.fillRect(x+6,ry-20,cwd-12,28)}
          c.fillStyle="#111";c.font=(ad?"bold ":"")+"17px "+BODY;c.fillText(fit(c,K(n),cwd-130),x+14,ry);
          c.textAlign="right";c.fillText(gr.s[n]==null?"–":String(gr.s[n]),x+cwd-48,ry);c.fillText(ad?(fin?pos+"º":"✓"):"",x+cwd-14,ry);c.textAlign="left";
        });
      });
      yy+=Math.ceil(rd.groups.length/per)*(ch+14)+22;
    });
  }
  if(TL.length){
    var ty0=hHead+hPod+hBr+hTh+hSolo+hF+20;c.textBaseline="alphabetic";c.fillStyle="#111";c.font="22px "+FONT;c.fillText("Squadre",M,ty0+10);ty0+=30;
    TL.forEach(function(t,i){
      var col=i%tper,row=Math.floor(i/tper),x=M+col*(tcw+tcg),y0=ty0;for(var r0=0;r0<row;r0++)y0+=tRows[r0]+14;
      var ms=mem[t]||[];c.fillStyle="#F2F2F2";rr(c,x,y0,tcw,tRows[row],10);c.fill();c.strokeStyle="#111";c.lineWidth=2;rr(c,x,y0,tcw,tRows[row],10);c.stroke();
      c.fillStyle="#111";c.font="bold 18px "+BODY;c.fillText(fit(c,K(t),tcw-28),x+14,y0+30);
      c.font="16px "+BODY;c.fillStyle=ms.length?"#333":"#999";
      if(!ms.length)c.fillText("Nessun giocatore in squadra",x+14,y0+58);
      ms.forEach(function(n,j){c.fillText(fit(c,K(n),tcw-28),x+14,y0+58+j*24)});
    });
  }
  c.fillStyle="#999";c.font="14px "+BODY;c.textAlign="center";c.fillText(uiTitle()+" · "+uiSub(),W/2,H-24);c.textAlign="left";
  return cv;
}
function dlBlob(blob,fn){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();a.remove()}
async function savePng(k){
  var m=document.getElementById("pngmsg");function say(t){if(m)m.textContent=t}
  say("Creo l'immagine…");
  try{
    var cv=await makePng(k),blob=await new Promise(function(r){cv.toBlob(r,"image/png")}),fn="tornei-fragmarathon-"+k+".png";
    if(DL)await DL.save({filename:fn,data:blob});else dlBlob(blob,fn);
    say("Immagine pronta.");
  }catch(e){say(e&&e.code==="declined"?"Salvataggio annullato.":"Non sono riuscito a creare l'immagine.")}
}
$("resbox").onclick=function(e){var b=e.target.closest("button");if(b&&b.dataset.png)savePng(b.dataset.png);if(b&&b.id==="csv")exportCsv()};
var TICON={"ALPHA": "<path d=\"M12 3l9 5.2v3.3L12 6.3 3 11.5V8.2z\"/><path d=\"M12 10.5l9 5.2V19L12 13.8 3 19v-3.3z\"/>", "DELTA": "<path d=\"M12 3 22 20.5H2zM12 9.5 6.6 18.3h10.8z\"/>", "BRAVO": "<path d=\"M12 2 20 5v6.5c0 4.8-3.3 8.7-8 10.5-4.7-1.8-8-5.7-8-10.5V5zM12 7l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z\"/>", "FOX": "<path d=\"M2.5 3l6 3.3h7L21.5 3l-.8 9.5L12 21.5 3.3 12.5zM7.5 11.5l2.3 1-2.3 1zM16.5 11.5l-2.3 1 2.3 1zM12 17.5l-1.2-1.5h2.4z\"/>", "OMEGA": "<path d=\"M4 20h5v-2.7A7.3 7.3 0 1 1 15 17.3V20h5\" fill=\"none\" stroke=\"%C\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>", "WOLF": "<path d=\"M4 3c3 6 4 12 3 18C5 15 4 9 4 3zM10.5 3c3 6 4 12 3 18-2-6-3-12-3-18zM17 3c3 6 4 12 3 18-2-6-3-12-3-18z\"/>", "ACE": "<path d=\"M12 2c3.2 4.2 8 6.7 8 11.2a4.3 4.3 0 0 1-7.2 3.1c.2 2 .7 3.7 2 5.7H9.2c1.3-2 1.8-3.7 2-5.7A4.3 4.3 0 0 1 4 13.2C4 8.7 8.800 6.2 12 2z\"/>", "SKYNET": "<circle cx=\"12\" cy=\"12\" r=\"3.2\"/><circle cx=\"12\" cy=\"3.8\" r=\"1.9\"/><circle cx=\"20.2\" cy=\"12\" r=\"1.9\"/><circle cx=\"12\" cy=\"20.2\" r=\"1.9\"/><circle cx=\"3.8\" cy=\"12\" r=\"1.9\"/><path d=\"M12 5.7v3.1M18.3 12h-3.1M12 18.3v-3.1M5.7 12h3.1\" fill=\"none\" stroke=\"%C\" stroke-width=\"1.7\"/>", "VIPER": "<path d=\"M12 2C7.5 2 4.5 5 4.5 8.8c0 2.8 1.8 4.8 3.7 6L7 19l2.5 3h5L17 19l-1.2-4.2c1.9-1.2 3.7-3.2 3.7-6C19.5 5 16.5 2 12 2zM7.5 8.2l3.2 1.5-3.2.8zM16.5 8.2l-3.2 1.5 3.2.8z\"/>", "GHOST": "<path d=\"M12 2C8 2 5 5 5 9.5V22l3-2 4 2 4-2 3 2V9.5C19 5 16 2 12 2zM8 9l3 1.3-3 1zM16 9l-3 1.3 3 1z\"/>", "TITAN": "<path d=\"M12 2C7 2 3.5 5.5 3.5 10.5V17l3.5 1.2V22h10v-3.8l3.5-1.2v-6.5C20.5 5.5 17 2 12 2zM7 10h10v3.2H7zM10.8 13.2h2.4V18h-2.4z\"/>", "RAVEN": "<path d=\"M12 4l2 5 8-4c-1 6-4 10-8 11.5L13 21h-2l-1-4.5C6 15 3 11 2 5l8 4z\"/>", "COBRA": "<path d=\"M12 2c-2 0-3.5 1.5-3.5 3.5 0 1.500.8 2.700 2 3.300C6.800 10 3 12.600 3 15.800 3 18.500 5.200 20 8 20h1v2h6v-2h1c2.800 0 5-1.500 5-4.200 0-3.200-3.800-5.800-7.500-7 1.200-.6 2-1.800 2-3.300C15.500 3.500 14 2 12 2zM10 5.500l1.200.8-1.200.5zM14 5.500l-1.200.8 1.200.5z\"/>", "REAPER": "<path d=\"M12 2C7 2 3.5 5.500 3.500 10c0 2.800 1.200 4.700 3 6V20h3v-2h1v2h2v-2h1v2h3v-4c1.800-1.300 3-3.200 3-6C20.500 5.500 17 2 12 2zM7.500 9.500a2 2.300 0 1 0 4 0 2 2.300 0 1 0-4 0zM12.500 9.500a2 2.300 0 1 0 4 0 2 2.300 0 1 0-4 0zM12 13l-1.200 2h2.400z\"/>", "HAWK": "<path d=\"M1.500 12C4 7.500 8 5 12 5s8 2.500 10.500 7C20 16.500 16 19 12 19S4 16.500 1.500 12z\" fill=\"none\" stroke=\"%C\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3.500\"/>", "STORM": "<path d=\"M13.500 2 4.500 13.500H11L9.500 22l10-12.500H13z\"/>", "PHANTOM": "<path d=\"M12 3C7 3 3 6.200 3 10.500c0 3 2 5.500 4.500 6.800C8 19.500 9.700 21.500 12 21.500s4-2 4.500-4.200C19 16 21 13.500 21 10.500 21 6.200 17 3 12 3zM5.800 9.300l5.200 1.600-.6 2.700zM18.200 9.300l-5.200 1.600.6 2.700z\"/>", "BLADE": "<path d=\"M12 1.500l3 11H9z\"/><path d=\"M6 13h12v2.200H6z\"/><path d=\"M10.800 15.200h2.400v6.300h-2.400z\"/>", "GENERIC": "<circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"none\" stroke=\"%C\" stroke-width=\"2\"/><path d=\"M12 2v5M12 17v5M2 12h5M17 12h5\" fill=\"none\" stroke=\"%C\" stroke-width=\"2\" stroke-linecap=\"round\"/>"};
function tkey(n){var b=String(n).toUpperCase().replace(/\s+\d+$/,"");if(TICON[b]&&b!=="GENERIC")return b;var h=0;for(var i=0;i<b.length;i++)h=(h*31+b.charCodeAt(i))>>>0;return TEAMS[h%TEAMS.length]}
function tsvg(n,sz,col){return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="'+col+'" fill-rule="evenodd" aria-hidden="true">'+TICON[tkey(n)].split("%C").join(col)+'</svg>'}
function tico(n,sz){return'<span class="ti">'+tsvg(n,sz||24,"currentColor")+'</span>'}
function iconImg(n,col){return loadImg("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(tsvg(n,96,col||"#111")))}
function jpegBytes(cv){var b=atob(cv.toDataURL("image/jpeg",0.92).split(",")[1]),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function makePdf(cvs){
  var chunks=[],offs=[],pos=0,enc=new TextEncoder();
  function w(x){var b=typeof x==="string"?enc.encode(x):x;chunks.push(b);pos+=b.length}
  function obj(n,body){offs[n]=pos;w(n+" 0 obj\n"+body+"\nendobj\n")}
  var n=cvs.length,kids=[];for(var i=0;i<n;i++)kids.push((3+3*i)+" 0 R");
  w("%PDF-1.4\n");
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,"<< /Type /Pages /Kids ["+kids.join(" ")+"] /Count "+n+" >>");
  cvs.forEach(function(c,i){
    var jb=jpegBytes(c),p=3+3*i,ct="q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    obj(p,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 "+(p+2)+" 0 R >> >> /Contents "+(p+1)+" 0 R >>");
    obj(p+1,"<< /Length "+ct.length+" >>\nstream\n"+ct+"\nendstream");
    offs[p+2]=pos;w((p+2)+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+c.width+" /Height "+c.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jb.length+" >>\nstream\n");w(jb);w("\nendstream\nendobj\n");
  });
  var xr=pos,total=3*n+3;
  w("xref\n0 "+total+"\n0000000000 65535 f \n");
  for(var k=1;k<total;k++)w(("0000000000"+offs[k]).slice(-10)+" 00000 n \n");
  w("trailer\n<< /Size "+total+" /Root 1 0 R >>\nstartxref\n"+xr+"\n%%EOF");
  var all=new Uint8Array(pos),o=0;chunks.forEach(function(c){all.set(c,o);o+=c.length});
  return new Blob([all],{type:"application/pdf"});
}
async function makePrint(kind){
  var FONT='"FragDisplay","Arial Black",Impact,sans-serif',BODY='Inter,"Segoe UI",Arial,sans-serif',PW=1240,PH=1754,M=70,LIM=PH-110;
  try{await document.fonts.load('24px "FragDisplay"')}catch(e){}
  var le=document.getElementById("logoFull"),logo=le?await loadImg(le.src):null;
  var pages=[],c,y,pageTop=0,title=kind==="roster"?"Elenco partecipanti":"Elenco squadre",ui=uiTitle();
  var dateS=new Date().toLocaleDateString(evLoc(),{day:"numeric",month:"long",year:"numeric"});
  function newPage(){
    var cv=document.createElement("canvas");cv.width=PW;cv.height=PH;c=cv.getContext("2d");pages.push(cv);
    var first=pages.length===1,hh=first?200:84;
    c.fillStyle="#fff";c.fillRect(0,0,PW,PH);c.fillStyle="#111";c.fillRect(0,0,PW,hh);c.fillStyle="#FF5A1F";c.fillRect(0,hh,PW,first?9:6);
    c.textBaseline="alphabetic";c.textAlign="left";
    if(first){
      var tx=M;
      if(logo){var lh=130,lw=lh*logo.width/logo.height;c.fillStyle="#fff";rr(c,M,25,lw+24,lh+24,14);c.fill();c.drawImage(logo,M+12,37,lw,lh);tx=M+lw+64}
      c.fillStyle="#fff";c.font="52px "+FONT;c.fillText(title,tx,98);
      c.font="26px "+BODY;c.fillStyle="#C8C8C8";c.fillText(fit(c,ui+" · "+dateS,PW-tx-M),tx,142);
      y=hh+9+60;
    }else{c.fillStyle="#fff";c.font="32px "+FONT;c.fillText(title,M,55);y=hh+6+60}
    c.strokeStyle="#FF5A1F";c.lineWidth=3;c.beginPath();c.moveTo(M,PH-68);c.lineTo(PW-M,PH-68);c.stroke();
    c.fillStyle="#999";c.font="20px "+BODY;c.fillText(ui+" · "+uiSub(),M,PH-36);
    c.textAlign="right";c.fillText("Pagina "+pages.length,PW-M,PH-36);c.textAlign="left";pageTop=y;
  }
  function sectionTitle(t,need){
    if(y+(need||220)>LIM)newPage();
    c.fillStyle="#FF5A1F";c.fillRect(M,y-30,10,42);c.fillStyle="#111";c.font="36px "+FONT;c.fillText(fit(c,t,PW-2*M-30),M+28,y+2);y+=54;
  }
  function empty(t){c.fillStyle="#666";c.font="26px "+BODY;c.fillText(t,M,y+10);y+=60}
  function drawPlayers(){
    var names=S.roster,tn={};S.teams.forEach(function(t){t.m.forEach(function(m){tn[m.toLowerCase()]=t.n})});
    sectionTitle("Partecipanti ("+names.length+")");
    if(!names.length){empty("Nessun partecipante in lista.");return}
    var rowH=58,colW=(PW-2*M-40)/2,i=0;
    while(i<names.length){
      var cap=Math.floor((LIM-y)/rowH);if(cap<1){newPage();continue}
      var rem=names.length-i,half=rem<=cap*2?Math.ceil(rem/2):cap,per=Math.min(rem,half*2),y0=y;
      for(var j=0;j<per;j++){
        var col=j<half?0:1,row=j<half?j:j-half,x=M+col*(colW+40),yy=y0+row*rowH,n=names[i+j];
        if((i+j)%2===0){c.fillStyle="#F2F2F2";rr(c,x,yy,colW,rowH-8,8);c.fill()}
        c.strokeStyle="#111";c.lineWidth=3;c.strokeRect(x+14,yy+11,26,26);
        c.fillStyle="#999";c.font="22px "+BODY;c.fillText(String(i+j+1),x+54,yy+34);
        c.fillStyle="#111";c.font="bold 28px "+BODY;c.fillText(fit(c,K(n),colW-270),x+104,yy+36);
        var tm=tn[n.toLowerCase()];
        if(tm){c.font="20px "+BODY;c.fillStyle="#666";c.textAlign="right";c.fillText(fit(c,K(tm),150),x+colW-14,yy+34);c.textAlign="left"}
      }
      y=y0+half*rowH+20;i+=per;if(i<names.length)newPage();
    }
  }
  function cardH(t){return 130+Math.max(1,t.m.length)*40}
  async function drawTeams(list,heading,note){
    sectionTitle(heading,300);
    if(note){c.fillStyle="#666";c.font="22px "+BODY;c.fillText(fit(c,note,PW-2*M),M,y-8);y+=30}
    var cw=(PW-2*M-30)/2,ims={};
    for(var q=0;q<list.length;q++)ims[list[q].n]=await iconImg(list[q].n,"#111");
    /* una squadra che non sta in una pagina (35+ giocatori) si divide in più schede: senza, il ciclo sotto aprirebbe pagine all'infinito */
    var MAXM=Math.max(1,Math.floor((LIM-150-130)/40));
    list=[].concat.apply([],list.map(function(t){if(t.m.length<=MAXM)return[t];var p=[];for(var k=0;k<t.m.length;k+=MAXM)p.push({n:t.n,m:t.m.slice(k,k+MAXM),tot:t.m.length,cont:k>0});return p}));
    function card(t,x,yy,h){
      c.fillStyle="#F2F2F2";rr(c,x,yy,cw,h,14);c.fill();c.strokeStyle="#111";c.lineWidth=3;rr(c,x,yy,cw,h,14);c.stroke();
      c.fillStyle="#fff";rr(c,x+18,yy+18,68,68,12);c.fill();c.strokeStyle="#D4D4D4";c.lineWidth=2;rr(c,x+18,yy+18,68,68,12);c.stroke();
      if(ims[t.n])c.drawImage(ims[t.n],x+26,yy+26,52,52);
      c.fillStyle="#111";c.font="34px "+FONT;c.fillText(fit(c,K(t.n),cw-130),x+104,yy+58);
      var nm=t.tot||t.m.length;c.font="20px "+BODY;c.fillStyle="#666";c.fillText(nm+(nm===1?" giocatore":" giocatori")+(t.cont?" (segue)":""),x+104,yy+84);
      c.fillStyle="#FF5A1F";c.fillRect(x+18,yy+100,cw-36,4);
      if(!t.m.length){c.fillStyle="#999";c.font="italic 24px "+BODY;c.fillText("Nessun giocatore",x+22,yy+142)}
      t.m.forEach(function(m,k){c.fillStyle="#111";c.fillRect(x+24,yy+126+k*40,12,12);c.font="26px "+BODY;c.fillText(fit(c,K(m),cw-90),x+50,yy+139+k*40)});
    }
    var i=0;
    while(i<list.length){
      var a=list[i],b2=list[i+1],h=Math.max(cardH(a),b2?cardH(b2):0);
      /* su una pagina appena aperta si disegna comunque: niente pagine nuove all'infinito */
      if(y+h>LIM&&y>pageTop){newPage();continue}
      card(a,M,y,h);if(b2)card(b2,M+cw+30,y,h);
      y+=h+24;i+=2;
    }
    y+=10;
  }
  newPage();
  if(kind==="roster")drawPlayers();
  else{
    var fixed=S.teams.map(function(t){return{n:t.n,m:t.m.slice()}});
    function sig(l){return JSON.stringify(l.map(function(t){return t.n+":"+t.m.slice().sort().join("|")}).sort())}
    var sets=[],usedBy=[];
    Object.keys(DEF).forEach(function(k){
      var g=S.games[k],team=g.team!==undefined?g.team:!!DEF[k].t;
      if(!team||!g.players.length)return;
      var l=g.players.map(function(n){return{n:n,m:((g.members||{})[n]||[]).slice()}});
      if(fixed.length&&sig(l)===sig(fixed))usedBy.push(DEF[k].l);else sets.push(["Squadre · "+K(DEF[k].l),l]);
    });
    if(fixed.length)sets.unshift(["Squadre fisse",fixed,usedBy.length?"Abbinate in: "+K(usedBy.join(", ")):"Valide per tutti i tornei"]);
    if(!sets.length){sectionTitle("Squadre");empty("Nessuna squadra creata.")}
    for(var s2=0;s2<sets.length;s2++)await drawTeams(sets[s2][1],sets[s2][0],sets[s2][2]);
  }
  return pages;
}
async function printDoc(kind,msgEl){
  function say(t){if(msgEl)msgEl.textContent=t}
  say("Creo il PDF…");
  try{
    var blob=makePdf(await makePrint(kind)),fn=kind==="roster"?"elenco-partecipanti-A4.pdf":"elenco-squadre-A4.pdf";
    if(DL)await DL.save({filename:fn,data:blob});else dlBlob(blob,fn);
    say("PDF pronto: aprilo e stampalo su foglio A4.");
  }catch(e){say(e&&e.code==="declined"?"Salvataggio annullato.":"Non sono riuscito a creare il PDF.")}
}
$("sqbox").onclick=function(e){var b=e.target.closest("button");if(b&&b.dataset.print)printDoc(b.dataset.print,b.parentNode.querySelector(".pmsg"))};
function addPlayer(){
  var g=G(),v=$("pname").value.trim();if(!v||g.running)return;
  if(g.players.some(function(p){return p.toLowerCase()===v.toLowerCase()})){$("pname").select();return}
  touch(g);g.players.push(v);save();render();$("pname").focus();
}

/* ---- eventi ---- */
$("tabs0").onclick=$("tabs").onclick=function(e){var b=e.target.closest("button");if(!b)return;
  if(b.id==="undodel"){undoDel();return}
  if(b.id==="helpbtn"){openHelp(helpCtx());return}
  if(b.id==="livebtn"){var lb=$("livebox");lb.hidden=!lb.hidden;if(!lb.hidden){renderLive();strRefresh();lb.scrollIntoView({block:"nearest"})}return}
  if(b.id==="plus"){var ag=$("addgame");ag.hidden=!ag.hidden;if(!ag.hidden){var rr=$("agrestore");if(!rr){rr=document.createElement("div");rr.id="agrestore";rr.className="row";ag.appendChild(rr)}rr.innerHTML=(S.off||[]).length?'<span class="hint" style="margin:0">Rimetti un gioco tolto:</span>'+S.off.map(function(k){return'<button data-restore="'+k+'">'+esc(ORIGL[k])+'</button>'}).join(""):"";$("agname").focus()}return}
  S.cur=b.dataset.k;armed=false;save();render()};
$("tabs0").addEventListener("change",function(e){if(e.target.id==="skin"){S.ui.skin=e.target.value;save();render()}});
$("addgame").onclick=function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.id==="agcancel"){$("addgame").hidden=true;return}
  if(b.id==="agadd"){
    var nm=$("agname").value.trim();if(!nm){$("agname").focus();return}
    var k="c"+Date.now().toString(36);
    S.custom.push({k:k,l:nm,m:$("agmode").value,t:+$("agteam").value});registerCustom();normGames();
    S.games[k].plat=$("agplat").value;S.cur=k;$("agname").value="";$("agplat").value="";$("addgame").hidden=true;save();render();
  }
};
$("addgame").addEventListener("click",function(e){var b=e.target.closest("[data-restore]");if(b)restoreGame(b.getAttribute("data-restore"))});
$("addgame").onkeydown=function(e){if(e.key==="Enter"&&e.target.id==="agname")$("agadd").click()};
var pend=null;
function refocus(){if(pend!==null){var l=document.querySelectorAll("#out .sc:not(:disabled),#out .bs,#out .fs:not(:disabled),#out .fsv:not(:disabled),#out .ds,#out .ws"),x=l[pend];pend=null;if(x)x.focus()}}
$("out").onkeydown=function(e){
  if(e.key!=="Enter"||!/\b(sc|bs|fs|fsv|ds|ws)\b/.test(e.target.className))return;
  var l=[].slice.call(document.querySelectorAll("#out .sc:not(:disabled),#out .bs,#out .fs:not(:disabled),#out .fsv:not(:disabled),#out .ds,#out .ws"));pend=l.indexOf(e.target)+1;e.target.blur();setTimeout(refocus,0);
};
var armDel=null;
/* Le Impostazioni si ridisegnano per intero solo all'apertura, dopo un ripristino o per la diretta. Il resto (logo, AI, CSS)
   ridisegna solo la sua parte: titolo, nomi e CSS scritti e non ancora salvati restano. keep: ridisegno completo che li conserva. */
function logoRow(){return'<img class="elogo" src="'+esc(S.ui.logo||applyUi.def.em)+'" alt="Logo attuale"><button id="elogo">Carica logo…</button>'+(S.ui.logo?'<button id="elogodef">Torna al logo Fragmarathon</button>':'')+'<input type="file" id="elf" accept="image/*" hidden>'}
function cssRow(){return'<button id="ecssimp">Importa file .css…</button><button id="ecssexp">Scarica il modello</button>'+(S.ui.css?'<button id="ecssdel">Rimuovi il CSS</button>':'')+'<input type="file" id="ecf" accept=".css,text/css" hidden>'}
function editPart(id,html){var x=$(id);if(x)x.innerHTML=html}
/* ======================================================================
   Stile da un sito (solo app per Windows): main.js apre il sito in una finestra nascosta e isolata (css:probe)
   e restituisce colori e caratteri già controllati; qui diventano le variabili del tema e un CSS correggibile.
   ====================================================================== */
function cssWebRow(){
  if(!DESK||!DESK.cssProbe)return'<p class="hint">Prendere lo stile da un sito si può solo nell&#39;app installata per Windows.</p>';
  return'<div class="row" style="margin-top:8px"><input type="text" inputmode="url" id="ecssurl" placeholder="https://www.esempio.it" aria-label="Indirizzo del sito da cui prendere lo stile" spellcheck="false" autocomplete="off" style="flex:1 1 260px"><button id="ecssweb">Prendi lo stile dal sito</button></div>'
   +'<p class="hint">Apro il sito in una finestra nascosta e separata, ne leggo colori e caratteri e li trasformo in un CSS per questo programma: lo vedi subito qui sotto, puoi correggerlo, e Annulla cancellazione rimette il CSS di prima.</p>';
}
/* colore qualsiasi (anche oklch, lab, color()) -> [r,g,b] sRGB, passando da un pixel di canvas; null se trasparente o non valido */
function cRgb(c){
  if(!c)return null;
  try{var cv=document.createElement("canvas");cv.width=cv.height=1;var x=cv.getContext("2d",{willReadFrequently:true});
    x.fillStyle="#010203";x.fillStyle=String(c);if(x.fillStyle==="#010203"&&!/^#010203$/i.test(String(c).trim()))return null;
    x.clearRect(0,0,1,1);x.fillRect(0,0,1,1);var d=x.getImageData(0,0,1,1).data;return d[3]<40?null:[d[0],d[1],d[2]]}catch(e){return null}
}
function cHex(c){return"#"+c.map(function(v){return("0"+Math.round(Math.max(0,Math.min(255,v))).toString(16)).slice(-2)}).join("")}
function cMix(a,b,t){return[0,1,2].map(function(i){return a[i]+(b[i]-a[i])*t})}
function cLum(c){var f=function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])}
function cCon(a,b){var x=cLum(a),y=cLum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function cSat(c){var mx=Math.max(c[0],c[1],c[2])/255,mn=Math.min(c[0],c[1],c[2])/255,l=(mx+mn)/2;return mx===mn?0:(mx-mn)/(1-Math.abs(2*l-1))}
function famCss(f){return String(f||"").split(",").map(function(x){x=x.trim().replace(/^["']|["']$/g,"").replace(/["'\\;{}<>]/g,"").trim();return/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(x)?x:x?'"'+x+'"':""}).filter(Boolean).slice(0,5).join(",")}
function cssFromSite(r){
  var W=[255,255,255],B=[17,17,17];
  var bg=cRgb(r.bg)||cRgb(r.page)||W,ink=cRgb(r.ink)||(cLum(bg)>.4?B:[240,240,240]);
  if(cCon(ink,bg)<4)ink=cLum(bg)>.4?B:[242,242,242];
  var dark=cLum(bg)<.35,cands=[];
  /* accento: variabili del sito con nomi da colore principale, poi pulsanti e link, poi i colori saturi più usati */
  Object.keys(r.vars||{}).forEach(function(k){if(/primary|accent|brand|highlight|theme|main|cta/i.test(k)){var c=cRgb(r.vars[k]);if(c)cands.push(c)}});
  if(r.button)cands.push(cRgb(r.button.bg));if(r.link)cands.push(cRgb(r.link));(r.freq||[]).forEach(function(f){cands.push(cRgb(f[0]))});
  cands=cands.filter(Boolean);
  var acc=cands.filter(function(c){return cSat(c)>.35&&cCon(c,bg)>=2}).shift()||cands.filter(function(c){return cSat(c)>.25}).shift()||[255,90,31];
  var panel,pg=bg;
  if(!dark&&cLum(bg)>.85){panel=bg;pg=cMix(bg,ink,.05)}else panel=cMix(bg,ink,dark?.07:.04);
  var hb=r.header&&cRgb(r.header.bg),b1=hb&&cCon(hb,pg)>1.15?hb:(dark?cMix(pg,[0,0,0],.35):cMix(acc,[0,0,0],.7));
  var b2=cMix(b1,cLum(b1)<.3?W:B,.08),wacc=cLum(acc)<.12?cMix(acc,W,.35):acc,accink=cCon(B,acc)>=cCon(W,acc)?"#111111":"#ffffff";
  var hf=r.heading&&famCss(r.heading.font),bf=famCss(r.font),host="";try{host=new URL(r.url).hostname}catch(e){}
  var css="/* Stile preso da "+(host||"un sito").replace(/\*\//g,"")+(r.title?" ("+String(r.title).replace(/\*\/|[\r\n]/g," ")+")":"")+": colori e caratteri del sito, adattati a questo programma. */\n";
  (r.fonts||[]).forEach(function(f){
    if(!f||!/^data:font\/(woff2|woff|ttf);base64,[A-Za-z0-9+\/=]+$/.test(f.data))return;
    css+='@font-face{font-family:"'+String(f.family).replace(/["\\;{}<>]/g,"")+'";src:url('+f.data+') format("'+({woff2:"woff2",woff:"woff",truetype:"truetype"}[f.fmt]||"truetype")+'");font-weight:'+(/^\d{3}$/.test(f.weight)?f.weight:"400")+';font-display:swap}\n';
  });
  css+=":root:not(#x){\n  --bg:"+cHex(pg)+";\n  --panel:"+cHex(panel)+";\n  --ink:"+cHex(ink)+";\n  --mut:"+cHex(cMix(ink,pg,.38))+";\n  --line:"+cHex(cMix(ink,pg,.82))+";\n  --edge:"+cHex(cMix(ink,pg,.62))+";\n  --acc:"+cHex(acc)+";\n  --accink:"+accink+";\n  --win:var(--acc);\n  --gold:var(--acc);\n  --wacc:"+cHex(wacc)+";\n  --b1:"+cHex(b1)+";\n  --b2:"+cHex(b2)+";\n  --glow:rgba("+acc.map(Math.round).join(",")+",.35);\n}\n";
  css+=".brand{background:radial-gradient(circle at 110px 50%,var(--glow),transparent 150px),repeating-linear-gradient(135deg,var(--b1) 0,var(--b1) 15px,var(--b2) 17px,var(--b2) 31px,var(--b1) 33px)}\n";
  if(bf)css+="body{font-family:"+bf+",Inter,\"Segoe UI\",Arial,sans-serif}\n";
  if(hf)css+="h1,h2,h3,.brand h1,.tab{font-family:"+hf+",\"Segoe UI\",Arial,sans-serif}\n";
  return css;
}
function cssWeb(){
  var u=String(($("ecssurl")||{}).value||"").trim();if(!u){toast("Scrivi l'indirizzo del sito.");return}
  if(!DESK||!DESK.cssProbe){toast("Prendere lo stile da un sito si può solo nell'app installata per Windows.");return}
  var b=$("ecssweb");if(b){if(b.disabled)return;b.disabled=true}toast("Leggo lo stile del sito…");
  DESK.cssProbe(u).then(function(r){
    if(b)b.disabled=false;if(!r||r.err){toast((r&&r.err)||"Non riesco a leggere lo stile del sito.");return}
    var css=cssFromSite(r);if(css.length>290000){toast("Lo stile del sito è troppo grande per il CSS personalizzato.");return}
    delSnap("CSS personalizzato di prima");S.ui.css=css;applyUi();save();renderCssRow();
    toast((r.fonts||[]).length?"Stile del sito applicato: colori e caratteri. Puoi correggerlo qui sotto.":"Stile del sito applicato: colori. Puoi correggerlo qui sotto.");
  }).catch(function(){if(b)b.disabled=false;toast("Non riesco a leggere lo stile del sito.")});
}
function renderLogoRow(){editPart("elogorow",logoRow())}
function renderCssRow(){var t=$("ecss");if(t)t.value=S.ui.css||"";editPart("ecssrow",cssRow())}
function renderAiBox(){editPart("aibox",aiBody())}
function renderEdit(keep){
  var kv=null;if(keep&&$("etitle")){kv={t:$("etitle").value,s:$("esub").value,c:$("ecss")?$("ecss").value:null,g:{}};document.querySelectorAll("#editform .egn").forEach(function(x){kv.g[x.dataset.k]=x.value})}
  var h='<div class="row"><div style="flex:1 1 260px"><div class="hint" style="margin:0 0 4px">Titolo</div><input type="text" id="etitle" style="width:100%" value="'+esc(S.ui.title||UI0.title)+'"></div><div style="flex:1 1 260px"><div class="hint" style="margin:0 0 4px">Sottotitolo</div><input type="text" id="esub" style="width:100%" value="'+esc(S.ui.sub||UI0.sub)+'"></div></div><h3 style="margin-top:16px">Nomi dei giochi</h3><div class="row">';
  Object.keys(DEF).forEach(function(k){
    var cu=BUILTIN.indexOf(k)<0;
    h+='<div style="flex:1 1 260px"><div class="hint" style="margin:0 0 4px">'+(cu?"Gioco aggiunto":esc(ORIGL[k]))+'</div><div class="row" style="flex-wrap:nowrap"><input type="text" class="egn" data-k="'+k+'" value="'+esc(DEF[k].l)+'">'+(cu?'<button class="egdel" data-k="'+k+'">Elimina</button>':'')+'</div></div>';
  });
  h+='</div><h3 style="margin-top:20px">Logo dell&#39;evento</h3><div class="row" id="elogorow">'+logoRow()+'</div>'
   +'<p class="hint">PNG, JPG, WEBP o SVG, meglio con sfondo trasparente. Viene ridotto a 512 pixel e salvato con i dati dell&#39;evento: compare nell&#39;intestazione, nelle immagini PNG e nei PDF.</p>'
   +renderAi()
   +'<h3 style="margin-top:20px">CSS personalizzato</h3><div class="row" id="ecssrow">'+cssRow()+'</div>'+cssWebRow()
   +'<textarea id="ecss" spellcheck="false" aria-label="CSS personalizzato" placeholder="/* Incolla qui il tuo CSS oppure importa un file .css */">'+esc(S.ui.css||"")+'</textarea>'
   +'<p class="hint">Si applica sopra al tema scelto, anche sul proiettore, e si salva con i dati dell&#39;evento (anche nei backup). Le risorse da internet (url(https://…), @import) sono bloccate: per le immagini usa url(data:…). Premi Salva per applicare le modifiche scritte qui.</p>'+renderBotSettings()+renderDiscordSettings()+renderStreamSettings();
  $("editform").innerHTML=h;
  if(kv){$("etitle").value=kv.t;$("esub").value=kv.s;if(kv.c!=null&&$("ecss"))$("ecss").value=kv.c;document.querySelectorAll("#editform .egn").forEach(function(x){if(kv.g[x.dataset.k]!=null)x.value=kv.g[x.dataset.k]})}
  botRefresh();dcRefresh();strFill();
}

/* ---------- logo con l'AI (impostazioni per questo PC, fuori dai backup perché possono contenere una chiave) ---------- */
var AIKEY=KEY+"-ai",aiRes=[],aiBusy=false,aiMsg="";
var AISTYLE=[["emblem","Stemma esports","esports team emblem logo, shield badge, bold clean outlines"],["mascot","Mascotte","esports mascot logo, fierce mascot head, bold clean outlines"],["minimal","Minimal piatto","minimal flat vector logo, simple geometric shapes, two colors"],["retro","Retrò arcade","retro 80s arcade logo, neon glow, synthwave colors"],["metal","Metallo e fuoco","logo with chrome metal and flames, heavy metal style"]];
function aiCfg(){var c={};try{c=JSON.parse(localStorage.getItem(AIKEY)||"{}")||{}}catch(e){}if(!AI.DEF[c.prov])c.prov="pollinations";if(!c.style)c.style="emblem";if(!c.target||c.target!=="event"&&!DEF[c.target])c.target="event";return c}
function aiSaveCfg(c){try{localStorage.setItem(AIKEY,JSON.stringify(c))}catch(e){}}
function aiTargetName(t){return t==="event"?(S.ui.title||UI0.title):DEF[t]?DEF[t].l+(S.games[t]&&S.games[t].name?" "+S.games[t].name:""):""}
function aiPrompt(c){var st=AISTYLE.filter(function(s){return s[0]===c.style})[0]||AISTYLE[0];return st[2]+", for a gaming tournament called \""+aiTargetName(c.target)+"\", centered icon, solid dark background, high contrast, no text"}
function aiHost(c){try{return new URL(c.url||AI.DEF[c.prov].url).host}catch(e){return""}}
function aiLocal(c){return/^(127\.0\.0\.1|localhost)(:|$)/.test(aiHost(c))}
/* i servizi online che la versione web può contattare (connect-src della pagina) */
function aiWebOk(c){return/(^|\.)(pollinations\.ai|huggingface\.co)(:\d+)?$/.test(aiHost(c))}
/* Servizio AI sul PC (Stable Diffusion o LocalAI) non ancora installato: istruzioni guidate,
   ricerca automatica della porta e verifica. Si apre da solo se il servizio non risponde. */
var aiInstOpen=false,aiInstMsg="";
function aiInstallHtml(c){
  if(c.prov!=="a1111"&&c.prov!=="openai")return"";
  var sd=c.prov==="a1111",cmd=sd?"set COMMANDLINE_ARGS=--api":"docker run -p 8080:8080 --name local-ai -ti localai/localai:latest-aio-cpu";
  return'<details class="aiinst"'+(aiInstOpen?" open":"")+'><summary>Non hai ancora il servizio su questo PC? Installalo</summary>'
   +(sd?'<ol><li>Serve una scheda video NVIDIA con almeno 6 GB di memoria e circa 15 GB liberi sul disco.</li>'
     +'<li><button type="button" data-aiopen="https://github.com/lllyasviel/stable-diffusion-webui-forge">Apri la pagina di Stable Diffusion Forge</button> e scarica il pacchetto per Windows (one-click package).</li>'
     +'<li>Estrai l&#39;archivio in una cartella, avvia <b>update.bat</b> e poi <b>run.bat</b>: la prima volta scarica i modelli e ci mette un po&#39;.</li>'
     +'<li>Per far parlare il programma con Forge apri <b>webui\\webui-user.bat</b> con il Blocco note e metti questa riga, poi riavvia <b>run.bat</b>:<div class="row aicmd"><code>'+esc(cmd)+'</code><button type="button" data-aicopy="'+esc(cmd)+'">Copia</button></div></li>'
     +'<li>Quando nel browser si apre la pagina di Forge, torna qui e premi <b>Cerca sul PC</b>.</li></ol>'
    :'<ol><li>Installa <button type="button" data-aiopen="https://www.docker.com/products/docker-desktop/">Docker Desktop</button> (funziona anche senza scheda video, più lentamente).</li>'
     +'<li>Apri il Prompt dei comandi e avvia LocalAI con tutti i modelli pronti:<div class="row aicmd"><code>'+esc(cmd)+'</code><button type="button" data-aicopy="'+esc(cmd)+'">Copia</button></div>Con una scheda NVIDIA usa l&#39;immagine <code>localai/localai:latest-aio-gpu-nvidia-cuda-12</code> e aggiungi <code>--gpus all</code>.</li>'
     +'<li>La prima volta scarica diversi GB. Guida completa: <button type="button" data-aiopen="https://localai.io/basics/getting_started/">localai.io</button></li>'
     +'<li>Quando è avviato, premi <b>Cerca sul PC</b>.</li></ol>')
   +'<div class="row"><button type="button" class="p" id="aifind">Cerca sul PC</button><button type="button" id="aicheck">Verifica l&#39;indirizzo indicato</button><span class="hint" style="margin:0" id="aiinstmsg" role="status">'+esc(aiInstMsg)+'</span></div></details>';
}
function aiProbe(base,prov){
  /* nell'app la prova la fa il processo principale: raggiunge anche i server in rete, che la pagina non può contattare */
  if(DESK&&DESK.aiProbe)return Promise.resolve(DESK.aiProbe(base,prov)).then(function(r){return r===true||!!(r&&r.ok)}).catch(function(){return false});
  var u=base.replace(/\/+$/,"")+(prov==="a1111"?"/sdapi/v1/options":"/models"),ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},2500);
  return fetch(u,{signal:ctl.signal}).then(function(r){clearTimeout(t);return r.ok}).catch(function(){clearTimeout(t);return false});
}
function aiFind(check){
  var c=aiReadForm(),sd=c.prov==="a1111",cur=(c.url||AI.DEF[c.prov].url).replace(/\/+$/,"");
  var cands=check?[cur]:[cur].concat(sd?["http://127.0.0.1:7860","http://127.0.0.1:7861","http://127.0.0.1:7862","http://127.0.0.1:7865"]:["http://127.0.0.1:8080/v1","http://127.0.0.1:8081/v1","http://localhost:8080/v1"]).filter(function(x,i,a){return a.indexOf(x)===i});
  aiInstMsg="Cerco…";var m=$("aiinstmsg");if(m)m.textContent=aiInstMsg;
  /* tutte le porte insieme: al massimo 2,5 secondi */
  Promise.all(cands.map(function(u){return aiProbe(u,c.prov)})).then(function(ok){
    var i=ok.indexOf(true);
    if(i<0){aiInstMsg=sd?"Non trovo Stable Diffusion: è avviato con --api?":"Non trovo LocalAI: il contenitore Docker è avviato?";aiInstOpen=true;renderAiBox();return}
    c.url=cands[i]===AI.DEF[c.prov].url?"":cands[i];aiSaveCfg(c);aiInstMsg="Trovato e pronto: "+cands[i]+". Ora premi Genera 4 proposte.";aiInstOpen=false;aiMsg="";renderAiBox();
  });
}
/* il titolo resta fuori da #aibox: le sezioni delle Impostazioni (sections.js) si fanno con gli h3 diretti del modulo */
function renderAi(){return'<h3 style="margin-top:20px">Genera un logo con l&#39;AI</h3><div id="aibox">'+aiBody()+'</div>'}
function aiGrid(){return aiRes.length?'<div class="aigrid">'+aiRes.map(function(r,i){return'<figure><img src="'+esc(r)+'" alt="Proposta '+(i+1)+'"><figcaption><button data-aiuse="'+i+'">Usa questo</button></figcaption></figure>'}).join("")+'</div>':''}
/* durante la generazione cambiano solo messaggio, proposte e pulsante: chi sta scrivendo negli altri campi non perde niente */
function aiProgress(){
  var m=$("aimsg");if(m)m.textContent=aiMsg;editPart("aires",aiGrid());
  var b=$("aigo");if(b){b.disabled=aiBusy;b.textContent=aiBusy?"Genero…":"Genera 4 proposte"}
  var d=document.querySelector("#aibox .aiinst");if(d&&aiInstOpen)d.open=true;
}
function aiBody(){
  var c=aiCfg(),d=AI.DEF[c.prov],h=''
   +'<div class="row"><label class="row" style="gap:6px">Logo per <select id="aitarget"><option value="event"'+(c.target==="event"?" selected":"")+'>L&#39;evento</option>'+Object.keys(DEF).map(function(k){return'<option value="'+k+'"'+(c.target===k?" selected":"")+'>Torneo di '+esc(DEF[k].l)+'</option>'}).join("")+'</select></label>'
   +'<label class="row" style="gap:6px">Stile <select id="aistyle">'+AISTYLE.map(function(s){return'<option value="'+s[0]+'"'+(c.style===s[0]?" selected":"")+'>'+s[1]+'</option>'}).join("")+'</select></label></div>'
   +'<div class="row" style="margin-top:8px"><label class="row" style="gap:6px">Servizio <select id="aiprov"><option value="pollinations"'+(c.prov==="pollinations"?" selected":"")+'>Pollinations: online, chiave gratuita</option><option value="hf"'+(c.prov==="hf"?" selected":"")+'>Hugging Face: online, token gratuito</option><option value="a1111"'+(c.prov==="a1111"?" selected":"")+'>Stable Diffusion sul tuo PC (AUTOMATIC1111, Forge)</option><option value="openai"'+(c.prov==="openai"?" selected":"")+'>Server compatibile OpenAI (LocalAI o remoto)</option></select></label></div>'
   +'<div class="row" style="margin-top:8px"><input type="text" id="aiurl" placeholder="'+esc(d.url)+'" value="'+esc(c.url||"")+'" aria-label="Indirizzo del servizio"><input type="text" id="aimodel" placeholder="Modello: '+esc(d.model||"predefinito")+'" value="'+esc(c.model||"")+'" aria-label="Modello">'+(c.prov!=="a1111"?'<input type="password" id="aikey" placeholder="'+(d.key?"Chiave personale (obbligatoria)":"Chiave (facoltativa)")+'" value="'+esc(c.key||"")+'" aria-label="Chiave del servizio" autocomplete="off">':'')+'</div>'
   +aiInstallHtml(c)
   +'<textarea id="aiprompt" class="aiprompt" spellcheck="false" aria-label="Descrizione del logo">'+esc(c.prompt||aiPrompt(c))+'</textarea>'
   +'<div class="row"><button class="p" id="aigo"'+(aiBusy?" disabled":"")+'>'+(aiBusy?"Genero…":"Genera 4 proposte")+'</button><button id="aireset">Descrizione automatica</button><span class="hint" style="margin:0" id="aimsg" role="status">'+esc(aiMsg)+'</span></div>'
   +'<p class="hint">'+(aiLocal(c)?'Il servizio gira su questo PC: nulla esce dalla rete locale.':'La descrizione viene inviata a <b>'+esc(aiHost(c))+'</b> per creare le immagini; non vengono inviati nomi di partecipanti né altri dati.')+(d.key?' Serve una chiave personale gratuita: <a href="'+d.keyUrl+'" target="_blank" rel="noopener">'+d.keyUrl.replace(/^https:\/\//,"")+'</a>. Resta salvata solo su questo PC, non nei backup.':'')+(c.prov==="a1111"?' Avvia Stable Diffusion con l&#39;opzione <code>--api</code>.':'')+(!DESK&&(c.prov==="a1111"||c.prov==="openai")?(aiLocal(c)||aiWebOk(c)?' Dalla versione web i servizi locali possono essere bloccati dal browser: usa l&#39;app installata.':' La versione web raggiunge solo Pollinations, Hugging Face e i servizi su questo PC: per un server in rete o remoto usa l&#39;app installata.'):'')+'</p>';
  return h+'<div id="aires">'+aiGrid()+'</div>';
}
function aiReadForm(){var c=aiCfg();["target","style","prov"].forEach(function(k){var el=$("ai"+k);if(el)c[k]=el.value});["url","model","key"].forEach(function(k){var el=$("ai"+k);if(el)c[k]=el.value.trim()});var p=$("aiprompt");if(p)c.prompt=p.value;return c}
function aiOne(c,prompt,seed){
  if(DESK&&DESK.aiImage)return DESK.aiImage({prov:c.prov,url:c.url,model:c.model,key:c.key},prompt,seed,512).then(function(r){if(r.error)throw new Error(r.error);return r.data});
  return AI.generate(c,prompt,seed,512);
}
async function aiRun(){
  var c=aiReadForm();aiSaveCfg(c);aiBusy=true;aiRes=[];aiMsg="Genero 1 di 4…";aiProgress();
  var prompt=c.prompt||aiPrompt(c),base=Math.floor(Math.random()*1e8);
  for(var i=0;i<4;i++){
    try{aiRes.push(await aiOne(c,prompt,base+i));aiMsg=i<3?"Genero "+(i+2)+" di 4…":"Fatto: scegli la proposta che preferisci."}
    catch(e){if(aiLocal(c)&&/fetch|network|Failed|ECONN/i.test(String(e&&e.message)))aiInstOpen=true;aiMsg="Non riuscito: "+(e&&e.message||e)+(/fetch|network|Failed/i.test(String(e&&e.message))?(AI.DEF[c.prov].key?" (controlla la connessione a internet)":" (il servizio è avviato all'indirizzo indicato?)"):"");break}
    aiProgress();
  }
  aiBusy=false;aiProgress();
}
function aiUse(i){
  var src=aiRes[i],c=aiCfg();if(!src)return;
  var im=new Image();
  im.onload=function(){
    var ev=c.target==="event",z=ev?512:160,cv=document.createElement("canvas");cv.width=cv.height=z;
    var sc=Math.min(z/im.width,z/im.height),w=im.width*sc,h=im.height*sc;cv.getContext("2d").drawImage(im,(z-w)/2,(z-h)/2,w,h);
    var url=cv.toDataURL("image/png");
    if(ev)S.ui.logo=url;else if(S.games[c.target])S.games[c.target].logo=url;
    applyUi();save();render();renderLogoRow();toast(ev?"Nuovo logo dell'evento.":"Nuovo logo per "+(DEF[c.target]?DEF[c.target].l:"")+".");
  };
  im.src=src;
}


/* ======================================================================
   Bot Telegram (solo nell'app installata: il bot vive nel processo principale, vedi bot.js).
   Qui si prepara la "vista" dei tornei che il bot usa per rispondere e per gli avvisi.
   ====================================================================== */
function mres(m,t){return m.sa!=null&&m.sb!=null?m.a+" "+m.sa+"–"+m.sb+" "+m.b:m.w+(t?t(" batte "):" batte ")+(m.w===m.a?m.b:m.a)}
function botLines(g,k){
  var L=[],r=result(g,k);
  if(r.status==="Concluso"){var pl=placements(g,k);Object.keys(pl).sort(function(a,b){return pl[a]-pl[b]}).forEach(function(n){L.push(pl[n]+"º "+n)});return L}
  if(g.phase==="setup")return g.players.map(function(n,i){return(i+1)+". "+n});
  if(g.ffa){var F=g.ffa,ri=F.rounds.length-1,rd=F.rounds[ri],fin=rd.groups.length===1;L.push(fin?"Finale":"Turno "+(ri+1));
    rd.groups.forEach(function(gr,gi){var e=gEval(gr,fin,F.adv);if(!fin)L.push("Girone "+letter(gi));e.sorted.forEach(function(x){L.push("  "+(e.full?x.pos+"º ":"– ")+x.n+": "+(gr.s[x.n]==null?"–":gr.s[x.n])+(e.full&&!fin&&e.adv.indexOf(x.n)>=0?" ✓":""))})});return L}
  if(g.de){var E=deState(g).ev,loss={};Object.keys(E.M).forEach(function(id){var m=E.M[id];if(m.ready&&m.l)loss[m.l]=(loss[m.l]||0)+1});
    L.push("In gara: "+g.players.filter(function(n){return(loss[n]||0)<2}).map(function(n){return n+(loss[n]?" (1 sconfitta)":"")}).join(", "));
    var out=g.players.filter(function(n){return(loss[n]||0)>=2});if(out.length)L.push("Eliminati: "+out.join(", "));return L}
  if(g.rounds){g.rounds.forEach(function(rd,ri){var dn=rd.filter(function(m){return m.w&&m.a&&m.b});if(!dn.length)return;L.push(roundName(ri,g.rounds.length));dn.forEach(function(m){L.push("  "+mres(m))})});return L}
  if(g.sw){TF.swStandings(g.players,g.sw.rounds,rankFx(g)).forEach(function(t,i){L.push((i+1)+"º "+t.n+": "+t.pts+" pt ("+t.w+"V "+t.d+"N "+t.l+"P)")});return L}
  if(g.groups){g.groups.forEach(function(x,gi){if(g.groups.length>1)L.push("Girone "+letter(gi));standings(x,g).forEach(function(t,i){L.push("  "+(i+1)+"º "+t.n+": "+t.pt+" pt ("+t.w+"V "+t.d+"N "+t.l+"P)")})});return L}
  return L;
}
/* Server di gioco per incontro: g.srv = { chiave incontro: id del server della Sala } */
function srvList(){var X=S.sala;if(!X||!X.servers)return[];X.servers.forEach(function(s,i){if(!s.id)s.id="s"+i+Date.now().toString(36)});return X.servers}
function srvOf(g,key){var id=key&&g.srv&&g.srv[key];if(!id)return null;var sv=srvList().filter(function(s){return s.id===id})[0];return sv?{name:sv.name||"Server",addr:sv.addr||"",pass:sv.pass||"",game:sv.game&&DEF[sv.game]?DEF[sv.game].l:""}:null}
function srvLine(sv){return sv.name+(sv.addr?" "+sv.addr:"")}
function srvSel(g,key){
  var cur=(g.srv&&g.srv[key])||"",L=srvList().filter(function(s){return!s.game||s.game===S.cur||s.id===cur});
  if(!L.length)return"";
  return'<div class="srvtag"><select class="srvsel" data-sk="'+esc(key)+'" aria-label="Server di questo incontro"><option value="">🖥 Server…</option>'+L.map(function(s){return'<option value="'+esc(s.id)+'"'+(s.id===cur?" selected":"")+'>🖥 '+esc(s.name||"Server")+'</option>'}).join("")+'</select></div>';
}
function botNext(g,k){
  /* partite da giocare adesso: testo e nomi coinvolti (servono agli avvisi personali) */
  var N=[],vs=function(lab,a,b,key){var sv=srvOf(g,key);N.push({t:lab+": "+a+" vs "+b+(sv?" — 🖥 "+srvLine(sv):""),p:[a,b],srv:sv})};
  if(g.phase==="setup"||result(g,k).status==="Concluso")return N;
  if(g.ffa){var F=g.ffa,rd=F.rounds[F.rounds.length-1],fin=rd.groups.length===1;rd.groups.forEach(function(gr,gi){if(gr.p.some(function(n){return gr.s[n]==null}))(function(sv){N.push({t:(fin?"Finale":"Girone "+letter(gi))+": "+gr.p.join(", ")+(sv?" — 🖥 "+srvLine(sv):""),p:gr.p.slice(),srv:sv})})(srvOf(g,"f"+(F.rounds.length-1)+"-"+gi))});return N}
  if(g.de){var E=deState(g).ev;Object.keys(E.M).forEach(function(id){var m=E.M[id];if(m.ready&&m.w===undefined)vs(id==="GF"?"Finale":id==="GF2"?"Bella":id.charAt(0)==="W"?"Vincenti":"Perdenti",m.a,m.b,"d"+id)});return N}
  if(g.rounds){var R=g.rounds,ci=R.findIndex(function(rd){return rd.some(function(m){return m.a&&m.b&&!m.w})});if(ci>=0)R[ci].forEach(function(m,mi){if(m.a&&m.b&&!m.w)vs(roundName(ci,R.length),m.a,m.b,"e"+ci+"-"+mi)});var t=g.third;if(t&&t.match&&t.a&&t.b&&!t.w)vs("Finale 3º posto",t.a,t.b,"e3");return N}
  if(g.sw){var W=g.sw;W.rounds[W.rounds.length-1].forEach(function(m,mi){if(m.b&&m.w==null)vs("Turno "+W.rounds.length,m.a,m.b,"s"+(W.rounds.length-1)+"-"+mi)});return N}
  if(g.groups){g.groups.forEach(function(x,gi){var op=x.matches.filter(function(m){return m.sa==null||m.sb==null});if(!op.length)return;var d=op[0].day;op.filter(function(m){return m.day===d}).forEach(function(m){vs((g.groups.length>1?"Girone "+letter(gi)+", ":"")+"giornata "+d,m.a,m.b,"g"+gi+"-"+x.matches.indexOf(m))})});return N}
  return N;
}
function botResults(g,k){
  var R=[];
  if(g.ffa)g.ffa.rounds.forEach(function(rd,ri){var fin=rd.groups.length===1;rd.groups.forEach(function(gr,gi){var e=gEval(gr,fin,g.ffa.adv);if(e.full)R.push({id:"f"+ri+"-"+gi+":"+gr.p.join(","),p:gr.p.slice(),text:(fin?"Finale":"Turno "+(ri+1)+", girone "+letter(gi))+": "+e.sorted.slice(0,3).map(function(x){return x.pos+"º "+x.n+" ("+gr.s[x.n]+")"}).join(", ")})})});
  if(g.groups)g.groups.forEach(function(x,gi){x.matches.forEach(function(m,mi){if(m.sa!=null&&m.sb!=null)R.push({id:"g"+gi+"-"+mi+":"+m.sa+"-"+m.sb,p:[m.a,m.b],text:m.a+" "+m.sa+"–"+m.sb+" "+m.b})})});
  if(g.sw)g.sw.rounds.forEach(function(rd,ri){rd.forEach(function(m,mi){if(m.b&&m.w!=null)R.push({id:"s"+ri+"-"+mi+":"+m.a+m.b+m.w,p:[m.a,m.b],text:m.sa!=null&&m.sb!=null?m.a+" "+m.sa+"–"+m.sb+" "+m.b:(m.w==="="?m.a+" e "+m.b+" pareggiano":mres(m))})})});
  if(g.rounds)g.rounds.forEach(function(rd,ri){rd.forEach(function(m,mi){if(m.w&&m.a&&m.b)R.push({id:"e"+ri+"-"+mi+":"+m.a+m.b+m.w,p:[m.a,m.b],text:roundName(ri,g.rounds.length)+": "+mres(m)})})});
  if(g.third&&g.third.w&&g.third.a&&g.third.b)R.push({id:"t3:"+g.third.w,p:[g.third.a,g.third.b],text:"Finale 3º posto: "+mres(g.third)});
  if(g.de){var E=deState(g).ev;Object.keys(E.M).forEach(function(id){var m=E.M[id];if(m.ready&&m.w!==undefined)R.push({id:"d"+id+":"+m.a+m.b+m.w,p:[m.a,m.b],text:mres(m)})})}
  return R;
}
function botVM(){
  var H=hofCompute(),ML={};MODES.forEach(function(m){ML[m[0]]=m[1]});
  function row(e){return{n:e.n,tot:Math.round(e.tot*100)/100,pos:e.pos,by:Object.keys(e.by).map(function(k){var o=e.by[k];return{l:DEF[k].l,pos:o.pos,v:Math.round(o.v*100)/100}})}}
  return{sala:window.SALA?SALA.vm():null,title:S.ui.title||UI0.title,sub:S.ui.sub||UI0.sub,lang:(S.ev&&S.ev.lang)||"it",draft:!!(S.ev&&S.ev.draft),links:{wa:(S.ev&&S.ev.wa)||"",tg:(S.ev&&S.ev.tg)||"",discord:(S.ev&&S.ev.discord)||"",ts:(S.ev&&S.ev.ts)||"",tspass:(S.ev&&S.ev.tspass)||"",when:evWhen(),place:(S.ev&&S.ev.place)||"",mode:(S.ev&&S.ev.mode)||"lan",addr:(S.ev&&S.ev.addr)||"",maps:(S.ev&&(S.ev.maps||(S.ev.addr&&S.ev.mode!=="online"?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(S.ev.addr):"")))||""},roster:S.roster.slice(),
    tournaments:Object.keys(DEF).map(function(k){var g=S.games[k],r=result(g,k),np=botNext(g,k);return{k:k,l:DEF[k].l,discord:!!(S.ev&&(S.ev.discord||(S.ev.dguild&&S.ev.dchan))),draft:!!g.draft,name:g.name||"",mode:ML[g.mode]||g.mode,team:isTeam(g,k),players:g.players.slice(),members:g.members||{},status:r.status,open:g.phase==="setup",done:r.status==="Concluso",top:r.top.filter(Boolean),pl:placements(g,k),lines:botLines(g,k),nextP:np,next:np.map(function(x){return x.t}),results:botResults(g,k)}}),
    hof:{players:H.P.slice(0,50).map(row),teams:H.T.slice(0,50).map(row)}};
}
var botT=null;
function botPush(){if(!DESK||!DESK.botState||WALL)return;if(later(botPush))return;clearTimeout(botT);botT=setTimeout(function(){if(later(botPush))return;try{var vm=botVM();if(window.__app&&window.__app.pushVM)window.__app.pushVM(vm);else DESK.botState({events:[{id:(S.ev&&S.ev.id)||"cur",bot:(S.ev&&S.ev.bot)||"",vm:vm}]})}catch(e){}},700)}
/* Lavorare per un attimo su un altro torneo (non aperto): il bot chiede dati, iscrizioni e immagini di tutti.
   Sincrono quando si può; per le immagini (asincrone) la pagina resta bloccata finché non torna il torneo aperto. */
/* SWAP conta gli scambi in corso (si possono annidare); quello che arriva nel frattempo (bot, Discord) aspetta in swapQ
   e parte quando torna il torneo aperto. */
function swapIn(st){var keep=S;SWAP++;try{S=st;initS();registerCustom();normGames()}catch(e){swapOut(keep);throw e}return keep}
function swapOut(keep){S=keep;registerCustom();if(--SWAP>0)return;SWAP=0;swapQ.splice(0).forEach(function(f){try{f()}catch(e){}})}
function later(f){if(!SWAP)return false;if(swapQ.indexOf(f)<0)swapQ.push(f);return true}
function withSync(st,fn){var keep=swapIn(st);try{return fn()}finally{swapOut(keep)}}
async function withState(st,fn){
  var cover=document.createElement("div");cover.className="swapcover";cover.setAttribute("aria-hidden","true");document.body.appendChild(cover);
  /* testi e date dell'immagine nella lingua di quel torneo */
  var keep=null,pl=window.I18N?I18N.ev():null;
  try{keep=swapIn(st);if(pl)await I18N.setEv((S.ev&&S.ev.lang)||"it").catch(function(){});return await fn()}
  finally{if(pl)I18N.setEv(pl).catch(function(){});if(keep)swapOut(keep);cover.remove()}
}
/* filigrana per le immagini mandate su Telegram: banner del torneo, data e ora */
/* date nella lingua del torneo (Intl non conosce il veneto) */
function evLoc(){var l=window.I18NCORE?I18NCORE.pick(S.ev&&S.ev.lang)||"it":"it";return l==="vec"?"it-IT":l}
function evWhen(){var ev=S.ev||{},d=/^\d{4}-\d{2}-\d{2}$/.test(ev.date||"")?new Date(ev.date+"T12:00:00").toLocaleDateString(evLoc(),{day:"numeric",month:"long",year:"numeric"}):"";return (d+(ev.time?(d?", ore ":"Ore ")+ev.time:"")).trim()}
async function watermark(cv){
  var W=cv.width,H=cv.height,band=Math.max(64,Math.round(W*0.075)),out=document.createElement("canvas");out.width=W;out.height=H+band;
  var c=out.getContext("2d"),acc=getComputedStyle(document.documentElement).getPropertyValue("--acc").trim()||"#FF5A1F",title=uiTitle(),when=evWhen()||("Immagine del "+new Date().toLocaleString(evLoc(),{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}));
  c.drawImage(cv,0,0);
  c.save();c.globalAlpha=0.07;c.fillStyle="#fff";c.strokeStyle="#000";c.lineWidth=2;c.font="700 "+Math.round(W/30)+'px "FragDisplay","Arial Black",Impact,sans-serif';
  c.translate(W/2,H/2);c.rotate(-0.42);var txt=(title+"  ·  "+(window.I18N?I18N.tr(when,I18N.ev()):when)).toUpperCase(),step=Math.round(W/9);
  for(var y=-H;y<H;y+=step)for(var x=-W*1.2;x<W*1.2;x+=c.measureText(txt).width+W/12){c.strokeText(txt,x,y);c.fillText(txt,x,y)}
  c.restore();
  c.fillStyle="#111";c.fillRect(0,H,W,band);c.fillStyle=acc;c.fillRect(0,H,W,Math.max(3,band/16));
  var lg=await loadImg(S.ui.logo||applyUi.def.em),pad=Math.round(band*0.14),ls=band-pad*2,tx=pad;
  if(lg){var k=Math.min(ls/lg.width,ls/lg.height);c.fillStyle="#fff";c.fillRect(pad-2,H+pad-2,Math.round(lg.width*k)+4,Math.round(lg.height*k)+4);c.drawImage(lg,pad,H+pad,Math.round(lg.width*k),Math.round(lg.height*k));tx=pad*2+Math.round(lg.width*k)}
  c.fillStyle="#fff";c.textBaseline="middle";c.font="400 "+Math.round(band*0.38)+'px "FragDisplay","Arial Black",Impact,sans-serif';c.fillText(title,tx,H+band/2,W*0.55);
  c.textAlign="right";c.font="600 "+Math.round(band*0.27)+"px Inter,'Segoe UI',Arial,sans-serif";c.fillStyle="#ddd";c.fillText(when,W-pad,H+band/2,W*0.4);
  return out;
}
/* chiave "evento:gioco" o "evento:sala~Nome": l'evento è solo il primo pezzo (senza "~"), il nome del giocatore può contenere ":" */
function splitKey(key){var s=String(key==null?"":key),m=/^([^:~]+):([\s\S]*)$/.exec(s);return m?{ev:m[1],k:m[2]}:{ev:"",k:s}}
/* un'immagine alla volta: due scambi di stato sovrapposti si chiuderebbero nell'ordine sbagliato */
var pngQ=Promise.resolve();
function pngFor(key){var r=pngQ.then(function(){return pngFor0(key)});pngQ=r.catch(function(){});return r}
async function pngFor0(key){
  var p=splitKey(key),k=p.k,ev=p.ev;
  /* "sala~Nome": mappa della sala con la postazione di quel giocatore */
  var mk=function(){return /^sala~/.test(k)&&window.SALA?SALA.png(k.slice(5)):makePng(k)};
  if(!ev||(S.ev&&S.ev.id===ev)||!window.HOME)return watermark(await mk());
  var st=await window.HOME.readState(ev);
  return withState(st,async function(){if(!/^sala~/.test(k)&&!S.games[k])throw new Error("gioco non trovato");return watermark(await mk())});
}
/* il nome com'è scritto nell'elenco (maiuscole comprese), se c'è */
function sameName(list,nm){var l=String(nm).toLowerCase();return (list||[]).filter(function(p){return typeof p==="string"&&p.toLowerCase()===l})[0]}
function joinInto(k,name,dc){
  var g=S.games[k],nm=String(name||"").trim();if(!nm)return false;
  nm=sameName(S.roster,nm)||(g&&!isTeam(g,k)&&sameName(g.players,nm))||nm;
  if(dcOk(dc)){S.disc=S.disc||{};S.disc[nm]=dcOk(dc)}
  if(!sameName(S.roster,nm))S.roster.push(nm);
  if(g&&g.phase==="setup"&&!isTeam(g,k)&&!sameName(g.players,nm))g.players.push(nm);
  return true;
}
function botJoin(m){
  var p=splitKey(m.k),k=p.k,ev=p.ev,nm=String(m.name||"").trim();if(!nm)return;
  if(ev&&!(S.ev&&S.ev.id===ev)&&window.HOME){window.HOME.joinOther(ev,k,nm,m.discord);return}
  joinInto(k,nm,m.discord);save();renderRoster();render();toast("Iscritto dal bot Telegram: "+nm+(DEF[k]?" ("+DEF[k].l+")":"")+".");
}
/* durante uno scambio di stato (immagine di un altro torneo) iscrizioni e account aspettano il torneo aperto */
function onBotMsg(m){
  if(m.type!=="png"&&later(function(){onBotMsg(m)}))return;
  if(m.type==="join")botJoin(m);
  else if(m.type==="discord")botDiscord(m);
  else if(m.type==="png"){pngFor(m.k).then(function(cv){window.desk.botPng(m.id,cv.toDataURL("image/png"))}).catch(function(){window.desk.botPng(m.id,null)})}
  else if(m.type==="status")botStatusMsg();
}
if(window.desk&&window.desk.onBot)window.desk.onBot(onBotMsg);
/* stato del bot cambiato: il riquadro si ridisegna, ma non mentre ci si sta scrivendo (si perderebbe il testo) */
var botStale=false;
function botStatusMsg(){var bx=$("botbox"),ae=document.activeElement;if(!bx)return;if(ae&&bx.contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)){botStale=true;return}botStale=false;botRefresh()}
document.addEventListener("focusout",function(e){var bx=$("botbox");if(!botStale)return;if(!bx){botStale=false;return}if(!bx.contains(e.relatedTarget)){botStale=false;setTimeout(botRefresh)}});
function botHtml(st){
  if(!st)return'<p class="hint">Il bot non è disponibile.</p>';
  var state=st.running?'<span class="ok">Attivo come <b>@'+esc(st.username||"")+'</b></span>':(st.enabled&&st.hasToken?'<span class="cres err">Non collegato'+(st.lastErr?': '+esc(st.lastErr):'')+'</span>':'Spento');
  setTimeout(botPickFill);
  var h='<div class="row botpick" id="botpick"></div><p style="margin:6px 0 10px">Stato: '+state+'</p>'
   +'<div class="row"><input type="password" id="bottok" autocomplete="off" spellcheck="false" placeholder="'+(st.hasToken?"Token salvato "+esc(st.tokenHint)+": lascialo vuoto per non cambiarlo":"Token del bot, tipo 123456789:AAH… (da @BotFather)")+'" aria-label="Token del bot Telegram"><button id="bottokshow" aria-pressed="false">Mostra</button><button class="p" id="botsave">Salva e collega</button>'+(st.hasToken?'<button id="botdel">Rimuovi token</button>':'')+'</div>'
   +(st.hasToken?'<p class="hint" style="margin:6px 0 0">Token salvato: <code>'+esc(st.tokenHint)+'</code></p>':'')
   +'<div class="row" style="margin-top:10px"><label class="row chk"><input type="checkbox" id="boton"'+(st.enabled?" checked":"")+'>Bot attivo</label>'
   +'<label class="row" style="gap:6px">Iscrizioni dal bot <select id="botjoin"><option value="approve"'+(st.join==="approve"?" selected":"")+'>Con conferma dell&#39;organizzatore</option><option value="auto"'+(st.join==="auto"?" selected":"")+'>Automatiche</option><option value="off"'+(st.join==="off"?" selected":"")+'>Chiuse</option></select></label></div>'
   +'<label class="botwel">Messaggio di benvenuto di questo bot (si vede con /start)<textarea id="botwel" rows="2" maxlength="800" placeholder="Es. Benvenuto alla LAN! Wi-Fi: Fragmarathon. Regolamento in sala.">'+esc(st.welcome||"")+'</textarea></label>'
   +'<div class="row" style="margin-top:8px"><span class="hint" style="margin:0">Avvisi a chi segue un torneo:</span><label class="row chk"><input type="checkbox" class="botn" data-n="stage"'+(st.notify.stage?" checked":"")+'>cambio di turno o fase</label><label class="row chk"><input type="checkbox" class="botn" data-n="final"'+(st.notify.final?" checked":"")+'>podio finale</label><label class="row chk"><input type="checkbox" class="botn" data-n="results"'+(st.notify.results?" checked":"")+'>ogni risultato</label></div>'
   +'<label class="row chk" style="margin-top:6px"><input type="checkbox" class="botn" data-n="player"'+(st.notify.player!==false?" checked":"")+'>avvisi personali ai giocatori collegati: tocca a te, i tuoi risultati, la tua posizione</label>'
   +botPeople(st)+botGroups(st)
   +'<p class="hint">Codice per diventare amministratore dal telefono: <code>/admin '+esc(st.code)+'</code> (cambia dopo ogni uso). <button id="botcode">Nuovo codice</button></p>'
   +'<p class="hint">'+st.chats+' chat hanno scritto al bot, '+st.followers+' seguono almeno un torneo.</p>';
  if(st.pending.length)h+='<h4 style="margin:12px 0 4px">Iscrizioni da confermare</h4><table class="res"><tr><th>Nome</th><th>Torneo</th><th>Da</th><th></th></tr>'+st.pending.map(function(p){return'<tr><td><b>'+esc(p.name)+'</b></td><td>'+esc(p.l)+'</td><td>'+esc(p.user||"")+'</td><td><button class="p" data-botok="'+esc(p.id)+'">Accetta</button> <button data-botno="'+esc(p.id)+'">Rifiuta</button></td></tr>'}).join("")+'</table>';
  return h;
}
var ROLE_L={admin:"Amministratore",org:"Organizzatore tornei","":"Partecipante"};
/* gruppi e canali in cui è stato aggiunto il bot: abilita, esci, esci e blocca chi l'ha aggiunto */
function botGroups(st){
  var G=st.groups||[],B=st.blocked||[],h='<h4 style="margin:16px 0 6px">Gruppi e canali</h4>';
  if(!G.length)h+='<p class="hint" style="margin:0">Il bot non è in nessun gruppo o canale. Quando qualcuno lo aggiunge, compare qui (e agli amministratori arriva un messaggio): non scrive nulla finché non lo abiliti.</p>';
  else h+='<table class="res"><tr><th>Nome</th><th>Tipo</th><th>Aggiunto da</th><th>Stato</th><th></th></tr>'+G.map(function(g){
    return'<tr><td><b>'+esc(g.title)+'</b></td><td>'+esc(g.type)+'</td><td>'+esc(g.by||"")+'</td><td><select data-gst="'+esc(g.id)+'" aria-label="Stato di '+esc(g.title)+'"><option value="pending"'+(g.status==="pending"?" selected":"")+'>In attesa</option><option value="on"'+(g.status==="on"?" selected":"")+'>Attivo</option><option value="off"'+(g.status==="off"?" selected":"")+'>Disattivato</option></select></td>'
     +'<td style="white-space:nowrap"><button data-gleave="'+esc(g.id)+'">Esci</button> <button data-gblock="'+esc(g.id)+'"'+(g.by?"":" disabled")+' title="Esce e blocca chi lo ha aggiunto">Esci e blocca</button></td></tr>'}).join("")+'</table>'
   +'<p class="hint" style="margin:4px 0 0"><b>Attivo</b>: si presenta con il link per scrivergli in privato, risponde a /tornei, /classifica, /partite, /risultati, /diretta e riceve annunci e diretta. Dal telefono: /gruppi.</p>';
  if(B.length)h+='<p style="margin:10px 0 4px"><b>Bloccati</b> (se aggiungono il bot a un gruppo, esce da solo):</p><div class="chips">'+B.map(function(b){return'<span class="chip">'+esc(b.name)+(b.from?' <small class="sub" style="display:inline">da '+esc(b.from)+'</small>':'')+'<button data-unblock="'+esc(b.id)+'" aria-label="Sblocca '+esc(b.name)+'" title="Sblocca">×</button></span>'}).join("")+'</div>';
  return h;
}
function botGamesSel(cls,attr,sel){return'<select multiple class="'+cls+'" '+attr+' size="'+Math.min(4,Object.keys(DEF).length)+'" aria-label="Tornei che organizza (nessuno selezionato = tutti)">'+Object.keys(DEF).map(function(k){return'<option value="'+k+'"'+(sel.indexOf(k)>=0?" selected":"")+'>'+esc(DEF[k].l)+'</option>'}).join("")+'</select>'}
function botPeople(st){
  var names={};S.roster.forEach(function(n){names[n]=1});Object.keys(DEF).forEach(function(k){S.games[k].players.forEach(function(n){names[n]=1});Object.keys(S.games[k].members||{}).forEach(function(t){(S.games[k].members[t]||[]).forEach(function(n){names[n]=1})})});
  var h='<h4 style="margin:16px 0 6px">Persone e ruoli</h4><p class="hint" style="margin:0 0 8px"><b>Amministratore</b>: tutto (iscrizioni, annunci, diretta). <b>Organizzatore tornei</b>: conferma le iscrizioni, di tutti i tornei o solo di quelli selezionati. <b>Partecipante</b>: legge, segue e si iscrive. Collegando una persona a un giocatore riceve gli avvisi personali.</p>'
   +'<datalist id="botnames">'+Object.keys(names).sort().map(function(n){return'<option value="'+esc(n)+'">'}).join("")+'</datalist>'
   +'<div class="row" style="align-items:flex-start"><input type="text" id="bru" placeholder="@username Telegram" style="flex:1 1 180px"><select id="brr"><option value="admin">Amministratore</option><option value="org">Organizzatore tornei</option></select>'+botGamesSel("","id=\"brg\"",[])+'<button id="bradd">Aggiungi</button></div>'
   +'<p class="hint" style="margin:4px 0 0">Il ruolo per username vale appena quella persona scrive al bot in privato. Per un organizzatore, nessun torneo selezionato vuol dire tutti.</p>';
  if((st.userRoles||[]).length)h+='<div class="chips">'+st.userRoles.map(function(r){return'<span class="chip">'+esc(r.u)+' – '+ROLE_L[r.role]+(r.role==="org"&&r.games.length?' ('+r.games.map(function(k){return DEF[k]?esc(DEF[k].l):k}).join(", ")+')':'')+'<button data-bru="'+esc(r.u)+'" aria-label="Togli il ruolo a '+esc(r.u)+'">×</button></span>'}).join("")+'</div>';
  if(st.people&&st.people.length){
    h+='<table class="res botppl"><tr><th>Telegram</th><th>Ruolo</th><th>Tornei</th><th>Giocatore collegato</th><th>Segue</th><th></th></tr>'+st.people.map(function(p){
      return'<tr><td>'+esc(p.name)+'</td><td><select class="bprole" data-id="'+esc(p.id)+'" aria-label="Ruolo di '+esc(p.name)+'">'+["","org","admin"].map(function(r){return'<option value="'+r+'"'+(p.role===r?" selected":"")+'>'+ROLE_L[r]+'</option>'}).join("")+'</select></td>'
       +'<td>'+(p.role==="org"?botGamesSel("bpgames",'data-id="'+esc(p.id)+'"',p.games):p.role==="admin"?'tutti':'–')+'</td>'
       +'<td><input type="text" class="bpplayer" list="botnames" data-id="'+esc(p.id)+'" value="'+esc(p.player)+'" placeholder="nessuno" aria-label="Giocatore collegato a '+esc(p.name)+'">'
       +(!p.player?'':p.verified?' <span class="ok" title="Collegamento confermato">✓</span>':' <button data-bpok="'+esc(p.id)+'" data-pl="'+esc(p.player)+'" title="Solo dichiarato con /io: confermalo se è davvero questo giocatore">Conferma</button>')+'</td>'
       +'<td>'+(p.follow==="tutti"?"tutti":p.follow?p.follow+" tornei":"–")+'</td><td><button data-bpdel="'+esc(p.id)+'">'+(ARMS["bp"+p.id]?"Conferma":"Rimuovi")+'</button></td></tr>'}).join("")+'</table>';
    h+='<p class="hint" style="margin:4px 0 0">Il giocatore che la persona dichiara con /io basta per gli avvisi. Sceglierlo o confermarlo qui conferma il collegamento (✓): solo allora può cambiare il suo account Discord con /discord e vedere la password del server con /server. Anche un&#39;iscrizione accettata lo conferma.</p>';
  }else h+='<p class="empty">Nessuno ha ancora scritto al bot.</p>';
  return h;
}
/* Ogni torneo sceglie il suo bot dall'elenco (ognuno con token, ruoli, iscritti e impostazioni propri). */
function botPickFill(){
  var el=$("botpick");if(!el||!DESK||!DESK.botsList)return;
  DESK.botsList().then(function(L){
    var x=$("botpick");if(!x)return;
    /* l'elenco mostra il bot del torneo aperto; le impostazioni sotto sono quelle del bot scelto in Gestisci i bot (Impostazioni) */
    var want=S.ev&&S.ev.bot,cur=(L.filter(function(b){return b.id===want})[0]||L[0]||{}).id,act=L.filter(function(b){return b.active})[0];
    x.innerHTML='<label class="row" style="gap:8px">Bot di questo torneo <select id="botpicksel">'+L.map(function(b){return'<option value="'+esc(b.id)+'"'+(b.id===cur?" selected":"")+'>'+esc(b.label)+(b.username?" (@"+esc(b.username)+")":b.hasToken?"":" (senza token)")+'</option>'}).join("")+'</select></label><button id="botnew">Nuovo bot</button><button id="botmanage">Gestisci i bot</button>'
     +(act&&act.id!==cur?'<p class="hint" style="margin:4px 0 0;flex-basis:100%">Stai vedendo le impostazioni di <b data-noi18n>'+esc(act.label)+'</b>, non del bot di questo torneo.</p>':'');
  }).catch(function(){});
}
function botChoose(id){
  if(!S.ev)S.ev={};S.ev.bot=id;save();
  return DESK.botsUse(id).then(function(){botRefresh();botPush()});
}
function botRefresh(){var b=$("botbox");if(!b||!DESK||!DESK.botStatus)return;DESK.botStatus().then(function(st){var x=$("botbox");if(x)x.innerHTML=botHtml(st)}).catch(function(){})}
function renderBotSettings(){
  return'<h3 style="margin-top:20px">Bot Telegram</h3><p class="hint">I partecipanti chiedono al bot tornei, classifiche, partite e Hall of Fame, seguono un torneo per ricevere gli avvisi e si iscrivono. Il bot funziona mentre questo programma è aperto e connesso a internet. Come crearlo: guida (F1), «Bot Telegram».</p>'
   +(DESK&&DESK.botStatus?'<div id="botbox"><p class="hint">Caricamento…</p></div>':'<p class="hint">Disponibile solo nell&#39;app installata per Windows.</p>')
   +'<label class="row chk" style="margin-top:8px"><input type="checkbox" id="pngteams"'+(S.ev&&S.ev.pngTeams?' checked':'')+'>Nelle immagini dei tornei a squadre elenca i giocatori di ogni squadra</label>';
}
function botCfg(c){if(!DESK||!DESK.botConfig)return Promise.resolve();return DESK.botConfig(c).then(function(st){var x=$("botbox");if(x)x.innerHTML=botHtml(st);if(st&&st.running)botPush();return st}).catch(function(){})}
/* chiudendo le Impostazioni torna attivo il bot del torneo aperto (Gestisci i bot può aver mostrato quelle di un altro) */
function botBack(){if(DESK&&DESK.botsUse)DESK.botsUse((S.ev&&S.ev.bot)||"").catch(function(){})}


/* ======================================================================
   Diretta su YouTube / Twitch (solo app installata: vedi streamer.js e js/stream.js)
   ====================================================================== */
var STR=window.desk&&window.desk.streamStatus?window.desk:null,strSt=null,strPrevT=null,strSrc=null;
function strFmtTime(ms){var s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+":":"")+(h&&m<10?"0":"")+m+":"+(x<10?"0":"")+x}
function strDot(){var b=$("livebtn");if(!b||!strSt)return;b.classList.toggle("on",!!strSt.live);b.classList.toggle("wait",!!strSt.starting&&!strSt.live)}
function renderLive(){
  var el=$("livebox");if(!el||el.hidden)return;var s=strSt;
  if(!s){el.innerHTML='<h2 id="liveh">Diretta</h2><p class="hint">Caricamento…</p>';return}
  var c=s.config,dest=[c.yt.on&&c.yt.hasKey?"YouTube":"",c.tw.on&&c.tw.hasKey?"Twitch":"",c.rtmp.on&&c.rtmp.url?"RTMP":""].filter(Boolean),state;
  if(s.live)state='<span class="livepill">● IN DIRETTA</span> da '+strFmtTime(Date.now()-s.since)+' · '+s.kbps+' kbit/s · '+Math.round(s.fps)+' fps · '+esc(s.encoder.replace("h264_","").replace("libx264","processore"));
  else if(s.starting)state='<span class="livepill wait">Avvio…</span>';
  else state='Spenta';
  var h='<h2 id="liveh">Diretta'+helpBtn("diretta")+'</h2><div class="livegrid"><div><img id="liveprev" class="liveprev" alt="Anteprima della diretta"'+(s.live||s.starting?'':' hidden')+'><div class="liveoff"'+(s.live||s.starting?' hidden':'')+'>L&#39;anteprima compare quando la diretta è avviata.</div></div><div>'
   +'<p style="margin:0 0 8px" id="livestate">'+state+'</p>'
   +'<p class="cres err" id="liveerr"'+(s.err?'':' hidden')+'>'+esc(s.err||"")+'</p>'
   +'<p class="hint" style="margin:0 0 10px">Verso: '+(dest.length?dest.join(", "):'<b>nessuna destinazione</b>: impostala in IMPOSTAZIONI, sezione Diretta')+(c.save?' + copia su disco':'')+'</p>'
   +'<div class="row">'+(s.live||s.starting?'<button id="livestop">Ferma la diretta</button>':'<button class="p" id="livego"'+(dest.length||c.save?'':' disabled')+'>Avvia la diretta</button>')+'<button id="liveset">Impostazioni</button></div>'
   +'<h3 style="margin:14px 0 6px">Scena</h3><div class="row livescenes">'+Object.keys(s.scenes).map(function(k){return'<button data-scene="'+k+'"'+(s.scene===k?' class="p" aria-pressed="true"':' aria-pressed="false"')+'>'+esc(s.scenes[k])+'</button>'}).join("")+'</div>'
   +(c.cams.length>1?'<div class="row" style="margin-top:8px"><span class="hint" style="margin:0">Telecamera principale:</span>'+c.cams.map(function(x,i){return'<button data-livecam="'+i+'"'+(c.cam===i?' class="p"':'')+'>'+(i+1)+'</button>'}).join("")+'</div>':'')
   +(s.links.some(function(l){return l.url})?'<p class="hint">Si guarda su: '+s.links.filter(function(l){return l.url}).map(function(l){return esc(l.name)+' <a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.url)+'</a>'}).join(" · ")+'</p>':'')
   +'<p class="hint">Quando la diretta parte, il bot Telegram avvisa tutte le chat con questi link.</p></div></div>';
  el.innerHTML=h;strPrev();
}
function strPrev(){
  clearTimeout(strPrevT);if(!STR||!strSt||!(strSt.live||strSt.starting)||$("livebox").hidden)return;
  STR.streamGetPreview().then(function(d){var i=$("liveprev");if(i&&d)i.src=d}).catch(function(){});
  strPrevT=setTimeout(strPrev,1000);
}
function strRefresh(){if(!STR)return;STR.streamStatus().then(function(s){strSt=s;strDot();renderLive()}).catch(function(){})}
if(STR){
  STR.onStream(function(s){
    var old=strSt,same=old&&old.live===s.live&&old.starting===s.starting&&old.scene===s.scene&&old.config.cam===s.config.cam;strSt=s;strDot();
    if(!$("livebox").hidden){
      if(same&&$("livestate")){$("livestate").innerHTML=s.live?'<span class="livepill">● IN DIRETTA</span> da '+strFmtTime(Date.now()-s.since)+' · '+s.kbps+' kbit/s · '+Math.round(s.fps)+' fps · '+esc(s.encoder.replace("h264_","").replace("libx264","processore")):s.starting?'<span class="livepill wait">Avvio…</span>':'Spenta';var e=$("liveerr");if(e){e.hidden=!s.err;e.textContent=s.err||""}}
      else renderLive();
    }
    if(s.live&&!(old&&old.live))toast("Sei in diretta. Il bot Telegram ha avvisato tutti.");
  });
  strRefresh();
}
$("livebox").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b||!STR)return;
  if(b.id==="livego"){b.disabled=true;b.textContent="Avvio…";STR.streamStart().then(function(s){strSt=s;renderLive()});return}
  if(b.id==="livestop"){STR.streamStop().then(function(s){strSt=s;renderLive()});return}
  if(b.id==="liveset"){var eb=$("editbox");eb.hidden=false;renderEdit();var t=$("strbox");if(t)t.scrollIntoView({block:"start"});return}
  if(b.dataset.scene){STR.streamScene(b.dataset.scene).then(function(s){strSt=s;renderLive()});return}
  if(b.dataset.livecam!==undefined){STR.streamScene(strSt.scene,+b.dataset.livecam).then(function(s){strSt=s;renderLive()})}
});
function strHtml(s,src){
  var c=s.config,o=function(v,cur,l){return'<option value="'+esc(v)+'"'+(v===cur?" selected":"")+'>'+esc(l)+'</option>'};
  var h='<div class="strform">'
   +'<fieldset><legend><label class="chk"><input type="checkbox" id="s_yt_on"'+(c.yt.on?" checked":"")+'>YouTube</label></legend><div class="row"><input type="password" id="s_yt_key" autocomplete="off" placeholder="'+(c.yt.hasKey?"Chiave salvata "+esc(c.yt.keyHint)+": lascia vuoto per non cambiarla":"Chiave di trasmissione (YouTube Studio, Trasmetti dal vivo)")+'"><input type="text" id="s_yt_link" placeholder="Link per gli spettatori, es. https://youtube.com/@canale/live" value="'+esc(c.yt.link)+'"></div></fieldset>'
   +'<fieldset><legend><label class="chk"><input type="checkbox" id="s_tw_on"'+(c.tw.on?" checked":"")+'>Twitch</label></legend><div class="row"><input type="password" id="s_tw_key" autocomplete="off" placeholder="'+(c.tw.hasKey?"Chiave salvata "+esc(c.tw.keyHint)+": lascia vuoto per non cambiarla":"Chiave di trasmissione (Twitch, Dashboard creatore, Trasmissione)")+'"><input type="text" id="s_tw_ch" placeholder="Nome del canale, es. fragmarathon" value="'+esc(c.tw.channel)+'"></div></fieldset>'
   +'<fieldset><legend><label class="chk"><input type="checkbox" id="s_rt_on"'+(c.rtmp.on?" checked":"")+'>Altro server RTMP</label></legend><div class="row"><input type="text" id="s_rt_url" placeholder="rtmp://… oppure rtmps://…" value="'+esc(c.rtmp.url)+'"><input type="password" id="s_rt_key" autocomplete="off" placeholder="'+(c.rtmp.hasKey?"Chiave salvata":"Chiave (facoltativa)")+'"><input type="text" id="s_rt_link" placeholder="Link per gli spettatori" value="'+esc(c.rtmp.link)+'"></div></fieldset>'
   +'<div class="row" style="margin-top:10px"><label class="row" style="gap:6px">Qualità <select id="s_q">'+s.qualities.map(function(q){return o(q,c.quality,q.replace("p"," p ").replace(/ p (\d+)/," p, $1 fps"))}).join("")+'</select></label>'
   +'<label class="row" style="gap:6px">Bitrate <input type="number" id="s_kbps" min="0" max="20000" step="500" value="'+(c.kbps||0)+'" style="width:100px"> kbit/s <span class="hint" style="margin:0">(0 = automatico)</span></label></div>'
   +'<div class="row" style="margin-top:10px"><label class="row" style="gap:6px;flex:1 1 100%">Finestra da trasmettere <select id="s_src">'+o("wall",c.source,"Schermo proiettore (consigliato)")+o("main",c.source,"Finestra principale del programma")
   +(src?src.screens.map(function(x,i){return o(x.id,c.source,"Schermo intero "+(i+1))}).join("")+src.windows.filter(function(x){return!/Tornei Fragmarathon/.test(x.name)}).map(function(x){return o(x.id,c.source,"Finestra: "+x.name.slice(0,60))}).join(""):"")+'</select></label></div>'
   +'<div style="margin-top:10px"><span class="hint" style="margin:0">Telecamere (fino a 4):</span><div class="row">'+(src&&src.cams.length?src.cams.map(function(x){return'<label class="row chk"><input type="checkbox" class="s_cam" value="'+esc(x.id)+'"'+(c.cams.indexOf(x.id)>=0?" checked":"")+'>'+esc(x.name)+'</label>'}).join(""):'<span class="hint" style="margin:0">'+(src?"Nessuna telecamera collegata.":"Cerco le telecamere…")+'</span>')+'</div></div>'
   +'<div class="row" style="margin-top:10px"><label class="row" style="gap:6px">Microfono <select id="s_mic">'+o("",c.mic,"Nessuno")+(src?src.mics.map(function(x){return o(x.id,c.mic,x.name)}).join(""):"")+'</select></label><label class="row chk"><input type="checkbox" id="s_pca"'+(c.pcAudio?" checked":"")+'>Audio del PC (quello che si sente dalle casse)</label></div>'
   +'<div class="row" style="margin-top:10px"><label class="row chk"><input type="checkbox" id="s_ov"'+(c.overlay?" checked":"")+'>Titolo dell&#39;evento e logo in sovrimpressione</label><label class="row chk"><input type="checkbox" id="s_save"'+(c.save?" checked":"")+'>Salva anche una copia in Documenti\\Tornei Fragmarathon\\dirette</label></div>'
   +'<div class="row" style="margin-top:12px"><button class="p" id="s_ok">Salva impostazioni della diretta</button><button id="s_open">Apri i comandi della diretta</button><span class="hint" style="margin:0" id="s_msg"></span></div></div>';
  return h;
}
function renderStreamSettings(){return'<h3 style="margin-top:20px">Diretta su YouTube e Twitch</h3><p class="hint">Trasmette lo schermo del proiettore (o un&#39;altra finestra) con una o più telecamere, anche su YouTube e Twitch insieme. Le chiavi restano solo su questo PC. Guida: F1, «Diretta».</p>'+(STR?'<div id="strbox"><p class="hint">Caricamento…</p></div>':'<p class="hint">Disponibile solo nell&#39;app installata per Windows.</p>')}
function strFill(){
  var b=$("strbox");if(!b||!STR)return;
  STR.streamStatus().then(function(s){strSt=s;var x=$("strbox");if(x)x.innerHTML=strHtml(s,strSrc)});
  STR.streamSources().then(function(src){strSrc=src;var x=$("strbox");if(x&&strSt&&!x.contains(document.activeElement))x.innerHTML=strHtml(strSt,src)}).catch(function(){});
}
function strSave(){
  var v=function(id){var e=$(id);return e?e.value:""},ck=function(id){var e=$(id);return!!(e&&e.checked)};
  var c={yt:{on:ck("s_yt_on"),link:v("s_yt_link")},tw:{on:ck("s_tw_on"),channel:v("s_tw_ch")},rtmp:{on:ck("s_rt_on"),url:v("s_rt_url"),link:v("s_rt_link")},
    quality:v("s_q"),kbps:parseInt(v("s_kbps"),10)||0,source:v("s_src"),mic:v("s_mic"),pcAudio:ck("s_pca"),overlay:ck("s_ov"),save:ck("s_save"),
    cams:[].slice.call(document.querySelectorAll(".s_cam:checked")).map(function(x){return x.value})};
  if(v("s_yt_key").trim())c.yt.key=v("s_yt_key");if(v("s_tw_key").trim())c.tw.key=v("s_tw_key");if(v("s_rt_key").trim())c.rtmp.key=v("s_rt_key");
  if(c.cams.length>4){toast("Al massimo 4 telecamere.");return}
  if(c.yt.on&&c.yt.link&&!/^https?:\/\//i.test(c.yt.link)){toast("Il link di YouTube deve iniziare con https://");return}
  STR.streamConfig(c).then(function(s){strSt=s;var x=$("strbox");if(x)x.innerHTML=strHtml(s,strSrc);var m=$("s_msg");if(m)m.textContent="Salvato.";renderLive()});
}

var CSSTPL="/* Tornei Fragmarathon: CSS personalizzato.\n   Importalo da IMPOSTAZIONI > CSS personalizzato. Vale sopra a qualsiasi tema.\n   :root:not(#x) serve a vincere su tema e chiaro/scuro di Windows. */\n\n:root:not(#x){\n  --bg:#101418;      /* sfondo della pagina */\n  --panel:#182028;   /* sfondo dei pannelli */\n  --ink:#F2F4F7;     /* testo */\n  --mut:#A9B4C2;     /* testo secondario */\n  --line:#2A3542;    /* righe sottili */\n  --edge:#3E4C5C;    /* bordi e intestazioni delle tabelle */\n  --acc:#FF5A1F;     /* colore principale: pulsanti, qualificati, vincitori */\n  --accink:#111111;  /* testo sopra al colore principale */\n  --win:var(--acc);\n  --gold:var(--acc);\n  --wacc:#FF5A1F;    /* colore principale sul proiettore (su fondo nero) */\n}\n\n/* Intestazione: righe e bagliore */\n.brand{}\n.brand h1{}\n.brand .tag{}\n\n/* Proiettore: il pannello mostrato */\n#wfit{}\n#wall .wh{}\n";
function readLogo(file){
  var rd=new FileReader();
  rd.onload=function(){
    var im=new Image();
    im.onload=function(){
      var z=512,sc=Math.min(1,z/Math.max(im.width||z,im.height||z)),w=Math.round((im.width||z)*sc),h=Math.round((im.height||z)*sc),c=document.createElement("canvas");
      c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);
      try{S.ui.logo=c.toDataURL("image/png");applyUi();save();renderLogoRow();toast("Logo aggiornato.")}catch(e){toast("Non riesco a usare questa immagine.")}
    };
    im.onerror=function(){toast("Il file non è un'immagine valida.")};
    im.src=rd.result;
  };
  rd.readAsDataURL(file);
}
/* token incollato: si prende tutto il testo degli appunti (anche su più righe) e se ne estrae il token */
$("editbox").addEventListener("paste",function(e){
  if(e.target.id!=="bottok")return;
  var t=(e.clipboardData||window.clipboardData).getData("text")||"",m=/(\d{5,}:[A-Za-z0-9_-]{20,})/.exec(t)||/(\d{5,}:[A-Za-z0-9_-]{20,})/.exec(t.replace(/\s+/g,""));
  e.preventDefault();e.target.value=m?m[1]:t.replace(/\s+/g,"");
  if(!m)toast("Il testo incollato non sembra un token completo: deve essere tipo 123456789:AAH… (circa 46 caratteri).");
});
$("editbox").addEventListener("change",function(e){
  if(e.target.id==="pngteams"){S.ev=S.ev||{};S.ev.pngTeams=e.target.checked;save();return}
  if(/^ai(target|style|prov|url|model|key)$/.test(e.target.id)){
    var c=aiReadForm(),autoP=!c.prompt||c.prompt===aiPrompt(aiCfg());
    /* una chiave per servizio: quella di un servizio non va mai mandata a un altro */
    if(e.target.id==="aiprov"){var prev=aiCfg();c.keys=prev.keys||{};c.keys[prev.prov]=c.key||"";c.key=c.keys[c.prov]||"";c.url="";c.model=""}
    if(autoP&&/^ai(target|style)$/.test(e.target.id))delete c.prompt;
    aiSaveCfg(c);if(/^ai(target|style|prov)$/.test(e.target.id))renderAiBox();return;
  }
  if(e.target.id==="aiprompt"){aiSaveCfg(aiReadForm());return}
  if(e.target.id==="boton"){botCfg({enabled:e.target.checked});return}
  if(e.target.classList.contains("bprole")){var row=e.target.closest("tr"),gsel=row&&row.querySelector(".bpgames");botCfg({setRole:{id:e.target.dataset.id,role:e.target.value,games:gsel?[].slice.call(gsel.selectedOptions).map(function(o){return o.value}):[]}});return}
  if(e.target.classList.contains("bpgames")){var rs=e.target.closest("tr").querySelector(".bprole");botCfg({setRole:{id:e.target.dataset.id,role:rs.value,games:[].slice.call(e.target.selectedOptions).map(function(o){return o.value})}});return}
  if(e.target.classList.contains("bpplayer")){botCfg({setPlayer:{id:e.target.dataset.id,player:e.target.value}});return}
  if(e.target.id==="botjoin"){botCfg({join:e.target.value});return}
  if(e.target.id==="botpicksel"){botChoose(e.target.value);return}
  if(e.target.dataset&&e.target.dataset.gst){botCfg({groupSet:{id:e.target.dataset.gst,status:e.target.value}});toast(e.target.value==="on"?"Gruppo abilitato: il bot si presenta con il link.":"Stato del gruppo aggiornato.");return}
  if(e.target.id==="botwel"){botCfg({welcome:e.target.value});toast("Messaggio di benvenuto salvato.");return}
  if(e.target.classList.contains("botn")){var nn={};nn[e.target.dataset.n]=e.target.checked;botCfg({notify:nn});return}
  var f=e.target.files&&e.target.files[0];if(!f)return;
  if(e.target.id==="elf")readLogo(f);
  if(e.target.id==="ecf"){
    if(f.size>300000){toast("Il file CSS è troppo grande (massimo 300 KB).");e.target.value="";return}
    var rd=new FileReader();rd.onload=function(){S.ui.css=String(rd.result);applyUi();save();renderCssRow();toast("CSS importato: "+f.name+".")};rd.readAsText(f);
  }
  e.target.value="";
});
$("editbtn").onclick=function(){var eb=$("editbox");eb.hidden=!eb.hidden;if(!eb.hidden){armDel=null;renderEdit();eb.scrollIntoView({block:"center"})}else botBack()};
$("editbox").onclick=function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.id==="ecancel"){$("editbox").hidden=true;botBack();return}
  if(b.id==="elogo"){$("elf").click();return}
  if(b.id==="aigo"){if(!aiBusy)aiRun();return}
  if(b.id==="aifind"||b.id==="aicheck"){aiFind(b.id==="aicheck");return}
  if(b.dataset.aiopen){window.open(b.dataset.aiopen,"_blank","noopener");return}
  if(b.dataset.aicopy){var tx=b.dataset.aicopy;(navigator.clipboard?navigator.clipboard.writeText(tx):Promise.reject()).then(function(){toast("Copiato.")}).catch(function(){toast(tx)});return}
  if(b.id==="s_ok"){strSave();return}
  if(b.id==="s_open"){var lb=$("livebox");lb.hidden=false;renderLive();lb.scrollIntoView({block:"start"});return}
  if(b.id==="bottokshow"){var ti=$("bottok"),sh=ti.type==="password";ti.type=sh?"text":"password";b.textContent=sh?"Nascondi":"Mostra";b.setAttribute("aria-pressed",String(sh));return}
  if(b.dataset.gleave){if(!arm("gl"+b.dataset.gleave,b,"Conferma: esci"))return;botCfg({groupLeave:{id:b.dataset.gleave}});toast("Il bot è uscito dal gruppo.");return}
  if(b.dataset.gblock){if(!arm("gb"+b.dataset.gblock,b,"Conferma: esci e blocca"))return;botCfg({groupLeave:{id:b.dataset.gblock,block:true}});toast("Il bot è uscito e chi l'ha aggiunto è bloccato.");return}
  if(b.dataset.unblock){botCfg({unblock:b.dataset.unblock});toast("Sbloccato.");return}
  if(b.id==="botnew"){DESK.botsList().then(function(L){return DESK.botsAdd("Bot "+(L.length+1))}).then(function(id){return botChoose(id)}).then(function(){toast("Nuovo bot creato per questo torneo: incolla il suo token e premi Salva e collega.");var t=$("bottok");if(t)t.focus()});return}
  if(b.id==="botmanage"){if(window.HOME)window.HOME.open("bots");return}
  if(b.id==="botsave"){if(b.disabled)return;var tk=$("bottok").value.trim();b.disabled=true;botCfg(tk?{token:tk,enabled:true}:{enabled:true}).then(function(){b.disabled=false});$("bottok").value="";return}
  if(b.id==="botdel"){botCfg({removeToken:true});return}
  if(b.id==="botcode"){botCfg({newCode:true});return}
  if(b.id==="bradd"){var u=$("bru").value.trim();if(!/^@?[A-Za-z0-9_]{4,32}$/.test(u.replace(/^https?:\/\/t\.me\//i,""))){toast("Scrivi lo username Telegram, per esempio @LazarusCRY.");return}var gs=[].slice.call($("brg").selectedOptions).map(function(o){return o.value});botCfg({userRole:{u:u,role:$("brr").value,games:gs}});toast("Ruolo assegnato a "+u+".");return}
  if(b.dataset.bru){botCfg({removeUserRole:b.dataset.bru});return}
  if(b.dataset.bpdel){if(!arm("bp"+b.dataset.bpdel,b,"Conferma"))return;botCfg({removeChat:b.dataset.bpdel});return}
  if(b.dataset.bpok){b.disabled=true;botCfg({setPlayer:{id:b.dataset.bpok,player:b.dataset.pl||""}}).then(function(st){if(st)toast("Collegamento confermato.");else b.disabled=false});return}
  if(b.dataset.botok||b.dataset.botno){DESK.botDecide(b.dataset.botok||b.dataset.botno,!!b.dataset.botok).then(botRefresh);return}
  if(b.id==="aireset"){var c0=aiReadForm();delete c0.prompt;aiSaveCfg(c0);renderAiBox();return}
  if(b.dataset.aiuse!==undefined){aiUse(+b.dataset.aiuse);return}
  if(b.id==="elogodef"){delete S.ui.logo;applyUi();save();renderLogoRow();toast("Ripristinato il logo Fragmarathon.");return}
  if(b.id==="ecssimp"){$("ecf").click();return}
  if(b.id==="ecssweb"){cssWeb();return}
  if(b.id==="ecssexp"){dlBlob(new Blob([CSSTPL],{type:"text/css"}),"tornei-fragmarathon-modello.css");toast("Modello CSS scaricato.");return}
  if(b.id==="ecssdel"){S.ui.css="";applyUi();save();renderCssRow();toast("CSS personalizzato rimosso.");return}
  if(b.id==="esave"){
    S.ui.title=$("etitle").value.trim();S.ui.sub=$("esub").value.trim();if($("ecss"))S.ui.css=$("ecss").value.slice(0,300000);
    document.querySelectorAll(".egn").forEach(function(i){var k=i.dataset.k,v=i.value.trim();if(v&&v!==ORIGL[k])S.names[k]=v;else delete S.names[k]});
    registerCustom();applyUi();save();$("editbox").hidden=true;botBack();render();
  }else if(b.classList.contains("egdel")){
    var k=b.dataset.k;
    if(armDel!==k){armDel=k;b.textContent="Conferma elimina";b.classList.add("p");return}
    armDel=null;delGame(k);renderEdit(true);
  }
};
$("setup").onclick=function(e){
  var b=e.target.closest("button");if(!b)return;
  var g=G();
  if(b.id==="add")addPlayer();
  else if(b.id==="pair"||b.id==="pairgo"){
    if(g.running)return;touch(g);pairTeams(g);
    if(b.id==="pairgo"&&g.players.length>=2)startT(g);else{save();render()}
  }
  else if(b.id==="all"||b.id==="allgo"){
    if(g.running)return;touch(g);fillAll(g);
    if(b.id==="allgo"&&g.players.length>=2)startT(g);else{save();render()}
  }
  else if(b.id==="start"){
    if(g.phase==="setup"||g.dirty){if(g.players.length>=2)startT(g)}
    else{g.running=true;save();render()}
  }
  else if(b.id==="cfrecalc")calcRecalc(g);
  else if(b.id==="cfregen"){if(!ARMS.regen){ARMS.regen=1;b.textContent="Conferma: rigenera";b.classList.add("p");setTimeout(function(){delete ARMS.regen;var x=$("cfregen");if(x)render()},4500);return}delete ARMS.regen;calcRegen(g)}
  else if(b.id==="cfadd"){
    var lab=($("cfnew").value||"").trim();if(!lab){$("cfnew").focus();return}
    var F0=ffaFields(g).slice(),k0=calcKey(lab),base=k0,ix=2;
    while(F0.some(function(f){return f.k===k0})||["min","max","abs","arrotonda","giu","su","se","tabella","round","floor","ceil","if","table"].indexOf(k0)>=0)k0=base+"_"+(ix++);
    F0.push({k:k0,l:lab});g.calc=g.calc||{};g.calc.fields=F0;
    /* nei punteggi già inseriti il campo nuovo vale 0: senza, la formula non avrebbe tutti i valori e i turni passati (non più modificabili) perderebbero i punti */
    if(g.ffa)g.ffa.rounds.forEach(function(rd){rd.groups.forEach(function(gr){Object.keys(gr.v||{}).forEach(function(n){if(gr.v[n]&&gr.v[n][k0]==null)gr.v[n][k0]=0})})});
    if(!g.calc.ffa||g.calc.ffa===CALC_DEF.ffa)g.calc.ffa=F0.map(function(f){return f.k}).join(" + ");
    ffaRecalc(g);save();render();toast("Campo aggiunto: nella formula usa «"+k0+"».");
  }
  else if(b.classList.contains("cfdel")){
    var F1=ffaFields(g).slice();F1.splice(+b.dataset.i,1);g.calc=g.calc||{};g.calc.fields=F1;
    if(!fxSafe(g.calc.ffa||"",F1.map(function(f){return f.k}))){g.calc.ffa=F1.map(function(f){return f.k}).join(" + ");toast("La formula usava il campo rimosso: ora somma i campi rimasti.")}
    ffaRecalc(g);save();render();
  }
  else if(b.id==="pause"){g.running=false;save();render()}
  else if(b.id==="logo")$("lf").click();
  else if(b.id==="nologo"){delete g.logo;save();render()}
  else if(b.id==="gdup"){b.parentNode.innerHTML='<button id="gdup0">Duplica senza risultati</button><button id="gdup1">Duplica con i risultati</button>';return}
  else if(b.id==="gdup0"||b.id==="gdup1"){dupGame(S.cur,b.id==="gdup1")}
  else if(b.id==="gdraft"){g.draft=!g.draft;save();render();toast(g.draft?DEF[S.cur].l+" è in lavorazione: lo vedono solo amministratori e organizzatori.":DEF[S.cur].l+" ora è visibile a tutti.")}
  /* la conferma vale solo per lo stesso pulsante e lo stesso gioco */
  else if(b.id==="gdel"){var ak="gdel:"+S.cur;
    if(armed!==ak){armed=ak;b.textContent="Conferma: elimina "+DEF[S.cur].l;b.classList.add("p");setTimeout(function(){if(armed===ak)armed=false;else if(/^gdel:/.test(armed))return;var el=$("gdel");if(el&&el.classList.contains("p")){el.textContent="Elimina "+(DEF[S.cur]||{}).l;el.classList.remove("p")}},4000)}
    else{armed=false;delGame(S.cur)}
  }
  else if(b.id==="reset"){var rk="reset:"+S.cur;
    if(armed!==rk){
      armed=rk;b.textContent="Conferma: azzera "+DEF[S.cur].l;b.classList.add("p");
      setTimeout(function(){if(armed===rk)armed=false;else if(/^reset:/.test(armed))return;var el=$("reset");if(el&&el.classList.contains("p")){el.textContent="Azzera "+(DEF[S.cur]||{}).l;el.classList.remove("p")}},4000);
    }else{armed=false;delSnap("risultati di "+DEF[S.cur].l);var lg=g.logo,gcf=g.cfg,tm=g.team;S.games[S.cur]=fresh(S.cur);if(lg)S.games[S.cur].logo=lg;if(gcf)S.games[S.cur].cfg=gcf;if(tm!==undefined)S.games[S.cur].team=tm;save();render()}
  }
  else if(b.classList.contains("ma"))addMember(+b.dataset.t);
  else if(b.classList.contains("mr")){if(g.running)return;delSnap(g.members[g.players[+b.dataset.t]][+b.dataset.m]+" dalla squadra");touch(g);var t=g.players[+b.dataset.t];g.members[t].splice(+b.dataset.m,1);save();render()}
  else if(b.dataset.i!==undefined&&!g.running){delSnap(g.players[+b.dataset.i]+" da "+DEF[S.cur].l);touch(g);delete g.members[g.players[+b.dataset.i]];g.players.splice(+b.dataset.i,1);save();render()}
};
function addMember(i){
  var g=G(),inp=document.querySelector('.mi[data-t="'+i+'"]'),v=inp.value.trim();if(!v||g.running)return;
  var t=g.players[i];g.members[t]=g.members[t]||[];
  if(g.members[t].some(function(x){return x.toLowerCase()===v.toLowerCase()})){inp.select();return}
  touch(g);g.members[t].push(v);save();render();
  var n=document.querySelector('.mi[data-t="'+i+'"]');if(n)n.focus();
}
$("setup").onkeydown=function(e){
  if(e.key!=="Enter")return;
  if(e.target.id==="pname")addPlayer();
  else if(e.target.classList.contains("mi"))addMember(+e.target.dataset.t);
  else if(e.target.id==="cfnew"){e.preventDefault();$("cfadd").click()}
  else if(/^cf(ffa|rank|hof)$/.test(e.target.id)){e.preventDefault();e.target.blur()}
};
$("setup").oninput=function(e){
  if(e.target.id==="tname"){G().name=e.target.value;save();return}
  var id=e.target.id;if(id!=="cfffa"&&id!=="cfrank"&&id!=="cfhof")return;
  var g=G(),al=id==="cfffa"?ffaFields(g).map(function(f){return f.k}):TF.FX_MATCH_VARS,smp={};
  if(id==="cfffa")ffaFields(g).forEach(function(f,i){smp[f.k]=i?3:2});else smp=TF.fxMatchVars(3,1);
  var t=calcTest(e.target.value,al,smp),out=$(id+"-r");
  if(out){out.className="cres "+(t.ok?"ok":"err");out.textContent=t.ok?(id==="cfffa"?"Esempio con "+al.map(function(k){return k+" = "+smp[k]}).join(", ")+": ":"Esempio, vittoria 3 a 1: ")+t.v+" punti (premi Invio o esci dal campo per salvare)":t.msg}
};
$("setup").addEventListener("toggle",function(e){if(e.target.classList&&e.target.classList.contains("calc"))calcOpen=e.target.open},true);
$("setup").onchange=function(e){
  var g=G();if(["mode","ng","team","nq"].indexOf(e.target.id)>-1)touch(g);
  if(e.target.id==="mode"){g.mode=e.target.value;if(g.mode==="solo")g.ng=1;save();render()}
  if(e.target.id==="ng"){g.ng=+e.target.value;save()}
  if(e.target.id==="tsize"){g.tsize=+e.target.value;save()}
  if(e.target.id==="plat"){g.plat=e.target.value;save();render()}
  if(e.target.id==="fgs"){var v=parseInt(e.target.value,10);if(v>=2){g.ffaGs=Math.min(999,v);if(ffaAdvOf(g)>=g.ffaGs)g.ffaAdv=g.ffaGs-1;touch(g);save()}render()}
  if(e.target.classList.contains("cpre")&&e.target.value!==""){
    var pw=e.target.dataset.w,pr=CALC_PRE[pw][+e.target.value];g.calc=g.calc||{};
    if(pw==="ffa"){if(g.running){toast("Metti il torneo in pausa per cambiare i campi.");render();return}
      /* altri campi: i valori già inseriti non si possono riportare sui nuovi */
      if(ffaHasV(g)){toast("Con i punteggi già inseriti il modello non si cambia più: aggiungi o togli i campi uno per uno.");render();return}g.calc.fields=pr[1].map(function(x){return{k:x[0],l:x[1]}});g.calc.ffa=pr[2];calcRecalc(g)}
    else{calcSet(g,pw,pr[1]);toast("Modello applicato: "+pr[0]+".")}
    return;
  }
  if(e.target.id==="cfffa"){calcSet(g,"ffa",e.target.value);return}
  if(e.target.id==="cfrank"){calcSet(g,"rank",e.target.value);return}
  if(e.target.id==="cfhof"){calcSet(g,"hof",e.target.value);return}
  if(e.target.id==="dereset"){g.deReset=e.target.checked;touch(g);save();return}
  if(e.target.id==="swr"){var sr=parseInt(e.target.value,10);if(sr>=1){g.swR=Math.min(30,sr);touch(g);save()}render();return}
  if(e.target.id==="swtop"){g.swTop=+e.target.value;touch(g);save();render();return}
  if(e.target.id==="rrng"){var rg=parseInt(e.target.value,10);if(rg>=1){g.ng=Math.min(32,rg);touch(g);save()}render();return}
  if(e.target.id==="rrnq"){g.nq=+e.target.value;touch(g);save();render();return}
  if(e.target.id==="fadv"){var a=parseInt(e.target.value,10);if(a>=1){g.ffaAdv=Math.min(a,ffaGsOf(g)-1);touch(g);save()}render()}
  if(e.target.id==="team"){g.team=e.target.value==="1";DEF[S.cur].t=g.team?1:0;g.players=[];g.members={};save();render()}
  if(e.target.id==="nq"){g.nq=Math.max(2,parseInt(e.target.value,10)||5);e.target.value=g.nq;save()}
  if(e.target.id==="lf"&&e.target.files[0]){
    var rd=new FileReader();
    rd.onload=function(){
      var im=new Image();
      im.onload=function(){
        var c=document.createElement("canvas"),z=96;c.width=c.height=z;
        var sc=Math.min(z/im.width,z/im.height),w=im.width*sc,h=im.height*sc;
        c.getContext("2d").drawImage(im,(z-w)/2,(z-h)/2,w,h);
        g.logo=c.toDataURL("image/png");save();render();
      };
      im.src=rd.result;
    };
    rd.readAsDataURL(e.target.files[0]);
  }
};
$("out").addEventListener("change",function(e){
  var t=e.target;if(!t.classList||!t.classList.contains("srvsel"))return;
  var g=G();g.srv=g.srv||{};if(t.value)g.srv[t.getAttribute("data-sk")]=t.value;else delete g.srv[t.getAttribute("data-sk")];save();
  toast(t.value?"Server assegnato: "+t.options[t.selectedIndex].text.replace("🖥 ","")+". Chi è collegato al bot lo riceve con le partite.":"Server tolto dall'incontro.");
});
$("out").onchange=function(e){if(e.target.classList&&e.target.classList.contains("srvsel"))return;
  var t=e.target;
  if(t.classList.contains("fsv")){
    var g5=G(),gr5=g5.ffa.rounds[+t.dataset.r].groups[+t.dataset.g],n5=t.dataset.p;gr5.v=gr5.v||{};gr5.v[n5]=gr5.v[n5]||{};
    var v5=scoreVal(t.value);if(v5==null)delete gr5.v[n5][t.dataset.f];else gr5.v[n5][t.dataset.f]=v5;
    gr5.s[n5]=ffaScore(g5,gr5,n5);save();renderOut();return;
  }
  if(t.classList.contains("fs")){
    var gr0=G().ffa.rounds[+t.dataset.r].groups[+t.dataset.g],v0=t.value===""?null:Math.max(0,parseInt(t.value,10));
    gr0.s[t.dataset.p]=isNaN(v0)?null:v0;save();renderOut();return;
  }
  if(t.classList.contains("bs")){
    var G0=G(),R=G0.rounds,isT=t.dataset.r==="t",r=isT?0:+t.dataset.r,i=+t.dataset.i,m=isT?G0.third:R[r][i],v=t.value===""?null:Math.max(0,parseInt(t.value,10));
    m[t.dataset.s]=isNaN(v)?null:v;
    if(m.sa!=null&&m.sb!=null){
      var wn=m.sa>m.sb?m.a:m.b;
      if(isT)m.w=m.sa!==m.sb?wn:null;
      else{if(m.sa!==m.sb)setWinner(R,r,i,wn);else unsetWinner(R,r,i);syncThird(G0)}
    }
    save();renderOut();return;
  }
  if(t.classList.contains("ds")){
    var g1=G(),m1=deState(g1).ev.M[t.dataset.id];if(!m1||!m1.ready)return;
    var v1=scoreVal(t.value),sa1=t.dataset.s==="sa"?v1:m1.sa,sb1=t.dataset.s==="sb"?v1:m1.sb;
    g1.de.res[m1.id]={a:m1.a,b:m1.b,sa:sa1,sb:sb1,w:sa1!=null&&sb1!=null&&sa1!==sb1?(sa1>sb1?m1.a:m1.b):null};save();renderOut();return;
  }
  if(t.classList.contains("ws")){
    var m2=G().sw.rounds[+t.dataset.r][+t.dataset.i];m2[t.dataset.s]=scoreVal(t.value);
    m2.w=m2.sa!=null&&m2.sb!=null?(m2.sa>m2.sb?m2.a:m2.sa<m2.sb?m2.b:"="):null;save();renderOut();return;
  }
  if(!t.classList.contains("sc"))return;
  var m=G().groups[+t.dataset.g].matches[+t.dataset.m],v=t.value===""?null:Math.max(0,parseInt(t.value,10));
  m[t.dataset.s]=isNaN(v)?null:v;save();renderOut();
};
$("out").onclick=function(e){
  var b=e.target.closest("button"),g=G();if(!b)return;
  if(b.id==="ffanext"){shufArm=null;nextRound(G());return}
  if(b.id==="ffashuf"||b.id==="ffabal"){
    var gg=G(),kk=b.id==="ffabal"?"b":"r",lr=gg.ffa.rounds[gg.ffa.rounds.length-1],any=lr.groups.some(function(x){return x.p.some(function(n){return x.s[n]!=null})});
    if(any&&shufArm!==kk){shufArm=kk;render();setTimeout(function(){if(shufArm===kk){shufArm=null;render()}},5000);return}
    shufArm=null;ffaReshuffle(gg,kk==="b");return}
  if(b.id==="png"){savePng(S.cur);return}
  if(b.dataset.de){var m3=deState(g).ev.M[b.dataset.de];if(m3&&m3.ready){g.de.res[m3.id]={a:m3.a,b:m3.b,sa:m3.sa,sb:m3.sb,w:b.dataset.n};save();renderOut()}return}
  if(b.dataset.sw!==undefined){var m4=g.sw.rounds[+b.dataset.sw][+b.dataset.i];if(m4){m4.w=b.dataset.n;save();renderOut()}return}
  if(b.id==="swnext"){g.sw.rounds.push(TF.swPair(g.players,g.sw.rounds,shuffle,rankFx(g)));save();render();return}
  if(b.id==="swpo"){g.rounds=bracket(TF.swStandings(g.players,g.sw.rounds,rankFx(g)).slice(0,g.sw.top).map(function(x){return x.n}));g.phase="final";syncThird(g);save();render();return}
  if(b.id==="fin"){if(allDone(g)){finals(g);save();render()}return}
  if(b.dataset.r!==undefined){
    if(b.dataset.r==="t")g.third.w=b.dataset.n;
    else{setWinner(g.rounds,+b.dataset.r,+b.dataset.i,b.dataset.n);syncThird(g)}
    save();renderOut()}
};
$("out").addEventListener("dragstart",function(e){
  var gp=e.target.closest&&e.target.closest(".grip"),row=gp&&gp.closest("[data-dz]");if(!row)return;
  DRAG={t:row.dataset.dz,g:row.dataset.g,i:row.dataset.i,k:row.dataset.k,p:row.dataset.p};
  e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",DRAG.p||"");e.dataTransfer.setDragImage(row,14,14)}catch(x){}
  row.classList.add("dragging");
});
$("out").addEventListener("dragover",function(e){
  var t=DRAG&&e.target.closest("[data-dz]");if(!t||t.dataset.dz!==DRAG.t||((DRAG.t==="b"||DRAG.t==="d")&&!t.dataset.i)){dzOver(null);return}
  e.preventDefault();e.dataTransfer.dropEffect="move";dzOver(t);
});
$("out").addEventListener("drop",function(e){
  var t=DRAG&&e.target.closest("[data-dz]"),src=DRAG;dzEnd();if(!t||t.dataset.dz!==src.t)return;e.preventDefault();
  var g=G(),dst={g:t.dataset.g,i:t.dataset.i,k:t.dataset.k,p:t.dataset.p};
  var mv={b:moveBracket,f:moveFfa,d:moveDE,s:moveSW,r:moveRR}[src.t];if(mv&&mv(g,src,dst)){save();render()}
});
$("out").addEventListener("dragend",dzEnd);
var DL=null;
try{if(window.claude&&window.claude.use)window.claude.use("downloads").then(function(d){DL=d}).catch(function(){})}catch(e){}
function bmsg(t){$("bmsg").textContent=t}
function showTa(j){var t=$("bta");t.hidden=false;t.value=j;t.select();bmsg("Copia tutto il testo e salvalo in un file .json.")}
$("backup").onclick=function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.id==="bpwshow"){var pi=$("bpw"),sh=pi.type==="password";pi.type=sh?"text":"password";b.textContent=sh?"Nascondi":"Mostra";b.setAttribute("aria-pressed",String(sh));return}
  if(b.id==="exp"){backupExport();return}
  if(b.id==="exp-old"){
    var json=JSON.stringify(S,null,1);
    if(DL)DL.save({filename:"tornei-fragmarathon-backup.json",data:json}).then(function(){bmsg("Backup salvato.")}).catch(function(err){
      if(err&&err.code==="declined"){bmsg("Salvataggio annullato.");return}
      showTa(json);
    });
    else{try{var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));a.download="tornei-fragmarathon-backup.json";document.body.appendChild(a);a.click();a.remove();bmsg("Backup scaricato nella cartella Download.")}catch(e){showTa(json)}}
  }
  if(b.id==="imp")$("bf").click();
  if(b.id==="tsave")saveTorneo(S.cur);
  if(b.id==="topen"&&DESK)DESK.openFolder("tornei");
  if(b.id==="bopen"&&DESK)DESK.openFolder("backup");
  if(b.id==="tload")$("tf").click();
  if(b.dataset.tres){var f=b.dataset.tres;if(!arm("t"+f,b,"Conferma: riprendi"))return;
    DESK.readTorneo(f).then(function(txt){loadTorneo(txt,f)}).catch(function(){toast("Non riesco a leggere il file.")})}
  /* i backup automatici si ripristinano nel torneo aperto, come quelli da file: istantanea per annullare, migrazione, riepilogo */
  if(b.dataset.bres){var fb=b.dataset.bres;if(!arm("b"+fb,b,"Conferma: ripristina"))return;DESK.readBackup(fb).then(function(t){return restoreDecoded(JSON.parse(t))}).catch(function(e){bmsg((e&&e.message)||"Backup non leggibile.");toast("Non riesco a leggere il backup.")})}
  if(b.dataset.lres!==undefined){var li=+b.dataset.lres;if(!arm("l"+li,b,"Conferma: ripristina"))return;try{var lr=restoreDecoded(JSON.parse(JSON.parse(localStorage.getItem(KEY+"-auto")||"[]")[li].data));if(lr&&lr.catch)lr.catch(function(e){bmsg((e&&e.message)||"Backup non leggibile.")})}catch(e){toast("Backup non leggibile.")}}
};
$("rfile").onchange=function(){var f=this.files[0];if(!f||!window.SHEETS)return;SHEETS.readFile(f).then(importRows).catch(function(e){toast("Non riesco a leggere il file: "+((e&&e.message)||e)+".")});this.value=""};
$("tf").onchange=function(){var f=this.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){loadTorneo(rd.result,null)};rd.readAsText(f);this.value=""};
/* Backup cifrato: tutti i tornei (e i bot) oppure solo quello aperto. */
function backupFile(name,text){
  if(DL)return DL.save({filename:name,data:text}).then(function(){bmsg("Backup salvato: "+name+".")}).catch(function(err){if(err&&err.code==="declined")bmsg("Salvataggio annullato.");else bmsg("Salvataggio non riuscito.")});
  dlBlob(new Blob([text],{type:"application/octet-stream"}),name);bmsg("Backup cifrato scaricato nella cartella Download: "+name+".");
}
function backupExport(){
  var pw=$("bpw").value,all=(document.querySelector('input[name=bwhat]:checked')||{}).value!=="uno",wb=$("bbots")&&$("bbots").checked&&DESK&&DESK.botsExport;
  if(pw.length<6){bmsg("Scrivi una password di almeno 6 caratteri: servirà per riaprire il backup.");$("bpw").focus();return}
  bmsg("Preparo il backup…");
  var data=all&&window.HOME?window.HOME.exportAll():Promise.resolve(null);
  Promise.all([data,wb?DESK.botsExport():null]).then(function(r){
    var o={app:"tornei-fragmarathon",kind:all?"tutti":"torneo",v:1,savedAt:new Date().toISOString(),version:(window.VERSION||{}).v||""};
    if(all)o.events=r[0];else o.state=S;
    if(r[1])o.bots=r[1];
    return CRYPT.encrypt(o,pw).then(function(txt){
      var d=new Date(),p=function(n){return String(n).padStart(2,"0")},nm="tornei-fragmarathon-"+(all?"tutti":String(S.ui.title||"torneo").replace(/[^\w-]+/g,"-").slice(0,40))+"-"+d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+".tfbak";
      backupFile(nm,txt);toast("Backup cifrato pronto"+(all?": "+o.events.length+" tornei":"")+(o.bots?" e "+o.bots.list.length+" bot":"")+".");
    });
  }).catch(function(e){bmsg("Backup non riuscito: "+((e&&e.message)||e))});
}
/* Ripristino di un backup: lo stato viene portato al formato attuale e si prepara il riepilogo.
   migrateState → [etichetta, valore, utente] per i dati che mancavano e hanno preso il valore predefinito;
   diffState → [etichetta, prima, dopo, utente] rispetto al torneo sostituito. "utente" = testo scritto
   dall'organizzatore (nomi, titoli), che non si traduce. Un'etichetta [gioco, campo] ha il gioco come testo utente. */
function gameLabel(st,k){var c=(st.custom||[]).filter(function(x){return x&&x.k===k})[0];return(st.names&&st.names[k])||(c&&c.l)||(ORIGD[k]&&ORIGD[k].l)||k}
function gamesOf(st){var off=st.off||[];return BUILTIN.filter(function(k){return off.indexOf(k)<0}).concat((st.custom||[]).filter(function(c){return c&&c.k}).map(function(c){return c.k}))}
function langName(c){var l=((window.I18N&&I18N.LANGS)||[]).filter(function(x){return x[0]===c})[0];return l?l[1]:""}
function migrateState(st){
  var D=[],d=function(l,v,u){D.push([l,String(v),u?1:0])};
  if(st.v!==2)d("Formato dei dati","aggiornato");
  if(!Array.isArray(st.roster))d("Elenco giocatori","vuoto");
  if(!Array.isArray(st.teams))d("Squadre","nessuna");
  if(!st.ui||typeof st.ui!=="object")st.ui={};
  if(!st.ui.title)d("Titolo",UI0.title,1);
  if(!st.ev||typeof st.ev!=="object")st.ev={};
  if(!st.disc||typeof st.disc!=="object"){st.disc={};d("Account Discord dei giocatori","nessuno")}
  if(!Object.keys(st.games||{}).some(function(k){return st.games[k]&&st.games[k].cfg}))d("Archivio configurazioni dei server","vuoto");
  if(!langName(st.ev.lang)){d("Lingua del torneo",langName("it")||"Italiano",1);st.ev.lang="it"}
  if(!st.ev.mode){d("Tipo di evento","LAN party");st.ev.mode="lan"}
  if(!st.games||typeof st.games!=="object")st.games={};
  if(!Array.isArray(st.custom))st.custom=[];
  gamesOf(st).forEach(function(k){if(!st.games[k])d("Gioco aggiunto vuoto",gameLabel(st,k),1)});
  Object.keys(st.games).forEach(function(k){var g=st.games[k];if(g&&(g.mode==="gironi"||g.mode==="solo"))d(g.phase&&g.phase!=="setup"?"Formato vecchio convertito in free for all, tabellone da rifare":"Formato vecchio convertito in free for all",gameLabel(st,k),1)});
  if(st.sala&&typeof st.sala==="object"){
    var x=st.sala;
    if(!Array.isArray(x.items)){x.items=[];d("Mappa della sala","nessun oggetto")}
    if(!x.st||typeof x.st!=="object"){x.st={};d("Mappa della sala","nessuna postazione assegnata")}
    if(!x.wifi||typeof x.wifi!=="object"){x.wifi={ssid:"",pass:"",sec:"WPA"};d("Mappa della sala","Wi-Fi da impostare")}
    if(!Array.isArray(x.servers)){x.servers=[];d("Mappa della sala","nessun server")}
    if(!x.w)x.w=24;if(!x.h)x.h=16;if(!x.seq)x.seq=1;
  }
  /* server sugli incontri che non esistono più nella sala */
  var sv={};((st.sala&&st.sala.servers)||[]).forEach(function(s){if(s)sv[s.id]=1});
  Object.keys(st.games).forEach(function(k){var g=st.games[k];if(!g||!g.srv||typeof g.srv!=="object")return;var n=0;
    Object.keys(g.srv).forEach(function(m){if(!sv[g.srv[m]]){delete g.srv[m];n++}});
    if(n)D.push([[gameLabel(st,k),"Server tolti dagli incontri perché non sono più nella sala"],String(n),0])});
  var keep=swapIn(st);try{fixCur()}finally{swapOut(keep)}
  return D;
}
function diffState(a,b){
  var R=[],yn=function(v){return v?"sì":"no"},EVM={lan:"LAN party",online:"Online"},
    q=function(l,x,y,u){x=x==null?"":String(x);y=y==null?"":String(y);if(x!==y)R.push([l,x||"—",y||"—",u?1:0])},
    bot=function(id){var b=(window.__bots||[]).filter(function(x){return x.id===id})[0];return id?(b?b.label:id):""},
    list=function(v){return v.slice(0,12).join(", ")+(v.length>12?" (+"+(v.length-12)+")":"")};
  var au=a.ui||{},bu=b.ui||{},ae=a.ev||{},be=b.ev||{};
  q("Titolo",au.title||UI0.title,bu.title||UI0.title,1);q("Sottotitolo",au.sub,bu.sub,1);
  q("Data",ae.date,be.date,1);q("Ora",ae.time,be.time,1);q("Luogo",ae.place,be.place,1);q("Indirizzo",ae.addr,be.addr,1);q("Link Google Maps",ae.maps,be.maps,1);
  q("Lingua del torneo",langName(ae.lang||"it"),langName(be.lang||"it"),1);q("Tipo di evento",EVM[ae.mode||"lan"]||ae.mode,EVM[be.mode||"lan"]||be.mode);
  q("Gruppo WhatsApp",ae.wa,be.wa,1);q("Gruppo o canale Telegram",ae.tg,be.tg,1);q("Server Discord (invito)",ae.discord,be.discord,1);q("Server TeamSpeak",ae.ts,be.ts,1);q("Password di TeamSpeak",ae.tspass?"••••":"",be.tspass?"••••":"",0);
  q("Account Discord dei giocatori",Object.keys(a.disc||{}).length,Object.keys(b.disc||{}).length);q("Canali Discord per partita",yn(ae.dchan),yn(be.dchan));
  q("In lavorazione, visibile solo agli admin",yn(ae.draft),yn(be.draft));q("Bot del torneo",bot(ae.bot),bot(be.bot),1);
  var ar=a.roster||[],br=b.roster||[],pa=br.filter(function(x){return ar.indexOf(x)<0}),pr=ar.filter(function(x){return br.indexOf(x)<0});
  q("Giocatori",ar.length,br.length);if(pa.length)R.push(["Giocatori in più","",list(pa),1]);if(pr.length)R.push(["Giocatori in meno",list(pr),"",1]);
  q("Squadre",(a.teams||[]).length,(b.teams||[]).length);
  var ag=gamesOf(a),bg=gamesOf(b),ML={};MODES.forEach(function(m){ML[m[0]]=m[1]});
  bg.forEach(function(k){if(ag.indexOf(k)<0)R.push(["Gioco in più","",gameLabel(b,k),1])});
  ag.forEach(function(k){if(bg.indexOf(k)<0)R.push(["Gioco in meno",gameLabel(a,k),"",1])});
  bg.forEach(function(k){var ga=(a.games||{})[k],gb=(b.games||{})[k];if(ag.indexOf(k)<0||!ga||!gb)return;var L=gameLabel(b,k);
    q([L,"Formato"],ML[ga.mode]||ga.mode,ML[gb.mode]||gb.mode);q([L,"Stato"],ga.phase==="setup"?"in preparazione":"avviato",gb.phase==="setup"?"in preparazione":"avviato");
    q([L,"Partecipanti"],(ga.players||[]).length,(gb.players||[]).length);q([L,"A squadre"],yn(ga.team),yn(gb.team));
    q([L,"Server assegnati agli incontri"],Object.keys(ga.srv||{}).length,Object.keys(gb.srv||{}).length);
    q([L,"File di configurazione"],((ga.cfg||{}).files||[]).map(function(f){return f.n}).join(", "),((gb.cfg||{}).files||[]).map(function(f){return f.n}).join(", "),1);
    q([L,"Impostazioni del server"],((ga.cfg||{}).set||[]).length,((gb.cfg||{}).set||[]).length)});
  var sa=a.sala||{},sb=b.sala||{},seats=function(x){return Object.keys(x.st||{}).filter(function(k){return x.st[k]&&x.st[k].player}).length};
  if(a.sala||b.sala){q("Oggetti nella mappa della sala",(sa.items||[]).length,(sb.items||[]).length);q("Postazioni assegnate",seats(sa),seats(sb));
    q("Server di gioco",(sa.servers||[]).map(function(s){return s.name}).join(", "),(sb.servers||[]).map(function(s){return s.name}).join(", "),1);q("Wi-Fi della sala",(sa.wifi||{}).ssid,(sb.wifi||{}).ssid,1)}
  return R;
}
/* riepilogo del ripristino: blocchi {name, kind, status, why, defaults, diffs} */
function restoreReport(o,blocks){
  var el=$("brep");if(!el)return;var e=function(s){return esc(String(s))},
    sp=function(t,u){return'<span'+(u?' data-noi18n':'')+'>'+e(t)+'</span>'},
    lab=function(l){return Array.isArray(l)?'<b data-noi18n>'+e(l[0])+'</b> › '+sp(l[1]):sp(l)},
    ST={nuovo:"nuovo",sostituito:"sostituito",saltato:"saltato"},h="";
  var bv=(o&&o.version)||"",nv=(window.VERSION||{}).v||"";
  h+='<p class="brep-v">'+sp("Versione del backup")+' <b data-noi18n>'+e(bv||"?")+'</b>, '+sp("versione attuale")+' <b data-noi18n>'+e(nv)+'</b>'+(o&&o.savedAt?', '+sp("salvato il")+' <b data-noi18n>'+e(String(o.savedAt).slice(0,16).replace("T"," "))+'</b>':'')+'</p>';
  if(bv&&nv&&bv!==nv)h+='<p class="brep-v">'+sp("Il backup è di un'altra versione: i dati sono stati controllati e portati al formato attuale.")+'</p>';
  var nd=0,nf=0;
  blocks.forEach(function(b){
    var D=b.defaults||[],F=b.diffs||[];nd+=D.length;nf+=F.length;
    h+='<details class="brep-b"'+(D.length||F.length||b.why?' open':'')+'><summary>'+sp(b.kind)+' <b data-noi18n>'+e(b.name)+'</b> <span class="brep-s brep-'+b.status+'">'+e(ST[b.status]||b.status)+'</span>'+
      (D.length?' <span class="brep-c">'+D.length+'</span> '+sp(D.length>1?"valori predefiniti":"valore predefinito"):'')+(F.length?' <span class="brep-c">'+F.length+'</span> '+sp(F.length>1?"differenze":"differenza"):'')+'</summary>';
    if(b.why)h+='<p>'+sp(b.why)+'</p>';
    if(D.length)h+='<h5>'+sp("Mancavano nel backup: messo il valore predefinito")+'</h5><ul>'+D.map(function(x){return'<li>'+lab(x[0])+': '+sp(x[1],x[2])+'</li>'}).join("")+'</ul>';
    if(F.length)h+='<h5>'+sp("Differenze rispetto a prima del ripristino")+'</h5><ul>'+F.map(function(x){return'<li>'+lab(x[0])+': '+(x[1]?sp(x[1],x[3]):'')+(x[1]&&x[2]?' <span class="brep-ar">→</span> ':'')+(x[2]?sp(x[2],x[3]):'')+'</li>'}).join("")+'</ul>';
    if(!D.length&&!F.length&&!b.why)h+='<p>'+sp(b.status==="nuovo"?"Non c'era prima: aggiunto così com'è nel backup.":"Nessuna differenza e nessun valore mancante.")+'</p>';
    h+='</details>';
  });
  el.innerHTML=h;el.hidden=false;
  if(DESK&&DESK.logError)DESK.logError("ripristino",blocks.map(function(b){return b.kind+" "+b.name+": "+b.status+", "+(b.defaults||[]).length+" valori predefiniti, "+(b.diffs||[]).length+" differenze"}).join("; "));
  return{nd:nd,nf:nf};
}
/* il bot dell'evento (anche quello appena ripristinato) va detto a main, come fa la Home quando apre un torneo;
   dopo l'import dei bot del backup, così il bot esiste già */
function botSync(){if(!DESK||!DESK.botsUse)return Promise.resolve();return DESK.botsUse((S.ev&&S.ev.bot)||"").then(function(){botRefresh();botPickFill();botPush()}).catch(function(){})}
function botsRestored(o){
  if(!(o&&o.bots&&DESK&&DESK.botsImport))return Promise.resolve([]);
  return DESK.botsImport(o.bots).then(function(r){return((r&&r.report)||[]).map(function(x){return{kind:"Bot",name:x.label,status:x.status,why:x.why,defaults:x.defaults,diffs:x.diffs}})}).catch(function(){return[]});
}
function restoreDecoded(o){
  if(o&&o.kind==="tutti"&&Array.isArray(o.events)){
    if(!window.HOME){bmsg("Questo backup contiene più tornei: aprilo dall'app.");return}
    return window.HOME.importAll(o.events).then(function(r){
      return botsRestored(o).then(function(br){
        if(!$("editbox").hidden)renderEdit();var t=restoreReport(o,r.rep.concat(br));
        bmsg("Ripristinati "+r.n+" tornei"+(o.bots?" e "+o.bots.list.length+" bot":"")+(DESK?". Quelli sostituiti sono nel cestino. Sotto trovi cosa è cambiato.":". Sotto trovi cosa è cambiato."));
        toast(t.nd||t.nf?"Backup ripristinato: il riepilogo è sotto il pulsante Ripristina.":"Backup ripristinato.");
      });
    });
  }
  var p=o&&o.kind==="torneo"?o.state:o;
  if(!p||!p.games||typeof p.games!=="object"||Array.isArray(p.games)||(p.roster&&!Array.isArray(p.roster))||(p.teams&&!Array.isArray(p.teams)))throw new Error("file non valido");
  delSnap("dati prima del ripristino");var id=S.ev&&S.ev.id,old=JSON.parse(JSON.stringify(S));
  var D=migrateState(p),F=diffState(old,p);
  S=p;initS();if(id){S.ev=S.ev||{};S.ev.id=id}registerCustom();normGames();applyUi();
  /* lastStat: gli stati dei giochi ripristinati non sono "cambiamenti" da cui fare backup automatici */
  fixCur();lastStat=statusMap();save();render();renderRoster();
  /* il modulo delle Impostazioni mostrava i dati di prima: si ricarica, così Salva non li riscrive */
  if(!$("editbox").hidden)renderEdit();
  return botsRestored(o&&o.kind?o:null).then(function(br){
    botSync();
    var t=restoreReport(o&&o.kind?o:{},[{kind:"Torneo",name:S.ui.title||UI0.title,status:"sostituito",defaults:D,diffs:F}].concat(br));
    bmsg("Backup ripristinato nel torneo aperto. Sotto trovi cosa è cambiato.");toast(t.nd||t.nf?"Backup ripristinato: il riepilogo è sotto il pulsante Ripristina.":"Backup ripristinato.");
  });
}
$("bf").onchange=function(){
  var f=this.files[0];if(!f)return;var rd=new FileReader();
  rd.onload=function(){
    var txt=rd.result;
    if(CRYPT.isEnc(txt)){
      var pw=$("bpw").value;if(!pw){bmsg("Il backup è cifrato: scrivi la password qui sopra e premi di nuovo Ripristina.");$("bpw").focus();return}
      bmsg("Apro il backup…");
      CRYPT.decrypt(txt,pw).then(restoreDecoded).catch(function(e){bmsg((e&&e.message)||"Backup non leggibile.");if(DESK&&DESK.logError)DESK.logError("ripristino",String(e&&e.stack||e))});
      return;
    }
    try{
      var p=JSON.parse(txt),r=restoreDecoded(p);if(r&&r.catch)r.catch(function(e){bmsg((e&&e.message)||"Backup non leggibile.")});
    }catch(e){bmsg("File non valido: scegli un backup esportato da questa pagina.")}
  };
  rd.readAsText(f);this.value="";
};
function fitProj(){
  var on=document.body.classList.contains("proj");
  document.documentElement.style.setProperty("--ps",Math.min(innerWidth/1920,innerHeight/1080));
  ["out","resbox","sqbox","hofbox","rosterBox"].forEach(function(id){
    var c=$(id);if(!c)return;
    if(!on||c.hidden){c.style.cssText="";return}
    var tb=$("tabs"),top=tb.offsetTop+tb.offsetHeight+14,aw=1856,ah=1080-top-22;
    c.style.cssText="position:absolute;left:32px;top:"+top+"px;transform-origin:0 0";
    for(var k=2.4;k>=0.3;k-=0.05){
      c.style.width=(aw/k)+"px";c.style.transform="scale("+k+")";
      if(c.scrollHeight*k<=ah&&c.scrollWidth<=c.clientWidth+1)break;
    }
  });
}
/* ======================================================================
   Formati aggiuntivi: doppia eliminazione, svizzero, gironi all'italiana
   (la logica pura è in js/formats.js, qui solo stato e interfaccia)
   ====================================================================== */

var calcOpen=false;
/* ======================================================================
   Calcolo dei punti: formule per torneo (motore in js/formats.js)
   g.calc = {fields:[{k,l}], ffa:"...", rank:"...", hof:"..."}
   ====================================================================== */
var CALC_DEF={ffa:"punti",rank:"3*vinta + pareggio",hof:"punti"};
var CALC_PRE={
  ffa:[["Punti inseriti (semplice)",[["punti","Punti"]],"punti"],
       ["Battle royale: piazzamento + uccisioni",[["pos","Posizione"],["kill","Uccisioni"]],"tabella(pos; 12; 9; 7; 5; 4; 3; 3; 2; 2; 2; 1; 1; 1; 1; 1) + kill"],
       ["Corse: punti stile Formula 1",[["pos","Posizione"]],"tabella(pos; 25; 18; 15; 12; 10; 8; 6; 4; 2; 1)"],
       ["Uccisioni e morti",[["kill","Uccisioni"],["morti","Morti"]],"max(0; kill*2 - morti)"],
       ["Uccisioni, assist e morti",[["kill","Uccisioni"],["assist","Assist"],["morti","Morti"]],"max(0; kill*2 + assist - morti)"]],
  rank:[["Vittoria 3, pareggio 1 (calcio)","3*vinta + pareggio"],["Vittoria 2, pareggio 1","2*vinta + pareggio"],["Contano solo le vittorie","vinta"],["Vittoria con 3+ di scarto vale 4","vinta*(diff >= 3 ? 4 : 3) + pareggio"],["Punti fatti in partita","punti"]],
  hof:[["Punti fatti in partita","punti"],["Vittorie × 10 + punti fatti","vinta*10 + punti"],["Differenza punti (mai sotto zero)","max(0; diff)"]]
};
function calcOf(g){return g&&g.calc||{}}
function ffaFields(g){var f=calcOf(g).fields;return f&&f.length?f:[{k:"punti",l:"Punti"}]}
function fxSafe(src,al){try{return TF.fxCompile(src,al)}catch(e){return null}}
function rankFx(g){var c=calcOf(g);return c.rank&&c.rank!==CALC_DEF.rank?fxSafe(c.rank,TF.FX_MATCH_VARS):null}
function hofFx(g){var c=calcOf(g);return c.hof&&c.hof!==CALC_DEF.hof?fxSafe(c.hof,TF.FX_MATCH_VARS):null}
function ffaFx(g){var c=calcOf(g),f=ffaFields(g);if(!c.ffa||(f.length===1&&f[0].k==="punti"&&c.ffa===CALC_DEF.ffa))return null;return fxSafe(c.ffa,f.map(function(x){return x.k}))}
/* FFA con formula: i valori grezzi stanno in gr.v[nome][campo], il punteggio calcolato in gr.s[nome] */
function ffaScore(g,gr,n){
  var fx=ffaFx(g),v=(gr.v||{})[n];if(!fx||!v)return gr.s[n];
  var full=ffaFields(g).every(function(f){return v[f.k]!=null});
  return full?fx.run(v):null;
}
function ffaHasV(g){return!!(g.ffa&&g.ffa.rounds.some(function(rd){return rd.groups.some(function(gr){return gr.v&&Object.keys(gr.v).length})}))}
function ffaRecalc(g){
  if(!g.ffa)return;var fx=ffaFx(g);
  g.ffa.rounds.forEach(function(rd){rd.groups.forEach(function(gr){
    if(!gr.v)return;
    Object.keys(gr.v).forEach(function(n){if(fx)gr.s[n]=ffaScore(g,gr,n);else if(gr.v[n].punti!=null)gr.s[n]=gr.v[n].punti})})});
}
function calcKey(l){
  var k=String(l||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,"").replace(/^(\d)/,"c$1");
  return k||"campo";
}
function calcVarsList(g){return g.mode==="ffa"?ffaFields(g).map(function(f){return f.k}):TF.FX_MATCH_VARS}
function calcTest(src,al,sample){try{var fx=TF.fxCompile(src,al);return{ok:true,v:fx.run(sample)}}catch(e){return{ok:false,msg:e.message}}}
/* Ricalcolo: le classifiche si rifanno da sole, ma le fasi già generate (turno successivo del
   free for all, playoff) restano quelle decise con la formula vecchia. calcImpact() le confronta
   con quello che darebbe la formula attuale. */
function setDiff(a,b){return a.filter(function(x){return b.indexOf(x)<0})}
function bracketNames(R){var o=[];(R&&R[0]||[]).forEach(function(m){if(m.a)o.push(m.a);if(m.b)o.push(m.b)});return o}
function calcImpact(g){
  var exp,act,where;
  if(g.ffa){
    var F=g.ffa;
    for(var r=0;r<F.rounds.length-1;r++){
      exp=[];F.rounds[r].groups.forEach(function(gr){var e=gEval(gr,false,F.adv);if(e.ok)e.adv.forEach(function(n){exp.push(n)})});
      act=[];F.rounds[r+1].groups.forEach(function(gr){gr.p.forEach(function(n){act.push(n)})});
      if(setDiff(exp,act).length||setDiff(act,exp).length)return{kind:"ffa",r:r,add:setDiff(exp,act),drop:setDiff(act,exp),where:"Turno "+(r+1)};
    }
    return null;
  }
  if(g.rounds&&(g.groups||g.sw)){
    exp=g.groups?qualifiers(g):TF.swStandings(g.players,g.sw.rounds,rankFx(g)).slice(0,g.sw.top).map(function(x){return x.n});
    act=bracketNames(g.rounds);where=g.groups?"gironi":"svizzero";
    if(setDiff(exp,act).length||setDiff(act,exp).length)return{kind:g.groups?"rr":"sw",add:setDiff(exp,act),drop:setDiff(act,exp),where:where};
  }
  return null;
}
function calcRegen(g){
  var im=calcImpact(g);if(!im)return;
  autoBackup(DEF[S.cur].l+" - prima del ricalcolo");
  if(im.kind==="ffa"){g.ffa.rounds=g.ffa.rounds.slice(0,im.r+1);shufArm=null;nextRound(g);toast("Turni rigenerati dal Turno "+(im.r+2)+" con la nuova formula.");return}
  if(im.kind==="rr")finals(g);
  else{g.rounds=bracket(TF.swStandings(g.players,g.sw.rounds,rankFx(g)).slice(0,g.sw.top).map(function(x){return x.n}));g.phase="final";syncThird(g)}
  save();render();toast("Playoff rigenerati con la nuova formula.");
}
function calcRecalc(g){
  ffaRecalc(g);save();render();
  var im=calcImpact(g);
  toast(im?"Punteggi ricalcolati. Attenzione: con la nuova formula cambiano i qualificati ("+im.where+"), vedi Calcolo dei punti.":"Punteggi e classifiche ricalcolati: i qualificati non cambiano.");
}
function renderImpact(g){
  var im=calcImpact(g);if(!im)return"";
  var list=function(a){return a.map(esc).join(", ")||"nessuno"};
  return'<div class="impact" role="alert"><b>La formula è cambiata e i qualificati non tornano più.</b> '
   +(im.kind==="ffa"?'Dal '+im.where+' con la formula attuale passerebbero anche: '+list(im.add)+'; non passerebbero: '+list(im.drop)+'.':'Con la formula attuale andrebbero ai playoff anche: '+list(im.add)+'; resterebbero fuori: '+list(im.drop)+'.')
   +'<div class="row" style="margin-top:8px"><button class="p" id="cfregen">'+(ARMS.regen?"Conferma: rigenera":(im.kind==="ffa"?"Rigenera i turni dopo il "+im.where:"Rigenera i playoff"))+'</button><span class="hint" style="margin:0">'+(im.kind==="ffa"?"I turni successivi vengono rifatti e i loro punteggi azzerati.":"Il tabellone dei playoff viene rifatto e i suoi risultati azzerati.")+' Prima viene fatto un backup automatico.</span></div></div>';
}
function renderCalc(g,lock){
  var c=calcOf(g),h=(g.phase!=="setup"?renderImpact(g):"")+'<details class="calc"'+(calcOpen?" open":"")+'><summary>Calcolo dei punti</summary>';
  if(g.mode==="ffa"){
    var F=ffaFields(g),src=c.ffa||CALC_DEF.ffa,sample={};F.forEach(function(f,i){sample[f.k]=i?3:2});
    var t=calcTest(src,F.map(function(f){return f.k}),sample);
    h+='<p class="hint">In ogni girone inserisci questi valori per ogni partecipante; la formula li trasforma nel punteggio che decide la classifica e la Hall of Fame.</p>'
     +'<div class="row"><label class="row" style="gap:6px">Modello <select class="cpre" data-w="ffa"'+(lock||ffaHasV(g)?" disabled":"")+'><option value="">Scegli…</option>'+CALC_PRE.ffa.map(function(p,i){return'<option value="'+i+'">'+p[0]+'</option>'}).join("")+'</select></label></div>'
     +'<div class="cfields">'+F.map(function(f,i){return'<span class="chip"><b>'+esc(f.k)+'</b>'+(f.l&&f.l!==f.k?' '+esc(f.l):'')+(F.length>1&&!lock?'<button class="cfdel" data-i="'+i+'" aria-label="Rimuovi il campo '+esc(f.l||f.k)+'">×</button>':'')+'</span>'}).join("")
     +(F.length<5&&!lock?'<input type="text" id="cfnew" placeholder="Nuovo campo (es. Uccisioni)" aria-label="Nome del nuovo campo"><button id="cfadd">Aggiungi campo</button>':'')+'</div>'
     +(lock?'<p class="hint">I campi si cambiano con il torneo in pausa; la formula si può cambiare sempre.</p>':ffaHasV(g)?'<p class="hint">Con i punteggi già inseriti il modello non si cambia più; un campo aggiunto vale 0 nei punteggi già inseriti.</p>':'')
     +'<label class="cfx">Formula del punteggio <input type="text" id="cfffa" spellcheck="false" value="'+esc(src)+'"></label>'
     +'<p class="cres '+(t.ok?'ok':'err')+'" id="cfffa-r">'+(t.ok?'Esempio con '+F.map(function(f){return esc(f.k)+' = '+sample[f.k]}).join(", ")+': '+t.v+' punti':esc(t.msg))+'</p>';
  }else{
    var mv="Variabili: punti (fatti), avversario (subiti), diff, vinta, pareggio, persa (1 o 0)"+(g.mode==="swiss"?", bye (riposo)":"")+".";
    if(g.mode==="rr"||g.mode==="swiss"){
      var r1=c.rank||CALC_DEF.rank,t1=calcTest(r1,TF.FX_MATCH_VARS,TF.fxMatchVars(3,1));
      h+='<label class="cfx">Punti in classifica per ogni partita <input type="text" id="cfrank" spellcheck="false" value="'+esc(r1)+'"></label>'
       +'<div class="row"><label class="row" style="gap:6px">Modello <select class="cpre" data-w="rank"><option value="">Scegli…</option>'+CALC_PRE.rank.map(function(p,i){return'<option value="'+i+'">'+p[0]+'</option>'}).join("")+'</select></label></div>'
       +'<p class="cres '+(t1.ok?'ok':'err')+'" id="cfrank-r">'+(t1.ok?'Esempio, vittoria 3 a 1: '+t1.v+' punti':esc(t1.msg))+'</p>';
    }
    var r2=c.hof||CALC_DEF.hof,t2=calcTest(r2,TF.FX_MATCH_VARS,TF.fxMatchVars(3,1));
    h+='<label class="cfx">Punti per la Hall of Fame per ogni partita <input type="text" id="cfhof" spellcheck="false" value="'+esc(r2)+'"></label>'
     +'<div class="row"><label class="row" style="gap:6px">Modello <select class="cpre" data-w="hof"><option value="">Scegli…</option>'+CALC_PRE.hof.map(function(p,i){return'<option value="'+i+'">'+p[0]+'</option>'}).join("")+'</select></label></div>'
     +'<p class="cres '+(t2.ok?'ok':'err')+'" id="cfhof-r">'+(t2.ok?'Esempio, vittoria 3 a 1: '+t2.v+' punti':esc(t2.msg))+'</p><p class="hint">'+mv+'</p>';
  }
  if(g.phase!=="setup")h+='<div class="row" style="margin-top:10px"><button id="cfrecalc">Ricalcola punteggi e classifiche</button><span class="hint" style="margin:0">Applica le formule a tutti i risultati già inseriti.</span></div>';
  h+='<p class="hint">Operatori + − * / ^ e confronti (&gt;= ecc.), condizione ? a : b, funzioni min, max, abs, arrotonda, giu, su, se(c; a; b), tabella(n; v1; v2; …). Guida completa con F1.</p></details>';
  return h;
}
function calcSet(g,key,src){
  var al=key==="ffa"?ffaFields(g).map(function(f){return f.k}):TF.FX_MATCH_VARS;
  try{TF.fxCompile(src,al)}catch(e){toast("Formula non salvata: "+e.message);return false}
  g.calc=g.calc||{};g.calc[key]=src.trim();calcRecalc(g);return true;
}

var SKINS=[["auto","Automatico: tema del gioco"],["frag","Fragmarathon"],["-","Ispirati alle piattaforme"],["chiaro","Bracket chiaro (stile Challonge)"],["notte","Arena notturna (stile start.gg)"],["lega","Lega pro (stile ESL)"],["wiki","Wiki (stile Liquipedia)"],["neon","Neon (stile Battlefy)"],["-","Temi dei giochi"],["quake","Quake: lava e metallo"],["tf2","Team Fortress 2: retrò"],["wreck","Wreckfest: cantiere"],["cs2","Counter-Strike 2: tattico"],["fifa","FIFA: campo da calcio"]];
var GAMESKIN={quake:"quake",tf2:"tf2",wreck:"wreck",cs2:"cs2",fifa:"fifa"};
function skinOpts(cur){var o="",grp=false;SKINS.forEach(function(s){if(s[0]==="-"){o+=(grp?"</optgroup>":"")+'<optgroup label="'+s[1]+'">';grp=true;return}o+='<option value="'+s[0]+'"'+(cur===s[0]?" selected":"")+'>'+s[1]+'</option>'});return o+(grp?"</optgroup>":"")}
function applySkin(){var sk=(S.ui&&S.ui.skin)||"auto",eff=sk==="auto"?(GAMESKIN[S.cur]||"frag"):sk,r=document.documentElement;if(eff==="frag")r.removeAttribute("data-skin");else r.setAttribute("data-skin",eff)}
var MODES=[["ffa","Free for all a punti (battle royale)"],["elim","Eliminazione diretta"],["double","Doppia eliminazione (winner + loser bracket)"],["swiss","Sistema svizzero + playoff"],["rr","Gironi all'italiana + playoff"]];
function modeOpts(cur){return MODES.map(function(m){return'<option value="'+m[0]+'"'+(cur===m[0]?" selected":"")+'>'+m[1]+'</option>'}).join("")}
function isTeam(g,k){return g.team!==undefined?g.team:!!DEF[k||S.cur].t}
function letter(i){return String.fromCharCode(65+i)}
function hasRes(m){return m.sa!=null||m.sb!=null||(m.w!=null&&m.w!==undefined)}
function scoreVal(v){if(v===""||v==null)return null;var n=Math.max(0,parseInt(v,10));return isNaN(n)?null:n}

/* --- gironi all'italiana --- */
function rrNoPO(g){return(g.nq||0)<2}
function rrGroups(g){
  var n=g.players.length,ng=Math.max(1,Math.min(g.ng||1,Math.floor(n/2))),gr=[],i;
  for(i=0;i<ng;i++)gr.push({players:[],matches:[]});
  shuffle(g.players).forEach(function(p,j){gr[j%ng].players.push(p)});
  gr.forEach(function(x){x.matches=TF.rrMatches(x.players)});
  return gr;
}

/* --- doppia eliminazione --- */
function deState(g){var st=TF.deBuild(g.de.seeds.length);while(g.de.seeds.length<st.P)g.de.seeds.push(null);return{st:st,ev:TF.deEval(st,g.de.seeds,g.de.res,g.deReset!==false)}}
function deFree(D,i){
  var ids=["W0-"+i,"W1-"+(i>>1),"L0-"+(i>>1)];
  return ids.every(function(id){var m=D.ev.M[id];return!m||!(m.sa!=null||m.sb!=null||(m.ready&&m.w!==undefined))});
}
function deSlot(g,D,m,k){
  var n=m[k],o=m[k==="a"?"b":"a"],sk=k==="a"?"sa":"sb",w0=/^W0-/.test(m.id),idx=w0?+m.id.slice(3):-1,mv=w0&&deFree(D,idx);
  var dz=mv?' data-dz="d" data-i="'+idx+'" data-k="'+k+'"'+(n?' data-p="'+esc(n)+'"':''):'';
  if(n===undefined)return'<div class="srow"><button class="slot" disabled><span class="tbd">Da definire</span></button></div>';
  if(n===null)return'<div class="srow"'+dz+'><button class="slot" disabled><span class="tbd">'+(typeof o==="string"?"Passa il turno":"—")+'</span></button></div>';
  var c=m.ready&&m.w!==undefined?(m.w===n?"w":"l"):"",v=m[sk];
  return'<div class="srow"'+dz+'>'+(mv?GRIP:'')+'<button class="slot '+c+'" data-de="'+m.id+'" data-n="'+esc(n)+'"'+(m.ready?"":" disabled")+'><span>'+esc(n)+sub(n)+'</span>'+(m.ready&&m.w===n?"<span>✓</span>":"")+'</button>'
   +(m.ready?'<input type="number" min="0" class="ds" data-id="'+m.id+'" data-s="'+sk+'" aria-label="Punteggio '+esc(n)+'" value="'+(v==null?"":esc(v))+'">':'')+'</div>';
}
function renderDE(g){
  var D=deState(g),st=D.st,E=D.ev,h="";
  if(E.done)h+=ffaPodium(g,E.top);
  function cols(rounds,name){
    var o="";
    rounds.forEach(function(rd,r){
      var cards=rd.map(function(x){return E.M[x.id]}).filter(function(m){return!(m.a===null&&m.b===null)});
      if(!cards.length)return;
      o+='<div class="round"><h3>'+name(r,rounds.length)+'</h3>';
      cards.forEach(function(m){var mid=Object.keys(E.M).filter(function(k){return E.M[k]===m})[0]||"";o+='<div class="match">'+(m.a&&m.b?srvSel(g,"d"+mid):"")+deSlot(g,D,m,"a")+deSlot(g,D,m,"b")+'</div>'});
      o+='</div>';
    });
    return o;
  }
  h+='<section class="panel"><h2>Tabellone vincenti (winner bracket)'+helpBtn("double")+'</h2><div class="bracket">'+cols(st.WB,function(r,t){return r===t-1?"Finale vincenti":roundName(r,t)})+'</div></section>';
  if(st.LB.length)h+='<section class="panel"><h2>Tabellone perdenti (loser bracket)</h2><div class="bracket">'+cols(st.LB,function(r,t){return r===t-1?"Finale perdenti":"Perdenti, turno "+(r+1)})+'</div></section>';
  h+='<section class="panel"><h2>Finale (grand final)</h2><div class="bracket"><div class="round"><h3>Finale</h3><div class="match">'+srvSel(g,"dGF")+deSlot(g,D,E.gf,"a")+deSlot(g,D,E.gf,"b")+'</div></div>'
   +(E.gf2?'<div class="round"><h3>Bella (bracket reset)</h3><div class="match">'+srvSel(g,"dGF2")+deSlot(g,D,E.gf2,"a")+deSlot(g,D,E.gf2,"b")+'</div></div>':'')+'</div>'
   +'<p class="hint">Inserisci i punteggi: vince il più alto. Chi perde nel tabellone vincenti scende nel tabellone perdenti; alla seconda sconfitta si esce. Finché una partita del primo turno non ha risultati, trascina ⠿ per scambiare i partecipanti.</p></section>';
  return h;
}
function moveDE(g,src,dst){
  var D=deState(g),si=+src.i,di=+dst.i;
  if(si===di&&src.k===dst.k)return false;
  if(!deFree(D,si)||!deFree(D,di)){toast("Si possono spostare solo i partecipanti di partite del primo turno senza risultati.");return false}
  var A=D.st.WB[0][si][src.k].s,B=D.st.WB[0][di][dst.k].s,S0=g.de.seeds,x=S0[A];S0[A]=S0[B];S0[B]=x;
  var bad=D.st.WB[0].some(function(m){return S0[m.a.s]==null&&S0[m.b.s]==null});
  if(bad){S0[B]=S0[A];S0[A]=x;toast("Ogni partita del primo turno deve avere almeno un partecipante.");return false}
  return true;
}

/* --- sistema svizzero --- */
function swFinished(W){var cur=W.rounds[W.rounds.length-1];return W.rounds.length>=W.nr&&cur.every(TF.swDone)}
function renderSW(g){
  var W=g.sw,team=isTeam(g),rf=rankFx(g),st=TF.swStandings(g.players,W.rounds,rf),byeP=rf?rf.run({vinta:1,bye:1}):3,h="",li=W.rounds.length-1,cur=W.rounds[li],done=cur.every(TF.swDone),fin=swFinished(W),po=W.top>=2;
  if(fin&&!po)h+=ffaPodium(g,st.slice(0,3).map(function(x){return x.n}));
  h+='<section class="panel"><h2>Classifica svizzero'+helpBtn("swiss")+'</h2><table class="res sw"><tr><th>Pos.</th><th>'+(team?"Squadra":"Giocatore")+'</th><th title="Vinte">V</th><th title="Pareggiate">N</th><th title="Perse">P</th><th title="Buchholz: somma dei punti degli avversari affrontati">Buchholz</th><th title="Differenza punti">DR</th><th>Pt</th></tr>';
  st.forEach(function(t,i){h+='<tr'+(po&&i<W.top?' class="q"':'')+'><td>'+(i+1)+'º</td><td>'+(team?tico(t.n,18):"")+esc(t.n)+sub(t.n)+'</td><td>'+t.w+'</td><td>'+t.d+'</td><td>'+t.l+'</td><td>'+t.buch+'</td><td>'+(t.sf-t.ss>0?"+":"")+(t.sf-t.ss)+'</td><td><b>'+t.pts+'</b></td></tr>'});
  h+='</table>'+(po?'<p class="hint">Evidenziati: i primi '+W.top+', che vanno ai playoff.</p>':'')+'</section>';
  for(var r=li;r>=0;r--){
    var rd=W.rounds[r],last=r===li&&!g.rounds;
    h+='<section class="panel"><h2>Turno '+(r+1)+' di '+esc(W.nr)+'</h2><div class="swm">';
    rd.forEach(function(m,i){
      var free=last&&!hasRes(m),dz=function(k){return free&&m[k]?' data-dz="s" data-i="'+i+'" data-k="'+k+'" data-p="'+esc(m[k])+'"':''};
      if(m.b===null){h+='<div class="mt bye"'+dz("a")+'><span>'+(free?GRIP:'')+esc(m.a)+'</span><span class="hint" style="margin:0">riposa: vittoria a tavolino (+'+byeP+')</span></div>';return}
      var ca=m.w==null?"":m.w==="="?"d":m.w===m.a?"w":"l",cb=m.w==null?"":m.w==="="?"d":m.w===m.b?"w":"l";
      h+=srvSel(g,"s"+r+"-"+i);
      h+='<div class="mt swr"><span class="side"'+dz("a")+'>'+(free?GRIP:'')+'<button class="slot '+ca+'" data-sw="'+r+'" data-i="'+i+'" data-n="'+esc(m.a)+'">'+esc(m.a)+sub(m.a)+'</button></span>'
       +'<input type="number" min="0" class="ws" data-r="'+r+'" data-i="'+i+'" data-s="sa" aria-label="Punteggio '+esc(m.a)+'" value="'+(m.sa==null?"":esc(m.sa))+'"><span>:</span>'
       +'<input type="number" min="0" class="ws" data-r="'+r+'" data-i="'+i+'" data-s="sb" aria-label="Punteggio '+esc(m.b)+'" value="'+(m.sb==null?"":esc(m.sb))+'">'
       +'<span class="side"'+dz("b")+'><button class="slot '+cb+'" data-sw="'+r+'" data-i="'+i+'" data-n="'+esc(m.b)+'">'+esc(m.b)+sub(m.b)+'</button>'+(free?GRIP:'')+'</span></div>';
    });
    h+='</div>';
    if(last){
      if(!done)h+='<p class="hint">Inserisci i punteggi (a parità di punti è pareggio) oppure tocca il nome del vincitore. Prima di inserire risultati puoi trascinare ⠿ per cambiare gli accoppiamenti.</p>';
      else if(!fin)h+='<div class="row" style="margin-top:14px"><button class="p" id="swnext">Genera turno '+(r+2)+'</button><span class="hint" style="margin:0">Gli accoppiamenti seguono la classifica ed evitano le rivincite.</span></div>';
      else if(po)h+='<div class="row" style="margin-top:14px"><button class="p" id="swpo">Avvia playoff con i primi '+W.top+'</button></div>';
    }
    h+='</section>';
  }
  return h;
}
function moveSW(g,src,dst){
  var rd=g.sw.rounds[g.sw.rounds.length-1],A=rd[+src.i],B=rd[+dst.i];
  if(!A||!B||(A===B&&src.k===dst.k))return false;
  if(hasRes(A)||hasRes(B)){toast("Si possono cambiare solo partite senza risultati.");return false}
  if(!A[src.k]||!B[dst.k])return false;
  var x=A[src.k];A[src.k]=B[dst.k];B[dst.k]=x;return true;
}
function moveRR(g,src,dst){
  var G0=g.groups,sg=G0[+src.g],dg=G0[+dst.g],sn=src.p,dn=dst.p;
  if(!sg||!dg||sn===dn)return false;
  if(sg.matches.some(hasRes)||dg.matches.some(hasRes)){toast("Si possono spostare partecipanti solo tra gironi senza risultati.");return false}
  var a=sg.players.indexOf(sn);if(a<0)return false;
  if(dn!==undefined){var b=dg.players.indexOf(dn);sg.players[a]=dn;dg.players[b]=sn}
  else{if(sg===dg)return false;if(sg.players.length<=2){toast("Un girone deve avere almeno 2 partecipanti: trascina su un nome per scambiarli.");return false}sg.players.splice(a,1);dg.players.push(sn)}
  sg.matches=TF.rrMatches(sg.players);if(dg!==sg)dg.matches=TF.rrMatches(dg.players);return true;
}

/* ======================================================================
   Archivio: tornei salvati nella cartella "tornei", backup automatici
   ====================================================================== */
var DESK=window.desk||null,ARMS={},lastStat=null,autoTs={},fileSig={},saveAt=null,saveErr=false,SAVERR="color:#e5484d;font-weight:600";
function arm(key,btn,label){
  if(ARMS[key]){delete ARMS[key];return true}
  ARMS[key]=1;btn.textContent=label;btn.classList.add("p");
  setTimeout(function(){delete ARMS[key];renderArch()},4500);return false;
}
function statusMap(){var o={};Object.keys(DEF).forEach(function(k){o[k]=result(S.games[k],k).status});return o}
/* Eliminare un gioco: prima un backup automatico, poi via dal torneo. I giochi base si possono rimettere dal "+". */
function delGame(k){
  if(Object.keys(DEF).length<2){toast("Serve almeno un gioco nel torneo.");return}
  var l=DEF[k].l;delSnap(l);autoBackup("Prima di eliminare "+l);
  if(BUILTIN.indexOf(k)>=0){S.off=(S.off||[]).filter(function(x){return x!==k});S.off.push(k)}
  /* anche per un gioco base: una voce aggiunta con la stessa chiave (vecchi "Riprendi" di cs2) lo rimetterebbe senza dati */
  S.custom=S.custom.filter(function(c){return c.k!==k});
  delete S.games[k];if(S.names)delete S.names[k];
  registerCustom();fixCur();save();render();toast(l+" eliminato dal torneo.");
}
function dupGame(k,withRes){
  var g=S.games[k],nk="c"+Date.now().toString(36),base=DEF[k].l.replace(/ \(\d+\)$/,""),n=2;
  while(Object.keys(DEF).some(function(x){return DEF[x].l===base+" ("+n+")"}))n++;
  S.custom.push({k:nk,l:base+" ("+n+")",m:g.mode,t:isTeam(g,k)?1:0});
  var c=JSON.parse(JSON.stringify(g));delete c.file;
  if(!withRes){var t={name:c.name||"",mode:c.mode,ng:c.ng||2,players:c.players.slice(),members:c.members||{},phase:"setup",groups:null,rounds:null};["team","plat","logo","calc","nq","tsize","ffaGs","ffaAdv","swR","swTop","deReset","hidden","cam","draft","cfg"].forEach(function(x){if(c[x]!==undefined)t[x]=c[x]});c=t}
  S.games[nk]=c;registerCustom();normGames();S.cur=nk;save();render();toast("Creato "+DEF[nk].l+(withRes?" con i risultati.":", pronto da avviare."));
}
function restoreGame(k){S.off=(S.off||[]).filter(function(x){return x!==k});registerCustom();normGames();S.cur=k;$("addgame").hidden=true;save();render();toast(DEF[k].l+" è di nuovo nel torneo.")}
function torneoJson(k){
  var g=S.games[k],c=JSON.parse(JSON.stringify(g));delete c.file;
  return JSON.stringify({app:"tornei-fragmarathon",kind:"torneo",v:1,title:g.name||DEF[k].l,savedAt:new Date().toISOString(),status:result(g,k).status,game:{k:k,l:DEF[k].l,m:DEF[k].m,t:DEF[k].t,plat:g.plat||""},data:c},null,1);
}
/* il backup porta l'id del torneo (nel nome del file o nella voce del browser): l'archivio mostra solo quelli del torneo aperto */
function autoBackup(label){
  var data=JSON.stringify(S),id=(S.ev&&S.ev.id)||"";
  if(DESK){DESK.writeBackup((id?"ev "+id+" ":"")+label,data).then(function(){toast("Backup automatico salvato ("+label+").");renderArch()}).catch(function(){toast("Backup automatico non riuscito: controlla la cartella Documenti.")});return}
  var L=[];try{L=JSON.parse(localStorage.getItem(KEY+"-auto")||"[]");if(!Array.isArray(L))L=[]}catch(e){L=[]}
  L.unshift({t:Date.now(),label:label,ev:id,data:data});
  /* spazio del browser: se tre copie non ci stanno se ne tengono meno; se non ne sta nemmeno una lo si dice (e i vecchi restano) */
  for(var n=Math.min(3,L.length);n>=1;n--){try{localStorage.setItem(KEY+"-auto",JSON.stringify(L.slice(0,n)));toast("Backup automatico salvato nel browser ("+label+")."+(n<Math.min(3,L.length)?" Spazio quasi esaurito: tolti i backup più vecchi.":""));renderArch();return}catch(e){}}
  toast("Backup automatico non riuscito: spazio del browser esaurito.");
}
function saveTxt(){return saveErr?"Non salvato: spazio del browser esaurito":saveAt?"Salvato alle "+saveAt.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}):""}
function afterSave(ok){
  botPush();discordPush();if(window.__app&&window.__app.onSave)window.__app.onSave();
  /* nella PWA i dati stanno nel browser: se lo spazio è finito l'indicatore lo dice, invece di "Salvato" */
  saveErr=ok===false&&!DESK;if(!saveErr)saveAt=new Date();var se=$("savest");if(se){se.textContent=saveTxt();se.style.cssText=saveErr?SAVERR:""}
  if(WALL)return;
  var now=statusMap();
  if(lastStat)Object.keys(now).forEach(function(k){if(lastStat[k]!==undefined&&now[k]!==lastStat[k]&&now[k]!=="Non ancora avviato")autoBackup(DEF[k].l+" - "+now[k])});
  lastStat=now;
  /* file dei tornei che "si aggiornano da soli": tutti i giochi che hanno un file (anche quelli non aperti: bot, rinomine),
     ognuno col suo timer, e solo se è cambiato. Si scrive lo stato di adesso, anche se nel frattempo si cambia torneo. */
  if(DESK)Object.keys(S.games).forEach(function(k){var g=S.games[k];if(!g||!g.file||!DEF[k])return;var j=JSON.stringify(g),sk=((S.ev&&S.ev.id)||"")+":"+k;if(fileSig[sk]===j)return;fileSig[sk]=j;
    var w=autoTs[sk];if(w)clearTimeout(w.t);w=autoTs[sk]={f:g.file,x:torneoJson(k)};w.t=setTimeout(function(){fileWrite(sk)},1200)});
}
function fileWrite(sk){var w=autoTs[sk];if(!w)return;clearTimeout(w.t);delete autoTs[sk];DESK.saveTorneo(w.f,w.x,"").catch(function(){delete fileSig[sk]})}
/* chiusura del programma: le scritture in attesa partono subito */
if(DESK)window.addEventListener("beforeunload",function(){Object.keys(autoTs).forEach(fileWrite)});
function saveTorneo(k){
  var g=S.games[k];if(!g)return;
  if(DESK){DESK.saveTorneo(g.file||null,torneoJson(k),(g.name||DEF[k].l)).then(function(r){g.file=r.file;fileSig[((S.ev&&S.ev.id)||"")+":"+k]=JSON.stringify(g);save();toast("Torneo salvato in tornei\\"+r.file+". Da ora si aggiorna da solo.");renderArch()}).catch(function(){toast("Salvataggio non riuscito.")});return}
  var blob=new Blob([torneoJson(k)],{type:"application/json"});dlBlob(blob,"torneo-"+(g.name||DEF[k].l).replace(/[^\w-]+/g,"-")+".json");toast("Torneo scaricato nella cartella Download.");
}
function loadTorneo(txt,file){
  var j;try{j=JSON.parse(txt)}catch(e){toast("Il file non è un torneo valido.");return}
  if(!j||j.kind!=="torneo"||!j.game||!j.data||!Array.isArray(j.data.players)){toast("Il file non è un torneo salvato da questo programma.");return}
  var k=j.game.k,has=typeof k==="string"&&Object.prototype.hasOwnProperty.call(DEF,k),old=has?S.games[k]:null;
  /* il gioco c'è già e ha dati: prima si fotografa (Annulla cancellazione e backup automatico), salvo che si riprenda il suo stesso file */
  if(old&&(old.phase!=="setup"||(old.players||[]).length)&&!(file&&old.file===file)){var lb=DEF[k].l;delSnap(lb+" (prima di riprendere "+(j.title||"un torneo")+")");autoBackup("Prima di riprendere "+lb)}
  /* gioco che non c'è: chiave nuova, mai quella di un gioco base tolto (cs2) né una già in uso */
  if(!has){if(typeof k!=="string"||!/^c[a-z0-9]+$/.test(k)||BUILTIN.indexOf(k)>=0||S.custom.some(function(c){return c.k===k}))k="c"+Date.now().toString(36);S.custom.push({k:k,l:String(j.game.l||"Torneo"),m:j.game.m,t:j.game.t?1:0});registerCustom()}
  var d=j.data;if(file)d.file=file;else delete d.file;
  S.games[k]=d;normGames();S.cur=k;save();render();toast("Torneo ripreso: "+(j.title||DEF[k].l)+".");
}
function fmtDate(ms){var d=new Date(ms);return d.toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}
var archSeq=0,BKEV=/^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_ev-(t[a-z0-9]{6,})-/;
function archVisible(){var bk=$("backup");return!bk||bk.offsetParent!==null}
var archIO=DESK&&!WALL&&window.IntersectionObserver&&$("backup")?new IntersectionObserver(function(es){if(es.some(function(x){return x.isIntersecting}))renderArch()}):null;
if(archIO)archIO.observe($("backup"));
function renderArch(){
  var el=$("arch");if(!el||WALL)return;
  var k=S.cur,g=DEF[k]?S.games[k]:null,h="";
  if(g){
    h+='<div class="row"><button class="p" id="tsave">'+(g.file?"Salva ora":"Salva questo torneo")+'</button>'+(DESK?'<button id="topen">Apri cartella tornei</button>':'<button id="tload">Apri torneo da file…</button>')+'<span class="hint" style="margin:0">'+(g.file?'Si aggiorna da solo in <b>tornei\\'+esc(g.file)+'</b>':(DESK?'Salva '+esc(DEF[k].l)+' nella cartella Documenti\\Tornei Fragmarathon\\tornei.':'Scarica '+esc(DEF[k].l)+' in un file da riaprire più tardi.'))+'</span></div>';
  }else h+='<div class="row">'+(DESK?'<button id="topen">Apri cartella tornei</button>':'<button id="tload">Apri torneo da file…</button>')+'<span class="hint" style="margin:0">Apri la scheda di un gioco per salvarne il torneo.</span></div>';
  h+='<div id="tlist"></div><div id="blist"></div>';
  el.innerHTML=h;
  var seq=++archSeq;
  /* le liste si leggono (nel processo principale, file per file) solo quando l'archivio si vede: quando compare, archIO le aggiorna */
  if(DESK&&archIO&&!archVisible())return;
  var curEv=(S.ev&&S.ev.id)||"";
  if(DESK){
    DESK.listTornei().then(function(L){
      if(seq!==archSeq)return;var t=$("tlist");if(!t)return;
      if(!L.length){t.innerHTML='<p class="empty">Nessun torneo salvato nella cartella tornei.</p>';return}
      t.innerHTML='<h3 style="margin-top:16px">Tornei salvati</h3><table class="res"><tr><th>Torneo</th><th>Gioco</th><th>Stato</th><th>Salvato</th><th></th></tr>'+L.slice(0,30).map(function(f){
        return'<tr><td>'+esc(f.broken?f.file:(f.title||f.file))+'</td><td>'+esc(f.game||"")+'</td><td>'+esc(f.status||"")+'</td><td>'+fmtDate(f.mtime)+'</td><td><button data-tres="'+esc(f.file)+'"'+(f.broken?" disabled":"")+'>'+(ARMS["t"+f.file]?"Conferma: riprendi":"Riprendi")+'</button></td></tr>'}).join("")+'</table>';
    }).catch(function(){});
    DESK.listBackups().then(function(L){
      if(seq!==archSeq)return;var b=$("blist");if(!b)return;
      L=L.filter(function(f){var m=BKEV.exec(f.file);return!m||m[1]===curEv});
      b.innerHTML='<h3 style="margin-top:16px">Backup automatici</h3><p class="hint" style="margin-top:0">Si creano da soli a ogni avvio torneo, cambio di turno o girone e alla fine. Ripristinare sostituisce tutti i dati attuali.</p>'+(L.length?'<table class="res"><tr><th>Quando</th><th>Momento</th><th></th></tr>'+L.slice(0,8).map(function(f){
        var lab=f.file.replace(/^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_/,"").replace(/^ev-t[a-z0-9]{6,}-/,"").replace(/\.json$/,"").replace(/-/g," ");
        return'<tr><td>'+fmtDate(f.mtime)+'</td><td>'+esc(lab)+'</td><td><button data-bres="'+esc(f.file)+'">'+(ARMS["b"+f.file]?"Conferma: ripristina":"Ripristina")+'</button></td></tr>'}).join("")+'</table>':'<p class="empty">Ancora nessun backup automatico.</p>')+'<div class="row" style="margin-top:8px"><button id="bopen">Apri cartella backup</button></div>';
    }).catch(function(){});
  }else{
    var L=[];try{L=JSON.parse(localStorage.getItem(KEY+"-auto")||"[]")}catch(e){}
    L=L.map(function(x,i){return{x:x,i:i}}).filter(function(o){return o.x&&(!o.x.ev||o.x.ev===curEv)});
    $("blist").innerHTML='<h3 style="margin-top:16px">Backup automatici (in questo browser)</h3>'+(L.length?'<table class="res"><tr><th>Quando</th><th>Momento</th><th></th></tr>'+L.map(function(o){var x=o.x,i=o.i;return'<tr><td>'+fmtDate(x.t)+'</td><td>'+esc(x.label)+'</td><td><button data-lres="'+i+'">'+(ARMS["l"+i]?"Conferma: ripristina":"Ripristina")+'</button></td></tr>'}).join("")+'</table>':'<p class="empty">Ancora nessun backup automatico.</p>');
  }
}

/* ======================================================================
   Guida contestuale (testi in js/help.js)
   ====================================================================== */
function helpBtn(topic){return'<button class="hb" data-help="'+topic+'" title="Guida" aria-label="Apri la guida">?</button>'}
function helpCtx(){var v=S.cur;if(v==="roster")return"partecipanti";if(v==="squadre")return"squadre";if(v==="results")return"risultati";if(v==="hof")return"hof";if(v==="sala")return"sala";if(DEF[v])return S.games[v].mode||"elim";return"inizio"}
var helpInfo=null;
function openHelp(topic){
  var H=window.HELP;if(!H)return;topic=H.topics[topic]?topic:"inizio";
  var d=$("help");if(!d){
    d=document.createElement("aside");d.id="help";d.setAttribute("role","dialog");d.setAttribute("aria-modal","false");d.setAttribute("aria-labelledby","helpt");
    d.innerHTML='<div class="hhead"><h2 id="helpt">Guida</h2><button id="hclose" aria-label="Chiudi la guida">Chiudi</button></div><nav class="hnav" id="hnav" aria-label="Argomenti della guida"></nav><div class="hbody" id="hbody" tabindex="-1"></div>';
    document.body.appendChild(d);
    d.addEventListener("click",function(e){var b=e.target.closest("button,a[data-topic]");if(!b)return;if(b.id==="hclose"){closeHelp();return}if(b.dataset.topic){e.preventDefault();openHelp(b.dataset.topic)}if(b.id==="updchk")checkUpdate(b)});
  }
  $("hnav").innerHTML=H.order.map(function(t){return'<button data-topic="'+t+'"'+(t===topic?' aria-current="true"':'')+'>'+H.topics[t].t+'</button>'}).join("");
  var body=H.topics[topic].h;
  if(topic==="info")body=body.replace("{VERSION}",esc(helpInfo?helpInfo.version:"web")).replace("{DIR}",esc(helpInfo?helpInfo.dir:"(versione browser: i file vanno nella cartella Download)"));
  $("hbody").innerHTML='<h3>'+H.topics[topic].t+'</h3>'+body;
  d.hidden=false;document.body.classList.add("helpon");$("hbody").scrollTop=0;$("hbody").focus();
}
function closeHelp(){var d=$("help");if(d){d.hidden=true;document.body.classList.remove("helpon")}}
document.addEventListener("click",function(e){var b=e.target.closest("[data-help]");if(b&&!b.closest("#help")){e.preventDefault();openHelp(b.dataset.help)}});

/* ======================================================================
   Aggiornamenti automatici (solo versione installata)
   ====================================================================== */
var updState=null;
function showUpd(s){
  updState=s;var bar=$("updbar");
  if(!bar){bar=document.createElement("div");bar.id="updbar";bar.setAttribute("role","status");document.querySelector("main").prepend(bar)}
  if(s.state==="ready"){bar.hidden=false;bar.innerHTML='<span>È pronta la versione <b>'+esc(s.version)+'</b>. Si installa da sola alla chiusura del programma.</span><button class="p" id="updnow">Riavvia e aggiorna ora</button>'}
  else if(s.state==="downloading"){bar.hidden=false;bar.innerHTML='<span>Scarico l\'aggiornamento… '+(s.percent||0)+'%</span>'}
  else bar.hidden=true;
}
function checkUpdate(btn){
  if(!DESK){btn.textContent="Disponibile solo nella versione installata";return}
  btn.disabled=true;btn.textContent="Controllo…";
  var off=false;
  DESK.checkUpdate().then(function(r){if(r.state==="dev"){btn.textContent="Versione di sviluppo: aggiornamenti disattivati";off=true}});
  setTimeout(function(){if(off)return;btn.disabled=false;btn.textContent=updState&&updState.state==="none"?"Hai già l'ultima versione":updState&&updState.state==="error"?"Controllo non riuscito: riprova più tardi":"Controlla aggiornamenti"},4000);
}
if(DESK){
  DESK.onUpdate(showUpd);
  DESK.info().then(function(i){helpInfo=i}).catch(function(){});
}
document.addEventListener("click",function(e){var b=e.target.closest("#updnow");if(b&&DESK){b.disabled=true;b.textContent="Riavvio…";DESK.installUpdate()}});

/* ======================================================================
   Scorciatoie da tastiera
   ====================================================================== */
document.addEventListener("keydown",function(e){
  if(WALL)return;
  var typing=/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||""));
  if(e.key==="F1"){e.preventDefault();openHelp(helpCtx());return}
  if(e.key==="Escape"&&$("help")&&!$("help").hidden){closeHelp();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();if(DEF[S.cur])saveTorneo(S.cur);else toast("Apri la scheda di un gioco per salvarne il torneo.");return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!typing){e.preventDefault();if(window.HOME&&window.HOME.isOpen()){window.HOME.undo();return}if(lastDel)undoDel();else undo();return}
  if(e.key==="F5"){e.preventDefault();var s5=wState();s5.view=S.cur;s5.key=null;wSave(s5);openWall()}
});
function openWall(){if(DESK)DESK.openWall();else window.open(location.pathname+"?wall=1","tfwall","popup=yes,width=1280,height=720")}

/* ======================================================================
   Proiettore. Ogni pannello ha l'icona del proiettore: un clic lo manda
   sullo schermo, da solo e ingrandito al massimo che lo schermo consente.
   PgUp/PgDn passano agli altri pannelli; la galleria li fa scorrere da
   sola ogni N secondi. Lo stato condiviso tra le due finestre sta in
   localStorage (KEY-wall): {view,key,gal,sec,scope,t}.
   ====================================================================== */
var WKEY=KEY+"-wall",PJI='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8 20.5h8M12 16.5v4"/></svg>';
function wState(){var s={};try{s=JSON.parse(localStorage.getItem(WKEY)||"{}")||{}}catch(e){}if(!(s.sec>=3))s.sec=10;if(s.scope!=="all")s.scope="view";return s}
function wSave(s){s.t=Date.now();try{localStorage.setItem(WKEY,JSON.stringify(s))}catch(e){}return s}
function viewName(v){return DEF[v]?DEF[v].l+(S.games[v]&&S.games[v].name?" — "+S.games[v].name:""):{roster:"Partecipanti",squadre:"Squadre",results:"Risultati finali",hof:"Hall of Fame"}[v]||""}
/* I pannelli che si possono proiettare nella vista aperta. */
function projEls(){return[].slice.call(document.querySelectorAll("#out>.champ,#out>section.panel,#resbox>section.panel,#hofbox>section.panel,#sqbox>section.panel,#rosterBox,#salabox>section.panel.salamap")).filter(function(el){return!el.hidden&&!el.closest("[hidden]")})}
function projTitle(el){
  if(el.classList.contains("champ"))return"Podio";
  var h=el.querySelector("h2");if(!h)return"Pannello";
  var c=h.cloneNode(true);[].forEach.call(c.querySelectorAll("button,.sr"),function(x){x.remove()});return c.textContent.replace(/\s+/g," ").trim()||"Pannello";
}
function projKeys(){var seen={};projEls().forEach(function(el){var t=projTitle(el);seen[t]=(seen[t]||0)+1;var b0=t.replace(/\s*\(\d+\)$/,"");el.dataset.wk=b0+(seen[t]>1?" #"+seen[t]:"");el.dataset.wt=t});return projEls()}
function decorateProj(){
  if(WALL)return;
  var ws=wState();
  projKeys().forEach(function(el){
    var b=el.querySelector(":scope>.pj,:scope>h2>.pj");
    if(!b){
      b=document.createElement("button");b.type="button";b.className="pj";b.innerHTML=PJI;
      b.title="Mostra sul proiettore";b.setAttribute("aria-label","Mostra «"+el.dataset.wt+"» sul proiettore");
      var h=el.classList.contains("champ")?null:el.querySelector("h2");
      if(h){var hb=h.querySelector(".hb");if(hb)h.insertBefore(b,hb);else h.appendChild(b)}else el.appendChild(b);
    }
    b.classList.toggle("on",ws.view===S.cur&&ws.key===el.dataset.wk);
  });
}
document.addEventListener("click",function(e){
  var b=e.target.closest(".pj");if(!b||WALL)return;
  e.preventDefault();e.stopPropagation();
  var el=b.closest("[data-wk]");if(!el)return;
  var s=wState();s.view=S.cur;s.key=el.dataset.wk;wSave(s);decorateProj();openWall();
  toast("Sul proiettore: "+el.dataset.wt+".");
},true);
window.addEventListener("storage",function(e){if(e.key===WKEY&&!WALL)decorateProj()});

var wS=null,wItems=[],wIdx=0,wT=0,wSig="",wWSig="",wHide=null,wLock=false;
function wViews(){return wS.scope==="all"?Object.keys(DEF).filter(function(k){return!(S.games[k]&&S.games[k].draft)}).concat(["results","hof"]):[wS.view&&(DEF[wS.view]||/^(roster|squadre|results|hof|sala)$/.test(wS.view))?wS.view:S.cur]}
function wCollect(){
  var out=[];
  wViews().forEach(function(v){S.cur=v;render();projKeys().forEach(function(el){out.push({view:v,key:el.dataset.wk,title:el.dataset.wt})})});
  return out;
}
function wClone(el){
  var c=el.cloneNode(true);c.removeAttribute("id");c.hidden=false;
  [].forEach.call(c.querySelectorAll(".pj,.hb,.grip,p.hint,p.empty+.row,.row,input[type=file],textarea,#rteams>.row,.team>.row,.chip button,label"),function(x){x.remove()});
  [].forEach.call(c.querySelectorAll("input"),function(i){var s=document.createElement("span");s.className="wv";s.textContent=i.value;i.replaceWith(s)});
  [].forEach.call(c.querySelectorAll("select"),function(i){var s=document.createElement("span");s.className="wv";s.textContent=i.options[i.selectedIndex]?i.options[i.selectedIndex].text:"";i.replaceWith(s)});
  [].forEach.call(c.querySelectorAll("button"),function(b){b.disabled=true;b.tabIndex=-1});
  [].forEach.call(c.querySelectorAll("[data-dz]"),function(x){x.removeAttribute("data-dz")});
  /* gironi all'italiana: sul proiettore classifica e solo la prossima giornata da giocare */
  [].forEach.call(c.querySelectorAll(".groups.rr .gbox"),function(gb){
    var blocks=[],cur=null;
    [].forEach.call(gb.children,function(x){if(x.classList.contains("day")){cur={d:x,m:[]};blocks.push(cur)}else if(cur&&x.classList.contains("mt"))cur.m.push(x)});
    var keep=blocks.filter(function(b){return b.m.some(function(m){return[].some.call(m.querySelectorAll(".wv"),function(v){return v.textContent===""})})})[0];
    blocks.forEach(function(b){if(b!==keep){b.d.remove();b.m.forEach(function(m){m.remove()})}});
    if(keep)keep.d.textContent="Prossima: "+keep.d.textContent;
  });
  return c;
}
function wFitBox(){
  var box=$("wbody"),c=$("wfit");if(!box||!c)return;
  var W=box.clientWidth,H=box.clientHeight,best=0.25,lo=0.25,hi=10,m,i;
  c.style.left=c.style.top="0px";
  /* il fattore più grande con cui il pannello (che si riadatta alla larghezza W/k) sta tutto nello spazio.
     Ogni prova costa un ricalcolo del layout: ricerca per bisezione (la prova è monotona), 13 prove invece di quasi 200 */
  function ok(k){c.style.width=(W/k)+"px";return c.scrollHeight*k<=H&&c.scrollWidth<=W/k+1}
  if(ok(hi))best=hi;else for(i=0;i<12;i++){m=(lo+hi)/2;if(ok(m))best=lo=m;else hi=m}
  c.style.width=(W/best)+"px";c.style.transform="scale("+best+")";
  /* centrato nello spazio libero */
  var inner=c.firstElementChild,cw=inner?Math.min(W/best,inner.scrollWidth):W/best;
  c.style.left=Math.max(0,(W-cw*best)/2)+"px";c.style.top=Math.max(0,(H-c.scrollHeight*best)/2)+"px";
  if(inner)inner.style.width=cw<W/best-1?cw+"px":"";
}
function wDraw(fade){
  if(!wItems.length){$("wtitle").textContent=S.ui.title||UI0.title;$("wsub").textContent="Niente da mostrare";$("wbody").innerHTML='<p class="wempty">Clicca l\'icona del proiettore su un pannello della finestra principale.</p>';$("wpg").textContent="";return}
  if(wIdx>=wItems.length)wIdx=0;
  var it=wItems[wIdx];S.cur=it.view;render();
  var el=projKeys().filter(function(x){return x.dataset.wk===it.key})[0];
  $("wico").innerHTML=DEF[it.view]?ico(it.view,96):"";
  $("wtitle").textContent=viewName(it.view);$("wsub").textContent=it.title;
  $("wpg").textContent=wItems.length>1?(wIdx+1)+" / "+wItems.length:"";
  var body=$("wbody");body.innerHTML="";
  /* si adatta una volta sola, sotto, dopo aver sistemato il palco */
  if(el){var f=document.createElement("div");f.id="wfit";f.appendChild(wClone(el));body.appendChild(f)}
  if(fade&&body.animate&&!matchMedia("(prefers-reduced-motion: reduce)").matches)body.animate([{opacity:0},{opacity:1}],{duration:450,easing:"ease-out"});
  var p=$("wprog");p.style.animation="none";void p.offsetWidth;p.style.animation=wS.gal&&wItems.length>1?"wprog "+(wS.sec*1000)+"ms linear":"none";
  if(window.wFitStage)wFitStage();wFitBox();
  $("wfull").textContent="Riempi lo schermo: "+(wS.full?"sì":"no");$("wfull").classList.toggle("on",!!wS.full);
  $("wgal").textContent=wS.gal?"Galleria: attiva":"Galleria: spenta";$("wgal").classList.toggle("on",!!wS.gal);
  if(document.activeElement!==$("wsec"))$("wsec").value=wS.sec;$("wscope").value=wS.scope;
}
function wRebuild(fade){
  var cur=wItems[wIdx];wItems=wCollect();
  var want=cur||{view:wS.view,key:wS.key},i=-1;
  wItems.some(function(x,j){if(x.view===want.view&&x.key===want.key){i=j;return true}});
  if(i<0)wItems.some(function(x,j){if(x.view===want.view){i=j;return true}});
  wIdx=Math.max(0,i);wDraw(fade);
}
function wGo(d){if(!wItems.length)return;wIdx=(wIdx+d+wItems.length)%wItems.length;wT=Date.now();var it=wItems[wIdx];wS.view=it.view;wS.key=it.key;wSave(wS);wWSig=localStorage.getItem(WKEY);wDraw(true)}
function wSet(ch){for(var k in ch)wS[k]=ch[k];wSave(wS);try{wWSig=localStorage.getItem(WKEY)}catch(e){}wT=Date.now();wRebuild(false)}
function wPoll(){
  var raw=null,ws=null;try{raw=localStorage.getItem(KEY);ws=localStorage.getItem(WKEY)}catch(e){}
  if(ws&&ws!==wWSig){wWSig=ws;wS=wState();wItems=[];wT=Date.now();wRebuild(true);return}
  if(raw&&raw!==wSig){wSig=raw;try{S=JSON.parse(raw);initS();registerCustom();normGames();applyUi()}catch(e){}wRebuild(false);document.title=(S.ui.title||UI0.title)+" — Proiettore"}
  if(wS.gal&&wItems.length>1&&Date.now()-wT>=wS.sec*1000)wGo(1);
}
function wallInit(){
  applyUi();document.body.classList.add("wall");if(/[?&]stream=1/.test(location.search))document.body.classList.add("streamwall","nocur");document.title=(S.ui.title||UI0.title)+" — Proiettore";
  var w=document.createElement("div");w.id="wall";
  w.innerHTML='<div id="wstage"><header class="wh"><span id="wico"></span><div class="wht"><h1 id="wtitle"></h1><p id="wsub"></p></div><div class="wpg" id="wpg"></div></header><div id="wbody"></div><div class="wbar"><i id="wprog"></i></div></div>'
   +'<div class="wctl" id="wctl" role="toolbar" aria-label="Comandi del proiettore"><button data-w="prev" title="Pannello precedente (PgUp)" aria-label="Pannello precedente">◀</button><button data-w="next" title="Pannello successivo (PgDn)" aria-label="Pannello successivo">▶</button>'
   +'<button data-w="gal" id="wgal" title="Scorri i pannelli da solo (G)">Galleria: spenta</button><label>ogni <input type="number" id="wsec" min="3" max="600" step="1" inputmode="numeric"> secondi</label>'
   +'<select id="wscope" aria-label="Pannelli da mostrare"><option value="view">Pannelli di questa scheda</option><option value="all">Tutti i giochi e i risultati</option></select>'
   +'<button data-w="full" id="wfull" title="Usa tutta la superficie dello schermo (R)">Riempi lo schermo: no</button><button data-w="fs">Schermo intero</button><button data-w="close">Chiudi</button>'
   +'<span class="wkeys"><kbd>PgUp</kbd><kbd>PgDn</kbd> pannelli <kbd>G</kbd> galleria <kbd>R</kbd> riempi <kbd>F</kbd> schermo intero <kbd>Esc</kbd> chiudi</span></div>';
  document.body.appendChild(w);
  function fs(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(function(){})}
  w.addEventListener("click",function(e){var b=e.target.closest("[data-w]");if(!b)return;var a=b.dataset.w;
    if(a==="prev")wGo(-1);else if(a==="next")wGo(1);else if(a==="gal")wSet({gal:!wS.gal});else if(a==="full")wSet({full:!wS.full});else if(a==="fs")fs();else if(a==="close")window.close()});
  $("wsec").addEventListener("change",function(){var v=parseInt(this.value,10);if(v>=3)wSet({sec:Math.min(600,v)});else this.value=wS.sec});
  $("wscope").addEventListener("change",function(){wSet({scope:this.value})});
  document.addEventListener("keydown",function(e){
    if(/^(INPUT|SELECT)$/.test(e.target.tagName)&&e.key!=="Escape")return;
    if(e.key==="PageDown"||e.key==="ArrowRight"||e.key==="ArrowDown"){e.preventDefault();wGo(1)}
    else if(e.key==="PageUp"||e.key==="ArrowLeft"||e.key==="ArrowUp"){e.preventDefault();wGo(-1)}
    else if(e.key==="g"||e.key==="G"||e.key===" "){e.preventDefault();wSet({gal:!wS.gal})}
    else if(e.key==="r"||e.key==="R"){e.preventDefault();wSet({full:!wS.full})}
    else if(e.key==="f"||e.key==="F"||e.key==="F11"){e.preventDefault();fs()}
    else if(e.key==="Escape"){if(document.fullscreenElement)document.exitFullscreen();else window.close()}
  });
  function showCtl(){var c=$("wctl");c.classList.add("on");document.body.classList.remove("nocur");clearTimeout(wHide);wHide=setTimeout(function(){if(!c.contains(document.activeElement)||document.activeElement===document.body){c.classList.remove("on");document.body.classList.add("nocur")}},3000)}
  document.addEventListener("mousemove",showCtl);showCtl();
  window.wFitStage=function(){
    var st=$("wstage"),full=!!(wS&&wS.full);$("wall").classList.toggle("full",full);
    if(full)st.style.cssText="left:0;top:0;width:"+innerWidth+"px;height:"+innerHeight+"px;transform:none";
    else st.style.cssText="transform:translate(-50%,-50%) scale("+Math.min(innerWidth/1920,innerHeight/1080)+")";
  };
  function fitStage(){wFitStage();wFitBox()}
  window.addEventListener("resize",fitStage);fitStage();
  try{wSig=localStorage.getItem(KEY)||"";wWSig=localStorage.getItem(WKEY)||""}catch(e){}
  wS=wState();if(!wS.view)wS.view=S.cur;
  wT=Date.now();wRebuild(false);setInterval(wPoll,1000);
}

/* ---- Hall of Fame: posizione finale di ogni torneo + punteggio, con formula dell'evento (S.ui.hof) ---- */
var HOF_DEF="tabella(pos; 25; 18; 15; 12; 10; 8; 6; 4; 2; 1) + punti*0.1",HOF_VARS=["pos","punti","partecipanti","concluso"],hofOpen=false;
var HOF_PRE=[["Posizioni + punteggio (consigliato)",HOF_DEF],["Solo posizioni, stile Formula 1","tabella(pos; 25; 18; 15; 12; 10; 8; 6; 4; 2; 1)"],["Solo podio: 3, 2, 1","tabella(pos; 3; 2; 1)"],["Posizioni pesate sui partecipanti","se(pos; (partecipanti - pos + 1) * 10; 0) + punti*0.1"],["Solo punteggio fatto (come prima)","punti"]];
function hofFormula(){return(S.ui&&S.ui.hof)||HOF_DEF}
/* Posizione finale di ogni partecipante in un torneo concluso (pari merito = stessa posizione). */
function placements(g,k){
  var P={},next=1;if(g.phase==="setup"||result(g,k).status!=="Concluso")return P;
  function grp(list){list=(list||[]).filter(function(n,i,a){return n&&P[n]===undefined&&a.indexOf(n)===i});if(!list.length)return;list.forEach(function(n){P[n]=next});next+=list.length}
  function seq(list){list.forEach(function(n){grp([n])})}
  function byScore(arr){arr.sort(function(a,b){return b.s-a.s});for(var i=0;i<arr.length;){var j=i;while(j<arr.length&&arr[j].s===arr[i].s)j++;grp(arr.slice(i,j).map(function(x){return x.n}));i=j}}
  if(g.ffa){
    for(var ri=g.ffa.rounds.length-1;ri>=0;ri--){var arr=[];g.ffa.rounds[ri].groups.forEach(function(gr){gr.p.forEach(function(n){if(P[n]===undefined)arr.push({n:n,s:gr.s[n]==null?-1e9:gr.s[n]})})});byScore(arr)}
  }else if(g.de){
    var D=deState(g),E=D.ev;grp([E.top[0]]);grp([E.top[1]]);grp([E.top[2]]);
    for(var li=D.st.LB.length-1;li>=0;li--)grp(D.st.LB[li].map(function(m){var x=E.M[m.id];return x&&x.ready?x.l:null}));
  }else if(g.rounds){
    var R=g.rounds,f=R[R.length-1][0],t=g.third;grp([f.w]);grp([loser(f)]);
    if(t&&t.match&&t.w){grp([t.w]);grp([t.w===t.a?t.b:t.a])}else if(t&&t.auto)grp([t.auto]);
    for(var r=R.length-2;r>=0;r--)grp(R[r].map(loser));
    if(g.groups)seq(overall(g));else if(g.sw)seq(TF.swStandings(g.players,g.sw.rounds,rankFx(g)).map(function(x){return x.n}));
  }else if(g.sw)seq(TF.swStandings(g.players,g.sw.rounds,rankFx(g)).map(function(x){return x.n}));
  else if(g.groups)seq(overall(g));
  grp(g.players);
  return P;
}
function fmtN(x){return(Math.round(x*100)/100).toLocaleString("it-IT")}
function hofSimple(src){var m=/^tabella\(pos;\s*([\d.;\s]+)\)(?:\s*\+\s*punti\s*\*\s*([\d.]+))?$/.exec(String(src).trim());return m?{tab:m[1].split(";").map(function(x){return x.trim()}).filter(Boolean).join(", "),w:m[2]||"0"}:null}
function hofEditor(){
  var src=hofFormula(),sm=hofSimple(src)||{tab:"25, 18, 15, 12, 10, 8, 6, 4, 2, 1",w:"0.1"},t=calcTest(src,HOF_VARS,{pos:1,punti:120,partecipanti:16,concluso:1});
  return'<details class="calc hofcalc"'+(hofOpen?" open":"")+'><summary>Come si calcola la Hall of Fame</summary>'
   +'<p class="hint">Per ogni torneo si calcola un punteggio da posizione finale e punti fatti, e si sommano tutti i tornei. La posizione conta solo quando il torneo è concluso: fino ad allora vale 0.</p>'
   +'<div class="row"><label class="row" style="gap:6px">Modello <select id="hofpre"><option value="">Scegli…</option>'+HOF_PRE.map(function(p,i){return'<option value="'+i+'">'+p[0]+'</option>'}).join("")+'</select></label></div>'
   +'<div class="row" style="margin-top:10px;align-items:flex-end"><label class="cfx" style="flex:3 1 260px">Punti per posizione (1º, 2º, 3º, …) <input type="text" id="hofpos" value="'+esc(sm.tab)+'"></label><label class="cfx" style="flex:1 1 140px">Peso del punteggio <input type="number" id="hofw" min="0" step="0.01" value="'+esc(sm.w)+'"></label><button id="hofapply">Applica i pesi</button></div>'
   +'<label class="cfx">Formula (per chi vuole di più) <input type="text" id="hoff" spellcheck="false" value="'+esc(src)+'"></label>'
   +'<p class="cres '+(t.ok?'ok':'err')+'" id="hoff-r">'+(t.ok?'Esempio: 1º posto con 120 punti fatti = '+fmtN(t.v)+' punti Hall of Fame':esc(t.msg))+'</p>'
   +'<p class="hint">Variabili: pos (posizione finale), punti (punti fatti nel torneo, secondo la sua formula «Punti per la Hall of Fame»), partecipanti, concluso (1 o 0). Funzioni e operatori come nelle altre formule (F1).</p></details>';
}
function hofSet(src){try{TF.fxCompile(src,HOF_VARS)}catch(e){toast("Formula non salvata: "+e.message);return}S.ui.hof=src.trim();save();render();toast("Hall of Fame ricalcolata.")}
function hofCompute(){
  var fx=fxSafe(hofFormula(),HOF_VARS)||TF.fxCompile(HOF_DEF,HOF_VARS),P={},T={};
  function add(M,n,k,o){var e=M[n]||(M[n]={n:n,tot:0,by:{}});e.tot+=o.v;e.by[k]=o}
  Object.keys(DEF).forEach(function(k){
    var g=S.games[k];if(!g||g.phase==="setup")return;
    var team=isTeam(g,k),pts=gamePts(g),pl=placements(g,k),done=result(g,k).status==="Concluso",np=g.players.length;
    Object.keys(pts).concat(Object.keys(pl)).filter(function(n,i,a){return a.indexOf(n)===i}).forEach(function(n){
      var V={pos:pl[n]||0,punti:pts[n]||0,partecipanti:np,concluso:done?1:0},o={v:fx.run(V),pos:V.pos,pts:V.punti};
      if(team){add(T,n,k,o);((g.members||{})[n]||[]).forEach(function(m){add(P,m,k,o)})}else add(P,n,k,o);
    });
  });
  function all(M){var L=Object.keys(M).map(function(k){return M[k]}).sort(function(a,b){return b.tot-a.tot||a.n.localeCompare(b.n)}),prev=null,pos=0;L.forEach(function(e,i){if(e.tot!==prev){pos=i+1;prev=e.tot}e.pos=pos});return L}
  return{P:all(P),T:all(T)};
}
function renderHof2(){
  var H=hofCompute();function top(L){return L.slice(0,10)}
  function panel(title,list,isT){
    var h='<section class="panel"><h2>'+title+'</h2>';
    if(!list.length)return h+'<p class="empty">Nessun punteggio inserito.</p></section>';
    h+='<table class="res"><tr><th>Pos.</th><th>'+(isT?"Squadra":"Giocatore")+'</th><th>Totale</th><th>Per gioco: posizione e punti</th></tr>';
    var prev=null,pos=0;
    list.forEach(function(e,i){
      if(e.tot!==prev){pos=i+1;prev=e.tot}
      var ks=Object.keys(e.by).sort(function(a,b){return e.by[b].v-e.by[a].v});
      h+='<tr><td>'+pos+'º</td><td>'+(isT?tico(e.n,18):"")+esc(e.n)+'</td><td><b>'+fmtN(e.tot)+'</b></td><td><div class="gps">'+ks.map(function(k,j){var o=e.by[k],gl=DEF[k].l+(S.games[k].name?" ("+S.games[k].name+")":"");
        return'<span class="gp'+(j===0&&ks.length>1?' top':'')+'" title="'+esc(gl)+': '+(o.pos?o.pos+'º posto, ':'')+fmtN(o.pts)+' punti fatti, '+fmtN(o.v)+' punti Hall of Fame">'+ico(k,26)+(o.pos?'<span class="gpos">'+o.pos+'º</span>':'')+'<b>'+fmtN(o.v)+'</b><span class="sr"> in '+esc(gl)+'</span></span>'}).join("")+'</div></td></tr>';
    });
    return h+'</table></section>';
  }
  $("hofbox").innerHTML=hofEditor()+'<p class="hint" style="margin:12px 0">Classifica di tutti i giochi dell&#39;evento. Accanto all&#39;icona di ogni gioco: posizione finale e punti Hall of Fame. Nei giochi a squadre i punti della squadra contano anche per ogni componente.</p>'+panel("Hall of Fame · Giocatori",top(H.P),false)+panel("Hall of Fame · Squadre",top(H.T),true);
}
$("hofbox").addEventListener("change",function(e){
  var id=e.target.id;
  if(id==="hofpre"&&e.target.value!==""){hofSet(HOF_PRE[+e.target.value][1]);return}
  if(id==="hoff")hofSet(e.target.value);
});
$("hofbox").addEventListener("input",function(e){
  if(e.target.id!=="hoff")return;var t=calcTest(e.target.value,HOF_VARS,{pos:1,punti:120,partecipanti:16,concluso:1}),o=$("hoff-r");
  if(o){o.className="cres "+(t.ok?"ok":"err");o.textContent=t.ok?"Esempio: 1º posto con 120 punti fatti = "+fmtN(t.v)+" punti Hall of Fame (premi Invio o esci dal campo per salvare)":t.msg}
});
$("hofbox").addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.target.id==="hoff"||e.target.id==="hofpos"||e.target.id==="hofw")){e.preventDefault();if(e.target.id==="hoff")e.target.blur();else $("hofapply").click()}});
$("hofbox").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b||b.id!=="hofapply")return;
  var vals=$("hofpos").value.split(/[,;\s]+/).map(function(x){return x.replace(",",".")}).filter(function(x){return/^\d+(\.\d+)?$/.test(x)}),w=parseFloat(String($("hofw").value).replace(",","."))||0;
  if(!vals.length){toast("Scrivi almeno i punti del 1º posto, separati da virgole.");return}
  hofSet("tabella(pos; "+vals.join("; ")+")"+(w>0?" + punti*"+w:""));
});
$("hofbox").addEventListener("toggle",function(e){if(e.target.classList&&e.target.classList.contains("hofcalc"))hofOpen=e.target.open},true);

var _render=render,_renderOut=renderOut;
render=function(){applySkin();_render();fitProj();decorateProj()};
renderOut=function(){_renderOut();fitProj();decorateProj()};
window.addEventListener("resize",fitProj);
document.addEventListener("fullscreenchange",fitProj);
/* Ponte per la schermata dei tornei (js/home.js): legge lo stato e ne carica un altro. */
window.openHelp=function(k){openHelp(k)};
/* Titolo, sottotitolo e logo si cambiano anche direttamente dal banner. */
(function(){
  if(WALL)return;
  var h=document.querySelector(".brand h1"),tg=document.querySelector(".brand .tag"),em=document.querySelector(".brand img.emblem");
  function inline(el,key,def){
    if(!el)return;el.classList.add("bedit");el.title="Clicca per modificare";el.tabIndex=0;el.setAttribute("role","button");
    function go(){
      if(el.isContentEditable)return;var old=el.textContent;el.contentEditable="plaintext-only";el.removeAttribute("role");el.focus();
      var r=document.createRange();r.selectNodeContents(el);var s=getSelection();s.removeAllRanges();s.addRange(r);
      function fin(ok){el.removeEventListener("keydown",kd);el.removeEventListener("blur",bl);el.contentEditable="false";el.setAttribute("role","button");
        var v=el.textContent.replace(/\s+/g," ").trim();
        if(ok&&v&&v!==old){S.ui[key]=v.slice(0,120);save();applyUi();toast((key==="title"?"Titolo":"Sottotitolo")+" aggiornato.")}else el.textContent=old}
      function kd(e){if(e.key==="Enter"){e.preventDefault();fin(true)}else if(e.key==="Escape"){e.preventDefault();fin(false)}}
      function bl(){fin(true)}
      el.addEventListener("keydown",kd);el.addEventListener("blur",bl);
    }
    el.addEventListener("click",go);el.addEventListener("keydown",function(e){if(!el.isContentEditable&&(e.key==="Enter"||e.key===" ")){e.preventDefault();go()}});
  }
  inline(h,"title");inline(tg,"sub");
  if(em){
    var fi=document.createElement("input");fi.type="file";fi.accept="image/*";fi.hidden=true;document.body.appendChild(fi);
    fi.onchange=function(){if(fi.files[0])readLogo(fi.files[0]);fi.value=""};
    em.classList.add("bedit");em.title="Clicca per cambiare il logo";em.tabIndex=0;em.setAttribute("role","button");em.setAttribute("aria-label","Cambia il logo del torneo");
    em.addEventListener("click",function(){fi.click()});em.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();fi.click()}});
  }
})();

/* ======================================================================
   Discord: invito al server, account dei giocatori e, nell'app per Windows, un canale
   per ogni partita visibile solo ai suoi giocatori (lo crea il bot Discord in discord.js)
   ====================================================================== */
function evT(s){return window.I18N&&S.ev&&S.ev.lang&&S.ev.lang!=="it"?I18N.tr(s,S.ev.lang):s}
function dcOk(s){s=String(s||"").trim().replace(/^@/,"");return/^[\w.]{2,32}$/.test(s)||/^[^#<>@:]{2,32}#\d{4}$/.test(s)||/^\d{16,21}$/.test(s)?s:""}
function dcInvOk(u){u=String(u||"").trim();if(!u)return"";if(!/^https?:\/\//i.test(u))u="https://"+u;u=u.replace(/^http:/i,"https:");return/^https:\/\/(discord\.gg|(www\.)?discord(app)?\.com\/invite)\/[\w-]+\/?$/i.test(u)?u:null}
/* tutte le partite di un gioco: chiave (la stessa dei server), giocatori, stato ("ready" da giocare, "done" finita,
   "" non ancora pronta) e risultato. all = chiavi di tutte le partite che esistono, anche non pronte. */
function dcMatches(g,k){
  var M=[],ALL=[],team=isTeam(g,k);
  function add(key,lab,ps,state,res){
    ALL.push(key);if(!state)return;
    var acc=[];ps.forEach(function(p){(team?((g.members||{})[p]||[]):[p]).forEach(function(x){var d=dcOk(S.disc&&S.disc[x]);if(d&&acc.indexOf(d)<0)acc.push(d)})});
    var sv=srvOf(g,key),two=ps.length===2;
    M.push({key:key,label:evT(lab),players:ps.slice(),sig:ps.join("|"),name:two?ps[0]+" vs "+ps[1]:evT(lab),accounts:acc,state:state,result:res||"",server:sv?{name:sv.name,addr:sv.addr,pass:sv.pass}:null});
  }
  if(!g||g.phase==="setup")return{matches:M,all:ALL};
  if(g.ffa){var F=g.ffa;F.rounds.forEach(function(rd,ri){var fin=rd.groups.length===1,last=ri===F.rounds.length-1;rd.groups.forEach(function(gr,gi){var e=gEval(gr,fin,F.adv);
    add("f"+ri+"-"+gi,fin?"Finale":"Turno "+(ri+1)+", girone "+letter(gi),gr.p,e.full?"done":(last?"ready":""),e.full?e.sorted.slice(0,3).map(function(x){return x.pos+"º "+x.n+" ("+gr.s[x.n]+")"}).join(", "):"")})});return{matches:M,all:ALL}}
  if(g.de){var E=deState(g).ev;Object.keys(E.M).forEach(function(id){var m=E.M[id];if(!m.ready||!m.a||!m.b){ALL.push("d"+id);return}var dn=m.w!==undefined;
    add("d"+id,id==="GF"?"Finale":id==="GF2"?"Bella":id.charAt(0)==="W"?"Vincenti":"Perdenti",[m.a,m.b],dn?"done":"ready",dn?mres(m,evT):"")});return{matches:M,all:ALL}}
  if(g.groups)g.groups.forEach(function(x,gi){var op=x.matches.filter(function(m){return m.sa==null||m.sb==null}),d=op.length?op[0].day:null;
    x.matches.forEach(function(m,mi){var dn=m.sa!=null&&m.sb!=null;add("g"+gi+"-"+mi,(g.groups.length>1?"Girone "+letter(gi)+", ":"")+"giornata "+m.day,[m.a,m.b],dn?"done":(m.day===d?"ready":""),dn?m.a+" "+m.sa+"–"+m.sb+" "+m.b:"")})});
  if(g.sw)g.sw.rounds.forEach(function(rd,ri){rd.forEach(function(m,mi){if(!m.b){ALL.push("s"+ri+"-"+mi);return}var dn=m.w!=null;
    add("s"+ri+"-"+mi,"Turno "+(ri+1),[m.a,m.b],dn?"done":"ready",dn?(m.sa!=null&&m.sb!=null?m.a+" "+m.sa+"–"+m.sb+" "+m.b:(m.w==="="?m.a+" = "+m.b:mres(m,evT))):"")})});
  if(g.rounds){g.rounds.forEach(function(rd,ri){rd.forEach(function(m,mi){if(!m.a||!m.b){ALL.push("e"+ri+"-"+mi);return}add("e"+ri+"-"+mi,roundName(ri,g.rounds.length),[m.a,m.b],m.w?"done":"ready",m.w?mres(m,evT):"")})});
    var t=g.third;if(t&&t.match){if(t.a&&t.b)add("e3","Finale 3º posto",[t.a,t.b],t.w?"done":"ready",t.w?mres(t,evT):"");else ALL.push("e3")}}
  return{matches:M,all:ALL};
}
function dcAccounts(){var o={};S.roster.forEach(function(n){var a=dcOk(S.disc&&S.disc[n]);if(a)o[a]=1});return Object.keys(o)}
function discordVM(){
  /* account: quelli dei partecipanti e quelli dei giocatori delle partite (anche se tolti da Partecipanti), così non perdono il canale */
  var ev=S.ev||{},games=[],acc={};dcAccounts().forEach(function(a){acc[a]=1});
  Object.keys(DEF).forEach(function(k){var g=S.games[k];if(!g)return;var r=dcMatches(g,k),ms=g.draft?[]:r.matches;
    ms.forEach(function(m){m.accounts.forEach(function(a){acc[a]=1})});games.push({key:k,label:DEF[k].l,matches:ms,all:r.all})});
  return{ev:ev.id,guild:ev.dguild,voice:!!ev.dvoice,title:S.ui.title||UI0.title,accounts:Object.keys(acc),games:games,
    t:{only:evT("Questo canale lo vedono solo i giocatori della partita e gli organizzatori."),server:evT("Server"),pass:evT("password"),players:evT("Giocatori")}};
}
var dcT=null,dcErr="",dcLast=null,dcChk=0,dcMove="";
/* id del torneo aperto se i suoi canali Discord sono attivi; si ricontrolla anche quando parte il timer
   (nel frattempo può essere stato aperto un altro torneo, o tolti i canali) */
function dcOn(){var ev=S.ev||{};return ev.id&&ev.dguild&&ev.dchan&&!ev.draft?ev.id:null}
function dcRun(){var vm;try{vm=discordVM()}catch(e){if(DESK.logError)DESK.logError("discord",String(e&&e.stack||e));return}
  /* "Aggiorna i canali adesso": discord.js controlla anche i canali pronti e rifà quelli cancellati a mano su Discord */
  if(dcChk){vm.now=true;dcChk=0}
  /* cambio di server: i canali del server vecchio si eliminano solo dopo la conferma dell'utente (anche dopo un ripristino) */
  vm.confirmMove=!!(dcMove&&dcMove===vm.guild);
  DESK.discordSync(vm).then(function(r){if(r&&!r.needConfirm&&vm.confirmMove)dcMove="";if(r&&r.err){if(r.err!==dcErr)toast(r.err);dcErr=r.err}else dcErr="";if((S.ev&&S.ev.id)!==vm.ev)return;dcLast=r||{};dcStat()}).catch(function(){})}
function discordPush(now,chk){
  if(!DESK||!DESK.discordSync||WALL)return;if(chk)dcChk=1;if(later(function(){discordPush(now)}))return;
  clearTimeout(dcT);dcT=null;var id=dcOn();if(!id){dcChk=0;return}
  dcT=setTimeout(function(){dcT=null;if(later(function(){discordPush(1)}))return;if(dcOn()!==id)return;dcRun()},now?50:2500);
}
/* prima di cambiare torneo: la modifica in attesa del torneo che si chiude parte subito invece di perdersi */
function discordFlush(){if(!dcT||!DESK||!DESK.discordSync||WALL||SWAP)return;clearTimeout(dcT);dcT=null;if(dcOn())dcRun()}
function dcStat(){
  var el=$("dcstat");if(!el||!dcLast)return;var r=dcLast,h="";
  /* errore su singole partite (r.errors): la sincronizzazione è finita, i conteggi restano e l'errore va sotto */
  var part=r.err&&r.errors&&r.errors.length&&!r.skipped;
  if(r.needConfirm)h='<span class="cres err">Questo torneo ha canali in un altro server Discord: spostandolo nel server scelto, quelli verranno eliminati.</span> <b>'+(r.channels||0)+'</b><br><button type="button" id="dcmove">Sposta nel server scelto ed elimina i canali vecchi</button>';
  else if(r.err&&!part)h='<span class="cres err">'+esc(r.err)+'</span>';
  else if(!r.skipped)h='<span>Canali delle partite</span>: <b>'+(r.channels||0)+'</b>'+(r.created?' <span>(nuovi</span> <b>'+r.created+'</b>)':'')+
    (r.missing&&r.missing.length?'<br><span>Account non trovati nel server Discord</span>: <b data-noi18n>'+esc(r.missing.join(", "))+'</b>':'')+
    (part?'<br><span class="cres err">'+esc(r.err)+'</span>':'');
  el.innerHTML=h;
}
function renderDiscordSettings(){
  var ev=S.ev||{};
  return'<h3 style="margin-top:20px">Discord</h3><p class="hint">L&#39;invito al server Discord del torneo compare nelle informazioni del torneo e nel bot Telegram. Con un bot Discord, l&#39;app crea anche un canale per ogni partita visibile solo ai suoi giocatori. Gli account Discord dei giocatori si scrivono in Partecipanti, oppure li danno loro iscrivendosi dal bot Telegram.</p>'
   +'<div class="row"><input type="text" inputmode="url" id="dcinv" value="'+esc(ev.discord||"")+'" placeholder="https://discord.gg/…" aria-label="Invito al server Discord" style="flex:1 1 280px">'+(DESK&&DESK.discordInvite?'<button id="dcmk">Crea un invito</button>':'')+'</div>'
   +(DESK&&DESK.discordStatus?'<div id="dcbox"><p class="hint">Caricamento…</p></div>':'<p class="hint">I canali per partita si creano solo dall&#39;app installata per Windows.</p>');
}
function dcHtml(st){
  var ev=S.ev||{},h='';
  if(st.user)h+='<p><span class="dcok">Collegato come</span> <b data-noi18n>'+esc(st.user.name)+'</b></p>';
  else if(st.err)h+='<p class="cres err">'+esc(st.err)+'</p>';
  h+='<div class="row"><input type="password" id="dctok" autocomplete="off" placeholder="'+(st.hasToken?'Token salvato: incollane uno nuovo per cambiarlo':'Token del bot Discord')+'" aria-label="Token del bot Discord" style="flex:1 1 280px"><button class="p" id="dctoks">Collega</button>'+(st.hasToken?'<button id="dctokdel">Togli il token</button>':'')+'</div>';
  if(st.user){
    h+='<p class="hint"><a href="'+esc(st.invite)+'" target="_blank" rel="noopener">Aggiungi il bot al tuo server Discord</a>: servono i permessi Gestisci canali e Gestisci permessi.</p>';
    h+='<div class="row"><label for="dcguild">Server Discord del torneo</label><select id="dcguild"><option value="">Scegli il server</option>'+(st.guilds||[]).map(function(g){return'<option value="'+esc(g.id)+'"'+(g.id===ev.dguild?' selected':'')+' data-noi18n>'+esc(g.name)+'</option>'}).join("")+'</select></div>';
    if(!(st.guilds||[]).length)h+='<p class="hint">Il bot non è ancora in nessun server: usa il link qui sopra.</p>';
    h+='<label class="row chk"><input type="checkbox" id="dcchan"'+(ev.dchan?' checked':'')+'>Crea un canale per ogni partita, visibile solo ai giocatori</label>';
    h+='<label class="row chk"><input type="checkbox" id="dcvoice"'+(ev.dvoice?' checked':'')+'>Anche un canale vocale per ogni partita</label>';
    h+='<div class="row"><button id="dcsync">Aggiorna i canali adesso</button><button id="dcclear">Elimina i canali di questo torneo</button></div><p class="hint" id="dcstat"></p>';
  }
  h+='<details class="hint dcguide"><summary>Come creare il bot Discord</summary><ol><li>Apri discord.com/developers/applications e premi New Application.</li><li>Nella sezione Bot premi Reset Token, copia il token e incollalo qui sopra, poi premi Collega.</li><li>Premi Aggiungi il bot al tuo server e scegli il server del torneo.</li><li>Torna qui, scegli il server e attiva i canali per partita.</li></ol><p>Il bot crea una categoria per ogni gioco e, quando una partita è pronta, un canale con i due giocatori o le due squadre e il server su cui giocare. A partita finita il canale diventa di sola lettura con il risultato.</p></details>';
  return h;
}
function dcRefresh(){
  var b=$("dcbox");if(!b||!DESK||!DESK.discordStatus)return;
  DESK.discordStatus().then(function(st){if(!st.hasToken)return st;return DESK.discordCheck().then(function(c){return Object.assign({hasToken:true},c,{err:c.ok?"":c.err})})})
    .then(function(st){var x=$("dcbox");if(x){x.innerHTML=dcHtml(st);dcStat()}}).catch(function(){});
}
var dcArm=false,dcGArm=null;
$("editbox").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b||!/^dc/.test(b.id))return;
  if(b.id==="dctoks"){var t=$("dctok").value.trim();if(!t){toast("Incolla il token del bot Discord.");return}
    b.disabled=true;DESK.discordConfig({token:t}).then(function(r){var x=$("dcbox");if(x){x.innerHTML=dcHtml(Object.assign({hasToken:true},r,{err:r.ok?"":r.err}));dcStat()}if(r.ok){toast("Bot Discord collegato.");discordPush(1)}}).catch(function(){b.disabled=false})}
  else if(b.id==="dctokdel")DESK.discordConfig({removeToken:true}).then(function(){dcRefresh();toast("Token Discord tolto.")});
  else if(b.id==="dcmk"){if(!S.ev||!S.ev.dguild){toast("Collega il bot Discord e scegli il server del torneo, poi crea l'invito.");return}
    /* la risposta può arrivare dopo che si è aperto un altro torneo: l'invito va nel torneo per cui è stato chiesto */
    var evId=S.ev.id;b.disabled=true;
    DESK.discordInvite(S.ev.dguild).then(function(r){b.disabled=false;r=r||{};if(r.err){toast(r.err);return}
      if(!S.ev||S.ev.id!==evId){if(evId&&window.HOME&&window.HOME.editOther){window.HOME.editOther(evId,function(st){st.ev=st.ev||{};st.ev.discord=r.url;return true});toast("Invito al server Discord creato.")}
        else toast("Invito creato, ma nel frattempo è stato aperto un altro torneo: torna al torneo e crealo di nuovo.");return}
      S.ev.discord=r.url;var i=$("dcinv");if(i)i.value=r.url;save();toast("Invito al server Discord creato.")}).catch(function(){b.disabled=false})}
  else if(b.id==="dcmove"){if(!S.ev||!S.ev.dguild)return;dcMove=S.ev.dguild;discordPush(1)}
  else if(b.id==="dcsync"){if(!S.ev.dguild){toast("Scegli prima il server Discord del torneo.");return}if(!S.ev.dchan){S.ev.dchan=true;var c=$("dcchan");if(c)c.checked=true;save()}discordPush(1,1);toast("Aggiorno i canali Discord…")}
  else if(b.id==="dcclear"){
    if(!dcArm){dcArm=true;b.textContent="Conferma: elimina i canali";b.classList.add("p");setTimeout(function(){dcArm=false;if(b.isConnected){b.textContent="Elimina i canali di questo torneo";b.classList.remove("p")}},5000);return}
    dcArm=false;S.ev.dchan=false;save();var c2=$("dcchan");if(c2)c2.checked=false;
    /* una sincronizzazione ancora in attesa ricreerebbe i canali appena eliminati */
    clearTimeout(dcT);dcT=null;dcChk=0;
    DESK.discordClear(S.ev.id).then(function(n){if(n&&n.err){toast(n.err);return}toast("Canali Discord eliminati: "+(n||0)+".");dcLast={channels:0};dcStat();b.textContent="Elimina i canali di questo torneo";b.classList.remove("p")})}
});
$("editbox").addEventListener("change",function(e){
  var t=e.target;if(!t.id||!/^dc/.test(t.id))return;S.ev=S.ev||{};
  if(t.id==="dcinv"){var u=dcInvOk(t.value);if(u===null){toast("Link di invito Discord non valido: deve essere tipo https://discord.gg/…");return}S.ev.discord=u;t.value=u;save()}
  /* cambiare server elimina i canali del torneo nel server di prima (con la loro chat): si chiede di confermare scegliendo di nuovo */
  else if(t.id==="dcguild"){var og=S.ev.dguild||"";
    if(og&&t.value!==og&&S.ev.dchan&&!(dcLast&&dcLast.channels===0)&&!(dcGArm&&dcGArm.ev===S.ev.id&&dcGArm.to===t.value&&Date.now()<dcGArm.until)){
      dcGArm={ev:S.ev.id,to:t.value,until:Date.now()+8000};t.value=og;
      toast("Cambiando server Discord, i canali di questo torneo nel server attuale verranno eliminati. Per confermare scegli di nuovo la stessa voce entro 8 secondi.");return}
    dcGArm=null;if(og&&t.value&&t.value!==og)dcMove=t.value;S.ev.dguild=t.value;save();discordPush(1)}
  else if(t.id==="dcchan"){S.ev.dchan=t.checked;save();if(t.checked){if(!S.ev.dguild)toast("Scegli anche il server Discord del torneo.");discordPush(1)}}
  else if(t.id==="dcvoice"){S.ev.dvoice=t.checked;save();discordPush(1)}
});
/* account Discord dei giocatori, nel pannello Partecipanti */
function renderDcRoster(){
  var box=$("rdcbox");if(!box)return;S.disc=S.disc||{};
  if(!S.roster.length){box.innerHTML='<p class="hint">Aggiungi prima i partecipanti.</p>';return}
  box.innerHTML='<table class="dctab"><thead><tr><th>Giocatore</th><th>Account Discord</th><th>Sul server</th></tr></thead><tbody>'+S.roster.map(function(n){
    return'<tr><td data-noi18n>'+esc(n)+'</td><td><input type="text" data-dcp="'+esc(n)+'" value="'+esc(S.disc[n]||"")+'" placeholder="nome utente" aria-label="Account Discord di '+esc(n)+'" autocomplete="off" spellcheck="false"></td><td class="dcs" data-dcs="'+esc(n)+'"></td></tr>'}).join("")+'</tbody></table>'
    +'<div class="row" style="margin-top:8px">'+(DESK&&DESK.discordLookup?'<button id="rdccheck">Controlla sul server Discord</button>':'')+'<span class="hint" style="margin:0">Nome utente Discord (es. fede_73), non il nome visualizzato.</span></div>';
}
$("rosterBox").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.id==="rdc"){var x=$("rdcbox");x.hidden=!x.hidden;b.setAttribute("aria-expanded",String(!x.hidden));if(!x.hidden)renderDcRoster()}
  else if(b.id==="rdccheck"){
    if(!S.ev||!S.ev.dguild){toast("Scegli prima il server Discord in Impostazioni, Discord.");return}
    var acc=dcAccounts();if(!acc.length){toast("Nessun account Discord da controllare.");return}
    b.disabled=true;DESK.discordLookup(S.ev.dguild,acc).then(function(r){b.disabled=false;if(r&&r.err){toast(r.err);return}
      var miss=0;document.querySelectorAll("#rdcbox [data-dcs]").forEach(function(td){var a=dcOk(S.disc[td.getAttribute("data-dcs")]);if(!a){td.textContent="";return}var ok=!!(r&&r[a]);if(!ok)miss++;td.textContent=ok?"✓ "+T_("trovato"):"✗ "+T_("non trovato");td.className="dcs "+(ok?"ok":"no")});
      toast(miss?"Account non trovati nel server: "+miss+". Controlla il nome utente o invita i giocatori.":"Tutti gli account sono nel server Discord.")}).catch(function(){b.disabled=false})}
});
$("rosterBox").addEventListener("change",function(e){
  var t=e.target,n=t.getAttribute&&t.getAttribute("data-dcp");if(n===null||n===undefined)return;
  var v=String(t.value||"").trim();if(v&&!dcOk(v)){toast("Account Discord non valido: usa il nome utente, es. fede_73.");return}
  S.disc=S.disc||{};if(v)S.disc[n]=dcOk(v);else delete S.disc[n];t.value=v?dcOk(v):"";save();
});
function botDiscord(m){
  var nm=String(m.name||"").trim(),acc=dcOk(m.account);if(!nm||!acc)return;
  /* il bot accetta /discord solo da collegamenti confermati dall'organizzatore: l'account si aggiorna, e se cambia lo si dice */
  var evs=(m.evs||[]).filter(Boolean),here=S.ev&&S.ev.id&&(!evs.length||evs.indexOf(S.ev.id)>=0),n=0,old="",ex=here&&sameName(S.roster,nm);
  if(ex){S.disc=S.disc||{};if(S.disc[ex]&&S.disc[ex]!==acc)old=S.disc[ex];if(S.disc[ex]!==acc){S.disc[ex]=acc;save();if($("rdcbox")&&!$("rdcbox").hidden)renderDcRoster()}n++}
  /* negli altri tornei si salva in modo asincrono: il messaggio aspetta tutti i salvataggi */
  var oth=window.HOME&&window.HOME.editOther?evs.filter(function(id){return!(S.ev&&S.ev.id===id)}):[];
  Promise.all(oth.map(function(id){return window.HOME.editOther(id,function(st){var x=sameName(st.roster,nm);if(!x)return false;ex=ex||x;st.disc=st.disc||{};if(st.disc[x]===acc){n++;return false}if(st.disc[x])old=old||st.disc[x];st.disc[x]=acc;n++;return true})})).then(function(){
    if(!n)toast("Account Discord dal bot Telegram: "+nm+" non è tra i partecipanti.");
    else if(old)toast("Account Discord di "+(ex||nm)+" cambiato dal bot Telegram: "+old+" → "+acc+".");
    else toast("Account Discord di "+(ex||nm)+" dal bot Telegram: "+acc+".")});
}


/* ======================================================================
   Archivio delle configurazioni dei server, per gioco: file di testo (server.cfg, .ini…) e un elenco
   di impostazioni nome = valore. Si salva con il torneo e nei backup; nulla va ai giocatori.
   ====================================================================== */
var GC_MAX=256*1024,GC_TOT=1536*1024,gcOpen=false,gcEdit=null,gcTaF=null;
var GC_TPL={quake:["g_gametype","fraglimit","timelimit","capturelimit","sv_maxclients","sv_hostname","g_password","zmq_rcon_password"],
  tf2:["mp_tournament","mp_timelimit","mp_winlimit","mp_maxrounds","tv_enable","sv_password","rcon_password"],
  cs2:["game_type","game_mode","mp_maxrounds","mp_overtime_enable","mp_roundtime","mp_freezetime","tv_enable","sv_password","rcon_password"],
  wreck:["server_name","password","max_players","track","laps","bots","admin_steamids"]};
function gcOf(g){if(!g.cfg||typeof g.cfg!=="object")g.cfg={files:[],set:[]};if(!Array.isArray(g.cfg.files))g.cfg.files=[];if(!Array.isArray(g.cfg.set))g.cfg.set=[];return g.cfg}
function gcSize(){var n=0;Object.keys(S.games).forEach(function(k){var c=S.games[k]&&S.games[k].cfg;if(c&&c.files)c.files.forEach(function(f){n+=String(f.t||"").length})});return n}
function gcSecret(k){return/pass|rcon|token|secret|steamid|pwd/i.test(String(k||""))}
function gcName(n){n=String(n||"").replace(/[\\/:*?"<>|\u0000-\u001f]+/g,"_").trim().slice(0,80);return n||"config.cfg"}
function gcKB(n){return n<1024?n+" B":(n/1024).toFixed(n<10240?1:0)+" KB"}
function gcWhen(t){if(!t)return"";var d=new Date(t),p=function(x){return String(x).padStart(2,"0")};return p(d.getDate())+"/"+p(d.getMonth()+1)+" "+p(d.getHours())+":"+p(d.getMinutes())}
function renderCfg(g){
  var c=g.cfg||{files:[],set:[]},F=c.files||[],T=c.set||[],k=S.cur,h;
  if(gcEdit!=null&&!F[gcEdit])gcEdit=null;
  h='<details class="gcbox" id="gcbox"'+(gcOpen?' open':'')+'><summary><span>Configurazioni dei server</span>'+(F.length||T.length?' <span class="gcn">'+F.length+' <span>file</span>, '+T.length+' <span>impostazioni</span></span>':'')+'</summary>'
   +'<p class="hint">File di configurazione e impostazioni dei server di questo gioco: restano nel torneo e nei backup, non vanno ai giocatori.</p>'
   +'<h4>File</h4>';
  h+=F.length?'<ul class="gcfiles">'+F.map(function(f,i){return'<li><button class="gcfn" data-gc="open" data-gf="'+i+'" title="Apri e modifica"><span data-noi18n>'+esc(f.n)+'</span></button><span class="hint">'+gcKB(String(f.t||"").length)+(f.at?' · '+gcWhen(f.at):'')+'</span><button data-gc="dl" data-gf="'+i+'">Scarica</button><button data-gc="del" data-gf="'+i+'">Elimina</button></li>'}).join("")+'</ul>'
     :'<p class="empty">Nessun file: carica il server.cfg o gli altri file di configurazione.</p>';
  h+='<div class="row"><button data-gc="up">Carica file…</button><button data-gc="new">Nuovo file</button>'+(F.length?'<button data-gc="zip">Scarica tutti (.zip)</button>':'')+'<input type="file" id="gcfile" multiple hidden></div>';
  /* se si ridisegna lo stesso file aperto (Ricava le impostazioni, iscrizioni dal bot…) resta quello che si è scritto e non ancora salvato */
  if(gcEdit!=null){var f=F[gcEdit],ta=$("gcta"),fn=$("gcfname"),keep=!!ta&&gcTaF===f;gcTaF=f;
    var tv=keep?ta.value:(f.t||""),nv=keep&&fn?fn.value:f.n;
    h+='<div class="gced"><div class="row"><input type="text" id="gcfname" value="'+esc(nv)+'" aria-label="Nome del file" spellcheck="false"><button class="p" data-gc="save">Salva il file</button><button data-gc="parse" title="Legge le righe del file e le aggiunge all&#39;elenco delle impostazioni">Ricava le impostazioni</button><button data-gc="close">Chiudi</button></div>'
     +'<textarea id="gcta" spellcheck="false" aria-label="Contenuto del file">'+esc(tv)+'</textarea></div>'}
  else gcTaF=null;
  h+='<h4>Impostazioni</h4>';
  h+=T.length?'<table class="gctab"><thead><tr><th>Nome</th><th>Valore</th><th></th></tr></thead><tbody>'+T.map(function(s,i){var sec=gcSecret(s.k);
    return'<tr><td><input type="text" data-gs="'+i+'" data-gk="k" value="'+esc(s.k||"")+'" aria-label="Nome dell&#39;impostazione" spellcheck="false"></td><td><input type="'+(sec?"password":"text")+'" data-gs="'+i+'" data-gk="v" value="'+esc(s.v||"")+'" aria-label="Valore di '+esc(s.k||"")+'" spellcheck="false" autocomplete="off"></td><td><button data-gc="sdel" data-gs="'+i+'" aria-label="Elimina '+esc(s.k||"")+'">×</button></td></tr>'}).join("")+'</tbody></table>'
     :'<p class="empty">Nessuna impostazione in elenco.</p>';
  h+='<div class="row"><button data-gc="sadd">Aggiungi impostazione</button>'+(GC_TPL[k]?'<button data-gc="tpl">Impostazioni tipiche di '+esc(ORIGL[k]||DEF[k].l)+'</button>':'')+(T.length?'<button data-gc="copy">Copia come testo</button><button data-gc="sdl">Scarica come .cfg</button>':'')+'</div>';
  return h+'</details>';
}
function gcText(T){return T.filter(function(s){return s.k}).map(function(s){return s.k+' "'+String(s.v||"").replace(/"/g,"'")+'"'}).join("\n")+"\n"}
/* righe di un file di configurazione → impostazioni: set k "v", seta k v, k "v", k = v (ini); commenti e sezioni saltati */
function gcParse(txt){
  var out=[];String(txt||"").split(/\r?\n/).forEach(function(l){
    l=l.replace(/^\s+|\s+$/g,"");if(!l||/^(\/\/|#|;|\[)/.test(l))return;
    /* "//" dopo ":" fa parte di un URL (http://…), non è un commento; dopo un valore tra virgolette il resto della riga si ignora */
    var m=l.match(/^(?:set[asu]?\s+)?([A-Za-z_][\w.\-]*)\s*(?:=\s*|\s+)("([^"]*)"(?:\s.*)?|(.*?))\s*(?:(?<!:)\/\/.*)?$/);
    if(!m||/^(exec|bind|alias|echo|say|map|changelevel|writeid|writeip|unbind|plugin_load)$/i.test(m[1]))return;
    out.push({k:m[1],v:m[3]!==undefined?m[3]:String(m[4]||"").replace(/^"|"$/g,"")});
  });
  return out;
}
function gcRead(files){
  var g=G(),c=gcOf(g),n=0,skip=[];
  return Promise.all([].slice.call(files).map(function(fl){
    if(fl.size>GC_MAX){skip.push(fl.name+" (oltre 256 KB)");return null}
    return fl.arrayBuffer().then(function(buf){
      var u=new Uint8Array(buf),t;if(u.indexOf(0)>=0){skip.push(fl.name+" (non è un file di testo)");return}
      try{t=new TextDecoder("utf-8",{fatal:true}).decode(u)}catch(e){t=new TextDecoder("windows-1252").decode(u)}
      t=t.replace(/^﻿/,"");
      if(gcSize()+t.length>GC_TOT){skip.push(fl.name+" (archivio pieno)");return}
      var nm=gcName(fl.name),ex=c.files.filter(function(f){return f.n===nm})[0];
      if(ex){ex.t=t;ex.at=Date.now()}else c.files.push({n:nm,t:t,at:Date.now()});n++;
    });
  })).then(function(){save();render();toast((n?"File caricati: "+n+".":"Nessun file caricato.")+(skip.length?" Saltati: "+skip.join(", ")+".":""))});
}
$("setup").addEventListener("toggle",function(e){if(e.target.id==="gcbox")gcOpen=e.target.open},true);
$("setup").addEventListener("click",function(e){
  var b=e.target.closest("[data-gc]");if(!b)return;var a=b.getAttribute("data-gc"),g=G(),c=gcOf(g),i=+b.getAttribute("data-gf"),f=c.files[i],k=S.cur;
  if(a==="up"){$("gcfile").click();return}
  if(a==="new"){var n=1,nm="server.cfg";while(c.files.some(function(x){return x.n===nm}))nm="config"+(++n)+".cfg";c.files.push({n:nm,t:"",at:Date.now()});gcEdit=c.files.length-1;save();render();setTimeout(function(){var x=$("gcfname");if(x){x.focus();x.select()}},50);return}
  if(a==="open"){gcEdit=i;render();setTimeout(function(){var t=$("gcta");if(t){t.focus();t.scrollIntoView({block:"center"})}},50);return}
  if(a==="close"){gcEdit=null;render();return}
  if(a==="save"&&c.files[gcEdit]){var ed=c.files[gcEdit],txt=$("gcta").value;
    if(txt.length>GC_MAX){toast("Il file supera 256 KB: accorcialo.");return}
    if(gcSize()-String(ed.t||"").length+txt.length>GC_TOT){toast("Archivio delle configurazioni pieno (1,5 MB per torneo).");return}
    ed.n=gcName($("gcfname").value);ed.t=txt;ed.at=Date.now();gcTaF=null;save();render();toast("File salvato: "+ed.n+".");return}
  if(a==="parse"&&c.files[gcEdit]){var P=gcParse($("gcta").value),add=0,upd=0;
    P.forEach(function(p){var ex=c.set.filter(function(s){return s.k===p.k})[0];if(ex){if(ex.v!==p.v){ex.v=p.v;upd++}}else{c.set.push(p);add++}});
    save();render();toast("Impostazioni ricavate: "+add+" nuove, "+upd+" aggiornate.");return}
  if(a==="dl"&&f){dlBlob(new Blob([f.t||""],{type:"text/plain;charset=utf-8"}),f.n);return}
  if(a==="zip"&&c.files.length&&window.SHEETS&&SHEETS.zip){var z=SHEETS.zip(c.files.map(function(x){return{name:x.n,data:x.t||""}}));
    dlBlob(new Blob([z],{type:"application/zip"}),"configurazioni-"+String(DEF[k].l).replace(/[^\w-]+/g,"-").replace(/^-|-$/g,"").toLowerCase()+".zip");return}
  if(a==="del"&&f){delSnap("file "+f.n+" di "+DEF[k].l);c.files.splice(i,1);if(gcEdit===i)gcEdit=null;else if(gcEdit>i)gcEdit--;save();render();toast("File eliminato: "+f.n+".");return}
  if(a==="sadd"){c.set.push({k:"",v:""});save();render();setTimeout(function(){var x=document.querySelectorAll('#setup [data-gk="k"]');if(x.length)x[x.length-1].focus()},50);return}
  if(a==="sdel"){var si=+b.getAttribute("data-gs"),s=c.set[si];if(!s)return;delSnap("impostazione "+(s.k||"")+" di "+DEF[k].l);c.set.splice(si,1);save();render();return}
  if(a==="tpl"){var n2=0;(GC_TPL[k]||[]).forEach(function(x){if(!c.set.some(function(s){return s.k===x})){c.set.push({k:x,v:""});n2++}});save();render();toast(n2?"Aggiunte "+n2+" impostazioni da compilare.":"Le impostazioni tipiche ci sono già.");return}
  if(a==="copy"){var txt2=gcText(c.set);if(navigator.clipboard)navigator.clipboard.writeText(txt2).then(function(){toast("Impostazioni copiate: incollale nella console o nel file del server.")},function(){toast("Non riesco a copiare: usa Scarica come .cfg.")});return}
  if(a==="sdl"){dlBlob(new Blob([gcText(c.set)],{type:"text/plain;charset=utf-8"}),"impostazioni-"+String(DEF[k].l).replace(/[^\w-]+/g,"-").replace(/^-|-$/g,"").toLowerCase()+".cfg");return}
});
$("setup").addEventListener("change",function(e){
  var t=e.target;
  if(t.id==="gcfile"){if(t.files&&t.files.length)gcRead(t.files);t.value="";return}
  var si=t.getAttribute&&t.getAttribute("data-gs"),gk=t.getAttribute&&t.getAttribute("data-gk");if(si===null||!gk)return;
  var c=gcOf(G()),s=c.set[+si];if(!s)return;s[gk]=String(t.value||"").slice(0,gk==="k"?80:2000);save();
  if(gk==="k"){var v=t.closest("tr")&&t.closest("tr").querySelector('[data-gk="v"]');if(v)v.type=gcSecret(s.k)?"password":"text"}
});

window.__app={
  S:function(){return S},
  WALL:WALL,DESK:DESK,esc:esc,toast:toast,dl:dlBlob,fresh:fresh,
  /* lo stesso torneo ricaricato (informazioni modificate) o {keepHist:true}: Ctrl+Z conserva la cronologia */
  load:function(p,o){var same=p===S||!!(o&&o.keepHist);discordFlush();if(!same){dcLast=null;aiRes=[];aiMsg=""}S=p;if(lastDel&&lastDel.ev&&lastDel.ev!==(S.ev&&S.ev.id)){lastDel=null;clearTimeout(delT)}initS();registerCustom();normGames();fixCur();if(!same){hist=[];lastJ=null}applyUi();lastStat=statusMap();save();renderRoster();render();renderArch();botPush()},
  touch:function(){save()},
  DEF:function(){return DEF},makePdf:makePdf,delSnap:function(l){delSnap(l)},evWhen:function(){return evWhen()},
  botLink:function(){return window.__botUser?"https://t.me/"+window.__botUser:""},
  vmOf:function(st){return withSync(st,function(){return botVM()})},
  applyJoin:function(st,k,name,dc){return withSync(st,function(){return joinInto(k,name,dc)})},
  migrateState:migrateState,diffState:diffState,restore:restoreDecoded,
  ui0:UI0,
  games:function(st){
    return withSync(st,function(){var out=[];Object.keys(DEF).forEach(function(k){var g=S.games[k];if(!g)return;var r=result(g,k),on=g.players.length||g.phase!=="setup";if(on)out.push({k:k,l:DEF[k].l,name:g.name||"",st:r.status,n:g.players.length,top:(r.top||[]).filter(Boolean)[0]||""})});return out});
  },
  /* vero mentre la pagina lavora su un altro torneo (S non è quello aperto): niente salvataggi del file dell'evento */
  swapping:function(){return SWAP>0},
  /* proiettore: ridisegna i pannelli (sala.js lo chiama appena caricato, così la Sala compare subito) */
  botRefresh:function(){botRefresh()},
  png:function(k){return makePng(k)},
  wallRebuild:function(){if(WALL&&$("wall"))wRebuild(false)}
};
lastJ=JSON.stringify(S);
if(WALL)wallInit();else{lastStat=statusMap();applyUi();renderRoster();render();botPush();if(S.cur==="sala"&&!window.SALA)document.addEventListener("DOMContentLoaded",function(){if(S.cur==="sala")render()})}
/* dopo un aggiornamento: cosa è cambiato nelle configurazioni */
if(!WALL&&DESK&&DESK.migration)DESK.migration().then(function(m){if(m&&m.prev)setTimeout(function(){toast("Aggiornato da "+m.prev+" a "+m.now+(m.notes&&m.notes.length?": "+m.notes.join("; ")+".":": configurazioni controllate."))},1500)}).catch(function(){});
})();

/* Tornei Fragmarathon: versioni e novità.
   La prima voce è la versione del programma (un test controlla che coincida con package.json).
   Il numero si vede nell'intestazione e nella schermata dei tornei; cliccandolo si apre l'elenco. */
(function () {
  "use strict";
  var CHANGELOG = [
    { v: "3.9.0", d: "2026-10-10", t: "Archivio delle configurazioni dei server e cartellini nuovi", items: [
      "Per ogni gioco un archivio delle configurazioni dei server: carichi i file (server.cfg, .ini…), li modifichi, li scarichi uno per uno o tutti in un .zip, e tieni un elenco di impostazioni nome e valore, con quelle tipiche già pronte per Quake Live, Team Fortress 2, Counter-Strike 2 e Wreckfest.",
      "Le impostazioni si possono ricavare direttamente da un file di configurazione; le password restano nascoste e nulla va ai giocatori. Azzera e Duplica conservano l'archivio.",
      "Cartellini delle postazioni rifatti: titolo e logo del torneo, data, numero della postazione grande, giocatore, IP e QR del Wi-Fi, con i colori e il carattere del tema scelto. Anche le altre pagine del kit hanno il logo."
    ] },
    { v: "3.8.0", d: "2026-10-10", t: "Discord: invito, account dei giocatori e un canale per ogni partita", items: [
      "Nelle informazioni del torneo c'è il link di invito al server Discord: compare sulle schede e nel bot Telegram, e l'app lo può creare da sola.",
      "Con un bot Discord l'app crea un canale per ogni partita pronta, visibile solo ai suoi giocatori, con il server su cui giocare; a partita finita diventa di sola lettura con il risultato. Si attiva in Impostazioni, Discord.",
      "Account Discord dei giocatori: si scrivono in Partecipanti, arrivano dalla colonna Discord di Excel o Google Sheets, oppure li chiede il bot Telegram all'iscrizione (e con /discord)."
    ] },
    { v: "3.7.2", d: "2026-10-10", t: "Ripristino dei backup con migrazione e riepilogo", items: [
      "Un backup di una versione precedente viene portato al formato attuale: i dati che mancavano prendono il valore predefinito e il riepilogo dice quali sono.",
      "Dopo il ripristino un riepilogo per ogni torneo e per ogni bot mostra cosa è cambiato rispetto a prima (titolo, giocatori, giochi, formato, sala, server, impostazioni del bot); resta anche nel registro errori.log.",
      "Corretto: dopo un ripristino fatto dalle Impostazioni, Salva riscriveva il titolo e i nomi dei giochi di prima."
    ] },
    { v: "3.7.1", d: "2026-10-10", t: "Aggiornamenti più sicuri", items: [
      "Dopo un aggiornamento il programma aspetta che la versione vecchia si chiuda invece di chiudersi, e controlla e migra le configurazioni (bot, tornei, diretta): quelle rovinate vengono messe da parte e segnalate.",
      "Un errore imprevisto non chiude più il programma: finisce nel registro Documenti\\Tornei Fragmarathon\\errori.log e, se la pagina si blocca, si ricarica da sola."
    ] },
    { v: "3.7.0", d: "2026-10-10", t: "La Sala e i server sugli incontri", items: [
      "Nuova scheda Sala: pianta della LAN in 2D e in 3D con file di postazioni (anche doppie), giocatori e indirizzi IP, maxischermo, switch, server, Wi-Fi, regia, podio, uscite di sicurezza, estintori, primo soccorso, quadro elettrico, refrigerazione, bagni, bar e altro; si trascina, si ruota, si numera da sola.",
      "Ping delle postazioni e dei server dall'app installata, anche automatico ogni 30 secondi: verde acceso, rosso non risponde.",
      "Server dei giochi con il nome che vuoi (Server 1, Server Alpha, Server Linux q3dm1...): si assegnano a ogni incontro e a ogni girone dal menu sopra all'incontro, e si vedono anche sul proiettore.",
      "Bot Telegram: l'avviso Tocca a te porta il server; /server dice nome, indirizzo e password del server della prossima partita; /mappa manda la mappa con la propria postazione evidenziata.",
      "Mappa della sala sul proiettore e kit PDF da stampare: mappa con legenda, elenco postazioni, Wi-Fi con QR, server, QR del bot e di WhatsApp, cartellini delle postazioni."
    ] },
    { v: "3.6.3", d: "2026-10-10", t: "Musica sul proiettore, impostazioni a menu, AI sul PC guidata", items: [
      "Playlist di musica sul proiettore a schermo intero: file musicali o radio via internet, casuale, ripetizione, volume, titolo del brano sullo schermo; si comanda dal proiettore (M, N, B, + e -) o dall'app principale con il pulsante ♪.",
      "Impostazioni a schermo intero: menu delle sezioni a sinistra e una sezione alla volta a destra; dentro c'è anche l'archivio dei tornei e dei backup. Esc chiude.",
      "Generazione del logo con Stable Diffusion o LocalAI sul PC: se il servizio non risponde, il programma propone l'installazione con i passi, i comandi da copiare e la ricerca automatica sul PC."
    ] },
    { v: "3.6.2", d: "2026-10-10", t: "Versione per telefono", items: [
      "Su telefono il banner è compatto, le schede scorrono in orizzontale e i campi dei moduli occupano tutta la larghezza: niente esce più dallo schermo."
    ] },
    { v: "3.6.1", d: "2026-10-10", t: "Elenco giocatori con Excel e Google Sheets", items: [
      "Esporta l'elenco dei partecipanti per Excel (.xlsx) o in CSV, con squadra e giochi di ciascuno.",
      "Importa da un file .xlsx o .csv, dal link di un foglio Google Sheets o incollando le celle copiate: con una colonna Squadra crea e riempie le squadre, senza duplicare i nomi.",
      "L'app installata parte in italiano finché non scegli un'altra lingua."
    ] },
    { v: "3.6.0", d: "2026-10-10", t: "Dieci lingue", items: [
      "Il programma parla italiano, inglese, spagnolo, francese, tedesco, rumeno, russo, cinese, giapponese e veneto: la lingua dell'interfaccia si sceglie in alto ed è ricordata su questo PC.",
      "Ogni torneo ha la sua lingua (nel modulo Modifica): la usano proiettore, diretta, immagini, PDF e bot Telegram, anche i comandi del bot.",
      "Anche la guida e le novità sono tradotte."
    ] },
    { v: "3.5.4", d: "2026-10-10", t: "Luogo del torneo e token per versione", items: [
      "Nel torneo: si gioca in presenza, online o in entrambi i modi, indirizzo della location e link Google Maps (se manca lo crea dall'indirizzo); compaiono sulla scheda e nel benvenuto del bot.",
      "Nelle novità, i token di Claude spesi per ogni versione e il totale."
    ] },
    { v: "3.5.3", d: "2026-10-10", t: "Bot nei gruppi e nei canali", items: [
      "Quando qualcuno aggiunge il bot a un gruppo o canale, gli amministratori ricevono un messaggio con Abilita, Esci ed Esci e blocca; finché non è abilitato il bot non scrive nulla lì.",
      "Abilitato, il bot si presenta con il link per scrivergli in privato, risponde a /tornei, /classifica, /partite, /risultati, /diretta e riceve annunci e diretta.",
      "Dal telefono: /gruppi mostra dove è stato inserito, con i pulsanti per abilitare, uscire o bloccare chi lo ha aggiunto; /bloccati per sbloccare.",
      "Chi viene bloccato non può più aggiungere il bot (esce da solo) e i suoi messaggi privati vengono ignorati.",
      "La stessa gestione è nelle Impostazioni del bot, sezione Gruppi e canali."
    ] },
    { v: "3.5.2", d: "2026-10-10", t: "Bot sempre accesi, backup cifrato di tutti i tornei", items: [
      "Tutti i bot Telegram partono con il programma e rispondono per tutti i tornei che li usano, anche se non sono aperti: iscrizioni, immagini e avvisi compresi.",
      "Interruttore acceso/spento per ogni bot nella schermata dei tornei, con le iscrizioni da confermare.",
      "Le immagini mandate su Telegram hanno una filigrana con il banner del torneo, la data e l'ora.",
      "Backup cifrato con password (AES-256) di tutti i tornei e dei bot, oppure del solo torneo aperto; il ripristino chiede la password.",
      "Titolo e sottotitolo si modificano cliccandoli nel banner; cliccando il logo lo cambi.",
      "Nel torneo: ora di inizio, link al gruppo WhatsApp e al canale Telegram; il bot li mostra con /start insieme al proprio link.",
      "Impostazioni nell'ingranaggio in alto.",
      "Free for all con più campi (posizione, uccisioni…): i nomi non finiscono più sotto le caselle, i gironi si adattano alla larghezza dello schermo."
    ] },
    { v: "3.5.1", d: "2026-10-10", t: "Rinomina, duplica, annulla cancellazione, ricerca", items: [
      "Rinomina giocatori e squadre cliccando sul nome: cambia ovunque, anche nei tabelloni, nei risultati e nel bot.",
      "Duplica un gioco o un torneo intero, con o senza risultati.",
      "Via il pulsante Annulla: dopo ogni cancellazione compare per un minuto \"Annulla cancellazione\" (anche Ctrl+Z), anche per tornei e bot eliminati.",
      "Tutti i pannelli e le sezioni delle impostazioni si comprimono cliccando il titolo; lo stato resta ricordato.",
      "Ricerca delle sezioni (pulsante Cerca o Ctrl+K): schede, giochi, impostazioni, guida e comandi.",
      "Cerca, Tornei e versione in una barra sopra il banner."
    ] },
    { v: "3.5.0", d: "2026-10-10", t: "Elenco dei tornei e più bot Telegram", items: [
      "All'avvio si vede l'elenco dei tornei: scegli quale amministrare, creane uno nuovo (vuoto o partendo da un altro), duplicalo, esportalo, importalo, eliminalo (va nel cestino).",
      "Ogni torneo ha le sue impostazioni: nome, data, luogo, colore, tema, logo, formule e il bot Telegram scelto.",
      "Più bot Telegram, ognuno con token, ruoli, iscritti, avvisi e messaggio di benvenuto propri; gira quello del torneo aperto.",
      "Tornei e singoli giochi \"in lavorazione\": nel bot li vedono solo amministratori e organizzatori, e il proiettore non li mostra.",
      "Eliminare un gioco dal torneo (con backup automatico); i giochi base si rimettono dal pulsante +.",
      "Versione visibile in alto: cliccandola si aprono le novità di tutte le versioni."
    ] },
    { v: "3.4.2", d: "2026-10-10", t: "Token del bot più semplice", items: [
      "Incollando il token si prende quello completo anche dal messaggio intero di BotFather o se va a capo; pulsante Mostra; si vede quale token è salvato.",
      "Errori chiari (token troncato, revocato, Telegram non raggiungibile) e uso del proxy di sistema."
    ] },
    { v: "3.4.1", d: "2026-10-10", t: "Ruoli e giocatori nel bot", items: [
      "Ruoli (amministratore, organizzatore anche per singolo torneo, partecipante) gestibili dalle impostazioni, anche per username.",
      "Collegamento account Telegram e giocatore, con avvisi personali: tocca a te, risultati, posizione finale."
    ] },
    { v: "3.4.0", d: "2026-10-10", t: "Diretta dal programma", items: [
      "Diretta su YouTube, Twitch o RTMP senza OBS: schermo del proiettore, telecamere, microfono, audio del PC, scene, riconnessione automatica.",
      "Il bot avvisa tutti quando parte la diretta; /diretta per vedere il link."
    ] },
    { v: "3.3.0", d: "2026-10-10", t: "Bot Telegram", items: [
      "Tornei, classifiche, partite, Hall of Fame, avvisi, iscrizioni e annunci dal telefono.",
      "Il pulsante Modifica ora si chiama Impostazioni."
    ] },
    { v: "3.2.2", d: "2026-10-10", t: "Hall of Fame pesata", items: [
      "Punti per la posizione finale di ogni torneo più i punti fatti, con peso a scelta o formula libera."
    ] },
    { v: "3.2.1", d: "2026-10-10", t: "Ricalcolo delle formule", items: [
      "Pulsante Ricalcola quando cambi le formule; se cambiano i qualificati di una fase già partita, avviso con Rigenera (backup prima)."
    ] },
    { v: "3.2.0", d: "2026-10-10", t: "Formule, logo con l'AI, proiettore pieno", items: [
      "Calcolo dei punti con formule per ogni torneo.",
      "Logo generato con l'AI per l'evento o per ogni torneo (locale o remota).",
      "Proiettore: opzione Riempi lo schermo (tasto R)."
    ] },
    { v: "3.1.3", d: "2026-10-10", t: "Logo e CSS personalizzato", items: [
      "Logo dell'evento in intestazione, immagini e PDF.",
      "CSS personalizzato importabile da file, con modello da scaricare."
    ] },
    { v: "3.1.2", d: "2026-10-10", t: "Temi dei colori", items: [
      "Tema automatico per gioco, Fragmarathon e temi ispirati a Challonge, start.gg, ESL, Liquipedia, Battlefy.",
      "La doppia eliminazione indica winner bracket e loser bracket."
    ] },
    { v: "3.1.1", d: "2026-10-10", t: "Proiettore per pannello", items: [
      "Icona del proiettore su ogni pannello: mostra solo quel pannello, ingrandito.",
      "PgUp e PgDn per passare tra i pannelli; galleria con i secondi tra una schermata e l'altra."
    ] },
    { v: "3.1.0", d: "2026-10-10", t: "Nuovi formati e proiettore", items: [
      "Doppia eliminazione, sistema svizzero, gironi all'italiana con playoff.",
      "Schermo proiettore separato, leggibile da lontano, aggiornato in tempo reale.",
      "Trascina giocatori e squadre; free for all con gironi di qualsiasi grandezza; Hall of Fame per gioco.",
      "Archivio tornei, backup automatici, guida contestuale, aggiornamenti automatici, app installabile dal browser."
    ] }
  ];
  if (typeof module !== "undefined") { module.exports = CHANGELOG; return; }
  if (/[?&]wall=1/.test(location.search) || /stream\.html$/.test(location.pathname)) return;
  window.CHANGELOG = CHANGELOG;
  var VER = CHANGELOG[0].v, dlg = null;

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /* token di Claude spesi per ogni versione (js/tokens.js, generato da tools/tokens.mjs) */
  function tk(n) { return n >= 1e6 ? (n / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + " M" : n >= 1e3 ? Math.round(n / 1e3) + " k" : String(n || 0); }
  function tokLine(v) { var T = window.TOKENS, b = T && T.byVersion && T.byVersion[v]; return b ? '<span class="cl-tok" title="Token di Claude per questa versione: ' + tk(b.tot) + ' in tutto, di cui ' + tk(b.out) + ' scritti">' + tk(b.tot) + ' token</span>' : ""; }
  function tokHead() {
    var T = window.TOKENS; if (!T || !T.total) return "";
    return '<p class="cl-toks">Per costruire il programma con Claude sono serviti <b>' + tk(T.total.tot) + ' token</b> (' + tk(T.total.out) + ' scritti dal modello, il resto letto e riletto come contesto), in ' + T.total.msgs.toLocaleString("it-IT") + ' risposte. Sotto, il conto di ogni versione.</p>';
  }
  function fmt(d) { var x = new Date(d + "T12:00:00"); return isNaN(x) ? "" : x.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }); }
  function open() {
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "changelog"; dlg.setAttribute("aria-labelledby", "cl-h");
      dlg.innerHTML = '<div class="cl-head"><h2 id="cl-h">Novità</h2><span class="cl-cur">Hai la versione ' + esc(VER) + '</span><button type="button" class="cl-x" aria-label="Chiudi">Chiudi</button></div>' +
        tokHead() + '<ol class="cl-list">' + CHANGELOG.map(function (r, i) {
          return '<li' + (i === 0 ? ' class="now"' : "") + '><div class="cl-v"><b>' + esc(r.v) + '</b><time datetime="' + esc(r.d) + '">' + esc(fmt(r.d)) + '</time>' + tokLine(r.v) + '</div>' +
            '<div class="cl-b"><h3>' + esc(r.t) + '</h3><ul>' + r.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div></li>';
        }).join("") + '</ol>';
      dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest(".cl-x")) dlg.close(); });
      document.body.appendChild(dlg);
    }
    dlg.showModal(); dlg.querySelector(".cl-list").scrollTop = 0;
  }
  function button(cls) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "verbtn " + (cls || ""); b.textContent = "v" + VER; b.title = "Versione del programma: clicca per le novità";
    b.addEventListener("click", open);
    return b;
  }
  window.VERSION = { v: VER, open: open, button: button };
  function apptools() { var t = document.getElementById("apptools"), br = document.querySelector(".brand"); if (!t && br) { t = document.createElement("div"); t.id = "apptools"; br.parentNode.insertBefore(t, br); } return t; }
  var tb = apptools(); if (tb) tb.appendChild(button("inbrand"));
})();

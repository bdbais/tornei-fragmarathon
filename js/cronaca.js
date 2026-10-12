/* Tornei Fragmarathon — storico delle partite di un torneo, con la cronaca in stile telecronaca.
   Logica pura, senza DOM: riceve i "fatti" costruiti dall'app (solo dati: risultati, orari, classifiche)
   e restituisce il file Markdown da scaricare, i dati arricchiti e le righe per l'anteprima.
   In node: module.exports; nella pagina: window.CRONACA.

   Il file è per le persone e, tra anni, per un programma o un'intelligenza artificiale: front matter YAML,
   cronaca leggibile, in fondo il JSON completo (chiavi inglesi fisse, schema SCHEMA).
   I commenti sono colore: mai fatti inventati (uccisioni, mappe, minuti, pubblico), solo i dati veri.

   Traduzioni: ogni frase è un modello italiano intero con segnaposto ({w} vincitore, {l} perdente, ...).
   Si traduce il modello con opt.tr e poi si mettono i nomi, che non si traducono mai.
   tools/i18n-extract.mjs estrae i modelli interi, segnaposto compresi.

   build(facts, opt) -> { md, data, lines }
     facts.games[].seeded true = ci sono teste di serie: participants[].seed è la posizione (null per chi non lo è);
     participants[].rating (facoltativo) = punteggio della ladder (js/ladder.js). La sorpresa usa le teste di serie,
     o in mancanza la ladder.
     opt: { tr (frasi di questo file), trData (etichette dei fatti: fase, stato, formato; di base tr), now }
     lines: [{ game, id, at (ISO o null), time ("21:04", con la data se l'evento dura più giorni), stage, text, comment }] */
(function (root) {
  "use strict";

  var SCHEMA = "tornei-fragmarathon/storico@1";
  var APP = "Tornei Fragmarathon";
  var KINDS = ["final", "semi", "third", "grand", "bella", "winners", "losers", "group", "swiss", "heat", "round"];
  /* partite in cui perdere non elimina: solo qui una serie di vittorie dice qualcosa */
  var STREAKY = /^(group|swiss|heat)$/;
  /* etichette dei formati, se l'app non le passa (sono le stesse del programma) */
  var FMT = {
    ffa: "Free for all a punti (battle royale)",
    elim: "Eliminazione diretta",
    double: "Doppia eliminazione (winner + loser bracket)",
    de: "Doppia eliminazione (winner + loser bracket)",
    swiss: "Sistema svizzero + playoff",
    sw: "Sistema svizzero + playoff",
    rr: "Gironi all'italiana + playoff"
  };
  var OWN = Object.prototype.hasOwnProperty;

  /* ---------------- I commenti ----------------
     Varianti per ogni situazione; la scelta dipende da gioco e partita (sempre la stessa per lo stesso torneo).
     Segnaposto: {w} vincitore, {l} perdente, {a} {b} i due lati, {s} punteggio dal lato del vincitore,
     {e} chi esce, {i} {j} teste di serie di vincitore e perdente, {k} vittorie di fila, {g} nome del gioco,
     {x} {y} secondo e terzo classificato (nomi), {c} campione, {p} elenco di nomi, {f} formato, {t} titolo,
     {n} un numero (quanti giocatori, squadre, tornei).
     I numeri stanno dentro la frase intera, mai in un pezzo già composto («8 squadre»): per l'italiano il codice
     sceglie il modello singolare o plurale; chi traduce in una lingua con più forme (russo, romeno) scrive la frase
     in modo che vada bene con ogni numero. */
  var V = {
    first: [
      "Pronti, via!",
      "Ed eccoci al primo verdetto di {g}!",
      "Prima partita, prime emozioni!",
      "Il primo risultato di {g} è già storia!"
    ],
    win: [
      "{w} piazza il colpo e supera {l}. Si continua!",
      "Vittoria preziosa per {w}, che si lascia alle spalle {l}!",
      "Ecco {w}! Sfida vinta contro {l}, e la corsa continua.",
      "{l} ci prova fino in fondo, ma l'ultima parola è di {w}!",
      "Missione compiuta per {w}: {l} deve alzare bandiera bianca.",
      "Il verdetto è servito: vince {w}, e a {l} non resta che incassare."
    ],
    close: [
      "Sul filo di lana! {w} la spunta {s} su {l}: cuori in gola!",
      "Che battaglia! {w} vince {s}, ma {l} ha venduto cara la pelle.",
      "Un soffio, un niente: {w} batte {l} {s}. Partite così si raccontano per anni!",
      "Margine sottilissimo: {s}, e {w} supera {l} di un'incollatura!",
      "Brividi! {w} chiude {s} contro {l}: equilibrio da cardiopalma!"
    ],
    crush: [
      "Lezione di {w}! {s} su {l}: partita a senso unico.",
      "Che dominio, signori! {w} travolge {l} con un perentorio {s}.",
      "{w} non fa prigionieri: {s} e pratica archiviata contro {l}!",
      "Rullo compressore {w}! Finisce {s} contro {l}: non c'è stata storia.",
      "Prova di forza di {w}: {s} a {l}, e un messaggio chiaro a tutto il torneo!"
    ],
    clean: [
      "Zero concessioni: {w} chiude {s} e {l} resta a secco!",
      "{s}! {w} non lascia nemmeno le briciole a {l}.",
      "Partita perfetta di {w}: {s}, e sul tabellino di {l} resta uno zero tondo tondo.",
      "Cappotto! {w} chiude {s} senza concedere nulla a {l}.",
      "Porta chiusa a doppia mandata: {w} vince {s} e {l} non va mai a segno."
    ],
    draw: [
      "Pareggio! {a} e {b} si dividono la posta e nessuno torna a casa a mani vuote.",
      "Nessun vincitore e nessun vinto: {a} e {b} si annullano a vicenda. Che equilibrio!",
      "Tutto in parità tra {a} e {b}: una partita che non ha voluto scegliere!",
      "Braccio di ferro senza padroni: {a} e {b} chiudono in perfetta parità!"
    ],
    forfeit: [
      "Vittoria a tavolino per {w}: si vince anche così, e il risultato resta agli atti.",
      "Niente battaglia stavolta: {w} passa a tavolino su {l} e si mette in tasca il risultato.",
      "Il campo resta vuoto e il verdetto lo scrive il regolamento: vittoria a tavolino per {w}.",
      "{w} incassa la vittoria a tavolino contro {l}. Non è lo spettacolo che sognavamo, ma il regolamento parla chiaro!"
    ],
    forfeitWd: [
      "Il ritiro di {l} consegna la vittoria a tavolino a {w}. Peccato, avremmo voluto vederla giocata!",
      "{l} ha lasciato il torneo, e {w} incassa il risultato a tavolino. Si va avanti!",
      "Un posto vuoto e un verdetto già scritto: dopo il ritiro di {l}, vittoria a tavolino per {w}."
    ],
    upset: [
      "Clamoroso! La testa di serie numero {i}, {w}, abbatte la numero {j}, {l}. Pronostico in frantumi!",
      "Sorpresa, signore e signori, sorpresa! {w}, testa di serie numero {i}, batte {l}, che partiva con il numero {j}!",
      "Chi l'avrebbe detto? {w}, numero {i} del tabellone, rovescia ogni pronostico contro {l}, numero {j}!",
      "Il tabellone diceva {l}, il campo dice {w}! La testa di serie numero {i} manda al tappeto la numero {j}."
    ],
    /* la stessa sorpresa fuori dai tabelloni (gironi, svizzero, manche): solo le frasi che non parlano di tabellone */
    upsetG: [
      "Clamoroso! La testa di serie numero {i}, {w}, abbatte la numero {j}, {l}. Pronostico in frantumi!",
      "Sorpresa, signore e signori, sorpresa! {w}, testa di serie numero {i}, batte {l}, che partiva con il numero {j}!"
    ],
    /* sorpresa secondo la ladder (senza teste di serie): il perdente aveva almeno 100 punti più del vincitore */
    upsetR: [
      "Pronostico ribaltato! Sulla carta il favorito era {l}, ma a vincere è {w}!",
      "Vince lo sfavorito! {w} batte {l} e manda in frantumi i pronostici della classifica.",
      "La classifica diceva {l}, il campo dice {w}! Una vittoria contro ogni pronostico.",
      "Davide contro Golia, e stavolta vince Davide: {w} supera {l}, il grande favorito della vigilia!"
    ],
    out: [
      "{w} passa il turno, e per {e} il torneo finisce qui. Onore a chi esce!",
      "Fuori {e}! {w} chiude la pratica e guarda già alla prossima sfida.",
      "Si spengono le speranze di {e}: {w} non perdona e va avanti!",
      "Dentro o fuori, e stavolta è fuori {e}. {w} prosegue la sua corsa!",
      "Il tabellone non fa sconti: {e} saluta il torneo, {w} vola al turno successivo.",
      "{w} vince lo scontro che non ammette errori e chiude il torneo di {e}!"
    ],
    outTag: [
      "Per {e} il torneo finisce qui.",
      "Si chiude qui l'avventura di {e}.",
      "Fine della corsa per {e}.",
      "Per {e} si spengono i riflettori."
    ],
    drop: [
      "{w} vince e resta nel tabellone dei vincenti; {l} scivola tra i perdenti, ma la corsa non è finita!",
      "Primo passo falso per {l}, che scende nel tabellone dei perdenti. {w} invece tira dritto!",
      "{w} si prende la sfida dei vincenti. Per {l} c'è ancora una vita: appuntamento nel tabellone dei perdenti!",
      "Nella doppia eliminazione si cade e ci si rialza: {l} perde contro {w} e ora dovrà risalire dal tabellone dei perdenti."
    ],
    dropTag: [
      "{l} scende nel tabellone dei perdenti, ma non è finita.",
      "Per {l} la strada continua nel tabellone dei perdenti.",
      "{l} ha ancora una vita da giocarsi tra i perdenti."
    ],
    semi: [
      "{w} vola in finale! Per {l} resta l'ultima occasione: la sfida per il bronzo.",
      "Biglietto per la finale staccato da {w}! {l} proverà a consolarsi con la finale per il terzo posto.",
      "È {w} a prendersi la semifinale, e con lei un posto nell'ultimo atto. {l} tenterà di salvare il podio.",
      "Semifinale conquistata da {w}! {l} non molla: c'è ancora un bronzo in palio."
    ],
    semiOut: [
      "{w} vola in finale! Per {l} il sogno si ferma a un passo dall'ultimo atto.",
      "Finale conquistata da {w}! {l} saluta il torneo in semifinale, a testa alta.",
      "Ultimo ostacolo superato: {w} è in finale, mentre {l} deve fermarsi qui.",
      "La finale ha un nome in più: {w}! Per {l} il viaggio finisce in semifinale."
    ],
    third: [
      "Il bronzo è di {w}! Un posto sul podio strappato a {l}.",
      "{w} sale sul gradino più basso del podio, mentre {l} chiude al quarto posto.",
      "Finale per il terzo posto a {w}: medaglia di bronzo meritata, e {l} si ferma ai piedi del podio.",
      "Non è la finalissima, ma vale una medaglia: e la medaglia di bronzo se la prende {w}!"
    ],
    final: [
      "È finita! {w} batte {l} e si prende il titolo! Signore e signori, abbiamo un campione!",
      "Il cielo di {g} si tinge dei colori di {w}! Finale vinta contro {l}: ora sappiamo chi comanda!",
      "Tutto in una partita, e {w} non trema: {l} si arrende in finale e il trono è suo!",
      "Ed è trionfo! {w} vince la finale contro {l} e scrive il proprio nome nell'albo d'oro di {g}!"
    ],
    finalClose: [
      "Una finale decisa al fotofinish! {w} batte {l} {s} e si prende il titolo per un soffio!",
      "Che finale, signori, che finale! {s} per {w}, e {l} esce dall'ultimo atto a testa altissima.",
      "Sul filo di lana, nel momento che conta di più: {w} vince la finale {s} e sale sul trono!"
    ],
    grandReset: [
      "Colpo di scena! {w} batte {l} nella finale e riapre tutto: si va alla bella!",
      "Non è ancora finita! {w} vince la finale e costringe {l} alla partita decisiva.",
      "Tutto da rifare! Con questa vittoria {w} trascina la finale alla bella. Che spettacolo!"
    ],
    bella: [
      "Alla bella, tutto o niente: e il tutto se lo prende {w}! {l} si ferma a un passo dalla gloria.",
      "La partita decisiva della doppia eliminazione premia {w}! Il titolo è suo, dopo una finale lunga due partite.",
      "Bella decisiva, verdetto definitivo: {w} si prende il titolo, {l} si inchina dopo una sfida infinita."
    ],
    heat3: [
      "{w} si prende la manche! Alle sue spalle {x} e {y}.",
      "Manche a {w}, davanti a tutti! Completano il podio {x} e {y}.",
      "Nessuno fa meglio di {w} in questa manche: secondo posto per {x}, terzo per {y}.",
      "Primo posto per {w}! {x} e {y} restano in scia."
    ],
    heat2: [
      "{w} si prende la manche davanti a {x}!",
      "Manche a {w}: {x} deve accontentarsi del secondo posto.",
      "Nessuno fa meglio di {w} in questa manche! Secondo posto per {x}."
    ],
    heat1: [
      "Manche a {w}!",
      "{w} chiude la manche al primo posto!"
    ],
    heatTie2: [
      "Manche a {w}! Alle sue spalle, appaiati al secondo posto, {p}.",
      "{w} si prende la manche, mentre {p} si dividono il secondo posto!"
    ],
    heatTie: [
      "Pari merito in vetta alla manche: {p} chiudono appaiati!",
      "Impossibile separarli: {p} si dividono il primo posto della manche!",
      "Primo posto condiviso tra {p}: la manche non ha voluto un solo padrone!"
    ],
    heatFinal: [
      "È {w} a vincere la finale! Il titolo è suo, signore e signori!",
      "Ultima manche, ultimo verdetto: {w} chiude davanti a tutti e si prende il torneo!",
      "La finale incorona {w}! Nessuno ha fatto meglio quando contava davvero."
    ],
    streak: [
      "E sono {k} vittorie di fila per {w}: qualcuno ha un piano per fermare questa corsa?",
      "{w} non si ferma più: {k} successi consecutivi!",
      "Striscia aperta per {w}: siamo a {k} vittorie una dietro l'altra!",
      "Fanno {k} di fila per {w}. Qui si sta costruendo qualcosa di grosso!"
    ],
    gameIntroP: [
      "Si apre il sipario su {g}: {n} giocatori ai nastri di partenza, formula «{f}». Che vinca il migliore!",
      "E adesso spazio a {g}! In gara {n} giocatori, formula «{f}»: alla fine il trono avrà un solo padrone.",
      "Riflettori puntati su {g}: {n} giocatori in gara con la formula «{f}». Qui ogni partita conta, ogni errore si paga!",
      "Tocca a {g}! In campo {n} giocatori, formula «{f}»: la storia aspetta solo di essere scritta."
    ],
    gameIntroT: [
      "Si apre il sipario su {g}: {n} squadre ai nastri di partenza, formula «{f}». Che vinca la migliore!",
      "E adesso spazio a {g}! In gara {n} squadre, formula «{f}»: alla fine il trono avrà un solo padrone.",
      "Riflettori puntati su {g}: {n} squadre in gara con la formula «{f}». Qui ogni partita conta, ogni errore si paga!",
      "Tocca a {g}! In campo {n} squadre, formula «{f}»: la storia aspetta solo di essere scritta."
    ],
    champ: [
      "Signore e signori, il campione di {g} è {c}!",
      "È {c} a mettere le mani su {g}: titolo meritato e nome scolpito nell'albo d'oro!",
      "Il trono di {g} ha finalmente un padrone: {c}!",
      "Titoli di coda su {g}: vince {c}, e lo fa da campione vero!"
    ],
    medals3: [
      "Argento per {x}, bronzo per {y}.",
      "Completano il podio: al secondo posto {x}, al terzo {y}.",
      "Medaglia d'argento a {x}, medaglia di bronzo a {y}: onore al podio!"
    ],
    medals2: [
      "Argento per {x}.",
      "Al secondo posto {x}, a un passo dalla gloria.",
      "Medaglia d'argento a {x}: onore al merito!"
    ],
    gameEnd: [
      "Un torneo da raccontare, e adesso è storia. Grazie a tutti i protagonisti!",
      "Si chiude qui: chi c'era se lo ricorderà a lungo.",
      "Cala il sipario. Onore a chi ha vinto e a chi ci ha provato fino in fondo!"
    ],
    gameOpen: [
      "Per ora ci fermiamo qui: {g} è ancora tutto da scrivere. Restate con noi!",
      "La corsa di {g} continua, e i verdetti più pesanti sono ancora da emettere.",
      "{g} è ancora in pieno svolgimento, e il bello deve ancora venire!"
    ],
    /* il campione c'è, ma il gioco non è finito (es. la finale per il 3º posto si gioca dopo la finale) */
    champOpen: [
      "Il titolo è assegnato, ma {g} non ha ancora detto l'ultima parola: restano partite da giocare!",
      "Il campione c'è già, ma su {g} non sono ancora calate le luci: c'è ancora qualcosa in palio!"
    ],
    leader: [
      "Al comando, per ora, {c}.",
      "In testa alla classifica, per adesso, {c}."
    ],
    gameNew: [
      "{g} non è ancora cominciato: la pagina è bianca e tutta da scrivere.",
      "Per {g} è ancora tutto da giocare: appuntamento al primo verdetto!"
    ],
    evIntro: [
      "Signore e signori, benvenuti! Questo è {t}: {n} tornei in programma e una sola certezza, qui nessuno è venuto per fare il turista!",
      "Accendete i riflettori e alzate il volume: va in scena {t}, con {n} tornei in cartellone!",
      "Benvenuti, benvenuti, benvenuti a {t}! Davanti a noi {n} tornei e la sensazione che qui si scriverà qualcosa di memorabile.",
      "Ci siamo, signore e signori: si apre {t}, e il programma dice {n} tornei. Tenetevi forte!"
    ],
    evIntro1: [
      "Signore e signori, benvenuti! Questo è {t}, e in cartellone c'è {g}: qui nessuno è venuto per fare il turista!",
      "Accendete i riflettori e alzate il volume: va in scena {t}, con {g} in cartellone!",
      "Benvenuti, benvenuti, benvenuti a {t}! Davanti a noi {g} e la sensazione che qui si scriverà qualcosa di memorabile."
    ],
    evIntro0: [
      "Signore e signori, benvenuti a {t}! Il cartellone è ancora tutto da scrivere: restate con noi."
    ],
    evLan: [
      "Tutti nella stessa sala, schermo contro schermo: questa è una LAN party!",
      "Una LAN party vera, con gli avversari a pochi passi: preparatevi alle scintille!"
    ],
    evOnline: [
      "Si gioca online: avversari lontani, sfide vicinissime!",
      "Collegati da ogni angolo, uniti da un solo obiettivo: vincere!"
    ],
    evEnd: [
      "Si spengono le luci su {t}, e l'albo d'oro parla chiaro: {c}. Grazie a tutti, e alla prossima battaglia!",
      "Signore e signori, è stato un onore raccontarvi {t}. I nomi da ricordare sono questi: {c}. Alla prossima!",
      "E qui si chiude {t}: la gloria va a {c}. Grazie a tutti, è stato uno spettacolo!"
    ],
    evEndPlain: [
      "Si spengono le luci su {t}. Grazie a tutti, e alla prossima battaglia!",
      "E qui si chiude {t}. Grazie a tutti, è stato uno spettacolo!"
    ],
    evOpen: [
      "Per ora il racconto di {t} si ferma qui, ma la storia è tutt'altro che finita!",
      "Questo è il punto della situazione su {t}: altri verdetti in arrivo. Restate sintonizzati!",
      "{t} non ha ancora finito di stupirci: c'è ancora tanto da giocare. Non andate via!"
    ]
  };

  /* Legenda del JSON, in inglese come le chiavi (contratto per i programmi): fissa, non si traduce */
  var LEGEND = {
    about: "Field guide for this JSON. The texts intro, outro and comment are only commentary in the style of a TV host: the facts are the results, the times and the standings.",
    times: "The fields at, started, finished and generated are ISO 8601 with the UTC offset of the computer that wrote the file. The field at is null for a match that is not played yet, and also for a played match whose time was not recorded (state done with at null: older versions of the program).",
    "participants.seed": "Seeding rank set by the organizer before the draw (1 = top seed), or null for a participant without a seed; the game has seeded true when it had seeds. Files from older versions put here the order of registration: with seeded false the bracket was drawn at random and that number says nothing about the strength of the participant.",
    "participants.rating": "Rating in the ladder across tournaments (Elo style, everyone starts at 2000) from the last calculation of the ladder before the file was written, so it can already include the results of this tournament; for a team it is the mean of its members. Null when the participant has no rating.",
    "participants.withdrawn": "The participant left the tournament; the matches left to play were awarded to the opponents (forfeit true).",
    "matches.order": "Position of the match in the bracket or schedule, round after round; the text follows the times when every played match has one, otherwise this order.",
    "matches.kind": "final; semi (semifinal); third (match for the 3rd place); grand (grand final of a double elimination); bella (the deciding rematch of the grand final, played when the finalist from the lower bracket wins the first one); winners and losers (upper and lower bracket of a double elimination); group (group stage); swiss (round of the swiss system); heat (heat of a free for all with many players); round (any other knockout round).",
    "matches.state": "done = played or decided, ready = can be played now, pending = waits for the results of other matches.",
    "matches.sides and score": "score[0] goes with sides[0] and score[1] with sides[1]. The score is null when the result was entered without points. In some games the winner is the side with the lower score: the field winner is the truth.",
    "matches.draw": "In a match between two sides it is a draw. In a heat it means that the first place was shared.",
    "matches.forfeit": "Win awarded without playing (the opponent withdrew or did not show up).",
    "matches.bye": "Only on a bye of the swiss system: the participant had no opponent in that round and gets a win in the standings. The time is the moment of the draw of the round; there is no comment.",
    "matches.eliminated": "Who leaves the tournament with this result. A null value means that nobody leaves with this match, or that the format does not eliminate with single matches (groups, swiss, heats: see the standings and advanced).",
    "matches.heat": "Ranking of the heat: name, score (null when missing) and pos (the same number for a shared position).",
    "matches.adv and advanced": "adv is how many go through from the heat; advanced is the list of who actually went through (the rules of the program break the ties at the cut).",
    "games.format": "Internal code of the format: elim (single elimination), double or de (double elimination), rr (groups and playoffs), swiss or sw (swiss system and playoffs), ffa (free for all with points in every heat). The field formatLabel is the readable name in the language of the file.",
    "games.standings": "Final standings when done is true, otherwise provisional; the same pos means a tie. A game can have the champion before the end (the match for the 3rd place is played after the final).",
    "games.numbers": "The values widest and closest are match ids, or null when no match stands out; longest_streak counts the wins in a row and is given only for formats where a defeat does not end the run (groups, swiss, heats)."
  };

  /* ---------------- Dati: si copia solo quello che prevede lo schema ----------------
     Niente password, account, indirizzi di server: se arrivano per errore nei fatti, qui si perdono. */
  function str(v) { return v == null || typeof v === "object" || typeof v === "function" ? "" : String(v).trim(); }
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") { var n = Number(v); return isFinite(n) ? n : null; }
    return null;
  }
  function int1(v) { var n = num(v); return n != null && n >= 1 ? Math.floor(n) : null; }
  function list(v) { return Array.isArray(v) ? v : []; }
  function names(v) { return list(v).map(str).filter(Boolean); }
  function obj(v) { return v && typeof v === "object" ? v : {}; }
  /* un orario in millisecondi che diventa una data vera (anni 1000-9999), altrimenti null */
  function time(v) { var n = num(v); return n != null && n > 0 && iso(n) ? n : null; }

  function cleanMatch(m, i) {
    if (!m || typeof m !== "object") return null;
    var state = m.state === "done" || m.state === "ready" ? m.state : "pending";
    var sc = Array.isArray(m.score) ? [num(m.score[0]), num(m.score[1])] : null;
    if (!sc || sc[0] == null || sc[1] == null) sc = null;
    /* at: null = non giocata; 0 = giocata ma senza orario (versioni vecchie) */
    var at = null;
    if (state === "done") at = time(m.at) || 0;
    var heat = Array.isArray(m.heat) ? m.heat.map(function (h) {
      h = obj(h);
      return { name: str(h.name), score: num(h.score), pos: int1(h.pos) };
    }).filter(function (h) { return h.name; }) : [];
    var w = str(m.winner) || null, o = {
      id: str(m.id) || "m" + (i + 1),
      order: num(m.order) != null ? num(m.order) : i,
      at: at,
      stage: str(m.stage),
      kind: KINDS.indexOf(m.kind) >= 0 ? m.kind : (heat.length ? "heat" : "round"),
      state: state,
      sides: names(m.sides),
      score: sc,
      winner: w,
      draw: !!m.draw && !w,
      forfeit: !!m.forfeit,
      eliminated: str(m.eliminated) || null,
      heat: heat.length ? heat : null
    };
    if (o.heat) {
      o.adv = int1(m.adv);
      if (!o.sides.length) o.sides = heat.map(function (h) { return h.name; });
      /* chi è passato davvero (con la parità sul taglio decide la regola del programma, non pos <= adv) */
      var hn = heat.map(function (h) { return h.name; });
      o.advanced = Array.isArray(m.advanced) ? names(m.advanced).filter(function (n, k, a) { return hn.indexOf(n) >= 0 && a.indexOf(n) === k; }) : null;
    }
    /* riposo dello svizzero: niente avversario, vale una vittoria in classifica */
    if (m.bye === true && state === "done" && o.sides.length === 1) { o.bye = true; o.winner = o.sides[0]; o.score = null; o.forfeit = false; o.draw = false; }
    return o;
  }

  function cleanGame(g, gi) {
    g = obj(g);
    var key = str(g.key) || "g" + (gi + 1), format = str(g.format);
    return {
      key: key,
      game: str(g.game) || str(g.name) || key,
      name: str(g.name) || str(g.game) || key,
      format: format,
      formatLabel: str(g.formatLabel) || (OWN.call(FMT, format) ? FMT[format] : ""),
      team: !!g.team,
      /* true: ci sono teste di serie (seed = posizione, null per chi non lo è); false: niente teste di serie (nei file
         vecchi seed è l'ordine di iscrizione e non conta); assente (fatti vecchi): seed è l'ordine del tabellone */
      seeded: typeof g.seeded === "boolean" ? g.seeded : null,
      done: !!g.done,
      status: str(g.status),
      started: time(g.started),
      finished: time(g.finished),
      participants: list(g.participants).map(function (p, i) {
        p = p && typeof p === "object" ? p : { name: p };
        /* rating: il punteggio della ladder, se l'app lo passa */
        var sd = int1(p.seed), rt = num(p.rating);
        return { name: str(p.name), seed: sd || (typeof g.seeded === "boolean" ? null : i + 1), members: names(p.members), withdrawn: !!p.withdrawn, rating: rt != null ? Math.round(rt * 10) / 10 : null };
      }).filter(function (p) { return p.name; }),
      matches: list(g.matches).map(cleanMatch).filter(Boolean),
      standings: list(g.standings).map(function (s, i) {
        s = obj(s);
        return { pos: int1(s.pos) || i + 1, name: str(s.name) };
      }).filter(function (s) { return s.name; }),
      champion: str(g.champion) || null
    };
  }

  function clean(f) {
    f = obj(f);
    var a = obj(f.app), e = obj(f.event);
    return {
      app: { name: str(a.name) || APP, version: str(a.version) },
      lang: str(f.lang) || "it",
      event: {
        id: str(e.id), title: str(e.title), subtitle: str(e.subtitle), date: str(e.date), time: str(e.time),
        place: str(e.place), mode: e.mode === "lan" || e.mode === "online" ? e.mode : "", address: str(e.address)
      },
      games: list(f.games).map(cleanGame)
    };
  }

  /* ---------------- Utilità ---------------- */
  function same(s) { return s; }
  /* Markdown: i nomi scritti dagli utenti non devono diventare grassetti, link, codice, titoli o elenchi.
     Gli a capo (dati importati) diventano spazi: un nome non apre mai una riga nuova */
  function mdEsc(s) {
    /* il trattino basso dentro una parola (rail_god) non fa corsivo: resta com'è, più leggibile */
    return String(s).replace(/\s+/g, " ").replace(/[\\`*_[\]<>~]/g, function (c, i, t) {
      return c === "_" && /[\p{L}\p{N}]/u.test(t.charAt(i - 1)) && /[\p{L}\p{N}]/u.test(t.charAt(i + 1)) ? c : "\\" + c;
    }).replace(/^#/, "\\#").replace(/^([-+])(?= |$)/, "\\$1").replace(/^(\d+)([.)])(?= |$)/, "$1\\$2");
  }
  /* testo di un titolo: un # in fondo chiuderebbe il titolo e sparirebbe */
  function hEsc(s) { return mdEsc(s).replace(/#+$/, "\\$&"); }
  /* un solo passaggio: i nomi inseriti non vengono riletti (un nome "{w}" resta "{w}");
     un segnaposto sconosciuto (traduzione sbagliata) sparisce invece di restare nel testo.
     it: il modello è ancora quello italiano, quindi "a"/"e" davanti a un nome con la stessa vocale diventano "ad"/"ed"
     ("ad Alba", "ed Elio"), come direbbe un telecronista */
  function fill(tpl, vars, esc, it) {
    return String(tpl).replace(/(\b[ae] )?\{([a-zA-Z])\}/g, function (m, p, k) {
      var v = vars[k.toLowerCase()];
      if (v == null) return p || "";
      v = String(v);
      if (p && it && v.charAt(0).toLowerCase() === p.charAt(0)) p = p.charAt(0) + "d ";
      return (p || "") + esc(v);
    });
  }
  /* numeri nel testo: al massimo due decimali, con il separatore della lingua del torneo (2,5 in italiano);
     nel JSON restano numeri */
  function numFmt(lang) {
    var f = null;
    try { f = new Intl.NumberFormat(lang === "vec" ? "it" : lang || "it", { maximumFractionDigits: 2, useGrouping: false }); } catch (e) { f = null; }
    return function (x) {
      x = Math.round(x * 100) / 100;
      if (x === 0) x = 0;
      var s = f ? f.format(x) : "";
      return s && !/NaN|∞/.test(s) ? s : String(x);
    };
  }
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    /* rimescolamento finale: anche i bit bassi (quelli del resto della divisione) cambiano con ogni carattere */
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  /* ISO 8601 con il fuso locale: 2026-10-11T21:04:00+02:00 */
  function iso(t) {
    if (!t) return null;
    var d = new Date(t);
    if (isNaN(d.getTime()) || d.getFullYear() < 1000 || d.getFullYear() > 9999) return null;
    var o = -d.getTimezoneOffset(), sg = o < 0 ? "-" : "+";
    o = Math.abs(o);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
      sg + pad(Math.floor(o / 60)) + ":" + pad(o % 60);
  }
  function stamp(t) { var s = iso(t); return s ? s.slice(0, 10) + " " + s.slice(11, 16) : ""; }
  /* YAML: le stringhe JSON sono scalari YAML validi; in più si proteggono i caratteri che YAML non accetta crudi */
  var YBAD = new RegExp("[" + String.fromCharCode(0x7f) + "-" + String.fromCharCode(0x9f, 0x2028, 0x2029, 0xfeff) + "]", "g");
  function yq(s) {
    return JSON.stringify(String(s)).replace(YBAD, function (c) {
      return "\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4);
    });
  }

  /* Scelta della variante: dipende da gioco, partita e situazione; non ripete una variante usata da poco
     nella stessa situazione (con 3 varianti mai due volte di fila, con 4 o più nemmeno a una di distanza).
     La memoria (recent) dei commenti alle partite è di un solo gioco: il commento di una partita dipende solo
     dalle partite prima di lei nello stesso gioco, e non cambia quando si gioca in un altro gioco.
     Introduzioni e chiusure (dei giochi e dell'evento) hanno una memoria comune, così non si ripetono tra giochi. */
  function chooser(seed, recent) {
    return function (sit, id) {
      var set = V[sit], n = set.length, h = hash(seed + "\u0001" + id + "\u0001" + sit) % n;
      var r = recent[sit] || (recent[sit] = []);
      for (var k = 0; k < n && r.indexOf(h) >= 0; k++) h = (h + 1) % n;
      r.push(h);
      if (r.length > Math.max(1, n - 2)) r.shift();
      return set[h];
    };
  }

  /* chi vince, chi perde e il punteggio dal lato del vincitore */
  function duel(m) {
    var a = m.sides[0] || "", b = m.sides[1] || "", w = m.winner, draw = m.draw, l = "", W = null, L = null;
    /* nei gironi il vincitore è quello col punteggio più alto */
    if (!w && !draw && m.score && a && b) {
      if (m.score[0] > m.score[1]) w = a;
      else if (m.score[1] > m.score[0]) w = b;
      else draw = true;
    }
    if (w) l = w === a ? b : w === b ? a : (m.sides.filter(function (x) { return x !== w; })[0] || "");
    if (m.score && w && (w === a || w === b)) { W = w === a ? m.score[0] : m.score[1]; L = w === a ? m.score[1] : m.score[0]; }
    return { a: a, b: b, w: w, l: l, draw: draw, W: W, L: L };
  }
  /* margine: "clean" a zero, "crush" schiacciante, "close" di misura, "" normale o non misurabile
     (punteggio assente, o vince chi ha fatto meno punti: allora il punteggio non dice quanto) */
  function margin(W, L) {
    if (W == null || L == null || W <= L) return "";
    var d = W - L;
    if (L === 0 && W >= 2) return "clean";
    if (d >= 3 && d / W >= 0.65) return "crush";
    if (d <= 1 || d / W <= 0.16) return "close";
    return "";
  }
  /* teste di serie vere: seeded true (in ogni formato, solo chi ha seed). Fatti vecchi senza il campo: l'ordine del
     tabellone, solo in eliminazione e doppia. seeded false: nessuna */
  function seeded(g) { return g.seeded === true || (g.seeded == null && /^(elim|double|de)$/.test(g.format)); }
  function heatSorted(m) {
    return m.heat.map(function (h, i) { return { h: h, i: i }; }).sort(function (x, y) {
      var a = x.h.pos == null ? 1e9 : x.h.pos, b = y.h.pos == null ? 1e9 : y.h.pos;
      return a - b || x.i - y.i;
    }).map(function (x) { return x.h; });
  }

  /* ---------------- Generazione ---------------- */
  function build(facts, opt) {
    opt = opt || {};
    var trf = typeof opt.tr === "function" ? opt.tr : null;
    /* opt.trData (facoltativo): traduce le etichette che arrivano con i fatti (fase, stato, formato), spesso composte
       a pezzi dall'app ("Girone A, giornata 2"); opt.tr resta per le frasi intere di questo file */
    var trd = typeof opt.trData === "function" ? opt.trData : trf;
    var now = num(opt.now);
    if (now == null || now <= 0) now = Date.now();
    function tx1(f, s) {
      if (!f) return s;
      var r;
      try { r = f(s); } catch (e) { r = null; }
      return typeof r === "string" && r.trim() ? r : s;
    }
    function T(s) { return tx1(trf, s); }
    function TD(s) { return tx1(trd, s); }
    /* un pezzo di testo: modello tradotto, poi i nomi; versione semplice e versione Markdown */
    function say(t, v) { var x = T(t), it = x === t; return { pl: fill(x, v || {}, same, it), md: fill(x, v || {}, mdEsc, it) }; }
    function text(t, v) { var x = T(t); return fill(x, v || {}, same, x === t); }
    function render(P) {
      var a = P.map(function (p) { return say(p.t, p.v); });
      return { pl: a.map(function (x) { return x.pl; }).join(" "), md: a.map(function (x) { return x.md; }).join(" ") };
    }
    function join(a) {
      a = a.filter(Boolean);
      if (a.length < 2) return a[0] || "";
      return text("{a} e {b}", { a: a.slice(0, -1).join(", "), b: a[a.length - 1] });
    }

    var F = clean(facts), ev = F.event, title = ev.title || F.app.name, fmtNum = numFmt(F.lang);
    function score(x, y) { return fmtNum(x) + "–" + fmtNum(y); }
    /* giorni e fusi orari degli orari mostrati: con più giorni l'ora porta la data; con più fusi (cambio dell'ora
       durante il torneo, o file rigenerato dopo) ogni ora porta il suo fuso, perché la nota non può darne uno solo */
    var tzs = [], multiDay = (function () {
      var days = {}, T2 = [];
      F.games.forEach(function (g) {
        g.matches.forEach(function (m) { if (m.state === "done" && m.at > 0) { days[iso(m.at).slice(0, 10)] = 1; T2.push(m.at); } });
        if (g.started) T2.push(g.started);
        if (g.finished) T2.push(g.finished);
      });
      T2.sort(function (a, b) { return a - b; }).forEach(function (t) { var z = iso(t).slice(19); if (tzs.indexOf(z) < 0) tzs.push(z); });
      return Object.keys(days).length > 1;
    })();
    function tzOf(t) { return tzs.length > 1 ? " UTC" + iso(t).slice(19) : ""; }
    function hm(t) { var s = iso(t); return s ? (multiDay ? s.slice(0, 10) + " " : "") + s.slice(11, 16) : ""; }
    function stampTz(t) { var s = stamp(t); return s ? s + tzOf(t) : ""; }
    var lines = [], anyNoTime = false, totalPlayed = 0, evRecent = {};

    /* ---- un gioco: cronaca, classifica, numeri ---- */
    function story(g) {
      var pick = chooser(g.key, {}), seedOf = {}, wd = {}, memb = {}, rateOf = {};
      g.participants.forEach(function (p) { seedOf[p.name] = p.seed; if (p.withdrawn) wd[p.name] = 1; memb[p.name] = p.members; rateOf[p.name] = p.rating; });
      /* per la sorpresa conta quante sono le teste di serie (fatti vecchi: tutti i partecipanti) */
      var seeds = seeded(g), n = g.participants.filter(function (p) { return p.seed; }).length;
      var hasThird = g.matches.some(function (m) { return m.kind === "third"; });
      var bellaOn = g.matches.some(function (m) { return m.kind === "bella" && m.state !== "pending"; });
      var played = g.matches.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) {
        return x.m.state === "done" && (x.m.sides.length || x.m.heat);
      });
      /* tutte con orario: in ordine di tempo; altrimenti in ordine di tabellone, con l'orario dove c'è */
      var chrono = played.length > 0 && played.every(function (x) { return x.m.at > 0; });
      played.sort(function (x, y) { return (chrono ? x.m.at - y.m.at : 0) || x.m.order - y.m.order || x.i - y.i; });
      var run = {}, best = { len: 0, names: [] }, rows = [];
      function won(nm) {
        run[nm] = (run[nm] || 0) + 1;
        if (run[nm] > best.len) best = { len: run[nm], names: [nm] };
        else if (run[nm] === best.len && best.names.indexOf(nm) < 0) best.names.push(nm);
        return run[nm];
      }
      function lost(nm) { run[nm] = 0; }

      var nReal = 0;
      played.forEach(function (x) {
        var m = x.m, P = [], tx, big = false, k = m.kind, sk = 0, first = nReal === 0;
        var pk = function (s) { return pick(s, m.id); };
        function nm(h) { return h.name; }
        if (!m.at) anyNoTime = true;
        /* riposo dello svizzero: una riga senza commento, che spiega la vittoria in classifica */
        if (m.bye) return rows.push({ m: m, tx: say("{a} riposa in questo turno: vale una vittoria", { a: m.sides[0] }), cm: { pl: "", md: "" }, two: false, bye: true });
        nReal++;
        if (m.heat) {
          var H = heatSorted(m), tops = H.filter(function (h) { return h.pos === 1; });
          var w = tops.length === 1 ? tops[0].name : (tops.length ? null : m.winner);
          tx = {
            pl: H.map(function (h) { return (h.pos != null ? h.pos + "º " : "") + h.name + (h.score != null ? " (" + fmtNum(h.score) + ")" : ""); }).join(" · "),
            md: H.map(function (h) { return (h.pos != null ? h.pos + "º " : "") + mdEsc(h.name) + (h.score != null ? " (" + fmtNum(h.score) + ")" : ""); }).join(" · ")
          };
          var fin = k === "final" || /^finale$/i.test(m.stage);
          if (tops.length > 1) {
            P.push({ t: pk("heatTie"), v: { p: join(tops.map(function (h) { return h.name; })) } });
            tops.forEach(function (h) { won(h.name); });
          } else if (w) {
            /* secondo e terzo per posizione vera: con un pari merito non si dà del «terzo» a chi è secondo */
            var at2 = H.filter(function (h) { return h.name !== w && h.pos === 2; }).map(nm), at3 = H.filter(function (h) { return h.pos === 3; }).map(nm);
            if (fin) {
              big = true;
              P.push({ t: pk("heatFinal"), v: { w: w } });
              if (at2.length === 1 && at3.length === 1) P.push({ t: "Alle sue spalle {x} e {y}.", v: { x: at2[0], y: at3[0] } });
              else if (at2.length) P.push({ t: "Alle sue spalle {x}.", v: { x: join(at2) } });
            } else if (at2.length > 1) P.push({ t: pk("heatTie2"), v: { w: w, p: join(at2) } });
            else P.push({ t: pk(at2.length && at3.length === 1 ? "heat3" : at2.length ? "heat2" : "heat1"), v: { w: w, x: at2[0], y: at3[0] } });
            sk = won(w);
          }
          H.forEach(function (h) { if (h.pos !== 1 && h.name !== w) lost(h.name); });
          /* chi passa: l'elenco vero del programma (con tutti pari sul taglio passano i primi iscritti);
             pos <= adv solo per i fatti che non lo hanno */
          if (!fin && (m.advanced || m.adv)) {
            var q = m.advanced ? m.advanced.slice() : H.filter(function (h) { return h.pos != null && h.pos <= m.adv; }).map(nm);
            if (q.length) P.push({ t: q.length === 1 ? "Passa il turno: {p}." : "Passano il turno: {p}.", v: { p: join(q) } });
          }
          if (P.length && !fin && first) P.unshift({ t: pk("first"), v: { g: g.name } });
          if (w && sk >= 3 && (sk === 3 || sk % 2 === 1) && !big) P.push({ t: pk("streak"), v: { w: w, k: sk } });
          return rows.push({ m: m, tx: tx, cm: render(P), two: false });
        }

        var d = duel(m), mg = margin(d.W, d.L), v = { w: d.w, l: d.l, a: d.a, b: d.b, e: m.eliminated, g: g.name };
        if (d.W != null) v.s = score(d.W, d.L);
        /* la riga col risultato */
        if (m.forfeit && d.w && d.l) tx = say("{w} vince a tavolino contro {l}", v);
        else if (m.score && d.a && d.b) {
          var s = score(m.score[0], m.score[1]);
          tx = { pl: d.a + " " + s + " " + d.b, md: mdEsc(d.a) + " **" + s + "** " + mdEsc(d.b) };
          if (d.draw) { tx.pl += " " + T("(pareggio)"); tx.md += " " + T("(pareggio)"); }
          else if (d.w && d.W != null && d.W <= d.L) { var vv = say("vince {w}", v); tx.pl += " · " + vv.pl; tx.md += " · " + vv.md; }
        } else if (d.draw && d.a && d.b) tx = say("{a} e {b} pareggiano", v);
        else if (d.w && d.l) tx = say("{w} batte {l}", v);
        else tx = { pl: m.sides.join(" – "), md: m.sides.map(mdEsc).join(" – ") };
        /* il commento, dalla situazione più specifica */
        if (d.draw) { lost(d.a); lost(d.b); P.push({ t: pk("draw"), v: v }); }
        else if (d.w) {
          sk = won(d.w);
          if (d.l) lost(d.l);
          if (m.forfeit) { big = true; P.push({ t: pk(wd[d.l] ? "forfeitWd" : "forfeit"), v: v }); }
          else if (k === "final" || (k === "grand" && !bellaOn)) { big = true; P.push({ t: pk(mg === "close" ? "finalClose" : "final"), v: v }); }
          else if (k === "grand") { big = true; P.push({ t: pk("grandReset"), v: v }); }
          else if (k === "bella") { big = true; P.push({ t: pk("bella"), v: v }); }
          else if (k === "third") { big = true; P.push({ t: pk("third"), v: v }); }
          else if (k === "semi") { big = true; P.push({ t: pk(m.eliminated || !hasThird ? "semiOut" : "semi"), v: v }); }
          else {
            /* sorpresa: con due teste di serie decide il loro numero; altrimenti la ladder (almeno 100 punti di differenza) */
            var i1 = seedOf[d.w], j1 = seedOf[d.l], ra = rateOf[d.w], rb = rateOf[d.l], up = "";
            if (seeds && typeof i1 === "number" && typeof j1 === "number") { if (i1 - j1 >= Math.max(3, Math.ceil(n / 4))) up = /^(elim|double|de)$/.test(g.format) ? "upset" : "upsetG"; }
            else if (typeof ra === "number" && typeof rb === "number" && rb - ra >= 100) up = "upsetR";
            if (up) { if (up !== "upsetR") { v.i = i1; v.j = j1; } P.push({ t: pk(up), v: v }); mg = mg || "upset"; }
            else P.push({ t: pk(mg || (m.eliminated ? "out" : k === "winners" ? "drop" : "win")), v: v });
            /* il margine ha già preso la frase principale: chi esce o chi scende lo dice una frase breve */
            if (mg && m.eliminated) P.push({ t: pk("outTag"), v: v });
            else if (mg && k === "winners") P.push({ t: pk("dropTag"), v: v });
          }
        }
        if (P.length && !big && first) P.unshift({ t: pk("first"), v: v });
        /* serie di vittorie solo dove perdere non elimina (gironi, svizzero): nei tabelloni chi è ancora in gara
           le ha vinte tutte per forza, e la frase uscirebbe per tutti i vincitori dello stesso turno */
        if (sk >= 3 && (sk === 3 || sk % 2 === 1) && !big && STREAKY.test(k)) P.push({ t: pk("streak"), v: { w: d.w, k: sk } });
        rows.push({ m: m, tx: tx, cm: render(P), two: true, d: d });
      });

      /* ---- numeri (i riposi non sono partite) ---- */
      var real = rows.filter(function (r) { return !r.bye; });
      var num1 = { played: real.length, forfeits: real.filter(function (r) { return r.m.forfeit; }).length, widest: null, closest: null, longest_streak: null, best_heat_score: null };
      var sc = real.filter(function (r) { return r.two && r.m.score && !r.m.forfeit && (r.d.w || r.d.draw); });
      /* vittoria più larga: almeno due vittorie con punteggio, e lo scarto deve superare quello di tutte le altre */
      var wins = sc.filter(function (r) { return !r.d.draw && r.d.W != null && r.d.W > r.d.L; })
        .map(function (r) { return { r: r, dd: r.d.W - r.d.L }; }).sort(function (a, b) { return b.dd - a.dd; });
      var wide = wins.length >= 2 && wins[0].dd > wins[1].dd ? wins[0] : null, near = null;
      /* partita più combattuta: solo un pareggio o una vittoria di misura, mai una partita netta */
      if (sc.length >= 2) sc.forEach(function (r) {
        if ((wide && r === wide.r) || (!r.d.draw && margin(r.d.W, r.d.L) !== "close")) return;
        var a = r.m.score[0], b = r.m.score[1], rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1), tot = Math.abs(a) + Math.abs(b);
        if (!near || rel < near.rel || (rel === near.rel && tot > near.tot)) near = { r: r, rel: rel, tot: tot };
      });
      var hb = null;
      real.forEach(function (r) { if (r.m.heat) r.m.heat.forEach(function (h) { if (h.score != null && (!hb || h.score > hb.h.score)) hb = { h: h, r: r }; }); });
      if (wide) num1.widest = wide.r.m.id;
      if (near) num1.closest = near.r.m.id;
      if (best.len >= 2 && real.some(function (r) { return STREAKY.test(r.m.kind); })) num1.longest_streak = { length: best.len, names: best.names.slice() };
      if (hb) num1.best_heat_score = { name: hb.h.name, score: hb.h.score, match: hb.r.m.id };
      return { rows: rows, chrono: chrono, numbers: num1, wide: wide, near: near, hb: hb, best: best, memb: memb, wd: wd };
    }

    var stories = F.games.map(story);
    var md = [], data = { schema: SCHEMA, legend: JSON.parse(JSON.stringify(LEGEND)), generated: iso(now), app: F.app, lang: F.lang, event: {}, games: [] };
    var champs = [], allDone = F.games.length > 0;

    /* ---- testo di ogni gioco ---- */
    var gameMd = F.games.map(function (g, gi) {
      var S = stories[gi], pick = chooser(g.key, evRecent), out = [], team = g.team, np = g.participants.length;
      var fmt = g.formatLabel ? TD(g.formatLabel) : "";
      var status = g.status ? TD(g.status) : T(g.done ? "Concluso" : S.numbers.played ? "Torneo in corso" : "Non ancora avviato");
      totalPlayed += S.numbers.played;
      if (!g.done) allDone = false;
      out.push("## " + hEsc(g.name), "");
      if (g.game !== g.name) out.push("- **" + T("Gioco") + ":** " + mdEsc(g.game));
      if (fmt) out.push("- **" + T("Formato") + ":** " + mdEsc(fmt));
      /* il numero accanto all'etichetta: va bene in ogni lingua, senza accordare la parola al numero */
      out.push("- **" + T(team ? "Squadre" : "Giocatori") + ":** " + np);
      out.push("- **" + T("Stato") + ":** " + mdEsc(status));
      if (g.started) out.push("- **" + T("Inizio") + ":** " + stampTz(g.started));
      if (g.finished) out.push("- **" + T("Fine") + ":** " + stampTz(g.finished));
      out.push("");
      if (g.participants.length) {
        out.push("### " + T("Partecipanti"), "");
        var seeds = seeded(g);
        g.participants.forEach(function (p) {
          var s = "- **" + mdEsc(p.name) + "**";
          if (seeds && p.seed) s += " (" + text("testa di serie {n}", { n: p.seed }) + ")";
          if (p.members.length) s += ": " + p.members.map(mdEsc).join(", ");
          if (p.withdrawn) s += " — *" + T("fuori per ritiro") + "*";
          out.push(s);
        });
        out.push("");
      }
      /* introduzione */
      /* quanti, formato, a squadre o no: il numero è dentro la frase intera (con meno di due resta senza) */
      var intro = np >= 2 && fmt ? say(pick(team ? "gameIntroT" : "gameIntroP", ""), { g: g.name, n: np, f: fmt }) : say("Si apre il sipario su {g}!", { g: g.name });
      out.push("> " + intro.md, "");
      /* cronaca */
      out.push("### " + T("Cronaca"), "");
      if (!S.rows.length) out.push(T("Nessuna partita giocata finora."), "");
      var lastDay = "";
      S.rows.forEach(function (r) {
        var m = r.m, st = m.stage ? TD(m.stage) : "", tm = m.at ? hm(m.at) + tzOf(m.at) : "";
        if (S.chrono && multiDay) {
          var dy = iso(m.at).slice(0, 10);
          if (dy !== lastDay) { if (lastDay) out.push(""); out.push("**" + dy + "**", ""); lastDay = dy; }
          tm = iso(m.at).slice(11, 16) + tzOf(m.at);
        }
        var head = [tm, mdEsc(st)].filter(Boolean).join(" · ");
        out.push("- " + (head ? "**" + head + "** — " : "") + r.tx.md);
        if (r.cm.md) out.push("  > " + r.cm.md);
        /* i riposi stanno nel file (spiegano la classifica), non tra le partite dell'anteprima */
        if (!r.bye) lines.push({ game: g.key, id: m.id, at: iso(m.at), time: m.at ? hm(m.at) : "", stage: st, text: r.tx.pl, comment: r.cm.pl });
      });
      /* anche a gioco concluso, se resta qualcosa da giocare si dice */
      var todo = g.matches.filter(function (m) { return m.state !== "done"; }).length;
      if (S.rows.length) out.push("");
      if (todo) out.push(text("Partite ancora da giocare: {n}.", { n: todo }), "");
      /* classifica */
      if (g.standings.length) {
        out.push("### " + T(g.done ? "Classifica finale" : "Classifica provvisoria"), "");
        g.standings.forEach(function (s) { out.push("- **" + s.pos + "º** " + mdEsc(s.name) + (S.wd[s.name] ? " — *" + T("fuori per ritiro") + "*" : "")); });
        out.push("");
      }
      /* numeri */
      var N = S.numbers, nl = [];
      var heats = N.played && S.rows.every(function (r) { return r.m.heat; });
      nl.push("- **" + T(heats ? "Manche giocate" : "Partite giocate") + ":** " +
        (N.forfeits ? text("{n}, di cui {k} a tavolino", { n: N.played, k: N.forfeits }) : String(N.played)));
      function ref(r) { return r.tx.md + (r.m.stage ? " · " + mdEsc(TD(r.m.stage)) : ""); }
      if (S.wide) nl.push("- **" + T("Vittoria più larga") + ":** " + ref(S.wide.r));
      if (S.near) nl.push("- **" + T("Partita più combattuta") + ":** " + ref(S.near.r));
      if (S.hb) nl.push("- **" + T("Miglior punteggio in una manche") + ":** " + mdEsc(S.hb.h.name) + ", " + fmtNum(S.hb.h.score) + (S.hb.r.m.stage ? " · " + mdEsc(TD(S.hb.r.m.stage)) : ""));
      if (N.longest_streak) nl.push("- **" + T("Serie di vittorie più lunga") + ":** " + say("{p}, {k} vittorie di fila", { p: join(N.longest_streak.names), k: N.longest_streak.length }).md);
      if (S.rows.length) out.push("### " + T("Numeri"), "", nl.join("\n"), "");
      /* chiusura */
      var champ = g.champion || (g.done ? (g.standings.filter(function (s) { return s.pos === 1; }).length === 1 ? g.standings.filter(function (s) { return s.pos === 1; })[0].name : null) : null);
      var P = [];
      function at(p) { return g.standings.filter(function (s) { return s.pos === p && s.name !== champ; }).map(function (s) { return s.name; }); }
      if (champ) {
        var mb = team && S.memb[champ] && S.memb[champ].length ? S.memb[champ] : null;
        champs.push({ c: champ, g: g.name });
        P.push({ t: pick("champ", ""), v: { g: g.name, c: mb ? champ + " (" + join(mb) + ")" : champ } });
        /* le medaglie solo a gioco concluso: prima la classifica è provvisoria (es. finale per il 3º posto da giocare) */
        var x2 = g.done ? at(2) : [], x3 = g.done ? at(3) : [];
        if (x2.length && x3.length) P.push({ t: pick("medals3", ""), v: { x: join(x2), y: join(x3) } });
        else if (x2.length) P.push({ t: pick("medals2", ""), v: { x: join(x2) } });
        P.push(g.done ? { t: pick("gameEnd", ""), v: {} } : { t: pick("champOpen", ""), v: { g: g.name } });
      } else if (g.done) P.push({ t: pick("gameEnd", ""), v: {} });
      else if (N.played) {
        P.push({ t: pick("gameOpen", ""), v: { g: g.name } });
        var lead = at(1);
        if (lead.length) P.push({ t: pick("leader", ""), v: { c: join(lead) } });
      } else P.push({ t: pick("gameNew", ""), v: { g: g.name } });
      var outro = render(P);
      if (outro.md) out.push("> " + outro.md, "");
      /* dati del gioco */
      var cm = {};
      S.rows.forEach(function (r) { cm[r.m.id] = r.cm.pl; });
      data.games.push({
        key: g.key, game: g.game, name: g.name, format: g.format, formatLabel: fmt, team: g.team, seeded: g.seeded, done: g.done, status: status,
        started: iso(g.started), finished: iso(g.finished),
        participants: g.participants,
        matches: g.matches.map(function (m) {
          var o = {
            id: m.id, order: m.order, at: iso(m.at), stage: m.stage ? TD(m.stage) : "", kind: m.kind, state: m.state, sides: m.sides,
            score: m.score, winner: m.winner, draw: m.draw, forfeit: m.forfeit, eliminated: m.eliminated, heat: m.heat
          };
          if (m.heat) { o.adv = m.adv; o.advanced = m.advanced; }
          if (m.bye) o.bye = true;
          o.comment = OWN.call(cm, m.id) && cm[m.id] ? cm[m.id] : null;
          return o;
        }),
        standings: g.standings, champion: champ, intro: intro.pl, outro: outro.pl, numbers: S.numbers
      });
      return out;
    });

    /* ---- evento ---- */
    var ep = chooser("\u0002" + (ev.id || title), evRecent), I = [], ng = F.games.length;
    I.push({ t: ep(ng > 1 ? "evIntro" : ng ? "evIntro1" : "evIntro0", ""), v: { t: title, n: ng, g: ng === 1 ? F.games[0].name : "" } });
    if (ev.mode === "lan") I.push({ t: ep("evLan", ""), v: {} });
    else if (ev.mode === "online") I.push({ t: ep("evOnline", ""), v: {} });
    var evIntro = render(I), E = [], cl = champs.map(function (c) { return text("{c} in {g}", c); });
    if (allDone && cl.length) E.push({ t: ep("evEnd", ""), v: { t: title, c: join(cl) } });
    else if (allDone) E.push({ t: ep("evEndPlain", ""), v: { t: title } });
    else {
      E.push({ t: ep("evOpen", ""), v: { t: title } });
      if (cl.length) E.push({ t: cl.length === 1 ? "Campione già incoronato: {c}." : "Campioni già incoronati: {c}.", v: { c: join(cl) } });
    }
    var evOutro = render(E);
    data.event = {
      id: ev.id, title: ev.title, subtitle: ev.subtitle, date: ev.date, time: ev.time, place: ev.place, mode: ev.mode, address: ev.address,
      intro: evIntro.pl, outro: evOutro.pl
    };

    /* ---- il file ---- */
    md.push("---",
      "schema: " + yq(SCHEMA),
      "app: " + yq(F.app.name),
      "version: " + yq(F.app.version),
      "generated: " + yq(iso(now) || ""),
      "lang: " + yq(F.lang),
      "event_title: " + yq(ev.title),
      "event_date: " + yq(ev.date),
      "place: " + yq(ev.place));
    if (F.games.length) { md.push("games:"); F.games.forEach(function (g) { md.push("  - " + yq(g.name)); }); }
    else md.push("games: []");
    md.push("note: " + yq(text("Storico generato da {v}: i commenti sono colore, i fatti certi sono solo risultati, orari e classifiche; il JSON completo è in fondo al file.", { v: F.app.name })),
      "---", "");
    md.push("# " + hEsc(title), "");
    if (ev.subtitle) md.push("*" + mdEsc(ev.subtitle) + "*", "");
    var info = [];
    if (ev.date || ev.time) info.push("- **" + T("Data") + ":** " + [ev.date, ev.time].filter(Boolean).map(mdEsc).join(", "));
    if (ev.place) info.push("- **" + T("Luogo") + ":** " + mdEsc(ev.place));
    if (ev.address) info.push("- **" + T("Indirizzo") + ":** " + mdEsc(ev.address));
    if (ev.mode) info.push("- **" + T("Modalità") + ":** " + T(ev.mode === "lan" ? "LAN party" : "Online"));
    info.push("- **" + T("Tornei in programma") + ":** " + F.games.length);
    info.push("- **" + T("Partite giocate") + ":** " + totalPlayed);
    md.push(info.join("\n"), "", "> " + evIntro.md, "");
    var how = [
      text("Questo file è lo storico del torneo: si legge come una cronaca, ma è pensato anche per i programmi e le intelligenze artificiali che lo apriranno tra anni."),
      text("I commenti in stile telecronaca, nelle righe citate, sono solo colore: non aggiungono fatti."),
      text("I fatti certi sono soltanto i risultati, gli orari e le classifiche.")
    ];
    /* il fuso degli orari mostrati, non quello del momento in cui si genera il file */
    if (tzs.length === 1) how.push(text("Gli orari sono nell'ora locale di chi ha generato il file (UTC{z}); nel JSON ogni orario porta con sé il proprio fuso.", { z: tzs[0] }));
    else if (tzs.length > 1) how.push(text("Gli orari sono nell'ora locale di chi ha generato il file, che in questo periodo ha cambiato fuso (ora legale e ora solare): per questo ogni orario porta accanto il proprio fuso, come nel JSON."));
    if (anyNoTime) how.push(text("Le partite senza orario sono state giocate quando il programma non registrava ancora l'ora."));
    how.push(text("In fondo al file c'è il JSON completo con tutti i dati (schema {v}): la sua chiave legend spiega in inglese il significato di ogni campo.", { v: SCHEMA }));
    md.push("## " + T("Come leggere questo file"), "", how.map(mdEsc).join(" "), "");
    gameMd.forEach(function (g) { md.push.apply(md, g); });
    md.push("## " + T("Chiusura"), "", "> " + evOutro.md, "");
    md.push("## " + T("Dati completi (JSON)"), "", "```json", JSON.stringify(data, null, 2), "```", "");
    return { md: md.join("\n"), data: data, lines: lines };
  }

  /* nome del file: <titolo-in-minuscolo>.storico.md */
  function fileName(facts) {
    var t = str(obj(obj(facts).event).title);
    if (t.normalize) t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
    var s = t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/.test(s)) s = "torneo-" + s;
    return (s || "torneo") + ".storico.md";
  }

  var API = { SCHEMA: SCHEMA, build: build, fileName: fileName };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.CRONACA = API;
})(this);

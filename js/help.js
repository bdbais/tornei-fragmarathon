/* Tornei Fragmarathon: testi della guida contestuale.
   Ogni argomento si apre dal pulsante "?" della finestra corrispondente o con F1. */
window.HELP = {
  order: ["inizio", "tornei", "partecipanti", "squadre", "modifiche", "ffa", "elim", "double", "swiss", "rr", "risultati", "storico", "hof", "sala", "formule", "proiettore", "diretta", "bot", "temi", "archivio", "scorciatoie", "info"],
  topics: {
    sala: { t: "Sala: postazioni, oggetti e server", h:
      "<p>La scheda <b>Sala</b> è la pianta della LAN, in 2D e in 3D. Si salva con il torneo.</p>" +
      "<ul><li><b>Aggiungi</b> una <b>Fila di postazioni</b> (anche doppia, una di fronte all'altra) e gli oggetti: maxischermo, proiettore, switch, server, access point Wi-Fi, regia, podio, uscite di sicurezza, estintori, primo soccorso, quadro elettrico, refrigerazione, bagni, bar, ingresso, guardaroba, prese, tavoli, muri e zone con un nome.</li>" +
      "<li>Trascina per spostare (anche nella vista 3D). Sulla pianta: <kbd>R</kbd> ruota di 90°, <kbd>Q</kbd> ed <kbd>E</kbd> di 15°, le frecce spostano, <kbd>Canc</kbd> elimina.</li>" +
      "<li>Clic su una postazione: scegli il giocatore e l'indirizzo IP (o il nome del PC). Nella fila, <b>Numera gli IP</b> li assegna in ordine e <b>Metti i giocatori in ordine</b> riempie i posti liberi.</li>" +
      "<li><b>Ping di tutte</b> (solo nell'app installata) colora le postazioni: verde acceso, rosso non risponde. Si può ripetere da solo ogni 30 secondi.</li></ul>" +
      "<h4>Server dei giochi</h4><p>In <b>Wi-Fi, server dei giochi e informazioni</b> aggiungi i server con il nome che vuoi (Server 1, Server Alpha, Server Linux q3dm1...), il gioco, l'indirizzo con la porta e la password. Poi, nella scheda del gioco, sopra a ogni incontro e a ogni girone compare il menu <b>🖥 Server…</b>: scegli dove si gioca. Il server appare anche sul proiettore.</p>" +
      "<p>I giocatori collegati al bot ricevono il server insieme all'avviso <b>Tocca a te</b>; con <code>/server</code> chiedono nome, indirizzo e password del server della loro prossima partita (la password solo con un collegamento confermato, vedi la guida del bot Telegram), con <code>/mappa</code> la mappa della sala con la loro postazione evidenziata.</p>" +
      "<h4>Proiettore e stampa</h4><p>Il pannello <b>Mappa della sala</b> si proietta come gli altri. <b>Crea il PDF</b> prepara il kit da stampare: mappa con legenda, elenco delle postazioni, Wi-Fi con il QR per collegarsi, server dei giochi, QR del bot e del gruppo WhatsApp, e i cartellini da mettere sulle postazioni.</p>" },
    tornei: { t: "Elenco dei tornei", h:
      "<p>All'avvio si apre l'elenco dei tornei (una LAN, una serata): ognuno ha giochi, giocatori, tema, logo, formule e bot Telegram suoi. Lo riapri quando vuoi con il pulsante <b>Tornei</b> in alto.</p>" +
      "<ul><li><b>Continua</b> o <b>Apri</b>: scegli quale torneo amministrare. Quello aperto si salva da solo.</li>" +
      "<li><b>Nuovo torneo</b>: vuoto, con le impostazioni di un altro (giochi, formule, tema, logo) o anche con gli stessi giocatori, senza risultati.</li>" +
      "<li><b>Modifica</b>: nome, sottotitolo, data, luogo, colore, bot e <b>In lavorazione</b>.</li>" +
      "<li><b>In lavorazione</b>: nel bot il torneo lo vedono solo amministratori e organizzatori e i partecipanti non ricevono avvisi. Lo stesso vale per un singolo gioco (pulsante <b>Segna in lavorazione</b> nella sua scheda), che sparisce anche dal proiettore.</li>" +
      "<li><b>Duplica</b> (con o senza risultati), <b>Esporta</b> (file da portare su un altro PC), <b>Importa</b>, la stella per tenerlo in cima. <b>Storico</b> scarica la cronaca delle partite di quel torneo (vedi <a href='#' data-topic='storico'>Storico del torneo</a>).</li>" +
      "<li><b>Elimina</b> (si preme due volte; per un minuto c'è <b>Annulla cancellazione</b>, anche Ctrl+Z): nell'app installata il file va in <code>Documenti&#92;Tornei Fragmarathon&#92;cestino</code>, da cui si recupera.</li></ul>" +
      "<h4>Bot Telegram</h4><p>In fondo all'elenco ci sono i bot: ognuno ha token, ruoli, iscritti, avvisi e messaggio di benvenuto propri. Ogni torneo usa il bot che scegli. Tutti i bot accesi partono con il programma e rispondono per tutti i loro tornei, anche quelli non aperti; l'interruttore li accende o spegne. Le impostazioni (token, ruoli, iscrizioni da confermare) sono quelle del bot del torneo aperto. Rinominalo cliccando sul nome.</p>" +
      "<h4>Luogo e mappa</h4><p>Nel modulo <b>Modifica</b> scegli se si gioca in presenza, online o in entrambi i modi e scrivi l'indirizzo. Per il link della mappa: apri Google Maps (app o sito), cerca il posto, tocca <b>Condividi</b> e poi <b>Copia link</b> (inizia con <code>https://maps.app.goo.gl/</code>), e incollalo nel campo <b>Link Google Maps</b>. Se lo lasci vuoto, il programma crea un link di ricerca con l'indirizzo. Il luogo compare sulla scheda del torneo e nel messaggio di benvenuto del bot.</p>" +
      "<h4>Link e backup</h4><p>Nel modulo <b>Modifica</b> metti l'ora, il link del gruppo WhatsApp e del canale Telegram: compaiono sulla scheda e nel messaggio di benvenuto del bot. Il <b>backup cifrato</b> di tutti i tornei è nel pannello Archivio: senza la password non si apre.</p>" +
      "<h4>Lingue</h4><p>In alto scegli la lingua dell'interfaccia (resta su questo PC). Nel modulo <b>Modifica</b> di ogni torneo scegli la lingua del torneo: la usano proiettore, diretta, immagini, PDF e bot Telegram.</p>" +
      "<p>Il numero di versione accanto al titolo apre le novità di tutte le versioni.</p>" },
    inizio: { t: "Come si inizia", h:
      "<ol><li>Nella scheda <b>Partecipanti</b> scrivi tutti i nomi una volta sola.</li>" +
      "<li>Se ci sono giochi a squadre, crea le squadre fisse nella stessa scheda.</li>" +
      "<li>Apri la scheda di un gioco, scegli il <b>formato</b> e premi <b>Aggiungi tutti</b> (oppure <b>Abbina team</b>).</li>" +
      "<li>Premi <b>START</b>: il programma fa il sorteggio e crea tabellone o gironi. Da qui in poi <b>PAUSA</b> e <b>START</b> sospendono e riprendono il torneo senza rifare il sorteggio (vedi <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>).</li>" +
      "<li>Inserisci i punteggi man mano. Il torneo avanza da solo; quando serve una tua decisione compare un pulsante arancio.</li>" +
      "<li>Clicca l'icona del proiettore su un pannello per mostrarlo in sala.</li></ol>" +
      "<p class='note'>Tutto si salva da solo a ogni modifica. In più, a ogni cambio di turno o girone viene creato un backup automatico.</p>" +
      "<p>Per aggiungere un gioco che non c'è, usa il pulsante <b>+</b> accanto ai giochi.</p>" },

    partecipanti: { t: "Partecipanti e squadre fisse", h:
      "<p>Qui crei l'elenco di chi partecipa all'evento. Lo inserisci una volta e lo riusi in tutti i giochi.</p>" +
      "<h4>Aggiungere nomi</h4><p>Scrivi un nome per riga, oppure separali con una virgola, e premi <b>Aggiungi alla lista</b>. I doppioni vengono ignorati, anche se cambia solo maiuscolo e minuscolo.</p>" +
      "<h4>Squadre fisse</h4><p>Crea le squadre una volta: <b>Crea squadre casuali</b> le forma da sole con la dimensione scelta, <b>Assegna i rimanenti a caso</b> completa quelle esistenti. Nei giochi a squadre premi <b>Abbina team</b> per iscriverle.</p>" +
      "<h4>Stampa</h4><p>Il pulsante di stampa crea un PDF A4 con l'elenco, utile per il check-in.</p>" +
      "<h4>Excel e Google Sheets</h4><p><b>Esporta per Excel</b> salva un file .xlsx con giocatore, squadra e giochi; <b>Esporta CSV</b> un file che si apre anche in Google Sheets (File, Importa). <b>Importa da Excel o Google Sheets</b> legge un file .xlsx o .csv, oppure il link di un foglio Google condiviso con chiunque abbia il link. Serve una colonna con i nomi (titolo Nome, Giocatore, Nick o Player); se c'è una colonna Squadra, le squadre vengono create e riempite. I nomi già presenti non vengono duplicati. Puoi anche copiare le celle dal foglio e incollarle nel riquadro dei nomi.</p>" },

    squadre: { t: "Scheda Squadre", h:
      "<p>Mostra tutte le squadre di tutti i giochi con i loro componenti, per controllare chi gioca con chi. Puoi stamparle in PDF A4.</p>" +
      "<p>Prima di START le squadre fisse si modificano nella scheda <b>Partecipanti</b> e si copiano nel gioco con <b>Abbina team</b>. Dopo START i componenti si cambiano solo nella scheda del gioco, con il torneo in <b>PAUSA</b>: tabellone e risultati restano (vedi <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>).</p>" },

    modifiche: { t: "Cambiare i partecipanti a torneo iniziato", h:
      "<p>Dopo il primo <b>START</b> il sorteggio <b>non si rifà mai da solo</b>, nemmeno se aggiungi o togli squadre o giocatori. Premi <b>PAUSA</b>, fai le modifiche e premi <b>START</b>: il torneo riprende da dove era, con lo stesso tabellone e gli stessi risultati. Le regole sono le stesse per le squadre e per i giocatori singoli.</p>" +
      "<h4>Componenti di una squadra</h4>" +
      "<p>Aggiungere, togliere o sostituire giocatori in una squadra non cambia mai tabellone, gironi o risultati. Si può fare in pausa e anche a torneo concluso, nella scheda del gioco: dopo START le modifiche alle squadre fisse della scheda <b>Partecipanti</b> non arrivano più al gioco. Proiettore, bot Telegram e canali Discord seguono subito i componenti nuovi.</p>" +
      "<p>I punti della Hall of Fame vanno a chi è in squadra quando la consulti: chi esce da una squadra perde i punti di quel gioco, chi entra li prende.</p>" +
      "<h4>Togliere una squadra o un giocatore</h4>" +
      "<p>Con il torneo in pausa premi due volte la <b>×</b> accanto al nome. Al primo clic il programma ti dice cosa succederà, al secondo confermi.</p>" +
      "<ul>" +
      "<li><b>Se non ha ancora giocato</b> e il suo posto si può liberare, esce come se non si fosse mai iscritto e il posto torna libero per un altro." +
      "<ul>" +
      "<li>Eliminazione diretta e doppia: solo se la sua partita del primo turno ha un avversario e non è stata giocata, e nel tabellone restano almeno due partecipanti. L'avversario passa il turno.</li>" +
      "<li>Gironi all'italiana: le sue partite si annullano. Se nel girone resta un solo partecipante, passa nel girone più piccolo con partite nuove in fondo al calendario.</li>" +
      "<li>Sistema svizzero: se nel turno c'è chi riposa, il suo avversario gioca contro di lui; altrimenti riposa e prende la vittoria.</li>" +
      "<li>Free for all: solo nel primo turno. Se nel girone resta un solo giocatore, passa in un girone che non ha ancora giocato, oppure passa il turno senza giocare.</li>" +
      "</ul></li>" +
      "<li><b>Altrimenti si ritira</b>: resta nel tabellone o in classifica con la scritta <i>ritirata</i> o <i>ritirato</i> e con i risultati che ha fatto, e <b>perde a tavolino</b> le partite che gli restano.</li>" +
      "</ul>" +
      "<h4>Cosa succede quando qualcuno si ritira</h4>" +
      "<ul>" +
      "<li><b>I risultati già inseriti restano.</b> Una vittoria a tavolino non ha punteggio: conta come vittoria, ma non cambia la differenza punti, i punti fatti né i punti della Hall of Fame. Nelle formule vale come un riposo: <code>vinta</code> = 1 e <code>bye</code> = 1.</li>" +
      "<li><b>Prima di togliere qualcuno, inserisci i risultati delle partite che ha già giocato.</b> Un risultato inserito vale sempre più del tavolino, anche se lo scrivi dopo. Nel sistema svizzero no: la partita del turno diventa subito un riposo a tavolino e il risultato non si può più inserire, quindi scrivilo prima.</li>" +
      "<li><b>Eliminazione diretta</b>: l'avversario passa il turno a tavolino, anche quello che arriverà più avanti, appena sarà noto. Se il ritirato è in finale, l'avversario vince il torneo e il ritirato è secondo. Vale anche per la finale del 3º posto.</li>" +
      "<li><b>Doppia eliminazione</b>: perde a tavolino nel tabellone vincenti, scende nel tabellone perdenti e perde a tavolino anche lì. Se la finale è vinta a tavolino, la bella non si gioca. Se si ritirano tutti e due i giocatori di una partita non giocata, la vince a tavolino chi si è ritirato dopo: così una vittoria a tavolino già ottenuta non cambia.</li>" +
      "<li><b>Sistema svizzero</b>: la sua partita del turno in corso, se non è stata giocata, la vince a tavolino l'avversario. Vale come un riposo: 3 punti, e chi la riceve non riposerà più. Dal turno dopo il ritirato non viene più accoppiato. I suoi risultati restano e contano per il Buchholz degli avversari, ma in classifica sta dietro a chi è in gara e non va né sul podio né ai playoff.</li>" +
      "<li><b>Gironi all'italiana</b>: i risultati giocati restano e le partite che gli mancano le vincono a tavolino gli avversari, 3 punti ciascuno. Non passa ai playoff: al suo posto passa il successivo della classifica. Senza playoff, nella classifica finale sta dietro a chi è in gara. Se si ritirano tutti e due, la partita non giocata la vince a tavolino chi si è ritirato dopo, che si tiene i punti già presi.</li>" +
      "<li><b>Free for all</b>: resta nel suo girone, con il punteggio se l'ha già fatto, ma non passa il turno e non va sul podio: passano i primi tra chi resta. Se in gara restano al massimo tanti giocatori quanti ne passano, passano tutti senza bisogno di giocare. Chi è già stato eliminato in un turno passato non si ritira: togliendolo non cambia niente.</li>" +
      "<li><b>Playoff dopo gironi o svizzero</b>: se si ritira prima di giocare la sua prima partita dei playoff, al suo posto entra il <b>successivo della classifica</b> (con più gironi, chi lo segue nel suo girone). Se restano in gara meno di due partecipanti, i playoff non si giocano e vale la classifica. Se ha già giocato, vale la regola dell'eliminazione diretta.</li>" +
      "<li><b>Classifica finale</b>: chi si ritira prende il posto di chi perde nel turno in cui perde a tavolino. Nelle classifiche a punti sta dietro a chi è rimasto in gara.</li>" +
      "<li>Chi si è ritirato non può rientrare. Se l'hai tolto per errore, usa subito <b>Annulla cancellazione</b> (resta un minuto, finché non cambi altro) oppure <kbd>Ctrl</kbd>+<kbd>Z</kbd>.</li>" +
      "</ul>" +
      "<h4>Aggiungere una squadra o un giocatore</h4>" +
      "<p>Scrivi il nome e premi <b>Aggiungi</b>: il programma lo mette in un posto libero, senza spostare gli altri, e ti dice dove.</p>" +
      "<ul>" +
      "<li><b>Eliminazione diretta e doppia eliminazione</b>: entra al posto di un <i>Passa il turno</i> del primo turno, se chi passava il turno non ha ancora giocato quello dopo. Ora i due si affrontano. Se i posti liberi sono più di uno, si sorteggia solo quello del nuovo arrivato." +
      "<ul>" +
      "<li>Se il tabellone è pieno (4, 8, 16, 32… partecipanti), togli prima chi non ha ancora giocato: il suo posto si libera.</li>" +
      "<li>Altrimenti serve <b>Rifai il sorteggio</b>.</li>" +
      "</ul></li>" +
      "<li><b>Gironi all'italiana</b>: entra nel girone con meno partecipanti in gara (mai in uno dove si sono ritirati tutti) e gioca una partita contro ognuno, in giornate aggiunte in fondo al calendario. Contro chi si è ritirato vince a tavolino. Si può solo prima dei playoff.</li>" +
      "<li><b>Sistema svizzero</b>: se nel turno in corso qualcuno riposa, gioca subito contro di lui; altrimenti entra dal turno dopo con 0 punti. All'ultimo turno, se nessuno riposa, non fa più in tempo: puoi aumentare i <b>Turni</b>.</li>" +
      "<li><b>Free for all</b>: si entra solo durante il primo turno, nel girone più piccolo che non ha ancora punteggi e non è pieno.</li>" +
      "<li>Quando i playoff sono iniziati, quando lo svizzero è finito o quando il torneo è concluso non si aggiunge più nessuno.</li>" +
      "<li>Le iscrizioni dal bot Telegram entrano nel gioco solo prima di START: dopo, aggiungi il nome a mano.</li>" +
      "</ul>" +
      "<h4>Impostazioni dopo START</h4>" +
      "<p>Dopo il primo START non si cambiano più:</p>" +
      "<ul>" +
      "<li>il formato;</li>" +
      "<li>giocatori singoli o squadre;</li>" +
      "<li>il numero di gironi;</li>" +
      "<li>i giocatori per girone e quanti passano per girone;</li>" +
      "<li>i giocatori per squadra.</li>" +
      "</ul>" +
      "<p>Sono bloccati anche <b>Aggiungi tutti</b>, <b>Crea squadre casuali</b> e <b>Abbina team</b>: da qui in poi si aggiunge o si toglie un partecipante alla volta.</p>" +
      "<p>In pausa restano modificabili, senza rifare niente:</p>" +
      "<ul>" +
      "<li>i <b>Turni</b> dello svizzero, ma non meno di quelli già creati;</li>" +
      "<li>quanti vanno ai <b>Playoff</b>, finché i playoff non sono iniziati;</li>" +
      "<li>la <b>bella</b> della doppia eliminazione, finché la finale non ha un risultato.</li>" +
      "</ul>" +
      "<h4>Rifai il sorteggio</h4>" +
      "<p>Il sorteggio si rifà solo se lo chiedi tu: in pausa premi <b>Rifai il sorteggio</b> due volte.</p>" +
      "<ul>" +
      "<li>Di quel gioco si cancellano tabellone, gironi, risultati e server assegnati agli incontri.</li>" +
      "<li>Partecipanti, squadre e impostazioni restano; chi si era ritirato esce dall'elenco.</li>" +
      "<li>Il gioco torna alle iscrizioni: cambia formato o impostazioni se serve, poi premi START per il nuovo sorteggio.</li>" +
      "<li>Prima viene fatto un backup automatico, e per un minuto puoi usare <b>Annulla cancellazione</b>.</li>" +
      "</ul>" +
      "<h4>Cosa vedono gli altri</h4>" +
      "<p>Proiettore, bot Telegram e canali Discord si aggiornano subito. Chi entra riceve <i>Tocca a te</i> quando ha una partita. Le vittorie a tavolino compaiono tra i risultati e chiudono il canale Discord della partita con un messaggio. Il canale di una partita che non si gioca più viene cancellato.</p>" },

    ffa: { t: "Free for all a punti", h:
      "<p>Tutti i partecipanti di un girone giocano insieme nella stessa partita (battle royale, Quake, giochi di corse): vince chi fa più punti.</p>" +
      "<h4>Impostazioni</h4><ul><li><b>Giocatori per girone</b>: un numero qualsiasi da 2 in su. Se i conti non tornano i gironi si bilanciano da soli (per esempio 10 giocatori con gironi da 4 diventano 4, 3, 3) e al sorteggio non nasce mai un girone con una sola persona.</li>" +
      "<li><b>Passano per girone</b>: quanti vanno al turno dopo.</li></ul>" +
      "<h4>Durante il torneo</h4><ul><li>Scrivi i punti di ognuno; con <kbd>Invio</kbd> passi al campo successivo.</li>" +
      "<li>I pareggi sono ammessi: chi è a pari punti sul limite passa insieme.</li>" +
      "<li><b>Rimescola</b> rifà i gironi del turno corrente; <b>Bilancia</b> mette i più forti in gironi diversi.</li>" +
      "<li>Trascina la maniglia ⠿ su un altro nome per scambiare due giocatori, o su un girone per spostarlo lì. Chi viene spostato perde i punti di quel turno.</li>" +
      "<li>Quando tutti hanno un punteggio, premi <b>Genera turno successivo</b>. L'ultimo turno con un solo girone è la finale.</li></ul>" +
      "<p>Ritiri e nuovi iscritti a torneo iniziato: <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>.</p>" },

    elim: { t: "Eliminazione diretta", h:
      "<p>Partite uno contro uno: chi perde esce. È il formato dei playoff di quasi tutti i tornei.</p>" +
      "<ul><li>Se i partecipanti non sono una potenza di 2, alcuni passano il primo turno senza giocare (bye).</li>" +
      "<li>Inserisci i punteggi: vince il più alto e avanza da solo. Puoi anche toccare il nome del vincitore.</li>" +
      "<li>Se correggi un risultato, le partite successive che ne dipendevano vengono azzerate.</li>" +
      "<li>Si gioca la finale per il 3º posto tra i perdenti delle semifinali.</li>" +
      "<li>Finché una partita del primo turno non ha risultati, trascina ⠿ su un altro nome per scambiare gli accoppiamenti.</li></ul>" +
      "<p>Ritiri e nuovi iscritti a torneo iniziato: <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>.</p>" },

    double: { t: "Doppia eliminazione", h:
      "<p>Si esce solo dopo <b>due sconfitte</b>: è il formato chiamato anche <i>double bracket</i> o <i>double elimination</i>, quello di EVO e di molti tornei di picchiaduro e sparatutto.</p>" +
      "<ul><li><b>Tabellone vincenti</b> (<i>winner</i> o <i>upper bracket</i>): chi perde qui non è fuori, scende nel tabellone perdenti.</li>" +
      "<li><b>Tabellone perdenti</b> (<i>loser</i> o <i>lower bracket</i>): chi perde qui esce dal torneo.</li>" +
      "<li><b>Finale</b>: il vincitore dei vincenti contro il vincitore dei perdenti.</li>" +
      "<li><b>Bella</b> (bracket reset): se vince chi arriva dai perdenti, entrambi hanno una sconfitta e si gioca un'ultima partita. Puoi disattivarla nelle impostazioni.</li>" +
      "<li>Il 3º posto è chi perde la finale del tabellone perdenti.</li></ul>" +
      "<p>I risultati si inseriscono come nell'eliminazione diretta. Se ne correggi uno, le partite che dipendevano da quello si liberano da sole.</p>" +
      "<p>Ritiri e nuovi iscritti a torneo iniziato: <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>.</p>" },

    swiss: { t: "Sistema svizzero", h:
      "<p>Tutti giocano lo stesso numero di turni e nessuno viene eliminato subito. A ogni turno si affronta chi ha un punteggio simile, senza rivincite. È la fase a gruppi dei Major di Counter-Strike.</p>" +
      "<h4>Impostazioni</h4><ul><li><b>Turni</b>: il valore proposto basta a far emergere un vincitore (3 turni fino a 8 giocatori, 4 fino a 16, 5 fino a 32).</li>" +
      "<li><b>Playoff</b>: dopo lo svizzero, i primi 2, 4, 8 o 16 vanno a un'eliminazione diretta. Con \"Nessuno\" vince il primo in classifica.</li></ul>" +
      "<h4>Punti e classifica</h4><ul><li>Vittoria 3, pareggio 1 (punteggi uguali), sconfitta 0.</li>" +
      "<li>Con un numero dispari di partecipanti, a turno uno riposa e prende la vittoria (mai due volte la stessa persona).</li>" +
      "<li>A pari punti decide il <b>Buchholz</b>: la somma dei punti degli avversari affrontati. Chi ha battuto avversari forti sta più in alto.</li></ul>" +
      "<p>Prima di inserire risultati puoi trascinare ⠿ i nomi per cambiare gli accoppiamenti del turno.</p>" +
      "<p>Ritiri e nuovi iscritti a torneo iniziato: <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>.</p>" },

    rr: { t: "Gironi all'italiana", h:
      "<p>Nel girone tutti giocano contro tutti una volta. È il formato dei campionati e della fase a gironi dei Worlds.</p>" +
      "<ul><li><b>Gironi</b>: in quanti gruppi dividere i partecipanti (1 = campionato unico).</li>" +
      "<li><b>Playoff</b>: quanti vanno all'eliminazione diretta finale. I primi di ogni girone entrano per primi e hanno l'accoppiamento migliore.</li>" +
      "<li>Vittoria 3 punti, pareggio 1. A pari punti contano la differenza punti e poi i punti fatti.</li>" +
      "<li>Le partite sono divise in <b>giornate</b>: nessuno gioca due partite nella stessa giornata.</li>" +
      "<li>Prima dei risultati puoi trascinare ⠿ un partecipante su un altro girone o su un altro nome; il calendario si rifà da solo.</li></ul>" +
      "<p>Ritiri e nuovi iscritti a torneo iniziato: <a href='#' data-topic='modifiche'>Cambiare i partecipanti a torneo iniziato</a>.</p>" },

    risultati: { t: "Risultati finali", h:
      "<p>Il podio di ogni gioco concluso, con i componenti delle squadre.</p>" +
      "<ul><li><b>Scarica immagine (PNG)</b> crea un'immagine del torneo da pubblicare.</li>" +
      "<li><b>Esporta risultati (CSV)</b> crea un file da aprire con Excel.</li>" +
      "<li><b>Scarica lo storico</b> crea la cronaca di tutto il torneo, partita per partita. Il riquadro <b>Cronaca del torneo</b> in fondo mostra le ultime partite (vedi <a href='#' data-topic='storico'>Storico del torneo</a>).</li></ul>" },

    storico: { t: "Storico del torneo", h:
      "<p>Lo <b>storico</b> è la cronaca di tutto il torneo in un solo file. Per ogni gioco: i partecipanti (le squadre con i componenti, chi si è ritirato), le partite giocate in ordine con orario, fase e risultato, il podio o la classifica e qualche numero (partite giocate, vittoria più larga, partita più combattuta, serie di vittorie più lunga). Ogni partita ha un commento da telecronista delle grandi finali.</p>" +
      "<h4>Dove si scarica</h4><ul><li>Scheda <b>Risultati finali</b>: <b>Scarica lo storico</b> del torneo aperto. Il riquadro <b>Cronaca del torneo</b> mostra le ultime partite; <b>Leggi tutta la cronaca</b> apre l'elenco completo, gioco per gioco.</li>" +
      "<li>Elenco dei tornei: <b>Storico</b> sulla scheda di un torneo, anche se non è quello aperto.</li>" +
      "<li>Il file va nella cartella <b>Download</b>. La cronaca comincia con la prima partita giocata; i giochi segnati <b>In lavorazione</b> non ci sono.</li></ul>" +
      "<h4>Archivio automatico (solo app installata)</h4><p>L'app per Windows tiene da sola una copia aggiornata dello storico di ogni torneo in <code>Documenti&#92;Tornei Fragmarathon&#92;storici</code>: si riscrive pochi secondi dopo ogni partita giocata o corretta e quando un gioco si conclude. <b>Apri la cartella degli storici</b>, nel riquadro della cronaca, la apre.</p>" +
      "<h4>Fatti e commenti</h4><p>I commenti sono solo colore: non aggiungono nulla che non sia successo (niente mappe, uccisioni o minuti inventati). I fatti sono i risultati, gli orari e le classifiche. L'orario è quello in cui il risultato è stato inserito la prima volta: una correzione non lo sposta.</p>" +
      "<p>Le partite giocate con le versioni precedenti del programma non hanno l'orario: compaiono in ordine di tabellone, senza ora.</p>" +
      "<h4>Leggibile anche da una AI</h4><p>È un file Markdown (<code>.storico.md</code>) che si apre con qualsiasi editor di testo. In cima c'è un'intestazione con titolo, data, lingua e giochi, poi una nota su come leggerlo; in fondo c'è un blocco JSON con tutti i dati (schema <code>tornei-fragmarathon/storico@1</code>), così tra anni una persona, un programma o un'intelligenza artificiale lo leggono senza dover indovinare. Testi e commenti sono nella lingua del torneo.</p>" +
      "<p class='note'>Nello storico ci sono nomi, squadre, risultati, orari e classifiche, più le informazioni del torneo che hai scritto (titolo, data, luogo e <b>indirizzo</b>): se il file va condiviso e l'indirizzo è quello di una casa, toglilo prima dalle informazioni del torneo. Mai password, account Discord o Telegram, indirizzi dei server di gioco o di TeamSpeak.</p>" },

    hof: { t: "Hall of Fame", h:
      "<p>La classifica di tutto l'evento. Per ogni torneo ogni partecipante prende dei punti Hall of Fame che dipendono dalla <b>posizione finale</b> e dai <b>punti fatti</b>; poi si sommano tutti i tornei.</p>" +
      "<h4>Come si calcola</h4><p>Apri <b>Come si calcola la Hall of Fame</b> in cima alla scheda:</p><ul>" +
      "<li><b>Punti per posizione</b>: quanto vale il 1º, il 2º, il 3º posto e così via (per esempio 25, 18, 15, 12, 10…). Le posizioni non elencate valgono 0.</li>" +
      "<li><b>Peso del punteggio</b>: quanto conta ogni punto fatto (0,1 = un punto Hall of Fame ogni 10 fatti; 0 = contano solo le posizioni).</li>" +
      "<li>Premi <b>Applica i pesi</b>: la classifica si ricalcola subito. Ci sono anche dei modelli pronti e una formula libera con le variabili pos, punti, partecipanti, concluso.</li></ul>" +
      "<p>La posizione conta solo quando il torneo è concluso; a pari merito (stesso turno di eliminazione o stesso punteggio) si prende la stessa posizione. I punti fatti di un torneo seguono la sua formula «Punti per la Hall of Fame».</p>" +
      "<p>Accanto all'icona di ogni gioco vedi la posizione e i punti Hall of Fame presi; il gioco migliore ha il bordo colorato. Nei giochi a squadre i punti della squadra contano anche per ogni componente.</p>" },

    formule: { t: "Calcolo dei punti (formule)", h:
      "<p>Ogni torneo ha il suo riquadro <b>Calcolo dei punti</b> nella scheda del gioco. Le formule si scrivono come in un foglio di calcolo e si vede subito il risultato su un esempio; se c'è un errore viene spiegato in rosso e la formula non viene salvata.</p>" +
      "<h4>Free for all</h4><p>Scegli i <b>campi</b> da inserire per ogni partecipante (per esempio Posizione e Uccisioni) e la <b>formula</b> che li trasforma nel punteggio. Il punteggio decide la classifica del girone e conta per la Hall of Fame. Modelli pronti: piazzamento + uccisioni (battle royale), punti stile Formula 1, uccisioni e morti, KDA. I campi si cambiano con il torneo in pausa; la formula sempre, e i punteggi si ricalcolano.</p>" +
      "<h4>Partite uno contro uno</h4><p><b>Punti in classifica</b> (gironi all'italiana e svizzero): quanti punti vale ogni partita, di base <code>3*vinta + pareggio</code>. <b>Punti per la Hall of Fame</b> (tutti i formati a partite): di base i punti fatti.</p>" +
      "<p>Variabili delle partite: <code>punti</code> (fatti), <code>avversario</code> (subiti), <code>diff</code>, <code>vinta</code>, <code>pareggio</code>, <code>persa</code> (valgono 1 o 0), <code>bye</code> (vittoria senza giocare: riposo nello svizzero o vittoria a tavolino contro chi si è ritirato).</p>" +
      "<h4>Cosa si può scrivere</h4><ul><li>Operazioni: <code>+ - * / % ^</code> e parentesi; i decimali con il punto.</li>" +
      "<li>Confronti: <code>&gt; &lt; &gt;= &lt;= == !=</code>, e <code>&amp;&amp;</code> (e), <code>||</code> (o); <code>condizione ? a : b</code>.</li>" +
      "<li>Funzioni (argomenti separati da <code>;</code>): <code>min</code>, <code>max</code>, <code>abs</code>, <code>arrotonda</code>, <code>giu</code>, <code>su</code>, <code>se(condizione; a; b)</code>, <code>tabella(n; v1; v2; …)</code> che dà il valore n-esimo (utile per i punti per piazzamento).</li></ul>" +
      "<h4>Ricalcolo</h4><p>Quando salvi una formula, o premi <b>Ricalcola punteggi e classifiche</b>, tutti i risultati già inseriti vengono ricalcolati. Se con la nuova formula cambierebbero i qualificati di una fase già partita (il turno successivo del free for all o i playoff), compare un avviso rosso con chi entrerebbe e chi uscirebbe e il pulsante <b>Rigenera</b>: rifà le fasi successive con la nuova formula, azzerandone i risultati, dopo un backup automatico. Se preferisci tenere le fasi già giocate, ignora l'avviso.</p>" +
      "<p>Esempi: <code>tabella(pos; 25; 18; 15; 12; 10; 8; 6; 4; 2; 1)</code>, <code>max(0; kill*2 - morti)</code>, <code>vinta*(diff &gt;= 3 ? 4 : 3) + pareggio</code>.</p>" },

    proiettore: { t: "Schermo proiettore", h:
      "<p>Ogni pannello (un girone, un tabellone, una classifica, il podio) ha in alto a destra l'icona del proiettore. Cliccala: si apre una finestra separata che mostra <b>solo quel pannello</b>, ingrandito al massimo che lo schermo consente. L'icona del pannello in onda diventa arancio.</p>" +
      "<ul><li>Con un secondo schermo collegato la finestra si apre lì, già a tutto schermo. Con uno schermo solo usa <kbd>F</kbd> per il tutto schermo.</li>" +
      "<li><kbd>PgDn</kbd> e <kbd>PgUp</kbd> (o le frecce) passano al pannello successivo o precedente della stessa scheda.</li>" +
      "<li><b>Galleria</b>: i pannelli scorrono da soli. Scegli ogni quanti secondi (da 3 in su) e se mostrare solo i pannelli della scheda o tutti i giochi, i risultati e la Hall of Fame. Si attiva e si ferma con <kbd>G</kbd>.</li>" +
      "<li><b>Riempi lo schermo</b> (tasto <kbd>R</kbd>): usa tutta la superficie anche su schermi non 16:9 e riduce l'intestazione, così il pannello è il più grande possibile.</li>" +
      "<li>Il proiettore si aggiorna da solo appena inserisci un punteggio.</li>" +
      "<li>Muovi il mouse sul proiettore per vedere i comandi; <kbd>Esc</kbd> chiude.</li></ul>" +
      "<p><kbd>F5</kbd> apre il proiettore sul primo pannello della scheda aperta.</p>" +
      "<h4>Musica</h4><p>Il pulsante <b>♪ Musica</b> nei comandi del proiettore, o il pulsante ♪ in alto nell'app principale, apre la playlist: aggiungi file musicali (MP3, OGG, WAV, FLAC, M4A) o il link di una radio in streaming, scegli casuale e ripetizione, il volume e se mostrare il titolo del brano sullo schermo. La musica suona dal proiettore; i brani restano salvati su questo PC. Tasti nel proiettore: <kbd>M</kbd> avvia o ferma, <kbd>N</kbd> successivo, <kbd>B</kbd> precedente, <kbd>+</kbd> e <kbd>-</kbd> volume.</p>" },

    diretta: { t: "Diretta su YouTube e Twitch", h:
      "<p>Il programma può trasmettere in diretta lo schermo del proiettore insieme a una o più telecamere, su YouTube, Twitch o un altro server RTMP, anche su più destinazioni insieme. Non serve installare altro (né OBS né altri programmi). Funziona nell'app installata per Windows.</p>" +
      "<h4>1. Prendi le chiavi di trasmissione</h4><ul>" +
      "<li><b>YouTube</b>: YouTube Studio, <i>Crea</i>, <i>Trasmetti dal vivo</i>, scheda <i>Streaming</i>: copia la <b>chiave dello stream</b>. Come link per gli spettatori va bene quello del canale con /live in fondo, per esempio <code>https://youtube.com/@canale/live</code>.</li>" +
      "<li><b>Twitch</b>: <i>Dashboard del creatore</i>, <i>Impostazioni</i>, <i>Stream</i>: copia la <b>chiave di trasmissione principale</b> e scrivi il nome del canale (il link lo crea il programma).</li>" +
      "<li><b>Altro server RTMP</b> (per esempio Facebook o un server tuo): indirizzo <code>rtmp://</code> o <code>rtmps://</code>, chiave e link per gli spettatori.</li></ul>" +
      "<p class='note'>Le chiavi sono come password: chi le ha può trasmettere sul tuo canale. Restano solo su questo PC, non finiscono nei backup, e nelle impostazioni ne vedi solo le ultime 4 cifre.</p>" +
      "<h4>2. Impostazioni</h4><p>In <b>IMPOSTAZIONI</b>, sezione <b>Diretta su YouTube e Twitch</b>:</p><ul>" +
      "<li><b>Finestra da trasmettere</b>: lo <b>schermo proiettore</b> (consigliato) viene disegnato apposta per la diretta alla sua risoluzione, quindi non serve tenerlo aperto né visibile. In alternativa la finestra principale, uno schermo intero o un altro programma.</li>" +
      "<li><b>Telecamere</b>: fino a 4. <b>Microfono</b> per il commento e <b>audio del PC</b> per i suoni del gioco.</li>" +
      "<li><b>Qualità</b>: 720p a 30 fps chiede circa 5 Mbit/s in upload, 1080p a 60 fps circa 10 Mbit/s. Il programma usa la scheda video (NVIDIA, Intel o AMD) se c'è, altrimenti il processore.</li>" +
      "<li><b>Titolo e logo in sovrimpressione</b> e <b>copia su disco</b> in Documenti\\Tornei Fragmarathon\\dirette.</li></ul>" +
      "<h4>3. In onda</h4><p>Il pulsante <b>Diretta</b> in alto apre i comandi con l'anteprima: <b>Avvia la diretta</b>, <b>Ferma la diretta</b> e le scene:</p><ul>" +
      "<li><b>Solo la finestra</b>, <b>Finestra con telecamera nell'angolo</b>, <b>Finestra e telecamere affiancate</b>, <b>Solo la telecamera</b>, <b>Tutte le telecamere</b>. Con più telecamere scegli quale è la principale.</li>" +
      "<li>Il pallino del pulsante è rosso quando sei in onda, giallo mentre si avvia o si riconnette.</li>" +
      "<li>Appena la diretta parte, il <b>bot Telegram avvisa tutte le chat</b> con i link per guardarla. Chiunque può chiedere al bot <code>/diretta</code>; gli organizzatori possono usare <code>/diretta avvia</code>, <code>/diretta ferma</code> e <code>/diretta scena</code>.</li>" +
      "<li>Se la connessione cade, il programma si riconnette da solo (fino a 60 tentativi). Il dettaglio tecnico è in Documenti\\Tornei Fragmarathon\\diretta-ffmpeg.log.</li></ul>" },

    bot: { t: "Bot Telegram", h:
      "<p>Con un bot Telegram i partecipanti possono vedere tornei, classifiche, partite e Hall of Fame dal telefono, seguire un torneo per ricevere gli avvisi e iscriversi. Il bot è tuo: lo crei una volta sola, gratis, in due minuti.</p>" +
      "<h4>1. Crea il tuo bot</h4><ol><li>In Telegram apri la chat con <b>@BotFather</b> (quello ufficiale, con la spunta blu).</li>" +
      "<li>Scrivi <code>/newbot</code>, poi il nome che vedranno tutti (per esempio <i>Tornei del Lanparty</i>) e uno username che finisca con <i>bot</i> (per esempio <i>lanparty_tornei_bot</i>).</li>" +
      "<li>BotFather risponde con il <b>token</b>, una riga tipo <code>123456789:AAH…</code>. È la chiave del bot: non condividerla e non pubblicarla.</li>" +
      "<li>Facoltativo: con <code>/setdescription</code> e <code>/setuserpic</code> aggiungi descrizione e logo.</li></ol>" +
      "<h4>2. Collegalo al programma</h4><ol><li>In fondo alla pagina apri <b>IMPOSTAZIONI</b>, sezione <b>Bot Telegram</b>.</li>" +
      "<li>Incolla il token e premi <b>Salva e collega</b>: lo stato diventa «Attivo come @nomebot».</li>" +
      "<li>Assegna i <b>ruoli</b> nella tabella <b>Persone e ruoli</b>: aggiungi lo username Telegram (per esempio <code>@LazarusCRY</code>) come <b>Amministratore</b> o <b>Organizzatore tornei</b>. Il ruolo vale appena quella persona scrive al bot in privato. In alternativa ognuno può scrivere al bot <code>/admin</code> seguito dal codice mostrato nelle impostazioni (diventa amministratore; il codice cambia dopo ogni uso). Il codice è di 10 lettere e cifre: maiuscole, minuscole e spazi non contano. Dopo 5 codici sbagliati, per un'ora il bot non risponde più a <code>/admin</code> da quella persona.</li>" +
      "<li>Condividi il link del bot (<code>t.me/nomebot</code>) con i partecipanti, magari con un QR code all'ingresso.</li></ol>" +
      "<h4>Ruoli</h4><ul><li><b>Amministratore</b>: riceve e conferma le richieste di iscrizione, manda annunci a tutti (<code>/annuncio</code>) e comanda la diretta.</li>" +
      "<li><b>Organizzatore tornei</b>: riceve e conferma le iscrizioni di tutti i tornei o solo di quelli selezionati nella tabella.</li>" +
      "<li><b>Partecipante</b>: tutti gli altri. Nella tabella vedi chi ha scritto al bot e puoi cambiargli ruolo, collegarlo a un giocatore o rimuoverlo.</li></ul>" +
      "<h4>Giocatori collegati</h4><p>Un partecipante tocca <b>Sono un giocatore</b> (o scrive <code>/io nome</code>) e indica il nome con cui gioca: il bot lo collega al giocatore (se il nome non c'è propone i più simili) e da quel momento gli manda gli <b>avvisi personali</b>: «tocca a te» quando ha una partita da giocare, i suoi risultati e la posizione finale, anche nei giochi a squadre. Chi si iscrive con <code>/iscrivimi</code> è collegato da solo. Il collegamento si cambia anche dalla tabella, e si toglie con <code>/scollega</code>.</p>" +
      "<p>Il collegamento fatto con <code>/io</code> basta per gli avvisi, ma è solo dichiarato. È <b>confermato</b> quando viene da un'iscrizione accettata o automatica, o quando lo fai tu nella tabella: solo allora il giocatore riceve la password del server con <code>/server</code> e collega il suo account Discord con <code>/discord</code> seguito dal nome utente, per entrare nei canali delle sue partite. Gli organizzatori la password la vedono sempre.</p>" +
      "<h4>Gruppi e canali</h4><p>Se qualcuno aggiunge il bot a un gruppo o a un canale, agli amministratori arriva un messaggio con <b>Abilita</b>, <b>Esci</b> ed <b>Esci e blocca</b>. Finché non lo abiliti il bot lì non scrive nulla. Abilitato, si presenta con il link per scrivergli in privato, risponde a /tornei, /classifica, /partite, /risultati, /diretta e riceve annunci e diretta. Dal telefono: <code>/gruppi</code> e <code>/bloccati</code>; nell'app: Impostazioni, Bot Telegram, <b>Gruppi e canali</b>. Chi è bloccato non può più aggiungerlo (esce da solo) e i suoi messaggi privati vengono ignorati.</p>" +
      "<h4>Cosa possono chiedere i partecipanti</h4><ul><li><code>/tornei</code>, <code>/torneo</code>, <code>/classifica</code>, <code>/partite</code>, <code>/risultati</code>: tornei, stato, classifiche, tabelloni e partite da giocare (anche con i pulsanti).</li>" +
      "<li><code>/hof</code>: Hall of Fame, con il file CSV da scaricare. <code>/immagine</code>: l'immagine del torneo.</li>" +
      "<li><code>/giocatore nome</code>, oppure <code>/io nome</code> e poi <code>/miepartite</code>: dove gioca, posizioni e prossime partite.</li>" +
      "<li><code>/segui nome</code> o <code>/segui tutti</code>: avvisi a ogni cambio di turno o fase e alla fine con il podio (e, se lo attivi, a ogni risultato).</li>" +
      "<li><code>/iscrivimi torneo</code>: iscrizione ai tornei non ancora iniziati. Con «conferma dell'organizzatore» la richiesta arriva agli organizzatori sul telefono e nelle impostazioni; con «automatiche» il nome entra subito; con «chiuse» il bot non accetta iscrizioni. Nei giochi a squadre il nome entra nei partecipanti e la squadra la decidi tu.</li>" +
      "<li><code>/stop</code>: il bot dimentica quella chat.</li></ul>" +
      "<p>Gli organizzatori hanno anche <code>/richieste</code> e <code>/annuncio testo</code>, che manda un messaggio a tutti.</p>" +
      "<p class='note'>Il bot risponde finché questo programma è aperto e connesso a internet. Il token, le chat e le richieste restano solo su questo PC e non finiscono nei backup: su un altro PC rimetti il token. Un bot può essere collegato a un solo programma alla volta. Il bot conserva l'ID della chat e il nome Telegram di chi gli scrive, solo per rispondere e mandare gli avvisi; con /stop vengono cancellati.</p>" },

    temi: { t: "Temi, logo, AI e CSS", h:
      "<p>Scegli il tema dal menu <b>Tema</b> in alto a destra. Vale per la finestra principale e per il proiettore e viene salvato con i dati dell'evento.</p>" +
      "<ul><li><b>Automatico</b>: ogni gioco ha i suoi colori (Quake lava e metallo, Team Fortress 2 retrò, Wreckfest cantiere, Counter-Strike 2 tattico, FIFA campo da calcio); le altre schede usano Fragmarathon. Sul proiettore, in galleria, il tema cambia con il gioco mostrato.</li>" +
      "<li><b>Fragmarathon</b>: il tema dell'evento; segue chiaro o scuro di Windows.</li>" +
      "<li><b>Ispirati alle piattaforme</b>: Bracket chiaro (stile Challonge), Arena notturna (stile start.gg), Lega pro (stile ESL), Wiki (stile Liquipedia), Neon (stile Battlefy). Riprendono solo i colori, non loghi o marchi.</li>" +
      "<li><b>Temi dei giochi</b>: puoi anche fissare il tema di un gioco per tutto il programma.</li></ul>" +
      "<h4>Logo dell'evento</h4><p>In fondo alla pagina premi <b>IMPOSTAZIONI</b>, poi <b>Carica logo</b>: PNG, JPG, WEBP o SVG, meglio con sfondo trasparente. Compare nell'intestazione, nelle immagini PNG e nei PDF. <b>Torna al logo Fragmarathon</b> rimette quello di base.</p>" +
      "<h4>Logo generato con l'AI</h4><p>In <b>IMPOSTAZIONI</b>, sotto il logo: scegli se il logo è per l'evento o per un torneo, lo stile e il servizio, poi <b>Genera 4 proposte</b> e <b>Usa questo</b> su quella che preferisci. Servizi:</p><ul>" +
      "<li><b>Stable Diffusion sul tuo PC</b> (AUTOMATIC1111, Forge o SD.Next avviati con <code>--api</code>, indirizzo di base <code>http://127.0.0.1:7860</code>): gratuito e tutto in locale.</li>" +
      "<li><b>Server compatibile OpenAI</b>, per esempio LocalAI in locale (<code>http://127.0.0.1:8080/v1</code>) o un servizio remoto con la sua chiave.</li>" +
      "<li><b>Pollinations</b> e <b>Hugging Face</b>: online, con una chiave personale gratuita (enter.pollinations.ai/keys oppure huggingface.co/settings/tokens).</li></ul>" +
      "<p class='note'>Le impostazioni e le chiavi restano su questo PC e non finiscono nei backup. Ai servizi online viene inviata solo la descrizione del logo.</p>" +
      "<h4>CSS personalizzato</h4><p>Sempre in <b>IMPOSTAZIONI</b>: <b>Importa file .css</b> carica un foglio di stile preparato fuori dal programma, oppure lo scrivi nella casella e premi <b>Salva</b>. <b>Scarica il modello</b> ti dà un file di partenza con tutte le variabili dei colori (--bg, --panel, --ink, --mut, --line, --edge, --acc, --accink, --wacc per il proiettore). Il CSS vale sopra al tema scelto, anche sul proiettore, e viaggia con i backup.</p>" +
      "<p class='note'>Per sicurezza il CSS non può caricare nulla da internet (url(https://…) e @import vengono bloccati). Le immagini vanno incorporate come url(data:…).</p>" },

    archivio: { t: "Archivio tornei e backup", h:
      "<h4>Salvare un torneo</h4><p><b>Salva questo torneo</b> crea un file nella cartella <b>Documenti\\Tornei Fragmarathon\\tornei</b>. Da quel momento il file si aggiorna da solo a ogni modifica. Scorciatoia: <kbd>Ctrl</kbd>+<kbd>S</kbd>.</p>" +
      "<h4>Riprendere un torneo</h4><p>Nell'elenco <b>Tornei salvati</b> premi <b>Riprendi</b> e poi conferma. Il torneo torna nella sua scheda, esattamente dove l'avevi lasciato. Se il gioco non esiste più, viene ricreato.</p>" +
      "<h4>Backup automatici</h4><p>Si creano da soli nella cartella <b>backup</b> quando parte un torneo, a ogni cambio di turno o di girone e alla fine. Contengono tutti i giochi. Vengono tenuti gli ultimi 200.</p>" +
      "<h4>Backup completo</h4><p><b>Esporta backup</b> salva tutti i giochi in un unico file, per spostarli su un altro PC; <b>Importa backup</b> li riporta.</p>" +
      "<p class='note'>Nella versione web (PWA) i tornei si scaricano nella cartella Download e i backup automatici restano nel browser (gli ultimi 3).</p>" },

    scorciatoie: { t: "Scorciatoie da tastiera", h:
      "<ul><li><kbd>F1</kbd> apre questa guida sull'argomento della finestra in cui sei.</li>" +
      "<li><kbd>Ctrl</kbd>+<kbd>S</kbd> salva il torneo aperto nella cartella tornei.</li>" +
      "<li><kbd>Ctrl</kbd>+<kbd>K</kbd> cerca una sezione, un gioco, un'impostazione o un argomento della guida.</li>" +
      "<li><kbd>Ctrl</kbd>+<kbd>Z</kbd> dopo una cancellazione la annulla (come il pulsante <b>Annulla cancellazione</b>, che resta un minuto); altrimenti annulla l'ultima modifica.</li>" +
      "<li>Clic sul titolo di un pannello: lo comprime o lo riapre (resta ricordato). Clic sul nome di un giocatore o di una squadra: lo rinomini ovunque.</li>" +
      "<li><kbd>F5</kbd> apre il proiettore; lì <kbd>PgUp</kbd> <kbd>PgDn</kbd> cambiano pannello e <kbd>G</kbd> avvia la galleria.</li>" +
      "<li><kbd>Invio</kbd> in un punteggio passa al campo successivo.</li>" +
      "<li><kbd>Esc</kbd> chiude la guida.</li></ul>" },

    info: { t: "Informazioni", h:
      "<p><b>Tornei Fragmarathon</b>, versione {VERSION}.</p>" +
      "<p>Creato da <a href='https://fragmarathon.net' target='_blank' rel='noopener'>fragmarathon.net</a> e Lazarus.</p><p>Contributi: Tony Manga e Hirish.</p>" +
      "<p>Cartella dei dati: <b>{DIR}</b></p>" +
      "<h4>Aggiornamenti</h4><p>La versione installata controlla da sola gli aggiornamenti all'avvio e ogni 6 ore, li scarica in background e li installa alla chiusura. Quando un aggiornamento è pronto compare un avviso in alto.</p>" +
      "<p><button id='updchk'>Controlla aggiornamenti</button></p>" +
      "<p>Codice sorgente e versioni: <a href='https://github.com/bdbais/tornei-fragmarathon' target='_blank' rel='noopener'>github.com/bdbais/tornei-fragmarathon</a></p>" }
  }
};

/* Tornei Fragmarathon: testi della guida contestuale.
   Ogni argomento si apre dal pulsante "?" della finestra corrispondente o con F1. */
window.HELP = {
  order: ["inizio", "partecipanti", "squadre", "ffa", "elim", "double", "swiss", "rr", "risultati", "hof", "formule", "proiettore", "temi", "archivio", "scorciatoie", "info"],
  topics: {
    inizio: { t: "Come si inizia", h:
      "<ol><li>Nella scheda <b>Partecipanti</b> scrivi tutti i nomi una volta sola.</li>" +
      "<li>Se ci sono giochi a squadre, crea le squadre fisse nella stessa scheda.</li>" +
      "<li>Apri la scheda di un gioco, scegli il <b>formato</b> e premi <b>Aggiungi tutti</b> (oppure <b>Abbina team</b>).</li>" +
      "<li>Premi <b>START</b>: il programma fa il sorteggio e crea tabellone o gironi.</li>" +
      "<li>Inserisci i punteggi man mano. Il torneo avanza da solo; quando serve una tua decisione compare un pulsante arancio.</li>" +
      "<li>Clicca l'icona del proiettore su un pannello per mostrarlo in sala.</li></ol>" +
      "<p class='note'>Tutto si salva da solo a ogni modifica. In più, a ogni cambio di turno o girone viene creato un backup automatico.</p>" +
      "<p>Per aggiungere un gioco che non c'è, usa il pulsante <b>+</b> accanto ai giochi.</p>" },

    partecipanti: { t: "Partecipanti e squadre fisse", h:
      "<p>Qui crei l'elenco di chi partecipa all'evento. Lo inserisci una volta e lo riusi in tutti i giochi.</p>" +
      "<h4>Aggiungere nomi</h4><p>Scrivi un nome per riga, oppure separali con una virgola, e premi <b>Aggiungi alla lista</b>. I doppioni vengono ignorati, anche se cambia solo maiuscolo e minuscolo.</p>" +
      "<h4>Squadre fisse</h4><p>Crea le squadre una volta: <b>Crea squadre casuali</b> le forma da sole con la dimensione scelta, <b>Assegna i rimanenti a caso</b> completa quelle esistenti. Nei giochi a squadre premi <b>Abbina team</b> per iscriverle.</p>" +
      "<h4>Stampa</h4><p>Il pulsante di stampa crea un PDF A4 con l'elenco, utile per il check-in.</p>" },

    squadre: { t: "Scheda Squadre", h:
      "<p>Mostra tutte le squadre di tutti i giochi con i loro componenti, per controllare chi gioca con chi. Puoi stamparle in PDF A4.</p>" +
      "<p>Le squadre si modificano nella scheda <b>Partecipanti</b> (squadre fisse) o nella scheda del gioco, con il torneo in <b>PAUSA</b>.</p>" },

    ffa: { t: "Free for all a punti", h:
      "<p>Tutti i partecipanti di un girone giocano insieme nella stessa partita (battle royale, Quake, giochi di corse): vince chi fa più punti.</p>" +
      "<h4>Impostazioni</h4><ul><li><b>Giocatori per girone</b>: un numero qualsiasi da 2 in su. Se i conti non tornano i gironi si bilanciano da soli (per esempio 10 giocatori con gironi da 4 diventano 4, 3, 3) e non nasce mai un girone con una sola persona.</li>" +
      "<li><b>Passano per girone</b>: quanti vanno al turno dopo.</li></ul>" +
      "<h4>Durante il torneo</h4><ul><li>Scrivi i punti di ognuno; con <kbd>Invio</kbd> passi al campo successivo.</li>" +
      "<li>I pareggi sono ammessi: chi è a pari punti sul limite passa insieme.</li>" +
      "<li><b>Rimescola</b> rifà i gironi del turno corrente; <b>Bilancia</b> mette i più forti in gironi diversi.</li>" +
      "<li>Trascina la maniglia ⠿ su un altro nome per scambiare due giocatori, o su un girone per spostarlo lì. Chi viene spostato perde i punti di quel turno.</li>" +
      "<li>Quando tutti hanno un punteggio, premi <b>Genera turno successivo</b>. L'ultimo turno con un solo girone è la finale.</li></ul>" },

    elim: { t: "Eliminazione diretta", h:
      "<p>Partite uno contro uno: chi perde esce. È il formato dei playoff di quasi tutti i tornei.</p>" +
      "<ul><li>Se i partecipanti non sono una potenza di 2, alcuni passano il primo turno senza giocare (bye).</li>" +
      "<li>Inserisci i punteggi: vince il più alto e avanza da solo. Puoi anche toccare il nome del vincitore.</li>" +
      "<li>Se correggi un risultato, le partite successive che ne dipendevano vengono azzerate.</li>" +
      "<li>Si gioca la finale per il 3º posto tra i perdenti delle semifinali.</li>" +
      "<li>Finché una partita del primo turno non ha risultati, trascina ⠿ su un altro nome per scambiare gli accoppiamenti.</li></ul>" },

    double: { t: "Doppia eliminazione", h:
      "<p>Si esce solo dopo <b>due sconfitte</b>: è il formato chiamato anche <i>double bracket</i> o <i>double elimination</i>, quello di EVO e di molti tornei di picchiaduro e sparatutto.</p>" +
      "<ul><li><b>Tabellone vincenti</b> (<i>winner</i> o <i>upper bracket</i>): chi perde qui non è fuori, scende nel tabellone perdenti.</li>" +
      "<li><b>Tabellone perdenti</b> (<i>loser</i> o <i>lower bracket</i>): chi perde qui esce dal torneo.</li>" +
      "<li><b>Finale</b>: il vincitore dei vincenti contro il vincitore dei perdenti.</li>" +
      "<li><b>Bella</b> (bracket reset): se vince chi arriva dai perdenti, entrambi hanno una sconfitta e si gioca un'ultima partita. Puoi disattivarla nelle impostazioni.</li>" +
      "<li>Il 3º posto è chi perde la finale del tabellone perdenti.</li></ul>" +
      "<p>I risultati si inseriscono come nell'eliminazione diretta. Se ne correggi uno, le partite che dipendevano da quello si liberano da sole.</p>" },

    swiss: { t: "Sistema svizzero", h:
      "<p>Tutti giocano lo stesso numero di turni e nessuno viene eliminato subito. A ogni turno si affronta chi ha un punteggio simile, senza rivincite. È la fase a gruppi dei Major di Counter-Strike.</p>" +
      "<h4>Impostazioni</h4><ul><li><b>Turni</b>: il valore proposto basta a far emergere un vincitore (3 turni fino a 8 giocatori, 4 fino a 16, 5 fino a 32).</li>" +
      "<li><b>Playoff</b>: dopo lo svizzero, i primi 2, 4, 8 o 16 vanno a un'eliminazione diretta. Con \"Nessuno\" vince il primo in classifica.</li></ul>" +
      "<h4>Punti e classifica</h4><ul><li>Vittoria 3, pareggio 1 (punteggi uguali), sconfitta 0.</li>" +
      "<li>Con un numero dispari di partecipanti, a turno uno riposa e prende la vittoria (mai due volte la stessa persona).</li>" +
      "<li>A pari punti decide il <b>Buchholz</b>: la somma dei punti degli avversari affrontati. Chi ha battuto avversari forti sta più in alto.</li></ul>" +
      "<p>Prima di inserire risultati puoi trascinare ⠿ i nomi per cambiare gli accoppiamenti del turno.</p>" },

    rr: { t: "Gironi all'italiana", h:
      "<p>Nel girone tutti giocano contro tutti una volta. È il formato dei campionati e della fase a gironi dei Worlds.</p>" +
      "<ul><li><b>Gironi</b>: in quanti gruppi dividere i partecipanti (1 = campionato unico).</li>" +
      "<li><b>Playoff</b>: quanti vanno all'eliminazione diretta finale. I primi di ogni girone entrano per primi e hanno l'accoppiamento migliore.</li>" +
      "<li>Vittoria 3 punti, pareggio 1. A pari punti contano la differenza punti e poi i punti fatti.</li>" +
      "<li>Le partite sono divise in <b>giornate</b>: nessuno gioca due partite nella stessa giornata.</li>" +
      "<li>Prima dei risultati puoi trascinare ⠿ un partecipante su un altro girone o su un altro nome; il calendario si rifà da solo.</li></ul>" },

    risultati: { t: "Risultati finali", h:
      "<p>Il podio di ogni gioco concluso, con i componenti delle squadre.</p>" +
      "<ul><li><b>Scarica immagine (PNG)</b> crea un'immagine del torneo da pubblicare.</li>" +
      "<li><b>Esporta risultati (CSV)</b> crea un file da aprire con Excel.</li></ul>" },

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
      "<p>Variabili delle partite: <code>punti</code> (fatti), <code>avversario</code> (subiti), <code>diff</code>, <code>vinta</code>, <code>pareggio</code>, <code>persa</code> (valgono 1 o 0), <code>bye</code> (riposo nello svizzero).</p>" +
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
      "<p><kbd>F5</kbd> apre il proiettore sul primo pannello della scheda aperta.</p>" },

    temi: { t: "Temi, logo, AI e CSS", h:
      "<p>Scegli il tema dal menu <b>Tema</b> in alto a destra. Vale per la finestra principale e per il proiettore e viene salvato con i dati dell'evento.</p>" +
      "<ul><li><b>Automatico</b>: ogni gioco ha i suoi colori (Quake lava e metallo, Team Fortress 2 retrò, Wreckfest cantiere, Counter-Strike 2 tattico, FIFA campo da calcio); le altre schede usano Fragmarathon. Sul proiettore, in galleria, il tema cambia con il gioco mostrato.</li>" +
      "<li><b>Fragmarathon</b>: il tema dell'evento; segue chiaro o scuro di Windows.</li>" +
      "<li><b>Ispirati alle piattaforme</b>: Bracket chiaro (stile Challonge), Arena notturna (stile start.gg), Lega pro (stile ESL), Wiki (stile Liquipedia), Neon (stile Battlefy). Riprendono solo i colori, non loghi o marchi.</li>" +
      "<li><b>Temi dei giochi</b>: puoi anche fissare il tema di un gioco per tutto il programma.</li></ul>" +
      "<h4>Logo dell'evento</h4><p>In fondo alla pagina premi <b>MODIFICA</b>, poi <b>Carica logo</b>: PNG, JPG, WEBP o SVG, meglio con sfondo trasparente. Compare nell'intestazione, nelle immagini PNG e nei PDF. <b>Torna al logo Fragmarathon</b> rimette quello di base.</p>" +
      "<h4>Logo generato con l'AI</h4><p>In <b>MODIFICA</b>, sotto il logo: scegli se il logo è per l'evento o per un torneo, lo stile e il servizio, poi <b>Genera 4 proposte</b> e <b>Usa questo</b> su quella che preferisci. Servizi:</p><ul>" +
      "<li><b>Stable Diffusion sul tuo PC</b> (AUTOMATIC1111, Forge o SD.Next avviati con <code>--api</code>, indirizzo di base <code>http://127.0.0.1:7860</code>): gratuito e tutto in locale.</li>" +
      "<li><b>Server compatibile OpenAI</b>, per esempio LocalAI in locale (<code>http://127.0.0.1:8080/v1</code>) o un servizio remoto con la sua chiave.</li>" +
      "<li><b>Pollinations</b> e <b>Hugging Face</b>: online, con una chiave personale gratuita (enter.pollinations.ai/keys oppure huggingface.co/settings/tokens).</li></ul>" +
      "<p class='note'>Le impostazioni e le chiavi restano su questo PC e non finiscono nei backup. Ai servizi online viene inviata solo la descrizione del logo.</p>" +
      "<h4>CSS personalizzato</h4><p>Sempre in <b>MODIFICA</b>: <b>Importa file .css</b> carica un foglio di stile preparato fuori dal programma, oppure lo scrivi nella casella e premi <b>Salva</b>. <b>Scarica il modello</b> ti dà un file di partenza con tutte le variabili dei colori (--bg, --panel, --ink, --mut, --line, --edge, --acc, --accink, --wacc per il proiettore). Il CSS vale sopra al tema scelto, anche sul proiettore, e viaggia con i backup.</p>" +
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
      "<li><kbd>Ctrl</kbd>+<kbd>Z</kbd> annulla l'ultima azione (fino a 60).</li>" +
      "<li><kbd>F5</kbd> apre il proiettore; lì <kbd>PgUp</kbd> <kbd>PgDn</kbd> cambiano pannello e <kbd>G</kbd> avvia la galleria.</li>" +
      "<li><kbd>Invio</kbd> in un punteggio passa al campo successivo.</li>" +
      "<li><kbd>Esc</kbd> chiude la guida.</li></ul>" },

    info: { t: "Informazioni", h:
      "<p><b>Tornei Fragmarathon</b>, versione {VERSION}.</p>" +
      "<p>Creato da <a href='https://fragmarathon.net' target='_blank' rel='noopener'>fragmarathon.net</a> e Lazarus.</p>" +
      "<p>Cartella dei dati: <b>{DIR}</b></p>" +
      "<h4>Aggiornamenti</h4><p>La versione installata controlla da sola gli aggiornamenti all'avvio e ogni 6 ore, li scarica in background e li installa alla chiusura. Quando un aggiornamento è pronto compare un avviso in alto.</p>" +
      "<p><button id='updchk'>Controlla aggiornamenti</button></p>" +
      "<p>Codice sorgente e versioni: <a href='https://github.com/bdbais/tornei-fragmarathon' target='_blank' rel='noopener'>github.com/bdbais/tornei-fragmarathon</a></p>" }
  }
};

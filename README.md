# Tornei Fragmarathon

Gestore di tornei per LAN party, nato per il Fragmarathon. Dal sorteggio al podio, con uno schermo dedicato al proiettore che si legge da più di 5 metri.

Creato da [fragmarathon.net](https://fragmarathon.net) e Lazarus. Contributi: Tony Manga e Hirish.

- **Windows**: scarica l'installer dall'[ultima release](https://github.com/bdbais/tornei-fragmarathon/releases/latest). Si installa con un doppio clic, crea le cartelle da solo e si aggiorna da solo.
- **Web (PWA)**: [tornei.bais.info/app](https://tornei.bais.info/app/). Si installa dal browser e funziona offline.
- **Pagina del progetto**: [tornei.bais.info](https://tornei.bais.info)

## Formati di torneo

| Formato | Come funziona |
|---|---|
| Free for all a punti | Tutto il girone gioca nella stessa partita, passano i migliori. Gironi di qualsiasi dimensione, bilanciati da soli. |
| Eliminazione diretta | Chi perde esce. Bye automatici e finale per il 3º posto. |
| Doppia eliminazione (double bracket) | Si esce alla seconda sconfitta: winner bracket, loser bracket, finale e "bella" (bracket reset) facoltativa. |
| Sistema svizzero | Turni con avversari di punteggio simile, senza rivincite, spareggio Buchholz, playoff facoltativi. |
| Gironi all'italiana | Tutti contro tutti a giornate, vittoria 3 e pareggio 1, playoff facoltativi. |

## Cambiare i partecipanti a torneo iniziato

Dopo il primo **START** il sorteggio non si rifà mai da solo. In **PAUSA** si aggiungono o si tolgono squadre e giocatori, e **START** riprende da dove era, con lo stesso tabellone e gli stessi risultati. Le regole sono uguali per squadre e giocatori singoli.

- **Componenti di una squadra**: si cambiano nella scheda del gioco in pausa e anche a torneo concluso (dopo START le squadre fisse della scheda Partecipanti non arrivano più al gioco), senza toccare tabellone, gironi o risultati. I punti della Hall of Fame vanno a chi è in squadra quando la si consulta.
- **Togliere** (× premuta due volte, la prima mostra cosa succederà): chi non ha ancora giocato e ha un posto che si può liberare esce come se non si fosse mai iscritto; gli altri si **ritirano**: restano con i risultati fatti, con la scritta *ritirata* o *ritirato*, e perdono a tavolino le partite che restano. Le vittorie a tavolino non hanno punteggio. Nelle classifiche a punti chi si ritira sta dietro a chi è in gara e non va né sul podio né ai playoff; prima dei playoff al suo posto entra il successivo della classifica. Se si ritirano tutti e due i giocatori di una partita non giocata, la vince a tavolino chi si è ritirato dopo. Nello svizzero il risultato della partita del turno va inserito prima di togliere qualcuno.
- **Aggiungere**: il nuovo iscritto prende un posto libero senza spostare gli altri. Eliminazione diretta e doppia: al posto di un «Passa il turno» del primo turno (il tabellone non si ingrandisce). Gironi: nel girone più piccolo, con partite nuove in fondo al calendario. Svizzero: contro chi riposa, oppure dal turno dopo con 0 punti. Free for all: solo nel primo turno. Non si aggiunge più nessuno a playoff iniziati, a svizzero finito o a torneo concluso.
- **Rifai il sorteggio** (si preme due volte, con backup automatico): cancella tabellone e risultati di quel gioco e torna alle iscrizioni; è l'unico modo di rifare il sorteggio. Dopo il primo START formato, tipo di partecipanti, gironi e giocatori per girone o per squadra si cambiano solo così.

I tornei salvati in pausa con la 3.9 dopo aver cambiato i partecipanti mostrano un avviso: START integra quelle modifiche senza sorteggio; formato e impostazioni del sorteggio cambiati in pausa non si applicano (servirebbe «Rifai il sorteggio»).

## Funzioni

- **Schermo proiettore**: l'icona su ogni pannello lo manda su una finestra separata (sul secondo monitor, a tutto schermo), da solo e ingrandito al massimo. `PgUp`/`PgDn` cambiano pannello; la **galleria** li fa scorrere da sola ogni N secondi, anche su tutti i giochi. Si aggiorna in tempo reale.
- **Trascina e rilascia** giocatori e squadre tra gironi e partite, finché non ci sono risultati.
- **Archivio**: ogni torneo si salva in `Documenti\Tornei Fragmarathon\tornei` e si riprende dall'elenco. Il file si aggiorna da solo a ogni modifica.
- **Configurazioni dei server**: per ogni gioco un archivio di file di configurazione (carica, modifica, scarica anche in .zip) e un elenco di impostazioni nome/valore, ricavabile dai file, con le impostazioni tipiche dei giochi principali. Resta nel torneo e nei backup, non va ai giocatori.
- **Discord**: link di invito al server nelle informazioni del torneo; account Discord dei giocatori (in Partecipanti, dalla colonna Discord dei fogli, o chiesto dal bot Telegram all'iscrizione e con `/discord`); con un bot Discord, un canale privato per ogni partita pronta con il server su cui giocare, che a fine partita diventa di sola lettura con il risultato. Come creare il bot: [developer portal](https://discord.com/developers/applications), New Application, Bot, Reset Token; incolla il token in Impostazioni, Discord, premi Collega e poi "Aggiungi il bot al tuo server" (servono Gestisci canali e Gestisci permessi). Il token resta nella cartella dati dell'app, mai nei backup.
- **Aggiornamenti sicuri**: al primo avvio dopo un aggiornamento il programma aspetta la chiusura della versione vecchia, controlla e migra le configurazioni (bot, tornei, diretta) e mette da parte quelle rovinate. Anche il ripristino di un backup vecchio migra i dati e mostra un riepilogo per torneo e per bot: valori predefiniti messi e differenze rispetto a prima. Gli errori imprevisti finiscono in `Documenti\Tornei Fragmarathon\errori.log` invece di chiudere il programma.
- **Backup automatici** in `Documenti\Tornei Fragmarathon\backup` all'avvio del torneo, a ogni cambio di turno o girone e alla fine.
- **Storico del torneo**: la cronaca di ogni torneo, partita per partita, con orario, fase, risultato e un commento da telecronista; poi podio, classifica e qualche numero. Si scarica da **Risultati finali** (*Scarica lo storico*, con l'anteprima *Cronaca del torneo*) o dalla scheda di un torneo nell'elenco (*Storico*), anche se non è quello aperto. L'app per Windows ne tiene una copia aggiornata in `Documenti\Tornei Fragmarathon\storici`, riscritta pochi secondi dopo ogni partita. È un file Markdown (`.storico.md`) fatto per essere letto anche da una AI tra anni: intestazione YAML, nota su come leggerlo e, in fondo, il JSON completo (schema `tornei-fragmarathon/storico@1`). I commenti sono colore; i fatti sono risultati, orari e classifiche. Le partite giocate prima di questa funzione non hanno l'orario. Gli orari stanno nel torneo (`g.at`: id partita → [ms, firma del risultato], 0 = sconosciuto; `g.t0`/`g.t1` inizio e fine); il testo lo genera `js/cronaca.js`. Mai password, account Discord o Telegram, server di gioco o TeamSpeak.
- **Teste di serie** per ogni gioco: si scelgono prima di START (riquadro *Teste di serie*: aggiungi, ▲▼ per l'ordine, × per togliere) o si prendono **dalla ladder** (le prime N per punti, a squadre la media dei componenti). Valgono per il sorteggio: eliminazione diretta e doppia con il tabellone classico (1 contro l'ultima, 1 e 2 in metà opposte, chi passa il turno è una delle prime), gironi e free for all a serpentina (una per girone, gironi grandi come senza), svizzero con il primo turno metà alta contro metà bassa. Durante il gioco il numero si vede accanto al nome. Senza teste di serie il sorteggio è casuale come prima. Nel gioco: `g.tds` = nomi in ordine; lo storico le riporta (`seed`, `seeded`).
- **Ladder fra tutti i tornei** (*Tornei*, pulsante *Ladder*): punteggio Elo uguale per tutti all'inizio (2000, peso K 32, tutti e due impostabili), una classifica di tutti i giochi e una per gioco, frecce e punti rispetto al calcolo precedente, CSV. È una fotografia: **Ricalcola** rilegge tutti i tornei che contano e rifà i conti da zero; la schermata avvisa quando ci sono risultati nuovi. Ogni torneo ha *Conta per la ladder* (informazioni del torneo o elenco nella ladder; senza il campo conta), ogni gioco pure; i giochi in lavorazione non contano, i tavolini e i riposi nemmeno. *Unisci giocatori* unisce nomi scritti in modo diverso. Squadre: media dei componenti, stessa variazione a tutti; free for all: confronti a coppie per posizione. Sta fuori dai tornei: `ladder.json` nella cartella dei tornei (app) o `localStorage` `tornei-v2-ladder` (web); entra nel backup completo, non nell'esportazione di un torneo. Calcolo in `js/ladder.js`.
- **Guida contestuale**: pulsante `?` in ogni finestra, oppure `F1`.
- **Hall of Fame** dell'evento: punti per la posizione finale di ogni torneo più i punti fatti con il peso che scegli (o una formula), con posizione e punti per ogni gioco.
- **Temi**: automatico per gioco (Quake, Team Fortress 2, Wreckfest, Counter-Strike 2, FIFA), Fragmarathon, e temi ispirati alle piattaforme di tornei (stile Challonge, start.gg, ESL, Liquipedia, Battlefy). Il proiettore segue il tema.
- **Calcolo dei punti con formule** per ogni torneo: campi a scelta nel free for all (es. posizione e uccisioni) con modelli pronti, punti in classifica e punti per la Hall of Fame nei formati a partite. Linguaggio di formule sicuro, senza `eval`, testato in `tests/`.
- **Diretta su YouTube e Twitch** integrata (senza OBS): schermo del proiettore disegnato per la diretta, fino a 4 telecamere, microfono e audio del PC, 5 scene, titolo e logo in sovrimpressione, più destinazioni insieme, copia su disco, riconnessione automatica, encoder della scheda video. All'avvio il bot Telegram avvisa tutti con i link. ffmpeg incluso (`ffmpeg-static`).
- **Bot Telegram** configurabile dalle impostazioni: tornei, classifiche, partite, Hall of Fame con CSV, immagini, avvisi per torneo seguito, iscrizioni con conferma degli organizzatori, annunci, ruoli (amministratore, organizzatore tornei anche per singolo torneo, partecipante) e account collegati ai giocatori con avvisi personali (tocca a te, risultati, posizione). Gira nell'app (long polling), token solo sul PC. Come creare il proprio bot: guida in app (F1, «Bot Telegram»).
- **Logo con l'AI** per l'evento o per ogni torneo: Stable Diffusion locale (AUTOMATIC1111/Forge), server compatibili OpenAI (LocalAI), Pollinations o Hugging Face con chiave gratuita.
- **Proiettore "Riempi lo schermo"**: usa tutta la superficie anche su schermi non 16:9.
- **Logo e CSS personalizzati**: da IMPOSTAZIONI si carica il logo dell'evento e si importa un file `.css` (c'è un modello da scaricare). Una CSP impedisce al CSS di caricare risorse da internet.
- **Aggiornamenti automatici** dalla release GitHub (versione installata).
- Scorciatoie: `F1` guida, `Ctrl+S` salva torneo, `Ctrl+Z` annulla, `F5` proiettore (`PgUp`/`PgDn` pannelli, `G` galleria).

## Sviluppo

```bash
npm install
npm start          # avvia l'app Electron
npm test           # test della logica dei formati (node --test)
npm run dist       # crea dist/Tornei-Fragmarathon-Setup-<versione>.exe
```

Per provare la versione web in locale serve un server http qualsiasi nella cartella, per esempio `python -m http.server 5173`.

Struttura:

- `index.html`: pagina e stili di base (font e immagini incorporati).
- `js/formats.js`: logica pura dei formati (doppia eliminazione, svizzero, gironi), testata in `tests/`.
- `js/app.js`: interfaccia, salvataggio, proiettore, archivio.
- `js/help.js`: testi della guida.
- `css/ui.css`: stili di guida, archivio, nuovi formati e proiettore.
- `main.js`, `preload.js`: guscio Electron (cartelle, backup, finestra proiettore, aggiornamenti).
- `sw.js`, `manifest.webmanifest`: PWA.
- `site/`: pagina di presentazione su tornei.bais.info (Cloudflare Workers).

## Rilascio

1. Aggiorna `version` in `package.json` e `VERSION` in `sw.js`.
2. `npm run dist`.
3. Crea la release `vX.Y.Z` su GitHub caricando `dist/*.exe`, `dist/*.exe.blockmap` e `dist/latest.yml`: le installazioni esistenti si aggiornano da sole leggendo `latest.yml`.
4. `node site/build.mjs` e poi `npx wrangler deploy` dalla cartella `site/`.

L'installer non è firmato digitalmente: al primo avvio Windows SmartScreen può mostrare "Windows ha protetto il PC". Si prosegue con **Ulteriori informazioni** e poi **Esegui comunque**.

## Licenza

MIT. Vedi [LICENSE](LICENSE).

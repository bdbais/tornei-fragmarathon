# Tornei Fragmarathon

Gestore di tornei per LAN party, nato per il Fragmarathon. Dal sorteggio al podio, con uno schermo dedicato al proiettore che si legge da più di 5 metri.

Creato da [fragmarathon.net](https://fragmarathon.net) e Lazarus.

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

## Funzioni

- **Schermo proiettore**: l'icona su ogni pannello lo manda su una finestra separata (sul secondo monitor, a tutto schermo), da solo e ingrandito al massimo. `PgUp`/`PgDn` cambiano pannello; la **galleria** li fa scorrere da sola ogni N secondi, anche su tutti i giochi. Si aggiorna in tempo reale.
- **Trascina e rilascia** giocatori e squadre tra gironi e partite, finché non ci sono risultati.
- **Archivio**: ogni torneo si salva in `Documenti\Tornei Fragmarathon\tornei` e si riprende dall'elenco. Il file si aggiorna da solo a ogni modifica.
- **Backup automatici** in `Documenti\Tornei Fragmarathon\backup` all'avvio del torneo, a ogni cambio di turno o girone e alla fine.
- **Guida contestuale**: pulsante `?` in ogni finestra, oppure `F1`.
- **Hall of Fame** con i punti per ogni gioco, per giocatori e squadre.
- **Temi**: automatico per gioco (Quake, Team Fortress 2, Wreckfest, Counter-Strike 2, FIFA), Fragmarathon, e temi ispirati alle piattaforme di tornei (stile Challonge, start.gg, ESL, Liquipedia, Battlefy). Il proiettore segue il tema.
- **Calcolo dei punti con formule** per ogni torneo: campi a scelta nel free for all (es. posizione e uccisioni) con modelli pronti, punti in classifica e punti per la Hall of Fame nei formati a partite. Linguaggio di formule sicuro, senza `eval`, testato in `tests/`.
- **Logo con l'AI** per l'evento o per ogni torneo: Stable Diffusion locale (AUTOMATIC1111/Forge), server compatibili OpenAI (LocalAI), Pollinations o Hugging Face con chiave gratuita.
- **Proiettore "Riempi lo schermo"**: usa tutta la superficie anche su schermi non 16:9.
- **Logo e CSS personalizzati**: da MODIFICA si carica il logo dell'evento e si importa un file `.css` (c'è un modello da scaricare). Una CSP impedisce al CSS di caricare risorse da internet.
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

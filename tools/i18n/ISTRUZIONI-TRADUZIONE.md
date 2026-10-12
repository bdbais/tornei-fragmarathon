# Istruzioni per tradurre Tornei Fragmarathon

Progetto: `G:\AI\tornei-online\tornei-V3` (app per tornei di videogiochi a una LAN party, "Tornei Fragmarathon").

## Compito

Traduci dall'italiano alla lingua indicata tutte le frasi di `tools/i18n/strings.json` e scrivi **un solo file**: `js/lang/<codice>.js`. Non modificare nessun altro file.

`strings.json` contiene:
- `ui`: frasi dell'interfaccia (array di stringhe)
- `bot`: frasi del bot Telegram (array)
- `changelog`: titoli e voci delle novità (array)
- `help`: argomenti della guida `{ chiave: { t: titolo, h: HTML } }`

## Formato esatto di `js/lang/<codice>.js` (JavaScript valido, UTF-8)

```js
(function (d) { if (typeof module !== "undefined") module.exports = d; else (window.I18N_DICT = window.I18N_DICT || {})[d.code] = d; })({
  code: "<codice>", name: "<nome della lingua nella lingua stessa>",
  s: { "<frase italiana esatta>": "<traduzione>", ... },
  help: { "<chiave>": { t: "<titolo tradotto>", h: "<HTML tradotto>" }, ... }
});
```

In `s` metti TUTTE le stringhe di `ui` + `bot` + `changelog`, una per una, con la chiave IDENTICA all'originale (carattere per carattere, spazi iniziali e finali compresi). In `help` tutti gli argomenti con le stesse chiavi.

Consiglio: scrivi le traduzioni in un file JSON di appoggio nella cartella temporanea del sistema e poi genera `js/lang/<codice>.js` con un piccolo script Node che usa `JSON.stringify`, così gli escape sono sempre giusti. Lavora a blocchi (per esempio 150 frasi alla volta) per non perdere pezzi.

## Regole

1. Mantieni identici spazi iniziali/finali, punteggiatura di confine (": ", " – ", "…", "(", ")"), emoji, a capo.
2. Non tradurre: nomi propri e di prodotto (Telegram, WhatsApp, Google Maps, YouTube, Twitch, OBS, Fragmarathon, Lazarus, Hall of Fame, MVP, Challonge, start.gg, ESL, Liquipedia, Battlefy, Discord, Steam, Cloudflare, i nomi dei giochi come QUAKE LIVE, Team Fortress 2, Counter-Strike 2, Wreckfest, FIFA 26), i comandi del bot che iniziano con "/" (es. /tornei, /iscrivimi) e i loro argomenti tra < >, i formati come 123456789:AAH…, URL, estensioni (.json, .css, .tfbak), formule (tabella(pos; ...), max(...)) e nomi delle variabili delle formule (pos, punti, kill, vinta, pareggio...). I nomi dei tasti (Invio, Esc, Ctrl, PgUp) traducili solo se nella lingua hanno un nome diverso (Invio = Enter).
3. Nell'HTML della guida traduci solo il testo visibile: tag, attributi, classi restano uguali; dentro `<code>` traduci solo se è una frase normale, non se è un comando, un percorso o una formula. Il percorso "Documenti\Tornei Fragmarathon\..." diventa il nome della cartella Documenti di Windows nella lingua (es. Documents) seguito da "\Tornei Fragmarathon\..." invariato.
4. Stile: interfaccia concisa e naturale, verbi all'imperativo sui pulsanti, terminologia esports che si usa davvero nella lingua (bracket, round, playoff, free for all, swiss, double elimination...). Coerenza: la stessa parola italiana sempre tradotta allo stesso modo ("torneo", "girone", "turno", "giocatore", "squadra", "proiettore", "diretta").
5. Se una stringa non è testo per persone (CSS, font come "bold 16px ", tipi MIME come "image/*", codici), il valore è uguale alla chiave.
6. Se una frase è un frammento (es. " passano il primo turno senza giocare" o "Conferma: elimina "), traducila come frammento che si incastra con il resto, mantenendo gli spazi ai bordi.
7. Storico del torneo (frasi da telecronista di `js/cronaca.js`): i segnaposto tra graffe di una lettera (`{w}` vincitore, `{l}` perdente, `{a}` `{b}` i due lati, `{s}` punteggio, `{e}` chi esce, `{k}` vittorie di fila, `{g}` gioco, `{x}` `{y}` secondo e terzo (sempre nomi), `{c}` campione, `{p}` elenco di nomi, `{f}` formato, `{t}` titolo, `{n}` un numero (quanti giocatori, squadre, tornei o partite), `{i}` `{j}` teste di serie (numeri), `{v}` nome del programma o dello schema, `{z}` fuso orario come `+02:00`) restano identici e tutti presenti; puoi spostarli nella frase. I numeri sono dentro la frase intera, mai in un pezzo già composto: per l'italiano il programma sceglie la frase al singolare o al plurale; se la tua lingua ha più forme del plurale (russo, romeno…) scrivi la frase in modo che vada bene con ogni numero, per esempio con il numero dopo i due punti («Игроков: {n}»). Un segnaposto sbagliato sparisce dal testo. Queste frasi si usano solo intere: se manca la traduzione resta l'italiano, quindi traducile intere e con lo stesso tono (entusiasta, mai volgare, senza aggiungere fatti come uccisioni, mappe o minuti).

## Verifica obbligatoria prima di finire

Nella cartella del progetto:

```
node -e "const d=require('./js/lang/<codice>.js'),s=require('./tools/i18n/strings.json');const all=[...s.ui,...s.bot,...s.changelog];const miss=all.filter(k=>!(k in d.s));const bad=all.filter(k=>k in d.s&&(/^\s/.test(k)!==/^\s/.test(d.s[k])||/\s$/.test(k)!==/\s$/.test(d.s[k])));console.log('mancano',miss.length,'spazi diversi',bad.length,'help',Object.keys(d.help).length,'/',Object.keys(s.help).length)"
```

Deve stampare: `mancano 0 spazi diversi 0` e per `help` due numeri uguali (tutti gli argomenti della guida, es. `help 22 / 22`). Se no, correggi e ripeti.

Alla fine rispondi con una riga: codice lingua, numero di stringhe, al massimo 3 dubbi di traduzione importanti.

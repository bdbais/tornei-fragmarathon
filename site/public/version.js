// Numero e data dell'ultima versione, letti dalla release di GitHub, e link
// diretto all'installer. Se la richiesta non riesce resta il link alla pagina
// delle release: il download funziona comunque.
fetch("https://api.github.com/repos/bdbais/tornei-fragmarathon/releases/latest",
      { headers: { Accept: "application/vnd.github+json" } })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    if (!d || !d.tag_name) return;
    const exe = (d.assets || []).find((a) => /Setup.*\.exe$/i.test(a.name));
    if (exe) document.querySelectorAll("[data-dl]").forEach((a) => { a.href = exe.browser_download_url; });
    const when = new Date(d.published_at).toLocaleDateString("it-IT",
      { day: "numeric", month: "long", year: "numeric" });
    const mb = exe ? `, ${Math.round(exe.size / 1048576)} MB` : "";
    document.querySelectorAll("[data-ver]").forEach((el) => {
      el.textContent = `Versione ${d.tag_name.replace(/^v/i, "")} del ${when}${mb}`;
      el.hidden = false;
    });
  })
  .catch(() => {});

import { useEffect, useMemo, useRef, useState } from "react";
import { get, onValue, update } from "firebase/database";
import { artikliRestoran, formaRestoran, rootRestoran, usersRestoran } from "../firebase/refs";

const pageStyle = {
  width: "100%", minHeight: "100vh", boxSizing: "border-box", padding: "18px clamp(8px, 1.2vw, 18px) 40px",
  background: "#f4f7f6", color: "#17231f", fontFamily: "Inter,system-ui,sans-serif",
};
const panelStyle = {
  background: "white", border: "1px solid #e2eae6", borderRadius: 16,
  padding: "clamp(9px, 1.2vw, 16px)", boxShadow: "0 6px 20px #173d310a",
};
const buttonStyle = {
  border: "1px solid #d8e3de", borderRadius: 10, padding: "9px 13px", background: "white",
  color: "#173d31", fontWeight: 700, cursor: "pointer", font: "inherit",
};
const inputStyle = {
  width: "100%", boxSizing: "border-box", border: "1px solid #dce5e1", borderRadius: 9,
  padding: "9px 10px", font: "inherit", color: "#17231f", background: "white",
};
const headerCell = { padding: "10px 9px", background: "#176b55", color: "white", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
const cell = { padding: "9px", borderBottom: "1px solid #e6ece9", textAlign: "left", verticalAlign: "middle", fontSize: 13 };
const entryCell = { ...cell, padding: "7px 5px", fontSize: 12, overflowWrap: "anywhere" };

const objectValue = (value) => {
  if (Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [String(index), item]).filter(([, item]) => item != null));
  return value && typeof value === "object" ? value : {};
};
const number = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const parseCents = (value) => {
  const text = String(value ?? "").trim().replace(",", ".");
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const fraction = match[3] || "";
  let cents = Number(match[2]) * 100 + Number((fraction + "00").slice(0, 2));
  if (fraction.length > 2 && fraction[2] >= "5") cents++;
  return sign * cents;
};
const euros = (cents) => (Number(cents || 0) / 100).toFixed(2);
const money = (value) => euros(parseCents(value) ?? 0);
const formatQuantity = (value) => Number.isInteger(number(value)) ? String(number(value)) : String(number(value));
const dateOrder = (key) => {
  const match = String(key).match(/^(\d{1,2})_(\d{1,2})_(\d{4})$/);
  return match ? `${match[3]}${match[2].padStart(2, "0")}${match[1].padStart(2, "0")}` : key;
};
const displayDate = (key) => String(key || "").replaceAll("_", ".");
const displayTime = (key) => String(key || "").replaceAll("-", ":");
const currentKeys = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(now.getDate())}_${pad(now.getMonth() + 1)}_${now.getFullYear()}`,
    time: `${pad(now.getHours())}-${pad(now.getMinutes())}`,
  };
};
const currentPdfDateTime = () => {
  const now = new Date(); const pad = (value) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const cleanItems = (value) => Object.entries(objectValue(value)).map(([id, item]) => ({
  id,
  naziv: String(item?.naziv ?? ""),
  jedinica_mjere: String(item?.jedinica_mjere ?? ""),
  stanje_prethodno: number(item?.stanje_prethodno ?? item?.ostalo),
  ubaceno: number(item?.ubaceno),
  ukupno: number(item?.ukupno ?? item?.ostalo),
  kolicina: number(item?.kolicina),
  cijena: item?.cijena ?? 0,
  vrijednost: item?.vrijednost ?? 0,
  novo: number(item?.ostalo ?? item?.novo),
  ostalo: number(item?.ostalo ?? item?.novo),
  datum_unosa: String(item?.datum_unosa ?? ""),
}));

function downloadPdfFile(title, dateTime, items, report, fileName = title, savedByName = "") {
  let rows = Array.isArray(items) ? items : cleanItems(items);
  if (!rows.length && report?.artikli) rows = cleanItems(report.artikli);
  const pageW = 1684; const pageH = 1190;
  const labels = ["#", "Naziv", "Jedinica", "Stanje prethodno", "Novo stanje", "Ubačeno", "Ukupno", "Količina", "Cijena", "Vrijednost", "Ostalo"];
  const base = [42, 230, 76, 145, 106, 82, 82, 82, 82, 112, 76];
  const scale = (pageW - 80) / base.reduce((sum, value) => sum + value, 0);
  const widths = base.map((value) => value * scale);
  const groups = report ? [
    ["Prihodi", [["Obračun pića", report.ukupno], ["Kuhinja", report.kuhinja], ["Ukupno", report.zbir]]],
    ["Rashod", [["Dnevnice", report.dnevnice], ["Osoblje", report.osoblje], ["Kuća", report.kuca], ["Zbir", report.rashod]]],
    ["Zarada", [["Zarada", report.zarada]]],
    ["Smjena / Konobari", [["Smjena", report.smjena], ["Konobari", report.konobari]]],
  ] : [];
  const pages = [];
  const makePage = (numberOfPage) => {
    const canvas = document.createElement("canvas"); canvas.width = pageW; canvas.height = pageH;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, pageW, pageH);
    ctx.fillStyle = "#17231f"; ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.font = "bold 34px Arial"; ctx.fillText(title, pageW / 2, 48);
    ctx.textAlign = "left"; ctx.font = "20px Arial"; ctx.fillText(dateTime, 42, 91);
    if (report && savedByName && numberOfPage === 1) {
      ctx.textAlign = "left"; ctx.fillStyle = "#17231f"; ctx.font = "bold 22px Arial";
      ctx.fillText(`Sačuvao: ${savedByName}`, 42, 112);
    }
    ctx.textAlign = "right"; ctx.fillText(`Strana ${numberOfPage}`, pageW - 42, pageH - 28);
    const rect = (x, y, w, h, fill = "#e8f4ef") => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#9eada5"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); };
    const page = { canvas, ctx, rect, y: 188 };
    ctx.textAlign = "center"; ctx.font = "bold 17px Arial"; ctx.fillStyle = "#20362f";
    let x = 40;
    for (let i = 0; i < 7; i++) { rect(x, 122, widths[i], 66); ctx.fillStyle = "#20362f"; ctx.textAlign = i === 1 ? "left" : "center"; ctx.fillText(labels[i], i === 1 ? x + 10 : x + widths[i] / 2, 155, widths[i] - 16); x += widths[i]; }
    const soldW = widths[7] + widths[8] + widths[9]; rect(x, 122, soldW, 27); ctx.fillStyle = "#20362f"; ctx.fillText("PRODATO", x + soldW / 2, 136);
    let sx = x;
    for (let i = 7; i <= 9; i++) { rect(sx, 149, widths[i], 39); ctx.fillStyle = "#20362f"; ctx.fillText(labels[i], sx + widths[i] / 2, 168, widths[i] - 8); sx += widths[i]; }
    rect(x + soldW, 122, widths[10], 66); ctx.fillStyle = "#20362f"; ctx.fillText(labels[10], x + soldW + widths[10] / 2, 155, widths[10] - 8);
    return page;
  };
  const drawRow = (page, item, index) => {
    const values = [index + 1, item.naziv, item.jedinica_mjere, formatQuantity(item.stanje_prethodno), formatQuantity(item.novo), formatQuantity(item.ubaceno), formatQuantity(item.ukupno), formatQuantity(item.kolicina), `${money(item.cijena)} €`, `${money(item.vrijednost)} €`, formatQuantity(item.ostalo)];
    let x = 40; page.ctx.font = "16px Arial"; page.ctx.textAlign = "center"; page.ctx.fillStyle = "#25364a";
    values.forEach((value, column) => { page.rect(x, page.y, widths[column], 31, index % 2 ? "#f5f8f7" : "#fff"); page.ctx.fillStyle = "#25364a"; page.ctx.textAlign = column === 1 ? "left" : "center"; page.ctx.fillText(String(value ?? ""), column === 1 ? x + 10 : x + widths[column] / 2, page.y + 16, widths[column] - 16); x += widths[column]; });
    page.y += 31;
  };
  let page = makePage(1); pages.push(page);
  if (rows.length) {
    rows.forEach((item, index) => { if (page.y + 31 > 1010) { page = makePage(pages.length + 1); pages.push(page); } drawRow(page, item, index); });
  } else {
    page.ctx.textAlign = "center"; page.ctx.font = "18px Arial"; page.ctx.fillStyle = "#687974";
    page.ctx.fillText("Nema stavki u ovom obračunu.", pageW / 2, page.y + 20);
    page.y += 40;
  }
  if (report) {
    let y = page.y + 28;
    if (y + 250 > 1105) { page = makePage(pages.length + 1); pages.push(page); y = page.y + 18; }
    page.ctx.textAlign = "left"; page.ctx.fillStyle = "#17231f"; page.ctx.font = "bold 24px Arial"; page.ctx.fillText("Podaci obračuna", 42, y); y += 22;
    const groupWidths = [390, 390, 300, 510]; const maxRows = Math.max(...groups.map(([, rows]) => rows.length)); const groupH = 44 + maxRows * 36;
    let x = 40;
    groups.forEach(([heading, rows], group) => {
      const w = groupWidths[group]; page.ctx.fillStyle = "#176b55"; page.ctx.fillRect(x, y, w, 44); page.ctx.strokeStyle = "#9eada5"; page.ctx.strokeRect(x, y, w, groupH);
      page.ctx.fillStyle = "white"; page.ctx.font = "bold 18px Arial"; page.ctx.textAlign = "center"; page.ctx.fillText(heading, x + w / 2, y + 22, w - 16);
      rows.forEach(([label, value], row) => { const ry = y + 44 + row * 36; page.ctx.fillStyle = row % 2 ? "#f7faf8" : "white"; page.ctx.fillRect(x, ry, w, 36); page.ctx.strokeStyle = "#d0d9d4"; page.ctx.strokeRect(x, ry, w, 36); page.ctx.fillStyle = "#25364a"; page.ctx.textAlign = "left"; page.ctx.font = "16px Arial"; page.ctx.fillText(`${label}:`, x + 10, ry + 18, w * .56); page.ctx.font = "bold 16px Arial"; page.ctx.fillText(typeof value === "number" ? money(value) : String(value ?? ""), x + w * .43, ry + 18, w * .55 - 10); });
      x += w + 12;
    });
  }
  const enc = new TextEncoder();
  const join = (parts) => { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let at = 0; parts.forEach((part) => { out.set(part, at); at += part.length; }); return out; };
  const objects = []; objects[1] = enc.encode("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds = pages.map((_, index) => 3 + index * 3);
  objects[2] = enc.encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  pages.forEach((entry, index) => {
    const pageId = 3 + index * 3; const imageId = pageId + 1; const contentId = pageId + 2;
    const raw = atob(entry.canvas.toDataURL("image/jpeg", .92).split(",")[1]); const image = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    objects[pageId] = enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[imageId] = join([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${pageW} /Height ${pageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, enc.encode("\nendstream")]);
    const content = enc.encode("q 842 0 0 595 0 0 cm /Im0 Do Q"); objects[contentId] = join([enc.encode(`<< /Length ${content.length} >>\nstream\n`), content, enc.encode("\nendstream")]);
  });
  const chunks = [enc.encode("%PDF-1.4\n")]; const offsets = [0]; let length = chunks[0].length;
  for (let id = 1; id < objects.length; id++) { offsets[id] = length; const obj = join([enc.encode(`${id} 0 obj\n`), objects[id], enc.encode("\nendobj\n")]); chunks.push(obj); length += obj.length; }
  const xref = [`xref\n0 ${objects.length}\n`, "0000000000 65535 f \n", ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`), `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`];
  chunks.push(enc.encode(xref.join("")));
  const url = URL.createObjectURL(new Blob([join(chunks)], { type: "application/pdf" })); const link = document.createElement("a");
  link.href = url; link.download = `${fileName}_${dateTime}`.replace(/[^a-zA-Z0-9._-]+/g, "_") + ".pdf"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Obracun() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  }, []);
  const role = user?.titula || "";
  const isAdmin = role === "Administrator";
  const canReport = isAdmin || role === "Konobar";
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState({});
  const [usersById, setUsersById] = useState({});
  const [sold, setSold] = useState({});
  const [added, setAdded] = useState({});
  const soldInputsRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState({ kuhinja: "0", dnevnice: "0", osoblje: "0", kuca: "0", smjena: "", konobari: "" });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [form, setForm] = useState({ naziv: "", jedinica_mjere: "", stanje_prethodno: "", ubaceno: "", kolicina: "", cijena: "" });
  const [showSuccess, setShowSuccess] = useState(false);
  const [successText, setSuccessText] = useState("");

  const showSuccessAnimation = (text) => {
    setSuccessText(text);
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 2000);
  };

  useEffect(() => {
    const offItems = onValue(artikliRestoran(), (snapshot) => {
      const fresh = cleanItems(snapshot.val());
      setItems(fresh);
      setSold((current) => Object.fromEntries(fresh.map((item) => [item.id, current[item.id] ?? "0"])));
      setAdded((current) => Object.fromEntries(fresh.map((item) => [item.id, current[item.id] ?? "0"])));
      setLoading(false);
    }, (firebaseError) => { setError(`Ne mogu učitati artikle: ${firebaseError.message}`); setLoading(false); });
    const offHistory = isAdmin
      ? onValue(formaRestoran(), (snapshot) => setHistory(objectValue(snapshot.val())), (firebaseError) => setError(`Ne mogu učitati istoriju: ${firebaseError.message}`))
      : () => {};
    const offUsers = isAdmin
      ? onValue(usersRestoran(), (snapshot) => {
          const users = {};
          snapshot.forEach((childSnapshot) => {
            const record = objectValue(childSnapshot.val());
            users[childSnapshot.key] = String(record.ime || record.name || record.fullname || record.email || "");
          });
          setUsersById(users);
        }, (firebaseError) => setError(`Ne mogu učitati imena korisnika: ${firebaseError.message}`))
      : () => {};
    return () => { offItems(); offHistory(); offUsers(); };
  }, [isAdmin]);

  const dates = useMemo(() => Object.keys(history).sort((a, b) => dateOrder(b).localeCompare(dateOrder(a))), [history]);
  const times = useMemo(() => Object.keys(objectValue(history[selectedDate])).sort((a, b) => b.localeCompare(a)), [history, selectedDate]);
  useEffect(() => {
    if (!dates.length) { setSelectedDate(""); setSelectedTime(""); return; }
    if (!dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);
  useEffect(() => {
    if (!times.length) { setSelectedTime(""); return; }
    if (!times.includes(selectedTime)) setSelectedTime(times[0]);
  }, [times, selectedTime]);

  const currentHistory = objectValue(objectValue(history[selectedDate])[selectedTime]);
  const historyItems = cleanItems(currentHistory.artikli);
  const savedByName = usersById[String(currentHistory.sacuvano_od_uid || "")] || "Nepoznato";
  const advanceReportRow = (event, index) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const nextInput = soldInputsRef.current[index + 1];
    if (nextInput) nextInput.focus();
    else event.currentTarget.blur();
  };
  const saveReport = async () => {
    setError(""); setNotice("");
    if (!canReport) { setError("Nemate pravo da sačuvate obračun."); return; }
    if (!items.length) { setError("Nema artikala za obračun."); return; }
    for (const item of items) {
      const q = number(sold[item.id]); const a = canReport ? number(added[item.id]) : 0;
      if (q < 0 || a < 0 || !Number.isFinite(q) || !Number.isFinite(a)) { setError("Količine ne mogu biti negativne."); return; }
    }
    if (!window.confirm("Da li ste sigurni da želite da sačuvate obračun?")) return;
    setSaving(true);
    try {
      const latestSnapshot = await get(artikliRestoran());
      const latest = cleanItems(latestSnapshot.val());
      if (!latest.length) throw new Error("Na serveru nema artikala za obračun.");
      const updates = {};
      const snapshotItems = {};
      let totalCents = 0;
      latest.forEach((item) => {
        const q = number(sold[item.id]);
        const a = canReport ? number(added[item.id]) : 0;
        const previous = number(item.ostalo);
        const priceCents = parseCents(item.cijena);
        if (q < 0 || a < 0 || priceCents === null || priceCents < 0) throw new Error(`Provjeri količinu i cijenu artikla „${item.naziv}”.`);
        const newTotal = previous + a;
        const remaining = newTotal - q;
        const valueCents = Math.round(q * priceCents);
        const updatedItem = {
          ...objectValue(latestSnapshot.child(item.id).val()),
          stanje_prethodno: previous, ubaceno: a, ukupno: newTotal, kolicina: q,
          vrijednost: valueCents / 100, novo: remaining, ostalo: remaining,
        };
        snapshotItems[item.id] = updatedItem;
        const path = `Artikli/${item.id}/`;
        updates[`${path}stanje_prethodno`] = previous;
        updates[`${path}ubaceno`] = a;
        updates[`${path}ukupno`] = newTotal;
        updates[`${path}kolicina`] = q;
        updates[`${path}vrijednost`] = valueCents / 100;
        updates[`${path}novo`] = remaining;
        updates[`${path}ostalo`] = remaining;
        totalCents += valueCents;
      });
      const kitchenCents = canReport ? parseCents(fields.kuhinja || "0") : 0;
      const wagesCents = canReport ? parseCents(fields.dnevnice || "0") : 0;
      const staffCents = canReport ? parseCents(fields.osoblje || "0") : 0;
      const houseCents = canReport ? parseCents(fields.kuca || "0") : 0;
      if ([kitchenCents, wagesCents, staffCents, houseCents].some((value) => value === null || value < 0)) throw new Error("Unesi ispravne iznose koji nijesu negativni.");
      const total = totalCents;
      const kitchen = kitchenCents || 0;
      const income = total + kitchen;
      const expense = (wagesCents || 0) + (staffCents || 0) + (houseCents || 0);
      const report = {
        artikli: snapshotItems, ukupno: total / 100, kuhinja: kitchen / 100,
        zbir: income / 100, dnevnice: (wagesCents || 0) / 100,
        osoblje: (staffCents || 0) / 100, kuca: (houseCents || 0) / 100,
        rashod: expense / 100, zarada: (income - expense) / 100,
        smjena: fields.smjena.trim(),
        konobari: fields.konobari.trim(),
        sacuvano_u: Date.now(), sacuvano_od_uid: user?.uid || "",
      };
      const { date, time } = currentKeys();
      Object.entries(report).forEach(([key, value]) => { updates[`Forma/${date}/${time}/${key}`] = value; });
      await update(rootRestoran(), updates);
      setNotice("Obračun je uspješno sačuvan.");
      showSuccessAnimation("Obračun je uspješno sačuvan.");
      setSold(Object.fromEntries(latest.map((item) => [item.id, "0"])));
      setAdded(Object.fromEntries(latest.map((item) => [item.id, "0"])));
      if (canReport) setFields({ smjena: "", konobari: "", kuhinja: "0", dnevnice: "0", osoblje: "0", kuca: "0" });
    } catch (saveError) {
      setError(`Obračun nije sačuvan: ${saveError.message}`);
    } finally { setSaving(false); }
  };

  const openNew = () => { setError(""); setDialogError(""); setForm({ naziv: "", jedinica_mjere: "", stanje_prethodno: "", ubaceno: "", kolicina: "", cijena: "" }); setDialog({ type: "new" }); };
  const openEdit = (item) => { setError(""); setDialogError(""); setForm({ naziv: item.naziv, jedinica_mjere: item.jedinica_mjere, stanje_prethodno: String(item.ostalo), ubaceno: String(item.ubaceno), kolicina: String(item.kolicina), cijena: String(item.cijena) }); setDialog({ type: "edit", id: item.id }); };
  const saveItem = async () => {
    const name = form.naziv.trim(); const price = parseCents(form.cijena); const stock = number(form.stanje_prethodno);
    const quantityAdded = number(form.ubaceno); const quantitySold = number(form.kolicina);
    if (!name || price === null || price < 0 || form.ubaceno.trim() === "" || (dialog.type === "edit" && form.stanje_prethodno.trim() === "") || stock < 0 || quantityAdded < 0 || quantitySold < 0) { setDialogError("Unesi naziv, početnu količinu i cijenu. Vrijednosti ne mogu biti negativne."); return; }
    setSaving(true); setError(""); setDialogError("");
    try {
      let id = dialog.id;
      if (dialog.type === "new") {
        const snapshot = await get(artikliRestoran());
        id = "1"; while (snapshot.hasChild(id)) id = String(Number(id) + 1);
        const initial = quantityAdded;
        await update(artikliRestoran(), { [id]: { redni_broj: id, naziv: name, jedinica_mjere: form.jedinica_mjere.trim(), stanje_prethodno: 0, ubaceno: initial, ukupno: initial, kolicina: 0, cijena: price / 100, vrijednost: 0, novo: initial, ostalo: initial, datum_unosa: new Date().toLocaleDateString("sr-Latn") } });
      } else {
        const total = stock + quantityAdded; const remainder = total - quantitySold;
        await update(artikliRestoran(), {
          [`${id}/naziv`]: name, [`${id}/jedinica_mjere`]: form.jedinica_mjere.trim(),
          [`${id}/stanje_prethodno`]: stock, [`${id}/ubaceno`]: quantityAdded,
          [`${id}/kolicina`]: quantitySold, [`${id}/cijena`]: price / 100,
          [`${id}/ukupno`]: total, [`${id}/novo`]: remainder, [`${id}/ostalo`]: remainder,
          [`${id}/vrijednost`]: Math.round(quantitySold * price) / 100,
        });
      }
      setDialog(null); setDialogError(""); setNotice(dialog.type === "new" ? "Artikal je dodat." : "Artikal je izmijenjen.");
      if (dialog.type === "new") showSuccessAnimation("Artikal je dodat");
    } catch (saveError) { setDialogError(`Izmjena nije sačuvana: ${saveError.message}`); }
    finally { setSaving(false); }
  };
  const deleteItem = async (item) => {
    if (!window.confirm(`Ukloniti „${item.naziv}” iz trenutnog stanja artikala? Istorijski obračuni ostaju.`)) return;
    try { await update(artikliRestoran(), { [item.id]: null }); setNotice("Artikal je obrisan."); }
    catch (deleteError) { setError(`Brisanje nije uspjelo: ${deleteError.message}`); }
  };

  if (!canReport) return <main style={pageStyle}><section style={{ ...panelStyle, maxWidth: 640, margin: "12vh auto" }}>Ovom obračunu mogu pristupiti Administrator i Konobar.</section></main>;
  const summaryFields = [
    ["Prihodi", [["Obračun pića", currentHistory.ukupno], ["Kuhinja", currentHistory.kuhinja], ["Ukupno", currentHistory.zbir]]],
    ["Rashod", [["Dnevnice", currentHistory.dnevnice], ["Osoblje", currentHistory.osoblje], ["Kuća", currentHistory.kuca], ["Zbir", currentHistory.rashod]]],
    ["Zarada", [["Zarada", currentHistory.zarada]]],
    ["Smjena / Konobari", [["Smjena", currentHistory.smjena], ["Konobari", currentHistory.konobari]]],
  ];
  const summaryValue = (value) => value === null || value === undefined || value === "" ? "" : typeof value === "number" ? money(value) : String(value);

  const tableHeader = (actions = false) => <thead>
    <tr>{["#", "Naziv", "Jedinica", "Stanje prethodno", "Novo stanje", "Ubačeno", "Ukupno"].map((heading) => <th key={heading} rowSpan={2} style={headerCell}>{heading}</th>)}
      <th colSpan={3} style={{ ...headerCell, textAlign: "center" }}>PRODATO</th><th rowSpan={2} style={headerCell}>Ostalo</th>{actions && <th rowSpan={2} style={headerCell}>Akcije</th>}</tr>
    <tr>{["Količina", "Cijena", "Vrijednost"].map((heading) => <th key={heading} style={{ ...headerCell, textAlign: "center" }}>{heading}</th>)}</tr>
  </thead>;

  return <main style={pageStyle}>
    <div style={{ width: "100%", minWidth: 0, margin: "0 auto" }}>
      <header style={{ marginBottom: 14 }}><h1 style={{ margin: "4px 0", fontSize: 28 }}>Obračun artikala</h1><p style={{ margin: 0, color: "#718078", fontSize: 14 }}>{isAdmin ? "Pregled stanja, istorije i dnevnog obračuna." : "Unos i čuvanje dnevnog obračuna."}</p></header>
      {(error || notice) && <div role={error ? "alert" : "status"} style={{ ...panelStyle, marginBottom: 12, padding: "11px 14px", color: error ? "#982e2a" : "#176b55", background: error ? "#fff5f4" : "#f0f8f3" }}>{error || notice}</div>}

      {isAdmin && (<>
      <section style={{ ...panelStyle, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>1. Dodavanje novog artikla</h2>
        <p style={{ margin: "0 0 12px", color: "#687974", fontSize: 13 }}>Dodajte naziv, jedinicu mjere, početnu količinu i cijenu.</p>
        {isAdmin ? <button style={{ ...buttonStyle, color: "white", background: "#176b55", borderColor: "#176b55" }} onClick={openNew}>＋ Dodaj artikal</button> : <span style={{ color: "#718078", fontSize: 13 }}>Dodavanje artikala je dostupno administratoru.</span>}
      </section>

      <section className="accounting-panel" style={{ ...panelStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 18 }}>2. Istorija obračuna</h2><p style={{ color: "#718078", margin: "4px 0 0", fontSize: 13 }}>Izaberite datum, pa vrijeme sačuvanog obračuna.</p></div>
          {dates.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select aria-label="Datum obračuna" style={{ ...inputStyle, width: "auto", minWidth: 150 }} value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedTime(Object.keys(objectValue(history[event.target.value])).sort((a, b) => b.localeCompare(a))[0] || ""); }}>{dates.map((date) => <option key={date} value={date}>{displayDate(date)}</option>)}</select>
            <select aria-label="Vrijeme obračuna" style={{ ...inputStyle, width: "auto", minWidth: 110 }} value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)}>{times.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select>
            {selectedTime && <button style={buttonStyle} onClick={() => downloadPdfFile("Dnevni obračun pića", `${displayDate(selectedDate)} ${displayTime(selectedTime)}`, historyItems, currentHistory, `Obracun_${selectedDate}_${selectedTime}`, savedByName)}>Sačuvaj izabrani obračun kao PDF</button>}
          </div>}
        </div>
        {!dates.length ? <div style={{ color: "#718078", padding: "16px 0 2px" }}>Još nema sačuvanih obračuna.</div> : <>
          <div style={{ color: "#526477", fontSize: 13, margin: "10px 0 8px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span>Obračun: {displayDate(selectedDate)} u {displayTime(selectedTime)}</span>
            <strong>Sačuvao: {savedByName}</strong>
          </div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse" }}>{tableHeader()}
            <tbody>{historyItems.length ? historyItems.map((item, index) => <tr key={item.id} style={{ background: index % 2 ? "#f7faf8" : "white" }}><td style={cell}>{index + 1}</td><td style={{ ...cell, fontWeight: 700 }}>{item.naziv}</td><td style={cell}>{item.jedinica_mjere}</td><td style={cell}>{formatQuantity(item.stanje_prethodno)}</td><td style={cell}>{formatQuantity(item.novo)}</td><td style={cell}>{formatQuantity(item.ubaceno)}</td><td style={cell}>{formatQuantity(item.ukupno)}</td><td style={cell}>{formatQuantity(item.kolicina)}</td><td style={cell}>{money(item.cijena)}</td><td style={cell}>{money(item.vrijednost)}</td><td style={cell}>{formatQuantity(item.ostalo)}</td></tr>) : <tr><td style={cell} colSpan={11}>Nema stavki u ovom obračunu.</td></tr>}</tbody>
          </table></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8, marginTop: 12 }}>{summaryFields.map(([heading, values]) => <section key={heading} style={{ border: "1px solid #dce5e1", borderRadius: 12, overflow: "hidden", background: "white" }}><h3 style={{ margin: 0, padding: "9px 11px", textAlign: "center", background: "#176b55", color: "white", fontSize: 13 }}>{heading}</h3>{values.map(([label, value]) => <div key={label} style={{ padding: "8px 10px", borderTop: "1px solid #e6ece9", color: "#25364a", fontSize: 12 }}>{label}: <strong>{summaryValue(value)}</strong></div>)}</section>)}</div>
        </>}
      </section>

      <section className="accounting-panel" style={{ ...panelStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}><div><h2 style={{ margin: 0, fontSize: 18 }}>3. Trenutno stanje artikala</h2><div style={{ color: "#718078", marginTop: 4, fontSize: 13 }}>{loading ? "Učitavanje artikala…" : items.length ? `Ukupno artikala: ${items.length}` : "Nema unesenih artikala."}</div></div><button style={buttonStyle} disabled={!items.length} onClick={() => downloadPdfFile("Stanje od poslednjeg obračuna artikala", currentPdfDateTime(), items, null, "Stanje_artikala")}>Sačuvaj trenutno stanje kao PDF</button></div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1230, borderCollapse: "collapse" }}>{tableHeader(true)}
          <tbody>{loading ? <tr><td style={cell} colSpan={12}>Učitavam artikle…</td></tr> : items.length ? items.map((item, index) => <tr key={item.id} style={{ background: index % 2 ? "#f7faf8" : "white" }}><td style={cell}>{index + 1}</td><td style={{ ...cell, fontWeight: 700 }}>{item.naziv}</td><td style={cell}>{item.jedinica_mjere}</td><td style={cell}>{formatQuantity(item.stanje_prethodno)}</td><td style={cell}>{formatQuantity(item.novo)}</td><td style={cell}>{formatQuantity(item.ubaceno)}</td><td style={cell}>{formatQuantity(item.ukupno)}</td><td style={cell}>{formatQuantity(item.kolicina)}</td><td style={cell}>{money(item.cijena)}</td><td style={cell}>{money(item.vrijednost)}</td><td style={cell}>{formatQuantity(item.ostalo)}</td><td className="accounting-no-print" style={{ ...cell, whiteSpace: "nowrap" }}>{isAdmin ? <><button style={{ ...buttonStyle, padding: "6px 8px" }} onClick={() => openEdit(item)}>Izmijeni</button> <button style={{ ...buttonStyle, padding: "6px 8px", color: "#a32d31" }} onClick={() => deleteItem(item)}>Obriši</button></> : "Bez prava izmjene"}</td></tr>) : <tr><td style={cell} colSpan={12}>Nema artikala za prikaz.</td></tr>}</tbody>
        </table></div>
      </section>

      </>)}
      <section className="accounting-panel" style={panelStyle}>
        <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>4. Unos obračuna</h2>
        <p style={{ margin: "0 0 12px", color: "#687974", fontSize: 13 }}>Unesite prodatu i dodatnu količinu po artiklu.</p>
        <div style={{ width: "100%", minWidth: 0, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 0, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead><tr>{[["#", "10%"], ["Ime artikla", "50%"], ["Prodato", "20%"], ["Dodaj", "20%"]].map(([heading, width]) => <th key={heading} style={{ ...headerCell, width, padding: "8px 5px", fontSize: 11, whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "left" }}>{heading}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td style={entryCell} colSpan={4}>Učitavam artikle…</td></tr> : items.length ? items.map((item, index) => <tr key={item.id} style={{ background: index % 2 ? "#f7faf8" : "white" }}><td style={entryCell}>{index + 1}</td><td style={{ ...entryCell, fontWeight: 700 }}>{item.naziv}</td><td style={entryCell}><input ref={(node) => { soldInputsRef.current[index] = node; }} aria-label={`Prodato ${item.naziv}`} style={{ ...inputStyle, minWidth: 0, padding: "7px 4px", fontSize: 13 }} inputMode="decimal" enterKeyHint="next" value={sold[item.id] ?? "0"} onFocus={(event) => { if (event.target.value === "0") setSold((current) => ({ ...current, [item.id]: "" })); }} onBlur={(event) => { if (event.target.value === "") setSold((current) => ({ ...current, [item.id]: "0" })); }} onKeyDown={(event) => advanceReportRow(event, index)} onChange={(event) => setSold((current) => ({ ...current, [item.id]: event.target.value }))} /></td><td style={entryCell}><input aria-label={`Dodaj ${item.naziv}`} style={{ ...inputStyle, minWidth: 0, padding: "7px 4px", fontSize: 13 }} inputMode="decimal" enterKeyHint="next" value={added[item.id] ?? "0"} disabled={!canReport} onFocus={(event) => { if (event.target.value === "0") setAdded((current) => ({ ...current, [item.id]: "" })); }} onBlur={(event) => { if (event.target.value === "") setAdded((current) => ({ ...current, [item.id]: "0" })); }} onKeyDown={(event) => advanceReportRow(event, index)} onChange={(event) => setAdded((current) => ({ ...current, [item.id]: event.target.value }))} /></td></tr>) : <tr><td style={entryCell} colSpan={4}>Prvo dodajte artikle.</td></tr>}</tbody>
        </table></div>
        <h3 style={{ margin: "16px 0 9px", fontSize: 15, color: "#172b4d" }}>Dodatni podaci obračuna</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 10 }}>
          {[["smjena", "Smjena (npr. Prva smjena)", "text"], ["konobari", "Konobari (imena)", "text"], ["kuhinja", "Kuhinja — iznos zarade", "decimal"], ["dnevnice", "Dnevnice", "decimal"], ["osoblje", "Osoblje", "decimal"], ["kuca", "Kuća", "decimal"]].map(([key, label, type]) => <label key={key} style={{ display: "grid", gap: 5, color: "#62736c", fontSize: 12, fontWeight: 750 }}>{label}<input style={inputStyle} inputMode={type === "decimal" ? "decimal" : undefined} enterKeyHint="next" value={fields[key]} disabled={!canReport} onFocus={(event) => { if (type === "decimal" && event.target.value === "0") setFields((current) => ({ ...current, [key]: "" })); }} onBlur={(event) => { if (type === "decimal" && event.target.value === "") setFields((current) => ({ ...current, [key]: "0" })); }} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        </div>
        <button style={{ ...buttonStyle, display: "block", width: "100%", marginTop: 14, minHeight: 48, color: "white", background: "#176b55", borderColor: "#176b55", fontWeight: 800 }} disabled={saving || loading || !items.length} onClick={saveReport}>{saving ? "Čuvam obračun…" : "Sačuvaj obračun"}</button>
      </section>
    </div>
    {showSuccess && <div className="animate-fadeIn" role="status" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 24 }}>
        <div className="animate-checkCircle" style={{ width: 112, height: 112, margin: "0 auto", borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 50px rgba(249,115,22,.6)" }}>
          <svg width="62" height="62" viewBox="0 0 52 52" fill="none" aria-hidden="true"><path d="M14 27 L22 35 L39 16" stroke="black" pathLength="100" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="animate-drawCheck" /></svg>
        </div>
        <h1 style={{ marginTop: 30, color: "white", fontSize: 32, fontWeight: 900, animation: "textUp .45s ease-out" }}>{successText}</h1>
      </div>
    </div>}
    {dialog && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }} style={{ position: "fixed", zIndex: 20, inset: 0, background: "#101b17a6", display: "grid", placeItems: "center", padding: 14 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="article-dialog-title" style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 16, padding: 20, boxShadow: "0 24px 70px #0004" }}>
        <h2 id="article-dialog-title" style={{ margin: "0 0 14px" }}>{dialog.type === "new" ? "Novi artikal" : "Izmijeni artikal"}</h2>
        <div style={{ display: "grid", gap: 11 }}>
          {[["naziv", "Naziv artikla", "text"], ["jedinica_mjere", "Jedinica mjere", "text"], ...(dialog.type === "edit" ? [["stanje_prethodno", "Preostalo stanje", "decimal"]] : []), ["ubaceno", dialog.type === "new" ? "Početno ubačeno" : "Ubačeno", "decimal"], ...(dialog.type === "edit" ? [["kolicina", "Prodato", "decimal"]] : []), ["cijena", "Cijena (€)", "decimal"]].map(([key, label, type]) => <label key={key} style={{ display: "grid", gap: 5, color: "#62736c", fontSize: 12, fontWeight: 750 }}>{label}<input required={dialog.type === "new" && ["ubaceno", "cijena"].includes(key)} placeholder={dialog.type === "new" && ["ubaceno", "cijena"].includes(key) ? "Obavezno" : undefined} style={inputStyle} inputMode={type === "decimal" ? "decimal" : undefined} value={form[key]} onChange={(event) => { setDialogError(""); setForm((current) => ({ ...current, [key]: event.target.value })); }} /></label>)}
        </div>
        {dialogError && <div role="alert" style={{ marginTop: 12, borderRadius: 9, padding: 10, background: "#fff0ef", color: "#982e2a", fontSize: 13 }}>{dialogError}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button style={buttonStyle} onClick={() => setDialog(null)}>Otkaži</button><button disabled={saving} style={{ ...buttonStyle, background: "#176b55", borderColor: "#176b55", color: "white" }} onClick={saveItem}>{saving ? "Čuvam…" : "Sačuvaj"}</button></div>
      </section>
    </div>}
  </main>;
}

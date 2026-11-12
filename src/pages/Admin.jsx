import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, update } from "firebase/database";
import { menuRestoran } from "../firebase/refs";

const styles = {
  page: { minHeight: "100vh", width: "100%", boxSizing: "border-box", background: "#f4f7f6", color: "#17231f", padding: "18px clamp(8px, 1.2vw, 20px) 100px", fontFamily: "Inter,system-ui,sans-serif" },
  shell: { width: "100%", maxWidth: "none", margin: "0 auto", boxSizing: "border-box" },
  panel: { background: "white", border: "1px solid #e2eae6", borderRadius: 17, padding: 16, boxShadow: "0 6px 20px #173d310a" },
  button: { border: "1px solid #d8e3de", borderRadius: 11, padding: "10px 14px", background: "white", color: "#173d31", fontWeight: 700, cursor: "pointer", font: "inherit" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dce5e1", borderRadius: 10, padding: "11px 12px", font: "inherit", color: "#17231f", background: "white" },
  label: { display: "grid", gap: 6, fontSize: 12, fontWeight: 750, color: "#62736c" },
};

const legacyDateValue = (date) => {
  const match = String(date).match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime() : 0;
};

function readMenu(menu) {
  if (menu?.Podaci && typeof menu.Podaci === "object") {
    return { items: menu.Podaci, createAt: String(menu.createAt || ""), flat: true };
  }
  const dated = Object.entries(menu || {})
    .filter(([key, value]) => key !== "createAt" && key !== "createAtMillis" && value?.Podaci)
    .sort(([a], [b]) => legacyDateValue(b) - legacyDateValue(a));
  return {
    items: dated[0]?.[1]?.Podaci || {},
    createAt: String(menu?.createAt || dated[0]?.[0] || ""),
    flat: false,
  };
}

function displayCreateAt(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})_(\d{1,2}):(\d{2})$/);
  return match
    ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]} · ${match[4].padStart(2, "0")}:${match[5]}`
    : String(value || "");
}

const parsePrice = (value) => {
  if (!String(value ?? "").trim()) return null;
  const amount = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
};

const newEntry = (id, item = {}) => ({
  id,
  name: String(item?.name || ""),
  description: String(item?.description || ""),
  category: String(item?.category || ""),
  price: String(item?.price ?? "0"),
  deleted: false,
});

export default function Admin() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  }, []);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Sve");
  const [message, setMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [modal, setModal] = useState(null);
  const [addForm, setAddForm] = useState({ category: "", name: "", description: "", price: "" });
  const [editValue, setEditValue] = useState("");
  const [bulkAmount, setBulkAmount] = useState("0.1");
  const [bulkDirection, setBulkDirection] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successText, setSuccessText] = useState("");
  const [menuCreateAt, setMenuCreateAt] = useState("");
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const entriesRef = useRef([]);
  const originalEntriesRef = useRef({});
  const flatMenuRef = useRef(true);
  dirtyRef.current = dirty;
  savingRef.current = saving;
  entriesRef.current = entries;

  const hasPendingChanges = (items) => items.some((item) => {
    const original = originalEntriesRef.current[item.id];
    if (item.id.startsWith("new-")) return !item.deleted;
    if (!original) return !item.deleted;
    if (item.deleted) return true;
    const textChanged = ["name", "category", "description"].some((field) =>
      String(item[field] ?? "").trim() !== String(original[field] ?? "").trim());
    const currentPrice = parsePrice(item.price);
    const originalPrice = parsePrice(original.price);
    const priceChanged = currentPrice === null || originalPrice === null
      ? String(item.price) !== String(original.price)
      : Math.abs(currentPrice - originalPrice) > 0.000001;
    return textChanged || priceChanged;
  });

  const fieldWasChanged = (item, field) => {
    if (item.id.startsWith("new-")) return true;
    const original = originalEntriesRef.current[item.id];
    if (!original) return true;
    if (field === "price") {
      const currentPrice = parsePrice(item.price);
      const originalPrice = parsePrice(original.price);
      return currentPrice === null || originalPrice === null
        ? String(item.price) !== String(original.price)
        : Math.abs(currentPrice - originalPrice) > 0.000001;
    }
    return String(item[field] ?? "").trim() !== String(original[field] ?? "").trim();
  };

  const fieldBoxStyle = (item, field, normalBackground) => {
    const changed = fieldWasChanged(item, field);
    return {
      background: changed ? "rgba(235, 82, 128, 0.18)" : normalBackground,
      borderColor: changed ? "rgba(218, 126, 151, 0.8)" : "#dce5e1",
      boxShadow: changed ? "inset 0 0 0 1px rgba(218, 126, 151, 0.12)" : "none",
    };
  };

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onValue(menuRestoran(), (snapshot) => {
      if (!mounted) return;
      if (savingRef.current) return;
      const menu = readMenu(snapshot.exists() ? snapshot.val() : {});
      const remoteItems = Object.entries(menu.items).map(([id, item]) => newEntry(id, item));
      const remoteOriginals = Object.fromEntries(remoteItems.map((item) => [item.id, item]));
      const items = dirtyRef.current
        ? rebaseUnsavedEntries(remoteItems)
        : remoteItems;
      originalEntriesRef.current = remoteOriginals;
      flatMenuRef.current = menu.flat;
      setMenuCreateAt(menu.createAt);
      entriesRef.current = items;
      setEntries(items);
      const changed = hasPendingChanges(items);
      dirtyRef.current = changed;
      setDirty(changed);
      setMessage("");
      setLoading(false);
    }, (error) => {
      if (!mounted) return;
      setMessage(`Ne mogu učitati meni: ${error.message}`);
      setLoading(false);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const rebaseUnsavedEntries = (remoteItems) => {
    const currentItems = entriesRef.current;
    const originalItems = originalEntriesRef.current;
    const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
    const handledIds = new Set();
    const merged = remoteItems.map((remote) => {
      const local = currentItems.find((item) => item.id === remote.id);
      if (!local) return remote;
      handledIds.add(local.id);
      if (local.deleted) return { ...remote, deleted: true };

      const original = originalItems[local.id];
      if (!original) return remote;
      return {
        ...remote,
        name: String(local.name).trim() !== String(original.name).trim() ? local.name : remote.name,
        category: String(local.category).trim() !== String(original.category).trim() ? local.category : remote.category,
        description: String(local.description).trim() !== String(original.description).trim() ? local.description : remote.description,
        price: fieldWasChanged(local, "price") ? local.price : remote.price,
      };
    });

    currentItems.forEach((local) => {
      if (local.deleted || handledIds.has(local.id)) return;
      if (local.id.startsWith("new-")) {
        merged.push(local);
        return;
      }
      const original = originalItems[local.id];
      if (!original) return;
      const changed = ["name", "category", "description", "price"]
        .some((field) => fieldWasChanged(local, field));
      if (changed && !remoteById.has(local.id)) {
        merged.push({ ...local, id: "new-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) });
      }
    });
    return merged;
  };

  const categories = useMemo(() => ["Sve", ...[...new Set(entries.filter((item) => !item.deleted).map((item) => item.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sr", { sensitivity: "base" }))], [entries]);
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : "Sve";
  const visible = entries.filter((item) => !item.deleted
    && (activeCategory === "Sve" || item.category === activeCategory)
    && `${item.name} ${item.category} ${item.description}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));

  const openAddDialog = () => {
    setDialogError("");
    setAddForm({ category: activeCategory === "Sve" ? "" : activeCategory, name: "", description: "", price: "" });
    setModal({ type: "add" });
  };

  const showSuccessAnimation = (text) => {
    setSuccessText(text);
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 2000);
  };

  const confirmAdd = async () => {
    const category = addForm.category.trim();
    const name = addForm.name.trim();
    const price = parsePrice(addForm.price);
    if (!category || !name || price === null || price < 0) {
      setDialogError("Unesi kategoriju, naziv i ispravnu cijenu 0 ili veću.");
      return;
    }
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const addedEntry = newEntry(id, { ...addForm, category, name, price: price.toFixed(2) });
    const saved = await persistMenu([...entries, addedEntry], "Artikal je uspješno dodat.");
    if (saved) {
      setSelectedCategory(category);
      setModal(null);
      showSuccessAnimation("Artikal je dodat");
    }
  };

  const openFieldEditor = (item, field) => {
    setDialogError("");
    const titles = { category: "Kategorija", name: "Naziv artikla", description: "Opis artikla", price: "Cijena (€)" };
    setEditValue(item[field]);
    setModal({ type: "edit", id: item.id, field, fieldTitle: titles[field], itemName: item.name || "Artikal" });
  };

  const confirmEdit = () => {
    const item = entries.find((entry) => entry.id === modal.id);
    if (!item) return setModal(null);
    const { field, fieldTitle } = modal;
    let value = editValue.trim();
    if ((field === "category" || field === "name") && !value) {
      setDialogError(`${fieldTitle} ne može biti prazno.`);
      return;
    }
    if (field === "price") {
      const parsed = parsePrice(value);
      if (parsed === null || parsed < 0) {
        setDialogError("Unesi cijenu 0 ili veću, na primjer 4,50.");
        return;
      }
      value = parsed.toFixed(2);
    }
    if (value !== item[field]) {
      const updatedEntries = entries.map((entry) => entry.id === item.id ? { ...entry, [field]: value } : entry);
      setEntries(updatedEntries);
      const changed = hasPendingChanges(updatedEntries);
      dirtyRef.current = changed;
      setDirty(changed);
      setMessage(changed ? "Imaš izmjene koje još nijesu sačuvane na serveru." : "");
    }
    setModal(null);
  };

  const persistMenu = async (sourceEntries, successMessage) => {
    if (saving) return false;
    const updates = {};
    const savedEntries = [];
    const numericIds = sourceEntries.filter((item) => /^\d+$/.test(item.id)).map((item) => Number(item.id));
    let nextId = numericIds.length ? Math.max(...numericIds) + 1 : 0;
    for (const item of sourceEntries) {
      if (item.deleted) {
        if (!item.id.startsWith("new-") && flatMenuRef.current) updates[`Podaci/${item.id}`] = null;
        continue;
      }
      const name = item.name.trim();
      const category = item.category.trim();
      const price = parsePrice(item.price);
      if (!name || !category || price === null || price < 0) {
        setDialogError(`Provjeri kategoriju, naziv i cijenu artikla „${name || "bez naziva"}”.`);
        setMessage(`Provjeri kategoriju, naziv i cijenu artikla „${name || "bez naziva"}”.`);
        return false;
      }
      const id = item.id.startsWith("new-") ? String(nextId++) : item.id;
      const savedItem = { name, category, description: item.description.trim(), price };
      if (flatMenuRef.current) {
        if (item.id.startsWith("new-")) {
          updates[`Podaci/${id}`] = savedItem;
        } else {
          const original = originalEntriesRef.current[item.id];
          if (!original) {
            updates[`Podaci/${id}`] = savedItem;
          } else {
            const path = `Podaci/${id}/`;
            if (name !== original.name.trim()) updates[`${path}name`] = name;
            if (category !== original.category.trim()) updates[`${path}category`] = category;
            if (savedItem.description !== original.description.trim()) updates[`${path}description`] = savedItem.description;
            const originalPrice = parsePrice(original.price);
            if (originalPrice === null || Math.abs(price - originalPrice) > 0.000001) {
              updates[`${path}price`] = price;
            }
          }
        }
      }
      savedEntries.push(newEntry(id, savedItem));
    }
    if (!flatMenuRef.current) {
      updates.Podaci = Object.fromEntries(savedEntries.map((item) => [item.id, {
        name: item.name.trim(),
        category: item.category.trim(),
        description: item.description.trim(),
        price: parsePrice(item.price),
      }]));
    }
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const createAt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}_${pad(now.getHours())}:${pad(now.getMinutes())}`;
    updates.createAt = createAt;
    updates.createAtMillis = now.getTime();
    savingRef.current = true;
    setSaving(true);
    setMessage("Čuvam izmjene na serveru…");
    try {
      await update(menuRestoran(), updates);
      setEntries(savedEntries);
      originalEntriesRef.current = Object.fromEntries(savedEntries.map((item) => [item.id, item]));
      flatMenuRef.current = true;
      setMenuCreateAt(createAt);
      dirtyRef.current = false;
      setDirty(false);
      setDialogError("");
      setMessage(successMessage);
      return true;
    } catch (error) {
      const errorMessage = `Čuvanje nije uspjelo: ${error.message}`;
      setMessage(errorMessage);
      setDialogError(errorMessage);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const applyBulk = async () => {
    const amount = parsePrice(bulkAmount);
    const active = entries.filter((item) => !item.deleted);
    if (amount === null || amount < 0) {
      setDialogError("Unesi ispravan iznos, na primjer 0,1.");
      return;
    }
    const nextPrices = active.map((item) => {
      const current = parsePrice(item.price);
      return current === null ? null : Math.round((current + amount * bulkDirection) * 100) / 100;
    });
    const invalidIndex = nextPrices.findIndex((price) => price === null || price < 0);
    if (invalidIndex >= 0) {
      setDialogError(`Cijena artikla „${active[invalidIndex].name}” ne može biti negativna ili neispravna.`);
      return;
    }
    if (!nextPrices.some((price, index) => price !== parsePrice(active[index].price))) {
      setMessage("Cijene nijesu promijenjene.");
      setModal(null);
      return;
    }
    let index = 0;
    const nextEntries = entries.map((item) => item.deleted
      ? item
      : { ...item, price: nextPrices[index++].toFixed(2) });
    const saved = await persistMenu(nextEntries, "Sve cijene su uspješno sačuvane na serveru.");
    if (saved) {
      setModal(null);
      showSuccessAnimation("Cijene su ažurirane");
    }
  };
  const confirmRemove = () => {
    const item = entries.find((entry) => entry.id === modal.id);
    const updatedEntries = entries.map((entry) => entry.id === modal.id ? { ...entry, deleted: true } : entry);
    setEntries(updatedEntries);
    const changed = hasPendingChanges(updatedEntries);
    dirtyRef.current = changed;
    setDirty(changed);
    setMessage(changed
      ? `Artikal „${item?.name || ""}” biće uklonjen sa servera kada sačuvaš meni.`
      : "");
    setModal(null);
  };

  const save = async () => {
    if (saving || !dirty) return;
    const saved = await persistMenu(entries, "Meni je uspješno sačuvan.");
    if (saved) showSuccessAnimation("Meni je sačuvan");
  };

  if (user?.titula !== "Administrator") {
    return <main style={styles.page}><div style={{ ...styles.panel, maxWidth: 640, margin: "12vh auto" }}>Ovom dijelu može pristupiti samo administrator.</div></main>;
  }

  const modalInput = (value, onChange, { multiline = false, type = "text", inputMode } = {}) => multiline
    ? <textarea autoFocus style={{ ...styles.input, minHeight: 92, resize: "vertical" }} value={value} onChange={(event) => onChange(event.target.value)} />
    : <input autoFocus style={styles.input} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} />;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={{ marginBottom: 15 }}>
          <h1 style={{ margin: "5px 0 12px", fontSize: 27 }}>Upravljanje menijem</h1>
          <div style={{ ...styles.panel, padding: "12px 15px", marginBottom: 13, display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(110deg,#eef8f2,#eef6fb)" }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, flex: "0 0 auto", borderRadius: "50%", background: "#239b72", boxShadow: "0 0 0 4px #239b7220" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#174d3d", fontWeight: 800, fontSize: 14 }}>Aktuelni meni</div>
              <div style={{ color: "#687974", fontSize: 12, marginTop: 2 }}>{menuCreateAt ? `Ažurirano ${displayCreateAt(menuCreateAt)}` : "Vrijeme ažuriranja nije dostupno"}</div>
            </div>
          </div>
        </header>

        <section style={{ ...styles.panel, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div><strong>{entries.filter((item) => !item.deleted).length} artikala</strong></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={loading || saving} style={{ ...styles.button, background: "#176b55", color: "white", borderColor: "#176b55", opacity: loading || saving ? 0.55 : 1 }} onClick={openAddDialog}>＋ Dodaj artikal</button>
              <button disabled={loading || saving} style={{ ...styles.button, opacity: loading || saving ? 0.55 : 1 }} onClick={() => { setDialogError(""); setModal({ type: "bulk" }); }}>Promijeni sve cijene</button>
            </div>
          </div>
          <label style={{ ...styles.label, marginTop: 14 }}>Pretraga artikala<input style={styles.input} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Pretraži po nazivu, kategoriji ili opisu" /></label>
          <div aria-label="Kategorije menija" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 1px 2px", scrollbarWidth: "thin" }}>
            {categories.map((category) => {
              const active = category === activeCategory;
              return <button type="button" key={category} onClick={() => setSelectedCategory(category)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", borderRadius: 999, border: `1px solid ${active ? "#176b55" : "#dce5e1"}`, padding: "8px 14px", background: active ? "#176b55" : "white", color: active ? "white" : "#36584b", fontWeight: 700, cursor: "pointer" }}>{category}</button>;
            })}
          </div>
          <div style={{ color: "#718078", fontSize: 12, marginTop: 8 }}>{visible.length} artikala prikazano{activeCategory !== "Sve" ? ` · ${activeCategory}` : ""}</div>
        </section>

        {message && <div role="status" style={{ ...styles.panel, padding: "11px 14px", marginBottom: 12, color: dirty ? "#845b12" : "#36584b", fontSize: 13 }}>{message}</div>}
        {loading ? <section style={styles.panel}>Učitavam meni…</section> : visible.length === 0 ? <section style={styles.panel}>Nema artikala za prikaz.</section> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))", gap: "clamp(8px, 0.8vw, 14px)" }}>
            {visible.map((item) => (
              <article key={item.id} style={{ ...styles.panel, padding: 15, display: "flex", flexDirection: "column", gap: 10, minWidth: 0, boxSizing: "border-box" }}>
                <button type="button" onClick={() => openFieldEditor(item, "category")} style={{ display: "grid", gap: 4, width: "100%", minWidth: 0, border: "1px solid #dce5e1", ...fieldBoxStyle(item, "category", "#fbfcfb"), borderRadius: 10, padding: "9px 11px", color: "#17231f", fontSize: 14, lineHeight: 1.35, fontWeight: 800, textAlign: "left", whiteSpace: "normal", overflowWrap: "anywhere", cursor: "pointer" }}><span style={{ color: "#829089", fontSize: 10, fontWeight: 750, letterSpacing: ".04em", textTransform: "uppercase" }}>Kategorija</span>{item.category || "Dodaj kategoriju"}</button>
                <button type="button" onClick={() => openFieldEditor(item, "name")} style={{ display: "grid", gap: 4, width: "100%", minWidth: 0, border: "1px solid #dce5e1", ...fieldBoxStyle(item, "name", "#fff"), borderRadius: 10, padding: "9px 11px", color: "#176b55", fontSize: 16, lineHeight: 1.35, fontWeight: 650, textAlign: "left", whiteSpace: "normal", overflowWrap: "anywhere", cursor: "pointer" }}><span style={{ color: "#829089", fontSize: 10, fontWeight: 750, letterSpacing: ".04em", textTransform: "uppercase" }}>Naziv artikla</span>{item.name || "Unesi naziv artikla"}</button>
                <button type="button" onClick={() => openFieldEditor(item, "description")} style={{ display: "grid", gap: 4, width: "100%", minWidth: 0, minHeight: 66, border: "1px solid #dce5e1", ...fieldBoxStyle(item, "description", "#fbfcfb"), borderRadius: 10, padding: "9px 11px", color: "#64756e", fontSize: 13, lineHeight: 1.45, textAlign: "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere", cursor: "pointer" }}><span style={{ color: "#829089", fontSize: 10, fontWeight: 750, letterSpacing: ".04em", textTransform: "uppercase" }}>Opis</span>{item.description || "Dodaj opis artikla…"}</button>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto", paddingTop: 10, borderTop: "1px solid #edf1ef", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => openFieldEditor(item, "price")} style={{ border: "1px solid #b9d8ca", ...fieldBoxStyle(item, "price", "#eef7f2"), borderRadius: 10, padding: "9px 12px", color: "#174d3d", fontSize: 16, fontWeight: 800, cursor: "pointer" }}><span style={{ marginRight: 8, color: "#829089", fontSize: 10, letterSpacing: ".04em", textTransform: "uppercase" }}>Cijena</span>{parsePrice(item.price)?.toFixed(2) ?? item.price} €</button>
                  <button type="button" onClick={() => { setDialogError(""); setModal({ type: "delete", id: item.id }); }} style={{ ...styles.button, color: "#a32d31", padding: "8px 11px" }}>Ukloni artikal</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {dirty && <div style={{ position: "fixed", zIndex: 5, left: 0, right: 0, bottom: 0, background: "#ffffffed", borderTop: "1px solid #dce5e1", padding: "11px 16px", display: "flex", justifyContent: "center", gap: 12, alignItems: "center", backdropFilter: "blur(10px)" }}><span style={{ color: "#53675f", fontSize: 13 }}>Imaš nesačuvanih izmjena</span><button style={{ ...styles.button, background: "#176b55", color: "white", borderColor: "#176b55" }} disabled={saving} onClick={save}>{saving ? "Čuvam…" : "Sačuvaj meni"}</button></div>}

        {showSuccess && <div className="animate-fadeIn" style={{ position: "fixed", inset: 0, zIndex: 30, pointerEvents: "auto", background: "rgba(0,0,0,.88)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className="animate-checkCircle" style={{ width: 112, height: 112, margin: "0 auto", borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 50px rgba(249,115,22,.6)" }}>
              <svg width="70" height="70" viewBox="0 0 52 52" fill="none" aria-hidden="true">
                <path d="M14 27 L22 35 L39 16" stroke="black" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="animate-drawCheck" />
              </svg>
            </div>
            <h1 style={{ marginTop: 30, color: "white", fontSize: 32, fontWeight: 900, animation: "textUp .45s ease-out" }}>{successText}</h1>
          </div>
        </div>}
        {modal && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }} style={{ position: "fixed", zIndex: 10, inset: 0, background: "#101b17a6", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <section role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title" style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 18, padding: 20, boxShadow: "0 24px 70px #0004" }}>
            <h2 id="menu-dialog-title" style={{ margin: "0 0 8px", fontSize: 21 }}>{modal.type === "add" ? "Dodaj artikal" : modal.type === "bulk" ? "Primijeni sve cijene" : modal.type === "delete" ? "Ukloniti artikal?" : modal.itemName}</h2>
            {modal.type === "add" && <>
              <p style={{ margin: "0 0 14px", color: "#718078", fontSize: 13 }}>Kategorija, naziv i cijena su obavezni. Opis može ostati prazan.</p>
              <div style={{ display: "grid", gap: 11 }}>
                <label style={styles.label}>Kategorija<input style={styles.input} value={addForm.category} onChange={(event) => setAddForm({ ...addForm, category: event.target.value })} placeholder="Postojeća ili nova kategorija" /></label>
                <label style={styles.label}>Naziv artikla<input style={styles.input} value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} /></label>
                <label style={styles.label}>Opis<textarea style={{ ...styles.input, minHeight: 72, resize: "vertical" }} value={addForm.description} onChange={(event) => setAddForm({ ...addForm, description: event.target.value })} /></label>
                <label style={styles.label}>Cijena (€)<input style={styles.input} inputMode="decimal" value={addForm.price} onChange={(event) => setAddForm({ ...addForm, price: event.target.value })} placeholder="npr. 4,50" /></label>
              </div>
            </>}
            {modal.type === "bulk" && <>
              <p style={{ margin: "0 0 14px", padding: 12, borderRadius: 11, background: "#f0f7f3", color: "#53675f", lineHeight: 1.5, fontSize: 13 }}>Ova akcija mijenja cijene svih {entries.filter((item) => !item.deleted).length} artikala u meniju. Primjer: 0,1 = 10 centi.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[{ label: "Povećaj", value: 1 }, { label: "Smanji", value: -1 }].map((option) => <button key={option.value} type="button" onClick={() => setBulkDirection(option.value)} style={{ ...styles.button, flex: 1, borderColor: bulkDirection === option.value ? "#176b55" : "#d8e3de", background: bulkDirection === option.value ? "#edf5f1" : "white", color: bulkDirection === option.value ? "#176b55" : "#53675f" }}>{option.label}</button>)}
              </div>
              <label style={styles.label}>Iznos (€)<input style={styles.input} inputMode="decimal" value={bulkAmount} onChange={(event) => setBulkAmount(event.target.value)} placeholder="0,1" /></label>
            </>}
            {modal.type === "edit" && <>
              <p style={{ margin: "0 0 12px", color: "#718078", fontSize: 13 }}>Izmjena se primijeni na meni nakon potvrde, a na server se šalje kada sačuvaš.</p>
              <label style={styles.label}>{modal.fieldTitle}{modal.field === "description" ? modalInput(editValue, setEditValue, { multiline: true }) : modalInput(editValue, setEditValue, { inputMode: modal.field === "price" ? "decimal" : undefined })}</label>
            </>}
            {modal.type === "delete" && <p style={{ color: "#596b64", lineHeight: 1.5 }}>Artikal će biti uklonjen sa servera kada sačuvaš izmjene menija.</p>}
            {dialogError && <div role="alert" style={{ marginTop: 12, borderRadius: 10, padding: 10, background: "#fff0ef", color: "#982e2a", fontSize: 13 }}>{dialogError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" style={styles.button} onClick={() => setModal(null)}>Odustani</button>
              {modal.type === "add" && <button type="button" style={{ ...styles.button, background: "#176b55", color: "white" }} onClick={confirmAdd}>Dodaj artikal</button>}
              {modal.type === "bulk" && <button type="button" style={{ ...styles.button, background: "#176b55", color: "white" }} onClick={applyBulk}>Primijeni na sve</button>}
              {modal.type === "edit" && <button type="button" style={{ ...styles.button, background: "#176b55", color: "white" }} onClick={confirmEdit}>Primijeni</button>}
              {modal.type === "delete" && <button type="button" style={{ ...styles.button, background: "#a32d31", color: "white" }} onClick={confirmRemove}>Ukloni artikal</button>}
            </div>
          </section>
        </div>}
      </div>
    </main>
  );
}

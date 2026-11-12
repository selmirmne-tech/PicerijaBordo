import { useEffect, useMemo, useState } from "react";
import { onValue } from "firebase/database";
import {
  mjeseciRestoran,
  usersRestoran,
  waiterMonthStatistics,
} from "../firebase/refs";

const money = (value) => `${(Number(value) || 0).toLocaleString("sr-Latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const monthTitle = (key) => {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("sr-Latn", { month: "long" }).format(new Date(year, month - 1, 1));
  return `${label.charAt(0).toLocaleUpperCase("sr-Latn")}${label.slice(1)} ${year}`;
};

const weekdaysIjekavian = ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"];
const dateTitle = (year, month, day) => {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const monthName = new Intl.DateTimeFormat("sr-Latn", { month: "long" }).format(date);
  return `${weekdaysIjekavian[date.getDay()]}, ${Number(day)}. ${monthName.charAt(0).toLocaleUpperCase("sr-Latn")}${monthName.slice(1)}`;
};

export default function MjesecniIzvjestaj() {
  const [months, setMonths] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [detailsByMonth, setDetailsByMonth] = useState({});
  const [loadedMonth, setLoadedMonth] = useState(null);
  const [error, setError] = useState("");
  const waiters = useMemo(() => Object.entries(users), [users]);
  const waiterDetails = useMemo(() => detailsByMonth[selectedMonth] || {}, [detailsByMonth, selectedMonth]);
  const isLoading = Boolean(selectedMonth && waiters.length && loadedMonth !== selectedMonth);

  useEffect(() => {
    window.scrollTo(0, 0);
    const stopMonths = onValue(mjeseciRestoran(), (snapshot) => {
      const data = snapshot.val() || {};
      const sorted = Object.entries(data)
        .filter(([key]) => /^\d{4}-\d{2}$/.test(key))
        .map(([key, value]) => ({ key, total: Number(String(value || 0).replace(",", ".")) || 0 }))
        .sort((a, b) => b.key.localeCompare(a.key));
      setMonths(sorted);
      setSelectedMonth((current) => current && sorted.some((month) => month.key === current)
        ? current
        : sorted[0]?.key || null);
    }, (firebaseError) => setError(firebaseError.message));
    const stopUsers = onValue(usersRestoran(), (snapshot) => setUsers(snapshot.val() || {}), (firebaseError) => setError(firebaseError.message));
    return () => { stopMonths(); stopUsers(); };
  }, []);

  useEffect(() => {
    if (!selectedMonth || !waiters.length) return undefined;
    const [year, month] = selectedMonth.split("-");
    const firstSnapshots = new Set();
    const receive = (uid, name, days) => {
      setDetailsByMonth((current) => ({
        ...current,
        [selectedMonth]: {
          ...(current[selectedMonth] || {}),
          [uid]: { name, days },
        },
      }));
      if (!firstSnapshots.has(uid)) {
        firstSnapshots.add(uid);
        if (firstSnapshots.size === waiters.length) setLoadedMonth(selectedMonth);
      }
    };
    const stops = waiters.map(([uid, user]) => onValue(
      waiterMonthStatistics(uid, year, month),
      (snapshot) => receive(uid, user?.ime || user?.name || user?.fullName || uid, snapshot.val() || {}),
      (firebaseError) => {
        setError(firebaseError.message);
        receive(uid, user?.ime || user?.name || user?.fullName || uid, {});
      }
    ));
    return () => stops.forEach((stop) => stop());
  }, [selectedMonth, waiters]);

  const days = useMemo(() => {
    if (!selectedMonth) return [];
    const byDay = new Map();
    Object.entries(waiterDetails).forEach(([uid, waiter]) => {
      Object.entries(waiter.days || {}).forEach(([day, stats]) => {
        if (!/^\d{1,2}$/.test(day)) return;
        const key = day.padStart(2, "0");
        if (!byDay.has(key)) byDay.set(key, { key, total: 0, waiters: [] });
        const revenue = Number(String(stats?.totalRevenue || 0).replace(",", ".")) || 0;
        const orders = Number(stats?.totalOrders || 0) || 0;
        if (revenue === 0 && orders === 0) return;
        const summary = byDay.get(key);
        summary.total += revenue;
        summary.waiters.push({ uid, name: waiter.name, revenue, orders });
      });
    });
    return [...byDay.values()]
      .map((day) => ({ ...day, waiters: day.waiters.sort((a, b) => a.name.localeCompare(b.name, "sr")) }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [selectedMonth, waiterDetails]);

  return (
    <main style={{ width: "100%", minHeight: "100vh", boxSizing: "border-box", padding: "clamp(12px, 2vw, 30px) clamp(8px, 2vw, 28px) 48px", background: "#f2f6f4", color: "#17231f", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <header style={{ background: "linear-gradient(120deg, #ffffff, #f4faf7)", border: "1px solid #dfe9e4", borderRadius: 18, padding: "clamp(16px, 2vw, 24px)", marginBottom: 16, boxShadow: "0 8px 24px rgba(23,61,49,.06)" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(22px, 2.4vw, 30px)", color: "#173d31" }}>Mjesečni izvještaj</h1>
          <div style={{ marginTop: 5, color: "#64756e", fontSize: 14 }}>Pregled zarade konobara po mjesecima i danima.</div>
        </header>
        {error && <div role="alert" style={{ background: "#fff0ef", color: "#982e2a", padding: 13, borderRadius: 12, marginBottom: 12 }}>{error}</div>}
        {!months.length && <section style={{ background: "white", padding: 20, border: "1px solid #dfe9e4", borderRadius: 14, color: "#64756e" }}>Još nema mjesečnih izvještaja.</section>}
        <div style={{ display: "grid", gap: 10 }}>
          {months.map((month) => {
            const expanded = selectedMonth === month.key;
            const [year, monthNumber] = month.key.split("-");
            return (
              <section key={month.key} style={{ background: "white", border: "1px solid #d7e4dd", borderRadius: 17, overflow: "hidden", boxShadow: expanded ? "0 10px 28px rgba(23,61,49,.09)" : "0 4px 14px rgba(23,61,49,.05)" }}>
                <button type="button" aria-expanded={expanded} onClick={() => setSelectedMonth(expanded ? null : month.key)} style={{ width: "100%", border: 0, padding: "clamp(12px, 1.5vw, 18px)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", color: "inherit", background: expanded ? "linear-gradient(100deg, #e8f4ee, #f4faf7)" : "white" }}>
                  <strong style={{ minWidth: 0, fontSize: "clamp(16px, 1.7vw, 21px)", color: "#173d31" }}>{monthTitle(month.key)}</strong>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}><strong style={{ color: "#146c4a", background: "#e7f5ed", borderRadius: 999, padding: "7px 11px", fontSize: 14 }}>{money(month.total)}</strong><span aria-hidden="true" style={{ color: "#527064", fontSize: 13 }}>{expanded ? "▲" : "▼"}</span></span>
                </button>
                {expanded && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(240px, 30vw, 520px), 1fr))", alignItems: "start", gap: 12, padding: "4px clamp(8px, 1.4vw, 16px) 16px" }}>
                  {isLoading ? <p style={{ color: "#718078", margin: 6 }}>Učitavam izvještaj…</p> : days.length === 0 ? <p style={{ color: "#718078", margin: 6 }}>Nema dnevnih podataka za ovaj mjesec.</p> : days.map((day) => (
                    <article key={day.key} style={{ minWidth: 0, border: "1px solid #dce8e2", borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 3px 12px rgba(23,61,49,.04)" }}>
                      <div style={{ padding: "12px 14px", background: "linear-gradient(110deg, #edf5ff, #f7faff)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 10 }}>
                        <strong style={{ minWidth: 0, overflowWrap: "anywhere", color: "#203a5a", fontSize: 14 }}>{dateTitle(year, monthNumber, day.key)}</strong>
                        <span style={{ textAlign: "right", whiteSpace: "nowrap" }}><strong style={{ color: "#1d4f91", fontSize: 14 }}>{money(day.total)}</strong><small style={{ display: "block", color: "#667b95", marginTop: 3 }}>{day.waiters.length} {day.waiters.length === 1 ? "konobar" : "konobara"}</small></span>
                      </div>
                      {day.waiters.map((waiter) => <div key={waiter.uid} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 13px", borderTop: "1px solid #edf1ef", fontSize: 13 }}><span style={{ minWidth: 0, display: "grid", gap: 4 }}><strong style={{ color: "#253a32", overflowWrap: "anywhere" }}>{waiter.name}</strong><small style={{ color: "#718078" }}>{waiter.orders} {waiter.orders === 1 ? "narudžba" : "narudžbi"}</small></span><strong style={{ whiteSpace: "nowrap", color: "#146c4a", background: "#e9f6ef", borderRadius: 9, padding: "7px 9px", fontSize: 13 }}>{money(waiter.revenue)}</strong></div>)}
                    </article>
                  ))}
                </div>}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

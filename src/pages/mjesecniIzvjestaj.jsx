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

const dateTitle = (year, month, day) =>
  new Intl.DateTimeFormat("sr-Latn", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date(Number(year), Number(month) - 1, Number(day)));

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
    <main style={{ minHeight: "100vh", padding: "22px 16px 48px", background: "#f4f7f6", color: "#17231f", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ background: "#fff", border: "1px solid #e2eae6", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: "0 8px 24px #173d310b" }}>
          <h1 style={{ margin: 0, fontSize: 25 }}>Mjesečni izvještaj</h1>
          <div style={{ marginTop: 5, color: "#718078", fontSize: 14 }}>Klikni na mjesec za detalje po danima.</div>
        </header>
        {error && <div role="alert" style={{ background: "#fff0ef", color: "#982e2a", padding: 13, borderRadius: 12, marginBottom: 12 }}>{error}</div>}
        {!months.length && <section style={{ background: "white", padding: 18, borderRadius: 14 }}>Još nema mjesečnih izvještaja.</section>}
        <div style={{ display: "grid", gap: 10 }}>
          {months.map((month) => {
            const expanded = selectedMonth === month.key;
            const [year, monthNumber] = month.key.split("-");
            return (
              <section key={month.key} style={{ background: "white", border: "1px solid #e2eae6", borderRadius: 15, overflow: "hidden", boxShadow: "0 5px 16px #173d3109" }}>
                <button type="button" aria-expanded={expanded} onClick={() => setSelectedMonth(expanded ? null : month.key)} style={{ width: "100%", border: 0, padding: "15px 17px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", cursor: "pointer", color: "inherit", background: expanded ? "#edf5f1" : "white" }}>
                  <strong style={{ fontSize: 18 }}>{monthTitle(month.key)}</strong>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap" }}><strong style={{ color: "#176b55" }}>{money(month.total)}</strong><span aria-hidden="true">{expanded ? "▲" : "▼"}</span></span>
                </button>
                {expanded && <div style={{ display: "grid", gap: 10, padding: "4px 14px 16px" }}>
                  {isLoading ? <p style={{ color: "#718078", margin: 6 }}>Učitavam izvještaj…</p> : days.length === 0 ? <p style={{ color: "#718078", margin: 6 }}>Nema dnevnih podataka za ovaj mjesec.</p> : days.map((day) => (
                    <article key={day.key} style={{ border: "1px solid #e6eeea", borderRadius: 13, overflow: "hidden" }}>
                      <div style={{ padding: "11px 13px", background: "#f7faf8", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <strong>{dateTitle(year, monthNumber, day.key)}</strong>
                        <span style={{ textAlign: "right" }}><strong style={{ color: "#176b55" }}>Ukupno: {money(day.total)}</strong><small style={{ display: "block", color: "#718078", marginTop: 2 }}>{day.waiters.length} {day.waiters.length === 1 ? "konobar" : "konobara"}</small></span>
                      </div>
                      {day.waiters.map((waiter) => <div key={waiter.uid} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center", padding: "10px 13px", borderTop: "1px solid #eef2f0", fontSize: 14 }}><span style={{ fontWeight: 650 }}>{waiter.name}</span><span style={{ color: "#718078", whiteSpace: "nowrap" }}>{waiter.orders} narudžbi</span><strong style={{ whiteSpace: "nowrap" }}>{money(waiter.revenue)}</strong></div>)}
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

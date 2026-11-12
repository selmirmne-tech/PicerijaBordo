import { useEffect, useMemo, useState } from "react";
import { onValue } from "firebase/database";
import { completeOrdersRestoran } from "../firebase/refs";

const parsePrice = (value) => {
  const cleaned = String(value ?? "0").replace(",", ".").replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
};

const formatMoney = (value) => `${value.toLocaleString("sr-Latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default function Konobari() {
  const [completedOrders, setCompletedOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    return onValue(completeOrdersRestoran(), (snapshot) => {
      setCompletedOrders(snapshot.val() || {});
      setLoading(false);
    }, (firebaseError) => {
      setError(firebaseError.message);
      setLoading(false);
    });
  }, []);

  const earnings = useMemo(() => {
    const totals = new Map();
    Object.values(completedOrders).forEach((orders) => {
      Object.values(orders || {}).forEach((order) => {
        const name = String(order?.orderPersonName || "Nepoznat korisnik").trim();
        totals.set(name, (totals.get(name) || 0) + parsePrice(order?.totalPrice));
      });
    });
    return [...totals.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "sr"));
  }, [completedOrders]);

  const total = earnings.reduce((sum, waiter) => sum + waiter.total, 0);

  return (
    <main style={{ minHeight: "100vh", padding: "22px 16px 48px", background: "#f4f7f6", color: "#17231f", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <header style={{ background: "#fff", border: "1px solid #e2eae6", borderRadius: 18, padding: 20, marginBottom: 14, boxShadow: "0 8px 24px #173d310b" }}>
          <div style={{ color: "#547268", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>PREGLED ZARADE</div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 25 }}>Konobari</h1>
          <div style={{ color: "#718078", fontSize: 14 }}>Ukupna zarada od poslednjeg reseta</div>
          <div style={{ marginTop: 12, fontSize: 25, fontWeight: 850, color: "#176b55" }}>{formatMoney(total)}</div>
        </header>
        {error && <div role="alert" style={{ background: "#fff0ef", color: "#982e2a", padding: 13, borderRadius: 12, marginBottom: 12 }}>{error}</div>}
        <section style={{ display: "grid", gap: 10 }}>
          {loading ? <div style={{ background: "white", padding: 18, borderRadius: 14 }}>Učitavam podatke…</div> : earnings.length === 0 ? <div style={{ background: "white", padding: 18, borderRadius: 14 }}>Nema završenih narudžbi od poslednjeg reseta.</div> : earnings.map((waiter) => (
            <article key={waiter.name} style={{ background: "white", border: "1px solid #e2eae6", borderRadius: 14, padding: "15px 17px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", boxShadow: "0 5px 16px #173d3109" }}>
              <strong>{waiter.name}</strong>
              <strong style={{ color: "#176b55", whiteSpace: "nowrap" }}>{formatMoney(waiter.total)}</strong>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

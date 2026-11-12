import { useEffect, useState } from "react";
import { onValue, child } from "firebase/database";
import { completeOrdersRestoran } from "../firebase/refs";

export default function Racuni() {

useEffect(() => {
  window.scrollTo(0, 0);
}, []);

  const [orders, setOrders] = useState([]);
  const [totalPazar, setTotalPazar] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const parseCompletedTime = (status) => {
    if (!status) return 0;

    try {
      const raw = status.replace("Complete", "").trim();

      const direct = new Date(raw).getTime();
      if (!isNaN(direct)) return direct;

      const [datePart, timePart] = raw.split(" ");
      if (!datePart || !timePart) return 0;

      const [d, m, y] = datePart.split("-");
      const [h, min, s] = timePart.split(":");

      return new Date(y, m - 1, d, h, min, s).getTime();
    } catch {
      return 0;
    }
  };

  useEffect(() => {

    const user = JSON.parse(localStorage.getItem("user"));
    const uid = user?.uid;

    if (!uid) {
      setLoading(false);
      setError("Korisnik nije prijavljen");
      return;
    }

    const ordersRef = child(completeOrdersRestoran(), uid);
    let timeout = setTimeout(() => {
      setLoading(false);
      setError("Nema konekcije ili server ne odgovara");
    }, 10000);

    const unsubOrders = onValue(ordersRef, (snapshot) => {

      clearTimeout(timeout);

      setLoading(false);
      setError(null);

      if (!snapshot.exists()) {
        setOrders([]);
        setTotalPazar(0);
        return;
      }

      const data = snapshot.val();

      let list = [];
      let sum = 0;

      Object.keys(data).forEach(orderId => {
        const order = data[orderId];

        list.push({
          id: orderId,
          ...order
        });

        const price = parseFloat(order.totalPrice || 0);
        sum += isNaN(price) ? 0 : price;
      });

      list.sort((a, b) =>
        parseCompletedTime(b.status) - parseCompletedTime(a.status)
      );

      setOrders(list);
      setTotalPazar(sum);
    });

    return () => {
      clearTimeout(timeout);
      unsubOrders();
    };

  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

if (loading) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f2f2f2",
        flexDirection: "column",
        gap: 10
      }}
    >

      <div
        style={{
          width: 50,
          height: 50,
          border: "5px solid #ccc",
          borderTop: "5px solid #2c2c44",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}
      />

      <div
        style={{
          fontSize: 13,
          color: "#666"
        }}
      >
        Učitavanje podataka...
      </div>


      <style>
        {`
          @keyframes spin {
            0% { 
              transform: rotate(0deg); 
            }

            100% { 
              transform: rotate(360deg); 
            }
          }
        `}
      </style>

    </div>
  );
}

  return (
  <div style={{
  height: "100vh",
  background: "linear-gradient(90deg, #22c55e, #2563eb)",
  padding: 12,
      fontFamily: "sans-serif",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }}>

      {isOffline && (
        <div style={{
          background: "#ffcc00",
          color: "#333",
          padding: 10,
          borderRadius: 10,
          marginBottom: 10,
          textAlign: "center",
          fontSize: 13,
          fontWeight: "bold"
        }}>
          Nema internet konekcije — podaci se neće osvježavati
        </div>
      )}

      {error && (
        <div style={{
          background: "#ffdddd",
          color: "#a10000",
          padding: 10,
          borderRadius: 10,
          marginBottom: 10,
          textAlign: "center",
          fontSize: 13
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: "linear-gradient(135deg, #1e1e2f, #2c2c44)",
        color: "white",
        padding: 20,
        borderRadius: 16,
        marginBottom: 12,
        textAlign: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
      }}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          UKUPAN PAZAR
        </div>

        <div style={{
          fontSize: 34,
          fontWeight: "bold",
          marginTop: 5
        }}>
          {totalPazar.toFixed(2)} €
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}>

        {orders.map(order => (
          <div
            key={order.id}
            onClick={() => {
              setSelectedOrder(order);
              setShowDeleteDialog(false);
            }}
            style={{
              background: "white",
              borderRadius: 16,
              padding: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #2c2c44",
              cursor: "pointer"
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              {order.orderPersonName}
            </div>
			
			
	{order.addittionalInfo && (
  <div style={{
    marginTop: 6,
    display: "inline-block",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid #c7d2fe",
    fontWeight: 500,
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }}>
     {order.addittionalInfo}
  </div>
)}
			
			
			
			

            <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
              {order.name}
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 10
            }}>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {order.status}
              </div>

              <div style={{ fontWeight: "bold" }}>
                {order.totalPrice} €
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "flex-end"
        }}
        onClick={() => setSelectedOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              width: "100%",
              padding: 16,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20
            }}
          >
            <h3>{selectedOrder.orderPersonName}</h3>

{selectedOrder.addittionalInfo && (
  <div style={{
    marginTop: 8,
    marginBottom: 10,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 13,
    color: "#334155",
    lineHeight: 1.4
  }}>
    <div style={{
      fontSize: 11,
      fontWeight: "bold",
      color: "#64748b",
      marginBottom: 4
    }}>
      DODATNE INFORMACIJE
    </div>

    {selectedOrder.addittionalInfo}
  </div>
)}
			
            <div style={{
              whiteSpace: "pre-wrap",
              background: "#f8f8f8",
              padding: 10,
              borderRadius: 10,
              marginTop: 10
            }}>
              {selectedOrder.name}
            </div>

            <div style={{
              marginTop: 10,
              fontSize: 13,
              opacity: 0.7
            }}>
              {selectedOrder.status}
            </div>

            <div style={{
              marginTop: 10,
              fontWeight: "bold",
              fontSize: 18
            }}>
              {selectedOrder.totalPrice} €
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

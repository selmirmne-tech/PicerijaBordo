import React, { useEffect, useRef, useState } from "react";
import {
  onValue,
  get,
  child,
  runTransaction,
  update,
} from "firebase/database";

 
import {
  ordersRestoran,
  orderRef,
  globalLockRef,
  totalRestoranRef,
  totalPrvaRef,
  totalDrugaRef,
  completeOrderRef,
  deletedOrderRef,
  deletedOrderPath,
  transactionLockRef,
  rootRestoran,
  mjeseciRestoran,
  waiterMonthStatistics,
} from "../firebase/refs";
import { sentenceCase } from "./animationText";

import * as N from "../firebase/nodes";

import { ChefHat, Trash2, X } from "lucide-react";




export default function Kitchen() {
	
	
		
	useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

	
	const scrollRef = useRef(null);
const [showTop, setShowTop] = useState(false);
const [showBottom, setShowBottom] = useState(true);
	
	
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isProcessingRef = useRef(false);
  const wakeLockRef = useRef(null);
  const lastOrdersRef = useRef("");




const [loadingOrderId, setLoadingOrderId] = useState(null);
const [deletingOrderId, setDeletingOrderId] = useState(null);


  const currentUser =
    JSON.parse(localStorage.getItem("user")) || {};

  const userRole = currentUser?.titula || "";

  const canComplete =
    userRole === "Administrator" || userRole === "Kuhinja";

  const canDelete = userRole === "Administrator";
const [completedAnimation, setCompletedAnimation] = useState(false);
const [successAnimationTitle, setSuccessAnimationTitle] = useState("Narudžba je izdata");
const [successAnimationType, setSuccessAnimationType] = useState("issued");
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };


    const [now, setNow] = useState(Date.now());

        useEffect(() => {
  const interval = setInterval(() => {
    setNow(Date.now());
  }, 60000); // svake 1 minute

  return () => clearInterval(interval);
}, []);



const handleScroll = () => {

  const el = scrollRef.current;

  if (!el) return;

  const atTop = el.scrollTop <= 10;

  const atBottom =
    el.scrollHeight - el.scrollTop <= el.clientHeight + 10;


  setShowTop(!atTop);
  setShowBottom(!atBottom);

};


const scrollToTop = () => {

  scrollRef.current?.scrollTo({
    top:0,
    behavior:"smooth"
  });

};


const scrollToBottom = () => {

  scrollRef.current?.scrollTo({
    top:scrollRef.current.scrollHeight,
    behavior:"smooth"
  });

};


const vibrate = () => {
  if (navigator.vibrate) {
    navigator.vibrate(80);
  }
};








 const sendPushNotification = async (userId, orderId) => {
  try {
   const tokenRef = child(
  child(child(rootRestoran(), N.USERS_RESTORAN), userId),
  "fcmToken"
    );

    const tokenSnap = await get(tokenRef);

    const token = tokenSnap.val();

    if (!token) {
      console.log("Nema FCM tokena za usera:", userId);
      return;
    }

    const res = await fetch(
      "https://fcm-server-topaz.vercel.app/api/sendOrderNotification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          title: "Narudžba završena",
          body: "Vaša narudžba je spremna!",
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.log("Push failed:", text);
    }
  } catch (e) {
    console.log("Push error", e);
  }
};













  const getShift = (hour) =>
    hour >= 5 && hour < 15 ? "PRVA" : "DRUGA";

  const formatDateTime = () => {
    const d = new Date();

    const pad = (n) => String(n).padStart(2, "0");

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();

    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  const requestWakeLock = async () => {
    try {
      if (!("wakeLock" in navigator)) return;

      wakeLockRef.current?.release?.();

      wakeLockRef.current =
        await navigator.wakeLock.request("screen");

      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch {}
  };

  useEffect(() => {
    requestWakeLock();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release?.();
    };
  }, []);

  const parseCustomTime = (str) => {
    if (!str) return null;

    try {
      const [time, date] = str.split(" ");
      const [h, m, s] = time.split(":");
      const [d, mo, y] = date.split("-");

      return new Date(y, mo - 1, d, h, m, s);
    } catch {
      return null;
    }
  };

  const getClockTime = (str) => {
    if (!str) return "";
    return str.split(" ")[0].slice(0, 5);
  };



const getWaitMinutes = (order, nowTs) => {
  const start = parseCustomTime(order.time);

  if (!start) return 0;

  const diff = nowTs - start.getTime();

  if (diff <= 0) return 0;

  return Math.floor(diff / 60000);
};



  const formatName = (text) => {
    if (!text) return "";

    return text
      .split("\n")
      .map((l) => l.trimStart())
      .filter((l) => l.trim() !== "")
      .join("\n");
  };

  useEffect(() => {
    const unsub = onValue(ordersRestoran(), (snap) => {
      const arr = [];

      snap.forEach((c) => {
        const v = c.val();

        if (v?.status === "pending") {
          arr.push(v);
        }
      });

      arr.sort((a, b) => {
        const ta = parseCustomTime(a.time)?.getTime() || 0;
        const tb = parseCustomTime(b.time)?.getTime() || 0;

        return ta - tb;
      });

      const serialized = JSON.stringify(arr);

      if (lastOrdersRef.current === serialized) return;
	  
	  
	  
	  

      lastOrdersRef.current = serialized;

      setOrders(arr);
    });

    return () => unsub();
  }, []);

  const COMPLETION_QUEUE_KEY = "kitchenCompletionQueue";
  const DELETION_QUEUE_KEY = "kitchenDeletionQueue";
  const retryTimerRef = useRef(null);
  const activeCompletionRef = useRef(false);
  const deletionRetryTimerRef = useRef(null);
  const activeDeletionRef = useRef(false);

  const getWebClientId = () => {
    let id = localStorage.getItem("kitchenWebClientId");
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("kitchenWebClientId", id);
    }
    return id;
  };

  const getCompletionQueue = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(COMPLETION_QUEUE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveCompletionQueue = (queue) =>
    localStorage.setItem(COMPLETION_QUEUE_KEY, JSON.stringify(queue));

  const getDeletionQueue = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(DELETION_QUEUE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveDeletionQueue = (queue) =>
    localStorage.setItem(DELETION_QUEUE_KEY, JSON.stringify(queue));

  const lockTokenFor = (orderId) => `LOCK:${orderId}:WEB:${getWebClientId()}`;

  const acquireOwnedLock = async (lockRef, token) => {
    const tx = await runTransaction(lockRef, (current) => {
      const value = current == null ? null : String(current);
      if (value == null || value.toLowerCase() === "false" || value === token) return token;
      return;
    });
    return tx.committed;
  };

  const releaseOwnedLock = async (lockRef, token, replacement = null) => {
    await runTransaction(lockRef, (current) =>
      String(current) === token ? replacement : undefined
    );
  };

  const processDeletionJob = async (job) => {
    const { orderId, userId, token } = job;
    const perOrderRef = transactionLockRef(orderId);
    let lockAttempted = false;

    try {
      const archivedRef = deletedOrderRef(userId, orderId);
      if ((await get(archivedRef)).exists()) return "done";

      lockAttempted = true;
      if (!(await acquireOwnedLock(perOrderRef, token))) return "retry";

      const [orderSnap, archivedSnap] = await Promise.all([
        get(orderRef(orderId)),
        get(archivedRef),
      ]);
      if (archivedSnap.exists()) return "done";
      if (!orderSnap.exists()) return "review";

      const order = orderSnap.val();
      if (!order || order.orderId !== orderId || order.orderById !== userId ||
          String(order.status || "").toLowerCase() !== "pending") return "review";

      const updates = {
        [deletedOrderPath(userId, orderId)]: order,
        [`${N.ORDERS_RESTORAN}/${orderId}`]: null,
        [`${N.TRANSACTION_LOCKS_RESTORAN}/${orderId}`]: null,
      };
      await update(rootRestoran(), updates);
      return "done";
    } catch (error) {
      console.error("Greška pri arhiviranju obrisane narudžbe", error);
      return "retry";
    } finally {
      if (lockAttempted) await releaseOwnedLock(perOrderRef, token).catch(console.error);
    }
  };

  const processNextDeletion = async () => {
    if (activeDeletionRef.current || !canDelete) return;
    const queue = getDeletionQueue();
    const job = queue[0];
    if (!job) return;

    activeDeletionRef.current = true;
    setDeletingOrderId(job.orderId);
    const result = await processDeletionJob(job);
    activeDeletionRef.current = false;
    setDeletingOrderId(null);

    if (result === "done" || result === "review") {
      saveDeletionQueue(queue.filter((item) => item.orderId !== job.orderId));
      if (result === "done") {
        setSelectedOrder(null);
        setShowDeleteConfirm(false);
        setSuccessAnimationType("deleted");
        setSuccessAnimationTitle("Narudžba je obrisana");
        setCompletedAnimation(true);
        setTimeout(() => setCompletedAnimation(false), 2000);
      } else {
        showToast("Narudžba više nije aktivna ili se podaci ne poklapaju.");
      }
    } else {
      showToast(navigator.onLine
        ? "Arhiviranje će se automatski ponoviti."
        : "Brisanje je sačuvano; čeka internet.");
      clearTimeout(deletionRetryTimerRef.current);
      deletionRetryTimerRef.current = setTimeout(processNextDeletion, 10000);
    }
    if (getDeletionQueue().length > 0 && result !== "retry") processNextDeletion();
  };

  const processCompletionJob = async (job) => {
    const { orderId, userId, token } = job;
    const globalRef = globalLockRef();
    const perOrderRef = transactionLockRef(orderId);
    let globalAttempted = false;
    let orderAttempted = false;

    try {
      const completedRef = completeOrderRef(userId, orderId);
      if ((await get(completedRef)).exists()) {
        await releaseOwnedLock(perOrderRef, token);
        await releaseOwnedLock(globalRef, token, "False");
        return "done";
      }

      const initialSnap = await get(orderRef(orderId));
      if (!initialSnap.exists()) return "review";
      const initialOrder = initialSnap.val();
      const initialPrice = Number(String(initialOrder?.totalPrice ?? "").replace(",", "."));
      if (!initialOrder || initialOrder.orderId !== orderId || !initialOrder.orderById ||
          !Number.isFinite(initialPrice) || initialOrder.orderById !== userId) return "review";

      globalAttempted = true;
      if (!(await acquireOwnedLock(globalRef, token))) return "retry";
      orderAttempted = true;
      if (!(await acquireOwnedLock(perOrderRef, token))) return "retry";

      if ((await get(completedRef)).exists()) return "done";

      const orderSnap = await get(orderRef(orderId));
      if (!orderSnap.exists()) return "review";
      const order = orderSnap.val();
      const orderPrice = Number(String(order?.totalPrice ?? "").replace(",", "."));
      if (!order || order.orderId !== orderId || !order.orderById ||
          !Number.isFinite(orderPrice) || order.orderById !== userId) return "review";

      const now = new Date();
      const yearKey = String(now.getFullYear());
      const monthKey = String(now.getMonth() + 1).padStart(2, "0");
      const dayKey = String(now.getDate()).padStart(2, "0");
      const monthSummaryKey = `${yearKey}-${monthKey}`;
      const dateKey = `${yearKey}/${monthKey}/${dayKey}`;
      const totalsRef = totalRestoranRef().parent;
      const waiterDayRef = child(waiterMonthStatistics(userId, yearKey, monthKey), dayKey);
      const monthStatsRef = child(mjeseciRestoran(), monthSummaryKey);
      const [totalRestSnap, firstSnap, secondSnap, waiterSnap, monthSnap] = await Promise.all([
        get(totalRestoranRef()), get(totalPrvaRef()), get(totalDrugaRef()),
        get(waiterDayRef),
        get(monthStatsRef),
      ]);

      const number = (value) => Number(String(value ?? "0").replace(",", ".")) || 0;
      const hour = now.getHours();
      const first = number(firstSnap.val()) + (hour >= 5 && hour < 15 ? orderPrice : 0);
      const second = number(secondSnap.val()) + (hour >= 5 && hour < 15 ? 0 : orderPrice);
      const pad = (n) => String(n).padStart(2, "0");
      const timestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(hour)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const orderDetails = {
        orderId, user_Id: userId, addittionalInfo: order.addittionalInfo || "",
        orderPersonName: order.orderPersonName || "", name: order.name || "",
        orderCompletedBy: currentUser?.ime || currentUser?.name || "Web Kuhinja",
        description: order.description || "", totalPrice: order.totalPrice,
        status: `Complete ${timestamp}`, notificationSatus: "true",
        VrijemeNarucivanja: order.time || "",
      };

      const updates = {
        [`${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_RESTORAN}`]: (number(totalRestSnap.val()) + orderPrice).toFixed(2),
        [`${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_PRVA}`]: first.toFixed(2),
        [`${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_DRUGA}`]: second.toFixed(2),
        [`${N.COMPLETE_ORDERS_RESTORAN}/${userId}/${orderId}`]: orderDetails,
        [`${N.STATISTICS}/${N.KONOBARI}/${userId}/${dateKey}/totalRevenue`]: (number(waiterSnap.val()?.totalRevenue) + orderPrice).toFixed(2),
        [`${N.STATISTICS}/${N.KONOBARI}/${userId}/${dateKey}/totalOrders`]: (number(waiterSnap.val()?.totalOrders) + 1),
        [`${N.STATISTICS}/${N.MJESECI_RESTORAN}/${monthSummaryKey}`]: (number(monthSnap.val()) + orderPrice).toFixed(2),
        [`${N.ORDERS_RESTORAN}/${orderId}`]: null,
        [`${N.TRANSACTION_LOCKS_RESTORAN}/${orderId}`]: null,
        [`${N.TOTAL_PRICE_RESTORAN}/${N.GLOBAL_LOCK}`]: "False",
      };
      await update(rootRestoran(), updates);
      await sendPushNotification(userId, orderId);
      return "done";
    } catch (error) {
      console.error("Greška pri završavanju narudžbe", error);
      return "retry";
    } finally {
      if (orderAttempted) await releaseOwnedLock(perOrderRef, token).catch(console.error);
      if (globalAttempted) await releaseOwnedLock(globalRef, token, "False").catch(console.error);
    }
  };

  const processNextCompletion = async () => {
    if (activeCompletionRef.current || !canComplete) return;
    const queue = getCompletionQueue();
    const job = queue[0];
    if (!job) return;
    activeCompletionRef.current = true;
    isProcessingRef.current = true;
    setLoadingOrderId(job.orderId);
    const result = await processCompletionJob(job);
    activeCompletionRef.current = false;
    isProcessingRef.current = false;
    setLoadingOrderId(null);

    if (result === "done" || result === "review") {
      saveCompletionQueue(queue.filter((item) => item.orderId !== job.orderId));
      if (result === "done") {
        setSelectedOrder(null);
        setShowDeleteConfirm(false);
        setSuccessAnimationType("issued");
        setSuccessAnimationTitle("Narudžba je izdata");
        setCompletedAnimation(true);
        setTimeout(() => setCompletedAnimation(false), 2000);
        showToast("Narudžba završena");
      } else {
        showToast("Narudžba nije sigurna za završavanje. Provjerite podatke.");
      }
    } else {
      showToast(navigator.onLine ? "Obrada će se automatski ponoviti." : "Narudžba je sačuvana; čeka internet.");
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(processNextCompletion, 10000);
    }
    if (getCompletionQueue().length > 0 && result !== "retry") processNextCompletion();
  };

  const completeOrder = async (orderItem) => {
    if (!canComplete || !orderItem?.orderId || !orderItem?.orderById) return;
    if (getCompletionQueue().some((job) => job.orderId === orderItem.orderId)) {
      showToast("Narudžba je već na čekanju za završavanje.");
      return;
    }
    const queue = getCompletionQueue();
    queue.push({ orderId: orderItem.orderId, userId: orderItem.orderById, token: lockTokenFor(orderItem.orderId) });
    saveCompletionQueue(queue);
    setLoadingOrderId(orderItem.orderId);
    await processNextCompletion();
  };

  useEffect(() => {
    const resume = () => {
      processNextCompletion();
      processNextDeletion();
    };
    resume();
    window.addEventListener("online", resume);
    return () => {
      window.removeEventListener("online", resume);
      clearTimeout(retryTimerRef.current);
      clearTimeout(deletionRetryTimerRef.current);
    };
  }, [canComplete, canDelete]);
 const deleteOrder = async () => {
  if (!selectedOrder) return;
  if (!canDelete) return;
  const order = selectedOrder;
  if (!order.orderId || !order.orderById) {
    showToast("Nedostaju podaci za arhiviranje narudžbe.");
    return;
  }
  if (getDeletionQueue().some((job) => job.orderId === order.orderId) ||
      getCompletionQueue().some((job) => job.orderId === order.orderId)) {
    showToast("Narudžba je već na čekanju za obradu.");
    return;
  }

  const queue = getDeletionQueue();
  const requestId = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  queue.push({
    orderId: order.orderId,
    userId: order.orderById,
    token: `DELETE:${order.orderId}:WEB:${getWebClientId()}:${requestId}`,
  });
  saveDeletionQueue(queue);
  setDeletingOrderId(order.orderId);
  await processNextDeletion();
};

  const isSelected = (id) =>
    selectedOrder?.orderId === id;

  return (
<div
  style={{
    height: "100vh",
    background: "linear-gradient(90deg, #22c55e, #3b82f6)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  }}
>
   <div
style={{
    position: "sticky",
    top: 0,
    zIndex: 1000,
    background: "rgba(30,41,59,.92)",
    backdropFilter: "blur(18px)",
    color: "#fff",
    padding: "18px 22px",
    borderRadius: 22,
    marginBottom: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 12px 30px rgba(0,0,0,.12)"
}}
>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <ChefHat size={18} />
          <b>Kuhinja</b>
        </div>

        <div
          style={{
            background:"linear-gradient(135deg,#ffb100,#ff8a00)",
             
            borderRadius: 20,
            fontWeight: "bold",
            color: "black",
			padding:"6px 14px",
fontSize:15,
boxShadow:"0 8px 20px rgba(255,153,0,.35)"
          }}
        >
          {orders.length}
        </div>
      </div>

    <div
ref={scrollRef}
onScroll={handleScroll}
style={{
  flex: 1,
  overflowY: "auto",
  scrollbarWidth:"none",
  msOverflowStyle:"none",
  display: "flex",
  flexDirection: "column",
  gap: 12,
}}
>
        {orders.map((order) => (
          <div
            key={order.orderId}
            onClick={() => setSelectedOrder(order)}
          style={{
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    cursor: "pointer",
    transition: ".25s",
    border: isSelected(order.orderId)
        ? "2px solid #2563eb"
        : "1px solid #e6eaf0",
    boxShadow: isSelected(order.orderId)
        ? "0 15px 35px rgba(37,99,235,.18)"
        : "0 6px 18px rgba(0,0,0,.05)",
}}
          >
            
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  <div
    style={{
      fontSize: 18,
      fontWeight: 700,
      color: "#111827",
    }}
  >
    {order.orderPersonName}
  </div>
</div>

<div
  style={{
    display: "flex",
    gap: 8,
    marginTop: 10,
    
	flexWrap: "wrap",
	marginBottom: 12,
	
  }}
>
  <span
    style={{
      background: "#eff6ff",
      color: "#2563eb",
      padding: "5px 12px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
    }}
  >
    🕒 {getClockTime(order.time)}
  </span>

   
</div>

{order.addittionalInfo && (
  <div
    style={{
      marginTop: 6,
      fontSize: 12,
     background:"#fff8e6",
border:"1px solid #ffd166",
padding:14,
borderRadius:16,
boxShadow:"0 4px 12px rgba(255,193,7,.15)"
    }}
  >
    <b>Dodatne informacije:</b>
    <br />
    {order.addittionalInfo}
  </div>
)}



           <div
  style={{
    marginTop: 12,   // <-- DODAJ
    whiteSpace: "pre-wrap",
    background:"#f8fafc",
    border:"1px solid #e2e8f0",
    padding:14,
    borderRadius:16,
    fontSize:15,
    lineHeight:1.7,
  }}
>
              {formatName(order.name)}
            </div>
			
			

			
			

            <div
style={{
marginTop:14,
display:"inline-flex",
padding:"6px 14px",
borderRadius:30,
fontWeight:700,
fontSize:13,
background:
getWaitMinutes(order,now)>20
?"#fee2e2"
:getWaitMinutes(order,now)>10
?"#fff7cc"
:"#dcfce7",

color:
getWaitMinutes(order,now)>20
?"#dc2626"
:getWaitMinutes(order,now)>10
?"#b45309"
:"#15803d"
}}
>
⏱ {getWaitMinutes(order,now)} min čekanja
</div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div
          onClick={() => {
if (loadingOrderId !== null || deletingOrderId !== null) return;

  setSelectedOrder(null);
  setShowDeleteConfirm(false);
}}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
            background:"#fff",
width:"100%",
padding:24,
borderTopLeftRadius:30,
borderTopRightRadius:30,
boxShadow:"0 -20px 50px rgba(0,0,0,.18)"
            }}
          >
    <button
  onClick={() => {
   if (loadingOrderId !== null || deletingOrderId !== null) return;

    vibrate();
    setSelectedOrder(null);
  }}
 disabled={loadingOrderId !== null || deletingOrderId !== null}
>
  <X />
</button>

            <h3>
              {selectedOrder.orderPersonName}
            </h3>
			
			
					{selectedOrder.addittionalInfo && (
  <div
    style={{
      marginTop: 10,
      background: "#fff3cd",
      padding: 10,
      borderRadius: 10,
      whiteSpace: "pre-wrap",
      fontSize: 13,
    }}
  >
    <b>Dodatne informacije:</b>
    <div style={{ marginTop: 4 }}>
      {selectedOrder.addittionalInfo}
    </div>
  </div>
)}

            <div
              style={{
                whiteSpace: "pre-wrap",
                background: "#f8f8f8",
                padding: 10,
                borderRadius: 10,
              }}
            >
              {formatName(selectedOrder.name)}
            </div>
			
			
	
			

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              Vrijeme narudžbe:{" "}
              {getClockTime(selectedOrder.time)}
            </div>

          <button
  onClick={() => {
    if (
      !canComplete ||
      loadingOrderId === selectedOrder.orderId
    )
      return;

    vibrate();
    completeOrder(selectedOrder);
  }}
  disabled={
    !canComplete ||
    loadingOrderId === selectedOrder.orderId
  }
  style={{
    width: "100%",
    marginTop: 10,
    padding: 12,
    background: "blue",
    color: "white",
    borderRadius: 10,
    opacity:
      loadingOrderId === selectedOrder.orderId ? 0.7 : 1,
    cursor:
      loadingOrderId === selectedOrder.orderId
        ? "not-allowed"
        : "pointer",
  }}
>
  {loadingOrderId === selectedOrder.orderId ? (
    <span
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          border: "2px solid white",
          borderTop: "2px solid transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      Obrada...
    </span>
  ) : (
    "Završi narudžbu"
  )}
</button>

           <button
  onClick={() => {
    if (!canDelete) return;

    vibrate();
    setShowDeleteConfirm(true);
  }}
  disabled={!canDelete}
  style={{
    width: "100%",
    marginTop: 10,
    padding: 12,
    background: "red",
    color: "white",
    borderRadius: 10,
    opacity: !canDelete ? 0.5 : 1,
    cursor: !canDelete ? "not-allowed" : "pointer",
  }}
>
  Obriši narudžbu
</button>

            {showDeleteConfirm && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  Da li ste sigurni?
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                  }}
                >
               <button
  onClick={() => {
    if (deletingOrderId) return;

    vibrate();
    deleteOrder();
  }}
  disabled={deletingOrderId}
  style={{
    flex: 1,
    padding: 12,
    background: "green",
    color: "white",
    opacity: deletingOrderId ? 0.6 : 1,
    cursor: deletingOrderId ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  }}
>
  {deletingOrderId ? (
    <>
      <div
        style={{
          width: 14,
          height: 14,
          border: "2px solid white",
          borderTop: "2px solid transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      Brišem...
    </>
  ) : (
    "Da"
  )}
</button>

                 <button
  onClick={() => {
    if (deletingOrderId) return;

    vibrate();
    setShowDeleteConfirm(false);
  }}
  disabled={deletingOrderId}
  style={{
    flex: 1,
    padding: 12,
    background: "red",
    color: "white",
    opacity: deletingOrderId ? 0.6 : 1,
    cursor: deletingOrderId ? "not-allowed" : "pointer",
  }}
>
  Ne
</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


{completedAnimation && (
 <div
className="animate-fadeIn"
style={{
  position: "fixed",
  inset:0,
  zIndex:9999,
  background:"rgba(0,0,0,.88)",
  backdropFilter:"blur(12px)",
  display:"flex",
  alignItems:"center",
  justifyContent:"center",
}}
>
    <div
      style={{
        textAlign: "center",
         
      }}
    >
      <div
	  className="animate-checkCircle"
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: successAnimationType === "deleted"
            ? "linear-gradient(135deg,#f87171,#b91c1c)"
            : "linear-gradient(135deg,#ffb100,#ff7a00)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: successAnimationType === "deleted"
            ? "0 0 60px rgba(239,68,68,.5)"
            : "0 0 60px rgba(255,145,0,.55)",
          margin: "0 auto",
		  
        }}
      >
        {successAnimationType === "deleted" ? (
          <Trash2 size={48} color="white" strokeWidth={2.5} className="animate-fadeIn" />
        ) : (
          <svg width="70" height="70" viewBox="0 0 52 52" fill="none">
            <path
              d="M14 27 L22 35 L39 16"
              stroke="black"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-drawCheck"
            />
          </svg>
        )}
      </div>

      <h1
	   
        style={{
          marginTop: 30,
          color: "white",
          fontSize: "clamp(24px, 7vw, 42px)",
          fontWeight: 900,
		   
        }}
      >
        {sentenceCase(successAnimationTitle)}
      </h1>

    </div>
  </div>
)}


<div
style={{
  position:"fixed",
  inset:0,
  pointerEvents:"none",
  zIndex:2000
}}
>

{showTop && (

<button
onClick={scrollToTop}
style={{
  position:"absolute",
  top:110,
  right:20,

  width:45,
  height:45,

  borderRadius:"50%",
  border:"none",

  background:"linear-gradient(135deg,#3b82f6,#2563eb)",
  color:"white",

  fontSize:24,
  fontWeight:"900",

  boxShadow:"0 8px 25px rgba(0,0,0,.35)",

  cursor:"pointer",

  pointerEvents:"auto",

  display:"flex",
  alignItems:"center",
  justifyContent:"center"
}}
>
↑
</button>


)}



{showBottom && (
 
 
<button
onClick={scrollToBottom}
style={{
  position:"absolute",
  bottom:20,
  right:20,

  width:45,
  height:45,

  borderRadius:"50%",
  border:"none",

  background:"linear-gradient(135deg,#3b82f6,#2563eb)",
  color:"white",

  fontSize:24,
  fontWeight:"900",

  boxShadow:"0 8px 25px rgba(0,0,0,.35)",

  cursor:"pointer",

  pointerEvents:"auto",

  display:"flex",
  alignItems:"center",
  justifyContent:"center"
}}
>
↓
</button>

 

)}


</div>


      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "black",
            color: "white",
            padding: 10,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

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
import { ChefHat, Trash2, X, Clock, Info } from "lucide-react";

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

  let currentUser = {};

  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    currentUser = {};
  }

  const userRole = currentUser?.titula || "";

  const canComplete =
    userRole === "Administrator" || userRole === "Kuhinja";

  const canDelete = userRole === "Administrator";

  const [completedAnimation, setCompletedAnimation] = useState(false);

  const [successAnimationTitle, setSuccessAnimationTitle] =
    useState("Narudžba je izdata");

  const [successAnimationType, setSuccessAnimationType] =
    useState("issued");

  const [now, setNow] = useState(Date.now());

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

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
      top: 0,
      behavior: "smooth",
    });
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const vibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  const formatPrice = (value) => {
    const price = Number(
      String(value ?? "0").replace(",", ".")
    );

    return `${(Number.isFinite(price) ? price : 0).toFixed(2)} €`;
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
      id =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      localStorage.setItem("kitchenWebClientId", id);
    }

    return id;
  };

  const getCompletionQueue = () => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(COMPLETION_QUEUE_KEY) || "[]"
      );

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveCompletionQueue = (queue) => {
    localStorage.setItem(
      COMPLETION_QUEUE_KEY,
      JSON.stringify(queue)
    );
  };

  const getDeletionQueue = () => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(DELETION_QUEUE_KEY) || "[]"
      );

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveDeletionQueue = (queue) => {
    localStorage.setItem(
      DELETION_QUEUE_KEY,
      JSON.stringify(queue)
    );
  };

  const lockTokenFor = (orderId) =>
    `LOCK:${orderId}:WEB:${getWebClientId()}`;

  const acquireOwnedLock = async (lockRef, token) => {
    const tx = await runTransaction(lockRef, (current) => {
      const value = current == null ? null : String(current);

      if (
        value == null ||
        value.toLowerCase() === "false" ||
        value === token
      ) {
        return token;
      }

      return;
    });

    return tx.committed;
  };

  const releaseOwnedLock = async (
    lockRef,
    token,
    replacement = null
  ) => {
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

      if ((await get(archivedRef)).exists()) {
        return "done";
      }

      lockAttempted = true;

      if (!(await acquireOwnedLock(perOrderRef, token))) {
        return "retry";
      }

      const [orderSnap, archivedSnap] = await Promise.all([
        get(orderRef(orderId)),
        get(archivedRef),
      ]);

      if (archivedSnap.exists()) return "done";
      if (!orderSnap.exists()) return "review";

      const order = orderSnap.val();

      if (
        !order ||
        order.orderId !== orderId ||
        order.orderById !== userId ||
        String(order.status || "").toLowerCase() !== "pending"
      ) {
        return "review";
      }

      const updates = {
        [deletedOrderPath(userId, orderId)]: order,
        [`${N.ORDERS_RESTORAN}/${orderId}`]: null,
        [`${N.TRANSACTION_LOCKS_RESTORAN}/${orderId}`]: null,
      };

      await update(rootRestoran(), updates);

      return "done";
    } catch (error) {
      console.error(
        "Greška pri arhiviranju obrisane narudžbe",
        error
      );

      return "retry";
    } finally {
      if (lockAttempted) {
        await releaseOwnedLock(perOrderRef, token).catch(
          console.error
        );
      }
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
      saveDeletionQueue(
        queue.filter((item) => item.orderId !== job.orderId)
      );

      if (result === "done") {
        setSelectedOrder(null);
        setShowDeleteConfirm(false);
        setSuccessAnimationType("deleted");
        setSuccessAnimationTitle("Narudžba je obrisana");
        setCompletedAnimation(true);

        setTimeout(() => setCompletedAnimation(false), 2000);
      } else {
        showToast(
          "Narudžba više nije aktivna ili se podaci ne poklapaju."
        );
      }
    } else {
      showToast(
        navigator.onLine
          ? "Arhiviranje će se automatski ponoviti."
          : "Brisanje je sačuvano; čeka internet."
      );

      clearTimeout(deletionRetryTimerRef.current);

      deletionRetryTimerRef.current = setTimeout(
        processNextDeletion,
        10000
      );
    }

    if (
      getDeletionQueue().length > 0 &&
      result !== "retry"
    ) {
      processNextDeletion();
    }
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

      const initialPrice = Number(
        String(initialOrder?.totalPrice ?? "").replace(",", ".")
      );

      if (
        !initialOrder ||
        initialOrder.orderId !== orderId ||
        !initialOrder.orderById ||
        !Number.isFinite(initialPrice) ||
        initialOrder.orderById !== userId
      ) {
        return "review";
      }

      globalAttempted = true;

      if (!(await acquireOwnedLock(globalRef, token))) {
        return "retry";
      }

      orderAttempted = true;

      if (!(await acquireOwnedLock(perOrderRef, token))) {
        return "retry";
      }

      if ((await get(completedRef)).exists()) {
        return "done";
      }

      const orderSnap = await get(orderRef(orderId));

      if (!orderSnap.exists()) return "review";

      const order = orderSnap.val();

      const orderPrice = Number(
        String(order?.totalPrice ?? "").replace(",", ".")
      );

      if (
        !order ||
        order.orderId !== orderId ||
        !order.orderById ||
        !Number.isFinite(orderPrice) ||
        order.orderById !== userId
      ) {
        return "review";
      }

      const now = new Date();

      const yearKey = String(now.getFullYear());
      const monthKey = String(now.getMonth() + 1).padStart(2, "0");
      const dayKey = String(now.getDate()).padStart(2, "0");

      const monthSummaryKey = `${yearKey}-${monthKey}`;
      const dateKey = `${yearKey}/${monthKey}/${dayKey}`;

      const waiterDayRef = child(
        waiterMonthStatistics(userId, yearKey, monthKey),
        dayKey
      );

      const monthStatsRef = child(
        mjeseciRestoran(),
        monthSummaryKey
      );

      const [
        totalRestSnap,
        firstSnap,
        secondSnap,
        waiterSnap,
        monthSnap,
      ] = await Promise.all([
        get(totalRestoranRef()),
        get(totalPrvaRef()),
        get(totalDrugaRef()),
        get(waiterDayRef),
        get(monthStatsRef),
      ]);

      const number = (value) =>
        Number(String(value ?? "0").replace(",", ".")) || 0;

      const hour = now.getHours();

      const first =
        number(firstSnap.val()) +
        (hour >= 5 && hour < 15 ? orderPrice : 0);

      const second =
        number(secondSnap.val()) +
        (hour >= 5 && hour < 15 ? 0 : orderPrice);

      const pad = (n) => String(n).padStart(2, "0");

      const timestamp =
        `${pad(now.getDate())}-${monthKey}-${yearKey} ` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
          now.getSeconds()
        )}`;

      const orderDetails = {
        orderId,
        user_Id: userId,
        addittionalInfo: order.addittionalInfo || "",
        orderPersonName: order.orderPersonName || "",
        name: order.name || "",
        orderCompletedBy:
          currentUser?.ime || currentUser?.name || "Web Kuhinja",
        description: order.description || "",
        totalPrice: order.totalPrice,
        status: `Complete ${timestamp}`,
        notificationSatus: "true",
        VrijemeNarucivanja: order.time || "",
      };

      const updates = {
        [`${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_RESTORAN}`]:
          (
            number(totalRestSnap.val()) + orderPrice
          ).toFixed(2),

        [`${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_PRVA}`]:
          first.toFixed(2),

        [`${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_DRUGA}`]:
          second.toFixed(2),

        [`${N.COMPLETE_ORDERS_RESTORAN}/${userId}/${orderId}`]:
          orderDetails,

        [`${N.STATISTICS}/${N.KONOBARI}/${userId}/${dateKey}/totalRevenue`]:
          (
            number(waiterSnap.val()?.totalRevenue) + orderPrice
          ).toFixed(2),

        [`${N.STATISTICS}/${N.KONOBARI}/${userId}/${dateKey}/totalOrders`]:
          number(waiterSnap.val()?.totalOrders) + 1,

        [`${N.STATISTICS}/${N.MJESECI_RESTORAN}/${monthSummaryKey}`]:
          (
            number(monthSnap.val()) + orderPrice
          ).toFixed(2),

        [`${N.ORDERS_RESTORAN}/${orderId}`]: null,

        [`${N.TRANSACTION_LOCKS_RESTORAN}/${orderId}`]: null,

        [`${N.TOTAL_PRICE_RESTORAN}/${N.GLOBAL_LOCK}`]: "False",
      };

      await update(rootRestoran(), updates);

      await sendPushNotification(userId, orderId);

      return "done";
    } catch (error) {
      console.error(
        "Greška pri završavanju narudžbe",
        error
      );

      return "retry";
    } finally {
      if (orderAttempted) {
        await releaseOwnedLock(perOrderRef, token).catch(
          console.error
        );
      }

      if (globalAttempted) {
        await releaseOwnedLock(globalRef, token, "False").catch(
          console.error
        );
      }
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
      saveCompletionQueue(
        queue.filter((item) => item.orderId !== job.orderId)
      );

      if (result === "done") {
        setSelectedOrder(null);
        setShowDeleteConfirm(false);
        setSuccessAnimationType("issued");
        setSuccessAnimationTitle("Narudžba je izdata");
        setCompletedAnimation(true);

        setTimeout(() => setCompletedAnimation(false), 2000);

        showToast("Narudžba završena");
      } else {
        showToast(
          "Narudžba nije sigurna za završavanje. Provjerite podatke."
        );
      }
    } else {
      showToast(
        navigator.onLine
          ? "Obrada će se automatski ponoviti."
          : "Narudžba je sačuvana; čeka internet."
      );

      clearTimeout(retryTimerRef.current);

      retryTimerRef.current = setTimeout(
        processNextCompletion,
        10000
      );
    }

    if (
      getCompletionQueue().length > 0 &&
      result !== "retry"
    ) {
      processNextCompletion();
    }
  };

  const completeOrder = async (orderItem) => {
    if (
      !canComplete ||
      !orderItem?.orderId ||
      !orderItem?.orderById
    ) {
      return;
    }

    if (
      getCompletionQueue().some(
        (job) => job.orderId === orderItem.orderId
      )
    ) {
      showToast("Narudžba je već na čekanju za završavanje.");
      return;
    }

    const queue = getCompletionQueue();

    queue.push({
      orderId: orderItem.orderId,
      userId: orderItem.orderById,
      token: lockTokenFor(orderItem.orderId),
    });

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

    if (
      getDeletionQueue().some(
        (job) => job.orderId === order.orderId
      ) ||
      getCompletionQueue().some(
        (job) => job.orderId === order.orderId
      )
    ) {
      showToast("Narudžba je već na čekanju za obradu.");
      return;
    }

    const queue = getDeletionQueue();

    const requestId =
      globalThis.crypto?.randomUUID?.() ||
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
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .kitchen-page {
          height: 100vh;
          height: 100dvh;
          min-height: 0;
          padding: clamp(10px, 3vw, 20px);
          background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: Arial, Helvetica, sans-serif;
        }

        .kitchen-header {
          flex-shrink: 0;
          background: rgba(30, 41, 59, .94);
          backdrop-filter: blur(18px);
          color: #fff;
          padding: 15px 19px;
          border-radius: 20px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid rgba(255,255,255,.12);
          box-shadow: 0 10px 28px rgba(0,0,0,.16);
        }

        .kitchen-orders-grid {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
          align-content: start;
          gap: 14px;
          padding: 2px 2px 18px;
        }

        .kitchen-orders-grid::-webkit-scrollbar {
          display: none;
        }

        .kitchen-order-card {
          min-width: 0;
          background: #fff;
          border-radius: 20px;
          padding: 16px;
          cursor: pointer;
          transition: transform .2s ease, box-shadow .2s ease, border .2s ease;
          border: 1px solid #e5e7eb;
          box-shadow: 0 7px 20px rgba(0,0,0,.09);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .kitchen-order-card:active {
          transform: scale(.985);
        }

        .kitchen-card-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .kitchen-customer-name {
          min-width: 0;
          color: #111827;
          font-size: 18px;
          font-weight: 800;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .kitchen-time-badge {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
        }

        .kitchen-info-box {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          color: #78350f;
          padding: 11px 12px;
          border-radius: 13px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .kitchen-items-box {
          min-width: 0;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 13px;
          color: #1f2937;
          font-size: 14px;
          line-height: 1.65;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .kitchen-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 1px;
        }

        .kitchen-wait-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 11px;
          border-radius: 11px;
          font-size: 12px;
          font-weight: 800;
        }

        .kitchen-price {
          margin-left: auto;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 9px 15px;
          min-height: 42px;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 12px;
          color: #15803d;
          font-size: 19px;
          font-weight: 900;
          white-space: nowrap;
          box-shadow: 0 3px 9px rgba(22,163,74,.09);
        }

        .kitchen-empty {
          grid-column: 1 / -1;
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(255,255,255,.95);
          border-radius: 20px;
          color: #475569;
          text-align: center;
          padding: 25px;
          box-shadow: 0 8px 24px rgba(0,0,0,.08);
        }

        .kitchen-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 3000;
          background: rgba(15,23,42,.62);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
        }

        .kitchen-modal {
          background: #fff;
          width: 100%;
          max-width: 650px;
          max-height: 92vh;
          max-height: 92dvh;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 20px;
          padding-bottom: max(22px, env(safe-area-inset-bottom));
          border-radius: 25px 25px 0 0;
          box-shadow: 0 -15px 50px rgba(0,0,0,.2);
        }

        .kitchen-modal-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 15px;
        }

        .kitchen-modal-title {
          margin: 0;
          color: #111827;
          font-size: 21px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .kitchen-close-button {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 12px;
          background: #f1f5f9;
          color: #334155;
          cursor: pointer;
        }

        .kitchen-modal-items {
          margin-top: 12px;
          padding: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          color: #1f2937;
          font-size: 15px;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .kitchen-modal-price-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 14px;
        }

        .kitchen-modal-price {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 12px;
          color: #15803d;
          font-size: 23px;
          font-weight: 900;
          white-space: nowrap;
        }

        .kitchen-modal-time {
          margin-top: 12px;
          color: #64748b;
          font-size: 13px;
        }

        .kitchen-action-button {
          width: 100%;
          min-height: 49px;
          margin-top: 11px;
          padding: 12px 16px;
          border: 0;
          border-radius: 13px;
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition: opacity .2s ease, transform .2s ease;
        }

        .kitchen-action-button:active {
          transform: scale(.985);
        }

        .kitchen-action-button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .kitchen-confirm-box {
          margin-top: 13px;
          padding: 13px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 14px;
        }

        .kitchen-confirm-title {
          text-align: center;
          color: #9a3412;
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .kitchen-confirm-actions {
          display: flex;
          gap: 10px;
        }

        .kitchen-confirm-actions button {
          flex: 1;
          min-height: 45px;
          border: 0;
          border-radius: 11px;
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
        }

        .kitchen-floating-button {
          position: absolute;
          right: 15px;
          width: 43px;
          height: 43px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg,#3b82f6,#1d4ed8);
          color: white;
          font-size: 23px;
          font-weight: 900;
          box-shadow: 0 6px 20px rgba(0,0,0,.3);
          cursor: pointer;
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kitchen-toast {
          position: fixed;
          bottom: max(18px, env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          max-width: calc(100vw - 30px);
          width: max-content;
          background: #111827;
          color: white;
          padding: 12px 17px;
          border-radius: 12px;
          z-index: 10000;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 8px 25px rgba(0,0,0,.25);
        }

        @keyframes kitchen-spin {
          to { transform: rotate(360deg); }
        }

        @media (min-width: 700px) {
          .kitchen-modal-overlay {
            align-items: center;
            padding: 20px;
          }

          .kitchen-modal {
            border-radius: 24px;
            padding: 24px;
          }
        }

        @media (max-width: 480px) {
          .kitchen-page {
            padding: 9px;
          }

          .kitchen-header {
            padding: 13px 15px;
            border-radius: 16px;
            margin-bottom: 10px;
          }

          .kitchen-orders-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
          }

          .kitchen-order-card {
            padding: 13px;
            border-radius: 17px;
            gap: 10px;
          }

          .kitchen-customer-name {
            font-size: 16px;
          }

          .kitchen-time-badge {
            padding: 6px 8px;
            font-size: 12px;
          }

          .kitchen-items-box {
            padding: 11px;
            font-size: 14px;
          }

          .kitchen-price {
            padding: 8px 12px;
            min-height: 39px;
            font-size: 18px;
          }

          .kitchen-modal {
            padding: 17px;
            padding-bottom: max(20px, env(safe-area-inset-bottom));
          }

          .kitchen-modal-title {
            font-size: 19px;
          }
        }
      `}</style>

      <div className="kitchen-page">
        <div className="kitchen-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 18,
            }}
          >
            <ChefHat size={23} />
            <b>Kuhinja</b>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg,#ffb100,#ff8a00)",
              borderRadius: 13,
              fontWeight: 900,
              color: "#111827",
              padding: "7px 15px",
              fontSize: 16,
              minWidth: 42,
              textAlign: "center",
              boxShadow: "0 5px 15px rgba(255,153,0,.25)",
            }}
          >
            {orders.length}
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="kitchen-orders-grid"
        >
          {orders.length === 0 ? (
            <div className="kitchen-empty">
              <ChefHat size={42} color="#94a3b8" />

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#334155",
                }}
              >
                Trenutno nema aktivnih narudžbi
              </div>

              <div style={{ fontSize: 13, color: "#64748b" }}>
                Nove narudžbe će se prikazati ovdje.
              </div>
            </div>
          ) : (
            orders.map((order) => {
              const waitMinutes = getWaitMinutes(order, now);

              const waitBackground =
                waitMinutes > 20
                  ? "#fee2e2"
                  : waitMinutes > 10
                  ? "#fef3c7"
                  : "#dcfce7";

              const waitColor =
                waitMinutes > 20
                  ? "#dc2626"
                  : waitMinutes > 10
                  ? "#b45309"
                  : "#15803d";

              return (
                <div
                  key={order.orderId}
                  className="kitchen-order-card"
                  onClick={() => {
                    setSelectedOrder(order);
                    setShowDeleteConfirm(false);
                  }}
                  style={{
                    border: isSelected(order.orderId)
                      ? "2px solid #2563eb"
                      : "1px solid #e5e7eb",
                    boxShadow: isSelected(order.orderId)
                      ? "0 10px 25px rgba(37,99,235,.16)"
                      : undefined,
                  }}
                >
                  <div className="kitchen-card-heading">
                    <div className="kitchen-customer-name">
                      {order.orderPersonName || "Bez imena"}
                    </div>

                    <div className="kitchen-time-badge">
                      <Clock size={14} />
                      {getClockTime(order.time)}
                    </div>
                  </div>

                  {order.addititonalInfo && null}

                  {order.addittionalInfo && (
                    <div className="kitchen-info-box">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                          fontWeight: 800,
                        }}
                      >
                        <Info size={14} />
                        Dodatne informacije
                      </div>

                      {order.addittionalInfo}
                    </div>
                  )}

                  <div className="kitchen-items-box">
                    {formatName(order.name) || "Nema opisa narudžbe"}
                  </div>

                  <div className="kitchen-card-footer">
                    <div
                      className="kitchen-wait-badge"
                      style={{
                        background: waitBackground,
                        color: waitColor,
                      }}
                    >
                      <Clock size={14} />
                      {waitMinutes} min čekanja
                    </div>

                    <div className="kitchen-price">
                      {formatPrice(order.totalPrice)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedOrder && (
        <div
          className="kitchen-modal-overlay"
          onClick={() => {
            if (
              loadingOrderId !== null ||
              deletingOrderId !== null
            ) {
              return;
            }

            setSelectedOrder(null);
            setShowDeleteConfirm(false);
          }}
        >
          <div
            className="kitchen-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kitchen-modal-top">
              <h3 className="kitchen-modal-title">
                {selectedOrder.orderPersonName || "Narudžba"}
              </h3>

              <button
                type="button"
                className="kitchen-close-button"
                onClick={() => {
                  if (
                    loadingOrderId !== null ||
                    deletingOrderId !== null
                  ) {
                    return;
                  }

                  vibrate();
                  setSelectedOrder(null);
                  setShowDeleteConfirm(false);
                }}
                disabled={
                  loadingOrderId !== null ||
                  deletingOrderId !== null
                }
              >
                <X size={22} />
              </button>
            </div>

            {selectedOrder.addittionalInfo && (
              <div className="kitchen-info-box">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                    fontWeight: 800,
                  }}
                >
                  <Info size={14} />
                  Dodatne informacije
                </div>

                {selectedOrder.addittionalInfo}
              </div>
            )}

            <div className="kitchen-modal-items">
              {formatName(selectedOrder.name) || "Nema opisa narudžbe"}
            </div>

            <div className="kitchen-modal-price-row">
              <div className="kitchen-modal-price">
                {formatPrice(selectedOrder.totalPrice)}
              </div>
            </div>

            <div className="kitchen-modal-time">
              Vrijeme narudžbe:{" "}
              <b>{getClockTime(selectedOrder.time)}</b>
            </div>

            <button
              type="button"
              className="kitchen-action-button"
              onClick={() => {
                if (
                  !canComplete ||
                  loadingOrderId === selectedOrder.orderId
                ) {
                  return;
                }

                vibrate();
                completeOrder(selectedOrder);
              }}
              disabled={
                !canComplete ||
                loadingOrderId === selectedOrder.orderId
              }
              style={{
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              }}
            >
              {loadingOrderId === selectedOrder.orderId ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid white",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "kitchen-spin .8s linear infinite",
                    }}
                  />
                  Obrada...
                </>
              ) : (
                "Završi narudžbu"
              )}
            </button>

            <button
              type="button"
              className="kitchen-action-button"
              onClick={() => {
                if (!canDelete) return;

                vibrate();
                setShowDeleteConfirm(true);
              }}
              disabled={!canDelete}
              style={{
                background: "linear-gradient(135deg,#ef4444,#b91c1c)",
              }}
            >
              <Trash2 size={18} />
              Obriši narudžbu
            </button>

            {showDeleteConfirm && (
              <div className="kitchen-confirm-box">
                <div className="kitchen-confirm-title">
                  Da li ste sigurni da želite da obrišete narudžbu?
                </div>

                <div className="kitchen-confirm-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (deletingOrderId) return;

                      vibrate();
                      deleteOrder();
                    }}
                    disabled={Boolean(deletingOrderId)}
                    style={{
                      background: "#16a34a",
                      opacity: deletingOrderId ? 0.6 : 1,
                    }}
                  >
                    {deletingOrderId ? (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            border: "2px solid white",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "kitchen-spin .8s linear infinite",
                          }}
                        />
                        Brišem...
                      </span>
                    ) : (
                      "Da, obriši"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (deletingOrderId) return;

                      vibrate();
                      setShowDeleteConfirm(false);
                    }}
                    disabled={Boolean(deletingOrderId)}
                    style={{
                      background: "#64748b",
                      opacity: deletingOrderId ? 0.6 : 1,
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
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,.88)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="animate-checkCircle"
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background:
                  successAnimationType === "deleted"
                    ? "linear-gradient(135deg,#f87171,#b91c1c)"
                    : "linear-gradient(135deg,#ffb100,#ff7a00)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow:
                  successAnimationType === "deleted"
                    ? "0 0 60px rgba(239,68,68,.5)"
                    : "0 0 60px rgba(255,145,0,.55)",
                margin: "0 auto",
              }}
            >
              {successAnimationType === "deleted" ? (
                <Trash2
                  size={48}
                  color="white"
                  strokeWidth={2.5}
                  className="animate-fadeIn"
                />
              ) : (
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 52 52"
                  fill="none"
                >
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
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2000,
        }}
      >
        {showTop && (
          <button
            type="button"
            className="kitchen-floating-button"
            onClick={scrollToTop}
            style={{ top: 105 }}
          >
            ↑
          </button>
        )}

        {showBottom && (
          <button
            type="button"
            className="kitchen-floating-button"
            onClick={scrollToBottom}
            style={{ bottom: 18 }}
          >
            ↓
          </button>
        )}
      </div>

      {toast && (
        <div className="kitchen-toast">
          {toast}
        </div>
      )}
    </>
  );
}

import { ref, child } from "firebase/database";
import { db } from "./config";
import * as N from "./nodes";


export const root = () => rootRestoran();

// ROOT
export const rootRestoran = () =>
  ref(db, N.ROOT_RESTORAN);

// MENU
export const menuRestoran = () =>
  child(rootRestoran(), N.MENU_RESTORAN);

export const menuByDate = (date) =>
  child(menuRestoran(), date);

export const menuDataByDate = (date) =>
  child(menuByDate(date), N.MENU_PODACI);

export const menuData = () =>
  child(menuRestoran(), N.MENU_PODACI);

export const menuCreateAt = () =>
  child(menuRestoran(), N.MENU_CREATE_AT);

export const menuCreateAtMillis = () =>
  child(menuRestoran(), N.MENU_CREATE_AT_MILLIS);

// INFO
export const infoConnected = () =>
  ref(db, N.INFO_CONNECTED);

export const expire = () =>
  child(rootRestoran(), N.EXPIRE);

export const notificationRef = () =>
  child(rootRestoran(), N.NOTIFIKACIJA);

// USERS
export const usersRestoran = () =>
  child(rootRestoran(), N.USERS_RESTORAN);

// Articles and beverage accounting (same Firebase nodes as Android ArtikliActivity)
export const artikliRestoran = () =>
  child(rootRestoran(), N.ARTIKLI);

export const formaRestoran = () =>
  child(rootRestoran(), N.FORMA);

// Statistics (same paths as the Android FirebaseRefs)
export const statisticsRestoran = () =>
  child(rootRestoran(), N.STATISTICS);

export const konobariRestoran = () =>
  child(statisticsRestoran(), N.KONOBARI);

export const waiterStatistics = (userId) =>
  child(konobariRestoran(), userId);

export const waiterStatisticPath = (userId, dateKey, field) =>
  `${N.ROOT_RESTORAN}/${N.STATISTICS}/${N.KONOBARI}/${userId}/${dateKey}/${field}`;

export const waiterMonthStatistics = (userId, year, month) =>
  child(child(waiterStatistics(userId), year), month);

// ORDERS
export const ordersRestoran = () =>
  child(rootRestoran(), N.ORDERS_RESTORAN);

export const orderRef = (orderId) =>
  child(ordersRestoran(), orderId);

// COMPLETE
export const completeOrdersRestoran = () =>
  child(rootRestoran(), N.COMPLETE_ORDERS_RESTORAN);

export const completeOrderRef = (userId, orderId) =>
  child(child(completeOrdersRestoran(), userId), orderId);

// Deleted orders (archived without affecting totals or notifications)
export const deletedOrdersRestoran = () =>
  child(rootRestoran(), N.DELETED_ORDERS_NODE);

export const deletedOrderRef = (userId, orderId) =>
  child(child(deletedOrdersRestoran(), userId), orderId);

// Relative path for an atomic multi-location update rooted at rootRestoran().
export const deletedOrderPath = (userId, orderId) =>
  `${N.DELETED_ORDERS_NODE}/${userId}/${orderId}`;

// TOTAL PRICE
export const totalPriceRestoran = () =>
  child(rootRestoran(), N.TOTAL_PRICE_RESTORAN);

export const totalRestoranRef = () =>
  child(totalPriceRestoran(), N.TOTAL_RESTORAN);

export const totalPrvaRef = () =>
  child(totalPriceRestoran(), N.TOTAL_PRVA);

export const totalDrugaRef = () =>
  child(totalPriceRestoran(), N.TOTAL_DRUGA);

// GLOBAL LOCK
export const globalLockRef = () =>
  child(totalPriceRestoran(), N.GLOBAL_LOCK);
export const globalLockPath = () =>
  `${N.ROOT_RESTORAN}/${N.TOTAL_PRICE_RESTORAN}/${N.GLOBAL_LOCK}`;

// TRANSACTION LOCKS
export const transactionLocksRestoran = () =>
  child(rootRestoran(), N.TRANSACTION_LOCKS_RESTORAN);

export const transactionLocks = () =>
  child(rootRestoran(), N.TRANSACTION_LOCKS);

export const transactionLockRef = (orderId) =>
  child(transactionLocksRestoran(), orderId);

// RESET
export const totalResetRef = () =>
  child(totalPriceRestoran(), N.RESET);

// MJESECI
export const mjeseciRestoran = () =>
  child(statisticsRestoran(), N.MJESECI_RESTORAN);

// APP UPDATE
export const appUpdateRestoran = () =>
  child(rootRestoran(), N.APP_UPDATE_RESTORAN);
  

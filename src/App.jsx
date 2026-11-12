import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stats from "./pages/Stats";
import Racuni from "./pages/Racuni";
import Kitchen from "./pages/Kitchen";
import MjesecniIzvjestaj from "./pages/mjesecniIzvjestaj";
import Konobari from "./pages/konobari";
import Naruci from "./pages/Naruci";
import Admin from "./pages/Admin";
import Obracun from "./pages/Obracun";
import About from "./pages/about";
import Uslovi from "./pages/Uslovi";
import Politika from "./pages/Politika";
import { appUpdateRestoran, infoConnected } from "./firebase/refs";
import { auth } from "./firebase/config";
import { APP_VERSION } from "./config/appVersion";

const getUser = () => {
  try {
    const loginMigrationKey = "manual_login_required_v1";
    if (localStorage.getItem(loginMigrationKey) !== "done") {
      localStorage.removeItem("user");
      localStorage.setItem(loginMigrationKey, "done");
    }

    const data = localStorage.getItem("user");
    if (!data || data === "undefined" || data === "null") return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// PROTECTED ROUTE
const ProtectedRoute = ({ user, children, allowedRoles }) => {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.titula)) {
    return <main role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, color: "#17231f", fontFamily: "Inter,system-ui,sans-serif" }}>Nemate pravo pristupa!</main>;
  }
  return children;
};

const isDashboardPath = (pathname) => pathname.replace(/\/+$/, "").toLowerCase().endsWith("/dashboard");

function DashboardBackGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const dashboardActiveRef = useRef(false);
  const wasDashboardRef = useRef(false);
  navigateRef.current = navigate;

  useLayoutEffect(() => {
    const isDashboard = isDashboardPath(location.pathname);
    dashboardActiveRef.current = isDashboard;
    if (isDashboard && !wasDashboardRef.current) {
      for (let index = 0; index < 2; index++) {
        const state = window.history.state;
        window.history.pushState({
          ...(state && typeof state === "object" ? state : {}),
          dashboardHistoryGuard: true,
        }, "", window.location.href);
      }
    }
    wasDashboardRef.current = isDashboard;
  }, [location.key, location.pathname]);

  useEffect(() => {
    const keepDashboardOpen = () => {
      if (!dashboardActiveRef.current) return;
      if (!isDashboardPath(window.location.pathname)) {
        navigateRef.current("/dashboard", { replace: true });
      }
      const state = window.history.state;
      const currentPath = isDashboardPath(window.location.pathname)
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/dashboard";
      window.history.pushState({
        ...(state && typeof state === "object" ? state : {}),
        dashboardHistoryGuard: true,
      }, "", currentPath);
    };
    window.addEventListener("popstate", keepDashboardOpen);
    return () => window.removeEventListener("popstate", keepDashboardOpen);
  }, []);

  return null;
}

export default function App() {
  
  const [user, setUser] = useState(getUser());
  const [versionBlockReason, setVersionBlockReason] = useState("");
  const [internetAvailable, setInternetAvailable] = useState(() => navigator.onLine);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [connectionStartupTimedOut, setConnectionStartupTimedOut] = useState(false);
  const [connectionLossConfirmed, setConnectionLossConfirmed] = useState(false);
  const [connectionMessageVisible, setConnectionMessageVisible] = useState(false);
  const hasConnectedToDatabase = useRef(false);
  const [firebaseAuthUser, setFirebaseAuthUser] = useState(null);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const firebaseAuthUid = firebaseAuthUser?.uid ?? null;
  const verifiedUser = firebaseAuthReady && firebaseAuthUid ? user : null;
  const activeUser = firebaseAuthReady ? verifiedUser : user;
  const connectionUnavailable = !internetAvailable || (!databaseConnected && (connectionStartupTimedOut || (hasConnectedToDatabase.current && connectionLossConfirmed)));
  const connectionMessage = !internetAvailable ? "Nema konekcije" : "Nema konekcije, povezujem se...";

  useEffect(() => {
    let startupTimer;
    let connectionLossTimer;
    const waitForInitialConnection = () => {
      window.clearTimeout(startupTimer);
      startupTimer = window.setTimeout(() => {
        if (!hasConnectedToDatabase.current && navigator.onLine) {
          setConnectionStartupTimedOut(true);
          setConnectionMessageVisible(true);
        }
      }, 5000);
    };
    const hideMessage = () => {
      window.clearTimeout(startupTimer);
      window.clearTimeout(connectionLossTimer);
      setConnectionLossConfirmed(false);
      setConnectionMessageVisible(false);
    };
    const confirmLostConnectionAfterDelay = () => {
      window.clearTimeout(connectionLossTimer);
      connectionLossTimer = window.setTimeout(() => {
        setConnectionLossConfirmed(true);
        setConnectionMessageVisible(true);
      }, 1800);
    };
    const handleOnline = () => setInternetAvailable(true);
    const handleOffline = () => {
      setInternetAvailable(false);
      setDatabaseConnected(false);
      setConnectionLossConfirmed(true);
      setConnectionMessageVisible(true);
    };
    if (navigator.onLine) waitForInitialConnection();
    else {
      setConnectionStartupTimedOut(true);
      setConnectionMessageVisible(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const unsubscribe = onValue(infoConnected(), (snapshot) => {
      const connected = snapshot.val() === true;
      setDatabaseConnected(connected);
      if (connected && navigator.onLine) {
        hasConnectedToDatabase.current = true;
        setConnectionStartupTimedOut(false);
        hideMessage();
      } else if (!navigator.onLine) {
        setConnectionStartupTimedOut(true);
        setConnectionLossConfirmed(true);
        setConnectionMessageVisible(true);
      } else if (hasConnectedToDatabase.current) {
        confirmLostConnectionAfterDelay();
      } else {
        waitForInitialConnection();
      }
    }, () => {
      setDatabaseConnected(false);
      if (hasConnectedToDatabase.current) confirmLostConnectionAfterDelay();
      else if (navigator.onLine) waitForInitialConnection();
      else {
        setConnectionStartupTimedOut(true);
        setConnectionLossConfirmed(true);
        setConnectionMessageVisible(true);
      }
    });
    return () => {
      window.clearTimeout(startupTimer);
      window.clearTimeout(connectionLossTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!connectionUnavailable) return undefined;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [connectionUnavailable]);

  useEffect(() => onAuthStateChanged(auth, (authUser) => {
    setFirebaseAuthUser(authUser);
    setFirebaseAuthReady(true);
  }), []);

  useEffect(() => {
    if (!user || !firebaseAuthReady) {
      setVersionBlockReason("");
      return;
    }

    if (!firebaseAuthUid) {
      setVersionBlockReason("");
      return;
    }

    const unsubscribe = onValue(appUpdateRestoran(), (snapshot) => {
      const version = String(snapshot.child("versionCode").val() ?? "").trim();
      if (!version) {
        setVersionBlockReason("Na serveru nije podešena važeća verzija WEB aplikacije. Pristup je blokiran dok se verzija ne podesi.");
      } else if (version !== APP_VERSION) {
        setVersionBlockReason(`WEB verzija ${APP_VERSION} nije važeća. Korišćenje aplikacije je blokirano. Potrebna je verzija ${version}.`);
      } else {
        setVersionBlockReason("");
      }
    }, (error) => {
      console.error("Version check failed:", error);
    });

    return unsubscribe;
  }, [user, firebaseAuthReady, firebaseAuthUid]);

useEffect(() => {
  const syncUser = () => setUser(getUser());

  window.addEventListener("storage", syncUser);
  window.addEventListener("user-logout", syncUser);
  window.addEventListener("user-login", syncUser);

  syncUser();

  return () => {
    window.removeEventListener("storage", syncUser);
    window.removeEventListener("user-logout", syncUser);
    window.removeEventListener("user-login", syncUser);
  };
}, []);

  useEffect(() => {
    Notification.requestPermission().then((permission) => {
      console.log("Permission:", permission);
    });
  }, []);

  return (
    <BrowserRouter>
      <DashboardBackGuard />
      <div inert={connectionUnavailable}>
      {verifiedUser && versionBlockReason ? (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f7f6", fontFamily: "Inter,system-ui,sans-serif", color: "#17231f" }}>
          <section role="alert" aria-labelledby="version-block-title" style={{ width: "100%", maxWidth: 480, padding: 28, borderRadius: 18, background: "white", border: "1px solid #e2eae6", boxShadow: "0 18px 50px #173d3118", textAlign: "center" }}>
            <div aria-hidden="true" style={{ width: 48, height: 48, margin: "0 auto 14px", display: "grid", placeItems: "center", borderRadius: 14, background: "#fff0ef", color: "#a32d31", fontSize: 25, fontWeight: 800 }}>!</div>
            <h1 id="version-block-title" style={{ margin: "0 0 10px", fontSize: 23 }}>Pristup WEB aplikaciji je blokiran</h1>
            <p style={{ margin: 0, color: "#62736c", lineHeight: 1.55 }}>{versionBlockReason}</p>
          </section>
        </main>
      ) : <Routes>

        {/* LOGIN */}
        <Route
          path="/"
          element={
            activeUser ? <Navigate to="/dashboard" replace /> : <Login />
          }
        />

        {/* PROTECTED ROUTES */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={activeUser}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/stats"
          element={
            <ProtectedRoute user={activeUser} allowedRoles={["Administrator"]}>
              <Stats />
            </ProtectedRoute>
          }
        />

        <Route
          path="/Racuni"
          element={
            <ProtectedRoute user={activeUser}>
              <Racuni />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kitchen"
          element={
            <ProtectedRoute user={activeUser}>
              <Kitchen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mjesecniIzvjestaj"
          element={
            <ProtectedRoute user={activeUser} allowedRoles={["Administrator"]}>
              <MjesecniIzvjestaj />
            </ProtectedRoute>
          }
        />

        <Route
          path="/konobari"
          element={
            <ProtectedRoute user={activeUser} allowedRoles={["Administrator"]}>
              <Konobari />
            </ProtectedRoute>
          }
        />

       <Route
  path="/order"
  element={
    <ProtectedRoute user={activeUser}>
      <Naruci />
    </ProtectedRoute>
  }
/>

        <Route
          path="/info"
          element={
            <ProtectedRoute user={activeUser}>
              <h1>Informacije</h1>
            </ProtectedRoute>
          }
        />

        <Route
          path="/about"
          element={
            <ProtectedRoute user={activeUser}>
              <About />
            </ProtectedRoute>
          }
        />

        <Route path="/uslovi" element={<Uslovi />} />
        <Route path="/politika" element={<Politika />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute user={activeUser} allowedRoles={["Administrator"]}>
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/obracun"
          element={
            <ProtectedRoute user={activeUser} allowedRoles={["Administrator", "Konobar"]}>
              <Obracun />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>}
      </div>
      {connectionUnavailable && <div aria-hidden="true" style={{ position: "fixed", zIndex: 9998, inset: 0, background: "rgba(255, 193, 7, .22)", backdropFilter: "blur(2px)", cursor: "wait" }} />}
      {connectionUnavailable && connectionMessageVisible && <>
        <div role="status" aria-live="polite" style={{ position: "fixed", zIndex: 9999, top: 10, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "max-content", maxWidth: "calc(100% - 24px)", boxSizing: "border-box", border: "1px solid #e6b800", borderRadius: 12, padding: "10px 16px", background: "#fff3cd", color: "#664d03", boxShadow: "0 4px 16px #0002", fontWeight: 800, textAlign: "center", whiteSpace: "normal" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path className="wifi-wave wifi-wave-1" d="M2.5 8.5a15 15 0 0 1 19 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path className="wifi-wave wifi-wave-2" d="M5.8 12a9.8 9.8 0 0 1 12.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path className="wifi-wave wifi-wave-3" d="M9.2 15.5a4.7 4.7 0 0 1 5.6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="19" r="1.4" fill="currentColor" />
          </svg>
          <span>{connectionMessage}</span>
        </div>
      </>}
    </BrowserRouter>
  );
}

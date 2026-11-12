import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { onValue } from "firebase/database";

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
import { appUpdateRestoran } from "./firebase/refs";
import { APP_VERSION } from "./config/appVersion";

const getUser = () => {
  try {
    const data = localStorage.getItem("user");
    if (!data || data === "undefined" || data === "null") return null;
    const user = JSON.parse(data);
    // Clear the account previously inserted by the removed automatic test login.
    if (String(user?.email || "").trim().toLowerCase() === "test@vasrestoran.com") {
      localStorage.removeItem("user");
      return null;
    }
    return user;
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

function DashboardBackGuard() {
  const location = useLocation();
  const lastGuardedLocation = useRef("");
  const isDashboard = (pathname) => pathname.replace(/\/+$/, "").toLowerCase().endsWith("/dashboard");

  useLayoutEffect(() => {
    if (!isDashboard(location.pathname)) return;
    if (lastGuardedLocation.current === location.key) return;
    lastGuardedLocation.current = location.key;
    const state = window.history.state;
    window.history.pushState({
      ...(state && typeof state === "object" ? state : {}),
      dashboardHistoryGuard: true,
    }, "", window.location.href);
  }, [location.key, location.pathname]);

  useEffect(() => {
    const keepDashboardOpen = () => {
      if (!isDashboard(window.location.pathname)) return;
      const state = window.history.state;
      window.history.pushState({
        ...(state && typeof state === "object" ? state : {}),
        dashboardHistoryGuard: true,
      }, "", window.location.href);
    };

    window.addEventListener("popstate", keepDashboardOpen);
    return () => window.removeEventListener("popstate", keepDashboardOpen);
  }, []);

  return null;
}

export default function App() {
  
  const [user, setUser] = useState(getUser());
  const [versionBlockReason, setVersionBlockReason] = useState("");
  useEffect(() => {
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
  }, []);

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
      {versionBlockReason ? (
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
            user ? <Navigate to="/dashboard" replace /> : <Login />
          }
        />

        {/* PROTECTED ROUTES */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/stats"
          element={
            <ProtectedRoute user={user} allowedRoles={["Administrator"]}>
              <Stats />
            </ProtectedRoute>
          }
        />

        <Route
          path="/Racuni"
          element={
            <ProtectedRoute user={user}>
              <Racuni />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kitchen"
          element={
            <ProtectedRoute user={user}>
              <Kitchen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mjesecniIzvjestaj"
          element={
            <ProtectedRoute user={user} allowedRoles={["Administrator"]}>
              <MjesecniIzvjestaj />
            </ProtectedRoute>
          }
        />

        <Route
          path="/konobari"
          element={
            <ProtectedRoute user={user} allowedRoles={["Administrator"]}>
              <Konobari />
            </ProtectedRoute>
          }
        />

       <Route
  path="/order"
  element={
    <ProtectedRoute user={user}>
      <Naruci />
    </ProtectedRoute>
  }
/>

        <Route
          path="/info"
          element={
            <ProtectedRoute user={user}>
              <h1>Informacije</h1>
            </ProtectedRoute>
          }
        />

        <Route
          path="/about"
          element={
            <ProtectedRoute user={user}>
              <About />
            </ProtectedRoute>
          }
        />

        <Route path="/uslovi" element={<Uslovi />} />
        <Route path="/politika" element={<Politika />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} allowedRoles={["Administrator"]}>
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/obracun"
          element={
            <ProtectedRoute user={user} allowedRoles={["Administrator", "Konobar"]}>
              <Obracun />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>}
    </BrowserRouter>
  );
}

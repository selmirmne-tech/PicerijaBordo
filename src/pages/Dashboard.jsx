import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { child, get, onValue, update } from "firebase/database";
import { rootRestoran, usersRestoran } from "../firebase/refs";
import { auth } from "../firebase/config";
import { Info, LogOut, Menu, X } from "lucide-react";

const readLocalUser = () => {
  try {
    const data = localStorage.getItem("user");
    if (!data || data === "undefined" || data === "null") return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export default function Dashboard() {
  const [user, setUser] = useState(readLocalUser);
  const [toast, setToast] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const navigate = useNavigate();
  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };
  const openStats = () => user?.titula === "Administrator" ? navigate("/stats") : showToast("Nemate pravo pristupa!");
  const openAdmin = () => user?.titula === "Administrator" ? navigate("/admin") : showToast("Nemate pravo pristupa!");
  const openAccounting = () => ["Administrator", "Konobar"].includes(user?.titula) ? navigate("/obracun") : showToast("Nemate pravo pristupa!");
const [licenseExpired, setLicenseExpired] = useState(false);

// LOAD USER ON START
useEffect(() => {
  const loadUser = async () => {
    try {
      const data = localStorage.getItem("user");

      if (!data || data === "undefined" || data === "null") {
        setUser(null);
        return;
      }

      const localUser = JSON.parse(data);
      setUser(localUser);
      const uid = auth.currentUser?.uid || localUser.uid;

      if (!uid) {
        return;
      }

      const snapshot = await get(child(usersRestoran(), uid));

      if (snapshot.exists()) {
        const fullUser = {
          ...snapshot.val(),
          uid,
        };

        localStorage.setItem("user", JSON.stringify(fullUser));
        setUser(fullUser);
      } else {
        setUser(localUser);
      }

    } catch (error) {
      console.error("DASHBOARD USER ERROR:", error);
    }
  };

  loadUser();
}, []);

useEffect(() => {
  if (!accountMenuOpen) return undefined;
  const closeOnOutsideClick = (event) => {
    if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
  };
  const closeOnEscape = (event) => {
    if (event.key === "Escape") setAccountMenuOpen(false);
  };
  document.addEventListener("pointerdown", closeOnOutsideClick);
  document.addEventListener("keydown", closeOnEscape);
  return () => {
    document.removeEventListener("pointerdown", closeOnOutsideClick);
    document.removeEventListener("keydown", closeOnEscape);
  };
}, [accountMenuOpen]);




useEffect(() => {

  const expireRef = child(
    rootRestoran(),
    "Expire"
  );


  const unsubscribe = onValue(
    expireRef,
    (snap) => {

      if (!snap.exists()) {
        return;
      }


      let expire = snap.val();


      // ako nije string pretvori
      expire = String(expire);


      const parts = expire.split(".");


      if(parts.length !== 3){
        return;
      }


      const expireDate = new Date(
        parts[2],
        parts[1] - 1,
        parts[0]
      );


      const today = new Date();

      today.setHours(0,0,0,0);
      expireDate.setHours(0,0,0,0);



      if(expireDate < today){

        setLicenseExpired(true);

      }


    }
  );


  return () => unsubscribe();


}, []);







  // FCM (ostavi prazno ako još nisi sredio messaging)
  useEffect(() => {
    const t = setTimeout(() => {
      // saveFCMToken(); // <-- OVDE kasnije ubaci
    }, 1500);

    return () => clearTimeout(t);
  }, []);

  const Card = ({ icon, title, onClick }) => (
    <button type="button" onClick={onClick} style={{
      width: "100%", minWidth: 0, minHeight: 0, height: "100%", boxSizing: "border-box", border: "1px solid #e5ebe8", borderRadius: 18,
      padding: 16, background: "#fff", boxShadow: "0 4px 16px rgba(23,61,49,.06)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 9, color: "#173d31", cursor: "pointer", font: "inherit", transition: "transform .18s ease, box-shadow .18s ease",
    }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, textAlign: "center" }}>{title}</div>
    </button>
  );

  return (
  
  
  <>
{
licenseExpired &&

<div
style={{
position:"fixed",
inset:0,
zIndex:9999,
background:"rgba(0,0,0,0.65)",
display:"flex",
alignItems:"center",
justifyContent:"center",
padding:20
}}
>

<div
style={{
width:"100%",
maxWidth:380,
background:"linear-gradient(135deg,#22c55e,#2563eb)",
borderRadius:24,
padding:3,
boxShadow:"0 20px 50px rgba(0,0,0,0.35)"
}}
>

<div
style={{
background:"white",
borderRadius:22,
padding:30,
textAlign:"center"
}}
>

<div
style={{
fontSize:55,
marginBottom:15
}}
>
⚠️
</div>

<div
style={{
fontSize:24,
fontWeight:900,
color:"#111",
marginBottom:15
}}
>
Licenca je istekla
</div>

<div
style={{
fontSize:16,
color:"#555",
lineHeight:1.5
}}
>
Kontaktirajte administratora
</div>

</div>

</div>

</div>

}
  
  
  
  
  
  
  
  
  
  
  
  
    <div style={{ minHeight: "100vh", boxSizing: "border-box", background: "#f3f6f5", padding: 10, display: "flex", flexDirection: "column" }}>
      <header style={{ width: "100%", boxSizing: "border-box", margin: "0 0 10px", padding: "14px 18px", borderRadius: 14, background: "linear-gradient(115deg, #0b6b5b, #008577)", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, boxShadow: "0 10px 28px rgba(0,91,77,.18)" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
            <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15 }}>{user?.ime || "Korisnik"}</strong>
            <span style={{ color: "rgba(255,255,255,.78)", fontSize: 12 }}>{user?.titula || "Nalog"}</span>
          </div>
        </div>
        <div ref={accountMenuRef} style={{ position: "relative", flex: "0 0 auto" }}>
          <button type="button" aria-label={accountMenuOpen ? "Zatvori meni naloga" : "Otvori meni naloga"} aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)} style={{ width: 44, height: 44, border: "1px solid rgba(255,255,255,.3)", borderRadius: 13, display: "grid", placeItems: "center", color: "white", background: "rgba(255,255,255,.14)", cursor: "pointer" }}>
            {accountMenuOpen ? <X size={22} /> : <Menu size={23} />}
          </button>
          {accountMenuOpen && <div role="menu" style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 20, width: 220, padding: 7, border: "1px solid #e2eae6", borderRadius: 15, background: "white", boxShadow: "0 16px 40px rgba(18,38,31,.18)" }}>
            <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); navigate("/about"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, border: 0, borderRadius: 10, padding: "11px 12px", background: "white", color: "#233b33", textAlign: "left", font: "inherit", cursor: "pointer" }}><Info size={18} /> Informacije</button>
            <button type="button" role="menuitem" onClick={async () => {
              if (!window.confirm("Da li ste sigurni da želite da se odjavite?")) return;
              setAccountMenuOpen(false);
              const data = localStorage.getItem("user");
              if (data) {
                try {
                  const currentUser = JSON.parse(data);
                  await update(child(usersRestoran(), currentUser.uid), { fcmToken: "" });
                } catch (error) {
                  console.log("Logout FCM delete error:", error);
                }
              }
              localStorage.removeItem("user");
              localStorage.removeItem("fcmToken");
              window.dispatchEvent(new Event("user-logout"));
              navigate("/", { replace: true });
            }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, border: 0, borderRadius: 10, padding: "11px 12px", background: "white", color: "#a32d31", textAlign: "left", font: "inherit", cursor: "pointer" }}><LogOut size={18} /> Odjava</button>
          </div>}
        </div>
      </header>

      <div style={{ width: "100%", flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateRows: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <Card icon="📄✏️" title="Naruči hranu" onClick={() => navigate("/order")} />
        <Card icon="👨‍🍳" title="Kuhinja" onClick={() => navigate("/kitchen")} />
        <Card icon="📊" title="Statistika" onClick={openStats} />
        <Card icon="📄" title="Računi" onClick={() => navigate("/Racuni")} />
        <Card icon="🍽️" title="Upravljanje menijem" onClick={openAdmin} />
        <Card icon="🧾" title="Obračun artikala" onClick={openAccounting} />
      </div>
    </div>
    {toast && <div role="status" style={{ position: "fixed", zIndex: 100, left: "50%", bottom: 28, transform: "translateX(-50%)", background: "#222", color: "#fff", padding: "12px 18px", borderRadius: 24, boxShadow: "0 6px 22px #0004", whiteSpace: "nowrap" }}>{toast}</div>}
	</>
  );
}

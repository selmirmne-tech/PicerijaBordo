import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { update } from "firebase/database";
import { child } from "firebase/database";
import { usersRestoran } from "../firebase/refs";
import { onValue } from "firebase/database";
import { rootRestoran } from "../firebase/refs";
import { auth } from "../firebase/config";
import { get } from "firebase/database";
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
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
        setLoading(false);
        return;
      }

      const localUser = JSON.parse(data);
      const uid = auth.currentUser?.uid || localUser.uid;

      if (!uid) {
        setUser(localUser);
        setLoading(false);
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
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  loadUser();
}, []);




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

  if (loading) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        Loading...
      </div>
    );
  }

  const Card = ({ icon, title, onClick }) => (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer"
      }}
    >
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: "600" }}>{title}</div>
    </div>
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
  
  
  
  
  
  
  
  
  
  
  
  
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#f2f2f2",
      padding: 10,
      display: "flex",
      flexDirection: "column"
    }}>

      <div style={{
        background: "#008577",
        color: "white",
        padding: 12,
        borderRadius: 14,
        marginBottom: 10
      }}>
        <div>{user?.ime}</div>
        <div>{user?.titula}</div>
      </div>

      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10
      }}>

        <Card icon="📄✏️" title="Naruči hranu" onClick={() => navigate("/order")} />
        <Card icon="👨‍🍳" title="Kuhinja" onClick={() => navigate("/kitchen")} />
        <Card icon="📊" title="Statistika" onClick={openStats} />
        <Card icon="📄" title="Računi" onClick={() => navigate("/Racuni")} />
        <Card icon="🍽️" title="Upravljanje menijem" onClick={openAdmin} />
        <Card icon="🧾" title="Obračun artikala" onClick={openAccounting} />
        <Card icon="ℹ️" title="Informacije" onClick={() => navigate("/about")} />

       <Card
  icon="🚪"
  title="Logout"
  onClick={async () => {
    const data = localStorage.getItem("user");

    if (data) {
      try {
        const user = JSON.parse(data);

        // 🔥 BRISANJE TOKENA IZ BAZE
        await update(child(usersRestoran(), user.uid), {
          fcmToken: "",
          
        });
      } catch (e) {
        console.log("Logout FCM delete error:", e);
      }
    }

    // 🔥 LOCAL CLEANUP
    localStorage.removeItem("user");
    localStorage.removeItem("fcmToken");

    window.dispatchEvent(new Event("user-logout"));

    navigate("/", { replace: true });
  }}
/>

      </div>
    </div>
      {toast && <div role="status" style={{ position: "fixed", zIndex: 100, left: "50%", bottom: 28, transform: "translateX(-50%)", background: "#222", color: "#fff", padding: "12px 18px", borderRadius: 24, boxShadow: "0 6px 22px #0004", whiteSpace: "nowrap" }}>{toast}</div>}
	</>
  );
}

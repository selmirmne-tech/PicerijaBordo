import { useState } from "react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
} from "firebase/auth";

import { usersRestoran } from "../firebase/refs";
import { child } from "firebase/database";
import { auth } from "../firebase/config";
import { get, set, update } from "firebase/database";
import { useNavigate } from "react-router-dom";


 
import { getMessagingSafe } from "../firebase/config";
import { getToken } from "firebase/messaging";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [ime, setIme] = useState("");
  const [broj, setBroj] = useState("");
  const [titula, setTitula] = useState("Titula");

  const [mode, setMode] = useState("login");

  const navigate = useNavigate();

  // =====================================================
  // FCM TOKEN
  // =====================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const saveFCMToken = async (uid) => {
  try {
  

    const permission = await Notification.requestPermission();
     

    if (permission !== "granted") return;

     
    const registration = await navigator.serviceWorker.ready;
     

    const messaging = await getMessagingSafe();

    if (!messaging) {
       
      return;
    }

    const token = await getToken(messaging, {
      vapidKey:
        "BHe7nSvVdLbYzSKV1boLUgrj35JH5UrvIdP7HRsMn4E1B4nl19IXlDjiLg-OZHnN1_DmFAgfAX2atjsfdEGD-co",
      serviceWorkerRegistration: registration,
    });

 

    if (!token) return;

    await update(child(usersRestoran(), uid), {
      fcmToken: token,
       
    });

     
  } catch (e) {
    console.log("❌ FCM ERROR FULL:", e);
  }
};

  // =====================================================
  // LOGIN
  // =====================================================
 
 
 const login = async () => {
  try {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      alert("Unesite email");
      return;
    }

    await setPersistence(auth, browserLocalPersistence);

    const userCred = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );

    const uid = userCred.user.uid;

    const snapshot = await get(child(usersRestoran(), uid));

    if (!snapshot.exists()) {
      alert("User ne postoji u bazi");
      return;
    }

    const fullUser = {
      ...snapshot.val(),
      uid,
    };

    // 1. SAVE USER
    localStorage.setItem("user", JSON.stringify(fullUser));

    // 2. FORCE STATE UPDATE EVENT
    window.dispatchEvent(new Event("user-login"));

    // 4. FCM IDE ASYNC (NE BLOKIRA LOGIN)
    setTimeout(() => {
      saveFCMToken(uid);
    }, 500);
   
   
   // 3. NAVIGATE ODMAH
    navigate("/dashboard");

   

  } catch (error) {
    console.log("LOGIN ERROR:", error);
    alert("Login error: " + error.message);
  }
};
 
 

  // =====================================================
  // REGISTER
  // =====================================================
  const register = async () => {
    try {
      const normalizedEmail = email.trim();
      if (!ime || !normalizedEmail || !password || !broj) {
        alert("Popuni sva polja");
        return;
      }

      if (titula === "Titula") {
        alert("Izaberi titulu");
        return;
      }

      const userCred = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      const uid = userCred.user.uid;

      const newUser = {
        ime,
        email: normalizedEmail,
        broj,
        password,
        titula,
        fcmToken: "",
      };

      await set(child(usersRestoran(), uid), newUser);

      localStorage.setItem("user", JSON.stringify(newUser));
      window.dispatchEvent(new Event("storage"));

      navigate("/dashboard");
    } catch (error) {
      alert("Register error: " + error.message);
    }
  };

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black to-neutral-900 px-4">
      <div className="w-full max-w-md bg-neutral-900 rounded-3xl p-6 border border-neutral-800 shadow-xl">

        {/* SWITCH */}
        <div className="flex mb-6 gap-2">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-3 rounded-2xl font-semibold transition ${
              mode === "login"
                ? "bg-orange-500 text-black"
                : "bg-neutral-800 text-white"
            }`}
          >
            Login
          </button>

          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-3 rounded-2xl font-semibold transition ${
              mode === "register"
                ? "bg-orange-500 text-black"
                : "bg-neutral-800 text-white"
            }`}
          >
            Register
          </button>
        </div>

        {/* LOGIN */}
        {mode === "login" && (
          <div className="space-y-4">
            <input
              type="email"
              autoComplete="username"
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={login}
              className="w-full py-4 rounded-2xl bg-orange-500 text-black font-bold active:scale-[0.98] transition"
            >
              LOGIN
            </button>
          </div>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <div className="space-y-4">
            <input
              type="email"
              autoComplete="email"
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ime i prezime"
              onChange={(e) => setIme(e.target.value)}
            />

            <input
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Broj telefona"
              onChange={(e) => setBroj(e.target.value)}
            />

            <input
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <select
              className="w-full p-4 rounded-2xl bg-neutral-800 text-white outline-none focus:ring-2 focus:ring-green-500"
              value={titula}
              onChange={(e) => setTitula(e.target.value)}
            >
              <option value="Titula">Izaberi titulu</option>
              <option value="Konobar">Konobar</option>
              <option value="Kuhinja">Kuhinja</option>
            </select>

            <button
              onClick={register}
              className="w-full py-4 rounded-2xl bg-green-500 text-black font-bold active:scale-[0.98] transition"
            >
              REGISTER
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

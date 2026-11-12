

import { useEffect, useState } from "react";
import { onValue, child } from "firebase/database";
import { update, get } from "firebase/database";

import * as N from "../firebase/nodes";
import ResetDialog from "../components/ResetDialog";
import {
  rootRestoran,
  totalPriceRestoran,
  completeOrdersRestoran,
  totalResetRef,
  statisticsRestoran
} from "../firebase/refs";


import { useNavigate } from "react-router-dom";

export default function Stats() {

const statsUser = (() => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
})();
const isAdmin = statsUser?.titula === "Administrator";


useEffect(() => {
  window.scrollTo(0, 0);
}, []);


const [resetSuccess, setResetSuccess] = useState(false);

  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [resetPressed, setResetPressed] = useState(false);
  const [resetInfo, setResetInfo] = useState(null);
  const [expire, setExpire] = useState(null);
  const [time, setTime] = useState(new Date());
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  	const vibrate = (pattern = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};
  

  // LIVE CLOCK
  useEffect(() => {

    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);

  }, []);

  // FIREBASE REALTIME
  useEffect(() => {

    // TOTAL PRICE
    const unsubTotal = onValue(
      totalPriceRestoran(),
      (snap) => {

        if (snap.exists()) {
          setData(snap.val());
        }

      }
    );
	
	
	



 


	
	

    // COMPLETE ORDERS COUNT
    const unsubOrders = onValue(
      completeOrdersRestoran(),
      (snap) => {

        if (snap.exists()) {

          const users = snap.val();
		   

          let totalOrders = 0;
          // svaki korisnik
          Object.keys(users).forEach((userId) => {

            const userOrders = users[userId];

            // broj narudzbi za tog korisnika
            totalOrders += Object.keys(userOrders || {}).length;

          });

          setOrdersCount(totalOrders);

        } else {
          setOrdersCount(0);
        }

      }
    );
	
	// ACTIVE ORDERS COUNT
 

 
 const ordersRef = child(
  rootRestoran(),
  "OrdersRestoran"
);

const unsubActiveOrders = onValue(
  ordersRef,
  (snap) => {

    if (snap.exists()) {

      const orders = snap.val();

      setActiveOrdersCount(
        Object.keys(orders).length
      );

    } else {

      setActiveOrdersCount(0);

    }

  }
);
 
 
 
	

    // RESET INFO
    const unsubReset = onValue(
      totalResetRef(),
      (snap) => {

        if (snap.exists()) {
          setResetInfo(snap.val());
        }

      }
    );

    // EXPIRE
    const expireRef = child(
      rootRestoran(),
      "Expire"
    );

    const unsubExpire = onValue(
      expireRef,
      (snap) => {

        if (snap.exists()) {
          setExpire(snap.val());
        }

      }
    );
	
	
 
	
	

    return () => {

      unsubTotal();
      unsubOrders();
      unsubReset();
      unsubExpire();
	  unsubActiveOrders();

    };

  }, []);

 
  
  
  
	const performReset = async ({ deleteMonths, deleteOrders }) => {
    try {
      const rootRef = rootRestoran();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const monthName = `${year}-${month}`;



        // ==============================
        // ATOMSKI UPDATE
        // ==============================

        const updates = {};


        updates[
            `${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_RESTORAN}`
        ] = "0";


        updates[
            `${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_PRVA}`
        ] = "0";


        updates[
            `${N.TOTAL_PRICE_RESTORAN}/${N.TOTAL_DRUGA}`
        ] = "0";


        updates[
            `${N.TOTAL_PRICE_RESTORAN}/${N.GLOBAL_LOCK}`
        ] = "False";


        // uvijek briši završene račune

        updates[
            N.COMPLETE_ORDERS_RESTORAN
        ] = null;

        updates[
            N.DELETED_ORDERS_NODE
        ] = null;



        // uvijek briši transakcione lockove

        updates[
            N.TRANSACTION_LOCKS_RESTORAN
        ] = null;



        // ako je switch uključen

        if (deleteOrders) {

            updates[
                N.ORDERS_RESTORAN
            ] = null;

        }



const resetTime =
    String(now.getDate()).padStart(2, "0") + " " +
    String(now.getMonth() + 1).padStart(2, "0") + " " +
    now.getFullYear() + " " +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0") + ":" +
    String(now.getSeconds()).padStart(2, "0");


        updates[
            `${N.TOTAL_PRICE_RESTORAN}/${N.RESET}`
        ] = resetTime;



      // Android deletes every statistics branch except the current month's
      // summary when the user explicitly confirms the full statistics reset.
      if (deleteMonths) {
        const statsSnapshot = await get(statisticsRestoran());
        if (statsSnapshot.exists()) {
          statsSnapshot.forEach((childSnapshot) => {
            const key = childSnapshot.key;
            if (!key || key === N.MJESECI_RESTORAN) return;
            updates[`${N.STATISTICS}/${key}`] = null;
          });

          statsSnapshot.child(N.MJESECI_RESTORAN).forEach((monthSnapshot) => {
            if (monthSnapshot.key !== monthName) {
              updates[`${N.STATISTICS}/${N.MJESECI_RESTORAN}/${monthSnapshot.key}`] = null;
            }
          });
        }
        updates[`${N.STATISTICS}/${N.MJESECI_RESTORAN}/${monthName}`] = "0";
      }



        // ==============================
        // JEDAN FIREBASE UPIS
        // ==============================

        await update(
            rootRef,
            updates
        );


        console.log(
            "RESET USPJEŠAN"
        );


      // zatvori dialog
setShowResetDialog(false);

setResetSuccess(true);

setTimeout(() => {
  setResetSuccess(false);
}, 2000);


        // ovdje možeš staviti animaciju
        // showSuccess()


    }

    catch(error) {


        console.error(
            "RESET GREŠKA:",
            error
        );


        alert(
            "Greška pri resetovanju podataka!"
        );


        throw error;

    }

};
	
  
  
  
  
  
  
  
 const handleResetConfirm = async ({
  deleteMonths,
  deleteOrders
}) => {

  await performReset({
    deleteMonths,
    deleteOrders
  });

};
  
const getLicenseStatus = () => {

  if (!expire) {
    return {
      color:"#555",
      text:"N/A"
    };
  }

  const parts = expire.split(".");

  if (parts.length !== 3) {
    return {
      color:"#555",
      text:expire
    };
  }

  const expireDate = new Date(
    parts[2],
    parts[1] - 1,
    parts[0]
  );


  const today = new Date();

  today.setHours(0,0,0,0);
  expireDate.setHours(0,0,0,0);


  const diff =
    Math.ceil(
      (expireDate - today) /
      (1000 * 60 * 60 * 24)
    );


  if (diff <= 0) {

    return {
      color:"red",
      text:`${expire} (istekla)`
    };

  }


  if (diff <= 10) {

    return {
      color:"red",
      text:expire
    };

  }


  return {
    color:"#555",
    text:expire
  };

};
  

if (data === null) {

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        background: "linear-gradient(to right, #16a34a, #2563eb)",
        color: "white"
      }}
    >

      <div
        style={{
          width: 50,
          height: 50,
          border: "6px solid rgba(255,255,255,0.3)",
          borderTop: "6px solid white",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}
      />

      <div
        style={{
          marginTop: 18,
          fontSize: 18,
          fontWeight: 600
        }}
      >
        Učitavanje podataka...
      </div>


      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>

    </div>
  );






}








  return (
<div
style={{
  height: "100vh",
  overflow: "hidden",
  background: "linear-gradient(to right, #22c55e, #2563eb)",
  padding: 8,
  fontFamily: "sans-serif",
  boxSizing:"border-box"
}}
>

      {/* TOP TOTAL */}
      <div
        style={{
          background: "white",
          padding: 12,
          borderRadius: 16,
          textAlign: "center",
          marginBottom: 10,
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
        }}
      >

        <div
          style={{
            fontSize: 14,
            color: "#666"
          }}
        >
          Zarada do: {time.toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
})}
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: "bold",
            marginTop: 6
          }}
        >
          {data.TotalRestoran ?? 0} €
        </div>

      </div>

  {/* SMJENE */}
      <div
        style={{
         display: "grid",
gridTemplateColumns: "repeat(2, 1fr)",
gap: 8,

        }}
      >



  
     

        {/* PRVA */}
        <div
          style={{
          background: "linear-gradient(135deg,#ffffff,#f8fafc)",
padding:10,
borderRadius:12,
boxShadow:"0 4px 14px rgba(0,0,0,0.06)"
          }}
        >

          <div style={{ fontWeight: 600 }}>
            Prva smjena
          </div>

          <div
            style={{
              fontSize: 18,
              marginTop: 4
            }}
          >
            {data.TotalPrva ?? 0} €
          </div>

        </div>

        {/* DRUGA */}
        <div
          style={{
           background: "linear-gradient(135deg,#ffffff,#f8fafc)",
padding:10,
borderRadius:12,
boxShadow:"0 4px 14px rgba(0,0,0,0.06)"
          }}
        >

          <div style={{ fontWeight: 600 }}>
            Druga smjena
          </div>

          <div
            style={{
              fontSize: 18,
              marginTop: 4
            }}
          >
            {data.TotalDruga ?? 0} €
          </div>

        </div>

      </div>
	  
	      {/* ORDERS + RESET */}
{/* ORDERS */}

<div
style={{
 display:"grid",
 gridTemplateColumns:"repeat(2,1fr)",
 gap:8,
 marginTop:10
}}
>

{/* IZDATO */}
<div
style={{
 background:"linear-gradient(135deg,#ffffff,#f8fafc)",
 padding:10,
 borderRadius:12,
 boxShadow:"0 4px 14px rgba(0,0,0,0.06)"
}}
>

<div style={{fontWeight:600}}>
 Izdato narudžbi
</div>

<div
style={{
 display:"inline-block",
 marginTop:8,
 padding:"6px 12px",
 borderRadius:20,
 background:"#dcfce7",
 color:"#166534",
 fontWeight:700
}}
>
{ordersCount}
</div>

</div>


{/* AKTIVNE */}

<div
style={{
 background:"linear-gradient(135deg,#ffffff,#f8fafc)",
 padding:10,
 borderRadius:12,
 boxShadow:"0 4px 14px rgba(0,0,0,0.06)"
}}
>

<div style={{fontWeight:600}}>
 Aktivne narudžbe
</div>

<div
style={{
 display:"inline-block",
 marginTop:8,
 padding:"6px 12px",
 borderRadius:20,
 background:"#dcfce7",
 color:"#166534",
 fontWeight:700
}}
>
{activeOrdersCount}
</div>


</div>


</div>


{/* POSLEDNJI RESET */}

<div
style={{
 background:"white",
 padding:16,
 textAlign: "center",
 borderRadius:14,
 marginTop:10,
 fontSize:13,
 color:"#666"
}}
>
Poslednji reset: {resetInfo || "N/A"}
</div>

	  
	  
	  
	  

  {/* EXTRA ACTIONS */}

<div
style={{
  marginTop:10,
  display:"flex",
  flexDirection:"column",
  gap:8
}}
>


<div
style={{
 background:"white",
 padding:"10px 12px",
 borderRadius:12,
 display:"flex",
 justifyContent:"space-between",
 alignItems:"center",
 gap:10,
 flexWrap:"wrap"
}}
>

<div
style={{
 fontSize:15,
 fontWeight:600,
 flex:"1 1 220px"
}}
>
Mjesečni izvještaj
</div>


<button
onClick={() => {
 vibrate(80);
 navigate("/mjesecniIzvjestaj");
}}
style={{
 padding:"8px 14px",
 borderRadius:10,
 border:"none",
 background:"#2563eb",
 color:"white",
 fontWeight:600,
 fontSize:14
}}
>
Pregled
</button>

</div>



<div
style={{
 background:"white",
 padding:"10px 12px",
 borderRadius:12,
 display:"flex",
 justifyContent:"space-between",
 alignItems:"center",
 gap:10,
 flexWrap:"wrap"
}}
>

<div
style={{
 fontSize:15,
 fontWeight:600,
 flex:"1 1 220px"
}}
>
Konobari: Ukupna zarada od poslednjeg reseta
</div>

<button
onClick={() => {
 vibrate(80);
 navigate("/konobari");
}}
style={{
 padding:"8px 14px",
 borderRadius:10,
 border:"none",
 background:"#2563eb",
 color:"white",
 fontWeight:600,
 fontSize:14
}}
>
Pregled
</button>


</div>


</div>

      {/* RESET BUTTON */}
      <div
        style={{
          marginTop: 10,
          background: "white",
          padding: 16,
          borderRadius: 14
        }}
      >

 {isAdmin && (<button
  onClick={() => {

    vibrate(80);

    setResetPressed(true);

    setTimeout(() => {
      setResetPressed(false);
      setShowResetDialog(true);
    }, 250);

  }}

  style={{
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "none",

    background: "linear-gradient(135deg,#ef4444,#991b1b)",

    color: "white",
    fontWeight: "800",
    fontSize: 14,

    cursor: "pointer",

    boxShadow: resetPressed
      ? "0 2px 4px rgba(0,0,0,0.4)"
      : "0 8px 20px rgba(239,68,68,0.5)",

    transform: resetPressed
      ? "scale(0.90)"
      : "scale(1)",

    transition: "transform 0.15s ease, box-shadow 0.15s ease"
  }}
>
  RESET
</button>)}

      </div>

      {/* EXPIRE */}
      <div
        style={{
          textAlign: "center",
          marginTop: 5,
          fontSize: 20,
          color: "#555"
        }}
      >
       <div
style={{
  textAlign:"center",
  marginTop:5,
  fontSize:20,
  color:getLicenseStatus().color,
  fontWeight:
    getLicenseStatus().color === "red"
      ? "800"
      : "400"
}}
>
  Licenca validna do: {getLicenseStatus().text}
</div>
      </div>

 {
resetSuccess &&

<div
style={{
position:"fixed",
inset:0,
zIndex:9999,
background:"rgba(0,0,0,0.90)",
display:"flex",
alignItems:"center",
justifyContent:"center",
}}
>

<div
style={{
textAlign:"center"
}}
>

<div
style={{
width:120,
height:120,
borderRadius:"50%",
background:"#f97316",
display:"flex",
alignItems:"center",
justifyContent:"center",
margin:"0 auto",
boxShadow:"0 0 50px rgba(249,115,22,0.6)",
 
}}
>

 

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
className="checkAnimation"
/>

</svg>


</div>


<h1
style={{
marginTop:30,
color:"white",
fontSize:42,
fontWeight:900
}}
>
RESETOVANO
</h1>


</div>



<style>
{`

.checkAnimation {
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: drawCheck 0.6s ease forwards;
}


@keyframes drawCheck {

from {
  stroke-dashoffset: 60;
}

to {
  stroke-dashoffset: 0;
}

}


@keyframes circlePop {

from {
  transform: scale(0);
  opacity:0;
}

to {
  transform: scale(1);
  opacity:1;
}

}

`}
</style>

</div>

}
 
 

<ResetDialog
        open={isAdmin && showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetConfirm}
      />




    </div>
  );
}

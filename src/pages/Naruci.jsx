import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onValue, push, set, remove} from "firebase/database";
import { menuRestoran, ordersRestoran } from "../firebase/refs";
import CartModal from "../components/CartModal";

const MENU_CACHE_KEY = "restoran_menu";
const MENU_DATE_KEY = "restoran_menu_date";

const menuVersion = (value) => {
  const match = String(value || "").match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime() : 0;
};

const readCurrentMenu = (data) => {
  if (data?.Podaci && typeof data.Podaci === "object") {
    return { items: data.Podaci, version: String(data.createAtMillis || data.createAt || "flat-menu"), createAt: String(data.createAt || "") };
  }
  const dated = Object.entries(data || {})
    .filter(([key, value]) => key !== "createAt" && key !== "createAtMillis" && value?.Podaci)
    .sort(([a], [b]) => menuVersion(b) - menuVersion(a));
  if (!dated.length) return { items: {}, version: "empty", createAt: "" };
  return { items: dated[0][1].Podaci, version: dated[0][0], createAt: dated[0][0] };
};

export default function Naruci() {
const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  // samo selekcija artikala
  const [selectedItems, setSelectedItems] = useState([]);

  const [category, setCategory] = useState("All");

  const [showCart, setShowCart] = useState(false);

  // prava korpa se kreira tek kad se otvori modal
  const [cart, setCart] = useState({});

  const [note, setNote] = useState("");
  
  const [sending, setSending] = useState(false);
const [seconds, setSeconds] = useState(0);

const [ordered, setOrdered] = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));


const categoryRef = useRef(null);

 

const saveMenuCache=(menu,date)=>{

  localStorage.setItem(
    MENU_CACHE_KEY,
    JSON.stringify(menu)
  );

  localStorage.setItem(
    MENU_DATE_KEY,
    date
  );

};







const getMenuCache=()=>{

  const data =
    localStorage.getItem(MENU_CACHE_KEY);

  if(!data)
    return null;


  return JSON.parse(data);

};


  // ==========================
  // LOAD MENU
  // ==========================

useEffect(() => {
  const handleBack = () => {
    if (showCart) {
      setShowCart(false);
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  window.addEventListener("popstate", handleBack);

  return () => {
    window.removeEventListener("popstate", handleBack);
  };
}, [showCart, navigate]);
 
 
 
useEffect(() => {
  const cached = getMenuCache();
  const cachedVersion = localStorage.getItem(MENU_DATE_KEY);
  const lastVersion = { current: cachedVersion };
  if (cached) {
    setMenu(cached);
    setLoading(false);
  }

  const unsubscribe = onValue(menuRestoran(), (snap) => {
    if (!snap.exists()) {
      setMenu([]);
      setCart({});
      setSelectedItems([]);
      saveMenuCache([], "empty");
      lastVersion.current = "empty";
      setLoading(false);
      return;
    }

    const { items, version, createAt } = readCurrentMenu(snap.val());
    const list = Object.entries(items).map(([id, item]) => ({ id, ...item }));
    setMenu(list);
    const currentItems = new Map(list.map((item) => [item.id, item]));
    setSelectedItems((current) => current.filter((id) => currentItems.has(id)));
    setCart((current) => Object.fromEntries(Object.entries(current)
      .filter(([id]) => currentItems.has(id))
      .map(([id, cartItem]) => [id, { ...currentItems.get(id), qty: cartItem.qty }])));
    saveMenuCache(list, version);
    if (lastVersion.current && lastVersion.current !== version) {
      alert(`Novi meni je preuzet!${createAt ? `\n${createAt}` : ""}`);
    }
    lastVersion.current = version;
    setLoading(false);
  }, (error) => {
    console.error("MENU LOAD ERROR:", error);
    if (!cached) setMenu([]);
    setLoading(false);
  });

  return unsubscribe;
}, []);





  // ==========================
  // CATEGORY
  // ==========================


const categories = useMemo(()=>[
  "All",
  ...new Set(
    menu
    .map(i=>i.category)
    .filter(Boolean)
  )
], [menu]);



  const filteredMenu =

    category==="All"

    ?

    menu

    :

    menu.filter(
      i=>i.category===category
    );






  // ==========================
  // SELECT ITEM
  // ==========================

const vibrate = (time = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(time);
  }
};
 
 
 
const resetSelection = () => {

  vibrate(120);

  setSelectedItems([]);

  setCart({});

  setShowCart(false);

  setCategory("All");

  setNote("");

  // vrati kategorije skroz lijevo
  if(categoryRef.current){
    categoryRef.current.scrollTo({
      left: 0,
      behavior: "smooth"
    });
  }

  // vrati artikle na početak
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};
 
 
 
 
 
 
 
const closeCart = () => {

  window.history.back();


};
 
const toggleSelect=(item)=>{
  if (selectedItems.includes(item.id)) {
    setCart((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setSelectedItems((current) => current.filter((id) => id !== item.id));
    return;
  }
  setSelectedItems((current) => current.includes(item.id)
    ? current
    : [...current, item.id]);
};





const selectedCount = selectedItems.length;





  // ==========================
  // OPEN CART
  // ==========================



const openCart = () => {
  setCart((current) => {
    const next = {};
    menu
      .filter((item) => selectedItems.includes(item.id))
      .forEach((item) => {
        next[item.id] = {
          ...current[item.id],
          ...item,
          qty: current[item.id]?.qty || 1,
        };
      });
    return next;
  });

  window.history.pushState({ cart: true }, "");
  setShowCart(true);
};




  // ==========================
  // CART ACTIONS
  // ==========================


  const increase=(id)=>{


    setCart(prev=>({

      ...prev,

      [id]:{

        ...prev[id],

        qty:
        prev[id].qty+1

      }

    }));

  };






  const decrease=(id)=>{


    setCart(prev=>({

      ...prev,

      [id]:{

        ...prev[id],

        qty:
        Math.max(
          1,
          prev[id].qty-1
        )

      }

    }));


  };






 const removeItem=(id)=>{


setCart(prev=>{

const copy={...prev};

delete copy[id];

return copy;

});


setSelectedItems(prev =>
prev.filter(itemId=>itemId !== id)
);


};







  const totalPrice = useMemo(()=>{


    return Object.values(cart)

    .reduce(

      (sum,item)=>

      sum +

      Number(item.price)
      *
      item.qty,

      0

    );


  },[cart]);









  // ==========================
  // SEND ORDER
  // ==========================


 
const confirmOrder = async () => {

    if (sending) return;


    // PROVJERA PRAZNE KORPE
 if (
    Object.keys(cart).length === 0 ||
    Object.values(cart).every(item => item.qty <= 0)
) {
    alert("KORPA JE PRAZNA");
    return;
}


    if (!user) {
        alert("Nisi logovan");
        return;
    }

    const items = Object.values(cart);
    const invalidItem = items.some((item) => {
        const quantity = Number(item.qty);
        const price = Number(item.price);
        return !Number.isInteger(quantity) || quantity < 1 ||
            !Number.isFinite(price) || price < 0;
    });

    if (invalidItem) {
        alert("Neispravna količina ili cijena artikla.");
        return;
    }

    const sum = Math.round(items.reduce(
        (total, item) => total + Number(item.price) * Number(item.qty),
        0
    ) * 100) / 100;

    if (!Number.isFinite(sum)) {
        alert("Neispravna ukupna cijena.");
        return;
    }
    setSending(true);
    setSeconds(20);

    let finished = false;

    const ref = push(ordersRestoran());

    const timer = setInterval(() => {

        setSeconds(prev => {

            if (prev <= 1) {

                clearInterval(timer);

                return 0;
            }

            return prev - 1;

        });

    }, 1000);

    const timeout = setTimeout(async () => {

        if (finished) return;

        finished = true;

        clearInterval(timer);

        try {

            await remove(ref);

        } catch (e) {

            console.log(e);

        }

        setSending(false);
        setSeconds(0);

        alert(
            "Narudžba nije poslana.\nMolimo pokušajte ponovo."
        );

    }, 20000);

    try {

        const text =
            items
                .map(i => `${i.qty > 1 ? i.qty + "X " : ""}${i.name}`)
                .join("\n");

        const desc =
            items
                .map(i => i.description || "")
                .join("\n");

        const now = new Date();
        const pad = (value) => String(value).padStart(2, "0");
        const time =
            `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ` +
            `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;

        await set(ref, {

            orderId: ref.key,

            orderById: user.uid,

            orderPersonName: user.ime,

            time,

            status: "pending",

            totalPrice: sum.toFixed(2),

            priprema: "0",

            name: text,

            description: desc,

            addittionalInfo: note.trim()

        });

        if (finished) return;

        finished = true;

        clearTimeout(timeout);
        clearInterval(timer);

setSending(false);
setSeconds(0);

setCart({});
setSelectedItems([]);
setNote("");
setShowCart(false);

setOrdered(true);

setTimeout(() => {

    setOrdered(false);

}, 2000);

    } catch (e) {

        if (!finished) {

            finished = true;

            clearTimeout(timeout);
            clearInterval(timer);

            try {

                await remove(ref);

            } catch { }

            setSending(false);
            setSeconds(0);

            alert(
                "Narudžba nije poslana.\nMolimo pokušajte ponovo."
            );

        }

    }

};






  if(loading){

    return (

      <div className="
      min-h-screen
      bg-black
      text-white
      p-5
      ">

        Učitavanje...

      </div>

    );

  }







  return (

    <>

<div
className="
min-h-screen
bg-black
text-white
p-4
pb-40
"
>


 {/* HEADER */}

<div
className="
flex
justify-between
items-center
mb-5
"
>

<h1
className="
text-white
text-3xl
font-black
"
>
Meni
</h1>





</div>



{/* KATEGORIJE */}

<div
ref={categoryRef}
className="
sticky
top-0
z-50
flex
gap-3
overflow-x-auto
mb-6
py-3
bg-black/95
backdrop-blur-xl
"
>

      {
        categories.map(c=>(
		
		
	 

          <button

          key={c}

          onClick={()=>setCategory(c)}

          className={`

          px-5
          py-2
          rounded-full
          whitespace-nowrap

          ${
            category===c

            ?

            "bg-orange-500 text-black"

            :

            "bg-neutral-900"

          }

          `}

          >

          {c}

          </button>

        ))

      }


      </div>
	  
	  
	 






 


 {/* ARTIKLI */}

<div
  className="
    grid
    grid-cols-2
    gap-4
    xl:grid-cols-3
  "
>

{
filteredMenu.map(item=>{

const selected = selectedItems.includes(item.id);

return (

 <div
key={item.id}
onClick={()=>toggleSelect(item)}
className={`
relative
cursor-pointer
rounded-[28px]
h-[300px]
p-5
transition
duration-300
border
overflow-hidden
flex
flex-col

${
selected

?

"bg-white text-black border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.35)] scale-[1.01]"

:

"bg-[#18181b] text-white border-neutral-800 hover:border-orange-500"

}

`}
>



{
selected &&

<div
className="
absolute
top-5
right-5
w-12
h-12
rounded-full
bg-orange-500
flex
items-center
justify-center
font-black
text-xl
shadow-lg
"
>

✓

</div>

}




<h2
className="
text-xl
font-black
tracking-tight
leading-tight
break-words
"
>

{item.name}

</h2>



<p
className="
mt-3
text-xs
leading-relaxed
opacity-70
line-clamp-5
"
>
{item.description}
</p>




<div
className="
mt-auto
pt-4
flex
justify-between
items-center
"
>


<span
className="
text-xs
uppercase
opacity-60
font-bold
"
>

Cijena

</span>



<span
className="
text-xl
font-black
text-orange-500
"
>

{item.price} €

</span>


</div>



</div>


)

})

}


</div>


      </div> 
      {/* kraj glavnog page containera */}



      {/* FIXED BAR */}

      {
        selectedCount > 0 &&

        <div
          className="
          fixed
          bottom-0
          left-0
          right-0
          z-[100]
          bg-neutral-950/95
          backdrop-blur-xl
          border-t
          border-neutral-800
          p-4
          "
        >

          <div
className="
max-w-6xl
mx-auto
flex
items-center
gap-3
"
>


{/* ODABRANO */}

<div
className="
flex
items-center
gap-2
bg-green-500/10
border
border-green-500/30
px-3
py-2
rounded-3xl
flex-1
"
>




<div
className="
flex
items-center
gap-2
leading-tight
"
>

<div
className="
text-green-400
text-[11px]
uppercase
font-black
tracking-wider
"
>
Odabrano
</div>

<div
className="
w-12
h-12
rounded-2xl
bg-green-500
text-black
flex
items-center
justify-center
font-black
text-2xl
shadow-[0_0_25px_rgba(34,197,94,0.45)]
"
>
{selectedCount}
</div>

</div>





</div>



{/* RESET */}

<button

onClick={resetSelection}

className="
w-14
h-14
rounded-3xl
bg-neutral-900
border
border-neutral-700
text-neutral-300
text-2xl
font-black
flex
items-center
justify-center
shadow-lg
active:scale-90
transition
hover:border-red-500
hover:text-red-400
"

>
↻

</button>



{/* NARUČI */}

<button
onClick={() => {
vibrate(60);
openCart();
}}

className="
flex-1
h-16
bg-orange-500
text-black
rounded-3xl
font-black
text-lg
shadow-[0_0_35px_rgba(249,115,22,0.35)]
active:scale-95
transition
flex
items-center
justify-center
gap-2
"

>

<span>
🛒
</span>

NARUČI

</button>


</div>
		  
	  
		  
		  


          </div>

       

      }


{
ordered &&

<div
className="
fixed
inset-0
z-[999]
pointer-events-auto
bg-black/90
backdrop-blur-xl
flex
items-center
justify-center
animate-fadeIn
"
>

<div
className="
text-center
animate-scaleIn
"
>

<div
className="
w-28
h-28
mx-auto
rounded-full
bg-orange-500
flex
items-center
justify-center
shadow-[0_0_50px_rgba(249,115,22,0.6)]
animate-checkCircle
"
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
className="animate-drawCheck"
/>

</svg>

</div>


<h1
className="
mt-8
text-4xl
font-black
animate-textUp
"
>
 
</h1>

 


  <h1
        style={{
          marginTop: 30,
          color: "white",
          fontSize: 42,
          fontWeight: 900,
        }}
      >
        Naručeno
      </h1>


</div>

</div>

}



      {/* CART MODAL */}

      {
        showCart &&

        <CartModal

          cart={cart}

          increase={increase}

          decrease={decrease}

          removeItem={removeItem}

          totalPrice={totalPrice}

          note={note}

          setNote={setNote}

         

          onConfirm={confirmOrder}
		  
	      sending={sending}

          seconds={seconds}
		  
		  onClose={closeCart}


        />

      }


    </>

  );

}

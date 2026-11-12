import { useState } from "react";
import "./ResetDialog.css";
 
export default function ResetDialog({

    open,
    onClose,
    onConfirm

}) {

    const [deleteMonths, setDeleteMonths] = useState(false);
    const [deleteOrders, setDeleteOrders] = useState(false);
    const [loading, setLoading] = useState(false);

const [showStatsConfirmation, setShowStatsConfirmation] = useState(false);


    if (!open) return null;










    const confirm = async () => {

        if (loading) return;

        setLoading(true);

        try {

            await onConfirm({

                deleteMonths,
                deleteOrders

            });

        } finally {

               setLoading(false);

    setDeleteMonths(false);
    setDeleteOrders(false);

        }

    };
	
	
	
 
	
	if (showStatsConfirmation) {

    return (

        <div className="resetOverlay">

            <div className="resetDialog">

                <div className="resetHeader">
                    Potvrda
                </div>


                <div className="resetBody">

                    <p>
                        Ako označite, mjesečni izvještaji i statistika će biti obrisani trajno.
                    </p>


                </div>


                <div className="resetButtons">


                    <button

                        className="btnYes"

                        onClick={() => {
                            setDeleteMonths(true);
                            setShowStatsConfirmation(false);
                        }}

                    >
                        POTVRDI
                    </button>


                    <button

                        className="btnNo"

                        onClick={() => {

                            setDeleteMonths(false);
                            setShowStatsConfirmation(false);

                        }}

                    >
                        ODUSTANI
                    </button>


                </div>


            </div>

        </div>

    );

}
	

    return (

        <div className="resetOverlay">

            <div className="resetDialog">

                <div className="resetHeader">

                    Da li ste sigurni?

                </div>

             <div className="resetBody">

    <div style={{ textAlign: "center" }}>

        <p>Ovom akcijom brišete podatke trajno!</p>

        <p>Svi računi i dnevna zarada će biti obrisani.</p>

    </div>

                    <div className="resetOption">

                        <span>

                            Mjesečni izvještaji i statistika konobara

                        </span>

                        <label className="switch">

                   <input

    type="checkbox"

    checked={deleteMonths}

    onChange={(e) => {

        if (e.target.checked) {

            setShowStatsConfirmation(true);

        } else {

            setDeleteMonths(false);

        }

    }}

/>

                            <span className="slider"></span>

                        </label>

                    </div>

                    <div className="resetOption">

                        <span>

                            Sve trenutne narudžbe

                        </span>

                        <label className="switch">

                            <input

                                type="checkbox"

                                checked={deleteOrders}

                                onChange={(e) =>

                                    setDeleteOrders(

                                        e.target.checked

                                    )

                                }

                            />

                            <span className="slider"></span>

                        </label>

                    </div>

                </div>

                <div className="resetButtons">

                    <button

                        className="btnYes"

                        disabled={loading}

                        onClick={confirm}

                    >

                        {

                            loading

                                ? "Sačekajte..."

                                : "DA"

                        }

                    </button>

                <button
  className="btnNo"
  disabled={loading}
  onClick={() => {

    setDeleteMonths(false);
    setDeleteOrders(false);

    onClose();

  }}
>
  NE
</button>

                </div>

            </div>

        </div>

    );

}

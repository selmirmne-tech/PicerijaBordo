import "./Politika.css";

function Politika() {
  return (
    <div className="privacy-page">

      {/* NASLOV */}
      <h1 className="privacy-title">
        Politika privatnosti
      </h1>


      {/* SADRŽAJ */}
      <div className="privacy-card">

        <div className="privacy-content">

          <p>
            <strong>Datum stupanja na snagu: 17.07.2026.</strong>
          </p>

          <br />

          <p>
            <strong>1) Privatnost i zaštita podataka</strong>
          </p>

          <p>
            <strong>1.1</strong><br />
            Pružalac usluge prikuplja i obrađuje samo podatke koji su
            neophodni za pravilno funkcionisanje aplikacije i pružanje
            usluge korisnicima.
          </p>

          <p>
            <strong>1.2</strong><br />
            Podaci koji se mogu prikupljati i čuvati uključuju:
          </p>

          <ul>
            <li>
              podatke o korisničkom nalogu, kao što su ime korisnika,
              email adresa i podaci za prijavu;
            </li>

            <li>
              podatke o ugostiteljskom objektu, uključujući naziv objekta,
              meni, artikle i druge informacije potrebne za korištenje
              aplikacije;
            </li>

            <li>
              podatke o narudžbama i poslovnim aktivnostima izvršenim putem
              aplikacije;
            </li>

            <li>
              tehničke podatke potrebne za rad i sigurnost sistema.
            </li>
          </ul>

          <p>
            <strong>1.3</strong><br />
            Podaci korisnika čuvaju se na serverskoj infrastrukturi koju
            koristi pružalac usluge i obrađuju se isključivo radi
            omogućavanja rada aplikacije, održavanja sistema, pružanja
            korisničke podrške i unapređenja usluge.
          </p>

          <p>
            <strong>1.4</strong><br />
            Pružalac usluge preduzima razumne tehničke i organizacione mjere
            radi zaštite podataka korisnika od neovlaštenog pristupa, gubitka
            ili zloupotrebe.
          </p>

          <p>
            <strong>1.5</strong><br />
            Korisnik je odgovoran da osigura da podaci koje unosi u
            aplikaciju ne krše prava trećih lica i da ima odgovarajuće pravo
            korištenja tih podataka.
          </p>

          <p>
            <strong>1.6</strong><br />
            Pružalac usluge neće prodavati, iznajmljivati niti koristiti
            podatke korisnika u svrhe koje nisu povezane sa pružanjem
            usluge, osim kada je to potrebno radi ispunjavanja zakonskih
            obaveza.
          </p>


          <p>
            <strong>2) Izmjene Politike privatnosti</strong>
          </p>

          <p>
            <strong>2.1</strong><br />
            Pružalac usluge zadržava pravo da izmijeni ili dopuni ovu
            Politiku privatnosti u skladu sa promjenama u načinu obrade
            podataka, tehničkim unapređenjima aplikacije ili izmjenama
            važećih propisa.
          </p>

          <p>
            <strong>2.2</strong><br />
            Korisnici će biti obaviješteni o značajnijim izmjenama Politike
            privatnosti putem aplikacije ili drugih dostupnih komunikacionih
            kanala, kada je to moguće.
          </p>

          <p>
            <strong>2.3</strong><br />
            Nastavkom korištenja aplikacije nakon objavljenih izmjena smatra
            se da je korisnik upoznat sa izmijenjenom Politikom privatnosti.
          </p>


          <p>
            <strong>3) Brisanje korisničkih podataka</strong>
          </p>

          <p>
            <strong>3.1</strong><br />
            Korisnik može zatražiti brisanje svog korisničkog naloga i
            povezanih podataka kontaktiranjem pružaoca usluge.
          </p>

          <p>
            <strong>3.2</strong><br />
            Nakon provjere zahtjeva, pružalac usluge će preduzeti razumne
            mjere radi uklanjanja ili anonimizacije podataka, osim podataka
            koje je potrebno zadržati radi ispunjavanja zakonskih obaveza.
          </p>


          <p className="privacy-final">
            Korištenjem ove aplikacije potvrđujete da ste pročitali,
            razumjeli i prihvatate naše Uslove korištenja i Politiku
            privatnosti.
          </p>

        </div>

      </div>

    </div>
  );
}

export default Politika;
import { Link } from "react-router-dom";
import logoFinal from "../assets/logo_final.webp";
import "./about.css";

function About() {
  return (
    <div className="about-page">

      {/* GLAVNI SADRŽAJ */}
      <div className="about-card">

        <div className="about-content">

          {/* LOGO */}
          <img src={logoFinal} alt="Vaš restoran" className="about-logo" />

          {/* NAZIV */}
          <h1>Vaš restoran</h1>

          {/* OPIS APLIKACIJE */}
          <div className="about-description">

            <p>
              Aplikacija je namijenjena osoblju restorana i podijeljena je na
              tri uloge korisnika: <strong>Administratori, Konobari i Kuhinja.</strong>
              Svaka uloga posjeduje određena prava pristupa i funkcionalnosti.
            </p>

            <p>
              <strong>Administratori</strong> imaju potpuni pristup svim
              funkcijama aplikacije, uključujući pregled statistike korisnika,
              pregled narudžbi i storniranje računa u slučaju greške prilikom
              izdavanja narudžbe. Prilikom storniranja računa ukupna zarada
              ostaje nepromijenjena. Nakon storniranja potrebno je obavijestiti
              kuhinju kako bi se spriječila priprema otkazane narudžbe.
            </p>

            <p>
              <strong>Konobari</strong> koriste opciju „Naruči hranu“, gdje mogu
              unijeti dodatne informacije vezane za narudžbu, odabrati željene
              artikle i potvrditi slanje narudžbe. Takođe imaju mogućnost
              pregleda svog pazara i prijave pazara na kraju smjene.
              Račune nije preporučljivo brisati prije završetka smjene.
            </p>

            <p>
              <strong>Kuhinja</strong> prima notifikacije o novim narudžbama
              zajedno sa listom poručenih artikala i dodatnim informacijama.
              Nakon pripreme i izdavanja hrane potrebno je kliknuti na dugme
              „Završi narudžbu“.
            </p>

            <p>
              Prilikom registracije korisničkog naloga neophodno je unijeti
              tačne i potpune podatke kako bi aplikacija funkcionisala pravilno.
            </p>

          </div>

        </div>

      </div>


      {/* PRAVNE INFORMACIJE */}
      <div className="about-card legal-card">

        <div className="about-content">

          <h2>Pravne informacije</h2>

          <Link to="/uslovi" className="about-link">
            Uslovi korišćenja
          </Link>

          <Link to="/politika" className="about-link">
            Politika privatnosti
          </Link>

        </div>

      </div>


      {/* PODRŠKA */}
      <div className="about-card support-card">

        <div className="about-content">

          <h2>Podrška</h2>

          <p>
            Za sva pitanja, probleme ili dodatne informacije možete nas
            kontaktirati putem korisničke podrške.
          </p>

        </div>

      </div>


      {/* COPYRIGHT */}
      <div className="about-copyright">
        © 2026 Vaš restoran. Sva prava zadržana.
      </div>

    </div>
  );
}

export default About;

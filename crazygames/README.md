# Ice Dash pe CrazyGames

Tot ce trebuie pentru [developer.crazygames.com](https://developer.crazygames.com/games), gata de încărcat.

| Fișier | Ce e |
|---|---|
| `icedash-crazygames.zip` | Jocul (840 KB, 16 fișiere, `index.html` în rădăcină, doar căi relative) |
| `texts.md` | Titlu, descriere, controale, categorie, taguri, în engleză |
| `covers/cover-1920x1080.png` | Copertă landscape 16:9 (obligatorie) |
| `covers/cover-800x1200.png` | Copertă portrait 2:3 (obligatorie) |
| `covers/cover-800x800.png` | Copertă pătrată 1:1 (obligatorie) |
| `video/preview-16x9.mp4` | Video landscape 1920×1080, 18 s, 7 MB, fără sunet (obligatoriu) |
| `video/preview-2x3.mp4` | Video portrait 1080×1620, 18 s, 6 MB, fără sunet (obligatoriu) |

Copertele au scris pe ele doar titlul (logo-ul jocului), fără iconițe,
fără logo-uri de magazine și fără ramă. Videoclipurile pornesc cu coperta,
cum cere CrazyGames, apoi arată o cursă reală prin 4 locuri de pe munte.

## Cum îl publici, pas cu pas

1. Intră pe **developer.crazygames.com** și fă-ți cont de dezvoltator
   (gratuit). Completează datele de plată când ți le cere: de acolo vin banii.
2. **Add game / Submit game.** Alege tipul **HTML5** și încarcă
   `icedash-crazygames.zip`.
3. **Preview în portal.** Deschide jocul în previzualizarea lor și joacă o
   cursă până la capăt. Când ieși din rezultate, trebuie să vezi caseta lor
   de test pentru reclamă. Așa știi că SDK-ul merge.
4. **Detaliile jocului.** Copiezi din `texts.md` titlul, descrierea,
   controalele, categoria și tagurile. Bifezi **mobile: yes** și
   **orientation: both**.
5. **Coperte și video.** Încarci cele 3 coperte din `covers/` și cele 2
   videoclipuri din `video/`.
6. **Submit.** Urmează verificarea lor (QA). Dacă trece, jocul intră în
   **Basic Launch**: 7–21 de zile cu un public restrâns și **fără reclame**.
   E normal: SDK-ul refuză singur reclamele în faza asta, iar jocul merge
   mai departe ca și cum n-ar fi fost cerută niciuna. În consola
   browserului (F12, filtru `midgame`) se vede
   `[Ice Dash] midgame ad: requested`, apoi `refused (adsDisabledBasicLaunch)`.
7. **Full Launch.** Basic Launch ține cel puțin 7 zile și 500 de jocuri
   jucate. Apoi CrazyGames se uită la cifre (cât stau jucătorii, câți trec
   de meniu la joc, câți revin) și, dacă sunt bune, lansează jocul pentru
   toată lumea și pornește reclamele. Nu ai nimic de schimbat în joc: reclamele
   sunt deja legate.

De obicei durează 2–4 săptămâni de la trimitere până la Full Launch.

## Ce face versiunea pentru CrazyGames

Jocul e același, iar build-ul copiază fișierele din aceeași listă ca
`build.sh`. Diferențele sunt două: în `index.html`, SDK-ul YouTube e
înlocuit cu **CrazyGames SDK v3**, și e adăugat `js/crazygames.js`.

| Cerința CrazyGames | Cum e îndeplinită |
|---|---|
| `gameplayStart` / `gameplayStop` | `start` cât merge o cursă (inclusiv tutorialul); `stop` la pauză, la rezultate și la reclamă |
| Jucătorul nou ajunge în joc din cel mult un clic | un jucător nou ajunge direct pe pârtie, în tutorial; comicsul lui Snowcap îl găsește mai târziu în Market |
| Salvarea prin modulul Data | progresul merge prin `SDK.data`, deci urmează jucătorul logat de pe un dispozitiv pe altul; păstrează și o copie în `localStorage` |
| Limba din `systemInfo.locale`, engleza ca rezervă | jocul pornește în limba jucătorului dacă o are, altfel în engleză |
| Reclama doar în pauze, nu din butoane de meniu | o reclamă midgame doar la ieșirea din rezultatele unei curse; frecvența o hotărăște CrazyGames (cel mult una la 3 minute) |
| Nimic de apăsat cât se cere sau rulează reclama | pagina e blocată, jocul e pe pauză |
| Pe desktop vezi destulă pârtie în față | pe ecran lat se vede cel puțin 860 de unități de pârtie în înălțime (înainte: 540), deci ~1,6× mai mult în fața pinguinului |
| Modul principal disponibil imediat | Freeride e deschis de la început, nu după First Light |
| Controalele arătate pentru mouse și tastatură | pe desktop tutorialul spune „Click or press Space”, nu „Tap” (în toate cele 6 limbi) |
| Fără taste cu rol în browser | Esc nu mai pune pauză în cursă (Esc iese din fullscreen); pauza e pe P și pe buton |

Ultimele patru rânduri au venit după prima respingere („calitatea generală
nu atinge așteptările”) și sunt doar în build-ul CrazyGames: le pornește
`js/crazygames.js` prin `window.ICEDASH_PLATFORM`.
| Sunet oprit în timpul reclamei | da, și pornește din nou după ea |
| Setarea `muteAudio` a site-ului are prioritate | da, se aplică imediat ce o schimbă jucătorul |
| Merge și cu AdBlock | dacă reclama e refuzată, butonul apăsat merge mai departe normal |
| `happytime()` doar la momente mari | doar la un record nou |
| Sunetul pe iOS repornit dintr-o atingere | la fiecare atingere |
| Fără selecție de text sau meniu contextual | blocate peste tot |
| Fără buton propriu de fullscreen, fără link-uri externe | jocul nu are niciunul |
| Doar căi relative, ≤ 50 MB, ≤ 1500 fișiere | 16 fișiere, 840 KB; build-ul refuză orice cale absolută |

Am testat totul în Chrome cu **SDK-ul real CrazyGames** în modul lui local,
cu reclame demonstrative: 16 verificări, toate trec, fără erori.

## Cum refaci totul după o schimbare în joc

```bash
bash build-crazygames.sh             # crazygames/game/ și arhiva
node crazygames/media.js             # cele 3 coperte
node crazygames/media.js --video     # ...și cele 2 videoclipuri
```

`crazygames/game/` e o copie făcută de build. Nu o edita de mână.

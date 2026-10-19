# Ice Dash pe Yandex Games

Tot ce trebuie pentru consola Yandex Games (aplicația 625230), gata de încărcat.

| Fișier | Unde se încarcă în consolă |
|---|---|
| `icedash-yandex.zip` | **Архив** |
| `texts.md` | Textele pentru tab-urile **Русский** și **Английский**: Название, Описание для SEO, Об игре, Короткое описание, Как играть |
| `icon-512.png` | **Иконка** (PNG 512×512) |
| `cover-800x470.png` | **Обложка** (PNG 800×470) |
| `video/gameplay-16x9.mp4` | **Горизонтальное видео** (obligatoriu): 1920×1080, 25 s, MP4 |
| `video/gameplay-9x16.mp4` | **Вертикальное видео**: 1080×1920, 25 s, MP4 |
| `screenshots/desktop/ru/*.png` | **Скриншоты → Десктопные**, tab-ul Русский: 1920×1080 |
| `screenshots/mobile/ru/*.png` | **Скриншоты → Мобильные**, tab-ul Русский: 1080×1920 |
| `screenshots/desktop/en/`, `screenshots/mobile/en/` | Aceleași capturi pentru tab-ul Английский, cu jocul în engleză |

Pe fiecare captură și în fiecare video se vede gameplay real, cum cere
regula 5.1.1 (cel puțin 70% gameplay). Nu e niciun meniu, iar fiecare
captură e din alt loc de pe munte.

## Ce mai trebuie setat în formular

- **Категории** (maximum 2): `Аркады` și `Казуальные`. Scoate `Головоломки`, jocul nu e puzzle.
- **Теги** (până la 20): `на ловкость`, `с пингвинами`, `бесконечный раннер`,
  `на время`, plus ce mai oferă lista, de exemplu `зимние`, `про животных`,
  `для детей`, `казуальные`, `одной кнопкой`, `офлайн`.
- **Игра переведена на**: Русский, Английский. Jocul mai știe română,
  spaniolă, portugheză și germană. Le poți adăuga mai târziu, dar fiecare
  limbă adăugată cere propriile texte în formular.
- **Игра использует облачные сохранения**: **pornit**. Progresul se salvează
  în contul jucătorului prin `player.setData`.
- **Ориентация**: Любая. **Возрастной рейтинг**: 0+.
- **Реклама**: jocul arată o reclamă pe tot ecranul prin SDK. Pentru bani,
  contractul РСЯ trebuie să fie activ; fără el butonul
  „Отправить на модерацию” rămâne inactiv.

## Ce s-a schimbat față de jocul de pe YouTube

Jocul în sine e același: build-ul copiază fișierele din aceeași listă ca
`build.sh`. Diferențele sunt două:

1. În `index.html`, SDK-ul YouTube Playables e înlocuit cu `<script src="/sdk.js">`,
   SDK-ul Yandex Games pe care Yandex îl servește lângă joc.
2. E adăugat `js/yandex.js`, care traduce apelurile jocului în apeluri Yandex:

| Cerința Yandex | Cum e îndeplinită |
|---|---|
| 1.19.2 `LoadingAPI.ready()` | apelat când jocul e gata de jucat, după ce s-a încărcat salvarea |
| 1.19.3 `GameplayAPI.start/stop` | `start` cât timp merge o cursă; `stop` la pauză, la ecranul de rezultate și la reclamă |
| 2.14 limba din SDK | jocul pornește în limba dată de `environment.i18n.lang` (be/kk/uk/uz → rusă; o limbă pe care jocul n-o are → engleză) |
| 1.9 salvarea | după fiecare acțiune, în cloud (`player.setData`) și local; la pornire se ia copia cea mai avansată |
| 1.3 sunetul la pierderea focusului | sunetul se oprește când fila e ascunsă sau jocul pierde focusul; când fila e ascunsă, jocul trece și pe pauză |
| 1.12 monetizarea | reclamă pe tot ecranul prin `adv.showFullscreenAdv` |
| 4.4 reclama doar în pauze logice | doar la ieșirea din rezultatele unei curse (Ride again sau Menu), cel mult o dată la 90 s, niciodată în timpul jocului |
| 4.7 pauză și liniște în timpul reclamei | jocul e pus pe pauză și sunetul e oprit până se închide reclama |
| 1.6.1.8, 1.6.2.7 fără meniu contextual sau selecție | blocate peste tot, nu doar pe pârtie |
| 1.10.2 fără scroll de pagină | jocul ocupă tot ecranul, fără scroll (era deja așa) |
| 4.1 reclamă doar prin SDK | nicio altă rețea, nicio cerere externă |

## Cum refaci totul după o schimbare în joc

```bash
bash build-yandex.sh           # yandex/game/ și yandex/icedash-yandex.zip
node yandex/media.js           # iconița, coperta, capturile de ecran
node yandex/media.js --video   # ...și cele două videoclipuri
```

`yandex/game/` e o copie făcută de `build-yandex.sh`. Nu o edita de mână:
la următorul build se suprascrie.

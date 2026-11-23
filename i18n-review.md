# Translation review (23 Nov 2026)

Redone on 23 Nov 2026: the list from the 22 Nov visual pass was never written down.
Checked: all 732 keys in `js/i18n.js`.
- The automatic checks covered every key: names used the same way throughout,
  ты/вы, du/Sie, ș/ț, ¿/¡, untranslated words, plurals.
- The 210 main UI strings were read in all six languages.
- The comics and the creature stories were only searched for the problems
  found here; they were not read in full.

**Applied 23 Nov 2026 on the owner's word** ("aplica"): A = 1 ("Freeride" everywhere), B, C, D, and E in full. With them:
- One word for skins in each language: ro `Costume`/costumul, ru `Облики`/облик, de `Kostüme`/Kostüm.
- The German daily task `task.jump3` shortened ("Überspring {n} Spalten in einer Abfahrt"): at 390 px it ran onto three lines.

`node test/textfit.js`: every word fits. Still to do: the store texts in `store/` use the old names (`Liber`, `Libre`, `Livre`, `Freie Fahrt`) in the notes of earlier versions. The next notes and listings use Freeride (TODO item 10).

## A. The name of Freeride

The names now: ro `Liber`, es `Libre`, pt `Livre`, de `Freie Fahrt`, ru `Фрирайд`.

- In German it is wrong three times, because the name has to be declined and is not:
  - "Sammle … in **Freie Fahrt**" should be "in Freier Fahrt".
  - "**Zu Freie Fahrt**".
  - "auf der Piste **von Freie Fahrt**".
- In ro, es and pt, the name on its own reads as the adjective "free".
  - "Mergi în Liber", "Coboară în modul Liber", "Ir a Libre", "Jogue no Livre".

Each language uses the name in six strings: `mode.free`, `board.empty`,
`over.unlocked.modes`, `ev.ny.text`, `ev.goal`, `ev.play`.

1. **"Freeride" everywhere**, as in Russian. It is an international ski word and needs no
   declining. *(recommended)*
2. **Local descriptive names:**
   - ro `Coborâre liberă`
   - es `Descenso libre`
   - pt `Descida livre`
   - de `Freeride`

   Each sentence around the name gets rewritten to fit
   ("Mergi la Coborâre liberă", "na Descida livre", …).

## B. The spare life: one name per language

- **es:** `life.full` and `life.sold` say "vida **extra**". Everywhere else it is
  "vida **de repuesto**".
- **pt:** "vida **extra**" in the same two strings, against "vida **de reserva**".
- **de:** "**Extraleben**" in the same two strings, against "**Ersatzleben**".

## C. Russian: trophies

The trophies are "Награды" in some places and "Трофеи" in others (`prof.trophies`,
`prof.t.all`, `prof.medalNote`, the comics). Make them all **Трофеи**:

| key | now | proposed |
|---|---|---|
| btn.trophies | Награды | Трофеи |
| ach.title | Награды | Трофеи |
| over.unlocked | Награда! | Трофей! |
| ach.prize.desc | Получи все награды, и она твоя… | Получи все трофеи, и она твоя… |
| ach.prize.yours | Все награды получены… | Все трофеи получены… |
| shop.trophyneed | Все награды {a}/{b} | Все трофеи {a}/{b} |
| ach.toclaim | … ждёт в Наградах | … ждёт в Трофеях |

## D. Plain mistakes

| # | key | language | now | proposed | why |
|---|---|---|---|---|---|
| 1 | prof.note | ro | Cartea ta apare în clasament… | Cardul tău apare în clasament imediat ce îl schimbi. | "carte" is a book; everywhere else it is "cardul tău" |
| 2 | prof.nocard | ro | Încă nu are carte: … | Încă nu are card: apare odată cu următorul lui record. | the same |
| 3 | alt.unicorn | ro | Unicorn | Inorog | the comic already says "inorog" |
| 4 | life.sell / life.sold | ro | Vinde pentru {n} pești · +{n} pești… | Vinde pentru {n} de pești · +{n} de pești pentru viața de rezervă (with plural forms) | the price is 250: "250 de pești" |
| 5 | revive.title | ru | Чуть не упал | Было близко | masculine: the player and half the creatures are female |
| 6 | ev.over | ru | …забери, что успел | Событие завершилось: забери свои призы | masculine |
| 7 | tut.done.title | ru | Ты готов! | Всё готово! | masculine |
| 8 | prof.nocard | ru | …с их следующим рекордом | Карточки пока нет: она появится со следующим рекордом. | "их" is plural for one player |
| 9 | help.snow | ru | а скорость это и есть очки | а скорость — это и есть очки | the dash is missing |
| 10 | over.unlocked.modes | es | Desbloqueado: ¡Libre, …! | ¡Desbloqueado: Libre, Contrarreloj y la Línea del día! | "¡" belongs at the start |

## E. Optional (style)

- ro "skin-urile" / "skin-ul" (`prof.avNote`, `alt.locked`) could become
  "costumele" / "costumul". Russian says "облик" and German "Kostüme".
- The leaderboard's "All time" tab:
  - ro "Tot timpul" could become "Dintotdeauna";
  - es "Siempre" could become "Histórico";
  - pt "Sempre" could become "Geral".

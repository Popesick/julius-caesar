# Julius Caesar (C64, Kingsoft 1989) – Reverse-Engineering- und Designdokument

Stand: 13.10.2026 · Quelle: `JULIUS-D.D64` (174 848 Byte) + `VERSION.NFO`

> **Ergebnis in einem Satz:** Das Spiel besteht aus einem BASIC-Programm (`HP`, 540 Zeilen), das die gesamte
> Spiellogik enthält, und einer in vier Overlays komprimierten Maschinencode-Bibliothek für Grafik, Joystick-Menüs
> und Bildschirmszenen. Die Regeln liegen damit **vollständig und im Klartext** vor; sie sind in diesem Dokument
> beschrieben und in einem spielbaren Nachbau (`remake/`) umgesetzt.

Zuverlässigkeit der Aussagen: **✔** direkt aus dem Code abgelesen · **◐** aus Aufrufkontext abgeleitet · **○** nicht untersucht.

---

## 1. Überblick

| | |
|---|---|
| Titel | Julius Caesar |
| Publisher / Jahr | Kingsoft, 1989 (laut NFO) |
| Programmierer | Ralf Trabhardt (laut NFO) |
| Genre | Strategie / Krieg, 1 Spieler, Joystick Port 2 |
| Sprache | Deutsch (die Ordnerbezeichnung „EN“ ist irreführend) |
| Spielidee | Als römischer Heerführer unterwirfst du in Gallien 30 Stämme mit vier Legionen, Geld und Diplomatie. |
| Gewinnen | Alle 30 Stämme haben einen Friedens- oder Freundschaftsvertrag (oder wurden vernichtet). |
| Verlieren | Alle Legionen vernichtet **oder** Kasse am Jahresende < 1 Denar. |

Gelieferte Ergebnisse:

| Pfad | Inhalt |
|---|---|
| `DESIGN.md` | dieses Dokument |
| `tools/reverse.py` | reproduzierbare Pipeline D64 → entpackter Speicher → BASIC-Listing → `tribes.json` |
| `tools/cpu6502.py`, `disasm6502.py`, `detok.py` | eigener 6502-Emulator, Disassembler und BASIC-Detokenizer (keine externen Tools nötig) |
| `analysis/` | Ausgaben der Pipeline: `hp_basic_listing.txt`, `tribes.json`, `game_memory.bin`, `stage_original_4000.bin` |
| `remake/` | spielbarer Nachbau (HTML/JS), Engine mit Tests |

---

## 2. Methode

Auf dem System waren weder VICE noch ein 6502-Toolchain installiert. Deshalb wurde ein kleiner NMOS-6502-Emulator in
Python geschrieben (`tools/cpu6502.py`), mit dem die Packer-Stufen **unverändert ausgeführt** wurden, statt sie
nachzuprogrammieren. KERNAL-Aufrufe wurden nur dort ersetzt, wo nötig (ACPTR beim Fastloader).

```bash
python3 tools/reverse.py JULIUS-D.D64 analysis/     # ca. 15 s
node remake/test.js                                 # Engine-Tests + Bot-Simulation
```

---

## 3. Datenträger

Sieben PRG-Dateien (✔):

| Datei | Größe | Ladeadr. | Inhalt |
|---|--:|---|---|
| `JULIUS CAESAR` | 30 572 | $0801 | Starter; dreifach gepackt (siehe 4) |
| `HP` | 12 554 | $0801 | **BASIC-Hauptprogramm** (540 Zeilen), enthält alle Regeln |
| `SCHLUSSBILD` | 3 000 | – | Schlussbild bei Sieg, komprimiert (○ nicht entpackt) |
| `1.JULIUS CAESAR.` | 8 685 | (Header ≠ Ladeadr.) | Overlay 1, komprimiert → $A008–$CF8F |
| `2.JULIUS CEASAR.` | 2 640 | dito | Overlay 2 → $A001–$A1FE und $B000–$BFE9 |
| `3.JULIUS CEASAR.` | 2 689 | dito | Overlay 3 → $C000–$CF12 (**Maschinencode-Bibliothek**) |
| `4.JULIUS CEASAR.` | 5 178 | dito | Overlay 4 → $5000–$7DCA und $8400–$977F |

Die Ladeadressen der Overlays im PRG-Header sind bedeutungslos: Die ersten fünf Bytes sind der Kopf des eigenen
Dekompressors (siehe 4.4).

---

## 4. Startkette und Packer ✔

Das Hauptprogramm ist **dreimal verpackt**:

1. **Schicht A** – BASIC-Stub `SYS 2061`. Der Stub initialisiert den C64, kopiert einen Relocator nach $03E0, schiebt
   die Daten von $0893 nach $0803 und springt in einen Dekompressor in der Stackseite ($0100). Dessen Signatur im
   Inneren: `6000 SYS(2082) FX BYTEPRESS (TPC)`. Er endet mit `JSR $FF81 / JMP $2A80`.
2. **Schicht B** – ein „Freezer“-ähnlicher Wrapper ab $2A80: Bildschirm leeren, `$2AE6` nach $033C kopieren, dann
   wird ein Speicherabbild ab $4030 nach $0801 zurückgeschoben, gefolgt von `JSR $A659 / JMP $A7AE` (BASIC-RUN).
3. **Schicht C** – derselbe Bytepress-Container nochmals; er entpackt das **Originalprogramm** und endet mit
   `JSR $FF81 / JMP $4000`.

### 4.1 Das Originalprogramm ab $4000

* Titelbild im Hires-Modus (`$D011` Bit 5, `$D018` → Bitmap $2000), Joystick-Titelmenü.
* Titelmenü (✔): Joystick **hoch/runter** wählt „Neues Spiel“ / „Spielstand laden“ (`$CFF5` = 0/1), Feuer bestätigt.
  Danach „Spielstärke“ 1–5 (hoch = niedriger, runter = höher; `$CFF4`, Anzeige 4 Zeichen breit `$20…$24`).
  Beim Laden wird ein Spielstandname (max. 9 Zeichen) ab $0350 gelesen.
* Lädt die Overlays in der Reihenfolge **1, 4, 2, 3** über einen eigenen Lader bei $9800 (SETNAM `"n.*"`, SETLFS, dann
  Dekompression direkt aus dem IEC-Datenstrom), kopiert danach Overlay-1-Daten in 96-Byte-Zeilen nach $D000–$FFFF
  (RAM unter I/O und KERNAL, dort liegt vermutlich Grafik/Zeichensatz, ○) und Teile von Overlay 2 nach $A800.
* Schreibt die Zeile `LOAD"HP      ",8` plus `SYS58784:RUN` in den Tastaturpuffer und startet damit das BASIC-Programm.
  Da `HP` nur bis $3909 reicht, überleben Maschinencode ab $4000 und alle Overlays.

### 4.2 Fastloader-Dekompressor ($9824)

Format (✔ durch Emulation bestätigt): Datei = Folge von Blöcken; jeder Block hat 5 Kopfbytes (nach `$FB…$FF`
geschrieben) und einen komprimierten Strom (Bit-Reader `$990F`, LZ-ähnliche Rückverweise). EOI nach dem Kopf beendet.
Das ist der Grund, warum die PRG-Header der Overlays „falsche“ Adressen enthalten.

---

## 5. Speicherbelegung zur Laufzeit

| Bereich | Inhalt | Sicherheit |
|---|---|---|
| $0801–$3909 | BASIC-Programm `HP` + Variablen | ✔ |
| $0341 + Y (Y = 1..4) | **Zielstamm-Slot** der Legion Y, gesetzt von der Karten-UI ($CDBC) | ✔ |
| $0350–$0358 | Spielstandname (9 Zeichen) | ✔ |
| $4000–$47FF | Titel, Lader, Titelmenü, Spielstärke-Auswahl | ✔ |
| $5000–$7DCA, $8400–$977F | Overlay 4 (Grafik-/Szenendaten) | ◐ |
| $7C1F + Slot | **Kartenfarbe je Stamm** (9 = Vertrag, 0 = Krieg, 7 = frei), von BASIC gesetzt | ✔ |
| $9100–$9360 | Legionsleiste: „1.–4. Römische Legion“, „Winterlager beziehen“ | ✔ |
| $9700–$9707 | Legionspositionen X[1..4] / Y[1..4] (Start 65 / 60) | ✔ |
| $9743 + Slot, $9761 + Slot | **Kartenkoordinaten x / y der 30 Stämme** (Slot 1..30) | ✔ |
| $9800–$98xx | Fastloader | ✔ |
| $A000–$CF8F → $D000–$FFFF | Overlay 1 und dessen Kopie unter ROM | ◐ |
| $C000–$CF12 | **Maschinencode-Bibliothek** (SYS-Einsprünge, siehe 6.2) | ✔ |
| $C109 (49929) | Parameter für Porträt-/Anzeigeroutinen (Haltung bzw. Moral) | ◐ |
| $C5B7 (50615) | **Ergebnisbyte** der Auswahlroutinen | ✔ |
| $CCF1 (52465) | Ergebnis der Speichern-Abfrage (1 = ja) | ✔ |
| $CFF4 / $CFF5 | Spielstärke SP / Flag „Spielstand laden“ | ✔ |

---

## 6. Architektur

```
Titel ($4000, Maschinencode) ──► lädt Overlays 1-4 ──► LOAD"HP" + RUN
                                                          │
HP (BASIC, Spiellogik) ◄── SYS-Aufrufe ──► Bibliothek $C000–$CF12 (Grafik, Joystick-Menüs, Szenen)
        │                                         │
   Variablen, Formeln,                      Ergebnisse über PEEK($C5B7), PEEK($0341+Y)
   Zufall (RND), Speichern (SEQ)
```

Die Arbeitsteilung ist sauber: **BASIC entscheidet, Maschinencode zeigt und fragt.** Jede Interaktion ist ein
`SYS`, dessen Ergebnis in einer festen Speicherzelle abgeholt wird. Für den Nachbau ist deshalb nur das BASIC-Programm
relevant.

### 6.1 BASIC-Variablen (✔)

| Variable | Bedeutung |
|---|---|
| `N$(1..30)` | Stammesnamen (alphabetisch) |
| `B(i)` | Volksgruppe 0 Belger, 1 Gallier, 2 Aquitaner, 3 Volcer |
| `BE(i)` | Bevölkerung (Krieger = ⌊BE/5⌋) |
| `BR(i)` | **Haltung** gegenüber Rom: 0 = Krieg … 10+ = Freund (nach oben offen) |
| `VT(i)` | Vertrag: 0 keiner, 1 Frieden, 2 Freundschaft |
| `GR(i)` | Geiseln in Rom |
| `EX(i)` | 1 = Stamm vernichtet |
| `TR(i)` | Jahrestribut in Denaren |
| `HI(i)` | Hilfstruppen (1000 bei Freundschaft) |
| `RK(i)`, `RS(i)` | Kriege gegen Rom / davon römische Siege |
| `AL(slot)` | Karten-Slot → Stamm-Nr. (Permutation 1..30) |
| `LE(1..4)` | Legionsstärke (max. 9000) |
| `MV(1..4)` | Moral 0–9 |
| `KL`, `SL` | Kämpfe / Siege der Legion |
| `RV` | Vermögen (max. 990 000) |
| `SP` | Spielstärke 1–5 |
| `KF` | Merker „Winterangriff im Vorjahr“ |
| `VS`, `GA` | zuletzt belagerter Stamm und seine verbliebenen Krieger |
| `VX`, `V(1..5)` | Verhandlungen und betroffene Stämme in diesem Jahr |

### 6.2 SYS-Einsprünge (◐ – Rolle aus dem BASIC-Kontext abgeleitet, Code nicht im Detail gelesen)

| SYS | Hex | Rolle |
|--:|---|---|
| 52668 | $CDBC | Karten-UI: Legion wählen und auf einen Stamm ziehen → `Y`=PEEK($C5B7) (5 = Winterlager), Ziel in $0341+Y |
| 52901 | $CEA5 | Legion zum Ziel animieren |
| 49553 | $C191 | Karte neu zeichnen (nutzt $7C1F-Farben) |
| 50623 / 51090 | $C5BF / $C792 | Stamm-Auswahl auf der Karte → `X`=PEEK($C5B7) |
| 50905 | $C6D9 | Verhandlungsmenü → `SA`=PEEK($C5B7) (1–8) |
| 51029 | $C755 | Infoanzeige mit Haltungsanzeige |
| 49499 / 49517 / 49535 | $C15B / $C16D / $C17F | Szenen: Lager, Rückzug, Kapitulation/Eroberung |
| 52375, 52262 | $CC97, $CC26 | Kampfbild („Römisches Reich gegen …“), Stärkeanzeige |
| 49617 / 49681 / 49802 / 50009 | $C1D1 / $C211 / $C28A / $C359 | Winterangriff, Jahresbericht, Rekrutierung, Legionsporträt |
| 52426 | $CCCA | Abfrage „Spielstand abspeichern? nein / ja“ |
| 50552 | $C578 | Niederlage-Szene |
| 51161 | $C7D9 | Sieg: „Gratulation“, `SCHLUSSBILD` von der Originaldiskette |

Joystick-Codes, die BASIC direkt aus `$DC00` (56320) liest: 126 hoch · 125 runter · 123 links · 119 rechts · 111 Feuer.

---

## 7. Spieldesign

### 7.1 Spielziel und Verlauf

Ein Spiel besteht aus Jahren. Es gibt kein Jahreslimit und keine Punktzahl; Sieg und Niederlage sind binär.
Jedes Jahr hat drei Teile: **Unruhe → Planung/Feldzug → Winterlager**.

```
Jahr beginnt ──► SP zufällige Stämme verlieren 1 Haltung (nicht bei Freunden)
     │
     ▼
Planungsphase (Karte, Joystick) ── beliebig oft, in beliebiger Reihenfolge:
   • Information über einen Stamm
   • Verhandlung (max. 5 pro Jahr, jeder Stamm 1×)
   • Legion verlegen / Stamm angreifen
   • „Winterlager beziehen“ beendet das Jahr
     │
     ▼
Winter: Angriffe feindlicher Stämme ► Jahresbericht (Einnahmen/Kosten) ► Rekrutierung je Legion
     │                                   └─ Kasse < 1 oder keine Soldaten ► NIEDERLAGE
     ▼
Speichern? ► nächstes Jahr
```

Sieg wird **sofort** geprüft: beim Betreten der Karten-UI und nach jedem Kampf sowie vor dem Jahresbericht.

### 7.2 Startwerte (✔)

| Wert | Normal (SP 1) |
|---|---|
| Legionen | 4 × 4500 Mann, Moral 5, Start im Lager (Karte 65,60 – außerhalb Galliens) |
| Vermögen | 30 000 Denare |
| Stämme | Daten aus Abschnitt 7.3 |

### 7.3 Die 30 Stämme (✔ Daten, ◐ Spielwert gemessen mit der Nachbau-Engine)

„Nr“ ist die alphabetische Nummer des BASIC. „Geschenk“ ist der Mindestbetrag, ab dem Haltung +2 bzw. +1 erzielt wird
(Formel 7.5). Die letzten Spalten zeigen, wie eine **frische 4500-Mann-Legion** in 2000 simulierten Gefechten abschneidet
(Kapitulation angeboten / Eroberung / Niederlage durch Flucht oder Aufreibung).

| Nr | Stamm | Volk | Bevölkerung | Krieger | Start-Haltung | Geschenk für +2 / +1 | Karte (x,y) | Kapitulation / Eroberung / Niederlage | Ø eigene Verluste |
|--:|---|---|--:|--:|--:|--:|---|---|--:|
| 1 | Allobroger | Volcer | 154.392 | 30.878 | 6 | 22.057 / 7.353 | 52,56 | 0 % / 0 % / 100 % | 3.419 |
| 2 | Arverner | Gallier | 114.953 | 22.990 | 4 | 22.991 / 7.664 | 43,49 | 0 % / 0 % / 100 % | 3.398 |
| 3 | Aulercer | Gallier | 110.424 | 22.084 | 3 | 27.607 / 9.203 | 19,21 | 0 % / 0 % / 100 % | 3.373 |
| 4 | Bellovacer | Belger | 256.230 | 51.246 | 2 | 85.411 / 28.471 | 26,9 | 0 % / 0 % / 100 % | 3.391 |
| 5 | Bituriger | Gallier | 154.022 | 30.804 | 5 | 25.671 / 8.557 | 25,32 | 0 % / 0 % / 100 % | 3.391 |
| 6 | Cadurcer | Gallier | 61.430 | 12.286 | 8 | 6.826 / 2.276 | 16,53 | 100 % / 0 % / 0 % | 1.109 |
| 7 | Carnuten | Gallier | 54.063 | 10.812 | 7 | 6.759 / 2.253 | 37,28 | 100 % / 0 % / 0 % | 980 |
| 8 | Eburonen | Belger | 34.912 | 6.982 | 3 | 8.729 / 2.910 | 63,5 | 100 % / 0 % / 0 % | 637 |
| 9 | Haeduer | Gallier | 56.432 | 11.286 | 9 | 5.644 / 1.882 | 43,35 | 100 % / 0 % / 0 % | 1.016 |
| 10 | Helvetier | Gallier | 209.125 | 41.825 | 0 | 209.127 / 69.709 | 63,34 | 0 % / 0 % / 100 % | 3.388 |
| 11 | Lemovicer | Gallier | 36.434 | 7.286 | 6 | 5.206 / 1.736 | 20,41 | 100 % / 0 % / 0 % | 662 |
| 12 | Leucer | Gallier | 56.234 | 11.246 | 7 | 7.030 / 2.344 | 61,12 | 100 % / 0 % / 0 % | 1.013 |
| 13 | Lexovier | Gallier | 34.054 | 6.810 | 3 | 8.514 / 2.838 | 13,15 | 100 % / 0 % / 0 % | 625 |
| 14 | Lingonen | Gallier | 66.403 | 13.280 | 6 | 9.487 / 3.163 | 54,22 | 12 % / 0 % / 88 % | 3.218 |
| 15 | Melder | Belger | 95.215 | 19.043 | 3 | 23.805 / 7.935 | 46,13 | 0 % / 0 % / 100 % | 3.393 |
| 16 | Menapier | Belger | 48.430 | 9.686 | 3 | 12.108 / 4.036 | 46,1 | 100 % / 0 % / 0 % | 875 |
| 17 | Moriner | Belger | 126.800 | 25.360 | 3 | 31.701 / 10.567 | 29,7 | 0 % / 0 % / 100 % | 3.406 |
| 18 | Osismer | Gallier | 55.363 | 11.072 | 3 | 13.842 / 4.614 | 6,19 | 100 % / 0 % / 0 % | 993 |
| 19 | Pictonen | Gallier | 87.056 | 17.411 | 5 | 14.510 / 4.837 | 0,31 | 0 % / 0 % / 100 % | 3.402 |
| 20 | Remer | Belger | 136.781 | 27.356 | 10 | 12.435 / 4.145 | 39,10 | 0 % / 0 % / 100 % | 3.408 |
| 21 | Rutener | Volcer | 95.430 | 19.086 | 4 | 19.087 / 6.363 | 30,64 | 0 % / 0 % / 100 % | 3.425 |
| 22 | Santonen | Gallier | 96.043 | 19.208 | 5 | 16.008 / 5.336 | 5,40 | 0 % / 0 % / 100 % | 3.383 |
| 23 | Senonen | Gallier | 34.025 | 6.805 | 4 | 6.806 / 2.269 | 48,23 | 100 % / 0 % / 0 % | 628 |
| 24 | Sequaner | Gallier | 136.460 | 27.292 | 6 | 19.495 / 6.499 | 64,26 | 0 % / 0 % / 100 % | 3.401 |
| 25 | Sotiaten | Aquitaner | 123.045 | 24.609 | 3 | 30.762 / 10.254 | 11,58 | 0 % / 0 % / 100 % | 3.431 |
| 26 | Treverer | Gallier | 49.203 | 9.840 | 4 | 9.841 / 3.281 | 69,16 | 100 % / 0 % / 0 % | 892 |
| 27 | Uneller | Gallier | 87.546 | 17.509 | 3 | 21.887 / 7.296 | 7,13 | 0 % / 0 % / 100 % | 3.397 |
| 28 | Veneter | Gallier | 67.334 | 13.466 | 1 | 33.668 / 11.223 | 0,21 | 5 % / 0 % / 95 % | 3.336 |
| 29 | Vocater | Aquitaner | 79.645 | 15.929 | 3 | 19.912 / 6.638 | 0,49 | 0 % / 0 % / 100 % | 3.433 |
| 30 | Vocontier | Volcer | 120.323 | 24.064 | 6 | 17.190 / 5.730 | 47,64 | 0 % / 0 % / 100 % | 3.409 |

Karte: Raster 0–69 × 0–64, Norden oben, Westen links (✔ geografisch plausibel: Bretagne links, Narbonensis unten).
Die Karten-Slots (1..30) sind eine Permutation der alphabetischen Nummern; die Zuordnung steht in `analysis/tribes.json`.

**Designerkenntnis:** Rund 13 der 30 Stämme (Bevölkerung unter ca. 66 000) sind für eine Startlegion militärisch
erreichbar. Alle größeren sind per Gewalt kaum zu halten und müssen **diplomatisch** gewonnen werden – das erklärt
die Geldzuwendungen, deren Preis mit Bevölkerung wächst und mit guter Haltung sinkt.

### 7.4 Haltung, Verträge, Unruhe (✔)

Haltung `BR` steuert alles. Bezeichnungen in der Infoanzeige: >10 freundschaftlich · >7 wohlgesonnen · >3 neutral ·
>0 feindselig · 0 kriegerisch. Die Skala ist nach oben **nicht begrenzt**.

* **Normalisierung:** Fällt `BR` unter 1 → `BR=0`, Vertrag und Tribut erlöschen. Fällt `BR` unter 11 → ein
  Freundschaftsvertrag (VT=2) erlischt samt Hilfstruppen.
* **Jahresunruhe:** Zu Jahresbeginn (nicht im ersten Jahr) werden `SP` Stämme zufällig gewählt (Wiederholung möglich).
  Haben sie `VT<2`, sinkt `BR` um 1. Friedensverträge (VT=1) sind daher **nicht dauerhaft**; nur Freundschaft schützt.
* **Aufruhr der Volksgruppe:** Mehrere Aktionen senken die Haltung aller *anderen* Stämme derselben Volksgruppe um 1:
  Angriff auf einen Stamm mit `BR>3`, jede Eroberung, Beute über der Hälfte, Geiseln über 10 %, Hinrichtung von Geiseln.
  Vollständige Vernichtung eines Stamms senkt die Haltung **aller** Stämme um 2.

### 7.5 Verhandlungen (✔)

Maximal **5 pro Jahr**, jeder Stamm höchstens einmal, vernichtete Stämme nicht. Nicht erlaubte Aktionen kosten keinen Versuch.

| Aktion | Voraussetzung | Wirkung | Ergebnis |
|---|---|---|---|
| Freundschaftsvertrag | `BR>10`, `VT<2` | `VT=2`, `HI=1000` | erfolgreich |
| Geldzuwendung | – | Betrag `a` ≤ RV zahlen. `a > ⌊(BE+1)/(BR+1)⌋` → `BR+2`; sonst `a > ⌊(BE+1)/3/(BR+1)⌋` → `BR+1`; sonst nichts | höchst erfolgreich / erfolgreich / erfolglos |
| Konferenz | `BR>7` | 50 %: `BR+1` | erfolgreich / erfolglos |
| Geiseln freilassen | `BR>0`, `GR>0` | `BR+2`, `BE+=GR`, `GR=0` | höchst erfolgreich |
| Tribut erlassen | `BR>0`, `TR>0` | `TR=0`, `BR+2` | höchst erfolgreich |
| Tribut erhöhen | `TR<4000` | `BR−4`, `TR+2000` | **„katastrophal“** (Text), aber Geld |
| Geiseln hinrichten | `GR>0` | `GR=0`, `BR=0`, Aufruhr der Volksgruppe | katastrophal |
| Keine Verhandlung | – | – | – |

Nach jeder Verhandlung gilt die Normalisierung aus 7.4.

### 7.6 Legionen und Zugsystem (✔)

* Es gibt **keine Zugbegrenzung**. Eine Legion wird auf einen Stamm gezogen; ist er frei (`VT=0`, nicht vernichtet) und
  die Legion nicht leer, kann sie angreifen oder „weiterziehen“ (Stellung beziehen, kein Kampf). Bei Friedensvertrag
  bzw. vernichtetem Stamm wird der Angriff abgewiesen, die Legion bezieht trotzdem Stellung.
* Der Standort hat sonst **keine mechanische Wirkung**.

### 7.7 Kampfsystem (✔)

Beim Angriff:

1. War der Stamm bei `BR=0` schon im Krieg → `KF=0`.
2. Gegnerstärke `G = ⌊BE/5⌋`, oder – wird derselbe Stamm unmittelbar wieder angegriffen – die **verbliebene** Stärke
   `GA` (kein Heilen). `RO` = Stärke der Legion.
3. Bei `BR>3`: Aufruhr der Volksgruppe (7.4). Dann `BR=0`, `VT=0`, `TR=0` (Krieg).

Eine Runde (ca. 0,1–0,2 s sichtbar, Feuerknopf = Rückzug):

```
ID = RO*3 − GA
ID < −800 :  GA −= rnd(150)+20 ;  RO −= rnd(150)+20      (Gallier weit überlegen)
ID >  500 :  GA −= rnd(300)+20 ;  RO −= rnd(50)+20       (Römer weit überlegen)
sonst     :  GA −= rnd(150)+20 ;  RO −= rnd(50)+20
```

Danach, in dieser Reihenfolge:

| Bedingung | Folge |
|---|---|
| `GA < 201` | **Eroberung** (7.8) |
| `KA=0` und `G−GA > G/3` | **Kapitulationsangebot** (einmal; Ablehnen setzt `KA`, danach nie wieder) |
| `R−RO > R/2` | Römer fliehen: `RF=rnd(RO)` gehen verloren; ist dann `RO<101` → Niederlage |
| `RO < 101` | Niederlage (`RO=0`) |
| sonst | nächste Runde |

Feuerknopf: Rückzug, `RF = rnd(RO/3)` gehen verloren, Folge: Niederlage (Moral −1).

Bei **jedem** Ergebnis wird `BE −= (G−GA)` gebucht. Da das auch beim Kapitulationsangebot passiert und bei Ablehnung
später erneut, zählt das Original Bevölkerungsverluste **mehrfach** (✔ wirkt sich nur auf Bevölkerung/Geiseln aus).

### 7.8 Kapitulation und Eroberung (✔)

**Kapitulation annehmen:** `BR=5`, `VT=1`, Vermögen `+⌊BE/2⌋`, Geiseln `⌊BE/10⌋` (`GR+=…`, `BE−=…`), `TR=1000`.

**Eroberung** (nur wenn die Kapitulation abgelehnt wurde): Aufruhr der Volksgruppe; dann Auswahl per Ziffernanzeige:

* **Beute** bis `⌊BE·2,3⌋` Denare; über der Hälfte → erneuter Aufruhr der Volksgruppe.
* **Geiseln** `0…BE`:
  * alle (`=BE`) → Stamm **vernichtet** (`EX=1`, `BR=1000`, `VT=1`) und **alle anderen** Stämme `BR−2`.
  * über 10 % → erneut Aufruhr der Volksgruppe.
  * sonst `GR+=g`, `BE−=g`, `BR=4`, `VT=1`, `TR=500`.

Ein Stamm im Zustand `VT=1` zählt für den Sieg – auch ein vernichteter.

### 7.9 Nach dem Gefecht: Moral und Sold (✔)

Siegreiche Legion: Moral `+1` (max. 9), `RS(Stamm)+1`, `SL+1`. Unterlegen: Moral `−1` (min. 0). Immer: `RK+1`, `KL+1`,
Stärke `−(R−RO)`, Legion steht beim Stamm.

Dann entscheidet der **Sold** `a` (aus RV, ≤ RV) über die Moral, relativ zur Legionsstärke `L` nach Verlusten:

| Sold | Moral |
|---|---|
| `a < 0,5·L` | −2 |
| `a < 1,1·L` | −1 |
| `a < 2,1·L` | ±0 |
| `2,1·L ≤ a ≤ 3,1·L` | ±0 |
| `a > 3,1·L` | +1 (max. 9) |

Die Moral begrenzt die Rekrutierung (7.10), ansonsten hat sie keine Kampfwirkung.

### 7.10 Winterlager und Jahresabschluss (✔)

1. **Winterangriff:** Gibt es Stämme mit `BR<1` (im Krieg, nicht vernichtet), greifen sie die Legionen an. Pro Legion
   `Verlust = rnd(Anzahl·600)`. Gesamtverlust < 2000 „gering“, > 4000 „gewaltig“, sonst „groß“. War `KF` bereits 1 (auch im
   Vorjahr Angriffe), sinkt zusätzlich die Haltung aller anderen Stämme um 1 (**Unmut bei Dauerkrieg**). Es werden bis zu 14 Namen genannt.
2. **Haushalt:** `Gesamt = RV + Σ Tribute − ⌊Σ Soldaten / 2⌋` (max. 990 000). Ist die Summe der Soldaten 0 oder
   `Gesamt < 1` → **Niederlage**.
3. **Verstärkung** je Legion: Hilfstruppen `H = Σ HI / 4` kommen automatisch. Freiwillige `≤ Moral·250` und `≤ 9000 − L − H`
   können gewählt werden (kein Geld nötig). Ist `L+H > 8999`, wird auf 9000 aufgefüllt.
4. Speichern-Abfrage, dann nächstes Jahr.

### 7.11 Spielstärke (✔)

| SP | Wirkung beim Start | Unruheherde/Jahr |
|--:|---|--:|
| 1 | Normal | 1 |
| 2 | alle Haltungen −1 (Minimum 0) | 2 |
| 3 | Legionen nur 2500 Mann | 3 |
| 4 | Vermögen nur 8000, Haltungen −1 | 4 |
| 5 | Haltungen zufällig 0–5 (Remer fest 10), Vermögen 50 000 | 5 |

### 7.12 Speichern und Laden (✔)

Auf einer separaten **Datendiskette** als sequentielle Datei (Name = Spielstandname, `@:`-Überschreiben): je Stamm
`BR,BE,VT,GR,EX,RK,RS,TR,HI`, danach Name, `RV`, `SP`, je Legion `LE,MV,KL,SL,PX,PY`. Die Daten sind
CSV-artige Textzeilen (leicht zu inspizieren).

### 7.13 Bedienkonzept (✔/◐)

Alles per Joystick (Port 2). Planungsmenü: **hoch + Feuer = Information**, **Feuer = Verhandlung**,
**runter + Feuer = Weiter** (Legionen). Zahleneingaben (Geld, Beute, Geiseln, Rekruten) erfolgen mit einer sechsstelligen
Ziffernanzeige: links/rechts wählt die Stelle, hoch/runter ändert die Ziffer, Feuer bestätigt. Auf der Karte stehen vier
Legionssymbole plus eine fünfte Marke „Winterlager beziehen“.

---

## 8. Beobachtungen: Eigenheiten, Fehler, Balance

Alles ✔ aus dem Code abgelesen.

1. **Eroberung verlangt meist die Ablehnung der Kapitulation.** Bei einem frischen Stamm kommt das Angebot (ab 1/3 Verlust)
   immer vor `GA<201`; eine Eroberung gibt es dann nur, wenn man es ausschlägt. Direkt erobert wird nur ein bereits
   geschwächter Stamm (Folgeangriff mit `G=GA`), weil `GA<201` vor dem Kapitulationsangebot geprüft wird.
2. **Kumulative Bevölkerungsverluste** (7.7): Bei abgelehntem Angebot zählt der Verlust doppelt.
3. **Tribut ohne Krieg:** „Tribut erhöhen“ ist bei Stämmen ohne Vertrag erlaubt: `TR+2000` sofort, `BR−4`. Bei `BR≥5`
   (z. B. Allobroger, Haeduer) bleibt der Tribut bestehen und bringt 2000 Denare/Jahr, bis die Jahresunruhe den Stamm unter 1 drückt.
4. **Unbegrenzte Aktionen:** Angriffe pro Jahr sind unbegrenzt; Kosten sind nur Verluste, Moral und der nächste Winter.
5. **Haltung unbegrenzt:** Geldgeschenke addieren ohne Deckel; das Skalenmaximum 10 wird nur im Text benutzt.
6. **Vernichtete Stämme zählen als befriedet** und sind der schnellste Weg zum Sieg, aber teuer (alle Haltungen −2).
7. **Negative Legion möglich:** Vor der Klammerung `RO<101` kann `RO` kurz negativ werden, wenn die Eroberung zuerst greift;
   dann ist `R−RO > R`. Das Original schützt nicht davor (der Nachbau begrenzt auf 0).
8. **Variable `X` global:** Im Winter nutzt der Dauerkrieg-Unmut den *zuletzt irgendwie gewählten* Stamm als Ausnahme.
9. **Schreibfehler im Original:** „FREUNSCHAFTSVERTRAG“. Das Wort „SOLD“ in der Legionstabelle bezeichnet die Zahlungsabfrage.
10. **Spielstärke 5** ist trotz „mehr Geld, zufällige Haltung“ am härtesten (5 Unruheherde/Jahr).
11. **Verlust-Ende** („Sie haben es geschafft, … das Ansehen des Römischen Reiches zu ruinieren … und den Namen Gaius Julius
    Caesar aus den Geschichtsbüchern zu tilgen!“) ist ironisch formuliert; Sieg zeigt `SCHLUSSBILD` von der Originaldiskette.
12. Der Moral-Effekt ist **rein wirtschaftlich** (begrenzt Freiwillige, Moral × 250); im Gefecht spielt sie keine Rolle.

---

## 9. Nachbau (`remake/`)

* **Engine** (`engine.js`): reine Logik mit denselben Formeln, Reihenfolgen und Schwellen wie das Original (Variablennamen
  und BASIC-Zeilen in den Kommentaren). Lauffähig in Node und Browser.
* **UI** (`index.html`): SVG-Karte mit den echten Stammespositionen, eigene Grafik, Joystick-Menüs ersetzt durch Klicks;
  Speichern/Laden im Browser (localStorage).
* **Tests** (`node remake/test.js`): Assertions auf die Formeln (Spielstärken, Geschenkschwellen, Sold, Haushalt,
  Rekrutierung) und 1000 Bot-Spiele als Rauchtest. Ein reiner Angriffsbot verliert immer – ein Hinweis, dass Diplomatie
  gebraucht wird.

Bewusste Abweichungen:

| Original | Nachbau |
|---|---|
| keine Jahreszahl | „Jahr N“ als Anzeige |
| Bevölkerungsverlust kumulativ | identisch (Original-Eigenheit beibehalten) |
| Legion kann negativ werden | auf 0 begrenzt |
| Joystick-Ziffernanzeige | Zahlenfeld mit 0 / ½ / Max |
| Spielstand auf Datendiskette | `localStorage`, Autosave im Winter |
| Pixelgrafik, Titelbild | eigene Vektorkarte (keine Originalassets) |

Ideen für spätere Versionen: Jahreszähler mit historischen Ereignissen (58–50 v. Chr.), Karte mit Flüssen und
Straßen, Legionsmarsch mit Zeitkosten, Ton, Mehrspieler im Spielrunde-Stil.

---

### 9.1 Komfort-Regeln und Balance (nicht im Original)

Beim Spielen des Nachbaus zeigte sich, dass das Original sehr hart ist: Es gibt **keinen direkten Nachschub** (nur Winter-Freiwillige
bis Moral × 250), und Riesenstämme zerschlagen jede einzelne Legion. Der Nachbau bietet deshalb beim Start die wählbare Komfort-Regel
**Söldner anwerben** (3 Denare pro Mann, jederzeit, bis 9000 Mann). Außerdem zeigt der Angriffsdialog eine **Lageeinschätzung**
(Simulation auf einer Kopie des Spielstands), und nach einem abgebrochenen Angriff können **weitere Legionen nachrücken**. Letzteres
nutzt nur die Originalmechanik: Die Restkrieger (`VS`/`GA`) heilen innerhalb des Jahres nicht.

Gemessene Eckwerte (✔ per Engine):

* Kapitulation wird angeboten, sobald der Gegner ⅓ seiner (Rest-)Stärke verloren hat. Ab ca. 66 000 Einwohnern kippt der Kampf in den
  1:1-Austausch; die römische Legion flieht nach 50 % Verlust. Helvetier (41 825 Krieger) und Bellovacer (51 246) sind deshalb mit
  vier Legionen nicht zu zwingen; ihre Bevölkerung sinkt pro gefallenem Krieger nur um 1, die Kriegerzahl also um ⅕.
* Alle 30 Stämme rein diplomatisch auf Freundschaft zu bringen kostet rund **1,0 Mio. Denare** (Helvetier 210 000, Bellovacer 130 000,
  Moriner/Sotiaten je ca. 50 000, die 13 kleinen Stämme je 4 000–22 000). Das Vermögen ist bei 990 000 gedeckelt.
* Geld kommt aus Kapitulationen (½ Bevölkerung), Beute (bis 2,3 × Bevölkerung) und Tributen.
* Ein Strategie-Bot (`remake/strategy-bot.js`: erobert kleine Stämme, hält die Feindschaft ruhig, verschenkt Geld, verbündet) gewinnt
  **nie**: Er gerät in eine Armutsfalle mit dauerhaft ca. 8 feindlichen Stämmen, deren Winterüberfälle (je Legion bis zu
  Anzahl × 600 Mann) mehr Soldaten kosten, als nachwachsen. Mit Söldnern überlebt er statt 9 im Schnitt 35 Jahre, kommt aber nur auf ca. 12–13
  befriedete Stämme. Eine bewiesene Gewinnstrategie gibt es also noch nicht; die Taktiktipps im Spiel sind abgeleitete Regelkenntnis.

## 10. Offen / nicht untersucht (○)

* **Sprites** (Karten-Legionen) und die Titelmusik/Ton: nicht untersucht. Die Szenen- und Titelgrafik ist dekodiert (Abschnitt 12).
* Die SYS-Routinen wurden nur anhand ihres Aufrufkontexts klassifiziert; ihr Innenleben (Joystick-Entprellung, Cursorführung
  der Karte, Animationen) ist nicht dokumentiert.
* Ton: Das SID wird am Programmstart gelöscht; Musik wurde nicht gefunden.
* Die Pixelwerte der Kartenkoordinaten (Einheit der Tabellen $9743/$9761) wurden nicht in Bildschirmpixel umgerechnet.

---

## 11. Anhang: Entpacken im Detail (zur Nachvollziehbarkeit)

| Stufe | Einsprung / Ergebnis |
|---|---|
| Relocator | $03E0 (0x48 Byte aus $084B) verschiebt Daten $0893 → $0803, `JMP $080B` kopiert $7DFD → $00CB…, `JMP $0100` |
| Bytepress A | läuft ≈1,53 Mio. Schritte, endet mit `JSR $E3BF`, `JMP $0822` |
| Bytepress B | $0822 … $0517: `JMP $033C` → `JSR $FF81 / JMP $2A80` |
| Freezer-Wrapper | $2AE6 → $033C: $4030 → $0801 (≈ 0,85 Mio. Schritte) |
| Bytepress C | ≈1,30 Mio. Schritte, dann `JSR $FF81 / JMP $4000` |
| Overlays | Fastloader $9824; ACPTR ($EE13) wird aus der Datei gespeist |

Die Rohdaten aller Stufen stehen nach `python3 tools/reverse.py` in `analysis/`.

---

## 12. Grafikformat (✔ dekodiert)

* **Titelbild** (römische Stadt mit Kolosseum) und **Schlussbild** (`SCHLUSSBILD`, Triumphbogen, Text „Sieg über Gallien! Ave, Caesar! …“):
  Hires-Bitmaps 320×200 bei $2000. Das Schlussbild wird vom Fastloader-Dekompressor ($9824) nach $2000 entpackt.
* **Szenenbilder** (Legionär, Caesar, Reiter, Senator, Zenturio, Standarten): 144×200 px, Schwarz auf einfarbigem Hintergrund
  ($D021 je Szene). Sie bestehen aus 450 Kacheln und nutzen zwei Zeichensätze: $A000 für die obere und $A800 für die untere
  Bildhälfte; der Raster-IRQ ($C06C, Splitzeile in $C005) schaltet `$D018` um. VIC-Bank 2 (`$DD00=$C5`), Bildschirm $8000, Farb-RAM schwarz.
* Zusammengesetzt werden die Bilder durch Blit-Routinen ($C006, $C02F) aus Quelldaten bei $D000–$FFFF (Overlay 1, dorthin kopiert).
* Reproduzierbar mit `python3 tools/scenes.py` (erzeugt `analysis/gfx/`).
* Der Nachbau nutzt photorealistische Neuinterpretationen dieser Motive (`remake/assets/`, erzeugt mit ChatGPT).

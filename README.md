# Julius Caesar (C64, 1989) – Reverse Engineering und Nachbau

* **[DESIGN.md](DESIGN.md)** – Designdokument: Dateiformat, Packer, Speicherkarte, vollständige Spielregeln mit Formeln,
  Daten der 30 Stämme, Eigenheiten des Originals.
* **tools/** – Analyse-Werkzeuge (nur Python 3, keine Abhängigkeiten): `python3 tools/reverse.py JULIUS-D.D64 analysis/`
* **analysis/** – Ausgaben der Analyse (entpackter Speicher, BASIC-Listing, Grafiken). Wird lokal von `tools/reverse.py` und `tools/scenes.py` erzeugt und ist nicht Teil des Repositorys.
* **remake/** – spielbarer Nachbau. Starten: `cd remake && python3 -m http.server 8137` und <http://localhost:8137> öffnen.
  Tests: `node remake/test.js`.

**Spielen:** <https://popesick.github.io/julius-caesar/>

Das Originalspiel gehört seinen Rechteinhabern; das Repository enthält keine Originaldaten. Der Nachbau verwendet nur Spielregeln und Zahlen (Fakten) aus der
Analyse; Code ist neu geschrieben. Die Bilder in `remake/assets/` wurden mit ChatGPT als photorealistische Neuinterpretationen
von Szenen des Originals erzeugt. Musik ist ein Platzhalter (`remake/music.js`).

# Pokémon with friends – freies HeartGold-Fangame v0.3

Eigenständiger Offline-RPG-Prototyp für Android / BlueStacks. Johto und Kanto sind frei zugänglich; es gibt keine Story- oder Ordenssperren. Die bereitgestellte private APK enthält das Datenpaket bereits. Öffentliche GitHub-Builds enthalten ausschließlich den Quellcode und die Oberfläche und brauchen den einmaligen Import eines privaten Weltpakets.

## Spielen

- Aus 170 Trainerfiguren wählen; jede Figur hat Laufbilder in vier Richtungen.
- Eine der 493 Pokémon-Arten als Partner wählen, Start vor dem Spielerhaus in Neuborkia.
- Mit WASD, Pfeiltasten oder gehaltenem Steuerkreuz laufen. **E / Enter / A** öffnet Türen bzw. Interaktionen. Originale Warp-Koordinaten und Routengrenzen verbinden die importierten Karten.
- **Karte** bietet freie Schnellreise in Städte, auf Routen und in Höhlen. Suchbegriffe finden auch Innenräume. Keine Arena muss vor einer anderen abgeschlossen werden.
- Wilde Begegnungen verwenden die HeartGold-Tabellen nach Tageszeit. **Pokédex → Freie Begegnung** macht zusätzlich jede Art ohne Story- oder Tauschzwang fangbar.
- Einzelkämpfe mit vier Attacken, AP, Initiative, Priorität, Gen-IV-Typen, Volltreffern, Statuswerten, wichtigen Statusproblemen, Erfahrung, Levelaufstieg und grundlegenden Entwicklungen. Trainerteams und die 16 Arenaleiter stammen aus der ROM.
- Pokébälle und Fangversuche; volle Teams schicken Fänge in die erste freie Box. Sechs Teamplätze und 18 Boxen mit je 30 Plätzen. Ein kampffähiges Pokémon bleibt im Team.
- Beutel, Kaufen/Verkaufen, Heilmittel, TMs/VMs, getragene Items und ein zusätzliches Link-Kabel für Tauschentwicklungen. Der freie Markt enthält importierte käufliche Items; Preise bleiben erhalten.
- **A / Menü → Pokécenter & Markt** stellt Ortsdienste in Städten/Innenräumen bereit. Das Pokécenter heilt KP, AP und Status kostenlos. PC-Zugriff ist im freien Modus auch über das Menü möglich.
- Die 16 Orden werden für Siege gegen die jeweiligen Originalteams vergeben. Kämpfe können wiederholt werden.
- Automatischer lokaler Spielstand; JSON-Sicherungen können über das Android-Dateimenü exportiert und importiert werden. Spielstände werden beim Import auf beschädigte Pokémon, doppelte Identitäten und ungültiges Inventar geprüft.

## Grenzen dieser Version

Dies ist eine eigene freie Spiel-Engine, kein ausgeführtes Originalspiel und keine vollständige Nachbildung aller HeartGold-Regeln. Originale Story-Skripte, Rätsel, bewegte Kartenmechanik, Doppelkämpfe und Multiplayer laufen nicht. Karten werden als feste Ansichten aus Original-Meshes und -Texturen vorgerendert; animierte/skinnierte Dekoration verwendet eine statische Pose. NPCs dienen als freie Interaktionspunkte; ihre Originalereignisse werden nicht ausgeführt. Einige dynamische Warps sind nur über Schnellreise ersetzbar.

Nicht alle Spezialeffekte der 467 Attacken, 123 Fähigkeiten und 537 Itemeinträge sind implementiert. Nicht unterstützte Statusattacken melden dies im Kampflog. Gehaltene Items und komplexe Entwicklungsbedingungen sind nur teilweise umgesetzt. Beim Levelaufstieg ersetzt eine fünfte Attacke die älteste; im Team-Menü lassen sich verfügbare Level-Attacken kostenlos erneut lernen. Services und freie Begegnungen sind bewusste Sandbox-Funktionen.

## Privates Datenpaket erstellen

```sh
python -m pip install numpy pillow
python tools/import_world.py /pfad/HeartGold.nds /privat/HeartGold-Welt
```

Ein ZIP mit einer `.nds` wird ebenfalls akzeptiert. Unterstützt wird die deutsche 128-MiB-ROM (`IPKD`). Der Importer liest Pokémon, Attacken, Items, Wachstumskurven, Begegnungen, Trainer, Grafiken, Modelle, Kollisionen und Warp-Daten. Er importiert 656 aktive Kartenabschnitte mit 644 unterschiedlichen gerenderten Kombinationen. Die Format-/Indexzuordnung in `tools/hg_index.json` folgt `pret/pokeheartgold`; Spieltexte und Grafiken werden aus der bereitgestellten ROM gelesen.

Die Ausgabe wird als `<Ausgabeordner>.pwf.zip` gespeichert. `import-report.json` weist jeden Importfehler explizit aus. Erfolgreiche Kartenbilder werden bei Wiederholung wiederverwendet. Nichts wird vom Importer hochgeladen. ROM und alle Ausgabedateien außerhalb des öffentlichen Repositories halten.

Für einen privaten Build das fertige Weltpaket vor dem Build nach `app/src/main/assets/world.pwf.zip` kopieren; dieser Pfad ist gitignored. Die Android-App kopiert das Paket bei der ersten Verwendung in ihren privaten Speicher und liest Bilder bedarfsweise aus dem ZIP. Die App besitzt keine Netzwerkberechtigung.

## Prüfen / Bauen

```sh
node --test tools/test_engine.cjs
node --check app/src/main/assets/game/game.js
python -m unittest discover -s tools -p 'test_*.py'
gradle --no-daemon assembleDebug
```

GitHub Actions baut die APK mit Java 17, Gradle 8.9 und SDK 35. Ein Android-Emulatortest verwendet ein ausschließlich synthetisches, urheberrechtsfreies Paket, um die echte WebView, native Dateirouten, Starterauswahl, Team, Pokécenter und Spielstandbrücke zu prüfen. Das Testpaket enthält keine ROM-Ressourcen. Lizenzhinweise: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

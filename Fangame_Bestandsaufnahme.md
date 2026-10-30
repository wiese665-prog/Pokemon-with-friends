# Projektprüfung – Pokemon with friends

Prüfdatum: 2026-10-30

## Status der Dateien

- **HeartGold (Deutsch):** lokal hochgeladene ZIP enthält `Pokemon - Goldene Edition HeartGold (Germany).nds` (134217728 Bytes); NDS-Header Titel `POKEMON HG`, Gamecode `IPKD`. Nicht ins öffentliche Repository übertragen.
- **SoulSilver:** keine entsprechende NDS-Datei vorliegend.
- **Pokémon Silber:** hochgeladene ZIP enthält `Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible).gbc` (2097152 Bytes). Das ist die ältere Game-Boy-Color-Edition, **nicht** SoulSilver.
- **Smaragd:** in GitHub eine ZIP-Datei mit 350 Bytes – voraussichtlich kein Spielinhalt.
- **Feuerrot:** in GitHub `Pokemon - FireRed Version (USA).zip` – als USA-Version gekennzeichnet.
- **Blattgrün:** in GitHub `Pokemon - Blattgruene Edition (Germany).zip` – als Deutschland-Version gekennzeichnet.

## Fangame-Asset-Check

Eine ROM-Datei enthält zwar gepackte Spieldaten, stellt aber **keine sofort verwendbare Sammlung aller freigegebenen Assets** dar. Für ein eigenständiges Fangame sind folgende Kategorien separat zu prüfen bzw. neu zu erstellen:

- Pokémon-Daten, Formen, Fähigkeiten, Typen, Moves, Entwicklungen
- Front-/Backsprites, Overworld-Sprites, Animationen und Paletten
- Tilesets, Kartenlayout, Kollisionsdaten, Warp-/Eventdaten
- NPCs, Trainer, Kämpfe, KI, Dialoge
- Effekte, Partikel, VFX, UI und Menüs
- Musik, Sounds, Schreie und Audioformate
- Engine, Map-Editor, Asset-Importpipeline, Save-System und Mehrspieler-Synchronisation
- Rechte/Lizenzen für jede verwendete Ressource

**Ergebnis:** Vollständigkeit für ein Fangame noch nicht bestätigt. Nur Dateinamen, Größen und Header der beiden lokal bereitgestellten Archive sowie Dateilisten auf GitHub wurden geprüft. Dies ist keine vollständige Extraktion oder Validierung aller Spielressourcen.

Original-ROM-Dateien und Nintendo-/Pokémon-Grafiken oder Tondateien nicht ohne entsprechende Rechte in ein öffentliches Repository hochladen.

## Implementiert am 31.10.2026

Die hier angehängte deutsche HeartGold-ROM wurde für einen privaten Neuborkia-Datenimport verwendet. `tools/import_heartgold.py` liest Kartenblock 0, Texturset 2, 17 platzierte Modelle und acht animierte Trainer aus der ROM. Die Android-App importiert das private Datenpaket und verwendet Original-Kollisionsdaten, eine vorgerenderte Kartenansicht sowie eine Tiefenkarte für verdeckte Figuren. ROM und extrahierte Daten sind nicht Bestandteil des öffentlichen Quellcodes. Vollständige 3D-Laufzeitdarstellung, Story, Kämpfe, Innenräume und Mehrspieler sind weiterhin nicht implementiert.

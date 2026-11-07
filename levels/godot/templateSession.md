# Frontlines Templates – Session-Notizen

Dokumentiert, wie `frontlines_3sector.tscn`, `frontlines_5sector.tscn` und `frontlines_7sector.tscn` entstanden sind und welche Regeln gelten. Gedacht für Agents in zukünftigen Sessions.

## Quelle

- Extrahiert aus `levels/godot/MP_Atoll_frontlines.tscn` (nur Frontlines-Nodes).
- Die Templates sind eigenständig gebaut und per Drag & Drop in andere Portal-Maps ziehbar.
- Keine Godot-Engine im Repo verfügbar: keine Parse-Prüfung durch den Editor.
- Validierung: `/tmp/validate_frontlines.py` (nicht im Repo) prüft Node-Pfade und Links (79/133/187 Links geprüft). Bei Neuaufbau erneut schreiben.

## Layout-Regeln

- Sektoren liegen auf der X-Achse in einer geraden Linie, kein Ring.
- Sektor-Abstand: 200 m. Sektoren berühren sich Kante an Kante.
- Sektor-Area: 200×200 (`points = PackedVector2Array(-100, -100, 100, -100, 100, 100, -100, 100)`).
- CP-Area: 40×40 (±20).
- Team-HQ-Areas: 200×200. Position: äußerster Sektor ±400 (3er), ±600 (5er), ±800 (7er). Das ergibt Kantenkontakt mit dem äußersten Sektor.
- Sektor-HQ: Position nicht in der Mitte und nicht in einem Quadranten. Lokales X = ±50 (Vorzeichen nach Sektorposition: x<0 → -50, x≥0 → +50).
- Area-Trigger: Mitte der Area, lokal `(0, 150, 0)`. Setzt Höhe 300 voraus.
- Sektor-HQs nutzen die Sektor-Area (`HQArea = ../S{i}_area`). Die HQ-Größe spielt daher keine Rolle.

## Node-Konventionen

- Kurze, sprechende Namen: `S{i}`, `S{i}_hq`, `S{i}_area`, `t1_hq`, `t2_hq`, `S{i}_cp1`, `S{i}_hq_vehicle{n}`.
- Fahrzeug-Spawns benennen sich nach Pfad: z.B. `S2_hq_vehicle1`, `S3_hq_vehicle1`. Keine globale Nummerierung.
- Alle Fahrzeuge sind Quadbikes. VehicleType = 22 (Annahme, siehe unten).

## Links (wichtig)

- NodePath-Properties brauchen `node_paths=PackedStringArray(...)` im Node-Header (nach `parent=`, vor `instance=`).
- Ohne das zeigt der Godot-Inspektor die Links nicht. Das war der Bug bei MCOMs in Sektor 1 (5er). Nach dem Fix in allen drei Dateien geprüft.
- Vorlage: `MP_Atoll_frontlines.tscn` (z.B. Zeilen 19, 36, 138, 193, 218).

## ObjIds

Quelle: `src/Frontlines/FrontlinesConfig.ts`.
- Sektor 620i, Trigger 621i, HQ 622i, Vehicle-Spawner 630i.
- MCOM/CP: 6400 + 10i + (0 oder 1).
- Team1-HQ 6100, Team2-HQ 6150.
- Team2-Vehicle-Spawner haben keine ObjIds.

## Bekannte Abweichungen / Annahmen

- VehicleType 22 für Quadbike: vom Benutzer akzeptiert, nicht gegen die Engine verifiziert. Im Repo gibt es keinen Quadbike-Enum.
- CP-Team-Spawns: 2 pro Team (Demo nutzt 4).
- CP-Spawns haben keinen Node3D-Container pro Team. Team und CP stehen im Namen/Pfad, z.B. `S2/S2_cp1/S2_cp1_t1_spawnpoint1`. Die `InfantrySpawnPoints_Team1/2`-Arrays des CP und die `InfantrySpawns`-Arrays der HQs verweisen auf diese Pfade.
- S6-InitialOwner und Fahrzeugtypen sind aus dem Demo-Muster abgeleitet.
- Trigger-Höhe `(0,150,0)` setzt eine Area-Höhe von 300 voraus.
- CP-Areas wurden ebenfalls verdoppelt (40 statt 20), obwohl die Anforderung sich auf alle Areas bezog.

## Verbindung zur Copilot CLI

Auf einem Rechner mit Godot: Repo klonen, Branch `godot-templates` auswählen. So ist die Dateistruktur direkt verfügbar. Eine direkte Session-Verbindung ist nicht geprüft.

## Git

- Branch: `godot-templates`.
- Commits: `5900515` (Erstellung), `b1a3afb` (node_paths-Fix), `bc2d59a` (Vehicles), danach Layout-Änderungen.
- Jeder Commit trägt den Co-authored-by-Trailer.

# Frontlines Templates – Session-Notizen

Dokumentiert, wie `frontlines_3sector.tscn`, `frontlines_5sector.tscn` und `frontlines_7sector.tscn` entstanden sind und welche Regeln gelten. Gedacht für Agents in zukünftigen Sessions.

## Quelle

- Extrahiert aus `levels/godot/MP_Atoll_frontlines.tscn` (nur Frontlines-Nodes).
- Die Templates sind eigenständig gebaut und per Drag & Drop in andere Portal-Maps ziehbar.
- Keine Godot-Engine im Repo verfügbar: keine Parse-Prüfung durch den Editor.
- Validierung: `/tmp/validate_frontlines.py` (nicht im Repo) prüft Node-Pfade und Links (79/133/187 Links geprüft). Bei Neuaufbau erneut schreiben.

## Layout-Regeln

- Sektoren liegen auf der X-Achse in einer geraden Linie, kein Ring.
- Sektor-Abstand: 100 m (= Sektorbreite). Sektoren berühren sich Kante an Kante.
- Sektor-Area: 100×100 (`points = PackedVector2Array(-50, -50, 50, -50, 50, 50, -50, 50)`).
- CP-Area: 40×40 (±20).
- Team-HQ-Areas: 200×200. Position: äußerster Sektor ±250 (3er), ±350 (5er), ±450 (7er). Das ergibt Kantenkontakt mit dem äußersten Sektor.
- Sektor-HQ: Position nicht in der Mitte und nicht in einem Quadranten. Lokales X = ±25 (Vorzeichen nach Sektorposition: x<0 → -25, x≥0 → +25).
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

## Anwendung auf MP_GolmudRailway (5-Sektor-Template)

Dateien:
- `levels/godot/MP_GolmudRailway_frontlines.tscn`: Originalstand (alte, händische Struktur), unverändert zum Vergleich wiederhergestellt.
- `levels/godot/MP_GolmudRailway_frontlines_5sector.tscn`: neue Variante aus dem 5-Sektor-Template. Eigene UID `uid://c5golmud5sct0`, damit beide Szenen parallel existieren können.

Quelle: `MP_GolmudRailway_frontlines` aus Portal. Die Sektor-Transforms stammen aus der Quelle, die Child-Transforms bleiben lokal erhalten.

Mapping:
- `Sector T1Mcoms` → `S1` (6201), MCOMs `S1_mcom1/2` (6410/6411), 10 Fahrzeuge unter `S1_hq` (6310–6319).
- `Sector1` → `S2` (6202), CPs `S2_cp1/2` (6420/6421, InitialOwner 1), HQ `S2_hq` (6222), VS `S2_hq_vehicle1` (6320).
- `Sector2 - Middle` → `S3` (6203), nur `S3_cp1` (6430), HQ `S3_hq` (6223), VS `S3_hq_vehicle1` (6330).
- `Sector3` → `S4` (6204), CPs `S4_cp1/2` (6440/6441, InitialOwner 2), HQ `S4_hq` (6224), VS `S4_hq_vehicle1` (6340).
- `Sector T2Mcoms` → `S5` (6205), MCOMs `S5_mcom1/2` (6450/6451), 10 Fahrzeuge unter `S5_hq` (6350–6359).
- Root-HQs `t1_hq` (6100) und `t2_hq` (6150) mit je 10 Quadbike-Fahrzeugen (Template-Muster). Ihre Area `t{n}_hq_area` ist das Polygon `HQ1Area` aus `Sector T{n}Mcoms/HQ1AreaTrigger` (statische Team-HQ-Area, Höhe 300). Der lokale Transform ist der Offset zum Root-HQ (Weltposition HQ1Area minus Weltposition TEAM_n_HQ, berechnet über die Parent-Kette). Die `HQ_Team`-Polygone entfallen.
- Sektor-Trigger zentriert in der Area (Y = Area-Offset + 150).
- S1/S5-HQ (`S1_hq`, `S5_hq`) liegt top-down in der Mitte der Sektor-Area (X/Z-Bbox-Mitte, Y = 0 relativ zum Sektor). Die 10 Fahrzeuge sind relativ dazu verschoben, ihre Weltposition bleibt gleich.
- Kept verbatim: `CombatArea`, `Camera3D/DeployCam`, `Static` (Assets, Terrain, Decal).

Bekannte Abweichungen:
- S2–S4 HQs haben keine eigene Area mehr. `HQArea` und `HQProtectionAreaVolume` zeigen auf `../S{i}_area` (Sektor-Area, wie im Template). Die Golmud-HQ-Polygone (`HQ_Team1`) entfallen.
- Areas: Sektor-Areas aus Golmud `SectorArea`, CP-Areas aus Golmud `CaptureArea`, Root-HQ-Areas aus `HQ1Area` (siehe oben). Die HQ1AreaTrigger-ObjId 2001/3001 wird nicht übernommen. Die HQ1Area-Polygone in S1/S5 sind als Root-HQ-Area verwendet.
- S3 hat nur einen CP (Quelle hatte einen).
- CP-Spawns: 4 pro Team statt 2.
- Bugfix in der Quelle: `Sector3`-CP A verwies bei Team-2-Slot 2 auf `Team1/SpawnPoint_1_2`. Jetzt korrekt auf Team2.
- Alle Fahrzeug-Spawner (Root-HQ, Sektor-HQ, S2–S4 VS) sind um `VEH_LIFT = 3` Einheiten über den Ursprung ihres HQ/Sektors angehoben. Grund: Fahrzeuge fielen durch das Terrain. Der Wert ist eine Annahme, da das Terrain ohne Godot nicht prüfbar ist. Bei Bedarf im Generator anpassen.
- VehicleType 22 (Quadbike) weiterhin nicht gegen die Engine verifiziert.

Validierung: Link-Check (`/tmp/validate_frontlines.py`-Logik) ohne Fehler, 61 eindeutige ObjIds. Kein Godot-Parse-Test (Godot nicht installiert).

## Fahrzeug-Anhebung (nur in neuen Template-Dateien)

Die Originalkarten (Contaminated, FireStorm, Granite_ClubHouse_Portal, Isolated, Golmud) bleiben unverändert. Der Lift wurde dort zurückgenommen (Commit `8cdb669`). Anhebung gilt nur für die neuen `*_5sector`/`*_7sector`-Dateien.

Regel: Jeder `VehicleType`-Node ohne `VehicleType`-Vorfahren wird im Generator um `VEH_LIFT = 3` auf Y angehoben. Kinder folgen ihrem Parent und werden nicht zusätzlich angehoben. Vorfahren sind Y-Rotationen mit Skalierung 1, daher ist lokal +3 gleich Welt +3.

- Die Höhe ist eine Annahme ohne Terrain-Prüfung. Bei Bedarf im Generator anpassen.

## Contaminated (`MP_Contaminated_frontlines_5sector.tscn`)

- Quelle: `MP_Contaminated_frontlines.tscn`. Zuordnung: `Sector T1Mcoms` → S1 (MCOM), `Sector1` → S2 (CP A/B), `Sector2 - Middle` → S3 (CP A), `Sector3` → S4 (CP A/B), `Sector T2Mcoms` → S5 (MCOM).
- Sektor-Transforms entstehen durch Matrixkomposition (Y-Rotationen der CP-Parents). Einfaches Addieren der Translationen ist falsch.
- Root-HQs `t1_hq` (6100) und `t2_hq` (6150) aus `TEAM_1_HQ`/`TEAM_2_HQ`. Team-2-Root-Fahrzeuge bekommen 6152–6161.
- Eigene Generator-Skripte liegen nur in `/tmp` und sind nicht im Repo.

## Verbindung zur Copilot CLI

Auf einem Rechner mit Godot: Repo klonen, Branch `godot-templates` auswählen. So ist die Dateistruktur direkt verfügbar. Eine direkte Session-Verbindung ist nicht geprüft.

## Git

- Branch: `godot-templates`.
- Commits: `5900515` (Erstellung), `b1a3afb` (node_paths-Fix), `bc2d59a` (Vehicles), danach Layout-Änderungen.
- Jeder Commit trägt den Co-authored-by-Trailer.

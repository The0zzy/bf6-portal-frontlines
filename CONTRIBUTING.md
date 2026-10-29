# Contributing

Guidelines for contributing to Frontlines.

## Required modules

This repository must use the following modules from `bf6-portal-utils`:

- `Events` (`bf6-portal-utils/events`) for event handling.
- `UI` (`bf6-portal-utils/ui`) for all UI.

Do not add code that bypasses these modules, for example by calling the raw game events or UI APIs directly.

## Maps

This section defines the object ID scheme every Frontlines level must follow, the rules checked at startup, and a worked
example (Atoll). A level that breaks these rules fails initialization.

### Level sources

Each level exists as a Godot source, a spatial export, or both:

- `levels/godot/<map>.tscn`: authoring source. An object's ID is the `ObjId = N` line under its node header.
- `levels/spatial/<map>.spatial.json`: the file used by the game. An object's ID is the `"ObjId": N` value that precedes
  the object's `"id"` field.

If both exist, both must carry the same IDs.

### Linking rules

- Objects are linked by ID only.
- Node names, node hierarchy and position in the file are not used for linking. An object may be placed under any node.
- Each ID appears at most once per level. A duplicate ID is a failure.

### Terms

- Fixed HQ: `TEAM_1_HQ` (ID 100) or `TEAM_2_HQ` (ID 150). Present on every map.
- Sector: a map area with an area trigger, identified by `sectorId`.
- MCOM sector: the first and last sector. Holds MCOMs. Has no sector HQ and no capture points.
- Capture sector: every sector between the two MCOM sectors. Has a sector HQ and capture points.
- Sector HQ: the HQ belonging to one capture sector.
- Vehicle spawner: an optional spawner belonging to one sector.

### ID scheme

All IDs are integers. `n` is the child index within its group, starting at 0. Indices must be contiguous: a gap is a
failure.

#### Fixed HQs

| Element         | Formula    | Team 1 | Team 2 |
| --------------- | ---------- | ------ | ------ |
| Fixed HQ        | `hqId`     | 100    | 150    |
| HQ area trigger | `hqId + 1` | 101    | 151    |

IDs 102-149 and 152-199 are reserved for other HQ-related objects. The current rules do not use them.

#### Sectors

Sector IDs start at 201. A level uses N contiguous sectors, 201 to 20N, where 5 ≤ N ≤ 7. The block 201-209 is reserved
for sectors.

| Element                          | Formula                                    | Range   |
| -------------------------------- | ------------------------------------------ | ------- |
| Sector                           | `sectorId`                                 | 201-209 |
| Sector area trigger              | `sectorId + 10`                            | 211-219 |
| Sector HQ (capture sectors only) | `sectorId + 20`                            | 221-229 |
| Vehicle spawner                  | `300 + (sectorId - 200) * 10 + n`, n = 0-7 | 310-397 |
| Capture point (capture sectors)  | `400 + (sectorId - 200) * 10 + n`, n = 0-7 | 410-497 |
| MCOM (MCOM sectors)              | `400 + (sectorId - 200) * 10 + n`, n = 0-7 | 410-497 |

Per-sector blocks, with n = 0-7 for each:

| sectorId | Area trigger | Sector HQ | Vehicle spawners | Capture points / MCOMs |
| -------- | ------------ | --------- | ---------------- | ---------------------- |
| 201      | 211          | 221       | 310-317          | 410-417                |
| 202      | 212          | 222       | 320-327          | 420-427                |
| 203      | 213          | 223       | 330-337          | 430-437                |
| 204      | 214          | 224       | 340-347          | 440-447                |
| 205      | 215          | 225       | 350-357          | 450-457                |
| 206      | 216          | 226       | 360-367          | 460-467                |
| 207      | 217          | 227       | 370-377          | 470-477                |
| 208      | 218          | 228       | 380-387          | 480-487                |
| 209      | 219          | 229       | 390-397          | 490-497                |

The sector HQ ID of an MCOM sector (for example 221 or 225) is not used and must not be placed.

#### Sector roles

| Position | Sector IDs     | Role                         | Required content                            |
| -------- | -------------- | ---------------------------- | ------------------------------------------- |
| First    | 201            | MCOM sector                  | 1-8 MCOMs, area trigger                     |
| Middle   | 202 to 20(N-1) | Capture sector (3-5 sectors) | Sector HQ, 1-8 capture points, area trigger |
| Last     | 20N            | MCOM sector                  | 1-8 MCOMs, area trigger                     |

Every sector also gets 0-8 optional vehicle spawners.

### Required objects and failure

Startup validation checks the rules below. If a required object is missing, an index sequence has a gap, or the sector
count is outside 5-7, initialization fails. The game logs an error naming the missing or invalid ID and ends the match
as a draw with `mod.EndGameMode(mod.GetTeam(0))`.

Required:

- Fixed HQs 100 and 150, and their area triggers 101 and 151.
- Sectors 201 to 20N, contiguous, with N between 5 and 7.
- An area trigger for every sector.
- A sector HQ for every capture sector.
- 1 to 8 capture points for every capture sector.
- 1 to 8 MCOMs for every MCOM sector.

Optional:

- 0 to 8 vehicle spawners per sector. If any are present, their indices must be contiguous from 0.

Forbidden (a failure if present):

- A sector HQ on an MCOM sector.
- Duplicate IDs.

Ignored for now:

- Objects with IDs outside this scheme. A future version will disable them.

### Example: Atoll

Atoll has 5 sectors: sector 201 is an MCOM sector, sectors 202 to 204 are capture sectors, and sector 205 is an MCOM
sector. Source: [MP_Atoll_frontlines.spatial.json](levels/spatial/MP_Atoll_frontlines.spatial.json).

| Sector               | Object                 | ObjId |
| -------------------- | ---------------------- | ----- |
| -                    | Team 1 fixed HQ        | 100   |
| -                    | Team 1 HQ area trigger | 101   |
| -                    | Team 2 fixed HQ        | 150   |
| -                    | Team 2 HQ area trigger | 151   |
| 201 (MCOM sector)    | Sector                 | 201   |
| 201                  | Area trigger           | 211   |
| 201                  | MCOM                   | 410   |
| 201                  | MCOM                   | 411   |
| 202 (capture sector) | Sector                 | 202   |
| 202                  | Area trigger           | 212   |
| 202                  | Sector HQ              | 222   |
| 202                  | Capture point A        | 420   |
| 202                  | Capture point B        | 421   |
| 202                  | Vehicle spawner        | 320   |
| 203 (capture sector) | Sector                 | 203   |
| 203                  | Area trigger           | 213   |
| 203                  | Sector HQ              | 223   |
| 203                  | Capture point A        | 430   |
| 203                  | Capture point B        | 431   |
| 203                  | Vehicle spawner        | 330   |
| 204 (capture sector) | Sector                 | 204   |
| 204                  | Area trigger           | 214   |
| 204                  | Sector HQ              | 224   |
| 204                  | Capture point A        | 440   |
| 204                  | Capture point B        | 441   |
| 204                  | Vehicle spawner        | 340   |
| 205 (MCOM sector)    | Sector                 | 205   |
| 205                  | Area trigger           | 215   |
| 205                  | MCOM                   | 450   |
| 205                  | MCOM                   | 451   |

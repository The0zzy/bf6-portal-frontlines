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

- Fixed HQ: `TEAM_1_HQ` (ID 6100) or `TEAM_2_HQ` (ID 6150). Present on every map.
- Sector: a map area with an area trigger, identified by `sectorId`.
- MCOM sector: the first and last sector. Holds MCOMs. Has no sector HQ and no capture points.
- Capture sector: every sector between the two MCOM sectors. Has a sector HQ and capture points.
- Sector HQ: the HQ belonging to one capture sector.
- Vehicle spawner: an optional spawner belonging to one sector.

### ID scheme

All IDs are integers. `n` is the child index within its group, starting at 0. Indices must be contiguous: a gap is a
failure.

All frontlines IDs live in 6100-6499 so they do not collide with objects of base game modes (up to 3000) or the payload
mode (up to 5002).

#### Fixed HQs

| Element         | Formula    | Team 1 | Team 2 |
| --------------- | ---------- | ------ | ------ |
| Fixed HQ        | `hqId`     | 6100   | 6150   |
| HQ area trigger | `hqId + 1` | 6101   | 6151   |

IDs 6102-6149 and 6152-6199 are reserved for other HQ-related objects. The current rules do not use them.

#### Sectors

Sector IDs start at 6201. A level uses N contiguous sectors, 6201 to 620N, where 5 ≤ N ≤ 7. The block 6201-6209 is
reserved for sectors.

| Element                          | Formula                                      | Range     |
| -------------------------------- | -------------------------------------------- | --------- |
| Sector                           | `sectorId`                                   | 6201-6209 |
| Sector area trigger              | `sectorId + 10`                              | 6211-6219 |
| Sector HQ (capture sectors only) | `sectorId + 20`                              | 6221-6229 |
| Vehicle spawner                  | `6300 + (sectorId - 6200) * 10 + n`, n = 0-7 | 6310-6397 |
| Capture point (capture sectors)  | `6400 + (sectorId - 6200) * 10 + n`, n = 0-7 | 6410-6497 |
| MCOM (MCOM sectors)              | `6400 + (sectorId - 6200) * 10 + n`, n = 0-7 | 6410-6497 |

Per-sector blocks, with n = 0-7 for each:

| sectorId | Area trigger | Sector HQ | Vehicle spawners | Capture points / MCOMs |
| -------- | ------------ | --------- | ---------------- | ---------------------- |
| 6201     | 6211         | 6221      | 6310-6317        | 6410-6417              |
| 6202     | 6212         | 6222      | 6320-6327        | 6420-6427              |
| 6203     | 6213         | 6223      | 6330-6337        | 6430-6437              |
| 6204     | 6214         | 6224      | 6340-6347        | 6440-6447              |
| 6205     | 6215         | 6225      | 6350-6357        | 6450-6457              |
| 6206     | 6216         | 6226      | 6360-6367        | 6460-6467              |
| 6207     | 6217         | 6227      | 6370-6377        | 6470-6477              |
| 6208     | 6218         | 6228      | 6380-6387        | 6480-6487              |
| 6209     | 6219         | 6229      | 6390-6397        | 6490-6497              |

The sector HQ ID of an MCOM sector (for example 6221 or 6225) is not used and must not be placed.

#### Sector roles

| Position | Sector IDs       | Role                         | Required content                            |
| -------- | ---------------- | ---------------------------- | ------------------------------------------- |
| First    | 6201             | MCOM sector                  | 1-8 MCOMs, area trigger                     |
| Middle   | 6202 to 620(N-1) | Capture sector (3-5 sectors) | Sector HQ, 1-8 capture points, area trigger |
| Last     | 620N             | MCOM sector                  | 1-8 MCOMs, area trigger                     |

Every sector also gets 0-8 optional vehicle spawners.

### Required objects and failure

Startup validation checks the rules below. If a required object is missing, an index sequence has a gap, or the sector
count is outside 5-7, initialization fails. The game logs an error naming the missing or invalid ID and ends the match
as a draw with `mod.EndGameMode(mod.GetTeam(0))`.

Required:

- Fixed HQs 6100 and 6150, and their area triggers 6101 and 6151.
- Sectors 6201 to 620N, contiguous, with N between 5 and 7.
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

Atoll has 5 sectors: sector 6201 is an MCOM sector, sectors 6202 to 6204 are capture sectors, and sector 6205 is an MCOM
sector. Source: [MP_Atoll_frontlines.spatial.json](levels/spatial/MP_Atoll_frontlines.spatial.json).

| Sector                | Object                 | ObjId |
| --------------------- | ---------------------- | ----- |
| -                     | Team 1 fixed HQ        | 6100  |
| -                     | Team 1 HQ area trigger | 6101  |
| -                     | Team 2 fixed HQ        | 6150  |
| -                     | Team 2 HQ area trigger | 6151  |
| 6201 (MCOM sector)    | Sector                 | 6201  |
| 6201                  | Area trigger           | 6211  |
| 6201                  | MCOM                   | 6410  |
| 6201                  | MCOM                   | 6411  |
| 6202 (capture sector) | Sector                 | 6202  |
| 6202                  | Area trigger           | 6212  |
| 6202                  | Sector HQ              | 6222  |
| 6202                  | Capture point A        | 6420  |
| 6202                  | Capture point B        | 6421  |
| 6202                  | Vehicle spawner        | 6320  |
| 6203 (capture sector) | Sector                 | 6203  |
| 6203                  | Area trigger           | 6213  |
| 6203                  | Sector HQ              | 6223  |
| 6203                  | Capture point A        | 6430  |
| 6203                  | Capture point B        | 6431  |
| 6203                  | Vehicle spawner        | 6330  |
| 6204 (capture sector) | Sector                 | 6204  |
| 6204                  | Area trigger           | 6214  |
| 6204                  | Sector HQ              | 6224  |
| 6204                  | Capture point A        | 6440  |
| 6204                  | Capture point B        | 6441  |
| 6204                  | Vehicle spawner        | 6340  |
| 6205 (MCOM sector)    | Sector                 | 6205  |
| 6205                  | Area trigger           | 6215  |
| 6205                  | MCOM                   | 6450  |
| 6205                  | MCOM                   | 6451  |

# TODOs

## Game Object Initialization

Foster a proper game mode object initialization for easier and unguarded access to game objects like sectors, capture
points, MCOMs, area triggers, and HQs in later gameplay logic. Whenever possible store references to game objects in
according classes or maps after initialization to avoid repeated calls to mod.GetAllX functions or map lookups. After
initialization, all game objects should be stored in their respective maps or class instances for direct access
throughout the gameplay logic. In order to avoid issues with objects out of the defined ID-ranges, the initialization
logic should fail early and provide clear error messages. A fail of initialization results in endgame(GetTeam(0)) (a
draw). A fail may occur if a sector has no capture points or MCOMs defined. The minimum amount of sectors is not
ensured, or the amount is an even number etc.

Object rules:

- there must be two fixed HQs (100 for team 1, 150 for team 2) with according areatriggers
- the first and last sectors must contain at least one MCOM and max 8.
- there must be at least 3 capture sectors defined (minimum 5 sectors in total, max 7 (more may need increase of
  letters?)).
- all sectors must have a valid area trigger defined.
- all capturesectors must have a valid HQ defined.
- mcom sectors are supposed to be close to the fixed HQs and therefore must not have an HQ defined.
- all capture sectors must contain at least one capture point and max 8.
- any sector may contain 0 to 8 vehicle spawners.
- any game objects that were not associated to frontlines objects must be disabled (diff of all game objects vs
  frontlines objects) - in future implementation.

## ID-Range overhaul

In order to better align with the game object initialization approach, the ID-range handling should be reviewed and
adjusted to ensure consistency and prevent conflicts. Idea:

- instead of hardcoding MCOM sector, the first and last sector act as MCOM sectors. Instead of capture points, they hold
  MCOMs with the same ID-range logic (there can be more than two MCOMs).
- sectors use 201-209; 100-199 is for fixed HQ elements.

ID scheme (n = child index, starting at 0):

- fixed HQ team 1 = 100, team 2 = 150
    - HQ areaTrigger = hqId + 1 (101 for team 1, 151 for team 2)
    - 102-149 (resp. 152-199) reserved for other HQ-related elements (e.g. vehicles)
- sectorId = 201-209 (max 7 sectors in use, see Object rules)
- areaTriggerId = sectorId + 10 (211-219)
- sectorHQId = sectorId + 20 (221-229), capture sectors only
- cpId / mcomId = 400 + (sectorId - 200) * 10 + n, n = 0-7 (max 8 per sector)
    - sector 201 → 410-417, sector 202 → 420-427, sector 209 → 490-497
- vehicleSpawnerId = 300 + (sectorId - 200) * 10 + n, n = 0-7 (max 8 per sector)
    - sector 201 → 310-317, sector 207 → 370-377

Range overview: 100-199 fixed HQ elements, 201-209 sectors, 211-219 area triggers, 221-229 sector HQs, 310-397 vehicle
spawners, 410-497 capture points and MCOMs. No overlaps.

Level file updates and the Atoll example are in [MAP_REQUIREMENTS.md](../../levels/MAP_REQUIREMENTS.md).

## Others

- UI
    - white outline of sector is not really an outline (gets covered by fill)
    - black connectors intended between sector widgets?
    - mcom sector should be visually distinct from capture sectors (add crown icon in some way (crowns per mcom?)
    - remaining units display centered (intended?)
        - there is no colored background fill (should be an emptying progress bar)
    - ObjectivesUI currently overlays the sector widgets
        - A) increase root y position of sector widgets
        - B) only show for current sector (use HQ instead of capture points (disable capture points for non-current
          sectors))
        - C) use objectives UI and draw sector boundaries around native game objectivesUI elements
- neutralization time for team3 owned capture points should be very short
- overhaul day/night switch (errors reported if player not alive or not having equipment)
- spot enemies in an owned sector
- after starting a sector capture, when a team 3 owned capture point is not entirely neutralized and recovers to full
  control, the sector gets moved again (as if owned by team 2 !?)
- create completely isolated OutOfBounds module that gets initialized with the necessary parameters and handles all
  out-of-bounds logic independently based on its own player tracking and areaTrigger information.

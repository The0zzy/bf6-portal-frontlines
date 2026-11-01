# OutOfBounds

Standalone out-of-bounds module for Battlefield Portal game modes (used by Frontlines, designed to be copied into
Payload). The game mode is the controller: it defines the bounds per team, the actions to take and when enforcement is
active. The module owns the per-player area tracking, the countdown, the UI and the sound.

Depends on `bf6-portal-utils` modules `events`, `timers`, `sounds` and `ui`.

## Files

| File                | Purpose                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `OutOfBounds.ts`    | Area tracking, bounds evaluation, countdown, actions and penalties.           |
| `OutOfBoundsUI.ts`  | Per-player full-screen overlay (title + countdown), created lazily.           |
| `strings.json`      | `outOfBounds.title` and `outOfBounds.countdown` (merged by the bundler).      |

## Usage

```ts
import { OutOfBounds } from '../OutOfBounds/OutOfBounds.ts';

const outOfBounds = new OutOfBounds({
    gracePeriod: 10,
    overlay: true,
    sound: true,
    spot: true,
    penalty: OutOfBounds.Penalty.Undeploy,
});

// allowed: player must be inside at least one; forbidden: player must be inside none
outOfBounds.setTeamAreas(mod.GetTeam(1), [101, 211, 212], [151]);
outOfBounds.setTeamAreas(mod.GetTeam(2), [151, 213, 214], [101]);

// when the round actually starts
outOfBounds.activate();
```

Create the instance as early as possible (e.g. in the game mode's init on `OnGameModeStarted`) so area tracking is
already running when players deploy. Call `setTeamAreas` again whenever the bounds change (e.g. sector captured,
checkpoint reached); all players are re-evaluated immediately.

## API

### `new OutOfBounds(options)`

Starts tracking areas for all players. Enforcement stays off until `activate()` is called.

| Option                          | Default | Description                                                                         |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `gracePeriod`                   | —       | Seconds a player may stay out of bounds before the penalty applies.                 |
| `overlay`                       | `true`  | Full-screen overlay with countdown (human players only).                            |
| `sound`                         | `true`  | Countdown sound every second (human players only).                                  |
| `spot`                          | `false` | Spots the player on minimap and in world for everyone while out of bounds.          |
| `penalty`                       | `Kill`  | Applied when the grace period runs out, see [Penalties](#penalties).                |
| `damagePerSecond`               | `10`    | Damage dealt every second for `Penalty.DamagePerSecond`.                            |
| `undeployIfDeployedOutOfBounds` | `false` | Undeploys players still out of bounds 1s after deploying (e.g. on a squad mate).    |

### `setTeamAreas(team, allowedAreaIds, forbiddenAreaIds = [])`

Defines the bounds of a team by area trigger IDs. A player is out of bounds when:

- inside any forbidden area, or
- outside all allowed areas (an empty allowed list means the team is not restricted to any area).

Teams without areas are never out of bounds.

### `activate()` / `deactivate()`

Turns enforcement on or off. Deactivating clears all running countdowns, overlays and spots; area tracking continues.

### `isOutOfBounds(player)`

Whether the player is currently out of bounds (countdown running).

### `destroy()`

Unsubscribes from all events and cleans up all UI, timers and the sound object.

## Penalties

| Penalty           | Behavior after the grace period                                                       |
| ----------------- | ------------------------------------------------------------------------------------- |
| `None`            | Countdown stays at 0; overlay, sound and spot continue until the player returns.      |
| `Kill`            | Kills the player, skipping the man-down state.                                        |
| `Undeploy`        | Sends the player back to the deploy screen.                                           |
| `DamagePerSecond` | Deals `damagePerSecond` every second until the player returns or dies.                |

## Tracking details

- Area trigger IDs a player is inside are tracked from `OnPlayerEnterAreaTrigger` / `OnPlayerExitAreaTrigger`.
- Evaluation is debounced by 100ms, because exit and enter events of adjacent triggers arrive in arbitrary order.
- `OnPlayerDied` stops the countdown but keeps the tracked areas, since a revived soldier stays in place and does not
  receive new enter events. `OnRevived` re-evaluates the player.
- `OnPlayerUndeploy` clears the tracked areas; enter events fire again on the next deploy.
- `OnPlayerSwitchTeam` re-evaluates the player; `OnPlayerLeaveGame` removes all player state and UI.
- Only alive players can be out of bounds. AI players get spotted and penalized, but receive no overlay or sound.

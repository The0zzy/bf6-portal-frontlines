import { Events } from 'bf6-portal-utils/events';
import { Sounds } from 'bf6-portal-utils/sounds';
import { Timers } from 'bf6-portal-utils/timers';
import { OutOfBoundsUI } from './OutOfBoundsUI.ts';

interface PlayerState {
    readonly id: number;
    readonly player: mod.Player;
    readonly areaIds: Set<number>;
    outOfBounds: boolean;
    secondsRemaining: number;
    countdownId: Timers.TimerID | undefined;
    evaluationId: Timers.TimerID | undefined;
    ui: OutOfBoundsUI | undefined;
}

interface TeamAreas {
    readonly team: mod.Team;
    readonly allowed: ReadonlySet<number>;
    readonly forbidden: ReadonlySet<number>;
}

/**
 * Tracks which area triggers each player is inside and enforces per-team bounds.
 * The game mode defines the areas per team (`setTeamAreas`), the actions (constructor options)
 * and when enforcement is active (`activate` / `deactivate`). Area tracking starts on construction.
 */
export class OutOfBounds {
    // Exit/enter events of adjacent triggers arrive in arbitrary order, so evaluation is debounced.
    private static readonly EVALUATION_DELAY_MS = 100;
    private static readonly DEPLOY_CHECK_DELAY_MS = 1000;
    private static readonly SPOT_DURATION = 2;

    private readonly options: Required<OutOfBounds.Options>;
    private readonly players = new Map<number, PlayerState>();
    private teamAreas: TeamAreas[] = [];
    private unsubscribers: (() => void)[] = [];
    private sfx: mod.SFX | undefined;
    private active = false;

    constructor(options: OutOfBounds.Options) {
        this.options = {
            overlay: true,
            sound: true,
            spot: false,
            penalty: OutOfBounds.Penalty.Kill,
            damagePerSecond: 10,
            undeployIfDeployedOutOfBounds: false,
            ...options,
        };

        if (this.options.sound) {
            this.sfx = Sounds.create(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_OutOfBounds_Countdown_OneShot2D);
        }

        this.unsubscribers = [
            Events.OnPlayerEnterAreaTrigger.subscribe((player, areaTrigger) => {
                const state = this.getState(player);
                state.areaIds.add(mod.GetObjId(areaTrigger));
                this.scheduleEvaluation(state);
            }),
            Events.OnPlayerExitAreaTrigger.subscribe((player, areaTrigger) => {
                const state = this.getState(player);
                state.areaIds.delete(mod.GetObjId(areaTrigger));
                this.scheduleEvaluation(state);
            }),
            Events.OnPlayerSwitchTeam.subscribe((player) => this.scheduleEvaluation(this.getState(player))),
            // Areas are kept on death: a revived soldier stays in place and gets no new enter events.
            Events.OnPlayerDied.subscribe((player) => this.handleDied(player)),
            Events.OnRevived.subscribe((player) => this.scheduleEvaluation(this.getState(player))),
            Events.OnPlayerUndeploy.subscribe((player) => this.resetPlayer(player)),
            Events.OnPlayerDeployed.subscribe((player) => this.handleDeployed(player)),
            Events.OnPlayerLeaveGame.subscribe((playerId) => this.removePlayer(playerId)),
        ];
    }

    /**
     * Defines the bounds of a team. A player is out of bounds when inside any forbidden area, or when
     * outside all allowed areas. An empty `allowedAreaIds` list means the team is not restricted to any area.
     * Re-evaluates all players immediately.
     */
    setTeamAreas(team: mod.Team, allowedAreaIds: Iterable<number>, forbiddenAreaIds: Iterable<number> = []): void {
        this.teamAreas = this.teamAreas.filter((areas) => !mod.Equals(areas.team, team));
        this.teamAreas.push({ team, allowed: new Set(allowedAreaIds), forbidden: new Set(forbiddenAreaIds) });
        this.evaluateAll();
    }

    /** Starts enforcing bounds and evaluates all tracked players. */
    activate(): void {
        this.active = true;
        this.evaluateAll();
    }

    /** Stops enforcing bounds and clears all running countdowns. Area tracking continues. */
    deactivate(): void {
        this.active = false;
        this.evaluateAll();
    }

    isOutOfBounds(player: mod.Player): boolean {
        return this.players.get(mod.GetObjId(player))?.outOfBounds ?? false;
    }

    /** Unsubscribes from all events and cleans up all UI, timers and sounds. */
    destroy(): void {
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.unsubscribers = [];
        for (const id of [...this.players.keys()]) {
            this.removePlayer(id);
        }
        if (this.sfx) {
            Sounds.dispose(this.sfx);
            this.sfx = undefined;
        }
        this.active = false;
    }

    private getState(player: mod.Player): PlayerState {
        const id = mod.GetObjId(player);
        let state = this.players.get(id);
        if (!state) {
            state = {
                id,
                player,
                areaIds: new Set(),
                outOfBounds: false,
                secondsRemaining: 0,
                countdownId: undefined,
                evaluationId: undefined,
                ui: undefined,
            };
            this.players.set(id, state);
        }
        return state;
    }

    private handleDied(player: mod.Player): void {
        const state = this.players.get(mod.GetObjId(player));
        if (!state) return;
        this.clearEvaluation(state);
        this.setInBounds(state);
    }

    private resetPlayer(player: mod.Player): void {
        const state = this.players.get(mod.GetObjId(player));
        if (!state) return;
        state.areaIds.clear();
        this.clearEvaluation(state);
        this.setInBounds(state);
    }

    private removePlayer(playerId: number): void {
        const state = this.players.get(playerId);
        if (!state) return;
        this.clearEvaluation(state);
        this.clearCountdown(state);
        state.ui?.destroy();
        this.players.delete(playerId);
    }

    private handleDeployed(player: mod.Player): void {
        if (!this.options.undeployIfDeployedOutOfBounds) return;
        Timers.setTimeout(() => {
            if (!mod.IsPlayerValid(player) || !this.isOutOfBounds(player)) return;
            this.resetPlayer(player);
            mod.UndeployPlayer(player);
        }, OutOfBounds.DEPLOY_CHECK_DELAY_MS);
    }

    private scheduleEvaluation(state: PlayerState): void {
        this.clearEvaluation(state);
        const id = Timers.setTimeout(() => {
            state.evaluationId = undefined;
            this.evaluate(state);
        }, OutOfBounds.EVALUATION_DELAY_MS);
        if (id === null) {
            this.evaluate(state);
            return;
        }
        state.evaluationId = id;
    }

    private clearEvaluation(state: PlayerState): void {
        if (state.evaluationId === undefined) return;
        Timers.clearTimeout(state.evaluationId);
        state.evaluationId = undefined;
    }

    private evaluateAll(): void {
        for (const state of [...this.players.values()]) {
            this.evaluate(state);
        }
    }

    private evaluate(state: PlayerState): void {
        if (!mod.IsPlayerValid(state.player)) {
            this.removePlayer(state.id);
            return;
        }

        const outOfBounds =
            this.active &&
            mod.GetSoldierState(state.player, mod.SoldierStateBool.IsAlive) &&
            this.isOutside(state);

        if (outOfBounds) {
            this.setOutOfBounds(state);
        } else {
            this.setInBounds(state);
        }
    }

    private isOutside(state: PlayerState): boolean {
        const team = mod.GetTeam(state.player);
        const areas = this.teamAreas.find((entry) => mod.Equals(entry.team, team));
        if (!areas) return false;

        for (const id of state.areaIds) {
            if (areas.forbidden.has(id)) return true;
        }
        if (areas.allowed.size === 0) return false;
        for (const id of state.areaIds) {
            if (areas.allowed.has(id)) return false;
        }
        return true;
    }

    private setOutOfBounds(state: PlayerState): void {
        if (state.outOfBounds) return;
        state.outOfBounds = true;
        state.secondsRemaining = Math.max(0, Math.ceil(this.options.gracePeriod));

        if (state.secondsRemaining === 0 && this.endsOnPenalty()) {
            this.applyPenalty(state);
            return;
        }

        this.notify(state);
        state.countdownId = Timers.setInterval(() => this.tick(state), 1000) ?? undefined;
    }

    private setInBounds(state: PlayerState): void {
        if (!state.outOfBounds) return;
        state.outOfBounds = false;
        this.clearCountdown(state);
        state.ui?.hide();
        if (this.options.spot && mod.IsPlayerValid(state.player)) {
            mod.SpotTarget(state.player, mod.SpotStatus.Unspot);
        }
    }

    private clearCountdown(state: PlayerState): void {
        if (state.countdownId === undefined) return;
        Timers.clearInterval(state.countdownId);
        state.countdownId = undefined;
    }

    private tick(state: PlayerState): void {
        if (!mod.IsPlayerValid(state.player)) {
            this.removePlayer(state.id);
            return;
        }

        if (state.secondsRemaining > 0) {
            state.secondsRemaining--;
        }

        if (state.secondsRemaining === 0) {
            if (this.endsOnPenalty()) {
                this.applyPenalty(state);
                return;
            }
            if (this.options.penalty === OutOfBounds.Penalty.DamagePerSecond) {
                mod.DealDamage(state.player, this.options.damagePerSecond);
            }
        }

        this.notify(state);
    }

    private endsOnPenalty(): boolean {
        return this.options.penalty === OutOfBounds.Penalty.Kill || this.options.penalty === OutOfBounds.Penalty.Undeploy;
    }

    private notify(state: PlayerState): void {
        if (this.options.spot) {
            mod.SpotTarget(state.player, OutOfBounds.SPOT_DURATION, mod.SpotStatus.SpotInBoth);
        }

        if (mod.GetSoldierState(state.player, mod.SoldierStateBool.IsAISoldier)) return;

        if (this.options.overlay) {
            state.ui ??= new OutOfBoundsUI(state.player);
            state.ui.show(state.secondsRemaining);
        }
        if (this.sfx) {
            Sounds.play(this.sfx, 1, { target: state.player });
        }
    }

    private applyPenalty(state: PlayerState): void {
        this.setInBounds(state);
        if (this.options.penalty === OutOfBounds.Penalty.Kill) {
            mod.Kill(state.player);
        } else {
            mod.UndeployPlayer(state.player);
        }
    }
}

export namespace OutOfBounds {
    export enum Penalty {
        /** Countdown stays at 0 and the other actions continue until the player returns. */
        None,
        /** Kills the player, skipping the man-down state. */
        Kill,
        /** Sends the player back to the deploy screen. */
        Undeploy,
        /** Deals `damagePerSecond` every second after the grace period until the player returns or dies. */
        DamagePerSecond,
    }

    export interface Options {
        /** Seconds a player may stay out of bounds before the penalty applies. */
        gracePeriod: number;
        /** Full-screen overlay with countdown (human players only). Default: true. */
        overlay?: boolean;
        /** Countdown sound every second (human players only). Default: true. */
        sound?: boolean;
        /** Spots the player on minimap and in world for everyone while out of bounds. Default: false. */
        spot?: boolean;
        /** Applied when the grace period runs out. Default: Kill. */
        penalty?: Penalty;
        /** Damage per second for `Penalty.DamagePerSecond`. Default: 10. */
        damagePerSecond?: number;
        /** Undeploys players still out of bounds shortly after deploying (e.g. deployed on a squad mate). Default: false. */
        undeployIfDeployedOutOfBounds?: boolean;
    }
}

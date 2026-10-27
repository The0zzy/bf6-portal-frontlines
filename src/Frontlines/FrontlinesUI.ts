import { UI } from 'bf6-portal-utils/ui';
import { UIContainer } from 'bf6-portal-utils/ui/components/container';
import { UIText } from 'bf6-portal-utils/ui/components/text';
import { getEnemyTeam, neutralTeam } from './FrontlinesConfig.ts';
import type { FrontlinesSector } from './FrontlinesSector.ts';

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Frontlines UI -----------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

const FRIENDLY_COLOR = UI.COLORS.BF_BLUE_BRIGHT;
const ENEMY_COLOR = UI.COLORS.BF_RED_BRIGHT;

// sector widgets sit right below the native objectives UI
const ROOT_Y = 90;
const SECTOR_SIZE = 40;
// horizontal space of one native objective icon, calibrate in-game
const OBJECTIVE_WIDTH = 20;
const BOUNDARY_LINE_WIDTH = 2;
const BOUNDARY_LINE_ALPHA = 0.8;
const GRADIENT_ALPHA = 0.4;
const ELEMENT_SPACING = 8;
const TIMER_WIDTH = 75;
const TIMER_HEIGHT = 20;
const UNITS_BAR_WIDTH = 80;
const UNITS_BAR_HEIGHT = 20;

interface SectorWidgets {
    root: UIContainer; // border (outline) and parent of the fills and letter
    friendlyFill: UIContainer; // grows from the bottom
    enemyFill: UIContainer; // grows from the top
    gradient: UIContainer; // ownership box above the sector, up to the top of the screen
    leftLine: UIContainer;
    rightLine: UIContainer;
}

// Widgets of one team. Colors are relative to that team: friendly is blue, enemy is red.
interface TeamView {
    team: mod.Team;
    overlay: UIContainer;
    root: UIContainer;
    timer: UIText;
    sectors: Map<number, SectorWidgets>;
    unitsRoot: UIContainer;
    unitsFill: UIContainer;
    unitsText: UIText;
}

/**
 * Displays the frontline (all sectors), the match timer and the remaining units for both teams.
 * Reads state from the sectors; the game mode only calls the update methods.
 */
export class FrontlinesUI {
    private readonly sectors: FrontlinesSector[];
    private readonly views: TeamView[];

    constructor(sectors: FrontlinesSector[]) {
        this.sectors = sectors;
        this.views = [this.createView(mod.GetTeam(1)), this.createView(mod.GetTeam(2))];
    }

    /**
     * Refreshes all sectors. Non-active sectors are filled in their owner's color, the active one shows its progress.
     */
    updateSectors(activeSector: FrontlinesSector): void {
        for (const sector of this.sectors) {
            this.updateSector(sector, sector === activeSector);
        }
    }

    /**
     * Refreshes the capture progress of the active sector only.
     */
    updateSectorProgress(activeSector: FrontlinesSector): void {
        this.updateSector(activeSector, true);
    }

    setTimer(seconds: number): void {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        let label: mod.Message;
        if (minutes < 10 && remainingSeconds < 10) {
            label = mod.Message(mod.stringkeys.frontlines.time1MSG, minutes, remainingSeconds);
        } else if (minutes < 10) {
            label = mod.Message(mod.stringkeys.frontlines.time2MSG, minutes, remainingSeconds);
        } else if (remainingSeconds < 10) {
            label = mod.Message(mod.stringkeys.frontlines.time3MSG, minutes, remainingSeconds);
        } else {
            label = mod.Message(mod.stringkeys.frontlines.time4MSG, minutes, remainingSeconds);
        }

        for (const view of this.views) {
            view.timer.label = label;
        }
    }

    /**
     * Shows the remaining units of the team attacking an MCOM sector.
     */
    showUnitsRemaining(attackingTeam: mod.Team, remaining: number, max: number): void {
        for (const view of this.views) {
            view.unitsFill.bgColor = mod.Equals(view.team, attackingTeam) ? FRIENDLY_COLOR : ENEMY_COLOR;
            view.unitsRoot.visible = true;
        }
        this.setUnitsRemaining(remaining, max);
    }

    hideUnitsRemaining(): void {
        for (const view of this.views) {
            view.unitsRoot.visible = false;
        }
    }

    setUnitsRemaining(remaining: number, max: number): void {
        const width = Math.round((remaining / max) * UNITS_BAR_WIDTH);
        for (const view of this.views) {
            view.unitsText.label = mod.Message(mod.stringkeys.frontlines.UnitsRemainingText, remaining);
            view.unitsFill.width = width;
        }
    }

    destroy(): void {
        for (const view of this.views) {
            view.overlay.delete();
            view.root.delete();
            view.unitsRoot.delete();
            view.sectors.clear();
        }
        this.views.length = 0;
    }

    private updateSector(sector: FrontlinesSector, active: boolean): void {
        for (const view of this.views) {
            const widgets = view.sectors.get(sector.id);
            if (!widgets) {
                continue;
            }

            const enemyTeam = getEnemyTeam(view.team);
            let friendlyProgress: number;
            let enemyProgress: number;
            if (active) {
                friendlyProgress = sector.getCaptureProgress(view.team);
                enemyProgress = sector.getCaptureProgress(enemyTeam);
            } else {
                friendlyProgress = mod.Equals(sector.ownerTeam, view.team) ? 1 : 0;
                enemyProgress = mod.Equals(sector.ownerTeam, enemyTeam) ? 1 : 0;
            }

            widgets.friendlyFill.height = Math.round(friendlyProgress * SECTOR_SIZE);
            widgets.enemyFill.height = Math.round(enemyProgress * SECTOR_SIZE);

            // owned sectors take the dark color of their owner, neutral ones stay white (active) or black
            const ownerColor = this.getOwnerDarkColor(sector.ownerTeam, view.team);
            widgets.root.bgColor = ownerColor ?? (active ? UI.COLORS.WHITE : UI.COLORS.BLACK);

            // active MCOM sectors keep their defending owner, so check active first
            let boundaryColor: UI.Color = UI.COLORS.WHITE;
            if (!active && !mod.Equals(sector.ownerTeam, neutralTeam())) {
                boundaryColor = mod.Equals(sector.ownerTeam, view.team) ? FRIENDLY_COLOR : ENEMY_COLOR;
            }
            widgets.gradient.bgColor = boundaryColor;
            widgets.leftLine.bgColor = boundaryColor;
            widgets.rightLine.bgColor = boundaryColor;
        }
    }

    private getOwnerDarkColor(owner: mod.Team, viewTeam: mod.Team): UI.Color | undefined {
        if (mod.Equals(owner, neutralTeam())) {
            return undefined;
        }
        return mod.Equals(owner, viewTeam) ? UI.COLORS.BF_BLUE_DARK : UI.COLORS.BF_RED_DARK;
    }

    private createView(team: mod.Team): TeamView {
        const sectorWidths = this.sectors.map(sector => sector.getObjectiveCount() * OBJECTIVE_WIDTH);
        const barWidth = sectorWidths.reduce((sum, width) => sum + width, 0);
        const rootHeight = SECTOR_SIZE + ELEMENT_SPACING + TIMER_HEIGHT;

        const overlay = new UIContainer({
            x: 0,
            y: 0,
            width: barWidth,
            height: ROOT_Y + SECTOR_SIZE,
            anchor: UI.Anchor.TopCenter,
            receiver: team,
        });

        const root = new UIContainer({
            x: 0,
            y: ROOT_Y,
            width: barWidth,
            height: rootHeight,
            anchor: UI.Anchor.TopCenter,
            receiver: team,
        });

        const bar = new UIContainer({
            parent: root,
            x: 0,
            y: 0,
            width: barWidth,
            height: SECTOR_SIZE,
            anchor: UI.Anchor.TopLeft,
        });

        const sectors = new Map<number, SectorWidgets>();
        let x = 0;
        for (let i = 0; i < this.sectors.length; i++) {
            const sector = this.sectors[i];
            const width = sectorWidths[i];

            const gradient = new UIContainer({
                parent: overlay,
                x,
                y: 0,
                width,
                height: ROOT_Y,
                anchor: UI.Anchor.TopLeft,
                bgColor: UI.COLORS.WHITE,
                bgAlpha: GRADIENT_ALPHA,
                bgFill: UI.BgFill.GradientBottom,
            });

            const leftLine = this.createBoundaryLine(overlay, x);
            const rightLine = this.createBoundaryLine(overlay, x + width - BOUNDARY_LINE_WIDTH);

            const sectorRoot = new UIContainer({
                parent: bar,
                x,
                y: 0,
                width,
                height: SECTOR_SIZE,
                anchor: UI.Anchor.TopLeft,
                bgColor: UI.COLORS.BLACK,
                bgAlpha: 1,
                bgFill: UI.BgFill.OutlineThin,
            });

            const friendlyFill = new UIContainer({
                parent: sectorRoot,
                width,
                height: 0,
                anchor: UI.Anchor.BottomLeft,
                bgColor: FRIENDLY_COLOR,
                bgAlpha: 0.8,
                bgFill: UI.BgFill.Solid,
            });

            const enemyFill = new UIContainer({
                parent: sectorRoot,
                width,
                height: 0,
                anchor: UI.Anchor.TopLeft,
                bgColor: ENEMY_COLOR,
                bgAlpha: 0.8,
                bgFill: UI.BgFill.Solid,
            });

            new UIText({
                parent: sectorRoot,
                width,
                height: SECTOR_SIZE,
                anchor: UI.Anchor.TopLeft,
                label: sector.getLabel(),
                textSize: 30,
                textColor: UI.COLORS.WHITE,
                textAnchor: UI.Anchor.Center,
            });

            sectors.set(sector.id, { root: sectorRoot, friendlyFill, enemyFill, gradient, leftLine, rightLine });
            x += width;
        }

        const timer = new UIText({
            parent: root,
            x: 0,
            y: 0,
            width: TIMER_WIDTH,
            height: TIMER_HEIGHT,
            anchor: UI.Anchor.BottomCenter,
            padding: 8,
            bgColor: { r: 0.2, g: 0.2, b: 1 },
            bgFill: UI.BgFill.Solid,
            label: mod.Message(mod.stringkeys.frontlines.time1MSG, 0, 0),
            textSize: 18,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
        });

        const unitsRoot = new UIContainer({
            x: 0,
            y: ROOT_Y + rootHeight + ELEMENT_SPACING,
            width: UNITS_BAR_WIDTH,
            height: UNITS_BAR_HEIGHT,
            anchor: UI.Anchor.TopCenter,
            bgColor: { r: 0.1, g: 0.1, b: 0.1 },
            bgAlpha: 0.6,
            bgFill: UI.BgFill.Solid,
            visible: false,
            receiver: team,
        });

        const unitsFill = new UIContainer({
            parent: unitsRoot,
            x: 0,
            y: 0,
            width: UNITS_BAR_WIDTH,
            height: UNITS_BAR_HEIGHT,
            anchor: UI.Anchor.CenterLeft,
            bgColor: FRIENDLY_COLOR,
            bgAlpha: 0.8,
            bgFill: UI.BgFill.Solid,
        });

        const unitsText = new UIText({
            parent: unitsRoot,
            x: 0,
            y: 0,
            width: UNITS_BAR_WIDTH,
            height: UNITS_BAR_HEIGHT,
            anchor: UI.Anchor.Center,
            label: mod.Message(mod.stringkeys.frontlines.UnitsRemainingText, 0),
            textSize: 18,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
        });

        return { team, overlay, root, timer, sectors, unitsRoot, unitsFill, unitsText };
    }

    // Vertical line from the top of the screen to the bottom of the sector widgets.
    private createBoundaryLine(parent: UIContainer, x: number): UIContainer {
        return new UIContainer({
            parent,
            x,
            y: 0,
            width: BOUNDARY_LINE_WIDTH,
            height: ROOT_Y + SECTOR_SIZE,
            anchor: UI.Anchor.TopLeft,
            bgColor: UI.COLORS.WHITE,
            bgAlpha: BOUNDARY_LINE_ALPHA,
            bgFill: UI.BgFill.Solid,
        });
    }
}

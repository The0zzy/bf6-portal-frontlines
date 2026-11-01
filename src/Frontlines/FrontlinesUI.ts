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
const LOCKED_COLOR: UI.Color = UI.COLORS.BF_GREY_2;
const LOCK_LABEL_TEXT_SIZE = 12;
const LETTER_TEXT_SIZE = 30;
const LOCKED_LETTER_TEXT_SIZE = 18;

// sector widgets sit right below the native objectives UI
const ROOT_Y = 100;
const SECTOR_SIZE = 44;
const LOCK_LABEL_HEIGHT = SECTOR_SIZE / 2;
// horizontal space of one native objective icon, calibrate in-game
const OBJECTIVE_WIDTH = 44;
const BOUNDARY_LINE_WIDTH = 2;
const BOUNDARY_LINE_ALPHA = 0.8;
const GRADIENT_ALPHA = 0.4;
const ELEMENT_SPACING = 8;
const TIMER_WIDTH = 75;
const TIMER_HEIGHT = 20;
const UNITS_BAR_WIDTH = 80;
const UNITS_BAR_HEIGHT = 20;
const UNITS_LABEL_HEIGHT = 18;
const STATUS_WIDTH = 200;

interface SectorWidgets {
    root: UIContainer; // parent of the fills, letter and outline
    friendlyFill: UIContainer; // grows from the bottom
    enemyFill: UIContainer; // grows from the top
    outline: UIContainer;
    label: UIText;
    lockLabel: UIText; // lock countdown inside the sector, only visible while locked
    locked: boolean;
    gradient: UIContainer; // ownership box above the sector, up to the top of the screen
    leftLine: UIContainer;
    rightLine: UIContainer;
}

// Widgets of one team. Colors are relative to that team: friendly is blue, enemy is red.
interface TeamView {
    team: mod.Team;
    overlay: UIContainer;
    root: UIContainer;
    bar: UIContainer;
    status: UIContainer; // centered on screen independent of the sector widths; holds timer and units
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
    private activeIndex: number = 0;

    constructor(sectors: FrontlinesSector[]) {
        this.sectors = sectors;
        this.views = [this.createView(mod.GetTeam(1)), this.createView(mod.GetTeam(2))];
    }

    /**
     * Refreshes all sectors. Non-active sectors are filled in their owner's color, the active one shows its progress.
     */
    updateSectors(activeSector: FrontlinesSector): void {
        this.activeIndex = this.sectors.indexOf(activeSector);
        for (const sector of this.sectors) {
            this.updateSector(sector, sector === activeSector);
        }
        this.centerBar();
    }

    /**
     * Refreshes the capture progress of the active sector only.
     */
    updateSectorProgress(activeSector: FrontlinesSector): void {
        this.updateSector(activeSector, true);
    }

    /**
     * Resizes the sector widgets to the current objective counts, e.g. after an MCOM is destroyed.
     */
    updateSectorWidths(): void {
        const sectorWidths = this.getSectorWidths();
        const barWidth = sectorWidths.reduce((sum, width) => sum + width, 0);
        for (const view of this.views) {
            view.overlay.width = barWidth;
            view.root.width = barWidth;
            view.bar.width = barWidth;

            let x = 0;
            for (let i = 0; i < this.sectors.length; i++) {
                const width = sectorWidths[i];
                const widgets = view.sectors.get(this.sectors[i].id);
                if (widgets) {
                    widgets.root.x = x;
                    widgets.root.width = width;
                    widgets.friendlyFill.width = width;
                    widgets.enemyFill.width = width;
                    widgets.outline.width = width;
                    widgets.label.width = width;
                    widgets.gradient.x = x;
                    widgets.gradient.width = width;
                    widgets.lockLabel.width = width;
                    widgets.leftLine.x = x;
                    widgets.rightLine.x = x + width - BOUNDARY_LINE_WIDTH;
                }
                x += width;
            }
        }
        this.centerBar();
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
            view.status.delete();
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

            const lockRemaining = active ? sector.getCaptureLockRemaining() : 0;
            const locked = lockRemaining > 0;
            this.setSectorLocked(widgets, locked);
            if (locked) {
                widgets.lockLabel.label = mod.Message(mod.stringkeys.frontlines.lockedCountdownMSG, lockRemaining);
            }
            const neutralColor = locked ? LOCKED_COLOR : UI.COLORS.WHITE;

            // owned sectors take the dark color of their owner, neutral ones stay white (active) or black
            const ownerColor = this.getOwnerDarkColor(sector.ownerTeam, view.team);
            widgets.root.bgColor = ownerColor ?? (active ? neutralColor : UI.COLORS.BLACK);

            // active MCOM sectors keep their defending owner, so check active first
            let boundaryColor: UI.Color = neutralColor;
            if (!active && !mod.Equals(sector.ownerTeam, neutralTeam())) {
                boundaryColor = mod.Equals(sector.ownerTeam, view.team) ? FRIENDLY_COLOR : ENEMY_COLOR;
            }
            widgets.outline.bgColor = boundaryColor;
            widgets.gradient.bgColor = boundaryColor;
            widgets.leftLine.bgColor = boundaryColor;
            widgets.rightLine.bgColor = boundaryColor;
        }
    }

    // Shrinks the letter and shows the lock countdown in the lower half of the sector while locked.
    private setSectorLocked(widgets: SectorWidgets, locked: boolean): void {
        if (widgets.locked === locked) {
            return;
        }
        widgets.locked = locked;
        widgets.label.height = locked ? SECTOR_SIZE - LOCK_LABEL_HEIGHT : SECTOR_SIZE;
        widgets.label.textSize = locked ? LOCKED_LETTER_TEXT_SIZE : LETTER_TEXT_SIZE;
        widgets.lockLabel.visible = locked;
    }

    private getOwnerDarkColor(owner: mod.Team, viewTeam: mod.Team): UI.Color | undefined {
        if (mod.Equals(owner, neutralTeam())) {
            return undefined;
        }
        return mod.Equals(owner, viewTeam) ? UI.COLORS.BF_BLUE_DARK : UI.COLORS.BF_RED_DARK;
    }

    private getSectorWidths(): number[] {
        return this.sectors.map(sector => sector.getObjectiveCount() * OBJECTIVE_WIDTH);
    }

    // Shifts the bar so the active sector's center sits on the screen center.
    private centerBar(): void {
        const sectorWidths = this.getSectorWidths();
        const barWidth = sectorWidths.reduce((sum, width) => sum + width, 0);
        const offsetToActive = sectorWidths.slice(0, this.activeIndex).reduce((sum, width) => sum + width, 0);
        const x = barWidth / 2 - offsetToActive - sectorWidths[this.activeIndex] / 2;
        for (const view of this.views) {
            view.overlay.x = x;
            view.root.x = x;
        }
    }

    private createView(team: mod.Team): TeamView {
        const sectorWidths = this.getSectorWidths();
        const barWidth = sectorWidths.reduce((sum, width) => sum + width, 0);

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
            height: SECTOR_SIZE,
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
                bgFill: UI.BgFill.None,
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

            const label = new UIText({
                parent: sectorRoot,
                width,
                height: SECTOR_SIZE,
                anchor: UI.Anchor.TopLeft,
                label: sector.getLabel(),
                textSize: LETTER_TEXT_SIZE,
                textColor: UI.COLORS.WHITE,
                textAnchor: UI.Anchor.Center,
            });

            const lockLabel = new UIText({
                parent: sectorRoot,
                x: 0,
                y: SECTOR_SIZE - LOCK_LABEL_HEIGHT,
                width,
                height: LOCK_LABEL_HEIGHT,
                anchor: UI.Anchor.TopLeft,
                label: mod.Message(mod.stringkeys.frontlines.lockedCountdownMSG, 0),
                textSize: LOCK_LABEL_TEXT_SIZE,
                textColor: UI.COLORS.WHITE,
                textAnchor: UI.Anchor.Center,
                visible: false,
            });

            // added last so the outline draws on top of the fills
            const outline = new UIContainer({
                parent: sectorRoot,
                width,
                height: SECTOR_SIZE,
                anchor: UI.Anchor.TopLeft,
                bgColor: UI.COLORS.BLACK,
                bgAlpha: 1,
                bgFill: UI.BgFill.OutlineThin,
            });

            sectors.set(sector.id, {
                root: sectorRoot,
                friendlyFill,
                enemyFill,
                outline,
                label,
                gradient,
                lockLabel,
                locked: false,
                leftLine,
                rightLine,
            });
            x += width;
        }

        const unitsHeight = UNITS_LABEL_HEIGHT + UNITS_BAR_HEIGHT;
        const status = new UIContainer({
            x: 0,
            y: ROOT_Y + SECTOR_SIZE + ELEMENT_SPACING,
            width: STATUS_WIDTH,
            height: TIMER_HEIGHT + ELEMENT_SPACING + unitsHeight,
            anchor: UI.Anchor.TopCenter,
            receiver: team,
        });

        const timer = new UIText({
            parent: status,
            x: 0,
            y: 0,
            width: TIMER_WIDTH,
            height: TIMER_HEIGHT,
            anchor: UI.Anchor.TopCenter,
            padding: 8,
            bgColor: { r: 0.2, g: 0.2, b: 1 },
            bgFill: UI.BgFill.Solid,
            label: mod.Message(mod.stringkeys.frontlines.time1MSG, 0, 0),
            textSize: 18,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
        });

        const unitsRoot = new UIContainer({
            parent: status,
            x: 0,
            y: TIMER_HEIGHT + ELEMENT_SPACING,
            width: STATUS_WIDTH,
            height: unitsHeight,
            anchor: UI.Anchor.TopCenter,
            visible: false,
        });

        new UIText({
            parent: unitsRoot,
            x: 0,
            y: 0,
            width: STATUS_WIDTH,
            height: UNITS_LABEL_HEIGHT,
            anchor: UI.Anchor.TopCenter,
            label: mod.Message(mod.stringkeys.frontlines.UnitsRemainingLabel),
            textSize: 14,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
        });

        const unitsBar = new UIContainer({
            parent: unitsRoot,
            x: 0,
            y: UNITS_LABEL_HEIGHT,
            width: UNITS_BAR_WIDTH,
            height: UNITS_BAR_HEIGHT,
            anchor: UI.Anchor.TopCenter,
            bgColor: { r: 0.1, g: 0.1, b: 0.1 },
            bgAlpha: 0.6,
            bgFill: UI.BgFill.Solid,
        });

        const unitsFill = new UIContainer({
            parent: unitsBar,
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
            parent: unitsBar,
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

        return { team, overlay, root, bar, status, timer, sectors, unitsRoot, unitsFill, unitsText };
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

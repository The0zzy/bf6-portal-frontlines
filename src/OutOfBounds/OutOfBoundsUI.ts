import { UI } from 'bf6-portal-utils/ui';
import { UIContainer } from 'bf6-portal-utils/ui/components/container';
import { UIText } from 'bf6-portal-utils/ui/components/text';
import { OutOfBounds } from './OutOfBounds.ts';

/** Full-screen overlay: title box in the upper part of the screen, countdown below it. */
const FULL_LAYOUT = { margin: 300, width: 800, lineHeight: 120, gap: 20, titleSize: 56, subtitleSize: 48 };
/** Hint: smaller text without background. */
const HINT_LAYOUT = { margin: 20, width: 600, lineHeight: 40, gap: 0, titleSize: 32, subtitleSize: 24 };

interface AnchorLayout {
    readonly ui: UI.Anchor;
    readonly text: UI.Anchor;
    /** Sign applied to the margin as the engine reads it: bottom anchors use +1 since the engine flips Y there. */
    readonly inwardX: number;
    readonly inwardY: number;
}

function anchorLayout(anchor: OutOfBounds.Anchor): AnchorLayout {
    const A = OutOfBounds.Anchor;
    const table: Record<OutOfBounds.Anchor, AnchorLayout> = {
        [A.TopLeft]: { ui: UI.Anchor.TopLeft, text: UI.Anchor.CenterLeft, inwardX: 1, inwardY: 1 },
        [A.TopCenter]: { ui: UI.Anchor.TopCenter, text: UI.Anchor.Center, inwardX: 0, inwardY: 1 },
        [A.TopRight]: { ui: UI.Anchor.TopRight, text: UI.Anchor.CenterRight, inwardX: 1, inwardY: 1 },
        [A.CenterLeft]: { ui: UI.Anchor.CenterLeft, text: UI.Anchor.CenterLeft, inwardX: 1, inwardY: 0 },
        [A.Center]: { ui: UI.Anchor.Center, text: UI.Anchor.Center, inwardX: 0, inwardY: 0 },
        [A.CenterRight]: { ui: UI.Anchor.CenterRight, text: UI.Anchor.CenterRight, inwardX: 1, inwardY: 0 },
        [A.BottomLeft]: { ui: UI.Anchor.BottomLeft, text: UI.Anchor.CenterLeft, inwardX: 1, inwardY: 1 },
        [A.BottomCenter]: { ui: UI.Anchor.BottomCenter, text: UI.Anchor.Center, inwardX: 0, inwardY: 1 },
        [A.BottomRight]: { ui: UI.Anchor.BottomRight, text: UI.Anchor.CenterRight, inwardX: 1, inwardY: 1 },
    };
    return table[anchor];
}

/**
 * Out-of-bounds overlay with a title and a subtitle (countdown), visible only to one player. Widgets are created lazily.
 * `Full` covers the screen and blocks the view, `Hint` is text only and does not restrict the view.
 */
export class OutOfBoundsUI {
    private readonly player: mod.Player;
    private readonly overlayType: OutOfBounds.OverlayType;
    private readonly anchor: OutOfBounds.Anchor;
    private readonly title: mod.Message;
    private readonly subtitle: (secondsRemaining: number) => mod.Message;
    private backdrop: UIContainer | undefined;
    private panel: UIContainer | undefined;
    private countdown: UIText | undefined;

    constructor(player: mod.Player, options: OutOfBoundsUI.Config) {
        this.player = player;
        this.overlayType = options.overlayType ?? OutOfBounds.OverlayType.Full;
        this.anchor =
            options.anchor ??
            (this.overlayType === OutOfBounds.OverlayType.Hint ? OutOfBounds.Anchor.TopLeft : OutOfBounds.Anchor.TopCenter);
        this.title = options.title ?? mod.Message(mod.stringkeys.outOfBounds.title);
        this.subtitle =
            options.subtitle ?? ((secondsRemaining: number) => mod.Message(mod.stringkeys.outOfBounds.countdown, secondsRemaining));
    }

    show(secondsRemaining: number): void {
        if (!this.panel) {
            this.create();
        }

        if (this.countdown) {
            this.countdown.label = this.subtitle(secondsRemaining);
        }
        if (this.backdrop) {
            this.backdrop.visible = true;
        }
        if (this.panel) {
            this.panel.visible = true;
        }
    }

    hide(): void {
        if (this.backdrop) {
            this.backdrop.visible = false;
        }
        if (this.panel) {
            this.panel.visible = false;
        }
    }

    destroy(): void {
        this.backdrop?.delete();
        this.panel?.delete();
        this.backdrop = undefined;
        this.panel = undefined;
        this.countdown = undefined;
    }

    private create(): void {
        const full = this.overlayType === OutOfBounds.OverlayType.Full;
        const layout = full ? FULL_LAYOUT : HINT_LAYOUT;
        const { ui, text, inwardX, inwardY } = anchorLayout(this.anchor);

        if (full) {
            this.backdrop = new UIContainer({
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                anchor: UI.Anchor.Center,
                bgColor: UI.COLORS.BLACK,
                bgAlpha: 0.9,
                bgFill: UI.BgFill.Blur,
                receiver: this.player,
                visible: false
            });
        }

        // root-level panel (not a child of root), so it must be tracked separately
        this.panel = new UIContainer({
            x: inwardX * layout.margin,
            y: inwardY * layout.margin,
            width: layout.width,
            height: layout.lineHeight * 2 + layout.gap,
            anchor: ui,
            bgFill: UI.BgFill.Blur,
            bgColor: UI.COLORS.BF_RED_DARK,
            bgAlpha: 0.9,
            receiver: this.player,
        });

        const titleStyle = full
            ? { bgColor: { r: 0.6, g: 0.1, b: 0.1 }, bgAlpha: 0.8, bgFill: UI.BgFill.Blur }
            : { bgFill: UI.BgFill.None };

        new UIText({
            parent: this.panel,
            x: 0,
            y: 0,
            width: layout.width,
            height: layout.lineHeight,
            anchor: UI.Anchor.TopCenter,
            ...titleStyle,
            label: this.title,
            textSize: layout.titleSize,
            textColor: UI.COLORS.BF_RED_DARK,
            textAnchor: text,
        });

        this.countdown = new UIText({
            parent: this.panel,
            x: 0,
            y: 0,
            width: layout.width,
            height: layout.lineHeight,
            anchor: UI.Anchor.BottomCenter,
            bgFill: UI.BgFill.None,
            label: this.subtitle(0),
            textSize: layout.subtitleSize,
            textColor: UI.COLORS.BF_RED_DARK,
            textAnchor: text,
        });
    }
}

export namespace OutOfBoundsUI {
    export interface Config {
        overlayType?: OutOfBounds.OverlayType;
        anchor?: OutOfBounds.Anchor;
        title?: mod.Message;
        subtitle?: (secondsRemaining: number) => mod.Message;
    }
}

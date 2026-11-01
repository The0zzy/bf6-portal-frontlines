import { UI } from 'bf6-portal-utils/ui';
import { UIContainer } from 'bf6-portal-utils/ui/components/container';
import { UIText } from 'bf6-portal-utils/ui/components/text';

/**
 * Full-screen out-of-bounds overlay with a title and a countdown, visible only to one player. Widgets are created lazily.
 */
export class OutOfBoundsUI {
    private readonly player: mod.Player;
    private root: UIContainer | undefined;
    private countdown: UIText | undefined;

    constructor(player: mod.Player) {
        this.player = player;
    }

    show(secondsRemaining: number): void {
        if (!this.root) {
            this.root = new UIContainer({
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                anchor: UI.Anchor.Center,
                bgColor: UI.COLORS.BLACK,
                bgAlpha: 0.9,
                bgFill: UI.BgFill.Blur,
                receiver: this.player,
            });

            new UIText({
                parent: this.root,
                x: 0,
                y: 300,
                width: 800,
                height: 120,
                anchor: UI.Anchor.TopCenter,
                bgColor: { r: 0.6, g: 0.1, b: 0.1 },
                bgAlpha: 0.8,
                bgFill: UI.BgFill.Blur,
                label: mod.Message(mod.stringkeys.outOfBounds.title),
                textSize: 56,
                textColor: { r: 1, g: 0.2, b: 0.2 },
                textAnchor: UI.Anchor.Center,
            });

            this.countdown = new UIText({
                parent: this.root,
                x: 0,
                y: 440,
                width: 800,
                height: 120,
                anchor: UI.Anchor.TopCenter,
                bgFill: UI.BgFill.None,
                label: mod.Message(mod.stringkeys.outOfBounds.countdown, secondsRemaining),
                textSize: 48,
                textColor: { r: 1, g: 0.2, b: 0.2 },
                textAnchor: UI.Anchor.Center,
            });
        }

        if (this.countdown) {
            this.countdown.label = mod.Message(mod.stringkeys.outOfBounds.countdown, secondsRemaining);
        }
        this.root.visible = true;
    }

    hide(): void {
        if (this.root) {
            this.root.visible = false;
        }
    }

    destroy(): void {
        this.root?.delete();
        this.root = undefined;
        this.countdown = undefined;
    }
}

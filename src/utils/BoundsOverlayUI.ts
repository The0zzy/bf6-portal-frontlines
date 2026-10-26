import { UI } from 'bf6-portal-utils/ui';
import { UIContainer } from 'bf6-portal-utils/ui/components/container';
import { UIText } from 'bf6-portal-utils/ui/components/text';

/**
 * Full-screen dark overlay with a centred message, visible only to the given player or team.
 */
export class BoundsOverlayUI {
    private readonly receiver: mod.Player | mod.Team;
    private root: UIContainer | undefined;
    private text: UIText | undefined;

    constructor(receiver: mod.Player | mod.Team) {
        this.receiver = receiver;
    }

    show(message: mod.Message): void {
        if (!this.root) {
            this.root = new UIContainer({
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                anchor: UI.Anchor.TopLeft,
                bgColor: UI.COLORS.BLACK,
                bgAlpha: 0.9,
                bgFill: UI.BgFill.Solid,
                receiver: this.receiver,
            });

            this.text = new UIText({
                parent: this.root,
                x: 0,
                y: 200,
                width: 800,
                height: 300,
                anchor: UI.Anchor.TopCenter,
                padding: 8,
                bgColor: { r: 0.2, g: 0.2, b: 1 },
                bgFill: UI.BgFill.Solid,
                label: message,
                textSize: 60,
                textColor: { r: 1, g: 0, b: 0 },
                textAnchor: UI.Anchor.Center,
                receiver: this.receiver,
            });
        }

        if (this.text) {
            this.text.label = message;
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
        this.text = undefined;
    }
}

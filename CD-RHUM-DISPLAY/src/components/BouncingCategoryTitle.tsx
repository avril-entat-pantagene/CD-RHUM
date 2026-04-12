import { useEffect, useRef, useState } from "preact/hooks";

const COLORS = [
    "#FF1B8D",
    "#FF6359",
    "#FF7A47",
    "#FFAA24",
    "#FFD900",
    "#8DC680",
    "#54BDC0",
    "#1BB3FF",
];

const STATIC_TEXT_HITBOX_HEIGHT_SCALE = 0.88;
const BOUNCING_TEXT_HITBOX_HEIGHT_SCALE = 0.88;

function randomColor(except: string) {
    const available = COLORS.filter((color) => color !== except);
    return available[Math.floor(Math.random() * available.length)];
}

type BouncingCategoryTitleProps = {
    text: string;
};

type Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

type TextMeasure = {
    leftOffset: number;
    rightOffset: number;
    ascent: number;
    descent: number;
};

function intersects(rectA: Rect, rectB: Rect) {
    return !(
        rectA.right <= rectB.left
        || rectA.left >= rectB.right
        || rectA.bottom <= rectB.top
        || rectA.top >= rectB.bottom
    );
}

function intersectsAny(rect: Rect, obstacles: Rect[]) {
    return obstacles.some((obstacle) => intersects(rect, obstacle));
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function scaleRectHeight(rect: Rect, scale: number): Rect {
    const height = rect.bottom - rect.top;
    const reducedHeight = height * scale;
    const offset = (height - reducedHeight) / 2;

    return {
        ...rect,
        top: rect.top + offset,
        bottom: rect.bottom - offset,
    };
}

function createTextMeasurer() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    return (text: string, font: string): TextMeasure | null => {
        if (!context || text.length === 0) {
            return null;
        }

        context.font = font;
        const metrics = context.measureText(text);

        if (
            Number.isNaN(metrics.actualBoundingBoxAscent)
            || Number.isNaN(metrics.actualBoundingBoxDescent)
            || Number.isNaN(metrics.actualBoundingBoxLeft)
            || Number.isNaN(metrics.actualBoundingBoxRight)
        ) {
            return null;
        }

        return {
            leftOffset: metrics.actualBoundingBoxLeft,
            rightOffset: metrics.actualBoundingBoxRight,
            ascent: metrics.actualBoundingBoxAscent,
            descent: metrics.actualBoundingBoxDescent,
        };
    };
}

export function BouncingCategoryTitle({ text }: BouncingCategoryTitleProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const titleRef = useRef<HTMLHeadingElement | null>(null);
    const [color, setColor] = useState(COLORS[0]);

    useEffect(() => {
        const container = containerRef.current;
        const title = titleRef.current;
        const categoryBox = container?.closest(".price-category-box");

        if (!container || !title || !categoryBox) {
            return;
        }

        let x = 4;
        let y = 4;
        let vx = 0.85;
        let vy = 0.2;
        let frameId = 0;
        const measureText = createTextMeasurer();

        const getBlockedRects = (): Rect[] => {
            const containerRect = container.getBoundingClientRect();
            const labels = Array.from(categoryBox.querySelectorAll<HTMLSpanElement>(".price-item-row span"));

            return labels.map((label) => {
                const rect = label.getBoundingClientRect();
                const style = window.getComputedStyle(label);
                const text = label.textContent?.trim() ?? "";
                const font = style.font;
                const lineHeight = Number.parseFloat(style.lineHeight);
                const fontSize = Number.parseFloat(style.fontSize);
                const measured = measureText(text, font);

                if (!measured) {
                    return scaleRectHeight({
                        left: rect.left - containerRect.left,
                        top: rect.top - containerRect.top,
                        right: rect.right - containerRect.left,
                        bottom: rect.bottom - containerRect.top,
                    }, STATIC_TEXT_HITBOX_HEIGHT_SCALE);
                }

                const resolvedLineHeight = Number.isFinite(lineHeight) ? lineHeight : fontSize;
                const extraLeading = Math.max(0, resolvedLineHeight - (measured.ascent + measured.descent));
                const baselineY = rect.top + (extraLeading / 2) + measured.ascent;

                return scaleRectHeight({
                    left: rect.left - measured.leftOffset - containerRect.left,
                    top: baselineY - measured.ascent - containerRect.top,
                    right: rect.left + measured.rightOffset - containerRect.left,
                    bottom: baselineY + measured.descent - containerRect.top,
                }, STATIC_TEXT_HITBOX_HEIGHT_SCALE);
            }).filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
        };

        const animate = () => {
            const titleWidth = title.clientWidth;
            const titleHeight = title.clientHeight;
            const titleHitboxHeight = titleHeight * BOUNCING_TEXT_HITBOX_HEIGHT_SCALE;
            const titleHitboxOffsetY = (titleHeight - titleHitboxHeight) / 2;
            const maxX = Math.max(0, container.clientWidth - titleWidth);
            const maxY = Math.max(0, container.clientHeight - titleHeight);
            const obstacles = getBlockedRects();

            let nextX = x + vx;
            let nextY = y + vy;

            const makeRect = (left: number, top: number): Rect => ({
                left,
                top: top + titleHitboxOffsetY,
                right: left + titleWidth,
                bottom: top + titleHitboxOffsetY + titleHitboxHeight,
            });

            nextX = clamp(nextX, 0, maxX);
            nextY = clamp(nextY, 0, maxY);

            let collided = false;

            if (nextX <= 0) {
                nextX = 0;
                vx = Math.abs(vx);
                collided = true;
            } else if (nextX >= maxX) {
                nextX = maxX;
                vx = -Math.abs(vx);
                collided = true;
            }

            if (nextY <= 0) {
                nextY = 0;
                vy = Math.abs(vy);
                collided = true;
            } else if (nextY >= maxY) {
                nextY = maxY;
                vy = -Math.abs(vy);
                collided = true;
            }

            if (intersectsAny(makeRect(nextX, y), obstacles)) {
                vx = -vx;
                nextX = clamp(x + vx, 0, maxX);
                collided = true;
            }

            if (intersectsAny(makeRect(nextX, nextY), obstacles)) {
                vy = -vy;
                nextY = clamp(y + vy, 0, maxY);
                collided = true;
            }

            if (intersectsAny(makeRect(nextX, nextY), obstacles)) {
                vx = -vx;
                vy = -vy;
                nextX = clamp(x + vx, 0, maxX);
                nextY = clamp(y + vy, 0, maxY);
                collided = true;
            }

            x = nextX;
            y = nextY;

            if (collided) {
                setColor((current) => randomColor(current));
            }

            title.style.transform = `translate(${x}px, ${y}px)`;
            frameId = requestAnimationFrame(animate);
        };

        title.style.transform = `translate(${x}px, ${y}px)`;
        frameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, []);

    return (
        <div ref={containerRef} class="price-category-title-stage">
            <h3 ref={titleRef} class="price-category-title" style={{ color }}>
                {text}
            </h3>
        </div>
    );
}

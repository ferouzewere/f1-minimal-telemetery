import React, { useRef, useLayoutEffect, useState } from 'react';

interface FitTextProps {
    children: React.ReactNode;
    maxScale?: number;
    minScale?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const FitText: React.FC<FitTextProps> = ({
    children,
    maxScale = 1,
    minScale = 0.5,
    className = '',
    style = {}
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;

        if (!container || !content) return;

        const resizeText = () => {
            // Reset scale to measure true width
            setScale(1);

            // Available width in container
            const containerWidth = container.offsetWidth;
            // Actual width of content
            const contentWidth = content.scrollWidth;

            if (contentWidth > containerWidth) {
                const newScale = containerWidth / contentWidth;
                setScale(Math.max(minScale, Math.min(newScale, maxScale)));
            } else {
                setScale(maxScale);
            }
        };

        // Initial sizing
        resizeText();

        // Observer for container resize
        const observer = new ResizeObserver(resizeText);
        observer.observe(container);

        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [children, maxScale, minScale]);

    return (
        <div
            ref={containerRef}
            className={`fit-text-wrapper ${className}`}
            style={{
                width: '100%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                ...style
            }}
        >
            <div
                ref={contentRef}
                style={{
                    whiteSpace: 'nowrap',
                    transform: `scale(${scale})`,
                    transformOrigin: 'left center',
                    transition: 'transform 0.1s ease-out',
                    width: 'auto'
                }}
            >
                {children}
            </div>
        </div>
    );
};

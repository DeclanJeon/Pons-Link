import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useUIManagementStore, ControlBarPosition } from '@/stores/useUIManagementStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { ControlBar } from './ControlBar';
import { cn } from '@/lib/utils';
import { GripVertical, GripHorizontal } from 'lucide-react';

export const DraggableControlBar = () => {
    const isMobile = useIsMobile();
    const { 
        controlBarPosition, 
        setControlBarPosition, 
        isControlBarVisible,
        setControlBarVisible,
        isPanelOpen 
    } = useUIManagementStore();
    
    const [isDraggingControlBar, setIsDraggingControlBar] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHoveringControlBar, setIsHoveringControlBar] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const dragStartOffset = useRef({ x: 0, y: 0 });
    const autoHideTimerRef = useRef<NodeJS.Timeout>();
    const isCoWatchOpen = isPanelOpen('cowatch');

    const getSnapPosition = useCallback((pos: ControlBarPosition, width: number, height: number) => {
        const { innerWidth, innerHeight } = window;
        const margin = 24;
        
        switch (pos) {
            case 'top': 
                return { 
                    x: (innerWidth - width) / 2, 
                    y: margin 
                };
            case 'bottom': 
                return { 
                    x: (innerWidth - width) / 2, 
                    y: innerHeight - height - margin 
                };
            case 'left': 
                return { 
                    x: margin, 
                    y: (innerHeight - height) / 2 
                };
            case 'right': 
                return { 
                    x: innerWidth - width - margin, 
                    y: (innerHeight - height) / 2 
                };
        }
    }, []);

    const startAutoHideTimer = useCallback(() => {
        if (autoHideTimerRef.current) {
            clearTimeout(autoHideTimerRef.current);
        }
        
        autoHideTimerRef.current = setTimeout(() => {
            if (!isHoveringControlBar && !isDraggingControlBar) {
                setControlBarVisible(false);
            }
        }, 3000);
    }, [isHoveringControlBar, isDraggingControlBar, setControlBarVisible]);

    const showControlBar = useCallback(() => {
        setControlBarVisible(true);
        startAutoHideTimer();
    }, [setControlBarVisible, startAutoHideTimer]);

    const handleMouseEnter = useCallback(() => {
        if (!isMobile) {
            setIsHoveringControlBar(true);
            if (autoHideTimerRef.current) {
                clearTimeout(autoHideTimerRef.current);
            }
            setControlBarVisible(true);
        }
    }, [isMobile, setControlBarVisible]);

    const handleMouseLeave = useCallback(() => {
        if (!isMobile) {
            setIsHoveringControlBar(false);
            startAutoHideTimer();
        }
    }, [isMobile, startAutoHideTimer]);

    useEffect(() => {
        if (isMobile) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!ref.current || isDraggingControlBar) return;

            const rect = ref.current.getBoundingClientRect();
            const hoverMargin = 80;
            
            const isNearControlBar = 
                e.clientX >= rect.left - hoverMargin &&
                e.clientX <= rect.right + hoverMargin &&
                e.clientY >= rect.top - hoverMargin &&
                e.clientY <= rect.bottom + hoverMargin;

            if (isNearControlBar && !isControlBarVisible) {
                showControlBar();
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        
        showControlBar();

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            if (autoHideTimerRef.current) {
                clearTimeout(autoHideTimerRef.current);
            }
        };
    }, [isMobile, isDraggingControlBar, isControlBarVisible, showControlBar]);

    useEffect(() => {
        if (ref.current && !isDraggingControlBar) {
            const { offsetWidth, offsetHeight } = ref.current;
            const newPosition = getSnapPosition(controlBarPosition, offsetWidth, offsetHeight);
            setPosition(newPosition);
        }
    }, [controlBarPosition, isDraggingControlBar, getSnapPosition]);

    useEffect(() => {
        const handleResize = () => {
            if (ref.current) {
                const { offsetWidth, offsetHeight } = ref.current;
                const newPosition = getSnapPosition(controlBarPosition, offsetWidth, offsetHeight);
                setPosition(newPosition);
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize();
        
        return () => window.removeEventListener('resize', handleResize);
    }, [controlBarPosition, getSnapPosition]);

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (isMobile || isCoWatchOpen) return;
        
        const target = e.target as HTMLElement;
        if (!target.closest('.drag-handle')) return;

        e.preventDefault();
        e.stopPropagation();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        setIsDraggingControlBar(true);
        
        if (autoHideTimerRef.current) {
            clearTimeout(autoHideTimerRef.current);
        }
        
        dragStartOffset.current = {
            x: clientX - position.x,
            y: clientY - position.y
        };
    }, [isMobile, isCoWatchOpen, position]);

    useEffect(() => {
        const handleInteractionMove = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingControlBar) return;
            
            e.preventDefault();
            
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            
            setPosition({
                x: clientX - dragStartOffset.current.x,
                y: clientY - dragStartOffset.current.y
            });
        };

        const handleInteractionEnd = () => {
            if (!isDraggingControlBar) return;
            setIsDraggingControlBar(false);

            if (!ref.current) return;

            const { innerWidth, innerHeight } = window;
            const { offsetWidth, offsetHeight } = ref.current;
            
            const centerX = position.x + offsetWidth / 2;
            const centerY = position.y + offsetHeight / 2;

            const horizontalThird = innerWidth / 3;
            const verticalThird = innerHeight / 3;

            let newPosition: ControlBarPosition;

            if (centerY < verticalThird) {
                newPosition = 'top';
            }
            else if (centerY > innerHeight - verticalThird) {
                newPosition = 'bottom';
            }
            else {
                if (centerX < horizontalThird) {
                    newPosition = 'left';
                } else if (centerX > innerWidth - horizontalThird) {
                    newPosition = 'right';
                } else {
                    const distToLeft = centerX;
                    const distToRight = innerWidth - centerX;
                    newPosition = distToLeft < distToRight ? 'left' : 'right';
                }
            }

            setControlBarPosition(newPosition);
            startAutoHideTimer();
        };

        if (isDraggingControlBar) {
            window.addEventListener('mousemove', handleInteractionMove, { passive: false });
            window.addEventListener('touchmove', handleInteractionMove, { passive: false });
            window.addEventListener('mouseup', handleInteractionEnd);
            window.addEventListener('touchend', handleInteractionEnd);
        }
        
        return () => {
            window.removeEventListener('mousemove', handleInteractionMove);
            window.removeEventListener('touchmove', handleInteractionMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchend', handleInteractionEnd);
        };
    }, [isDraggingControlBar, position, setControlBarPosition, startAutoHideTimer]);

    if (isMobile) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50">
                <ControlBar />
            </div>
        );
    }

    const isVertical = controlBarPosition === 'left' || controlBarPosition === 'right';
    const isHorizontal = controlBarPosition === 'top' || controlBarPosition === 'bottom';

    return (
        <div
            ref={ref}
            className={cn(
                'fixed z-40 flex',
                isVertical && 'flex-col',
                isHorizontal && 'flex-row',
                "transition-all duration-300",
                isControlBarVisible ? "opacity-100" : "opacity-0 pointer-events-none",
                isDraggingControlBar && "cursor-grabbing"
            )}
            style={{
                left: position.x,
                top: position.y,
                transform: 'none',
                transition: isDraggingControlBar 
                    ? 'none' 
                    : 'left 0.3s ease-out, top 0.3s ease-out, opacity 0.3s ease-out',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className={cn(
                    "drag-handle touch-none flex items-center justify-center",
                    isVertical ? "py-2 px-1" : "px-2 py-1",
                    isCoWatchOpen ? "cursor-not-allowed opacity-50" : "cursor-grab hover:text-foreground",
                    isDraggingControlBar && "cursor-grabbing"
                )}
                onMouseDown={handleInteractionStart}
                onTouchStart={handleInteractionStart}
                title={isCoWatchOpen ? "Cannot move while CoWatch is open" : "Drag to reposition"}
            >
                {isVertical ? (
                    <GripHorizontal className={cn(
                        "w-5 h-5 transition-colors",
                        isCoWatchOpen ? "text-muted-foreground/50" : "text-muted-foreground"
                    )} />
                ) : (
                    <GripVertical className={cn(
                        "w-5 h-5 transition-colors",
                        isCoWatchOpen ? "text-muted-foreground/50" : "text-muted-foreground"
                    )} />
                )}
            </div>
            <ControlBar isVertical={isVertical} />
        </div>
    );
};

export const MemoizedDraggableControlBar = memo(DraggableControlBar);
export default MemoizedDraggableControlBar;
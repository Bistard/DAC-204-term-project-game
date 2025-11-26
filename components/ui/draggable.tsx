
import React, { useRef, useState } from 'react';

interface DraggableProps {
    children: React.ReactNode;
    onDrop?: () => void;
    onClick?: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    checkDropZone?: (x: number, y: number) => boolean;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    dragScale?: number;
}

export const Draggable: React.FC<DraggableProps> = ({
    children,
    onDrop,
    onClick,
    onDragStart,
    onDragEnd,
    checkDropZone,
    disabled = false,
    className = '',
    style = {},
    dragScale = 1.0,
}) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Internal refs for drag logic to avoid re-renders during move
    const dragStart = useRef<{ x: number, y: number } | null>(null);
    
    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled || e.button !== 0) return; // Only left click
        // Prevent default text selection etc
        e.preventDefault();
        e.stopPropagation();
        
        dragStart.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragStart.current || disabled) return;

        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;
        
        // Threshold to start drag (5px)
        if (!isDragging && Math.sqrt(deltaX*deltaX + deltaY*deltaY) > 5) {
            setIsDragging(true);
            onDragStart?.();
        }

        if (isDragging) {
            if (nodeRef.current) {
                nodeRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${dragScale})`;
                nodeRef.current.style.zIndex = '1000';
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragStart.current) return;
        (e.target as Element).releasePointerCapture(e.pointerId);
        
        const wasDragging = isDragging;
        dragStart.current = null;
        setIsDragging(false);
        onDragEnd?.();

        if (wasDragging) {
            // Check Drop
            const dropped = checkDropZone && checkDropZone(e.clientX, e.clientY);
            
            if (dropped && onDrop) {
                // Successful drop
                onDrop();
                // Reset styling immediately
                if (nodeRef.current) {
                    nodeRef.current.style.transform = '';
                    nodeRef.current.style.zIndex = '';
                }
            } else {
                // Invalid drop - Snap back
                if (nodeRef.current) {
                    nodeRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    nodeRef.current.style.transform = 'translate(0px, 0px) scale(1)';
                    nodeRef.current.style.zIndex = '1000'; // Keep on top while returning
                    
                    // Cleanup after animation
                    setTimeout(() => {
                        if (nodeRef.current) {
                            nodeRef.current.style.transition = '';
                            nodeRef.current.style.zIndex = '';
                            nodeRef.current.style.transform = '';
                        }
                    }, 300);
                }
            }
        } else {
            // It was just a click
            if (onClick && !disabled) {
                onClick();
            }
            // Ensure reset
             if (nodeRef.current) {
                nodeRef.current.style.transform = '';
                nodeRef.current.style.zIndex = '';
            }
        }
    };

    return (
        <div
            ref={nodeRef}
            className={`${className} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
            style={{ ...style, position: 'relative' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {children}
        </div>
    );
};

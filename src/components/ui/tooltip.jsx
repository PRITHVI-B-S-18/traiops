import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable Tooltip component
 * Supports positioning, delay, and multiple variants
 */
export const Tooltip = ({ 
  children, 
  content, 
  delay = 200,
  side = 'bottom',
  className,
  ...props 
}) => {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, isAbove: false });
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = (e) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShow(true);
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Calculate dynamic dimensions based on content
      const contentLines = content.split('\n').length;
      const isSimpleContent = contentLines <= 1 && content.length <= 20;
      const tooltipHeight = isSimpleContent ? 50 : Math.max(120, contentLines * 25 + 40);
      const tooltipWidth = isSimpleContent ? 150 : 220;
      
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      let x = rect.left + rect.width / 2;
      let y = rect.bottom + 8;
      
      // Adjust horizontal position if tooltip would go off-screen
      if (!isSimpleContent) {
        if (x + tooltipWidth / 2 > viewportWidth) {
          x = viewportWidth - tooltipWidth / 2 - 10;
        } else if (x - tooltipWidth / 2 < 0) {
          x = tooltipWidth / 2 + 10;
        }
      }
      
      // Adjust vertical position if tooltip would go off-screen
      let isAbove = false;
      if (y + tooltipHeight > viewportHeight) {
        y = rect.top - tooltipHeight - 8;
        isAbove = true;
      }
      
      setPosition({ x, y, isAbove });
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <span
        ref={containerRef}
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </span>
      {show && content && (
        <div
          className={cn(
            "fixed z-[9999] bg-slate-900 text-white text-sm rounded-lg shadow-xl border border-slate-700 whitespace-pre-line transform -translate-x-1/2 pointer-events-none",
            content.split('\n').length <= 1 && content.length <= 20 
              ? 'p-2 min-w-[120px] max-w-xs text-center' 
              : 'p-3 min-w-[200px] max-w-sm'
          )}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          role="tooltip"
        >
          <div className={cn(
            content.split('\n').length <= 1 && content.length <= 20 ? 'text-center' : 'space-y-1'
          )}>
            {content.split('\n').map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                {line}
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div 
            className={cn(
              "absolute left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-900 border border-slate-700 rotate-45",
              position.isAbove 
                ? '-bottom-1 border-b border-r border-t-0 border-l-0' 
                : '-top-1 border-l border-t border-b-0 border-r-0'
            )}
          />
        </div>
      )}
    </>
  );
};

export default Tooltip;


import { useState, useRef, useEffect, useId, type ReactNode } from "react";
import { Portal } from "./Portal";

interface GlassTooltipProps {
  text: string;
  children: ReactNode;
  position?: "right" | "top" | "bottom" | "left";
  disabled?: boolean;
}

export function GlassTooltip({
  text,
  children,
  position = "right",
  disabled = false,
}: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const isTouchRef = useRef(false);
  const tooltipId = useId();

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;
    let top = 0;
    let left = 0;

    switch (position) {
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        break;
      case "top":
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        break;
    }
    setCoords({ top, left });
  };

  const show = () => {
    if (disabled || isTouchRef.current) return;
    updateCoords();
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
      }
    };
    const handleScroll = () => hide();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        className="glass-tooltip-wrapper"
        style={{ display: "inline-flex" }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onTouchStart={() => {
          isTouchRef.current = true;
          hide();
        }}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </span>
      {isVisible && (
        <Portal>
          <div
            id={tooltipId}
            role="tooltip"
            className="glass-tooltip-bubble"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform:
                position === "right"
                  ? "translateY(-50%)"
                  : position === "left"
                  ? "translate(-100%, -50%)"
                  : position === "top"
                  ? "translate(-50%, -100%)"
                  : "translateX(-50%)",
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}

import React, { useRef } from "react";

export type SheetSnapPoint = "peek" | "half" | "full";

interface BottomSheetProps {
  snapPoint: SheetSnapPoint;
  onSnapChange: (point: SheetSnapPoint) => void;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  snapPoint,
  onSnapChange,
  children,
  headerContent
}) => {
  const dragStartY = useRef<number | null>(null);

  // Height configurations per snap point as specified:
  // 80px (peek) / 50vh (half) / 90vh (full)
  const heightClasses: Record<SheetSnapPoint, string> = {
    peek: "h-[80px]",
    half: "h-[50vh]",
    full: "h-[90vh]"
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;

    if (deltaY < -40) {
      // Swiped up
      if (snapPoint === "peek") onSnapChange("half");
      else if (snapPoint === "half") onSnapChange("full");
    } else if (deltaY > 40) {
      // Swiped down
      if (snapPoint === "full") onSnapChange("half");
      else if (snapPoint === "half") onSnapChange("peek");
    }
  };

  const cycleSnap = () => {
    if (snapPoint === "peek") onSnapChange("half");
    else if (snapPoint === "half") onSnapChange("full");
    else onSnapChange("peek");
  };

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 md:inset-x-auto md:left-4 md:bottom-4 md:w-[440px] md:max-w-[calc(100%-2rem)] bg-white rounded-t-[16px] md:rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.15)] border-t md:border border-[#E8EAED] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col ${heightClasses[snapPoint]}`}
    >
      {/* Drag Handle Container (36px wide, 4px tall, #DADCE0) */}
      <div
        className="pt-2 pb-1.5 px-4 flex flex-col items-center cursor-pointer select-none shrink-0"
        onClick={cycleSnap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-[36px] h-[4px] rounded-full bg-[#DADCE0] transition-colors hover:bg-[#BDC1C6]" />
      </div>

      {/* Optional persistent Header Content */}
      {headerContent && (
        <div className="px-4 pb-2 shrink-0 border-b border-[#F1F3F4]">
          {headerContent}
        </div>
      )}

      {/* Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        {children}
      </div>
    </div>
  );
};

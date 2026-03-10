import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SVG filter that creates the liquid glass distortion effect.
 * Render once at the top level (e.g. in App or layout).
 */
export function LiquidGlassFilter() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden="true">
      <defs>
        <filter id="liquid-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="3" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="12"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="0.5" result="blurred" />
          <feMerge>
            <feMergeNode in="blurred" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Intensity of the glass effect */
  intensity?: "subtle" | "medium" | "strong";
  /** Whether to show the animated shimmer */
  shimmer?: boolean;
  /** Whether to apply the SVG distortion filter on hover */
  distort?: boolean;
}

export const LiquidGlassCard = React.forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  ({ className, intensity = "medium", shimmer = false, distort = false, children, ...props }, ref) => {
    const intensityMap = {
      subtle: {
        bg: "bg-card/30",
        blur: "backdrop-blur-md",
        border: "border-white/[0.06]",
        shadow: "shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.06)]",
      },
      medium: {
        bg: "bg-card/40",
        blur: "backdrop-blur-xl",
        border: "border-white/[0.08]",
        shadow: "shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.1)]",
      },
      strong: {
        bg: "bg-card/50",
        blur: "backdrop-blur-2xl",
        border: "border-white/[0.12]",
        shadow: "shadow-[0_12px_60px_-12px_hsl(var(--primary)/0.15)]",
      },
    };

    const s = intensityMap[intensity];

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl border overflow-hidden transition-all duration-500",
          s.bg,
          s.blur,
          s.border,
          s.shadow,
          distort && "hover:[filter:url(#liquid-glass)]",
          className
        )}
        {...props}
      >
        {/* Inner refraction highlight */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.04] via-transparent to-white/[0.02]" />
        
        {/* Top edge light */}
        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
        
        {/* Shimmer overlay */}
        {shimmer && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
          </div>
        )}
        
        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);
LiquidGlassCard.displayName = "LiquidGlassCard";

interface LiquidGlassPillProps extends React.HTMLAttributes<HTMLDivElement> {}

export const LiquidGlassPill = React.forwardRef<HTMLDivElement, LiquidGlassPillProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full",
        "bg-card/30 backdrop-blur-xl border border-white/[0.08]",
        "shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.1)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
LiquidGlassPill.displayName = "LiquidGlassPill";

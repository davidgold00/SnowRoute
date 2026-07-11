import type { SVGProps } from "react";

type SnowRouteLogoProps = {
  compact?: boolean;
  className?: string;
};

export function SnowRouteMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  const isHidden = props["aria-hidden"] === true;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role={isHidden ? undefined : "img"}
      aria-label={isHidden ? undefined : "SnowRoute route boundary mark"}
      className={className}
      {...props}
    >
      <path
        d="M14 38.5c0-6.4 14-5.8 14-13.2 0-5.7-8-5.4-8-10.4 0-3.7 3.5-5.4 10.5-5.4H36"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 23.75h9M32 23.75h7"
        stroke="currentColor"
        strokeOpacity="0.42"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="38.5" r="3" fill="currentColor" />
      <circle cx="36" cy="9.5" r="3" fill="currentColor" />
    </svg>
  );
}

export function SnowRouteLogo({ compact = false, className }: SnowRouteLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-[#176c68] ${className ?? ""}`}>
      <SnowRouteMark className="h-8 w-8 shrink-0" aria-hidden="true" />
      {!compact ? (
        <span className="text-[1.05rem] font-bold tracking-[-0.035em] text-[#202927]">
          Snow<span className="text-[#176c68]">Route</span>
        </span>
      ) : null}
    </span>
  );
}

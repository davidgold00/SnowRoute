import type { SVGProps } from "react";

type SnowRouteLogoProps = {
  compact?: boolean;
  className?: string;
};

export function SnowRouteMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="SnowRoute route shield"
      className={className}
      {...props}
    >
      <path
        d="M24 3.75 40.5 9.9v12.45c0 10.08-6.48 18.42-16.5 21.9-10.02-3.48-16.5-11.82-16.5-21.9V9.9L24 3.75Z"
        fill="#102C3D"
        stroke="#76D5D1"
        strokeWidth="2.25"
      />
      <path
        d="M16.5 35.1c0-4.2 5.55-4.62 5.55-8.55 0-3.48-4.83-3.87-4.83-7.2 0-2.52 2.22-4.2 6.78-4.2h7.2"
        stroke="#F4FAFC"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="35.1" r="2.7" fill="#76D5D1" />
      <circle cx="31.2" cy="15.15" r="2.7" fill="#76D5D1" />
      <path
        d="M13.8 13.2h5.4m-2.7-2.7v5.4"
        stroke="#B8EDF0"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SnowRouteLogo({ compact = false, className }: SnowRouteLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <SnowRouteMark className="h-9 w-9 shrink-0" aria-hidden="true" />
      {!compact ? (
        <span className="text-[1.05rem] font-bold tracking-[-0.025em] text-white">
          Snow<span className="text-cyan-200">Route</span>
        </span>
      ) : null}
    </span>
  );
}

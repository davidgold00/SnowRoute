import type { CSSProperties } from "react";

const flakes = [
  { left: "4%", size: "0.32rem", duration: "12s", delay: "-1s", drift: "18px", opacity: 0.55 },
  { left: "9%", size: "0.42rem", duration: "16s", delay: "-7s", drift: "-14px", opacity: 0.6 },
  { left: "16%", size: "0.26rem", duration: "13s", delay: "-4s", drift: "10px", opacity: 0.5 },
  { left: "22%", size: "0.36rem", duration: "17s", delay: "-10s", drift: "24px", opacity: 0.62 },
  { left: "29%", size: "0.22rem", duration: "11s", delay: "-2s", drift: "-8px", opacity: 0.46 },
  { left: "34%", size: "0.4rem", duration: "15s", delay: "-12s", drift: "16px", opacity: 0.54 },
  { left: "41%", size: "0.3rem", duration: "14s", delay: "-5s", drift: "-18px", opacity: 0.48 },
  { left: "48%", size: "0.46rem", duration: "18s", delay: "-9s", drift: "12px", opacity: 0.66 },
  { left: "54%", size: "0.24rem", duration: "10s", delay: "-3s", drift: "-10px", opacity: 0.44 },
  { left: "60%", size: "0.34rem", duration: "16s", delay: "-11s", drift: "22px", opacity: 0.58 },
  { left: "67%", size: "0.28rem", duration: "12s", delay: "-6s", drift: "-12px", opacity: 0.47 },
  { left: "73%", size: "0.44rem", duration: "19s", delay: "-8s", drift: "18px", opacity: 0.64 },
  { left: "79%", size: "0.26rem", duration: "13s", delay: "-1.5s", drift: "-9px", opacity: 0.45 },
  { left: "84%", size: "0.38rem", duration: "17s", delay: "-13s", drift: "14px", opacity: 0.57 },
  { left: "90%", size: "0.22rem", duration: "11s", delay: "-4.5s", drift: "-16px", opacity: 0.43 },
  { left: "95%", size: "0.34rem", duration: "15s", delay: "-7.5s", drift: "9px", opacity: 0.52 },
];

export function Snowfall() {
  return (
    <div aria-hidden="true" className="snowfall">
      {flakes.map((flake, index) => {
        const style = {
          left: flake.left,
          width: flake.size,
          height: flake.size,
          opacity: flake.opacity,
          animationDuration: flake.duration,
          animationDelay: flake.delay,
          "--snow-drift": flake.drift,
        } as CSSProperties;

        return <span key={`${flake.left}-${index}`} className="snowflake" style={style} />;
      })}
    </div>
  );
}

import Image from "next/image";

/**
 * The Nexarrow mark on a round tile with no border: a soft grey fade in light mode and a
 * dark fade in dark mode. Used wherever the app shows its logo (sidebar, sign-in).
 */
export default function BrandMark({ darkMode = false, size = 36, className = "" }) {
  const inner = Math.round(size * 0.66);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${
        darkMode ? "bg-[linear-gradient(145deg,#303136_0%,#16171a_100%)]" : "bg-[linear-gradient(145deg,#f7f7f5_0%,#e1e1dd_100%)]"
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/brand-mark.svg" alt="" width={inner} height={inner} unoptimized preload style={{ width: inner, height: inner }} />
    </span>
  );
}

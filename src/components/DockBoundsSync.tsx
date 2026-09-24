import { useEffect } from "react";

/**
 * Keeps docked panels aligned to the real editor workspace instead of guessing
 * their top/bottom from duplicated timeline sizes in CSS.
 */
export default function DockBoundsSync() {
  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const timeline = document.querySelector<HTMLElement>(".timeline-region");
      const tools = document.querySelector<HTMLElement>(".workspace-tools");

      const top = topbar?.getBoundingClientRect().bottom ?? 58;
      const timelineVisible =
        !!timeline && getComputedStyle(timeline).display !== "none";
      const bottom = timelineVisible
        ? Math.max(0, window.innerHeight - timeline.getBoundingClientRect().top)
        : 0;
      const railVisible = !!tools && getComputedStyle(tools).display !== "none";
      const rail = railVisible ? Math.round(tools.getBoundingClientRect().width || 68) : 0;

      root.style.setProperty("--kiro-dock-top", `${Math.round(top)}px`);
      root.style.setProperty("--kiro-dock-bottom", `${Math.round(bottom)}px`);
      root.style.setProperty("--kiro-rail-width", `${rail}px`);
    };

    sync();
    const observer = new ResizeObserver(sync);
    document.querySelectorAll(".topbar,.timeline-region,.workspace-tools,.app-shell").forEach((el) => observer.observe(el));
    window.addEventListener("resize", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  return null;
}

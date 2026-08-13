"use client";
import { useEffect } from "react";

// Controls the open/closed state of the sticky "Contents" panel on /help/kb.
//
// Mobile (<=720px): collapsed by default — the sticky bar is just the compact
// "Contents" summary so it never eats the small viewport.
//
// Desktop (>720px): the panel is open at the top of the page, but once it pins
// under the header (you've scrolled past it) it collapses to the same compact
// bar, then re-opens when you scroll back to the top. A 1px sentinel placed just
// above the panel tells us, via IntersectionObserver, whether we're pinned.
//
// Either way, tapping a TOC link collapses the panel so the section you jump to
// isn't left sitting underneath an expanded list.
export default function HelpTocMobile() {
  useEffect(() => {
    const toc = document.getElementById("help-toc") as HTMLDetailsElement | null;
    if (!toc) return;

    const isMobile = () => window.matchMedia("(max-width: 720px)").matches;
    if (isMobile()) toc.open = false;

    // Desktop: a sentinel above the panel; when it scrolls out of view past the
    // 55px header, the panel is pinned -> collapse. When it's back in view (top
    // of page) -> expand. rootMargin's top -56px aligns the trigger to the
    // sticky header edge.
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    toc.parentElement?.insertBefore(sentinel, toc);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (isMobile()) return; // mobile collapse is handled above + on click
        toc.open = entry.isIntersecting;
      },
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 }
    );
    io.observe(sentinel);

    const onLinkClick = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest("a")) toc.open = false;
    };
    toc.addEventListener("click", onLinkClick);

    return () => {
      io.disconnect();
      sentinel.remove();
      toc.removeEventListener("click", onLinkClick);
    };
  }, []);
  return null;
}

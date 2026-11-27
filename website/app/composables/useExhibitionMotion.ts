export function useExhibitionMotion(
  root: Ref<HTMLElement | null>,
  paused: Ref<boolean>,
) {
  let cleanup: (() => void) | undefined;
  let stopWatcher: (() => void) | undefined;
  let removePreferenceListener: (() => void) | undefined;
  let mounted = false;
  let generation = 0;

  onMounted(() => {
    mounted = true;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const configure = async () => {
      const current = ++generation;
      cleanup?.();
      cleanup = undefined;
      if (paused.value || preference.matches || !root.value) return;

      // Static HTML remains the complete experience if animation fails to load.
      let modules;
      try {
        modules = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);
      } catch {
        return;
      }
      if (
        !mounted ||
        current !== generation ||
        paused.value ||
        preference.matches ||
        !root.value
      )
        return;

      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = modules;
      gsap.registerPlugin(ScrollTrigger);
      const host = root.value;
      const lenis = new Lenis({
        autoRaf: false,
        smoothWheel: true,
        syncTouch: false,
        duration: 0.9,
        anchors: true,
        // The contact sheet owns its native horizontal scrolling.
        prevent: (node) => node.classList.contains("gallery-track"),
      });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      let ticking = false;
      const startTicker = () => {
        if (!ticking) gsap.ticker.add(tick);
        ticking = true;
      };
      const stopTicker = () => {
        gsap.ticker.remove(tick);
        ticking = false;
      };
      const syncPlayback = () => {
        if (document.hidden || document.querySelector("dialog[open]")) {
          lenis.stop();
          stopTicker();
        } else {
          lenis.start();
          startTicker();
        }
      };
      syncPlayback();

      const mediaQueries = gsap.matchMedia();
      const ctx = gsap.context(() => {
        // The image settles first; the title and small editorial details follow.
        // Opacity never starts at zero, so the opening stays legible throughout.
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from(
            ".hero-image img",
            {
              scale: 1.045,
              duration: 1.65,
              clearProps: "transform",
            },
            0,
          )
          .from(
            ".hero-title .word",
            {
              y: 32,
              opacity: 0.65,
              duration: 1.15,
              stagger: 0.1,
              clearProps: "transform,opacity",
            },
            0.12,
          )
          .from(
            ".hero-overline, .hero-footer",
            {
              y: 10,
              opacity: 0.65,
              duration: 0.85,
              stagger: 0.1,
              clearProps: "transform,opacity",
            },
            0.32,
          );

        host
          .querySelectorAll("[data-heading]:not(.hero-title)")
          .forEach((heading) => {
            const words = heading.querySelectorAll(".word");
            if (!words.length) return;
            gsap.from(words, {
              y: 26,
              opacity: 0.55,
              duration: 0.95,
              stagger: 0.055,
              ease: "power3.out",
              clearProps: "transform,opacity",
              scrollTrigger: {
                trigger: heading,
                start: "top 92%",
                once: true,
              },
            });
          });

        host.querySelectorAll("[data-reveal]").forEach((element) => {
          gsap.from(element, {
            y: 18,
            opacity: 0.6,
            duration: 0.9,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: element,
              start: "top 94%",
              once: true,
            },
          });
        });

        host
          .querySelectorAll(".principle-image img, .exhibition-photo img")
          .forEach((image) => {
            gsap.from(image, {
              scale: 1.045,
              duration: 1.6,
              ease: "power2.out",
              clearProps: "transform",
              scrollTrigger: {
                trigger:
                  image.closest(".principle-image, .exhibition-photo") || image,
                start: "top 90%",
                once: true,
              },
            });
          });

        // Depth follows ordinary vertical scrolling on desktop. Touch layouts
        // keep their natural position and never enter a pinned/scrubbed scene.
        mediaQueries.add("(min-width: 900px) and (pointer: fine)", () => {
          const hero = host.querySelector(".hero");
          if (!hero) return;
          const image = hero.querySelector(".hero-image");
          const title = hero.querySelector(".hero-title");
          if (image) {
            gsap.to(image, {
              yPercent: 12,
              scale: 1.035,
              ease: "none",
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            });
          }
          if (title) {
            gsap.to(title, {
              y: -50,
              ease: "none",
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            });
          }
        });
      }, host);

      const refresh = () => {
        if (!mounted || current !== generation) return;
        lenis.resize();
        ScrollTrigger.refresh();
      };
      const images = [...host.querySelectorAll("img")];
      images.forEach((image) =>
        image.addEventListener("load", refresh, { once: true }),
      );
      void document.fonts.ready.then(refresh);
      const onDialog = () => {
        syncPlayback();
        refresh();
      };
      const seek = (event: Event) => lenis.scrollTo(Number((event as CustomEvent<number>).detail), { immediate: true });
      window.addEventListener("exhibition:seek", seek);
      window.addEventListener("exhibition:dialog", onDialog);
      window.addEventListener("exhibition:layout", refresh);
      document.addEventListener("visibilitychange", syncPlayback);

      cleanup = () => {
        mediaQueries.revert();
        ctx.revert();
        stopTicker();
        lenis.destroy();
        images.forEach((image) => image.removeEventListener("load", refresh));
        window.removeEventListener("exhibition:seek", seek);
        window.removeEventListener("exhibition:dialog", onDialog);
        window.removeEventListener("exhibition:layout", refresh);
        document.removeEventListener("visibilitychange", syncPlayback);
      };
      refresh();
    };

    const onPreference = () => void configure();
    preference.addEventListener("change", onPreference);
    removePreferenceListener = () =>
      preference.removeEventListener("change", onPreference);
    stopWatcher = watch(paused, () => void configure());
    void configure();
  });

  onBeforeUnmount(() => {
    mounted = false;
    generation++;
    stopWatcher?.();
    removePreferenceListener?.();
    cleanup?.();
  });
}

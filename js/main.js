/* ============================================================
   KAGE — GSAP + Lenis scroll experience
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Lenis smooth scroll ---------- */
let lenis = null;
if (!reduceMotion && typeof Lenis !== "undefined") {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.05 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* anchor links through Lenis */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -20, duration: 1.4 });
    else target.scrollIntoView({ behavior: "smooth" });
  });
});

/* ---------- helpers ---------- */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = "";
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    const s = document.createElement("span");
    s.className = "char";
    s.innerHTML = ch === " " ? "&nbsp;" : ch;
    frag.appendChild(s);
  }
  el.appendChild(frag);
  return el.querySelectorAll(".char");
}

function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="word">${w}</span>`).join(" ");
  return el.querySelectorAll(".word");
}

/* ---------- QR mock (decorative pattern) ---------- */
(function drawQR() {
  const svg = document.getElementById("qrSvg");
  if (!svg) return;
  const N = 29;
  let cells = "";
  const finder = (x, y) =>
    `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="var(--paper,#f4efe4)"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  let seed = 46630;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inFinder =
        (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inFinder && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  svg.innerHTML = cells + finder(0, 0) + finder(N - 7, 0) + finder(0, N - 7);
})();

/* ---------- intro: hero ---------- */
const heroChars = [];
document.querySelectorAll("[data-split]").forEach((el) => heroChars.push(...splitChars(el)));

const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
intro
  .set("body", { autoAlpha: 1 })
  .from(heroChars, {
    yPercent: 115,
    rotation: 6,
    duration: 1.1,
    stagger: 0.035,
  })
  .from("#heroSub", { y: 26, autoAlpha: 0, duration: 0.8 }, "-=0.55")
  .from("#heroMeta", { y: 18, autoAlpha: 0, duration: 0.7 }, "-=0.5")
  .from("#scrollCue", { autoAlpha: 0, duration: 0.6 }, "-=0.3");

gsap.from(".nav", {
  y: -24,
  autoAlpha: 0,
  duration: 0.7,
  delay: 1.1,
  ease: "power4.out",
  clearProps: "opacity,visibility",
});

/* enso draw-on */
const enso = document.getElementById("ensoPath");
if (enso) {
  const len = enso.getTotalLength();
  gsap.set(enso, { strokeDasharray: len, strokeDashoffset: len });
  intro.to(enso, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, 0.15);
}

/* hero parallax on scroll */
gsap.to(".hero__kanji", {
  yPercent: 28,
  ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
});
gsap.to(".hero__enso", {
  yPercent: 16,
  rotation: 8,
  ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
});
gsap.to("#heroTitle", {
  yPercent: -14,
  ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
});
const heroImg = document.querySelector(".hero__img");
if (heroImg) {
  intro.from(heroImg, { scale: 1.06, autoAlpha: 0, duration: 1.4, ease: "power2.out" }, 0.3);
  gsap.to(heroImg, {
    yPercent: 10,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
}

/* ---------- progress bar ---------- */
gsap.to("#progressBar", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
});

/* ---------- nav hide on scroll down ---------- */
let lastY = 0;
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate(self) {
    const y = self.scroll();
    const nav = document.getElementById("nav");
    if (y > 140 && y > lastY + 4) nav.classList.add("is-hidden");
    else if (y < lastY - 4) nav.classList.remove("is-hidden");
    lastY = y;
  },
});

/* ---------- marquee (scroll-speed reactive) ---------- */
document.querySelectorAll("[data-marquee]").forEach((track) => {
  const tween = gsap.to(track, { xPercent: -33.333, ease: "none", duration: 18, repeat: -1 });
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const v = gsap.utils.clamp(0.5, 4, 1 + Math.abs(self.getVelocity()) / 900);
      gsap.to(tween, { timeScale: v, duration: 0.4, overwrite: true });
    },
  });
});

/* ---------- manifesto word scrub ---------- */
const manifestoWords = splitWords(document.getElementById("manifestoText"));
gsap.to(manifestoWords, {
  opacity: 1,
  stagger: 0.6,
  ease: "none",
  scrollTrigger: {
    trigger: "#manifesto",
    start: "top 72%",
    end: "bottom 65%",
    scrub: true,
  },
});

/* ---------- statement: pin + scale ---------- */
const stTitle = document.getElementById("statementTitle");
gsap.from(stTitle, {
  scale: 0.82,
  autoAlpha: 0,
  ease: "none",
  scrollTrigger: {
    trigger: "#statement",
    start: "top 85%",
    end: "center center",
    scrub: true,
  },
});
const stroke = document.getElementById("strokePath");
if (stroke) {
  const len = stroke.getTotalLength();
  gsap.set(stroke, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(stroke, {
    strokeDashoffset: 0,
    ease: "none",
    scrollTrigger: {
      trigger: "#statement",
      start: "top 45%",
      end: "center 35%",
      scrub: true,
    },
  });
}

/* ---------- features: reveals + mock parallax ---------- */
document.querySelectorAll("[data-feature]").forEach((feat) => {
  const copyEls = feat.querySelectorAll(".feature__no, .feature__title, .feature__text, .chips");
  gsap.from(copyEls, {
    y: 48,
    autoAlpha: 0,
    duration: 0.9,
    stagger: 0.12,
    ease: "power3.out",
    scrollTrigger: { trigger: feat, start: "top 72%" },
  });

  const mock = feat.querySelector("[data-mock]");
  gsap.from(mock, {
    y: 70,
    rotation: gsap.utils.random(-3, 3),
    autoAlpha: 0,
    duration: 1.1,
    ease: "power3.out",
    scrollTrigger: { trigger: feat, start: "top 75%" },
  });
  gsap.to(mock.querySelector(".ui"), {
    y: -34,
    ease: "none",
    scrollTrigger: { trigger: feat, start: "top bottom", end: "bottom top", scrub: true },
  });

  const seal = feat.querySelector(".feature__seal");
  if (seal) {
    gsap.from(seal, {
      scale: 0,
      rotation: -30,
      duration: 0.7,
      ease: "back.out(2.5)",
      scrollTrigger: { trigger: feat, start: "top 65%" },
    });
  }
});

/* ---------- counter (block height) ---------- */
document.querySelectorAll("[data-count]").forEach((el) => {
  const target = parseInt(el.dataset.count, 10);
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target,
    duration: 2.2,
    ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 85%" },
    onUpdate() {
      el.textContent = Math.floor(obj.v).toLocaleString("en-US");
    },
  });
});

/* ---------- generic reveals ---------- */
document.querySelectorAll("[data-reveal]").forEach((el) => {
  gsap.from(el, {
    y: 44,
    autoAlpha: 0,
    duration: 0.9,
    ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 82%" },
  });
});

/* bridge mock */
const bridgeMock = document.querySelector(".bridge__mock");
if (bridgeMock) {
  gsap.from(bridgeMock, {
    y: 80,
    autoAlpha: 0,
    rotation: 2,
    duration: 1.1,
    ease: "power3.out",
    scrollTrigger: { trigger: "#bridge", start: "top 70%" },
  });
}

/* ---------- FAQ giant kanji + accordion ---------- */
gsap.from(".faq__giant", {
  scale: 0.6,
  rotation: -8,
  autoAlpha: 0,
  duration: 1,
  ease: "back.out(1.6)",
  scrollTrigger: { trigger: ".faq__head", start: "top 75%" },
});
gsap.from(".faq__headcopy > *", {
  x: 40,
  autoAlpha: 0,
  duration: 0.8,
  stagger: 0.12,
  ease: "power3.out",
  scrollTrigger: { trigger: ".faq__head", start: "top 75%" },
});
gsap.from(".qa", {
  y: 36,
  autoAlpha: 0,
  duration: 0.7,
  stagger: 0.08,
  ease: "power3.out",
  scrollTrigger: { trigger: ".faq__list", start: "top 80%" },
});

/* accordion: animate open/close */
document.querySelectorAll(".qa").forEach((qa) => {
  const summary = qa.querySelector("summary");
  const body = qa.querySelector(".qa__a");
  summary.addEventListener("click", (e) => {
    e.preventDefault();
    if (qa.open) {
      gsap.to(body, {
        height: 0,
        autoAlpha: 0,
        duration: 0.4,
        ease: "power2.inOut",
        onComplete: () => { qa.open = false; gsap.set(body, { clearProps: "all" }); },
      });
    } else {
      qa.open = true;
      gsap.set(body, { height: "auto" });
      gsap.from(body, { height: 0, autoAlpha: 0, duration: 0.5, ease: "power3.out" });
      gsap.from(body.querySelector("p"), { y: 14, autoAlpha: 0, duration: 0.45, delay: 0.1 });
    }
  });
});

/* ---------- CTA kanji slow spin-parallax ---------- */
gsap.fromTo(".cta__kanji",
  { yPercent: 22, rotation: -4 },
  {
    yPercent: -22,
    rotation: 4,
    ease: "none",
    scrollTrigger: { trigger: ".cta", start: "top bottom", end: "bottom top", scrub: true },
  }
);

/* ---------- footer giant text slide ---------- */
gsap.fromTo("#footerGiant",
  { x: 120 },
  {
    x: -220,
    ease: "none",
    scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true },
  }
);

/* ---------- section theme flip for nav (optional subtlety) ---------- */
/* keep nav readable: it is already dark pill on both themes */

/* CA badge: click to copy */
const caBtn = document.getElementById("heroCa");
if (caBtn && caBtn.dataset.ca) {
  caBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(caBtn.dataset.ca);
      const v = caBtn.querySelector(".ca__label");
      const old = v.textContent;
      v.textContent = "COPIED \u2713";
      setTimeout(() => (v.textContent = old), 1500);
    } catch {}
  });
}

const tokCa = document.getElementById("tokenCa");
if (tokCa) {
  tokCa.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(tokCa.dataset.ca);
      const c = tokCa.querySelector(".token__copy");
      c.textContent = "COPIED \u2713";
      setTimeout(() => (c.textContent = "COPY"), 1500);
    } catch {}
  });
}

window.addEventListener("load", () => ScrollTrigger.refresh());

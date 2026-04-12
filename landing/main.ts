import "./style.css";
import "../src/styles/theme.css";
import { ElixirDataViewer } from "../src/renderer";

let demoViewer: ElixirDataViewer | null = null;

/* ===== Demo Viewer ===== */
function initDemoViewer(): void {
  const el = document.getElementById("demo-viewer");
  if (!el) return;

  const script = el.querySelector('script[type="text/elixir-data"]');
  if (!script) return;

  const data = script.textContent?.trim() ?? "";
  script.remove();

  const viewer = new ElixirDataViewer(el);
  viewer.setContent(data);
  demoViewer = viewer;
}

/* ===== Hero Canvas — Particle Network ===== */
function initHeroCanvas(): void {
  const canvas = document.getElementById("hero-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let animId = 0;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
  }

  const particles: Particle[] = [];
  const PARTICLE_COUNT = 60;
  const CONNECTION_DIST = 140;
  const COLORS = ["187,154,247", "122,162,247", "125,207,255", "158,206,106"];

  function resize(): void {
    const hero = canvas!.parentElement!.parentElement!;
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas!.width = width * devicePixelRatio;
    canvas!.height = height * devicePixelRatio;
    canvas!.style.width = width + "px";
    canvas!.style.height = height + "px";
    ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function createParticles(): void {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }
  }

  function draw(): void {
    ctx!.clearRect(0, 0, width, height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const opacity = (1 - dist / CONNECTION_DIST) * 0.15;
          ctx!.strokeStyle = `rgba(187, 154, 247, ${opacity})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(particles[i].x, particles[i].y);
          ctx!.lineTo(particles[j].x, particles[j].y);
          ctx!.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      const color = COLORS[Math.floor(p.alpha * COLORS.length) % COLORS.length];
      ctx!.fillStyle = `rgba(${color}, ${p.alpha})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function update(): void {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      // Keep in bounds
      p.x = Math.max(0, Math.min(width, p.x));
      p.y = Math.max(0, Math.min(height, p.y));
    }
  }

  function animate(): void {
    update();
    draw();
    animId = requestAnimationFrame(animate);
  }

  resize();
  createParticles();
  animate();

  window.addEventListener("resize", () => {
    cancelAnimationFrame(animId);
    resize();
    createParticles();
    animate();
  });
}

/* ===== Tab Switching ===== */
function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
  const panels = document.querySelectorAll<HTMLElement>(".tab-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      if (!target) return;

      tabs.forEach((t) => t.classList.remove("tab--active"));
      panels.forEach((p) => p.classList.remove("tab-panel--active"));

      tab.classList.add("tab--active");
      const panel = document.getElementById(`tab-${target}`);
      panel?.classList.add("tab-panel--active");
    });
  });
}

/* ===== Copy Buttons ===== */
function initCopyButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".copy-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.copy;
      if (!targetId) return;

      const codeEl = document.getElementById(targetId);
      if (!codeEl) return;

      const text = codeEl.textContent ?? "";

      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = "✓ Copied!";
        btn.classList.add("copy-btn--copied");
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove("copy-btn--copied");
        }, 2000);
      } catch {
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  });
}

/* ===== Mobile Nav Toggle ===== */
function initMobileNav(): void {
  const toggle = document.getElementById("navbar-toggle");
  const links = document.getElementById("navbar-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("navbar-links--open");
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("navbar-links--open");
    });
  });
}

/* ===== Navbar Scroll Effect ===== */
function initNavbarScroll(): void {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.style.background = "rgba(74, 45, 92, 0.98)";
    } else {
      navbar.style.background = "rgba(74, 45, 92, 0.92)";
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ===== Custom Data Modal ===== */
function initModal(): void {
  const overlay = document.getElementById("modal-overlay");
  const textarea = document.getElementById("modal-textarea") as HTMLTextAreaElement | null;
  const btnOpen = document.getElementById("btn-custom-data");
  const btnClose = document.getElementById("modal-close");
  const btnCancel = document.getElementById("modal-cancel");
  const btnApply = document.getElementById("modal-apply");

  if (!overlay || !textarea || !btnOpen) return;

  function openModal(): void {
    // Pre-fill with current viewer content
    if (demoViewer) {
      textarea!.value = demoViewer.getContent();
    }
    overlay!.classList.add("modal-overlay--visible");
    document.body.style.overflow = "hidden";
    setTimeout(() => textarea!.focus(), 100);
  }

  function closeModal(): void {
    overlay!.classList.remove("modal-overlay--visible");
    document.body.style.overflow = "";
  }

  function applyData(): void {
    const data = textarea!.value.trim();
    if (data && demoViewer) {
      demoViewer.setContent(data);
    }
    closeModal();
    // Scroll to demo
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  }

  btnOpen.addEventListener("click", openModal);
  btnClose?.addEventListener("click", closeModal);
  btnCancel?.addEventListener("click", closeModal);
  btnApply?.addEventListener("click", applyData);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close on Escape, apply on Ctrl+Enter
  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("modal-overlay--visible")) return;
    if (e.key === "Escape") closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") applyData();
  });
}

/* ===== Init All ===== */
document.addEventListener("DOMContentLoaded", () => {
  initDemoViewer();
  initHeroCanvas();
  initTabs();
  initCopyButtons();
  initMobileNav();
  initNavbarScroll();
  initModal();
});

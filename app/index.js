import { prefersReducedMotion } from "./utils.js";
import "./scene.js";
import "./scenemsgr.js";

function observeIntersections() {

  // Make articles appear when scrolled into view from above. Also disable CSS
  // animations, incl. inner animations where `animation-play-state: inherit`.
  const articleObserver = new IntersectionObserver(items =>
    items.forEach(({ target: { id, style }, isIntersecting, boundingClientRect: { top } }) => {
      if (id == "webdev") return;
      if (isIntersecting) {
        Object.assign(style, {
          transition: "all .4s ease-out",
          translate: "0",
          opacity: "1",
          "animation-play-state": "running"
        });
      } else {
        Object.assign(style, {
          "animation-play-state": "paused"
        });
        if (top > 0) {
          Object.assign(style, {
            transition: "",
            translate: "0 3rem",
            opacity: "0"
          });
        }
      }
    }),
    { rootMargin: "20px" }
  );
  document.querySelectorAll("section.references article").forEach(sentry => articleObserver.observe(sentry));

  // Likewise, enable embedded animations in SVGs when visible, disable them otherwise.
  const svgObserver = new IntersectionObserver(items =>
    items.forEach(({ target, isIntersecting }) => {
      const doc = target.contentDocument;
      doc.children[0].style["animation-play-state"] = isIntersecting ? "running" : "paused";
    }),
    { rootMargin: "20px" }
  );
  document.querySelectorAll("section.references article object[type=\"image/svg+xml\"").forEach(sentry => svgObserver.observe(sentry));
}

function getTextContent(node) {
  if (node.textContent) return node.textContent;
  const children = node.children;
  for (let i = 0; i < children.length; ++i) {
    const textContent = getTextContent(children[i]);
    if (textContent) return textContent;
  }
  return null;
}

function observeMutations() {

  // Synchronize translated headings with CSS animation
  const observer = new MutationObserver(mutationList => {
    mutationList.forEach(({ target }) => {
      const newTextContent = getTextContent(target);
      if (newTextContent) target.setAttribute("data-text", newTextContent);
    });
  });
  document.querySelectorAll("h1, h2")
    .forEach(item => observer.observe(item, { characterData: true, childList: true }));
}

function observeScrolls() {
  const scrollElements = document.querySelectorAll(".scroll");
  let lastScroll = scrollY;
  function update(element) {
    const bounds = element.getBoundingClientRect();
    const p = bounds.top > innerHeight
      ? 0.0
      : bounds.bottom < 0
        ? 1.0
        : 1.0 - bounds.bottom / (innerHeight + bounds.height);
    element.style.setProperty("--scroll", p.toFixed(3));
  }
  function handle() {
    if (lastScroll == scrollY) return;
    lastScroll = scrollY;
    scrollElements.forEach(update);
  }
  addEventListener("scroll", handle);
  addEventListener("resize", handle);
  scrollElements.forEach(update);
}

function observeMouse() {
  const mouseElements = document.querySelectorAll(".mouse");
  addEventListener("mousemove", evt => {
    mouseElements.forEach(element => {
      const bounds = element.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      const dx = 2 * (evt.clientX - x) / bounds.width;
      const dy = 2 * (evt.clientY - y) / bounds.height;
      element.style.setProperty("--mouse-dx", dx.toFixed(3));
      element.style.setProperty("--mouse-dy", dy.toFixed(3));      
    });
  });
}

function hookNavigation() {
  // Upgrade to a more app-like experience on local navigation when JS is
  // available. Page fragments aren't carried around intentionally here.
  const legalPopup = document.getElementById("legal");
  document.querySelectorAll("a").forEach(a => {
    const match = a.href.match(/\/#([\w-]+)/);
    if (!match) return;
    const target = match[1];
    const elem = document.getElementById(target);
    if (!elem && target != "back" && target != "up") return;
    a.addEventListener("click", evt => {
      if (target == "legal") {
        legalPopup.classList.add("active");
      } else {
        legalPopup.classList.remove("active");
        if (target != "back") {
          if (target != "up") {
            elem.style.translate = "0 0"; // Suppress default animation
          }
          scrollBy({
            top: elem.getBoundingClientRect().top - (innerWidth >= 1024 ? 62 : 16),
            behavior: prefersReducedMotion ? "auto" : "smooth"
          });
        }
      }
      evt.preventDefault();
      return false;
    });
  });
}

function hookShare() {
  const data = {
    title: document.title,
    text: document.querySelector('meta[name="description"]').content,
    url: "https://dcode.io"
  };
  const share = document.getElementById("share");
  if (navigator.share && navigator.canShare(data)) {
    share.style.display = "inline";
    share.addEventListener("click", evt => {
      evt.preventDefault();
      (async () => {
        await navigator.share(data);
      })();
      return false;
    });
  } else {
    share.style.display = "none";
  }
}

function observeUp() {
  const uplink = document.getElementById("uplink");
  const min = document.getElementById("webdev");
  addEventListener("scroll", () => {
    const visible = min.getBoundingClientRect().top < 0;
    uplink.style.opacity = visible ? "1.0" : "0";
  });
}

addEventListener("load", () => {
  if (window.IntersectionObserver) observeIntersections();
  if (window.MutationObserver) observeMutations();
  observeScrolls();
  observeMouse();
  hookNavigation();
  hookShare();
  observeUp();
});

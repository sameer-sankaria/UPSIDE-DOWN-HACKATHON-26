// motion-gate

const supportsScrollTimelines = CSS.supports('height: 100svh')
  && CSS.supports('view-timeline: --navi-probe block')
  && CSS.supports('animation-timeline: --navi-probe')
  && CSS.supports('animation-range: cover 0% cover 100%');
if (matchMedia('(prefers-reduced-motion: no-preference)').matches
  && matchMedia('(min-height: 560px)').matches
  && supportsScrollTimelines) document.documentElement.setAttribute('data-8b-live', '');

// section-script:navigation

(() => {
  const nav = document.getElementById('navigation');
  const toggle = nav.querySelector('.nav__menu');
  const menu = nav.querySelector('.menu');
  const close = menu.querySelector('.menu__close');
  const setOpen = open => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) { window.motionKit?.wheel?.stop(); close.focus(); } else { window.motionKit?.wheel?.start(); toggle.focus(); }
  };
  toggle.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key !== 'Tab') return;
    const items = [...menu.querySelectorAll('a, button')];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); window.motionKit?.wheel?.start(); }));
})();

// section-script:hero

(() => {
  const hero = document.getElementById('hero');
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => hero.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(hero);
})();

// motion-kit

(() => {
const live = document.documentElement.hasAttribute('data-8b-live');
const measures = new Set();
let queued = false;
const run = fn => { try { fn(); } catch (error) { console.error('[motion-kit] measure failed', error); } };
const remeasure = () => {
if (queued) return;
queued = true;
requestAnimationFrame(() => { queued = false; measures.forEach(run); realign(); });
};
const realign = () => document.getAnimations().forEach(animation => {
if (animation.timeline && animation.timeline !== document.timeline && animation.playState === 'running') { animation.pause(); animation.play(); }
});
window.motionKit = {
live,
box(element) {
if (!(element instanceof HTMLElement)) { const r = element.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }
let x = 0, y = 0, node = element;
while (node) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
return { x, y, w: element.offsetWidth, h: element.offsetHeight };
},
set(element, vars) { for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, String(value)); },
measure(fn) { if (!live) return; measures.add(fn); run(fn); },
scene(id, fn) {
if (!live) return;
try { fn(); } catch (error) {
console.error(`[motion-kit] scene ${id} failed; its section stays static`, error);
document.querySelector(`style[data-8b-part="scene:${id}"]`)?.setAttribute('media', 'not all');
}
}
};
if (!live) { window.motionReady = Promise.resolve(); return; }
const number = () => document.querySelectorAll('[data-8b-items]').forEach(group => {
let items;
try { items = [...group.querySelectorAll(group.getAttribute('data-8b-items'))]; } catch { return; }
items.forEach((item, index) => { item.style.setProperty('--i', index); item.style.setProperty('--n', items.length); });
});
number();
measures.add(number);
requestAnimationFrame(realign);
const resizeObserver = new ResizeObserver(remeasure);
[document.body, ...document.querySelectorAll('#work .work__stage, #work .work__track, #work .case__tag, #work .case__text, #work .case__line')]
  .filter(element => element instanceof Element)
  .forEach(element => resizeObserver.observe(element));
addEventListener('resize', remeasure, { passive: true });
document.fonts?.ready.then(remeasure);
addEventListener('load', remeasure);
window.motionReady = (document.fonts?.ready ?? Promise.resolve()).then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
})();
(() => {
const kit = window.motionKit;
if (!kit.live || !matchMedia('(pointer: fine)').matches) return;
let target = scrollY, current = scrollY, last = 0, running = false, paused = false;
const inner = (node, dy) => {
for (; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
if (!/(auto|scroll)/.test(getComputedStyle(node).overflowY) || node.scrollHeight <= node.clientHeight) continue;
if (dy > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0) return true;
}
return false;
};
const step = now => {
current += (target - current) * (1 - Math.exp(-5.3 * Math.min(0.05, (now - last) / 1000)));
last = now;
if (Math.abs(target - current) < 0.5) current = target;
scrollTo({ top: current, behavior: 'instant' });
if (current !== target) requestAnimationFrame(step); else running = false;
};
addEventListener('wheel', event => {
if (paused || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || inner(event.target, event.deltaY)) return;
event.preventDefault();
if (!running) target = current = scrollY;
const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1;
target = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, target + event.deltaY * unit * 0.95));
if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); }
}, { passive: false });
kit.wheel = { stop() { paused = true; }, start() { paused = false; } };
})();
(() => {
const kit = window.motionKit;
if (!kit.live) return;
const at = element => {
const own = /^(\d{1,3}(?:\.\d+)?)%$/.exec((element.getAttribute('data-8b-enter') || '').trim());
return own && +own[1] <= 100 ? own[1] / 100 : 0.88;
};
let pending = [...document.querySelectorAll('[data-8b-motion]')].map(element => ({ element, y: 0, at: at(element) }));
let queued = false;
const check = () => {
queued = false;
pending = pending.filter(item => {
if (item.y > scrollY + innerHeight * item.at) return true;
item.element.classList.add('is-in');
return false;
});
};
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
kit.measure(() => { pending.forEach(item => { item.y = kit.box(item.element).y; }); queue(); });
addEventListener('scroll', queue, { passive: true });
})();
(() => {
const kit = window.motionKit;
if (!kit.live) return;
const sheet = new CSSStyleSheet();
sheet.replaceSync('.line{display:block;overflow:clip;padding-block:.12em;margin-block:-.12em}.line:not(:last-child){margin-bottom:0}.line+.line{margin-top:-.24em}.line+.line>.line__in{text-indent:0}:where(h1,h2,h3,h4,h5,h6,p,div,blockquote,figcaption,dd,dt):where([data-8b-split="lines"]:has(>.line)){display:flow-root}.line__in{display:block}.kit-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}');
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
const sources = new WeakMap(), widths = new WeakMap();
const graphemes = typeof Intl.Segmenter === 'function'
? text => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(part => part.segment)
: text => [...text];
const span = (className, text) => { const element = document.createElement('span'); element.className = className; if (text != null) element.textContent = text; return element; };
const split = element => {
const mode = element.getAttribute('data-8b-split');
if (sources.has(element)) element.innerHTML = sources.get(element); else sources.set(element, element.innerHTML);
const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), texts = [];
while (walker.nextNode()) texts.push(walker.currentNode);
let index = 0;
for (const node of texts) {
const fragment = document.createDocumentFragment();
for (const piece of node.data.split(/(\s+)/)) {
if (!piece) continue;
if (/^\s+$/.test(piece)) { fragment.append(piece); continue; }
const word = span('w');
if (mode === 'chars') {
word.setAttribute('aria-hidden', 'true');
for (const character of graphemes(piece)) { const c = span('c', character); c.style.setProperty('--i', index++); word.append(c); }
} else {
word.textContent = piece;
if (mode === 'words') word.style.setProperty('--i', index++);
}
fragment.append(word);
}
node.replaceWith(fragment);
}
if (mode === 'chars') element.append(span('kit-sr', element.textContent.replace(/\s+/g, ' ').trim()));
if (mode === 'lines') {
const lines = [];
let top = null;
for (const child of [...element.childNodes]) {
const probe = child.nodeType === 1 ? child : null;
const at = probe ? probe.getBoundingClientRect().top : top;
if (probe && (top === null || Math.abs(at - top) > 2)) { lines.push([]); top = at; }
if (!lines.length) lines.push([]);
lines.at(-1).push(child);
}
lines.forEach((nodes, i) => {
const line = span('line'), inner = span('line__in');
line.style.setProperty('--i', i);
nodes[0].before(line);
inner.append(...nodes);
line.append(inner);
});
index = lines.length;
widths.set(element, element.clientWidth);
}
element.style.setProperty('--n', index);
};
const pending = [];
let busy = false;
const drain = () => {
if (busy) return;
const element = pending.shift();
if (!element) return;
busy = true;
setTimeout(() => { try { split(element); } catch (error) { console.error('[motion-kit] split failed', error); } busy = false; drain(); }, 0);
};
const near = new IntersectionObserver(entries => entries.forEach(entry => {
if (!entry.isIntersecting) return;
near.unobserve(entry.target);
pending.push(entry.target);
drain();
}), { rootMargin: '100% 0px 100% 0px' });
(document.fonts?.ready ?? Promise.resolve()).then(() => document.querySelectorAll('[data-8b-split]').forEach(element => near.observe(element)));
kit.measure(() => document.querySelectorAll('[data-8b-split="lines"]').forEach(element => {
if (sources.has(element) && widths.get(element) !== element.clientWidth) { pending.push(element); drain(); }
}));
})();
(() => {
if (!window.motionKit.live) return;
const sheet = new CSSStyleSheet();
sheet.replaceSync('[data-8b-off],[data-8b-off]::before,[data-8b-off]::after{animation-play-state:paused!important}');
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
const watch = new IntersectionObserver(entries => entries.forEach(entry => entry.target.toggleAttribute('data-8b-off', !entry.isIntersecting)));
const watched = new WeakSet();
const scan = () => document.getAnimations().forEach(animation => {
const element = animation.effect?.target;
if (!element || watched.has(element) || animation.effect.getTiming().iterations !== Infinity || animation.timeline !== document.timeline) return;
watched.add(element);
watch.observe(element);
});
scan();
addEventListener('load', scan);
document.addEventListener('animationstart', scan, true);
})();

// scene-script:hero

motionKit.scene('hero', () => {
  const hero = document.getElementById('hero');
  const aperture = hero.querySelector('.hero__aperture');
  const sections = () => [...document.querySelectorAll('[data-8b-section]')].filter(section => section.getAttribute('data-8b-section') !== 'navigation');
  motionKit.measure(() => {
    const order = sections();
    const next = order[order.indexOf(hero) + 1];
    const target = next && next.id === 'statement' ? next.querySelector('.statement__dot') : null;
    if (!target) { motionKit.set(hero, { '--hero-dx': '0px', '--hero-dy': '0px', '--hero-s': '1' }); return; }
    const from = motionKit.box(aperture), to = motionKit.box(target);
    motionKit.set(hero, {
      '--hero-dx': `${(to.x + to.w / 2 - from.x - from.w / 2).toFixed(2)}px`,
      '--hero-dy': `${(to.y + to.h / 2 - from.y - from.h / 2).toFixed(2)}px`,
      '--hero-s': (to.w / from.w).toFixed(4)
    });
  });
});

// scene-script:work

motionKit.scene('work', () => {
  const work = document.getElementById('work');
  const stage = work.querySelector('.work__stage');
  const track = work.querySelector('.work__track');
  motionKit.measure(() => {
    const run = Math.max(0, track.offsetWidth - (work.clientWidth - 2 * parseFloat(getComputedStyle(stage).paddingLeft)));
    motionKit.set(work, { '--work-run': `${run.toFixed(2)}px` });
  });
});

// scene-script:again

motionKit.scene('again', () => {
  const again = document.getElementById('again');
  const stage = again.querySelector('.again__stage');
  const head = again.querySelector('.again__head');
  const wheel = again.querySelector('.again__wheel');
  motionKit.measure(() => {
    const count = wheel.querySelectorAll('.partner').length;
    const width = innerWidth, height = stage.offsetHeight;
    const headBottom = head.offsetTop + head.offsetHeight;
    const room = height - headBottom - innerHeight * 0.04;
    const card = Math.max(180, Math.min(width * (width < 700 ? 0.7 : 0.28), (room - 32) / 1.25));
    const arcTop = headBottom + Math.max(28, (room - card * 1.25) * 0.4);
    const radius = Math.max(width * 0.95, card * 3.3);
    const step = 2 * Math.asin((card + Math.max(18, width * 0.024)) / (2 * radius)) * 180 / Math.PI;
    motionKit.set(again, {
      '--card': `${card.toFixed(1)}px`,
      '--radius': `${radius.toFixed(1)}px`,
      '--step': `${step.toFixed(3)}deg`,
      '--arc-top': `${arcTop.toFixed(1)}px`,
      '--spin': `${Math.round(count * innerHeight * 0.42)}px`,
      '--again-from': `${(step * 0.55).toFixed(3)}deg`,
      '--again-to': `${(-(count - 0.45) * step).toFixed(3)}deg`,
      '--again-swing-r': `${Math.max(4, Math.asin(Math.min(1, width * 0.3 / radius)) * 180 / Math.PI - step * 0.55).toFixed(3)}deg`,
      '--again-swing-y': `${(-(arcTop - 40)).toFixed(2)}px`
    });
  });
});

// scene-script:studio

motionKit.scene('studio', () => {
  const collage = document.querySelector('#studio .studio__collage');
  const tilt = [-8, 6, -4, 9, -6];
  motionKit.measure(() => {
    const shots = [...collage.querySelectorAll('.shot')];
    const total = 1 + (shots.length - 1) * 0.08;
    const cx = collage.offsetWidth / 2, cy = Math.min(collage.offsetHeight / 2, innerHeight * 0.45);
    shots.forEach((shot, index) => {
      const a = (shots.length - 1 - index) * 0.08 / total;
      motionKit.set(shot, {
        '--studio-x': `${(cx - shot.offsetLeft - shot.offsetWidth / 2).toFixed(2)}px`,
        '--studio-y': `${(cy - shot.offsetTop - shot.offsetHeight / 2).toFixed(2)}px`,
        '--studio-tilt': `${tilt[index % tilt.length]}deg`,
        '--studio-a': a.toFixed(5),
        '--studio-b': (a + 1 / total).toFixed(5)
      });
    });
  });
});

// scene-script:footer

motionKit.scene('footer', () => {
  const footer = document.getElementById('footer');
  const aperture = footer.querySelector('.footer__aperture');
  const period = footer.querySelector('.footer__period');
  motionKit.measure(() => motionKit.set(footer, { '--footer-dot': (period.offsetWidth / aperture.offsetWidth).toFixed(4) }));
});

if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => document.getElementById('footer').classList.toggle('is-offscreen', !entry.isIntersecting)).observe(document.getElementById('footer'));
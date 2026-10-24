/**
 * 入场动画触发器：元素露出 15% 时加 .is-in，动画播一次。
 *
 * 没有 JS、或开了减弱动效、或手机窄屏（<751px）时不启用 ——
 * 此时所有元素保持最终态，内容一个都不少。
 */

if (
  matchMedia('(prefers-reduced-motion: no-preference) and (min-width: 751px)').matches &&
  'IntersectionObserver' in window
) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= 0.15) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );

  document.documentElement.classList.add('js-enter');
  for (const el of document.querySelectorAll<HTMLElement>('[data-enter]')) io.observe(el);
}

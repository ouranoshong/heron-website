/**
 * 首屏背景：一组缓慢自转的轨道线稿（天体仪的意象）。
 *
 * 约束：
 *  - 不引依赖，canvas 直接画；
 *  - devicePixelRatio 上限 2，避免高分屏上白烧 CPU；
 *  - 画布不在视口内、或标签页不可见时停手；
 *  - 开了减弱动效就只画一帧静态的。
 */

const canvas = document.querySelector<HTMLCanvasElement>('[data-scene]');
if (canvas) {
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);

    const palette = ['#dcfd35', '#eeeeee', '#9fb4ff', '#dcfd35', '#c9d6ff'];
    const orbits = Array.from({ length: 5 }, (_, i) => ({
      rx: (0.2 + i * 0.13) * w,
      ry: (0.055 + i * 0.034) * h,
      tilt: -0.26 + i * 0.055,
      speed: 0.00007 * (i % 2 === 0 ? 1 : -1) * (1 + i * 0.22),
      phase: i * 1.7,
      dots: 2 + (i % 2),
      color: palette[i % palette.length],
    }));

    // 指针轻微牵引
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    addEventListener('pointermove', (event) => {
      target.x = event.clientX / innerWidth - 0.5;
      target.y = event.clientY / innerHeight - 0.5;
    });

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      pointer.x += (target.x - pointer.x) * 0.04;
      pointer.y += (target.y - pointer.y) * 0.04;

      const cx = w * 0.66 + pointer.x * 28;
      const cy = h * 0.5 + pointer.y * 18;

      for (const orbit of orbits) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(orbit.tilt);

        ctx.strokeStyle = 'rgba(238, 238, 238, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, orbit.rx, orbit.ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < orbit.dots; i++) {
          const angle = t * orbit.speed + orbit.phase + (i / orbit.dots) * Math.PI * 2;
          const x = Math.cos(angle) * orbit.rx;
          const y = Math.sin(angle) * orbit.ry;

          ctx.fillStyle = orbit.color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }
    };

    if (reduced) {
      // 减弱动效：只画一帧静的
      draw();
    } else {
      let raf = 0;
      let onScreen = true;
      let visible = !document.hidden;

      const tick = () => {
        t += 16;
        if (onScreen && visible) draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      // 画布滚出视口就停手
      const io = new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
      });
      io.observe(canvas);

      document.addEventListener('visibilitychange', () => {
        visible = !document.hidden;
      });
    }
  }
}

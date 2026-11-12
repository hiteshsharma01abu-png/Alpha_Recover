import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, Ref } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
  style?: CSSProperties;
  id?: string;
};

export function Reveal({ children, className = '', as = 'div', style, id }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls = `reveal ${className}`.trim();

  if (as === 'section') {
    return (
      <section id={id} className={cls} style={style} ref={ref as Ref<HTMLElement>}>
        {children}
      </section>
    );
  }

  if (as === 'article') {
    return (
      <article id={id} className={cls} style={style} ref={ref as Ref<HTMLElement>}>
        {children}
      </article>
    );
  }

  return (
    <div id={id} className={cls} style={style} ref={ref as Ref<HTMLDivElement>}>
      {children}
    </div>
  );
}

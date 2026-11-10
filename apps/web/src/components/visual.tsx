import type { SVGProps } from 'react';

export function Mark({ className = '' }: { className?: string }) {
  return <svg className={className} width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 26 14 5h5L8 26H3Z" fill="currentColor"/><path d="m19 13 10 13h-7l-6-8 3-5Z" fill="currentColor"/><path d="M13 25h5" stroke="currentColor" strokeWidth="3"/></svg>;
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: 'arrow' | 'external' | 'check' | 'close' | 'copy' | 'shield' | 'send' | 'receipt' | 'intent' | 'pause' }) {
  const paths = {
    arrow: <path d="M4 12h15M13 5l7 7-7 7"/>,
    external: <path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></>,
    shield: <><path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    send: <path d="m3 4 18 8-18 8 4-8-4-8ZM7 12h14"/>,
    receipt: <><path d="M5 3h14v18l-4-2-3 2-3-2-4 2V3Z"/><path d="M9 8h6M9 12h6"/></>,
    intent: <><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></>,
    pause: <path d="M8 5v14M16 5v14"/>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

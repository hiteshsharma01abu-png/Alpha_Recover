import { createElement, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';

export { headTags, pageSeo, prerenderPaths, SITE_URL } from './data/seo';

/** Build-time render of one public page (scripts/prerender.mjs); the browser hydrates it in main.tsx. */
export function render(url: string) {
  return renderToString(createElement(StrictMode, null, createElement(StaticRouter, { location: url }, createElement(App))));
}

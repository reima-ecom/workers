import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import getEventHandler, { getRedirectGetter } from '@reima-ecom/worker-www';
import getAbTester from '@reima-ecom/worker-ab';
import redirects from './redirects.json';

const eventHandler = getEventHandler({
  getAssetFromKV,
  getRedirect: getRedirectGetter(redirects),
  Request,
  Response,
},
{
  stripTrailingSlash: true,
});

const htmlRewriter = new HTMLRewriter().on('body', {
  element: (element) => {
    element.append('<!-- This is ometria, y\'all -->', { html: true });
  },
});

const handleWithAb = getAbTester({
  eventHandler,
  htmlRewriter,
  experimentCookieName: 'X-exp-ometria',
});

addEventListener('fetch', (event) => {
  try {
    event.respondWith(handleWithAb(event));
  } catch (e) {
    event.respondWith(new Response('Internal Error', { status: 500 }));
  }
});

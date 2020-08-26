import getSubscriber from './shopify-subscribe.js';

/**
 * @param {FetchEvent} event
 * @returns {Promise<Response>} Response to send, or undefined to pass to origin
 */
const handleRequest = async (event) => {
  const subscribe = getSubscriber(fetch, SHOPIFY_BASIC_AUTH);

  try {
    const body = await event.request.json();
    await subscribe({
      email: body.email,
      consent: body.consent,
      marketing: body.marketing,
      tags: body.tags,
    });
    return new Response('Done');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return new Response(error.body || 'Error', { status: error.statusCode || 500 });
  }
};

addEventListener('fetch', async (event) => {
  event.respondWith(handleRequest(event));
});

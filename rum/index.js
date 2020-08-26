/**
 * @param {FetchEvent} event
 * @returns {Promise<Response>} Response to send, or undefined to pass to origin
 */
const handleRequest = async (event) => {
  const response = await fetch(
    'https://21ca8fec9bcd4a7ba46d584c59d76fa0.eastus2.azure.elastic-cloud.com:9243/rum-web-vitals/_doc',
    {
      method: 'POST',
      body: event.request.body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${ELASTIC_APIKEY_BASE64}`,
      },
    },
  );
  if (response.ok) return new Response('ok');
  return new Response('error', { status: 500 });
};

addEventListener('fetch', async (event) => {
  event.respondWith(handleRequest(event));
});

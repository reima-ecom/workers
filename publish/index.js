/** @type {{ [referer: string]: {repo: string, workflow: string} }} */
const WORKFLOW_BY_REFERER = {
  'us.reima.com': { repo: 'north-america', workflow: 'publish-us' },
  'www.reima.ca': { repo: 'north-america', workflow: 'publish-ca' },
  'www.reimajapan.com': { repo: 'japan', workflow: 'publish' },
};

const requestHeaders = {
  'Content-Type': 'application/json',
  Authorization: `token ${GITHUB_TOKEN}`,
  // this is required by github
  'User-Agent': 'Cloudflare Worker',
};

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
};

/**
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
const handleRequest = async (event) => {
  if (!GITHUB_TOKEN) return new Response('No GitHub token', { headers: responseHeaders, status: 500 });
  const referer = event.request.headers.get('Referer');
  if (!referer) return new Response('No referer', { headers: responseHeaders, status: 401 });
  const refererUrl = new URL(referer);
  const workflow = WORKFLOW_BY_REFERER[refererUrl.hostname];
  if (!workflow) return new Response('Wrong referer', { headers: responseHeaders, status: 401 });

  if (event.request.method === 'POST') {
    const response = await fetch(
      `https://api.github.com/repos/reima-ecom/${workflow.repo}/dispatches`,
      {
        method: 'POST',
        body: JSON.stringify({
          event_type: workflow.workflow,
        }),
        headers: requestHeaders,
      },
    );
    if (response.ok) return new Response('ok', { headers: responseHeaders });
    return new Response(response.statusText, { headers: responseHeaders, status: response.status });
  } if (event.request.method === 'GET') {
    const response = await fetch(
      `https://api.github.com/repos/reima-ecom/${workflow.repo}/actions/workflows/${workflow.workflow}.yml/runs`,
      { method: 'GET', headers: requestHeaders },
    );
    if (response.ok) {
      const details = await response.json();
      const runs = details.workflow_runs;
      if (!runs || !runs.length) {
        return new Response('No workflow runs found', { headers: responseHeaders, status: 404 });
      }
      // eslint-disable-next-line camelcase
      const { status, conclusion, created_at } = runs[0];
      return new Response(
        JSON.stringify({ status, conclusion, created_at }),
        { headers: { ...responseHeaders, 'content-type': 'application/json' } },
      );
    }
    return new Response(response.statusText, { headers: responseHeaders, status: response.status });
  }
  return new Response('Unsupported method', { headers: responseHeaders, status: 405 });
};

addEventListener('fetch', async (event) => {
  event.respondWith(handleRequest(event));
});

import getWildcardRedirectFinder from './wildcard-redirecter.js';
import getRedirectStore from './get-redirect-from-json.js';

/**
 * @param {Redirect[]} redirects
 */
export const getRedirectGetter = (redirects) =>
  // eslint-disable-next-line implicit-arrow-linebreak
  getWildcardRedirectFinder(getRedirectStore(redirects));

/**
 * Get cache control options expected by Cloudflare asset handler
 * based on the mime type of the requested file.
 * @param {{[mimeType: string]: number}} mimeTypeToTTLMap
 * @param {(pathOrExtension: string) => string} mimeTypeGetter
 * @return {(request: Request) => { browserTTL: number }} request
 */
export const getMimeTypeCacheControlFn = (mimeTypeToTTLMap, mimeTypeGetter) => (request) => {
  const url = new URL(request.url);
  const mimeType = mimeTypeGetter(url.pathname);
  return {
    browserTTL: mimeTypeToTTLMap[mimeType],
  };
};

/**
 * @param {object} deps
 * @param {(event: FetchEvent, options?: GetAssetOptions) => Promise<Response>} deps.getAssetFromKV
 * @param {(pathname: string) => Promise<string> } deps.getRedirect
 * @param {typeof Request} deps.Request
 * @param {typeof Response} deps.Response
 * @param {object} [opts]
 * @param {any} [opts.cacheControl]
 * @param {boolean} [opts.stripTrailingSlash]
 * @returns {(event: FetchEvent) => Promise<Response>} event
 */
const getEventHandler = ({
  getAssetFromKV, getRedirect, Request, Response,
}, { cacheControl, stripTrailingSlash } = {}) => async (event) => {
  const url = new URL(event.request.url);
  if (stripTrailingSlash && url.pathname !== '/' && url.pathname.endsWith('/')) {
    // check for a redirect for this path or default to path without slash
    url.pathname = await getRedirect(url.pathname) || url.pathname.slice(0, -1);
    return new Response('Moved', { status: 301, headers: { Location: url.pathname + url.search } });
  }

  try {
    return await getAssetFromKV(event, { cacheControl });
  } catch (e) {
    // this should be a 404 error, in which case see if we have a redirect
    if (getRedirect) {
      const redirectUrl = await getRedirect(url.pathname);

      if (redirectUrl) {
        return new Response('Redirecting...', {
          status: 301,
          headers: {
            Location: redirectUrl,
          },
        });
      }
    }

    // otherwise just return 404.html
    const notFoundResponse = await getAssetFromKV(event, {
      mapRequestToAsset: (req) => new Request(`${new URL(req.url).origin}/404.html`, req),
    });
    return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 });
  }
};

export default getEventHandler;

/**
 * @typedef GetAssetOptions
 * @property {any} [cacheControl]
 * @property {any} [mapRequestToAsset]
 */

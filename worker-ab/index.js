/**
 * @param {object} deps
 * @param {HTMLRewriter} deps.htmlRewriter
 * @param {(event: FetchEvent) => Promise<Response>} deps.eventHandler
 * @param {string} deps.experimentCookieName
 * @returns {(event: FetchEvent) => Promise<Response>}
 */
const getAbTester = ({
  htmlRewriter,
  eventHandler,
  experimentCookieName,
}) => async (event) => {
  const responsePromise = eventHandler(event);
  try {
    // check experiment cookie
    const cookie = event.request.headers.get('cookie');
    if (cookie && cookie.includes(`${experimentCookieName}=control`)) {
      return responsePromise;
    } if (cookie && cookie.includes(`${experimentCookieName}=test`)) {
      return htmlRewriter.transform(await responsePromise);
    }

    // if no cookie, randomize
    const group = Math.random() < 0.5 ? 'test' : 'control'; // 50/50 split
    const response = group === 'control' ? await responsePromise : await htmlRewriter.transform(await responsePromise);

    // set cookie (14 days)
    response.headers.append('Set-Cookie', `${experimentCookieName}=${group}; path=/; Max-Age=1209600`);

    return response;
  } catch (error) {
    // if error, just return regular event handler
    return eventHandler(event);
  }
};

export default getAbTester;

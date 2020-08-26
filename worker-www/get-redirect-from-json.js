/**
 * @param {Redirect[]} redirectsArray
 * @returns {(path: string) => Promise<string>}
 */
const getRedirectStore = (redirectsArray) => async (path) => {
  const redirect = redirectsArray.find((r) => r.from === path);
  return redirect && redirect.to;
};

export default getRedirectStore;

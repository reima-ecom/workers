/**
 * Factory for redirect getter with wildcard handling
 * @param {(pathname: string) => Promise<string>} getRedirect
 * @returns {(pathname: string) => Promise<string>}
 */
const getWildcardRedirectFinder = (getRedirect) => {
  /**
   * @param {string} pathWithoutSlash
   * @returns {Promise<string>}
   */
  const findRedirect = async (pathWithoutSlash) =>
    // query for wildcard path
    // eslint-disable-next-line implicit-arrow-linebreak
    await getRedirect(`${pathWithoutSlash}/*`)
      // query for slash ending path
      || await getRedirect(`${pathWithoutSlash}/`)
      // query for non-slash path (defaulting to undefined if not found)
      // if this is the root, don't query with the empty string
      || (pathWithoutSlash
        ? getRedirect(`${pathWithoutSlash}`)
        : undefined);

  return async (pathname) => {
    // create array of path segments
    const pathSegments = pathname.split('/');
    // filter out possible empty segment at the end
    // (if path is /some/path/, the array is ['', 'some', 'path', ''])
    if (!pathSegments[pathSegments.length - 1]) pathSegments.pop();
    // check this redirect
    do {
      // eslint-disable-next-line no-await-in-loop
      const redirect = await findRedirect(pathSegments.join('/'));
      if (redirect) return redirect;
      // loop while there are items in the array
    } while (pathSegments.pop());
    return undefined;
  };
};

export default getWildcardRedirectFinder;

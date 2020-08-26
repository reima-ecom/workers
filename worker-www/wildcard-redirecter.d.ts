export default getWildcardRedirectFinder;
/**
 * Factory for redirect getter with wildcard handling
 * @param {(pathname: string) => Promise<string>} getRedirect
 * @returns {(pathname: string) => Promise<string>}
 */
declare function getWildcardRedirectFinder(getRedirect: (pathname: string) => Promise<string>): (pathname: string) => Promise<string>;

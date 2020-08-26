export default getRedirectStore;
/**
 * @param {Redirect[]} redirectsArray
 * @returns {(path: string) => Promise<string>}
 */
declare function getRedirectStore(redirectsArray: Redirect[]): (path: string) => Promise<string>;

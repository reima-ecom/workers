declare global {
  interface Redirect {
    from: string
    to: string
    code?: 301 | 302
  }
}

export function getRedirectGetter(redirects: Redirect[]): (pathname: string) => Promise<string>;

export function getMimeTypeCacheControlFn(mimeTypeToTTLMap: {
  [mimeType: string]: number;
}, mimeTypeGetter: (pathOrExtension: string) => string): (request: Request) => {
  browserTTL: number;
};

declare function getEventHandler({ getAssetFromKV, getRedirect, Request, Response, }: {
  getAssetFromKV: (event: FetchEvent, options?: GetAssetOptions) => Promise<Response>;
  getRedirect: (pathname: string) => Promise<string>;
  Request: typeof Request;
  Response: typeof Response;
}, opts?: {
  cacheControl?: any;
  mapRequestToAsset?: any;
  stripTrailingSlash?: boolean;
}): (event: FetchEvent) => Promise<Response>;

export default getEventHandler;
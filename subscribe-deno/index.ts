import getSubscriber from "./shopify-subscribe.js";

interface FetchEvent extends Event {
  readonly request: Request;
  waitUntil(f: any): void;
  respondWith(r: Response | Promise<Response>): void;
}

const handleRequest = async (event: FetchEvent): Promise<Response> => {
  // get requesting page host
  const origin = event.request.headers.get("Origin") || "";
  // get config for the host
  const hostConfig: string = (self as any)[origin];

  console.log("Origin:", origin);
  console.log("Config:", hostConfig);

  // fail if no shop found
  if (!hostConfig) return new Response("No shop found", { status: 400 });

  // cors headers
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Method": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // if this is cors preflight, return accordingly
  if (event.request.method === "OPTIONS") {
    return new Response("Ok", { headers });
  } else if (event.request.method === "POST") {
    // environment variable should be in the form
    // "shopify-shop:basic auth", e.g. "reima-us:eoea12a"
    const [shopifyShop, shopifyBasicAuth] = hostConfig.split(":");
    const subscribe = getSubscriber(fetch, shopifyBasicAuth, shopifyShop);

    try {
      const body = await event.request.json();
      await subscribe({
        email: body.email,
        consent: body.consent,
        marketing: body.marketing,
        tags: body.tags,
      });
      return new Response("Done", { headers });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      return new Response(
        error.body || "Error",
        { status: error.statusCode || 500, headers },
      );
    }
  } else {
    return new Response("Method Not Allowed", { status: 405 });
  }
};

addEventListener("fetch", (event: Event) => {
  (event as FetchEvent).respondWith(handleRequest(event as FetchEvent));
});

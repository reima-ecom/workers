import getSubscriber from "./shopify-subscribe.js";

interface FetchEvent extends Event {
  readonly request: Request;
  waitUntil(f: any): void;
  respondWith(r: Response | Promise<Response>): void;
}

const handleRequest = async (event: FetchEvent): Promise<Response> => {
  // get requesting page host
  const referer = event.request.headers.get("Referer") || "";
  // get config for the host
  const hostConfig: string = (self as any)[referer];

  if (!hostConfig) return new Response("No shop found", { status: 400 });

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
    return new Response("Done");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return new Response(
      error.body || "Error",
      { status: error.statusCode || 500 },
    );
  }
};

addEventListener("fetch", (event: Event) => {
  (event as FetchEvent).respondWith(handleRequest(event as FetchEvent));
});

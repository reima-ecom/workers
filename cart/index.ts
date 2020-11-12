/// <reference path="../worker-types.d.ts" />

import {
  Checkout,
  checkoutAddItem,
  checkoutGet,
  checkoutRemoveItem,
  getCookie,
  getGraphQlRunner,
  LineItem,
} from "./deps.ts";

const formatMoney = (money: { amount: string; currencyCode: string }) => {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: money.currencyCode,
  }).format(Number.parseFloat(money.amount));
};

const renderLineItem = (lineItem: LineItem) =>
  `
<li>
  <img src="${lineItem.variant.image.src}" alt="${lineItem.variant.image.altText}">
  <div>
    <h2>${lineItem.title}</h2>
    <h3>${lineItem.variant.title}</h3>
    <div>${lineItem.quantity} pcs</div>
    <a href="?remove=${lineItem.id}">Remove</a>
  </div>
  <strong>${formatMoney(lineItem.variant.price)}</strong>
</li>
`;

const getElementHandlers = (
  checkout: Checkout,
): {
  items: ElementHandler;
  subtotal: ElementHandler;
  button: ElementHandler;
} => ({
  button: {
    element: (element) => {
      element.setAttribute("href", checkout.webUrl);
    },
  },
  items: {
    element: (element) => {
      if (checkout.lineItems.edges.length) {
        const content = checkout.lineItems.edges.map(({ node: lineItem }) =>
          renderLineItem(lineItem)
        ).join("");
        element.setInnerContent(content, { html: true });
      }
    },
  },
  subtotal: {
    element: (element) => {
      element.setInnerContent(formatMoney(checkout.subtotal));
    },
  },
});

type RequestHandlerOptions = {
  shopifyStore: string;
  shopifyStorefrontToken: string;
  cartTemplateUrl: string;
};

const handleRequest = async (
  event: FetchEvent,
  options: RequestHandlerOptions,
): Promise<Response> => {
  const templateResponsePromise = fetch(options.cartTemplateUrl);
  const checkoutId = getCookie(event.request, "X-checkout");
  console.log(options);

  if (checkoutId) {
    let checkout: Checkout | undefined;
    const graphQlQuery = getGraphQlRunner(
      options.shopifyStore,
      options.shopifyStorefrontToken,
    );
    const url = new URL(event.request.url);

    // remove item if specified in search params
    if (url.searchParams.has("remove")) {
      checkout = await checkoutRemoveItem(
        graphQlQuery,
        checkoutId,
        url.searchParams.get("remove")!,
      );
    } else if (url.searchParams.has("add")) {
      checkout = await checkoutAddItem(
        graphQlQuery,
        checkoutId,
        url.searchParams.get("add")!,
      );
    } else {
      checkout = await checkoutGet(graphQlQuery, checkoutId);
    }

    // bail if no checkout found
    if (!checkout) {
      return templateResponsePromise;
    }

    const handlers = getElementHandlers(checkout);

    return new HTMLRewriter()
      .on("[items]", handlers.items)
      .on("[checkout]", handlers.button)
      .on("[subtotal]", handlers.subtotal)
      .transform(await templateResponsePromise);
  }

  return templateResponsePromise;
};

addEventListener("fetch", (event) => {
  // get configuration
  const host = event.request.headers.get("Host") || "";
  const hostConfig: string = (self as any)[host];
  // bail if no config found
  if (!hostConfig) {
    event.respondWith(new Response(`Not found: ${host}`, { status: 404 }));
    return;
  }
  // get store and token
  const [
    shopifyStore,
    shopifyStorefrontToken,
    cartTemplateUrl,
  ] = hostConfig.split(";");

  // if the path has an extension, pass through
  // enable ONLY for local development
  if (new URL(event.request.url).pathname.split("/").pop()?.includes(".")) {
    return;
  }

  event.respondWith(
    handleRequest(
      event,
      { cartTemplateUrl, shopifyStore, shopifyStorefrontToken },
    ),
  );
});

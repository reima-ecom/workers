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

type MoneyFormatter = (
  money: { amount: string; currencyCode: string },
) => string;

const formatMoney: MoneyFormatter = ({ amount, currencyCode }) => {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
  }).format(Number.parseFloat(amount));
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

export const getElementHandlers = (
  checkout: Checkout | null | undefined,
  format: MoneyFormatter = formatMoney,
): {
  items: ElementHandler;
  subtotal: ElementHandler;
  button: ElementHandler;
} => ({
  button: {
    element: (element) => {
      if (checkout) {
        element.setAttribute("href", checkout.webUrl);
      }
    },
  },
  items: {
    element: (element) => {
      if (checkout?.lineItems.edges.length) {
        const content = checkout.lineItems.edges.map(({ node: lineItem }) =>
          renderLineItem(lineItem)
        ).join("");
        element.setInnerContent(content, { html: true });
      } else {
        element.setInnerContent("");
      }
    },
  },
  subtotal: {
    element: (element) => {
      let subtotal = "";
      if (checkout) {
        subtotal = format(checkout.subtotal);
      }
      element.setInnerContent(subtotal);
    },
  },
});

type RequestHandlerOptions = {
  shopifyStore: string;
  shopifyStorefrontToken: string;
  cartTemplateUrl: string;
};

type RequestHandlerDependencies = {
  getGraphQlRunner: typeof getGraphQlRunner;
  checkoutGet: typeof checkoutGet;
  checkoutAddItem: typeof checkoutAddItem;
  checkoutRemoveItem: typeof checkoutRemoveItem;
};

export const handleRequest = async (
  request: Request,
  options: RequestHandlerOptions,
  {
    getGraphQlRunner,
    checkoutAddItem,
    checkoutGet,
    checkoutRemoveItem,
  }: RequestHandlerDependencies,
): Promise<Response> => {
  const templateResponsePromise = fetch(options.cartTemplateUrl);
  const checkoutId = getCookie(request, "X-checkout");
  console.log(options);

  let checkout: Checkout | undefined;
  const graphQlQuery = getGraphQlRunner(
    options.shopifyStore,
    options.shopifyStorefrontToken,
  );
  const url = new URL(request.url);

  if (url.searchParams.has("add")) {
    checkout = await checkoutAddItem(
      graphQlQuery,
      checkoutId,
      url.searchParams.get("add")!,
    );
  } else if (checkoutId && url.searchParams.has("remove")) {
    checkout = await checkoutRemoveItem(
      graphQlQuery,
      checkoutId,
      url.searchParams.get("remove")!,
    );
  } else if (checkoutId) {
    checkout = await checkoutGet(graphQlQuery, checkoutId);
  }

  const handlers = getElementHandlers(checkout);

  let response = await templateResponsePromise;

  // set checkout id cookie
  if (checkout) {
    console.log("setting cookie");
    response = new Response(response.body, {
      headers: {
        "Set-Cookie": `X-checkout=${checkout.id}; Path=/; SameSite=Lax; Max-Age=604800`,
      },
    });
  }

  return new HTMLRewriter()
    .on("[items]", handlers.items)
    .on("[checkout]", handlers.button)
    .on("[subtotal]", handlers.subtotal)
    .transform(response);
};

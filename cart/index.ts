/// <reference path="../worker-types.d.ts" />

const FRAGMENTS_CHECKOUT = "CheckoutFragment";
const FRAGMENTS = `
  fragment MoneyFragment on MoneyV2 {
    amount
    currencyCode
  }

  fragment ${FRAGMENTS_CHECKOUT} on Checkout {
    id
    webUrl
    subtotal: subtotalPriceV2 { ...MoneyFragment }
    lineItems(first: 250) {
      edges {
        node {
          id
          title
          variant {
            title
            image {
              src: originalSrc
              altText
            }
            price: priceV2 { ...MoneyFragment }
          }
          quantity
        }
      }
    }
  }
`;

const CHECKOUT_QUERY = `
  ${FRAGMENTS}
  query ($id:ID!) {
    node(id: $id) { ...${FRAGMENTS_CHECKOUT} }
  }
`;
type CheckoutQueryResult = {
  node?: Checkout;
};

const CHECKOUT_ADD_LINEITEM = `
  ${FRAGMENTS}
  mutation checkoutLineItemsAdd($lineItems: [CheckoutLineItemInput!]!, $checkoutId: ID!) {
    checkoutLineItemsAdd(lineItems: $lineItems, checkoutId: $checkoutId) {
      checkout { ...${FRAGMENTS_CHECKOUT} }
      checkoutUserErrors {
        code
        field
        message
      }
    }
  }
`;
type CheckoutAddLineitemResult = {
  checkoutLineItemsAdd: {
    checkout: Checkout;
  };
};

const CHECKOUT_REMOVE_LINEITEM = `
  ${FRAGMENTS}
  mutation checkoutLineItemsRemove($checkoutId: ID!, $lineItemIds: [ID!]!) {
    checkoutLineItemsRemove(checkoutId: $checkoutId, lineItemIds: $lineItemIds) {
      checkout { ...${FRAGMENTS_CHECKOUT} }
      checkoutUserErrors {
        code
        field
        message
      }
    }
  }
`;
type CheckoutRemoveLineitemResult = {
  checkoutLineItemsRemove: {
    checkout: Checkout;
  };
};

type GraphQl = {
  query: string;
  variables: any;
};

type MoneyV2 = {
  amount: string;
  currencyCode: string;
};

type Checkout = {
  id: string;
  webUrl: string;
  subtotal: MoneyV2;
  lineItems: {
    edges: {
      node: LineItem;
    }[];
  };
};

type LineItem = {
  id: string;
  title: string;
  quantity: number;
  variant: {
    title: string;
    image: {
      src: string;
      altText: string;
    };
    price: MoneyV2;
  };
};

const formatMoney = (money: MoneyV2) => {
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
        ).join("\n");
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

/**
 * Grabs the cookie with name from the request headers
 */
const getCookie = (request: Request, name: string) => {
  let result = null;
  const cookieString = request.headers.get("Cookie");
  if (cookieString) {
    const cookies = cookieString.split(";");
    cookies.forEach((cookie) => {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName === name) {
        const cookieVal = cookie.replace(`${name}=`, "").trim();
        result = cookieVal;
      }
    });
  }
  return result;
};

const getGraphQlRunner = (
  shopifyStore: string,
  shopifyStorefrontToken: string,
) =>
  async <T = any>(
    graphQl: GraphQl,
  ): Promise<T> => {
    const resp = await fetch(
      `https://${shopifyStore}.myshopify.com/api/2020-04/graphql`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": shopifyStorefrontToken,
        },
        method: "POST",
        body: JSON.stringify(graphQl),
      },
    );
    if (!resp.ok) throw new Error(`Could not query: ${resp.statusText}`);
    const { data, errors } = await resp.json();
    if (errors) {
      errors.forEach(console.error);
      throw new Error("Errors encountered - see above");
    }
    return data;
  };

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
      const result = await graphQlQuery<CheckoutRemoveLineitemResult>({
        query: CHECKOUT_REMOVE_LINEITEM,
        variables: {
          checkoutId,
          lineItemIds: [url.searchParams.get("remove")],
        },
      });
      checkout = result.checkoutLineItemsRemove.checkout;
    } else if (url.searchParams.has("add")) {
      const result = await graphQlQuery<CheckoutAddLineitemResult>({
        query: CHECKOUT_ADD_LINEITEM,
        variables: {
          checkoutId,
          lineItems: [
            { quantity: 1, variantId: url.searchParams.get("add") },
          ],
        },
      });
      checkout = result.checkoutLineItemsAdd.checkout;
    } else {
      const result = await graphQlQuery<CheckoutQueryResult>({
        query: CHECKOUT_QUERY,
        variables: { id: checkoutId },
      });
      checkout = result.node;
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

export {};

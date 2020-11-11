/// <reference path="../worker-types.d.ts" />

// set up constants
const TEMPLATE_URL = "https://reima-demo.netlify.app/cart/";
const SHOPIFY_STORE = "reima-us";
const STOREFRONT_TOKEN = "d2990d8e29e763239f8e8ff6cefc9ebe";

const CHECKOUT_QUERY = `
  fragment MoneyFragment on MoneyV2 {
    amount
    currencyCode
  }

  fragment CheckoutFragment on Checkout {
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
  query ($id:ID!) {
    node(id: $id) { ...CheckoutFragment }
  }
`;

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

type GraphQl = {
  query: string;
  variables: any;
};

type GraphQlData<T> = {
  node: T;
};

const graphQlQuery = async (
  graphQl: GraphQl,
): Promise<GraphQlData<Checkout>> => {
  const resp = await fetch(
    `https://${SHOPIFY_STORE}.myshopify.com/api/2020-04/graphql`,
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
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

const handleRequest = async (event: FetchEvent): Promise<Response> => {
  const res = await fetch(TEMPLATE_URL);
  const checkoutId = getCookie(event.request, "X-checkout");

  if (checkoutId) {
    const result = await graphQlQuery({
      query: CHECKOUT_QUERY,
      variables: { id: checkoutId },
    });

    const handlers = getElementHandlers(result.node);

    return new HTMLRewriter()
      .on(".cart > ul", handlers.items)
      .on("[weburl]", handlers.button)
      .on("[subtotal]", handlers.subtotal)
      .transform(res);
  }

  return res;
};

addEventListener("fetch", (event) => {
  // if the path has an extension, pass through
  // this is used only for local development
  if (new URL(event.request.url).pathname.split("/").pop()?.includes(".")) {
    return;
  }

  event.respondWith(handleRequest(event));
});

export {};

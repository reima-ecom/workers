// set up constants
const TEMPLATE_URL = 'https://reima-us.netlify.app/index.html';
const SHOPIFY_STORE = 'reima-us';
const STOREFRONT_TOKEN = 'd2990d8e29e763239f8e8ff6cefc9ebe';

const CHECKOUT_QUERY = `
  fragment CheckoutFragment on Checkout {
    id
    webUrl
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
            price: priceV2 {
              amount
            }
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

const renderLineItem = (lineItem) => `
<div>
  <img src="${lineItem.variant.image.src}" alt="${lineItem.variant.image.altText}">
  <div>
    <h2>${lineItem.title}</h2>
    <h3>${lineItem.variant.title}</h3>
    <div>${lineItem.quantity} pcs</div>
  </div>
  <strong>$${lineItem.variant.price.amount}</strong>
</div>
`;

const elementHandler = (checkout) => ({
  element: (element) => {
    if (checkout.lineItems.edges.length) {
      const content = checkout.lineItems.edges.map(({ node: lineItem }) => renderLineItem(lineItem)).join('\n');
      element.setInnerContent(content, { html: true });
    }
  },
});

/**
 * Grabs the cookie with name from the request headers
 * @param {Request} request incoming Request
 * @param {string} name of the cookie to grab
 */
const getCookie = (request, name) => {
  let result = null;
  const cookieString = request.headers.get('Cookie');
  if (cookieString) {
    const cookies = cookieString.split(';');
    cookies.forEach((cookie) => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName === name) {
        const cookieVal = cookie.split('=')[1];
        result = cookieVal;
      }
    });
  }
  return result;
};

const graphQlQuery = async (graphQl) => {
  const resp = await fetch(`https://${SHOPIFY_STORE}.myshopify.com/api/2020-04/graphql`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    method: 'POST',
    body: JSON.stringify(graphQl),
  });
  if (!resp.ok) throw new Error(`Could not query: ${resp.statusText}`);
  const { data, errors } = await resp.json();
  if (errors) {
    // eslint-disable-next-line no-console
    console.error(errors);
    throw new Error('Errors encountered - see above');
  }
  return data;
};

/**
 * @param {FetchEvent} event
 * @returns {Promise<Response>} Response to send, or undefined to pass to origin
 */
const handleRequest = async (event) => {
  const res = await fetch(TEMPLATE_URL);
  const checkoutId = getCookie(event.request, 'X-checkout');

  if (checkoutId) {
    const result = await graphQlQuery({
      query: CHECKOUT_QUERY,
      variables: { id: checkoutId },
    });

    // set subtotal
    // set checkout url

    return new HTMLRewriter().on('main', elementHandler(result.node)).transform(res);
  }

  return res;
};

addEventListener('fetch', async (event) => {
  event.respondWith(handleRequest(event));
});

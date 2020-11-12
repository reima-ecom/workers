const FRAGMENTS = `\n  fragment MoneyFragment on MoneyV2 {\n    amount\n    currencyCode\n  }\n\n  fragment ${"CheckoutFragment"} on Checkout {\n    id\n    webUrl\n    subtotal: subtotalPriceV2 { ...MoneyFragment }\n    lineItems(first: 250) {\n      edges {\n        node {\n          id\n          title\n          variant {\n            title\n            image {\n              src: originalSrc\n              altText\n            }\n            price: priceV2 { ...MoneyFragment }\n          }\n          quantity\n        }\n      }\n    }\n  }\n`;
const CHECKOUT_QUERY = `\n  ${FRAGMENTS}\n  query ($id:ID!) {\n    node(id: $id) { ...${"CheckoutFragment"} }\n  }\n`;
const CHECKOUT_ADD_LINEITEM = `\n  ${FRAGMENTS}\n  mutation checkoutLineItemsAdd($lineItems: [CheckoutLineItemInput!]!, $checkoutId: ID!) {\n    checkoutLineItemsAdd(lineItems: $lineItems, checkoutId: $checkoutId) {\n      checkout { ...${"CheckoutFragment"} }\n      checkoutUserErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n`;
const CHECKOUT_REMOVE_LINEITEM = `\n  ${FRAGMENTS}\n  mutation checkoutLineItemsRemove($checkoutId: ID!, $lineItemIds: [ID!]!) {\n    checkoutLineItemsRemove(checkoutId: $checkoutId, lineItemIds: $lineItemIds) {\n      checkout { ...${"CheckoutFragment"} }\n      checkoutUserErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n`;
const formatMoney = (money)=>{
    return new Intl.NumberFormat("en", {
        style: "currency",
        currency: money.currencyCode
    }).format(Number.parseFloat(money.amount));
};
const renderLineItem = (lineItem)=>`\n<li>\n  <img src="${lineItem.variant.image.src}" alt="${lineItem.variant.image.altText}">\n  <div>\n    <h2>${lineItem.title}</h2>\n    <h3>${lineItem.variant.title}</h3>\n    <div>${lineItem.quantity} pcs</div>\n    <a href="?remove=${lineItem.id}">Remove</a>\n  </div>\n  <strong>${formatMoney(lineItem.variant.price)}</strong>\n</li>\n`
;
const getElementHandlers = (checkout)=>({
        button: {
            element: (element)=>{
                element.setAttribute("href", checkout.webUrl);
            }
        },
        items: {
            element: (element)=>{
                if (checkout.lineItems.edges.length) {
                    const content = checkout.lineItems.edges.map(({ node: lineItem  })=>renderLineItem(lineItem)
                    ).join("\n");
                    element.setInnerContent(content, {
                        html: true
                    });
                }
            }
        },
        subtotal: {
            element: (element)=>{
                element.setInnerContent(formatMoney(checkout.subtotal));
            }
        }
    })
;
const getCookie = (request, name)=>{
    let result = null;
    const cookieString = request.headers.get("Cookie");
    if (cookieString) {
        const cookies = cookieString.split(";");
        cookies.forEach((cookie)=>{
            const cookieName = cookie.split("=")[0].trim();
            if (cookieName === name) {
                const cookieVal = cookie.replace(`${name}=`, "").trim();
                result = cookieVal;
            }
        });
    }
    return result;
};
const getGraphQlRunner = (shopifyStore, shopifyStorefrontToken)=>async (graphQl)=>{
        const resp = await fetch(`https://${shopifyStore}.myshopify.com/api/2020-04/graphql`, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Shopify-Storefront-Access-Token": shopifyStorefrontToken
            },
            method: "POST",
            body: JSON.stringify(graphQl)
        });
        if (!resp.ok) throw new Error(`Could not query: ${resp.statusText}`);
        const { data , errors  } = await resp.json();
        if (errors) {
            errors.forEach(console.error);
            throw new Error("Errors encountered - see above");
        }
        return data;
    }
;
const handleRequest = async (event, options)=>{
    const templateResponsePromise = fetch(options.cartTemplateUrl);
    const checkoutId = getCookie(event.request, "X-checkout");
    console.log(options);
    if (checkoutId) {
        let checkout;
        const graphQlQuery = getGraphQlRunner(options.shopifyStore, options.shopifyStorefrontToken);
        const url = new URL(event.request.url);
        if (url.searchParams.has("remove")) {
            const result = await graphQlQuery({
                query: CHECKOUT_REMOVE_LINEITEM,
                variables: {
                    checkoutId,
                    lineItemIds: [
                        url.searchParams.get("remove")
                    ]
                }
            });
            checkout = result.checkoutLineItemsRemove.checkout;
        } else if (url.searchParams.has("add")) {
            const result = await graphQlQuery({
                query: CHECKOUT_ADD_LINEITEM,
                variables: {
                    checkoutId,
                    lineItems: [
                        {
                            quantity: 1,
                            variantId: url.searchParams.get("add")
                        }, 
                    ]
                }
            });
            checkout = result.checkoutLineItemsAdd.checkout;
        } else {
            const result = await graphQlQuery({
                query: CHECKOUT_QUERY,
                variables: {
                    id: checkoutId
                }
            });
            checkout = result.node;
        }
        if (!checkout) {
            return templateResponsePromise;
        }
        const handlers = getElementHandlers(checkout);
        return new HTMLRewriter().on("[items]", handlers.items).on("[checkout]", handlers.button).on("[subtotal]", handlers.subtotal).transform(await templateResponsePromise);
    }
    return templateResponsePromise;
};
addEventListener("fetch", (event)=>{
    const host = event.request.headers.get("Host") || "";
    const hostConfig = self[host];
    if (!hostConfig) {
        event.respondWith(new Response(`Not found: ${host}`, {
            status: 404
        }));
        return;
    }
    const [shopifyStore, shopifyStorefrontToken, cartTemplateUrl, ] = hostConfig.split(";");
    if (new URL(event.request.url).pathname.split("/").pop()?.includes(".")) {
        return;
    }
    event.respondWith(handleRequest(event, {
        cartTemplateUrl,
        shopifyStore,
        shopifyStorefrontToken
    }));
});

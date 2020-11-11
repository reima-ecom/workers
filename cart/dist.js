const CHECKOUT_QUERY = `\n  fragment MoneyFragment on MoneyV2 {\n    amount\n    currencyCode\n  }\n\n  fragment CheckoutFragment on Checkout {\n    id\n    webUrl\n    subtotal: subtotalPriceV2 { ...MoneyFragment }\n    lineItems(first: 250) {\n      edges {\n        node {\n          id\n          title\n          variant {\n            title\n            image {\n              src: originalSrc\n              altText\n            }\n            price: priceV2 { ...MoneyFragment }\n          }\n          quantity\n        }\n      }\n    }\n  }\n  query ($id:ID!) {\n    node(id: $id) { ...CheckoutFragment }\n  }\n`;
const formatMoney = (money)=>{
    return new Intl.NumberFormat("en", {
        style: "currency",
        currency: money.currencyCode
    }).format(Number.parseFloat(money.amount));
};
const renderLineItem = (lineItem)=>`\n<li>\n  <img src="${lineItem.variant.image.src}" alt="${lineItem.variant.image.altText}">\n  <div>\n    <h2>${lineItem.title}</h2>\n    <h3>${lineItem.variant.title}</h3>\n    <div>${lineItem.quantity} pcs</div>\n  </div>\n  <strong>${formatMoney(lineItem.variant.price)}</strong>\n</li>\n`
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
const graphQlQuery = async (graphQl)=>{
    const resp = await fetch(`https://${"reima-us"}.myshopify.com/api/2020-04/graphql`, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": "d2990d8e29e763239f8e8ff6cefc9ebe"
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
};
const handleRequest = async (event)=>{
    const res = await fetch("https://reima-demo.netlify.app/cart/");
    const checkoutId = getCookie(event.request, "X-checkout");
    if (checkoutId) {
        const result = await graphQlQuery({
            query: CHECKOUT_QUERY,
            variables: {
                id: checkoutId
            }
        });
        const handlers = getElementHandlers(result.node);
        return new HTMLRewriter().on(".cart > ul", handlers.items).on("[weburl]", handlers.button).on("[subtotal]", handlers.subtotal).transform(res);
    }
    return res;
};
addEventListener("fetch", (event)=>{
    if (new URL(event.request.url).pathname.split("/").pop()?.includes(".")) {
        return;
    }
    event.respondWith(handleRequest(event));
});

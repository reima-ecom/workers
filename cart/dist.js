const noColor = globalThis.Deno?.noColor ?? true;
let enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code1) {
    return enabled ? `${code1.open}${str.replace(code1.regexp, code1.open)}${code1.close}` : str;
}
function bold(str) {
    return run(str, code([
        1
    ], 22));
}
function red(str) {
    return run(str, code([
        31
    ], 39));
}
function green(str) {
    return run(str, code([
        32
    ], 39));
}
function white(str) {
    return run(str, code([
        37
    ], 39));
}
function gray(str) {
    return brightBlack(str);
}
function brightBlack(str) {
    return run(str, code([
        90
    ], 39));
}
function clampAndTruncate(n, max = 255, min = 0) {
    return Math.trunc(Math.max(Math.min(n, max), min));
}
const ANSI_PATTERN = new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
function stripColor(string) {
    return string.replace(ANSI_PATTERN, "");
}
const getCookie = (request, name)=>{
    let result;
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
const FRAGMENTS = `\n  fragment MoneyFragment on MoneyV2 {\n    amount\n    currencyCode\n  }\n\n  fragment ${"CheckoutFragment"} on Checkout {\n    id\n    webUrl\n    subtotal: subtotalPriceV2 { ...MoneyFragment }\n    lineItems(first: 250) {\n      edges {\n        node {\n          id\n          title\n          variant {\n            title\n            image {\n              src: originalSrc\n              altText\n            }\n            price: priceV2 { ...MoneyFragment }\n          }\n          quantity\n        }\n      }\n    }\n  }\n`;
const CHECKOUT_CREATE = `\n  ${FRAGMENTS}\n  mutation checkoutCreate($input: CheckoutCreateInput!) {\n    checkoutCreate(input: $input) {\n      checkout { ...${"CheckoutFragment"}}\n    }\n  }\n`;
const CHECKOUT_QUERY = `\n  ${FRAGMENTS}\n  query ($id:ID!) {\n    node(id: $id) { ...${"CheckoutFragment"} }\n  }\n`;
const CHECKOUT_ADD_LINEITEM = `\n  ${FRAGMENTS}\n  mutation checkoutLineItemsAdd($lineItems: [CheckoutLineItemInput!]!, $checkoutId: ID!) {\n    checkoutLineItemsAdd(lineItems: $lineItems, checkoutId: $checkoutId) {\n      checkout { ...${"CheckoutFragment"} }\n      checkoutUserErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n`;
const CHECKOUT_REMOVE_LINEITEM = `\n  ${FRAGMENTS}\n  mutation checkoutLineItemsRemove($checkoutId: ID!, $lineItemIds: [ID!]!) {\n    checkoutLineItemsRemove(checkoutId: $checkoutId, lineItemIds: $lineItemIds) {\n      checkout { ...${"CheckoutFragment"} }\n      checkoutUserErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n`;
const PRODUCT_VARIANT_ID = `\n  fragment ProductVariant on Product {\n    variantBySelectedOptions (selectedOptions: $selectedOptions) {\n      id\n    }\n  }\n  query ($productId:ID!, $selectedOptions: [SelectedOptionInput!]!) {\n    node(id: $productId) { ...ProductVariant }\n  }\n`;
const checkoutRemoveItem = async (graphQlRunner, checkoutId, lineItemId)=>{
    const result = await graphQlRunner({
        query: CHECKOUT_REMOVE_LINEITEM,
        variables: {
            checkoutId,
            lineItemIds: [
                lineItemId
            ]
        }
    });
    return result.checkoutLineItemsRemove.checkout;
};
const checkoutAddItem = async (graphQlRunner, checkoutId, variantOrProductId, productOptions)=>{
    let variantId = variantOrProductId;
    if (productOptions) {
        const selectedOptions = Object.entries(productOptions).map((entry)=>({
                name: entry[0],
                value: entry[1]
            })
        );
        const productWithSelectedVariant = await graphQlRunner({
            query: PRODUCT_VARIANT_ID,
            variables: {
                selectedOptions,
                productId: variantOrProductId
            }
        });
        if (!productWithSelectedVariant.node) {
            throw new Error(`Could not find product ${variantOrProductId}`);
        }
        variantId = productWithSelectedVariant.node.variantBySelectedOptions.id;
    }
    const lineItems = [
        {
            quantity: 1,
            variantId
        }, 
    ];
    if (!checkoutId) {
        const createdCheckout = await graphQlRunner({
            query: CHECKOUT_CREATE,
            variables: {
                input: {
                    lineItems
                }
            }
        });
        return createdCheckout.checkoutCreate.checkout;
    }
    const result = await graphQlRunner({
        query: CHECKOUT_ADD_LINEITEM,
        variables: {
            checkoutId,
            lineItems
        }
    });
    return result.checkoutLineItemsAdd.checkout;
};
const checkoutGet = async (graphQlRunner, checkoutId)=>{
    const result = await graphQlRunner({
        query: CHECKOUT_QUERY,
        variables: {
            id: checkoutId
        }
    });
    return result.node;
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
            errors.forEach((error)=>{
                console.error(error.message, "at", error.locations);
            });
            throw new Error("Errors encountered - see above");
        }
        return data;
    }
;
const handleRequest = async (config, optionsPromise, deps)=>{
    const opts = await optionsPromise;
    const rewriteResponse = deps.getResponseRewriter(config.cartTemplateUrl);
    let checkout;
    const graphQlQuery = deps.getGraphQlRunner(config.shopifyStore, config.shopifyStorefrontToken);
    if (opts.addVariantId) {
        checkout = await deps.checkoutAddItem(graphQlQuery, opts.checkoutId, opts.addVariantId);
    } else if (opts.addProductId) {
        checkout = await deps.checkoutAddItem(graphQlQuery, opts.checkoutId, opts.addProductId, opts.addProductOptions);
    } else if (opts.checkoutId && opts.removeLineitemId) {
        checkout = await deps.checkoutRemoveItem(graphQlQuery, opts.checkoutId, opts.removeLineitemId);
    } else if (opts.checkoutId) {
        checkout = await deps.checkoutGet(graphQlQuery, opts.checkoutId);
    }
    return rewriteResponse(checkout);
};
const getCartConfiguration = (request)=>{
    const host = request.headers.get("Host") || "";
    const hostConfig = self[host];
    if (!hostConfig) {
        throw new Error(`Host ${host} not configured`);
    }
    const [shopifyStore, shopifyStorefrontToken, cartTemplateUrl, ] = hostConfig.split(";");
    return {
        cartTemplateUrl,
        shopifyStore,
        shopifyStorefrontToken
    };
};
const getCheckoutOperationParameters = async (request)=>{
    const checkoutOptions = {
        checkoutId: getCookie(request, "X-checkout")
    };
    const url = new URL(request.url);
    if (url.searchParams.has("add")) {
        checkoutOptions.addVariantId = url.searchParams.get("add") || undefined;
    } else if (url.searchParams.has("remove")) {
        checkoutOptions.removeLineitemId = url.searchParams.get("remove") || undefined;
    } else if (request.method === "POST") {
        const formData = await request.formData();
        checkoutOptions.addProductId = formData.get("product-id")?.toString();
        formData.delete("product-id");
        checkoutOptions.addProductOptions = {
        };
        for (const entry of formData.entries()){
            checkoutOptions.addProductOptions[entry[0]] = entry[1].toString();
        }
    }
    return checkoutOptions;
};
const getEventListener = (deps)=>(event)=>{
        if (event.request.url.split("/").pop()?.includes(".")) {
            return;
        }
        event.respondWith(handleRequest(getCartConfiguration(event.request), getCheckoutOperationParameters(event.request), deps));
    }
;
const formatMoney = ({ amount , currencyCode  })=>{
    return new Intl.NumberFormat("en", {
        style: "currency",
        currency: currencyCode
    }).format(Number.parseFloat(amount));
};
const renderLineItem = (lineItem)=>`\n<li>\n  <img src="${lineItem.variant.image.src}" alt="${lineItem.variant.image.altText}">\n  <div>\n    <h2>${lineItem.title}</h2>\n    <h3>${lineItem.variant.title}</h3>\n    <div>${lineItem.quantity} pcs</div>\n    <a href="?remove=${lineItem.id}">Remove</a>\n  </div>\n  <strong>${formatMoney(lineItem.variant.price)}</strong>\n</li>\n`
;
const getElementHandlers = (checkout, format = formatMoney)=>({
        button: {
            element: (element)=>{
                if (checkout) {
                    element.setAttribute("href", checkout.webUrl);
                }
            }
        },
        items: {
            element: (element)=>{
                if (checkout?.lineItems.edges.length) {
                    const content = checkout.lineItems.edges.map(({ node: lineItem  })=>renderLineItem(lineItem)
                    ).join("");
                    element.setInnerContent(content, {
                        html: true
                    });
                } else {
                    element.setInnerContent("");
                }
            }
        },
        subtotal: {
            element: (element)=>{
                let subtotal = "";
                if (checkout) {
                    subtotal = format(checkout.subtotal);
                }
                element.setInnerContent(subtotal);
            }
        }
    })
;
const getResponseRewriter = (cartTemplateUrl)=>{
    const templateResponsePromise = fetch(cartTemplateUrl);
    return async (checkout)=>{
        const handlers = getElementHandlers(checkout);
        let response = await templateResponsePromise;
        if (checkout) {
            response = new Response(response.body, {
                headers: {
                    "Set-Cookie": `X-checkout=${checkout.id}; Path=/; SameSite=Lax; Max-Age=604800`
                }
            });
        }
        return new HTMLRewriter().on("[items]", handlers.items).on("[checkout]", handlers.button).on("[subtotal]", handlers.subtotal).transform(response);
    };
};
const eventListener = getEventListener({
    checkoutAddItem: checkoutAddItem,
    checkoutGet: checkoutGet,
    checkoutRemoveItem: checkoutRemoveItem,
    getGraphQlRunner: getGraphQlRunner,
    getResponseRewriter: getResponseRewriter
});
addEventListener("fetch", eventListener);

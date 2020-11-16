// check that env var handling works
// check that li rendered correctly
// check that subtotal set
// check that GET add works
// check that GET remove works
// check that POST set works

import { assert, Checkout } from "./deps.ts";
import { getElementHandlers } from "./handler.ts";

Deno.test("element items set to empty on null checkout", () => {
  const elementHandlers = getElementHandlers(null);
  let content = "original content that should be overwritten";
  const element: Pick<Element, "setInnerContent"> = {
    setInnerContent: (innerContent) => {
      content = innerContent;
      return undefined as unknown as Element;
    },
  };
  elementHandlers.items.element!(element as Element);
  assert.strictEqual(content, "");
});

Deno.test("element button url set to checkout web url", () => {
  const elementHandlers = getElementHandlers({
    webUrl: "checkout url",
  } as Checkout);
  let checkoutUrl = "original url attribute";
  const element: Pick<Element, "setAttribute"> = {
    setAttribute: (name, value) => {
      if (name === "href") checkoutUrl = value;
      return undefined as unknown as Element;
    },
  };
  elementHandlers.button.element!(element as Element);
  assert.strictEqual(checkoutUrl, "checkout url");
});

Deno.test("element subtotal set to formatted subtotal", () => {
  const elementHandlers = getElementHandlers(
    {
      subtotal: {
        amount: "10.00",
        currencyCode: "USD",
      },
    } as Checkout,
    () => "$10.00",
  );
  let content = "original content that should be overwritten";
  const element: Pick<Element, "setInnerContent"> = {
    setInnerContent: (innerContent) => {
      content = innerContent;
      return undefined as unknown as Element;
    },
  };
  elementHandlers.subtotal.element!(element as Element);
  assert.strictEqual(content, "$10.00");
});

export {};

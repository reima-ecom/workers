import { assert } from "../deps.ts";
import { checkoutAddItem, GraphQlRunner } from "./checkout.ts";
import { GraphQl } from "./graphql.ts";
import {
  CHECKOUT_CREATE,
  CheckoutCreateResult,
  CheckoutCreateInput,
} from "./queries.ts";

Deno.test("adding to new checkout works", async () => {
  const graphQlRunner = async (
    graphQl: GraphQl<CheckoutCreateInput>,
  ) => {
    if (graphQl.query === CHECKOUT_CREATE) {
      return {
        checkoutCreate: {
          checkout: {
            id: `created-with-${graphQl.variables.input.lineItems![0].variantId}`,
          },
        },
      } as CheckoutCreateResult;
    } else {
      throw new Error("Not implemented");
    }
  };
  const checkout = await checkoutAddItem(graphQlRunner as GraphQlRunner, undefined, "variant");
  assert.strictEqual(checkout.id, 'created-with-variant');
});

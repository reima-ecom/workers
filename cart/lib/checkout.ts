import {
  CHECKOUT_ADD_LINEITEM,
  CHECKOUT_QUERY,
  CHECKOUT_REMOVE_LINEITEM,
  CheckoutAddLineitemResult,
  CheckoutQueryResult,
  CheckoutRemoveLineitemResult,
} from "./queries.ts";
import { getGraphQlRunner } from "./graphql.ts";
export type { Checkout, LineItem, MoneyV2 } from "./queries.ts";

type GraphQlRunner = ReturnType<typeof getGraphQlRunner>;

export const checkoutRemoveItem = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
  lineItemId: string,
) => {
  const result = await graphQlRunner<CheckoutRemoveLineitemResult>({
    query: CHECKOUT_REMOVE_LINEITEM,
    variables: {
      checkoutId,
      lineItemIds: [lineItemId],
    },
  });
  return result.checkoutLineItemsRemove.checkout;
};

export const checkoutAddItem = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
  variantId: string,
) => {
  const result = await graphQlRunner<CheckoutAddLineitemResult>({
    query: CHECKOUT_ADD_LINEITEM,
    variables: {
      checkoutId,
      lineItems: [
        { quantity: 1, variantId },
      ],
    },
  });
  return result.checkoutLineItemsAdd.checkout;
};

export const checkoutGet = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
) => {
  const result = await graphQlRunner<CheckoutQueryResult>({
    query: CHECKOUT_QUERY,
    variables: { id: checkoutId },
  });
  return result.node;
};

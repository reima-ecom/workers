import {
  CHECKOUT_ADD_LINEITEM,
  CHECKOUT_CREATE,
  CHECKOUT_QUERY,
  CHECKOUT_REMOVE_LINEITEM,
  CheckoutAddLineitemResult,
  CheckoutCreateInput,
  CheckoutCreateResult,
  CheckoutQueryResult,
  CheckoutRemoveLineitemResult,
} from "./queries.ts";
import { getGraphQlRunner } from "./graphql.ts";
export type { Checkout, LineItem, MoneyV2 } from "./queries.ts";

export type GraphQlRunner = ReturnType<typeof getGraphQlRunner>;

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
  checkoutId: string | undefined,
  variantId: string,
) => {
  const lineItems = [
    { quantity: 1, variantId },
  ];

  if (!checkoutId) {
    const createdCheckout = await graphQlRunner<
      CheckoutCreateResult,
      CheckoutCreateInput
    >({
      query: CHECKOUT_CREATE,
      variables: {
        input: { lineItems },
      },
    });
    return createdCheckout.checkoutCreate.checkout;
  }

  const result = await graphQlRunner<CheckoutAddLineitemResult>({
    query: CHECKOUT_ADD_LINEITEM,
    variables: {
      checkoutId,
      lineItems,
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

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

type CheckoutLineItemInput = {
  quantity: number;
  variantId: string;
};

export const CHECKOUT_CREATE = `
  ${FRAGMENTS}
  mutation checkoutCreate($input: CheckoutCreateInput!) {
    checkoutCreate(input: $input) {
      checkout { ...${FRAGMENTS_CHECKOUT}}
    }
  }
`;
export type CheckoutCreateInput = {
  input: {
    lineItems?: CheckoutLineItemInput[];
  }
};
export type CheckoutCreateResult = {
  checkoutCreate: {
    checkout: Checkout;
  };
};

export const CHECKOUT_QUERY = `
  ${FRAGMENTS}
  query ($id:ID!) {
    node(id: $id) { ...${FRAGMENTS_CHECKOUT} }
  }
`;
export type CheckoutQueryResult = {
  node?: Checkout;
};

export const CHECKOUT_ADD_LINEITEM = `
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
export type CheckoutAddLineitemVariables = {
  checkoutId: string;
  lineItems: CheckoutLineItemInput[];
};
export type CheckoutAddLineitemResult = {
  checkoutLineItemsAdd: {
    checkout: Checkout;
  };
};

export const CHECKOUT_REMOVE_LINEITEM = `
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
export type CheckoutRemoveLineitemResult = {
  checkoutLineItemsRemove: {
    checkout: Checkout;
  };
};

export type MoneyV2 = {
  amount: string;
  currencyCode: string;
};

export type Checkout = {
  id: string;
  webUrl: string;
  subtotal: MoneyV2;
  lineItems: {
    edges: {
      node: LineItem;
    }[];
  };
};

export type LineItem = {
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

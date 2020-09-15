const error = (message, statusCode, body) => {
  const err = new Error(message);
  // @ts-ignore
  err.statusCode = statusCode;
  // @ts-ignore
  err.body = body;
  return err;
};

/**
 * @param {typeof fetch} fetch
 */
const getSubscriber = (fetch, shopifyBasicAuth, shopifyShop) => {
  /**
   * @param {string} urlPath
   * @param {string} method
   * @param {any} [data]
   */
  const request = async (urlPath, method, data) => {
    const resp = await fetch(`https://${shopifyShop}.myshopify.com${urlPath}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${shopifyBasicAuth}`,
      },
      body: data && JSON.stringify(data),
      method,
    });

    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.error(resp.status, resp.statusText);
      const text = await resp.text();
      // eslint-disable-next-line no-console
      console.error(text);
      throw error('Error fetching', 500, 'Something went wrong');
    }

    return resp;
  };

  /**
   * @param {string} email
   * @returns {Promise<number>} Customer ID
   */
  const findCustomer = async (email) => {
    const resp = await request(`/admin/api/2020-01/customers/search.json?fields=id&query=email:${email}`, 'GET');
    const data = await resp.json();
    // shopify returns empty customers array if not found
    if (data.customers.length) {
      return data.customers[0].id;
    }
    return undefined;
  };

  /**
   * @param {number} customerId
   * @param {ShopifyCustomer} customer
   */
  const updateCustomer = async (customerId, customer) => {
    await request(`/admin/api/2020-01/customers/${customerId}.json`, 'PUT', { customer });
  };

  /**
   * @param {ShopifyCustomer} customer
   */
  const createCustomer = async (customer) => {
    await request('/admin/api/2020-01/customers.json', 'POST', { customer });
  };

  /**
   * @param {CustomerData} data
   */
  const main = async (data) => {
    if (!data.consent || !data.marketing) {
      throw error('Invalid parameters', 422, 'Need consents for marketing');
    }
    const customer = {
      email: data.email,
      tags: data.tags,
      accepts_marketing: data.marketing,
    };

    // first try to find an existing customer
    const customerId = await findCustomer(customer.email);
    if (customerId) {
      // update if found
      await updateCustomer(customerId, customer);
    } else {
      // otherwise create a new customer
      await createCustomer(customer);
    }
  };
  return main;
};

/**
 * @typedef CustomerData
 * @property {string} email
 * @property {boolean} consent
 * @property {boolean} marketing
 * @property {string} [tags]
 *
 * @typedef ShopifyCustomer
 * @property {string} email
 * @property {string} tags
 * @property {boolean} accepts_marketing
 */

export default getSubscriber;

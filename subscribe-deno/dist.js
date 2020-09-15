// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// This is a specialised implementation of a System module loader.

"use strict";

// @ts-nocheck
/* eslint-disable */
let System, __instantiate;
(() => {
  const r = new Map();

  System = {
    register(id, d, f) {
      r.set(id, { d, f, exp: {} });
    },
  };
  async function dI(mid, src) {
    let id = mid.replace(/\.\w+$/i, "");
    if (id.includes("./")) {
      const [o, ...ia] = id.split("/").reverse(),
        [, ...sa] = src.split("/").reverse(),
        oa = [o];
      let s = 0,
        i;
      while ((i = ia.shift())) {
        if (i === "..") s++;
        else if (i === ".") break;
        else oa.push(i);
      }
      if (s < sa.length) oa.push(...sa.slice(s));
      id = oa.reverse().join("/");
    }
    return r.has(id) ? gExpA(id) : import(mid);
  }

  function gC(id, main) {
    return {
      id,
      import: (m) => dI(m, id),
      meta: { url: id, main },
    };
  }

  function gE(exp) {
    return (id, v) => {
      v = typeof id === "string" ? { [id]: v } : id;
      for (const [id, value] of Object.entries(v)) {
        Object.defineProperty(exp, id, {
          value,
          writable: true,
          enumerable: true,
        });
      }
    };
  }

  function rF(main) {
    for (const [id, m] of r.entries()) {
      const { f, exp } = m;
      const { execute: e, setters: s } = f(gE(exp), gC(id, id === main));
      delete m.f;
      m.e = e;
      m.s = s;
    }
  }

  async function gExpA(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](await gExpA(d[i]));
      const r = e();
      if (r) await r;
    }
    return m.exp;
  }

  function gExp(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](gExp(d[i]));
      e();
    }
    return m.exp;
  }
  __instantiate = (m, a) => {
    System = __instantiate = undefined;
    rF(m);
    return a ? gExpA(m) : gExp(m);
  };
})();

System.register("shopify-subscribe", [], function (exports_1, context_1) {
    "use strict";
    var error, getSubscriber;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [],
        execute: function () {
            error = (message, statusCode, body) => {
                const err = new Error(message);
                err.statusCode = statusCode;
                err.body = body;
                return err;
            };
            getSubscriber = (fetch, shopifyBasicAuth, shopifyShop) => {
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
                        console.error(resp.status, resp.statusText);
                        const text = await resp.text();
                        console.error(text);
                        throw error('Error fetching', 500, 'Something went wrong');
                    }
                    return resp;
                };
                const findCustomer = async (email) => {
                    const resp = await request(`/admin/api/2020-01/customers/search.json?fields=id&query=email:${email}`, 'GET');
                    const data = await resp.json();
                    if (data.customers.length) {
                        return data.customers[0].id;
                    }
                    return undefined;
                };
                const updateCustomer = async (customerId, customer) => {
                    await request(`/admin/api/2020-01/customers/${customerId}.json`, 'PUT', { customer });
                };
                const createCustomer = async (customer) => {
                    await request('/admin/api/2020-01/customers.json', 'POST', { customer });
                };
                const main = async (data) => {
                    if (!data.consent || !data.marketing) {
                        throw error('Invalid parameters', 422, 'Need consents for marketing');
                    }
                    const customer = {
                        email: data.email,
                        tags: data.tags,
                        accepts_marketing: data.marketing,
                    };
                    const customerId = await findCustomer(customer.email);
                    if (customerId) {
                        await updateCustomer(customerId, customer);
                    }
                    else {
                        await createCustomer(customer);
                    }
                };
                return main;
            };
            exports_1("default", getSubscriber);
        }
    };
});
System.register("index", ["shopify-subscribe"], function (exports_2, context_2) {
    "use strict";
    var shopify_subscribe_js_1, handleRequest;
    var __moduleName = context_2 && context_2.id;
    return {
        setters: [
            function (shopify_subscribe_js_1_1) {
                shopify_subscribe_js_1 = shopify_subscribe_js_1_1;
            }
        ],
        execute: function () {
            handleRequest = async (event) => {
                const origin = event.request.headers.get("Origin") || "";
                const hostConfig = self[origin];
                console.log("Origin:", origin);
                console.log("Config:", hostConfig);
                if (!hostConfig)
                    return new Response("No shop found", { status: 400 });
                const headers = {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Method": "POST",
                    "Access-Control-Allow-Headers": "Content-Type",
                };
                if (event.request.method === "OPTIONS") {
                    return new Response("Ok", { headers });
                }
                else if (event.request.method === "POST") {
                    const [shopifyShop, shopifyBasicAuth] = hostConfig.split(":");
                    const subscribe = shopify_subscribe_js_1.default(fetch, shopifyBasicAuth, shopifyShop);
                    try {
                        const body = await event.request.json();
                        await subscribe({
                            email: body.email,
                            consent: body.consent,
                            marketing: body.marketing,
                            tags: body.tags,
                        });
                        return new Response("Done", { headers });
                    }
                    catch (error) {
                        console.log(error);
                        return new Response(error.body || "Error", { status: error.statusCode || 500, headers });
                    }
                }
                else {
                    return new Response("Method Not Allowed", { status: 405 });
                }
            };
            addEventListener("fetch", (event) => {
                event.respondWith(handleRequest(event));
            });
        }
    };
});

__instantiate("index", false);

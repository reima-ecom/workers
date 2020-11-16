/// <reference path="../worker-types.d.ts" />

import {
  checkoutAddItem,
  checkoutGet,
  checkoutRemoveItem,
  getGraphQlRunner,
} from "./deps.ts";
import { handleRequest } from "./handler.ts";

addEventListener("fetch", (event) => {
  // get configuration
  const host = event.request.headers.get("Host") || "";
  const hostConfig: string = (self as any)[host];
  // bail if no config found
  if (!hostConfig) {
    event.respondWith(new Response(`Not found: ${host}`, { status: 404 }));
    return;
  }
  // get store and token
  const [
    shopifyStore,
    shopifyStorefrontToken,
    cartTemplateUrl,
  ] = hostConfig.split(";");

  // if the path has an extension, pass through
  // enable ONLY for local development
  if (new URL(event.request.url).pathname.split("/").pop()?.includes(".")) {
    return;
  }

  event.respondWith(
    handleRequest(
      event.request,
      { cartTemplateUrl, shopifyStore, shopifyStorefrontToken },
      { getGraphQlRunner, checkoutGet, checkoutAddItem, checkoutRemoveItem },
    ),
  );
});

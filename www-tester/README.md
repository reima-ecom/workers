# worker-www package tester

This is a lightweight worker designed to test the worker-www package we use to handle events to the main sites.

**NOTE!**

You need to manually create a `node_modules` folder due to the way wrangler works. If it doesn't exist, wrangler will run `npm install`, which will fail because the package is managed by `yarn` workspaces.
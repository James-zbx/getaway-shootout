import {
  createDatabaseClient,
  createSiteContext,
  errorResponse,
  BackendError,
} from './_qoder/backend.mjs';
import { createSignalingApplication } from './signaling-core.mjs';
import { createDatabaseStore } from './signaling-store.mjs';

const store = createDatabaseStore({ db: createDatabaseClient(), BackendError });
const handle = createSignalingApplication({ store, BackendError });

Deno.serve(async request => {
  let context;
  try {
    context = createSiteContext(request);
    return await handle(context);
  } catch (error) {
    // The platform adapter supplies safe error JSON and a request ID.
    // Do not log request URLs: polling URLs contain capability tokens.
    return errorResponse(error, context?.requestId);
  }
});

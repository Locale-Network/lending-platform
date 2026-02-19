// utils/plaid.js

import { Configuration, PlaidApi, PlaidEnvironments, Products } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV;

// Production safety: Fail fast if PLAID_ENV is not explicitly set
if (!PLAID_ENV) {
  throw new Error(
    'PLAID_ENV environment variable is required. ' +
    'Set to "sandbox", "development", or "production".'
  );
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

const client = new PlaidApi(configuration);

export default client;

export const formatError = (error: any) => {
  return {
    error: {
      status_code: error?.status,
      request_id: error?.request_id,
      error_code: error?.error_code,
      error_message: error?.error_message,
      display_message: error?.display_message,
    },
  };
};

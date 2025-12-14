import { PlaidError } from 'plaid';

export function isPlaidError(error: any): error is PlaidError {
  return (
    error?.response?.data?.error_type !== undefined &&
    error?.response?.data?.error_code !== undefined &&
    error?.response?.data?.error_message !== undefined
  );
}

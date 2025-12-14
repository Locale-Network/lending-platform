// https://plaid.com/docs/api/products/identity-verification/#webhooks

export enum PlaidWebhookType {
  IDENTITY_VERIFICATION = 'IDENTITY_VERIFICATION',
  // add other webhook types
}

export enum PlaidWebhookCode {
  STATUS_UPDATED = 'STATUS_UPDATED',
  RETRIED = 'RETRIED',
  // add other webhook codes
}

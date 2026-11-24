export interface ApiRequest {
  method: 'GET' | 'POST'
  path: '/' | '/workbench/reset' | `/workbench/accounts/${string}/commands`
  signal: AbortSignal
  body?: unknown
}

export interface ApiHealth {
  status: 'ok'
}

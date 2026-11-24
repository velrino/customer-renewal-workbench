export interface ApiRequest {
  method: 'GET'
  path: '/'
  signal: AbortSignal
}

export interface ApiHealth {
  status: 'ok' | 'degraded'
}

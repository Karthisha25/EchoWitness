export const ROUTES = {
  login: '/login',
  home: '/',
  history: '/history',
  capture: (id: string) => `/incidents/${id}/capture`,
  interview: (id: string) => `/incidents/${id}/interview`,
  review: (id: string) => `/incidents/${id}/review`,
  legal: (id: string) => `/incidents/${id}/legal`,
  report: (id: string) => `/incidents/${id}/report`,
} as const;

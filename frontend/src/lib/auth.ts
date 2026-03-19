const TOKEN_KEY = 'trading_agents_token'
const ADDRESS_KEY = 'trading_agents_address'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getAddress(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ADDRESS_KEY)
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1]))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function saveAuth(token: string, address: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ADDRESS_KEY, address)
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADDRESS_KEY)
}

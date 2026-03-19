import { getToken } from './auth'
import type { Agent, Trade, PortfolioMetrics } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.message || `Request failed: ${res.status}`)
  }

  return res.json()
}

export async function getNonce(address: string): Promise<{ nonce: string }> {
  return request(`/auth/nonce?address=${encodeURIComponent(address)}`)
}

export async function login(
  message: string,
  signature: string
): Promise<{ token: string; address: string }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  })
}

export async function listAgents(): Promise<Agent[]> {
  const data = await request<Agent[] | { agents: Agent[] }>('/agents')
  return Array.isArray(data) ? data : (data as { agents: Agent[] }).agents ?? []
}

export async function createAgent(name: string, skills?: string): Promise<Agent> {
  return request('/agents', {
    method: 'POST',
    body: JSON.stringify({ name, skills }),
  })
}

export async function getAgent(id: string): Promise<Agent> {
  return request(`/agents/${id}`)
}

export async function updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
  return request(`/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function updateAgentSkills(id: string, skills: string): Promise<Agent> {
  return request(`/agents/${id}/skills`, {
    method: 'PUT',
    body: JSON.stringify({ skills }),
  })
}

export async function startAgent(id: string): Promise<void> {
  return request(`/agents/${id}/start`, { method: 'POST' })
}

export async function stopAgent(id: string): Promise<void> {
  return request(`/agents/${id}/stop`, { method: 'POST' })
}

export async function deployAgent(id: string): Promise<Agent> {
  return request(`/agents/${id}/deploy`, { method: 'POST' })
}

export async function deleteAgent(id: string): Promise<void> {
  return request(`/agents/${id}`, { method: 'DELETE' })
}

export async function getAllTrades(): Promise<Trade[]> {
  const data = await request<Trade[] | { trades: Trade[] }>('/trades')
  return Array.isArray(data) ? data : (data as { trades: Trade[] }).trades ?? []
}

export async function getPortfolioMetrics(): Promise<PortfolioMetrics> {
  return request('/trades/metrics')
}

export async function getAgentTrades(agentId: string): Promise<Trade[]> {
  const data = await request<Trade[] | { trades: Trade[] }>(`/trades/agent/${agentId}`)
  return Array.isArray(data) ? data : (data as { trades: Trade[] }).trades ?? []
}

export async function getSettings(): Promise<{ hasVeniceApiKey: boolean; veniceApiKey: string }> {
  return request('/settings')
}

export async function updateSettings(data: { veniceApiKey: string }): Promise<{ message: string; hasVeniceApiKey: boolean }> {
  return request('/settings', { method: 'PUT', body: JSON.stringify(data) })
}

export interface WalletBalances {
  address: string
  eth: string
  weth: string
  usdc: string
  network: string
}

export async function getWalletBalances(): Promise<WalletBalances> {
  return request('/wallet')
}

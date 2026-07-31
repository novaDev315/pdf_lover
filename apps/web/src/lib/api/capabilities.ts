import type { ApiCapabilities, ServerOperationKind } from '@pdflover/shared'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function fetchApiCapabilities(signal?: AbortSignal): Promise<ApiCapabilities> {
  const response = await fetch(`${API_BASE_URL}/api/v1/capabilities`, { signal })
  if (!response.ok) {
    throw new Error(`Capabilities request failed with status ${response.status}`)
  }
  return response.json() as Promise<ApiCapabilities>
}

export function getOperationCapability(
  capabilities: ApiCapabilities | undefined,
  kind: ServerOperationKind,
) {
  return capabilities?.operations.find((operation) => operation.kind === kind)
}


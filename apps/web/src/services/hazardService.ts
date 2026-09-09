import { ActiveHazardState, ActiveHazardStateSchema } from "@routeguard/shared";

export async function fetchActiveHazard(signal?: AbortSignal): Promise<ActiveHazardState> {
  const response = await fetch("/api/safety/hazards/active", { signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch active hazard state (${response.status})`);
  }

  const result = ActiveHazardStateSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error("Invalid active hazard state received from the API");
  }

  return result.data;
}
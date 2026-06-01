import type { PersistedProjectState } from "./localProjectPersistence.js";
import { loadLocalProjectState, readPersistedProjectState } from "./localProjectPersistence.js";

export interface CurrentUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

export interface ProjectSummary {
  storageProjectId: string;
  projectId: string;
  name: string;
  ownerEmail: string;
}

export interface BackendProjectState extends PersistedProjectState {
  storageProjectId: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  role: "admin" | "user";
}

export interface AdminProjectSummary extends ProjectSummary {
  userIds: string[];
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetchApi("/api/session");

  if (!response.ok) {
    return null;
  }

  const body = await readJsonResponse(response);

  if (!isRecord(body) || !isCurrentUser(body.user)) {
    return null;
  }

  return body.user;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const response = await fetchApi("/api/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Login failed."));
  }

  if (!isRecord(body) || !isCurrentUser(body.user)) {
    throw new Error("Login response was invalid.");
  }

  return body.user;
}

export async function logout(): Promise<void> {
  await fetchApi("/api/logout", {
    method: "POST",
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await fetchApi("/api/projects");
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Project list failed."));
  }

  if (!isRecord(body) || !Array.isArray(body.projects)) {
    return [];
  }

  return body.projects.flatMap((project): ProjectSummary[] => {
    return isProjectSummary(project) ? [project] : [];
  });
}

export async function loadBackendProjectState(storageProjectId: string | null = null): Promise<BackendProjectState> {
  const response = await fetchApi(storageProjectId === null ? "/api/project" : `/api/project?project=${encodeURIComponent(storageProjectId)}`);
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Project load failed."));
  }

  const state = readBackendProjectState(body);

  if (state === null) {
    throw new Error("Project response was invalid.");
  }

  const localState = loadLocalProjectState();

  if (shouldMigrateLocalProject(state, localState)) {
    await saveBackendProjectState(localState, state.storageProjectId);
    return {
      ...localState,
      storageProjectId: state.storageProjectId,
    };
  }

  return state;
}

export async function saveBackendProjectState(state: PersistedProjectState, storageProjectId: string | null = null): Promise<void> {
  const response = await fetchApi(storageProjectId === null ? "/api/project" : `/api/project?project=${encodeURIComponent(storageProjectId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    const body = await readJsonResponse(response).catch((): unknown => null);
    throw new Error(readApiError(body, "Project save failed."));
  }
}

export async function loadAdminData(): Promise<{ users: AdminUserSummary[]; projects: AdminProjectSummary[] }> {
  const [usersResponse, projectsResponse] = await Promise.all([
    fetchApi("/api/admin/users"),
    fetchApi("/api/admin/projects"),
  ]);
  const usersBody = await readJsonResponse(usersResponse);
  const projectsBody = await readJsonResponse(projectsResponse);

  if (!usersResponse.ok) {
    throw new Error(readApiError(usersBody, "Could not load users."));
  }

  if (!projectsResponse.ok) {
    throw new Error(readApiError(projectsBody, "Could not load projects."));
  }

  return {
    users: isRecord(usersBody) && Array.isArray(usersBody.users) ? usersBody.users.flatMap((user): AdminUserSummary[] => (isAdminUser(user) ? [user] : [])) : [],
    projects: isRecord(projectsBody) && Array.isArray(projectsBody.projects)
      ? projectsBody.projects.flatMap((project): AdminProjectSummary[] => (isAdminProject(project) ? [project] : []))
      : [],
  };
}

export async function createAdminUser(email: string, password: string, role: "admin" | "user"): Promise<void> {
  const response = await fetchApi("/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Could not create user."));
  }
}

export async function createAdminProject(name: string, projectId: string, ownerUserId: string): Promise<void> {
  const response = await fetchApi("/api/admin/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, projectId, ownerUserId }),
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Could not create project."));
  }
}

export async function renameAdminProject(storageProjectId: string, name: string): Promise<void> {
  const response = await fetchApi("/api/admin/projects", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storageProjectId, name }),
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Could not rename project."));
  }
}

export async function addAdminProjectUser(storageProjectId: string, userId: string): Promise<void> {
  const response = await fetchApi("/api/admin/project-users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storageProjectId, userId }),
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Could not add user to project."));
  }
}

export async function removeAdminProjectUser(storageProjectId: string, userId: string): Promise<void> {
  const response = await fetchApi(`/api/admin/project-users?project=${encodeURIComponent(storageProjectId)}&user=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readApiError(body, "Could not remove user from project."));
  }
}

function shouldMigrateLocalProject(backendState: PersistedProjectState, localState: PersistedProjectState | null): localState is PersistedProjectState {
  if (localState === null) {
    return false;
  }

  return backendState.project.assets.length === 0 && localState.project.assets.length > 0;
}

function readBackendProjectState(value: unknown): BackendProjectState | null {
  if (!isRecord(value) || typeof value.storageProjectId !== "string") {
    return null;
  }

  const state = readPersistedProjectState(value);

  if (state === null) {
    return null;
  }

  return {
    ...state,
    storageProjectId: value.storageProjectId,
  };
}

function isCurrentUser(value: unknown): value is CurrentUser {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    (value.role === "admin" || value.role === "user");
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  return isRecord(value) &&
    typeof value.storageProjectId === "string" &&
    typeof value.projectId === "string" &&
    typeof value.name === "string" &&
    typeof value.ownerEmail === "string";
}

function isAdminUser(value: unknown): value is AdminUserSummary {
  return isCurrentUser(value);
}

function isAdminProject(value: unknown): value is AdminProjectSummary {
  return isProjectSummary(value) && Array.isArray(value.userIds) && value.userIds.every((userId) => typeof userId === "string");
}

function readApiError(value: unknown, fallback: string): string {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return fallback;
}

async function fetchApi(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Backend API is not available. Start the Cat Meow Studio backend and try again.");
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const source = await response.text();

  if (source.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error("Backend API returned an invalid response.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import bcrypt from "bcrypt";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { createId, openDatabase } from "./db.mjs";
import {
  addProjectUser,
  createProjectForUser,
  listAllProjectSummaries,
  listProjectSummaries,
  listProjectUserIds,
  loadProjectState,
  loadProjectStateByStorageId,
  removeProjectUser,
  renameProject,
  saveProjectState,
  saveProjectStateByStorageId,
} from "./projectStore.mjs";

const port = Number(process.env.PORT ?? process.env.CMS_PORT ?? 8787);
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 14;
const db = openDatabase();

const server = createServer((request, response) => {
  void route(request, response).catch((error) => {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  });
});

server.listen(port, () => {
  console.log(`Cat Meow Studio backend listening on http://localhost:${port}`);
});

async function route(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    await routeApi(request, response, url);
    return;
  }

  serveStatic(response, url.pathname);
}

async function routeApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/session") {
    const user = getSessionUser(request);
    sendJson(response, 200, { user: user === null ? null : { id: user.id, email: user.email, role: user.role } });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = db.prepare("SELECT id, email, role, password_hash FROM users WHERE email = ?").get(email);

    if (user === undefined || !(await bcrypt.compare(password, String(user.password_hash)))) {
      sendJson(response, 401, { error: "Invalid email or password." });
      return;
    }

    const sessionId = createId();
    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + sessionMaxAgeMs).toISOString();
    db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(sessionId, user.id, expiresAt, timestamp);
    response.setHeader("Set-Cookie", createSessionCookie(sessionId, sessionMaxAgeMs));
    sendJson(response, 200, { user: { id: user.id, email: user.email, role: user.role } });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    const sessionId = getCookie(request, "cms_session");

    if (sessionId !== null) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    }

    response.setHeader("Set-Cookie", clearSessionCookie());
    sendJson(response, 200, { ok: true });
    return;
  }

  const user = getSessionUser(request);

  if (user === null) {
    sendJson(response, 401, { error: "Login required." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/project") {
    const storageProjectId = url.searchParams.get("project");
    sendJson(response, 200, storageProjectId === null ? loadProjectState(db, user.id) : loadProjectStateByStorageId(db, user.id, storageProjectId, user.role === "admin"));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/project") {
    const body = await readJsonBody(request);
    const storageProjectId = url.searchParams.get("project");

    if (storageProjectId === null) {
      saveProjectState(db, user.id, body);
    } else {
      saveProjectStateByStorageId(db, user.id, storageProjectId, body, user.role === "admin");
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    sendJson(response, 200, { projects: user.role === "admin" ? listAllProjectSummaries(db) : listProjectSummaries(db, user.id) });
    return;
  }

  if (url.pathname.startsWith("/api/admin/")) {
    await routeAdminApi(request, response, url, user);
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function routeAdminApi(request, response, url, user) {
  if (user.role !== "admin") {
    sendJson(response, 403, { error: "Admin role required." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/users") {
    const users = db.prepare("SELECT id, email, role, created_at, updated_at FROM users ORDER BY email ASC").all().map(toUserSummary);
    sendJson(response, 200, { users });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/users") {
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : "user";

    if (email === "" || password === "") {
      sendJson(response, 400, { error: "Email and password are required." });
      return;
    }

    const timestamp = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      db.prepare(`
        INSERT INTO users (id, email, role, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(createId(), email, role, passwordHash, timestamp, timestamp);
    } catch {
      sendJson(response, 409, { error: "User already exists." });
      return;
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/projects") {
    const projects = listAllProjectSummaries(db).map((project) => ({
      ...project,
      userIds: listProjectUserIds(db, project.storageProjectId),
    }));
    sendJson(response, 200, { projects });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/projects") {
    const body = await readJsonBody(request);
    const ownerUserId = typeof body.ownerUserId === "string" ? body.ownerUserId : user.id;
    const name = typeof body.name === "string" ? body.name : "Cat Meow Studio";
    const projectId = typeof body.projectId === "string" ? body.projectId : name;
    sendJson(response, 200, createProjectForUser(db, ownerUserId, name, projectId));
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/admin/projects") {
    const body = await readJsonBody(request);
    const storageProjectId = typeof body.storageProjectId === "string" ? body.storageProjectId : "";
    const name = typeof body.name === "string" ? body.name : "";

    if (storageProjectId === "" || name.trim() === "") {
      sendJson(response, 400, { error: "Project and name are required." });
      return;
    }

    renameProject(db, storageProjectId, name);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/project-users") {
    const body = await readJsonBody(request);
    const storageProjectId = typeof body.storageProjectId === "string" ? body.storageProjectId : "";
    const userId = typeof body.userId === "string" ? body.userId : "";

    if (storageProjectId === "" || userId === "") {
      sendJson(response, 400, { error: "Project and user are required." });
      return;
    }

    addProjectUser(db, storageProjectId, userId);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/admin/project-users") {
    const storageProjectId = url.searchParams.get("project");
    const userId = url.searchParams.get("user");

    if (storageProjectId === null || userId === null) {
      sendJson(response, 400, { error: "Project and user are required." });
      return;
    }

    removeProjectUser(db, storageProjectId, userId);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

function getSessionUser(request) {
  const sessionId = getCookie(request, "cms_session");

  if (sessionId === null) {
    return null;
  }

  const row = db.prepare(`
    SELECT users.id, users.email, users.role, sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
  `).get(sessionId);

  if (row === undefined) {
    return null;
  }

  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return {
    id: String(row.id),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "user",
  };
}

function toUserSummary(row) {
  return {
    id: String(row.id),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "user",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json;charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function createSessionCookie(sessionId, maxAgeMs) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `cms_session=${sessionId}; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `cms_session=; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=0`;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie;

  if (typeof cookieHeader !== "string") {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((candidate) => candidate.startsWith(prefix));

  return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length));
}

function serveStatic(response, pathname) {
  const distRoot = resolve("dist");
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(distRoot, requestedPath));
  const fallbackPath = join(distRoot, "index.html");
  const resolvedPath = filePath.startsWith(distRoot) && existsSync(filePath) ? filePath : fallbackPath;

  if (!existsSync(resolvedPath)) {
    sendJson(response, 404, { error: "Build frontend first or run Vite dev server." });
    return;
  }

  response.writeHead(200, {
    "content-type": getContentType(resolvedPath),
  });
  createReadStream(resolvedPath).pipe(response);
}

function getContentType(filePath) {
  const extension = extname(filePath);

  if (extension === ".html") {
    return "text/html;charset=utf-8";
  }

  if (extension === ".js") {
    return "text/javascript;charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css;charset=utf-8";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

import type { AdminProjectSummary, AdminUserSummary } from "../storage/backendProjectPersistence.js";
import type { AppStatus } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";

export interface AdminActions {
  back: () => void;
  createUser: (email: string, password: string, role: "admin" | "user") => void;
  createProject: (name: string, projectId: string, ownerUserId: string) => void;
  renameProject: (storageProjectId: string, name: string) => void;
  addProjectUser: (storageProjectId: string, userId: string) => void;
  removeProjectUser: (storageProjectId: string, userId: string) => void;
}

export function renderAdmin(
  root: HTMLElement,
  status: AppStatus | null,
  users: readonly AdminUserSummary[],
  projects: readonly AdminProjectSummary[],
  actions: AdminActions,
): void {
  const page = createElement("main", "admin-page");
  const header = createElement("header", "app-header");
  const brand = createElement("div", "brand");
  const logo = createElement("img", "brand-logo");
  logo.src = "/favicon.png";
  logo.alt = "Cat Meow Studio";
  brand.append(logo, createTextElement("h1", "Admin"));
  const backButton = createTextElement("button", "← Studio", "header-action-button");
  backButton.type = "button";
  backButton.addEventListener("click", actions.back);
  header.append(brand, backButton);

  const content = createElement("section", "admin-grid");
  content.append(renderUserPanel(users, actions), renderProjectPanel(users, projects, actions));

  const statusElement = createElement("section", `status-bar${status === null ? "" : ` is-${status.tone}`}`);
  statusElement.textContent = status?.message ?? "";
  page.append(header, content, statusElement);
  root.className = "app app-admin";
  root.replaceChildren(page);
}

function renderUserPanel(users: readonly AdminUserSummary[], actions: AdminActions): HTMLElement {
  const panel = createElement("section", "panel admin-panel");
  const emailInput = createElement("input");
  const passwordInput = createElement("input");
  const roleSelect = createElement("select");
  const submitButton = createTextElement("button", "+ User", "header-action-button");
  const form = createElement("form", "admin-form");
  emailInput.type = "email";
  passwordInput.type = "password";
  roleSelect.append(createOption("user", "User"), createOption("admin", "Admin"));
  submitButton.type = "submit";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.createUser(emailInput.value, passwordInput.value, roleSelect.value === "admin" ? "admin" : "user");
  });
  form.append(createField("Email", emailInput), createField("Password", passwordInput), createField("Role", roleSelect), submitButton);

  const list = createElement("div", "admin-list");
  users.forEach((user) => {
    const row = createElement("div", "admin-list-row admin-user-row");
    row.append(createTextElement("strong", user.email), createTextElement("span", user.role, `admin-role-pill is-${user.role}`));
    list.append(row);
  });

  panel.append(createTextElement("h2", "Users"), form, list);
  return panel;
}

function renderProjectPanel(users: readonly AdminUserSummary[], projects: readonly AdminProjectSummary[], actions: AdminActions): HTMLElement {
  const panel = createElement("section", "panel admin-panel");
  const nameInput = createElement("input");
  const projectIdInput = createElement("input");
  const ownerSelect = createUserSelect(users);
  const submitButton = createTextElement("button", "+ Project", "header-action-button");
  const form = createElement("form", "admin-form");
  submitButton.type = "submit";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.createProject(nameInput.value, projectIdInput.value, ownerSelect.value);
  });
  form.append(createField("Name", nameInput), createField("Project ID", projectIdInput), createField("Owner", ownerSelect), submitButton);

  const list = createElement("div", "admin-list");
  projects.forEach((project) => {
    const row = createElement("div", "admin-project-row");
    const titleRow = createElement("div", "admin-project-title-row");
    const titleInput = createElement("input");
    const renameButton = createTextElement("button", "Rename", "header-action-button");
    titleInput.type = "text";
    titleInput.value = project.name;
    renameButton.type = "button";
    renameButton.addEventListener("click", () => actions.renameProject(project.storageProjectId, titleInput.value));
    titleRow.append(createField("Project", titleInput), renameButton);
    const meta = createTextElement("span", `${project.projectId} · owner ${project.ownerEmail}`, "admin-project-meta");
    const userSelect = createUserSelect(users);
    const addButton = createTextElement("button", "+", "asset-menu-action");
    addButton.type = "button";
    addButton.title = "Add user to project";
    addButton.addEventListener("click", () => actions.addProjectUser(project.storageProjectId, userSelect.value));
    const memberList = createElement("div", "admin-member-list");
    project.userIds.forEach((userId) => {
      const user = users.find((candidate) => candidate.id === userId);
      const removeButton = createTextElement("button", "×", "asset-menu-action danger");
      const member = createElement("div", "admin-member-row");
      removeButton.type = "button";
      removeButton.title = "Remove user from project";
      removeButton.addEventListener("click", () => actions.removeProjectUser(project.storageProjectId, userId));
      member.append(createTextElement("span", user?.email ?? userId), removeButton);
      memberList.append(member);
    });
    const addUserRow = createElement("div", "admin-add-user-row");
    addUserRow.append(createField("Add user", userSelect), addButton);
    row.append(titleRow, meta, addUserRow, memberList);
    list.append(row);
  });

  panel.append(createTextElement("h2", "Projects"), form, list);
  return panel;
}

function createUserSelect(users: readonly AdminUserSummary[]): HTMLSelectElement {
  const select = createElement("select");
  users.forEach((user) => {
    select.append(createOption(user.id, user.email));
  });
  return select;
}

function createOption(value: string, label: string): HTMLOptionElement {
  const option = createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

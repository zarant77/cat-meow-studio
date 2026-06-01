import type { AppStatus } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";

export interface LoginActions {
  login: (email: string, password: string) => void;
}

export function renderLogin(root: HTMLElement, status: AppStatus | null, actions: LoginActions): void {
  const shell = createElement("main", "login-screen");
  const panel = createElement("section", "panel login-panel");
  const logo = createElement("img", "brand-logo");
  const title = createTextElement("h1", "Cat Meow Studio");
  const emailInput = createElement("input");
  const passwordInput = createElement("input");
  const submitButton = createTextElement("button", "Login", "header-action-button");
  const statusElement = createElement("p", `login-status${status === null ? "" : ` is-${status.tone}`}`);

  logo.src = "/favicon.png";
  logo.alt = "Cat Meow Studio";
  emailInput.type = "email";
  emailInput.autocomplete = "username";
  emailInput.required = true;
  passwordInput.type = "password";
  passwordInput.autocomplete = "current-password";
  passwordInput.required = true;
  submitButton.type = "submit";

  if (status !== null) {
    statusElement.textContent = status.message;
  }

  const form = createElement("form", "login-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.login(emailInput.value, passwordInput.value);
  });
  form.append(createField("Email", emailInput), createField("Password", passwordInput), submitButton);
  panel.append(logo, title, form, statusElement);
  shell.append(panel);
  root.className = "app app-login";
  root.replaceChildren(shell);
}

import { createAdminUser, openDatabase } from "./db.mjs";

const email = process.env.CMS_ADMIN_EMAIL;
const password = process.env.CMS_ADMIN_PASSWORD;

if (email === undefined || password === undefined || email.trim() === "" || password === "") {
  console.error("Set CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD to create the first admin user.");
  process.exitCode = 1;
} else {
  const db = openDatabase();
  const created = await createAdminUser(db, email, password, "admin");
  console.log(created ? `Created admin user ${email}.` : `Admin user ${email} already exists.`);
  db.close();
}

import type { Route } from "next";

/**
 * DEMO sign-in accounts, shown openly on the login page. They only switch the preview viewer: no real authentication,
 * session or password storage exists. Remove this file when the backend's sign-in is connected.
 */
export const DEMO_PASSWORD = "demo1234";

export const DEMO_ACCOUNTS = [
  { email: "customer@demo.test", label: "Approved customer", view: "customer", home: "/account" as Route },
  { email: "applicant@demo.test", label: "Applicant awaiting approval", view: "customer-pending", home: "/application-pending" as Route },
  { email: "admin@demo.test", label: "Administrator", view: "admin", home: "/admin" as Route },
] as const;

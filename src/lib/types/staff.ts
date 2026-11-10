import type { ID, ISODateString } from "./common";

export interface Role {
  id: ID;
  name: string;
  description: string;
  /** Built-in roles can't be deleted. */
  system: boolean;
  /** "module.action", see src/lib/auth/capabilities.ts. */
  capabilities: string[];
  updatedAt: ISODateString;
}

export type RoleInput = Pick<Role, "name" | "description" | "capabilities">;

export interface StaffMember {
  id: ID;
  name: string;
  email: string;
  roleId: ID;
  active: boolean;
  /** When an invitation was asked for. DEMO: nothing is sent; the backend sends it and clears this on acceptance. */
  invitedAt?: ISODateString;
  createdAt: ISODateString;
}

export type StaffInput = Pick<StaffMember, "name" | "email" | "roleId" | "active"> & {
  /** New staff only: invite them to set a password. */
  invite?: boolean;
};

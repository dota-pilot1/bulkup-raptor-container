export type MemberRole = { id: number; code: string; name: string };

export type MemberPermission = {
  code: string;
  name: string;
  description: string;
  categoryCode?: string;
  categoryName?: string;
  categorySortOrder?: number;
};

export type MemberSession = {
  id: number;
  email: string;
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  roles: MemberRole[];
  permissions: string[];
  permissionDetails?: MemberPermission[];
};


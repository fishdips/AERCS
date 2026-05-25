package com.aercs.entity;

// NOTE: When adding new roles, add them here AND update db/schema.sql user_role enum.
// Active roles in MVP: ADMIN, DEPT_STAFF
// Defined but no permissions wired: ACCRED_COORDINATOR, INSTITUTIONAL_OFFICE, ACCREDITOR_LINK
public enum UserRole {
    ADMIN,
    DEPT_STAFF,
    ACCRED_COORDINATOR,
    INSTITUTIONAL_OFFICE,
    ACCREDITOR_LINK
}

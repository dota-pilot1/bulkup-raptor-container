-- Preserve every existing assignment before replacing the single-role column.
CREATE TABLE member_roles (
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    PRIMARY KEY (member_id, role_id)
);
CREATE INDEX idx_member_roles_role ON member_roles(role_id);
INSERT INTO member_roles(member_id, role_id) SELECT id, role_id FROM members;
-- Sessions containing the old single-role snapshot must log in again.
UPDATE members SET session_version = session_version + 1;
ALTER TABLE members DROP COLUMN role_id;

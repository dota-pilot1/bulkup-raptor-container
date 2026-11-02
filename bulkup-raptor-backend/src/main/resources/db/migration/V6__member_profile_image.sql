CREATE TABLE uploaded_images (
    storage_key VARCHAR(255) PRIMARY KEY,
    uploader_member_id BIGINT NOT NULL REFERENCES members(id),
    url VARCHAR(2048) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('STORED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_uploaded_images_uploader ON uploaded_images(uploader_member_id);

ALTER TABLE members ADD COLUMN profile_image_key VARCHAR(255);
ALTER TABLE members ADD CONSTRAINT fk_members_profile_image
    FOREIGN KEY (profile_image_key) REFERENCES uploaded_images(storage_key);

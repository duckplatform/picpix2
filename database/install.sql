CREATE DATABASE IF NOT EXISTS picpix
	CHARACTER SET utf8mb4
	COLLATE utf8mb4_unicode_ci;

USE picpix;

CREATE TABLE IF NOT EXISTS users (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	email VARCHAR(190) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	full_name VARCHAR(120) NOT NULL,
	role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
	status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
	last_login_at DATETIME NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uk_users_email (email),
	KEY idx_users_role_status (role, status),
	KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	uuid CHAR(36) NOT NULL,
	owner_user_id BIGINT UNSIGNED NOT NULL,
	name VARCHAR(180) NOT NULL,
	description TEXT NOT NULL,
	starts_at DATETIME NOT NULL,
	status ENUM('active', 'inactive') NOT NULL DEFAULT 'inactive',
	token CHAR(10) NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uk_events_uuid (uuid),
	UNIQUE KEY uk_events_token (token),
	KEY idx_events_owner_status (owner_user_id, status),
	KEY idx_events_starts_at (starts_at),
	CONSTRAINT fk_events_owner_user
		FOREIGN KEY (owner_user_id) REFERENCES users(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (
	email,
	password_hash,
	full_name,
	role,
	status,
	last_login_at
) VALUES (
	'admin@example.com',
	'$2a$12$/7YSCPHVP47Yr0Si/xDAoO2GEKG08iXxm6X4OzO/gYLymjEICIkly',
	'Administrateur PicPix2',
	'admin',
	'active',
	NULL
) ON DUPLICATE KEY UPDATE
	password_hash = VALUES(password_hash),
	full_name = VALUES(full_name),
	role = VALUES(role),
	status = VALUES(status);

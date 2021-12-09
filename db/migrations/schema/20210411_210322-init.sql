-- Migration: init
-- Created at: 2021-04-11 21:03:22
-- ====  UP  ====

BEGIN;

  --
  -- API list
  --
  CREATE TABLE `apis` (
    `domain` VARCHAR(32) NOT NULL COMMENT "The domain of the api, e.g., 'registry', 'p2p', 'brokerage', 'exchange', etc. This appears in the first segment of the url.",
    `version` VARCHAR(12) NOT NULL COMMENT "Usually 'vN', where v is a literal constant and N is the version number. This appears in the second segment of the url.",
    `url` VARCHAR(128) NOT NULL COMMENT "The target url to proxy requests to for this domain and version",
    `allowUnidentifiedReqs` TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT "Whether or not to allow requests to this api and version that do not have an api key associated with them. (This might be used for webhooks, for example.)",
    `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT "Whether or not to actually forward requests to this api and version.",
    PRIMARY KEY (`domain`, `version`)
  ) ENGINE=InnoDB;


  --
  -- Organizations
  --
  CREATE TABLE `organizations` (
    `id` CHAR(36) NOT NULL PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `createdMs` BIGINT UNSIGNED NOT NULL
  ) ENGINE=InnoDB;


  --
  -- Clients
  --
  CREATE TABLE `clients` (
    `id` CHAR(36) NOT NULL PRIMARY KEY COMMENT "The actual API key; should be a UUIDv4",
    `secretBcrypt` VARCHAR(255) NOT NULL COMMENT "The hashed secret, which should be a long random string (like a 64-bit hex) hashed using bcrypt",
    `name` VARCHAR(64) NOT NULL COMMENT "The name of the service for which this API key was generated, e.g., 'ACME main website' or 'DoorDash App'",
    `reqsPerSec` INT NOT NULL COMMENT "The rate-limit (per second) for this client. -1 indicates no limit.",
    `organizationId` CHAR(36) NOT NULL COMMENT "The organization that this client belongs to.",
    `createdMs` BIGINT UNSIGNED NOT NULL,
    `deletedMs` BIGINT UNSIGNED NULL COMMENT "If not null, marks the moment at which this client was deleted.",
    CONSTRAINT `orgFk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `deletedIdx` (`deletedMs`)
  ) ENGINE=InnoDB;

  CREATE TABLE `client-access-restrictions` (
      `id` CHAR(36) NOT NULL PRIMARY KEY,
      `type` ENUM('ip','host','api') NOT NULL COMMENT "The type of restriction this row represents. All groups of restrictions define a collection of ANY possible matches, but are processed using AND logic, so specifying ip, host and api restrictions results in a requirement that the ip match one of the listed ips, the host match one of the listed hosts, and the api requested match one of the listed apis.",
      `value` VARCHAR(64) NOT NULL COMMENT "The ip, hostname or api to match against",
      `clientId` CHAR(36) NOT NULL COMMENT "The client being restricted",
      `createdMs` BIGINT UNSIGNED NOT NULL,
      CONSTRAINT `clientFk1` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `client-roles` (
    `clientId` char(36) NOT NULL,
    `roleId` VARCHAR(32) NOT NULL COMMENT 'This is a string field by default, but it is generally good policy to make fields like this enums. That will be left up to the individual implementors of this service.',
    PRIMARY KEY (`clientId`,`roleId`),
    CONSTRAINT `clientFK2` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;


  --
  -- Users
  --
  CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COMMENT 'The user''s full legal name. This will be passed back on creation to other systems.',
    `passwordBcrypt` VARCHAR(255) NULL COMMENT 'A bcrypt hash of the user''s password.',
    `2fa` TINYINT(1) NOT NULL DEFAULT 0 COMMENT "Whether or not 2-factor authentication is enabled for this user",
    `createdMs` BIGINT UNSIGNED NOT NULL,
    `deletedMs` BIGINT NULL,
    `bannedMs` BIGINT NULL
  ) ENGINE=InnoDB;

  CREATE TABLE `emails` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'The user''s email address',
    `userId` CHAR(36) NOT NULL,
    `verifiedMs` BIGINT UNSIGNED,
    `createdMs` BIGINT UNSIGNED NOT NULL,
    CONSTRAINT `emailFk1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `verification-codes` (
    `codeSha256` BINARY(32) NOT NULL PRIMARY KEY,
    `type` ENUM('login','verification') NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `userGeneratedToken` VARCHAR(255) COMMENT "This will be null for email verifications, but will have a user-generated value for logins",
    `createdMs` BIGINT UNSIGNED NOT NULL,
    `expiresMs` BIGINT UNSIGNED NOT NULL,
    `consumedMs` BIGINT UNSIGNED,
    `invalidatedMs` BIGINT UNSIGNED,
    CONSTRAINT `emailFK2` FOREIGN KEY (`email`) REFERENCES `emails` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `user-roles` (
    `userId` CHAR(36) NOT NULL,
    `roleId` VARCHAR(32) NOT NULL COMMENT 'This is a string field by default, but it is generally good policy to make fields like this enums. That will be left up to the individual implementors of this service.',
    PRIMARY KEY (`userId`, `roleId`),
    CONSTRAINT `userFk1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `user-clients` (
    `userId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `createdMs` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`userId`, `clientId`),
    CONSTRAINT `userFk2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `clientFk3` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;


  --
  -- Sessions
  --
  CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL PRIMARY KEY,
    `userAgent` VARCHAR(255) DEFAULT NULL COMMENT "The user-agent string representing the device from which the user has logged in",
    `ip` VARCHAR(128) NOT NULL COMMENT "The ip address (v4 or v6) from which this session was created.",
    `userId` CHAR(36) NOT NULL,
    `invalidatedMs` BIGINT UNSIGNED NULL COMMENT "Manually invalidate the session by setting this value",
    `createdMs` BIGINT UNSIGNED NOT NULL COMMENT "The timestamp in MS when this session was created",
    `expiresMs` BIGINT UNSIGNED NOT NULL COMMENT "The timestamp in MS when this session will expire. After this time, the refresh token will no longer work.",
    CONSTRAINT `userFk3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `invalidatedIndex` (`expiresMs`, `invalidatedMs`)
  ) ENGINE=InnoDB;

  CREATE TABLE `session-tokens` (
    `tokenSha256` BINARY(32) NOT NULL COMMENT "Sha256 hash of a random generated byte-string used to access a session",
    `type` ENUM('session', 'refresh') COMMENT "Session tokens are short-lived multi-use tokens that users provide to prove ownership of a session. Refresh tokens are longer lived single-use tokens provided to refresh expired session tokens.",
    `sessionId` CHAR(36) NOT NULL,
    `createdMs` BIGINT UNSIGNED NOT NULL,
    `expiresMs` BIGINT UNSIGNED NOT NULL COMMENT "Timestamp in MS when this token will expire",
    `consumedMs` BIGINT UNSIGNED NULL COMMENT "For refresh tokens only: Each token may only be used once.",
    `invalidatedMs` BIGINT UNSIGNED NULL COMMENT "Manually invalidate the token by setting this value",
    CONSTRAINT `sessionFk1` FOREIGN KEY (`sessionId`) REFERENCES `sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;


  --
  -- Organization memberships
  --
  CREATE TABLE `org-memberships` (
    `id` CHAR(36) NOT NULL PRIMARY KEY,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `read` TINYINT(1) NOT NULL DEFAULT 1,
    `edit` TINYINT(1) NOT NULL DEFAULT 1,
    `manage` TINYINT(1) NOT NULL DEFAULT 0,
    `delete` TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT `orgFk2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `userFk4` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

COMMIT;

-- ==== DOWN ====

BEGIN;

  DROP TABLE `org-memberships`;
  DROP TABLE `session-tokens`;
  DROP TABLE `sessions`;
  DROP TABLE `user-clients`;
  DROP TABLE `user-roles`;
  DROP TABLE `verification-codes`;
  DROP TABLE `emails`;
  DROP TABLE `users`;
  DROP TABLE `client-roles`;
  DROP TABLE `client-access-restrictions`;
  DROP TABLE `clients`;
  DROP TABLE `organizations`;
  DROP TABLE `apis`;

COMMIT;

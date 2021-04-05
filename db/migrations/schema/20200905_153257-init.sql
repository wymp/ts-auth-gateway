-- Migration: init
-- Created at: 2020-09-05 15:32:57
-- ====  UP  ====

BEGIN;

  --
  -- API list
  --
  CREATE TABLE `apis` (
    `domain` VARCHAR(32) NOT NULL COMMENT "The domain of the api, e.g., 'registry', 'p2p', 'brokerage', 'exchange', etc. This appears in the first segment of the url.",
    `version` VARCHAR(12) NOT NULL COMMENT "Usually 'vN', where v is a literal constant and N is the version number. This appears in the second segment of the url.",
    `url` VARCHAR(128) NOT NULL COMMENT "The target url to proxy requests to for this domain and version",
    `trimPath` TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 COMMENT "Whether or not to trim the domain and version from the front of the path before sending request to destination.",
    `signingAlgorithm` ENUM("ES256", "RS256") NOT NULL DEFAULT "ES256" COMMENT "The signing algorithm to use for signing the auth header for requests to this url and version.",
    `allowUnidentifiedReqs` TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT "Whether or not to allow requests to this api and version that do not have an api key associated with them. (This might be used for webhooks, for example.)",
    `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT "Whether or not to actually forward requests to this api and version.",
    PRIMARY KEY (`domain`, `version`)
  ) ENGINE=InnoDB;

  INSERT INTO `apis` VALUES
    ('accounts', 'v3', 'http://localhost:0000', 1, 'ES256', 0, 1),
    ('admin', 'v2', 'http://dev.adminv2-api:790', 0, 'RS256', 0, 1),
    ('alerts', 'v1', 'http://localhost:5656', 1, 'ES256', 0, 1),
    ('auditor', 'v3', 'http://localhost:1234', 1, 'ES256', 0, 1),
    ('brokerage', 'v2', 'http://dev.brokeragev2-api:790', 0, 'RS256', 0, 1),
    ('brokerage', 'v3', 'http://localhost:3001', 1, 'ES256', 0, 1),
    ('compliance', 'v1', 'http://localhost:3555', 1, 'ES256', 0, 1),
    ('compliance', 'v2', 'http://localhost:3555', 1, 'ES256', 0, 1),
    ('exchange', 'v2', 'http://localhost:3331', 1, 'ES256', 0, 1),
    ('p2p', 'v2', 'http://localhost:9156', 1, 'ES256', 0, 1),
    ('registry', 'v3', 'http://localhost:5435', 1, 'ES256', 0, 1),
    ('reports', 'v2', 'http://localhost:9012', 1, 'ES256', 0, 1),
    ('s3', 'v2', 'http://localhost:8877', 1, 'ES256', 0, 1);


  --
  -- Organizations
  --
  CREATE TABLE `organizations` (
      `id` CHAR(36) NOT NULL PRIMARY KEY,
      `name` VARCHAR(255) NOT NULL,
      `createdMs` BIGINT UNSIGNED NOT NULL
  ) ENGINE=InnoDB;

  INSERT INTO `organizations` VALUES ('2d484477-0585-47e7-bf47-beb75ef95d38', 'Openfinance Technologies, LLC', UNIX_TIMESTAMP() * 1000);


  --
  -- Clients
  --
  CREATE TABLE `clients` (
      `id` CHAR(36) NOT NULL PRIMARY KEY COMMENT "The actual API key; should be a UUIDv4",
      `secretHash` VARCHAR(255) NOT NULL COMMENT "The hashed secret, which should be a long random string (like a 64-bit hex) hashed using bcrypt",
      `name` VARCHAR(64) NOT NULL COMMENT "The name of the service for which this API key was generated, e.g., 'OFN trading screens' or 'admin screens'",
      `rateLimit` INT NOT NULL COMMENT "The rate-limit (per second) for this API key. -1 indicates no limit.",
      `requireUser` TINYINT NOT NULL DEFAULT 1 COMMENT 'When true (default), any request from this client must be accompanied by a valid user session',
      `organizationId` CHAR(36) NOT NULL COMMENT "The organization that this key belongs to.",
      `createdMs` BIGINT UNSIGNED NOT NULL,
      CONSTRAINT `orgFk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `client-access-restrictions` (
      `id` CHAR(36) NOT NULL PRIMARY KEY,
      `type` ENUM('ip','host','api') NOT NULL COMMENT "The type of restriction this row represents. All groups of restrictions define a collection of ANY possible matches, but are processed using AND logic, so specifying ip, host and api restrictions results in a requirement that the ip match one of the listed ips, the host match one of the listed hosts, and the api requested match one of the listed apis.",
      `value` VARCHAR(64) NOT NULL COMMENT "The ip or hostname to match against",
      `clientId` CHAR(36) NOT NULL COMMENT "The client being restricted",
      `createdMs` BIGINT UNSIGNED NOT NULL,
      CONSTRAINT `clientFk1` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `client-roles` (
    `clientId` char(36) NOT NULL,
    `roleId` ENUM('external', 'internal', 'system', 'exchange') NOT NULL COMMENT 'Aligns with data-model-spec::Globals.ApiKeyRoles',
    PRIMARY KEY (`clientId`,`roleId`),
    CONSTRAINT `clientFK2` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;


  --
  -- Users
  --
  CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COMMENT 'The user''s full legal name. This will be passed back on creation to other systems.',
    `passwordHash` VARCHAR(255) NULL COMMENT 'A bcrypt hash of the user''s password.',
    `banned` TINYINT(1) NOT NULL DEFAULT 0,
    `loginMethod` ENUM('email', 'password') NOT NULL DEFAULT 'email' COMMENT 'email = log in with email link; password = log in with password. Should align with data-model-spec::Auth.LoginMethods.',
    `2fa` TINYINT(1) NOT NULL DEFAULT 0 COMMENT "Whether or not 2-factor authentication is enabled for this user",
    `createdMs` BIGINT UNSIGNED NOT NULL
  ) ENGINE=InnoDB;

  CREATE TABLE `login-emails` (
    `email` VARCHAR(255) NOT NULL PRIMARY KEY,
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
    CONSTRAINT `emailFK2` FOREIGN KEY (`email`) REFERENCES `login-emails` (`email`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

  CREATE TABLE `user-roles` (
    `userId` CHAR(36) NOT NULL,
    `roleId` ENUM('investor', 'tech1', 'tech2', 'tech3', 'sysadmin', 'custserv1', 'custserv2', 'custserv3', 'custadm', 'trade1', 'trade2', 'trade3', 'tradeadm', 'employee') NOT NULL COMMENT 'Aligns with data-model-spec::Globals.UserRoles',
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
    `userAgent` VARCHAR(255) NOT NULL COMMENT "The user-agent string representing the device from which the user has logged in",
    `ip` VARCHAR(128) NOT NULL COMMENT "The ip address (v4 or v6) from which this session was created.",
    `userId` CHAR(36) NOT NULL,
    `refreshTokenSha256` BINARY(32) NOT NULL COMMENT "Sha256 hash of a random generated byte-string used to generate new session tokens until the expiration of the session",
    `invalidatedMs` BIGINT UNSIGNED NULL COMMENT "Manually invalidate the session by setting this value to 1",
    `createdMs` BIGINT UNSIGNED NOT NULL COMMENT "The timestamp in MS when this session was created",
    `expiresMs` BIGINT UNSIGNED NOT NULL COMMENT "The timestamp in MS when this session will expire. After this time, the refresh token will no longer work.",
    CONSTRAINT `userFk3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `invalidatedIndex` (`expiresMs`, `invalidatedMs`)
  ) ENGINE=InnoDB;

  CREATE TABLE `session-tokens` (
    `tokenSha256` BINARY(32) NOT NULL COMMENT "Sha256 hash of a random generated byte-string used to access a session",
    `sessionId` CHAR(36) NOT NULL,
    `createdMs` BIGINT UNSIGNED NOT NULL,
    `expiresMs` BIGINT UNSIGNED NOT NULL COMMENT "Timestamp in MS when this token will expire",
    CONSTRAINT `sessionFk1` FOREIGN KEY (`sessionId`) REFERENCES `sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB;

COMMIT;

-- ==== DOWN ====

BEGIN;

  DROP TABLE `session-tokens`;
  DROP TABLE `sessions`;
  DROP TABLE `user-clients`;
  DROP TABLE `user-roles`;
  DROP TABLE `verification-codes`;
  DROP TABLE `login-emails`;
  DROP TABLE `users`;
  DROP TABLE `client-roles`;
  DROP TABLE `client-access-restrictions`;
  DROP TABLE `clients`;
  DROP TABLE `organizations`;
  DROP TABLE `apis`;

COMMIT;

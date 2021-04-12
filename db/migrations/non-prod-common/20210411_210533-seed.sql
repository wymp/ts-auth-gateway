-- Migration: seed
-- Created at: 2021-04-11 21:05:33
-- ====  UP  ====

BEGIN;

  INSERT INTO `apis` VALUES
    ('accounts', 'v1', 'http://localhost:0000', 0, 1),
    ('test', 'v1', 'http://localhost:8080', 0, 1);

  INSERT INTO `organizations` VALUES
    ('1eb9b2d9-9b59-6560-9f95-b5c015c766da', 'ACME Ventures', 1618190621644);

  INSERT INTO `clients` VALUES
    -- Secret: 2c51a52f2dec9998292dab987bd24eee136916898abab14f8a060f47b6287535
    ('1eb9b2d9-aa0b-68b0-2d59-5a25779175e7','$2a$10$mnZOIGUjN.Bq5CKyBn.cw.Rryyr9gDQkVXnRyN2qBYFd/R9RgxiLe','ACME Website',-1,"1eb9b2d9-9b59-6560-9f95-b5c015c766da",1618190621645);

  INSERT INTO `client-access-restrictions` VALUES
    ('1eb9b2e5-0624-6330-4d3a-8e87c8fd4414','host','https://dev.acme-ventures.com','1eb9b2d9-aa0b-68b0-2d59-5a25779175e7',1618190621646);

  INSERT INTO `client-roles` VALUES
    ('1eb9b2d9-aa0b-68b0-2d59-5a25779175e7', 'internal');

  INSERT INTO `users` VALUES
    -- Password: `Testing12!`
    ('1eb9b2e9-1e97-6850-d243-8452b516915f', 'Test User One', '$2a$10$2jhqTJXThvMxbETzO0Gq/eq7SeZIqpiY/HYWD1Qjmj/zJQohCSJJ6', 0, 0, 0, 1618190621647);

  INSERT INTO `emails` VALUES
    ('testing+1@example.com', '1eb9b2e9-1e97-6850-d243-8452b516915f', null, 1618190621647);

  INSERT INTO `user-roles` VALUES
    ('1eb9b2e9-1e97-6850-d243-8452b516915f', 'user'),
    ('1eb9b2e9-1e97-6850-d243-8452b516915f', 'sysadmin');

  INSERT INTO `user-clients` VALUES
    ('1eb9b2e9-1e97-6850-d243-8452b516915f', '1eb9b2d9-aa0b-68b0-2d59-5a25779175e7', 1618190621648);

COMMIT;

-- ==== DOWN ====

BEGIN;

  DELETE FROM `users` WHERE `id` IN ('1eb9b2e9-1e97-6850-d243-8452b516915f');
  DELETE FROM `organizations` WHERE `id` IN ('1eb9b2d9-9b59-6560-9f95-b5c015c766da');
  DELETE FROM `apis`;

COMMIT;

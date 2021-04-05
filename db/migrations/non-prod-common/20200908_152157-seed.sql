-- Migration: seed
-- Created at: 2020-09-08 15:21:57
-- ====  UP  ====

BEGIN;

  INSERT INTO `clients` VALUES
    -- Secret: 3b8f6a74-3e8f-4514-9bdc-bf88863f5076
    ('907ebd22-1ab4-4d6d-86b3-4abade4fb095','$2b$10$hoo6fsu2NzpIM6oLiaBUxOGNxk4AuDXFL9beDASgamcrX7XFTDPbi','Openfinance Back-End Microservices',-1,0,"2d484477-0585-47e7-bf47-beb75ef95d38",UNIX_TIMESTAMP()*1000),
    -- Secret: 3e9eeff3-a264-411f-abbb-924e97f3caf2
    ('bf0f4d4c-c6e4-41d3-a5e3-202195c9e9ec','$2b$10$Y/OUfMpQg8RzPeEMfO/7num5XcpFB1uR3Vi5bp5wVSCv3.Nnj.guy','Openfinance Main App',-1,0,"2d484477-0585-47e7-bf47-beb75ef95d38",UNIX_TIMESTAMP()*1000),
    -- Secret: 3e9eeff3-a264-411f-abbb-924e97f3caf2
    ('67cb7f28-9e71-45a3-874c-3f665c5eecc1','$2b$10$Y/OUfMpQg8RzPeEMfO/7num5XcpFB1uR3Vi5bp5wVSCv3.Nnj.guy','Openfinance Admin App',-1,0,"2d484477-0585-47e7-bf47-beb75ef95d38",UNIX_TIMESTAMP()*1000),
    -- Secret: d52d75635732b4e3ffbe6a7f5103282338234c5e4402e0c3f209726a83c3b52d
    ('37d0b7ed-eb51-4865-a7c9-4f2a9fe6ab19', '$2a$10$jHy5kSF1fh9DWyMz1S20p.dMDZVXAABIcCTOegh5osbLehmNvUQAe', 'Openfinance Exchange', -1,0, '2d484477-0585-47e7-bf47-beb75ef95d38', 1603921454758);

  INSERT INTO `client-access-restrictions` VALUES
    ('1ba18dc6-b5e7-4e6e-8da4-243f135c1709','ip','127.0.0.1','907ebd22-1ab4-4d6d-86b3-4abade4fb095',UNIX_TIMESTAMP()*1000),
    ('1ba18dc6-b5e7-4e6e-8da4-243f135c1710','ip','127.0.0.1','37d0b7ed-eb51-4865-a7c9-4f2a9fe6ab19',UNIX_TIMESTAMP()*1000),
    ('befe53db-afdf-469a-a6c2-f41876d660f6','host','https://dev.app.openfinance.io','bf0f4d4c-c6e4-41d3-a5e3-202195c9e9ec',UNIX_TIMESTAMP()*1000),
    ('f0dcc9ec-f993-4de6-809a-7cfb9508504d','host','https://dev.cfxtrading.openfinance.io','67cb7f28-9e71-45a3-874c-3f665c5eecc1',UNIX_TIMESTAMP()*1000);

  INSERT INTO `client-roles` VALUES
    ('907ebd22-1ab4-4d6d-86b3-4abade4fb095', 'system'),
    ('907ebd22-1ab4-4d6d-86b3-4abade4fb095', 'internal'),
    ('37d0b7ed-eb51-4865-a7c9-4f2a9fe6ab19', 'system'),
    ('37d0b7ed-eb51-4865-a7c9-4f2a9fe6ab19', 'internal'),
    ('37d0b7ed-eb51-4865-a7c9-4f2a9fe6ab19', 'exchange'),
    ('bf0f4d4c-c6e4-41d3-a5e3-202195c9e9ec', 'internal'),
    ('67cb7f28-9e71-45a3-874c-3f665c5eecc1', 'internal');

  INSERT INTO `users` VALUES
    -- Password: `Testing12!`
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'Test One', '$2a$10$2jhqTJXThvMxbETzO0Gq/eq7SeZIqpiY/HYWD1Qjmj/zJQohCSJJ6', 0, 'password', 0, 1602625063124),
    ('ac03fbaa-af84-4874-ae43-8092bdcf12f3', 'Test Two', '$2a$10$2jhqTJXThvMxbETzO0Gq/eq7SeZIqpiY/HYWD1Qjmj/zJQohCSJJ6', 0, 'email', 0, 1602625063124),
    ('bc86449d-f008-44ba-9d79-b1fef716cd6a', 'Test Three', '$2a$10$2jhqTJXThvMxbETzO0Gq/eq7SeZIqpiY/HYWD1Qjmj/zJQohCSJJ6', 1, 'email', 0, 1602625063124),
    ('daf03359-56aa-4352-a36e-dda064d98a2c', 'Test Four', '$2a$10$2jhqTJXThvMxbETzO0Gq/eq7SeZIqpiY/HYWD1Qjmj/zJQohCSJJ6', 1, 'email', 0, 1602625063124);

  INSERT INTO `login-emails` VALUES
    ('testing+1@openfinance.io', '594380ec-ab9b-580c-9da9-9560c8379ce9', 1602625063145, 1602625063144),
    ('testing+2@openfinance.io', 'ac03fbaa-af84-4874-ae43-8092bdcf12f3', null, 1602625063144),
    ('testing+3@openfinance.io', 'bc86449d-f008-44ba-9d79-b1fef716cd6a', 1602625063145, 1602625063144),
    ('testing+4@openfinance.io', 'daf03359-56aa-4352-a36e-dda064d98a2c', null, 1602625063144);

  INSERT INTO `user-roles` VALUES
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'investor'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'tech1'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'tech2'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'tech3'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'sysadmin'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'custserv1'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'custserv2'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'custserv3'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'custadm'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'trade1'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'trade2'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'trade3'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'tradeadm'),
    ('594380ec-ab9b-580c-9da9-9560c8379ce9', 'employee'),
    ('ac03fbaa-af84-4874-ae43-8092bdcf12f3', 'investor'),
    ('bc86449d-f008-44ba-9d79-b1fef716cd6a', 'investor'),
    ('daf03359-56aa-4352-a36e-dda064d98a2c', 'investor');

  -- Special User Jonathan Lomer
  INSERT IGNORE INTO `users` VALUES ('5451f48f-efa9-5fa7-8527-d8834ade2bac', 'Jonathan Lomer', '$2a$10$2jhqTJXThvMxbETzO0Gq/eq7SeZIqpiY/HYWD1Qjmj/zJQohCSJJ6', 0, 'password', 0, 1603679541361);
  INSERT IGNORE INTO `login-emails` VALUES ('testing+jonathan-lomer@openfinance.io', '5451f48f-efa9-5fa7-8527-d8834ade2bac', 1602625063145, 1602625063144);
  INSERT INTO `user-roles` VALUES ('5451f48f-efa9-5fa7-8527-d8834ade2bac', 'investor');

COMMIT;

-- ==== DOWN ====

BEGIN;

  DELETE FROM `clients` WHERE `id` IN ('907ebd22-1ab4-4d6d-86b3-4abade4fb095', 'bf0f4d4c-c6e4-41d3-a5e3-202195c9e9ec', '67cb7f28-9e71-45a3-874c-3f665c5eecc1');
  DELETE FROM `users` WHERE `id` IN (
    '594380ec-ab9b-580c-9da9-9560c8379ce9',
    'ac03fbaa-af84-4874-ae43-8092bdcf12f3',
    'bc86449d-f008-44ba-9d79-b1fef716cd6a',
    'daf03359-56aa-4352-a36e-dda064d98a2c',
    '5451f48f-efa9-5fa7-8527-d8834ade2bac'
  );

COMMIT;

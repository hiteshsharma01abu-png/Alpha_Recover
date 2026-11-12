-- Separate database for the automated test suite (wiped on every test run).
CREATE DATABASE IF NOT EXISTS alpharecover_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON alpharecover_test.* TO 'app'@'%';
FLUSH PRIVILEGES;

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-do-not-use";
process.env.JWT_EXPIRES_IN = "1h";
process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/test_db";
process.env.POSTGRES_SSL = "false";
process.env.MONGO_URL = "mongodb://localhost:27017/test_db";

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification20260228102000 implements MigrationInterface {
  name = 'AddEmailVerification20260228102000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP WITH TIME ZONE NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pending_email" character varying NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_pending_email"
      ON "users" ("pending_email")
      WHERE "pending_email" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "purpose" character varying NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_verification_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_email_verification_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_user_id"
      ON "email_verification_tokens" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_expires_at"
      ON "email_verification_tokens" ("expires_at")
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "email_verified_at" = COALESCE("email_verified_at", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_verification_tokens_expires_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_verification_tokens_user_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_verification_tokens"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_users_pending_email"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified_at"');
  }
}

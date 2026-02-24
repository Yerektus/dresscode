import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditsBilling20260224123000 implements MigrationInterface {
  name = 'AddCreditsBilling20260224123000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "credits_balance" integer NOT NULL DEFAULT 10
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_purchases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "external_payment_id" character varying NOT NULL,
        "package_code" character varying NOT NULL,
        "credits_amount" integer NOT NULL,
        "amount_usd_cents" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_purchases_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_credit_purchases_external_payment_id" UNIQUE ("external_payment_id"),
        CONSTRAINT "FK_credit_purchases_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "subscriptions" (
        "id",
        "user_id",
        "provider",
        "status",
        "current_period_end",
        "external_payment_id",
        "plan_code",
        "credits_balance",
        "created_at",
        "updated_at"
      )
      SELECT
        uuid_generate_v4(),
        u.id,
        'webkassa',
        'active',
        NULL,
        NULL,
        'free',
        10,
        now(),
        now()
      FROM "users" u
      LEFT JOIN "subscriptions" s ON s.user_id = u.id
      WHERE s.id IS NULL
    `);

    await queryRunner.query(`
      UPDATE "subscriptions"
      SET
        "plan_code" = 'free',
        "status" = 'active',
        "current_period_end" = NULL
      WHERE
        "plan_code" <> 'free'
        OR "status" <> 'active'
        OR "current_period_end" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "credit_purchases"');
    await queryRunner.query('ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "credits_balance"');
  }
}

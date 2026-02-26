import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFaceImageToBodyProfile20260226110000 implements MigrationInterface {
  name = 'AddFaceImageToBodyProfile20260226110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "body_profiles"
      ADD COLUMN IF NOT EXISTS "face_image" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "body_profiles"
      DROP COLUMN IF EXISTS "face_image"
    `);
  }
}

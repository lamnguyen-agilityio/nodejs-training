import { Migration } from '@mikro-orm/migrations';

export class Migration20260409025002 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "users" add "phone_number" varchar(255) null, add "mfa_verified_at" timestamptz null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "users" drop column "phone_number", drop column "mfa_verified_at";`);
  }
}

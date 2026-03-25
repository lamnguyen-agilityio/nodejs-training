import { Migration } from '@mikro-orm/migrations';

export class Migration20260325023327 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "users" alter column "id" set default uuid_generate_v7();`);
    this.addSql(`alter table "users" alter column "created_at" set default now();`);
    this.addSql(`alter table "users" alter column "updated_at" set default now();`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "users" alter column "id" drop default;`);
    this.addSql(`alter table "users" alter column "created_at" drop default;`);
    this.addSql(`alter table "users" alter column "updated_at" drop default;`);
  }
}

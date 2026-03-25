import { Migration } from '@mikro-orm/migrations';

export class Migration20260325020940 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "users" add "role" text not null default 'user';`);
    this.addSql(`alter table "users" alter column "id" set default uuid_generate_v7();`);
    this.addSql(
      `alter table "users" add constraint "users_role_check" check ("role" in ('admin', 'user'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "users" drop constraint "users_role_check";`);
    this.addSql(`alter table "users" drop column "role";`);
    this.addSql(`alter table "users" alter column "id" set default gen_random_uuid();`);
  }
}

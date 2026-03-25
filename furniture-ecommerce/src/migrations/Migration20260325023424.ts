import { Migration } from '@mikro-orm/migrations';

export class Migration20260325023424 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "users" add "role" text not null default 'user';`);
    this.addSql(
      `alter table "users" add constraint "users_role_check" check ("role" in ('admin', 'user'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "users" drop constraint "users_role_check";`);
    this.addSql(`alter table "users" drop column "role";`);
  }
}

import { Migration } from '@mikro-orm/migrations';

export class Migration20260325023327 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "users" ("id" uuid not null default uuid_generate_v7(), "email" varchar(255) not null, "name" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, primary key ("id"));`,
    );
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

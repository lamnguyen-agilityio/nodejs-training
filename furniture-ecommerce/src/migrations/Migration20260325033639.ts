import { Migration } from '@mikro-orm/migrations';

export class Migration20260325033639 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "categories" ("id" uuid not null default uuid_generate_v7(), "name" varchar(255) not null, "slug" varchar(255) not null, "description" varchar(255) null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "categories" add constraint "categories_slug_unique" unique ("slug");`,
    );
  }
}

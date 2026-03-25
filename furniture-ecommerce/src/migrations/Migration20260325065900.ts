import { Migration } from '@mikro-orm/migrations';

export class Migration20260325065900 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "products" ("id" uuid not null default uuid_generate_v7(), "name" varchar(255) not null, "slug" varchar(255) not null, "description" varchar(255) null, "price" numeric(10,2) not null, "image" varchar(255) null, "quantity_in_stock" int not null default 0, "category_id" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`alter table "products" add constraint "products_slug_unique" unique ("slug");`);
    this.addSql(
      `alter table "products" add constraint "products_quantity_in_stock_check" check ("quantity_in_stock" >= 0);`,
    );
    this.addSql(
      `alter table "products" add constraint "products_category_id_foreign" foreign key ("category_id") references "categories" ("id");`,
    );
  }
}

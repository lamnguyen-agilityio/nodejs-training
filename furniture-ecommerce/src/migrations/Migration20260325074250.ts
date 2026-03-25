import { Migration } from '@mikro-orm/migrations';

export class Migration20260325074250 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "cart_items" ("id" uuid not null default uuid_generate_v7(), "quantity" int not null, "user_id" uuid not null, "product_id" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, primary key ("id"));`,
    );

    this.addSql(
      `alter table "cart_items" add constraint "cart_items_user_id_foreign" foreign key ("user_id") references "users" ("id");`,
    );
    this.addSql(
      `alter table "cart_items" add constraint "cart_items_product_id_foreign" foreign key ("product_id") references "products" ("id");`,
    );
  }
}

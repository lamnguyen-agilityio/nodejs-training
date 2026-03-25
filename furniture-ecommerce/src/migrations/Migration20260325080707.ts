import { Migration } from '@mikro-orm/migrations';

export class Migration20260325080707 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "order_items" ("id" uuid not null default uuid_generate_v7(), "order_id" uuid not null, "product_id" uuid not null, "quantity" int not null, "price_at_purchase" numeric(10,2) not null, "created_at" timestamptz not null default now(), primary key ("id"));`,
    );

    this.addSql(
      `alter table "order_items" add constraint "order_items_order_id_foreign" foreign key ("order_id") references "orders" ("id");`,
    );
    this.addSql(
      `alter table "order_items" add constraint "order_items_product_id_foreign" foreign key ("product_id") references "products" ("id");`,
    );
  }
}

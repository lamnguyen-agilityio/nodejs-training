import { Migration } from '@mikro-orm/migrations';

export class Migration20260325075713 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "orders" ("id" uuid not null default uuid_generate_v7(), "user_id" uuid not null, "status" text not null default 'pending', "total_amount" numeric(10,2) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );

    this.addSql(
      `alter table "orders" add constraint "orders_user_id_foreign" foreign key ("user_id") references "users" ("id");`,
    );
    this.addSql(
      `alter table "orders" add constraint "orders_status_check" check ("status" in ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'failed'));`,
    );
  }
}

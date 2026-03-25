import { Migration } from '@mikro-orm/migrations';

export class Migration20260325083753 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "payments" ("id" uuid not null default uuid_generate_v7(), "order_id" uuid not null, "provider" varchar(255) not null, "intent_id" varchar(255) not null, "checkout_session_id" varchar(255) not null, "status" text not null default 'pending', "amount" numeric(10,2) not null, "currency" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );

    this.addSql(
      `alter table "payments" add constraint "payments_order_id_foreign" foreign key ("order_id") references "orders" ("id");`,
    );
    this.addSql(
      `alter table "payments" add constraint "payments_status_check" check ("status" in ('pending', 'succeeded', 'failed', 'cancelled', 'refunded'));`,
    );
  }
}

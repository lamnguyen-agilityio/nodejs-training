import { Migration } from '@mikro-orm/migrations';

export class Migration20260329083936 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "user_identities" drop constraint "user_identities_user_id_foreign";`);

    this.addSql(`alter table "products" drop constraint "products_quantity_in_stock_check";`);

    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(
      `alter table "user_identities" add constraint "user_identities_user_id_foreign" foreign key ("user_id") references "users" ("id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "user_identities" drop constraint "user_identities_user_id_foreign";`);

    this.addSql(
      `alter table "products" add constraint "products_quantity_in_stock_check" check (quantity_in_stock >= 0);`,
    );

    this.addSql(
      `alter table "user_identities" add constraint "user_identities_user_id_foreign" foreign key ("user_id") references "users" ("id") on update no action on delete cascade;`,
    );

    this.addSql(`alter table "users" drop constraint "users_email_unique";`);
  }
}

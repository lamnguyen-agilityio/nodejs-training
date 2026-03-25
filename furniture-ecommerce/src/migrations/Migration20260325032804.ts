import { Migration } from '@mikro-orm/migrations';

export class Migration20260325032804 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "user_identities" ("id" uuid not null default uuid_generate_v7(), "user_id" uuid not null, "provider" text not null, "provider_id" varchar(255) not null, "social_provider" text not null, "social_provider_sub" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "user_identities" add constraint "user_identities_provider_id_unique" unique ("provider_id");`,
    );
    this.addSql(
      `alter table "user_identities" add constraint "user_identities_social_provider_sub_unique" unique ("social_provider_sub");`,
    );

    this.addSql(
      `alter table "user_identities" add constraint "user_identities_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "user_identities" add constraint "user_identities_provider_check" check ("provider" in ('clerk', 'auth0'));`,
    );
    this.addSql(
      `alter table "user_identities" add constraint "user_identities_social_provider_check" check ("social_provider" in ('google', 'github'));`,
    );
  }
}

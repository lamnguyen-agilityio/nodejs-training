import { Migration } from '@mikro-orm/migrations';

export class Migration20260409033903 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "mfa_otps" ("id" uuid not null default uuid_generate_v7(), "user_id" uuid not null, "code_hash" varchar(255) not null, "method" text not null default 'sms', "attempts" int not null default 0, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), primary key ("id"));`,
    );

    this.addSql(
      `alter table "mfa_otps" add constraint "mfa_otps_user_id_foreign" foreign key ("user_id") references "users" ("id");`,
    );
    this.addSql(
      `alter table "mfa_otps" add constraint "mfa_otps_method_check" check ("method" in ('sms', 'email'));`,
    );
  }
}

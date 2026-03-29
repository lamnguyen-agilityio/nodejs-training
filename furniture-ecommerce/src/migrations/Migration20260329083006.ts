import { Migration } from '@mikro-orm/migrations';

export class Migration20260329083006 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "user_identities" drop constraint "user_identities_social_provider_sub_unique";`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "user_identities" add constraint "user_identities_social_provider_sub_unique" unique ("social_provider_sub");`,
    );
  }
}

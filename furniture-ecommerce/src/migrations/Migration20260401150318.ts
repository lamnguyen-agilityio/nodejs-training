import { Migration } from '@mikro-orm/migrations';

export class Migration20260401150318 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "payments" alter column "intent_id" drop not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "payments" alter column "intent_id" set not null;`);
  }
}

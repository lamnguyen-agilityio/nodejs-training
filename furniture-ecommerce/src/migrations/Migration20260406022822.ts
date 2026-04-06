import { Migration } from '@mikro-orm/migrations';

export class Migration20260406022822 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "categories" add "image" varchar(255) not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "categories" drop column "image";`);
  }
}

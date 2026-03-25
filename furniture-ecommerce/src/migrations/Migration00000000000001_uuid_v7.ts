import { Migration } from '@mikro-orm/migrations';

export class CreateUuidV7Function extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE OR REPLACE FUNCTION uuid_generate_v7()
      RETURNS uuid
      AS $$
      DECLARE
        unix_ts_ms bytea;
        uuid_bytes bytea;
      BEGIN
        unix_ts_ms = substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
        uuid_bytes = uuid_send(gen_random_uuid());
        uuid_bytes = overlay(uuid_bytes placing unix_ts_ms FROM 1 FOR 6);
        uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
        RETURN encode(uuid_bytes, 'hex')::uuid;
      END
      $$
      LANGUAGE plpgsql
      VOLATILE;
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP FUNCTION IF EXISTS uuid_generate_v7();');
  }
}

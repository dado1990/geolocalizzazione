import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const { Client } = pg;

async function seed() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'bustracker',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Hash password per admin user
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const operatorPassword = await bcrypt.hash('Operator123!', 10);

    console.log('\n🌱 Seeding database...\n');

    // Insert users
    console.log('👤 Creating users...');
    await client.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
      ('admin@bustracker.local', $1, 'Admin Principale', 'admin'),
      ('operator@bustracker.local', $2, 'Operatore Test', 'operator')
      ON CONFLICT (email) DO NOTHING
    `, [adminPassword, operatorPassword]);

    // Insert lines
    console.log('🚌 Creating lines...');
    const linesResult = await client.query(`
      INSERT INTO lines (name, code, color, active) VALUES
      ('Linea Centro-Stazione', 'L01', '#3b82f6', true),
      ('Linea Circolare Nord', 'L02', '#22c55e', true),
      ('Linea Mare', 'L03', '#f59e0b', true)
      ON CONFLICT (code) DO NOTHING
      RETURNING id, code
    `);

    const lineIds = linesResult.rows.reduce((acc, row) => {
      acc[row.code] = row.id;
      return acc;
    }, {} as Record<string, number>);

    // Insert stops
    console.log('🚏 Creating stops...');
    await client.query(`
      INSERT INTO stops (name, code, latitude, longitude) VALUES
      ('Piazza Duomo', 'S01', 45.4642, 9.1900),
      ('Stazione Centrale', 'S02', 45.4869, 9.2049),
      ('Porta Garibaldi', 'S03', 45.4844, 9.1882),
      ('Navigli', 'S04', 45.4524, 9.1776),
      ('Parco Sempione', 'S05', 45.4748, 9.1751)
      ON CONFLICT (code) DO NOTHING
    `);

    // Insert devices
    console.log('📱 Creating devices...');
    const devicesResult = await client.query(`
      INSERT INTO devices (uuid, token_hash, platform, app_version, status) VALUES
      ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'token_hash_1', 'android', '1.0.0', 'active'),
      ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'token_hash_2', 'android', '1.0.0', 'active'),
      ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'token_hash_3', 'android', '1.0.0', 'active')
      ON CONFLICT (uuid) DO NOTHING
      RETURNING id
    `);

    const deviceIds = devicesResult.rows.map(r => r.id);

    // Insert buses
    console.log('🚍 Creating buses...');
    await client.query(`
      INSERT INTO buses (label, plate, device_id, line_id, status) VALUES
      ('Bus 1', 'AB123CD', $1, $2, 'active'),
      ('Bus 2', 'EF456GH', $3, $2, 'active'),
      ('Bus 3', 'IJ789KL', $4, $5, 'active')
      ON CONFLICT DO NOTHING
    `, [deviceIds[0], lineIds['L01'], deviceIds[1], deviceIds[2], lineIds['L02']]);

    // Insert sample last_positions
    console.log('📍 Creating sample positions...');
    await client.query(`
      INSERT INTO last_positions (device_id, latitude, longitude, speed, heading, timestamp) VALUES
      ($1, 45.4642, 9.1900, 15.5, 180, NOW() - INTERVAL '30 seconds'),
      ($2, 45.4869, 9.2049, 0, 90, NOW() - INTERVAL '1 minute'),
      ($3, 45.4844, 9.1882, 20.0, 270, NOW() - INTERVAL '45 seconds')
      ON CONFLICT (device_id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        speed = EXCLUDED.speed,
        heading = EXCLUDED.heading,
        timestamp = EXCLUDED.timestamp,
        updated_at = NOW()
    `, deviceIds);

    console.log('\n✅ Seed data inserted successfully!\n');
    console.log('📊 Summary:');
    console.log('   • 2 users (admin, operator)');
    console.log('   • 3 lines');
    console.log('   • 5 stops');
    console.log('   • 3 devices');
    console.log('   • 3 buses');
    console.log('   • 3 current positions');
    console.log('\n🔐 Login credentials:');
    console.log('   Admin:    admin@bustracker.local / Admin123!');
    console.log('   Operator: operator@bustracker.local / Operator123!');

  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();

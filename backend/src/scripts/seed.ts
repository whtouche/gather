/**
 * Database seeding script
 * Creates test users and events for manual testing
 */

// Load .env BEFORE importing anything that uses DATABASE_URL
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../.env") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import crypto from "crypto";

// Create a fresh Prisma client for seeding
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seed...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  // Clean up existing test data
  console.log("Cleaning up existing test data...");
  await prisma.rSVP.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: "test@test.com" },
        { email: { startsWith: "user" } },
      ],
    },
  });

  // Create test user
  console.log("Creating test user...");
  const testUser = await prisma.user.create({
    data: {
      email: "test@test.com",
      displayName: "Test",
      phone: "+15555555555",
    },
  });

  // Create session for test user
  const testSession = await prisma.session.create({
    data: {
      userId: testUser.id,
      token: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  console.log(`Test user created: ${testUser.email}`);
  console.log(`Session token: ${testSession.token}`);

  // Create 5 other users
  console.log("Creating other users...");
  const userNames = [
    "Alice Johnson",
    "Bob Smith",
    "Charlie Davis",
    "Diana Martinez",
    "Ethan Brown",
  ];

  const otherUsers = await Promise.all(
    userNames.map((name, index) =>
      prisma.user.create({
        data: {
          email: `user${index + 1}@example.com`,
          displayName: name,
          phone: null,
        },
      })
    )
  );

  console.log(`Created ${otherUsers.length} other users`);

  // Helper to create a past date
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  };

  // Create 3 events organized by Test user (all in the past)
  console.log("Creating events organized by Test user...");

  const testEvent1 = await prisma.event.create({
    data: {
      title: "Summer BBQ Party",
      description: "A fun backyard BBQ with friends and family",
      dateTime: daysAgo(30),
      endDateTime: new Date(daysAgo(30).getTime() + 4 * 60 * 60 * 1000), // 4 hours later
      timezone: "America/New_York",
      location: "123 Main Street, Brooklyn, NY",
      state: "COMPLETED",
      creatorId: testUser.id,
      capacity: 30,
      waitlistEnabled: false,
    },
  });

  // Create organizer role for Test user
  await prisma.eventRole.create({
    data: {
      eventId: testEvent1.id,
      userId: testUser.id,
      role: "ORGANIZER",
    },
  });

  // Add some attendees to test event 1
  await prisma.rSVP.createMany({
    data: [
      { eventId: testEvent1.id, userId: testUser.id, response: "YES" },
      { eventId: testEvent1.id, userId: otherUsers[0].id, response: "YES" },
      { eventId: testEvent1.id, userId: otherUsers[1].id, response: "YES" },
      { eventId: testEvent1.id, userId: otherUsers[2].id, response: "NO" },
    ],
  });

  const testEvent2 = await prisma.event.create({
    data: {
      title: "Birthday Celebration",
      description: "Celebrating my 30th birthday!",
      dateTime: daysAgo(60),
      endDateTime: new Date(daysAgo(60).getTime() + 5 * 60 * 60 * 1000),
      timezone: "America/New_York",
      location: "456 Park Avenue, Manhattan, NY",
      state: "COMPLETED",
      creatorId: testUser.id,
      capacity: 50,
      waitlistEnabled: true,
    },
  });

  await prisma.eventRole.create({
    data: {
      eventId: testEvent2.id,
      userId: testUser.id,
      role: "ORGANIZER",
    },
  });

  await prisma.rSVP.createMany({
    data: [
      { eventId: testEvent2.id, userId: testUser.id, response: "YES" },
      { eventId: testEvent2.id, userId: otherUsers[0].id, response: "YES" },
      { eventId: testEvent2.id, userId: otherUsers[1].id, response: "YES" },
      { eventId: testEvent2.id, userId: otherUsers[2].id, response: "YES" },
      { eventId: testEvent2.id, userId: otherUsers[3].id, response: "MAYBE" },
    ],
  });

  const testEvent3 = await prisma.event.create({
    data: {
      title: "Game Night",
      description: "Board games and pizza at my place",
      dateTime: daysAgo(15),
      endDateTime: new Date(daysAgo(15).getTime() + 4 * 60 * 60 * 1000),
      timezone: "America/New_York",
      location: "789 Broadway, Queens, NY",
      state: "COMPLETED",
      creatorId: testUser.id,
      capacity: 15,
      waitlistEnabled: false,
    },
  });

  await prisma.eventRole.create({
    data: {
      eventId: testEvent3.id,
      userId: testUser.id,
      role: "ORGANIZER",
    },
  });

  await prisma.rSVP.createMany({
    data: [
      { eventId: testEvent3.id, userId: testUser.id, response: "YES" },
      { eventId: testEvent3.id, userId: otherUsers[3].id, response: "YES" },
      { eventId: testEvent3.id, userId: otherUsers[4].id, response: "YES" },
    ],
  });

  // Create 2 events organized by other users
  console.log("Creating events organized by other users...");

  const otherEvent1 = await prisma.event.create({
    data: {
      title: "Weekend Hiking Trip",
      description: "Let's explore the beautiful trails upstate!",
      dateTime: daysAgo(45),
      endDateTime: new Date(daysAgo(45).getTime() + 8 * 60 * 60 * 1000),
      timezone: "America/New_York",
      location: "Bear Mountain State Park, NY",
      state: "COMPLETED",
      creatorId: otherUsers[0].id, // Alice Johnson
      capacity: 20,
      waitlistEnabled: false,
    },
  });

  await prisma.eventRole.create({
    data: {
      eventId: otherEvent1.id,
      userId: otherUsers[0].id,
      role: "ORGANIZER",
    },
  });

  // Test user attended this event
  await prisma.rSVP.createMany({
    data: [
      { eventId: otherEvent1.id, userId: otherUsers[0].id, response: "YES" },
      { eventId: otherEvent1.id, userId: testUser.id, response: "YES" },
      { eventId: otherEvent1.id, userId: otherUsers[1].id, response: "YES" },
      { eventId: otherEvent1.id, userId: otherUsers[2].id, response: "YES" },
    ],
  });

  const otherEvent2 = await prisma.event.create({
    data: {
      title: "Movie Night: Classic Films",
      description: "Watching some all-time favorite movies with popcorn",
      dateTime: daysAgo(20),
      endDateTime: new Date(daysAgo(20).getTime() + 6 * 60 * 60 * 1000),
      timezone: "America/New_York",
      location: "321 Cinema Street, Brooklyn, NY",
      state: "COMPLETED",
      creatorId: otherUsers[1].id, // Bob Smith
      capacity: 25,
      waitlistEnabled: true,
    },
  });

  await prisma.eventRole.create({
    data: {
      eventId: otherEvent2.id,
      userId: otherUsers[1].id,
      role: "ORGANIZER",
    },
  });

  // Test user attended this event too
  await prisma.rSVP.createMany({
    data: [
      { eventId: otherEvent2.id, userId: otherUsers[1].id, response: "YES" },
      { eventId: otherEvent2.id, userId: testUser.id, response: "YES" },
      { eventId: otherEvent2.id, userId: otherUsers[3].id, response: "YES" },
      { eventId: otherEvent2.id, userId: otherUsers[4].id, response: "NO" },
    ],
  });

  console.log("\n✅ Database seeded successfully!");
  console.log("\nTest Account Credentials:");
  console.log("  Email: test@test.com");
  console.log("  Name: Test");
  console.log(`  Session Token: ${testSession.token}`);
  console.log("\nEvents Created:");
  console.log(`  - ${testEvent1.title} (organized by Test)`);
  console.log(`  - ${testEvent2.title} (organized by Test)`);
  console.log(`  - ${testEvent3.title} (organized by Test)`);
  console.log(`  - ${otherEvent1.title} (organized by Alice, Test attended)`);
  console.log(`  - ${otherEvent2.title} (organized by Bob, Test attended)`);
  console.log("\nOther Users:");
  otherUsers.forEach((user) => console.log(`  - ${user.displayName} (${user.email})`));
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

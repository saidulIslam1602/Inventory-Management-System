/**
 * Aqila IMS — Database Seed
 *
 * Populates the database with realistic demo data for Aqila AS:
 * - 4 branch locations (Svolvær, Gravdal, Røst, Ramberg) + 2 service vans
 * - Product categories relevant to an electrical installation company
 * - Units of measure
 * - Sample suppliers
 * - Sample products with initial stock
 * - 1 Admin user + sample employees
 *
 * Run: npm run db:seed
 */

import { PrismaClient, UserRole, LocationType, MovementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Aqila IMS database...\n");

  // ── Locations ──────────────────────────────────────────────────────────────
  console.log("📍 Creating locations...");
  const locations = await Promise.all([
    prisma.location.upsert({
      where: { name: "Svolvær" },
      update: {},
      create: {
        name: "Svolvær",
        type: LocationType.BRANCH,
        address: "Sjøgata 1, 8300 Svolvær",
        phone: "76 06 09 99",
      },
    }),
    prisma.location.upsert({
      where: { name: "Gravdal" },
      update: {},
      create: {
        name: "Gravdal",
        type: LocationType.BRANCH,
        address: "Storgata 14, 8370 Leknes",
        phone: "76 06 09 90",
      },
    }),
    prisma.location.upsert({
      where: { name: "Røst" },
      update: {},
      create: {
        name: "Røst",
        type: LocationType.BRANCH,
        address: "Røstlandet, 8064 Røst",
        phone: "76 09 61 00",
      },
    }),
    prisma.location.upsert({
      where: { name: "Ramberg" },
      update: {},
      create: {
        name: "Ramberg",
        type: LocationType.BRANCH,
        address: "Ramberg, 8382 Ramberg",
        phone: "76 09 32 00",
      },
    }),
    prisma.location.upsert({
      where: { name: "Servicevan SV-01" },
      update: {},
      create: { name: "Servicevan SV-01", type: LocationType.VAN },
    }),
    prisma.location.upsert({
      where: { name: "Servicevan SV-02" },
      update: {},
      create: { name: "Servicevan SV-02", type: LocationType.VAN },
    }),
  ]);
  const [svolvær, gravdal] = locations;
  console.log(`   ✓ ${locations.length} locations created`);

  // ── Departments ────────────────────────────────────────────────────────────
  console.log("🏢 Creating departments...");
  const departments = await Promise.all([
    prisma.department.upsert({ where: { name: "Elektro" }, update: {}, create: { name: "Elektro" } }),
    prisma.department.upsert({ where: { name: "Automasjon" }, update: {}, create: { name: "Automasjon" } }),
    prisma.department.upsert({ where: { name: "Alarm & Sikkerhet" }, update: {}, create: { name: "Alarm & Sikkerhet" } }),
    prisma.department.upsert({ where: { name: "Svakstrøm" }, update: {}, create: { name: "Svakstrøm" } }),
    prisma.department.upsert({ where: { name: "Varmepumpe & Solceller" }, update: {}, create: { name: "Varmepumpe & Solceller" } }),
    prisma.department.upsert({ where: { name: "Administrasjon" }, update: {}, create: { name: "Administrasjon" } }),
  ]);
  console.log(`   ✓ ${departments.length} departments created`);

  // ── Units ──────────────────────────────────────────────────────────────────
  console.log("📏 Creating units of measure...");
  const units = await Promise.all([
    prisma.unit.upsert({ where: { name: "Piece" }, update: {}, create: { name: "Piece", symbol: "stk" } }),
    prisma.unit.upsert({ where: { name: "Metre" }, update: {}, create: { name: "Metre", symbol: "m" } }),
    prisma.unit.upsert({ where: { name: "Kilogram" }, update: {}, create: { name: "Kilogram", symbol: "kg" } }),
    prisma.unit.upsert({ where: { name: "Box" }, update: {}, create: { name: "Box", symbol: "boks" } }),
    prisma.unit.upsert({ where: { name: "Roll" }, update: {}, create: { name: "Roll", symbol: "rull" } }),
    prisma.unit.upsert({ where: { name: "Set" }, update: {}, create: { name: "Set", symbol: "sett" } }),
  ]);
  const [pcs, metre, , box, roll] = units;
  console.log(`   ✓ ${units.length} units created`);

  // ── Categories ────────────────────────────────────────────────────────────
  console.log("🏷️  Creating categories...");
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: "Cables & Wiring" }, update: {}, create: { name: "Cables & Wiring", description: "Power cables, data cables, coaxial, fibre" } }),
    prisma.category.upsert({ where: { name: "Switchgear & Breakers" }, update: {}, create: { name: "Switchgear & Breakers", description: "Circuit breakers, fuses, MCBs, RCDs" } }),
    prisma.category.upsert({ where: { name: "Conduits & Trunking" }, update: {}, create: { name: "Conduits & Trunking", description: "PVC conduit, steel conduit, cable trunking" } }),
    prisma.category.upsert({ where: { name: "EV Chargers" }, update: {}, create: { name: "EV Chargers", description: "Electric vehicle charging units and accessories" } }),
    prisma.category.upsert({ where: { name: "Heat Pumps" }, update: {}, create: { name: "Heat Pumps", description: "Panasonic, Toshiba units and installation kits" } }),
    prisma.category.upsert({ where: { name: "Solar Panels" }, update: {}, create: { name: "Solar Panels", description: "PV panels, inverters, mounting systems" } }),
    prisma.category.upsert({ where: { name: "Alarm & Security" }, update: {}, create: { name: "Alarm & Security", description: "Fire alarms, sensors, control panels, cameras" } }),
    prisma.category.upsert({ where: { name: "Lighting" }, update: {}, create: { name: "Lighting", description: "LED fixtures, emergency lighting, dimmers" } }),
    prisma.category.upsert({ where: { name: "Tools & Equipment" }, update: {}, create: { name: "Tools & Equipment", description: "Hand tools, power tools, testing equipment" } }),
    prisma.category.upsert({ where: { name: "Consumables" }, update: {}, create: { name: "Consumables", description: "Tape, ties, connectors, fixings" } }),
  ]);
  const [cables, switchgear, , evChargers, heatPumps] = categories;
  console.log(`   ✓ ${categories.length} categories created`);

  // ── Suppliers ─────────────────────────────────────────────────────────────
  console.log("🏭 Creating suppliers...");
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { name: "Elektroskandia Norge AS" },
      update: {},
      create: {
        name: "Elektroskandia Norge AS",
        contactName: "Knut Hansen",
        email: "ordre@elektroskandia.no",
        phone: "22 00 11 00",
      },
    }),
    prisma.supplier.upsert({
      where: { name: "Ahlsell Norge AS" },
      update: {},
      create: {
        name: "Ahlsell Norge AS",
        contactName: "Silje Berg",
        email: "nord@ahlsell.no",
        phone: "77 65 43 21",
      },
    }),
    prisma.supplier.upsert({
      where: { name: "Panasonic Norge" },
      update: {},
      create: {
        name: "Panasonic Norge",
        contactName: "Mats Olsen",
        email: "hvac@panasonic.no",
        phone: "23 12 34 56",
      },
    }),
  ]);
  const [elektroskandia, , panasonic] = suppliers;
  console.log(`   ✓ ${suppliers.length} suppliers created`);

  // ── Products ──────────────────────────────────────────────────────────────
  console.log("📦 Creating products...");
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: "CAB-NYM-2X1.5" },
      update: {},
      create: {
        sku: "CAB-NYM-2X1.5",
        name: "NYM-J 2x1.5mm² Flat cable",
        description: "PVC insulated flat cable for fixed wiring",
        unitPrice: 8.5,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAB-NYM-3X2.5" },
      update: {},
      create: {
        sku: "CAB-NYM-3X2.5",
        name: "NYM-J 3x2.5mm² Round cable",
        description: "Round PVC cable for sockets and appliances",
        unitPrice: 14.2,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "BRK-MCB-16A" },
      update: {},
      create: {
        sku: "BRK-MCB-16A",
        name: "MCB Circuit Breaker 16A B-curve",
        description: "Single-pole miniature circuit breaker",
        unitPrice: 45.0,
        categoryId: switchgear.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "BRK-MCB-32A" },
      update: {},
      create: {
        sku: "BRK-MCB-32A",
        name: "MCB Circuit Breaker 32A C-curve",
        description: "Single-pole miniature circuit breaker",
        unitPrice: 55.0,
        categoryId: switchgear.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "EV-ZAPTEC-GO" },
      update: {},
      create: {
        sku: "EV-ZAPTEC-GO",
        name: "Zaptec Go EV Charger 22kW",
        description: "Smart home EV charger with app control",
        unitPrice: 6990.0,
        categoryId: evChargers.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HP-PAN-CZ35" },
      update: {},
      create: {
        sku: "HP-PAN-CZ35",
        name: "Panasonic Etherea CZ35 Heat Pump",
        description: "3.5kW inverter heat pump with Wi-Fi",
        unitPrice: 18990.0,
        categoryId: heatPumps.id,
        unitId: pcs.id,
        supplierId: panasonic.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CON-WAGO-221-412" },
      update: {},
      create: {
        sku: "CON-WAGO-221-412",
        name: "WAGO 221-412 Lever Connector 2-pole",
        description: "Push-in wire connector for solid and stranded wire",
        unitPrice: 2.8,
        categoryId: categories[9].id, // Consumables
        unitId: box.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAB-CAT6-U" },
      update: {},
      create: {
        sku: "CAB-CAT6-U",
        name: "Cat6 UTP Network Cable",
        description: "Unshielded twisted pair cable for structured networking",
        unitPrice: 3.5,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
  ]);
  console.log(`   ✓ ${products.length} products created`);

  // ── Stock (initial quantities at Svolvær and Gravdal) ─────────────────────
  console.log("📊 Seeding initial stock levels...");
  const stockEntries = [
    { productId: products[0].id, locationId: svolvær.id, quantity: 500, reorderPoint: 100 },
    { productId: products[1].id, locationId: svolvær.id, quantity: 350, reorderPoint: 80 },
    { productId: products[2].id, locationId: svolvær.id, quantity: 60, reorderPoint: 20 },
    { productId: products[3].id, locationId: svolvær.id, quantity: 40, reorderPoint: 15 },
    { productId: products[4].id, locationId: svolvær.id, quantity: 8, reorderPoint: 3 },
    { productId: products[5].id, locationId: svolvær.id, quantity: 5, reorderPoint: 2 },
    { productId: products[6].id, locationId: svolvær.id, quantity: 200, reorderPoint: 50 },
    { productId: products[7].id, locationId: svolvær.id, quantity: 800, reorderPoint: 200 },
    { productId: products[0].id, locationId: gravdal.id, quantity: 400, reorderPoint: 100 },
    { productId: products[2].id, locationId: gravdal.id, quantity: 45, reorderPoint: 20 },
    { productId: products[4].id, locationId: gravdal.id, quantity: 3, reorderPoint: 3 },  // at reorder point
    { productId: products[5].id, locationId: gravdal.id, quantity: 1, reorderPoint: 2 },  // below reorder
  ];

  for (const entry of stockEntries) {
    const stock = await prisma.stock.upsert({
      where: { productId_locationId: { productId: entry.productId, locationId: entry.locationId } },
      update: {},
      create: {
        productId: entry.productId,
        locationId: entry.locationId,
        quantity: entry.quantity,
        reorderPoint: entry.reorderPoint,
      },
    });

    // Create an opening stock movement record
    await prisma.stockMovement.create({
      data: {
        type: MovementType.IN,
        quantity: entry.quantity,
        note: "Opening stock — database seed",
        stockId: stock.id,
        toLocationId: entry.locationId,
      },
    });
  }
  console.log(`   ✓ ${stockEntries.length} stock entries created`);

  // ── Users & Employees ─────────────────────────────────────────────────────
  console.log("👤 Creating users and employees...");
  const passwordHash = await bcrypt.hash("Aqila2026!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@aqila.no" },
    update: {},
    create: {
      name: "Lars Erik Flygel",
      email: "admin@aqila.no",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@aqila.no" },
    update: {},
    create: {
      name: "Silje Nordvik",
      email: "manager@aqila.no",
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@aqila.no" },
    update: {},
    create: {
      name: "Ole Petter Amundsen",
      email: "staff@aqila.no",
      passwordHash,
      role: UserRole.STAFF,
    },
  });

  // Admin employee profile
  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      employeeCode: "AQ-0001",
      firstName: "Lars Erik",
      lastName: "Flygel",
      hireDate: new Date("2019-11-01"),
      userId: adminUser.id,
      locationId: svolvær.id,
      departmentId: departments[5].id, // Administrasjon
    },
  });

  await prisma.employee.upsert({
    where: { userId: managerUser.id },
    update: {},
    create: {
      employeeCode: "AQ-0002",
      firstName: "Silje",
      lastName: "Nordvik",
      hireDate: new Date("2020-03-15"),
      userId: managerUser.id,
      locationId: gravdal.id,
      departmentId: departments[0].id, // Elektro
    },
  });

  await prisma.employee.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      employeeCode: "AQ-0003",
      firstName: "Ole Petter",
      lastName: "Amundsen",
      hireDate: new Date("2021-06-01"),
      userId: staffUser.id,
      locationId: svolvær.id,
      departmentId: departments[0].id, // Elektro
    },
  });

  console.log("   ✓ 3 users and employee profiles created");
  console.log("\n   Demo credentials:");
  console.log("   Admin:   admin@aqila.no   / Aqila2026!");
  console.log("   Manager: manager@aqila.no / Aqila2026!");
  console.log("   Staff:   staff@aqila.no   / Aqila2026!\n");

  console.log("✅ Seed complete!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

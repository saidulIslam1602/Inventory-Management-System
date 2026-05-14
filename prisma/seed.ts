/**
 * Aqila IMS — Database Seed
 *
 * Populates the database with realistic demo data for Aqila AS, including
 * approximately 12 months of movements, POs, projects, and attendance for
 * dashboard charts and presentations.
 *
 * Norwegian conventions (demo):
 *   • SI-enheter (m, kg) — offisiell metrologi (Justervesenet).
 *   • Handelsenheter: stk, eske, rull, sett — i tråd med typiske
 *     prisenheter/forpakninger i norsk bygg/e-handel (f.eks. NOBBS-listen).
 *   • Beløp i NOK eks. mva (B2B/innkjøp), typiske elektro-grosnivåer.
 *
 * Clears prior demo transactions (movements, POs, projects, etc.) each run so
 * `npm run db:seed` stays repeatable. Master data is upserted.
 *
 * Run: npm run db:seed
 */

import "dotenv/config";
import {
  UserRole,
  LocationType,
  MovementType,
  POStatus,
  ProjectStatus,
  AttendanceStatus,
  NotificationType,
  POAuditEventKind,
  AuditEventCategory,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, addMinutes, eachDayOfInterval, isWeekend, subDays } from "date-fns";
import { prisma } from "../src/lib/db";

/** Deterministic PRNG for repeatable demo timelines */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Idempotent unit row: DB may already use NO names (seed re-run) or legacy EN `where` keys */
async function ensureUnit(aliases: string[], canonical: { name: string; symbol: string }) {
  const existing = await prisma.unit.findFirst({
    where: {
      OR: [
        ...aliases.map((name) => ({ name })),
        { name: canonical.name },
        { symbol: canonical.symbol },
      ],
    },
  });
  if (existing) {
    return prisma.unit.update({
      where: { id: existing.id },
      data: { name: canonical.name, symbol: canonical.symbol },
    });
  }
  return prisma.unit.create({
    data: { name: canonical.name, symbol: canonical.symbol },
  });
}

async function ensureCategory(aliases: string[], canonical: { name: string; description: string }) {
  const existing = await prisma.category.findFirst({
    where: {
      OR: [...aliases.map((name) => ({ name })), { name: canonical.name }],
    },
  });
  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: { name: canonical.name, description: canonical.description },
    });
  }
  return prisma.category.create({
    data: { name: canonical.name, description: canonical.description },
  });
}

async function main() {
  console.log("🌱 Seeding Aqila IMS database...\n");

  console.log("🗑️  Clearing prior demo transactions (movements, orders, projects, …)…");
  await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.projectMaterial.deleteMany(),
    prisma.projectEmployee.deleteMany(),
    prisma.project.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditEvent.deleteMany({
      where: { summary: { contains: "[demo seed]" } },
    }),
  ]);

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      exceptionStaleSubmitDays: 2,
      exceptionOverdueReceiveDays: 7,
      exceptionMinLowStockBranches: 2,
    },
    update: {},
  });

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
  const [svolvær, gravdal, røst, ramberg] = locations;
  console.log(`   ✓ ${locations.length} locations created`);

  // ── Departments ────────────────────────────────────────────────────────────
  console.log("🏢 Creating departments...");
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: "Elektro" },
      update: {},
      create: { name: "Elektro" },
    }),
    prisma.department.upsert({
      where: { name: "Automasjon" },
      update: {},
      create: { name: "Automasjon" },
    }),
    prisma.department.upsert({
      where: { name: "Alarm & Sikkerhet" },
      update: {},
      create: { name: "Alarm & Sikkerhet" },
    }),
    prisma.department.upsert({
      where: { name: "Svakstrøm" },
      update: {},
      create: { name: "Svakstrøm" },
    }),
    prisma.department.upsert({
      where: { name: "Varmepumpe & Solceller" },
      update: {},
      create: { name: "Varmepumpe & Solceller" },
    }),
    prisma.department.upsert({
      where: { name: "Administrasjon" },
      update: {},
      create: { name: "Administrasjon" },
    }),
  ]);
  console.log(`   ✓ ${departments.length} departments created`);

  // ── Units (SI + NOBBS-typiske handelsenheter, Norge) ───────────────────────
  console.log("📏 Creating units of measure…");
  const pcs = await ensureUnit(["Piece", "Stykk"], { name: "Stykk", symbol: "stk" });
  const metre = await ensureUnit(["Metre", "Meter"], { name: "Meter", symbol: "m" });
  await ensureUnit(["Kilogram"], { name: "Kilogram", symbol: "kg" });
  const box = await ensureUnit(["Box", "Eske"], { name: "Eske", symbol: "esk" });
  await ensureUnit(["Roll", "Rull"], { name: "Rull", symbol: "rull" });
  await ensureUnit(["Set", "Sett"], { name: "Sett", symbol: "sett" });
  console.log("   ✓ 6 units created");

  // ── Categories (norske navn) ──────────────────────────────────────────────
  console.log("🏷️  Creating categories…");
  const cables = await ensureCategory(["Cables & Wiring", "Kabler & kabling"], {
    name: "Kabler & kabling",
    description: "Kraftkabler, datakabler, koaks, fiber",
  });
  const switchgear = await ensureCategory(["Switchgear & Breakers", "Vern & kurser"], {
    name: "Vern & kurser",
    description: "Automatsikringer, dreiesikringer, jordfeil, kurser",
  });
  const conduits = await ensureCategory(["Conduits & Trunking", "Rør & kabelrenner"], {
    name: "Rør & kabelrenner",
    description: "Installasjonsrør, stålrørkode, kabelrenner",
  });
  const evChargers = await ensureCategory(["EV Chargers", "Elbilladere"], {
    name: "Elbilladere",
    description: "Ladestasjoner og tilbehør til elbil",
  });
  const heatPumps = await ensureCategory(["Heat Pumps", "Varmepumper"], {
    name: "Varmepumper",
    description: "Luft-til-luft, installasjonssett",
  });
  const solar = await ensureCategory(["Solar Panels", "Solceller"], {
    name: "Solceller",
    description: "Moduler, vekselrettere, festesystemer",
  });
  const alarmCat = await ensureCategory(["Alarm & Security", "Brann & sikkerhet"], {
    name: "Brann & sikkerhet",
    description: "Brannalarm, detektorer, sentraler, kamera",
  });
  const lighting = await ensureCategory(["Lighting", "Belysning"], {
    name: "Belysning",
    description: "LED-armatur, nødlys, dimmere",
  });
  const toolsCat = await ensureCategory(["Tools & Equipment", "Verktøy & måleutstyr"], {
    name: "Verktøy & måleutstyr",
    description: "Håndverktøy, elverktøy, feltmålere",
  });
  const consumables = await ensureCategory(["Consumables", "Forbruksmateriell"], {
    name: "Forbruksmateriell",
    description: "Tape, strips, skjøter, festemateriell",
  });
  console.log("   ✓ 10 categories created");

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
  const [elektroskandia, ahlsell, panasonic] = suppliers;
  console.log(`   ✓ ${suppliers.length} suppliers created`);

  // ── Products (enhetspriser i NOK eks. mva, typisk elektro-grossist) ────────
  console.log("📦 Creating products…");
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: "CAB-NYM-2X1.5" },
      update: {
        name: "NYM-J 2x1,5 mm² kabel",
        description: "Installasjonskabel for fast montering (metervare)",
        unitPrice: 18.9,
        barcode: "7090123456789",
        purchaseUnitCost: 12.4,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "CAB-NYM-2X1.5",
        name: "NYM-J 2x1,5 mm² kabel",
        description: "Installasjonskabel for fast montering (metervare)",
        unitPrice: 18.9,
        barcode: "7090123456789",
        purchaseUnitCost: 12.4,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAB-NYM-3X2.5" },
      update: {
        name: "NYM-J 3x2,5 mm² kabel",
        description: "Rund PVC-kabel til stikk og utstyr (metervare)",
        unitPrice: 29.5,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "CAB-NYM-3X2.5",
        name: "NYM-J 3x2,5 mm² kabel",
        description: "Rund PVC-kabel til stikk og utstyr (metervare)",
        unitPrice: 29.5,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "BRK-MCB-16A" },
      update: {
        name: "Automatsikring 1P 16 A, kurve B",
        description: "Miniatyrkurs som type ABB/ Schneider-nivå (stk)",
        unitPrice: 64.0,
        categoryId: switchgear.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "BRK-MCB-16A",
        name: "Automatsikring 1P 16 A, kurve B",
        description: "Miniatyrkurs som type ABB/ Schneider-nivå (stk)",
        unitPrice: 64.0,
        categoryId: switchgear.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "BRK-MCB-32A" },
      update: {
        name: "Automatsikring 1P 32 A, kurve C",
        description: "Miniatyrkurs for kurser mot utstyr (stk)",
        unitPrice: 92.0,
        categoryId: switchgear.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "BRK-MCB-32A",
        name: "Automatsikring 1P 32 A, kurve C",
        description: "Miniatyrkurs for kurser mot utstyr (stk)",
        unitPrice: 92.0,
        categoryId: switchgear.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "EV-ZAPTEC-GO" },
      update: {
        name: "Zaptec Go ladestasjon 22 kW",
        description: "Hjemmelader med app, T2 (stk)",
        unitPrice: 8490.0,
        categoryId: evChargers.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "EV-ZAPTEC-GO",
        name: "Zaptec Go ladestasjon 22 kW",
        description: "Hjemmelader med app, T2 (stk)",
        unitPrice: 8490.0,
        categoryId: evChargers.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HP-PAN-CZ35" },
      update: {
        name: "Panasonic Etherea CZ35 Varmepumpe 3,5 kW",
        description: "Veggmontert Luft-Luft, Wi‑Fi (stk)",
        unitPrice: 34990.0,
        categoryId: heatPumps.id,
        unitId: pcs.id,
        supplierId: panasonic.id,
      },
      create: {
        sku: "HP-PAN-CZ35",
        name: "Panasonic Etherea CZ35 Varmepumpe 3,5 kW",
        description: "Veggmontert Luft-Luft, Wi‑Fi (stk)",
        unitPrice: 34990.0,
        categoryId: heatPumps.id,
        unitId: pcs.id,
        supplierId: panasonic.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CON-WAGO-221-412" },
      update: {
        name: "WAGO 221-412 skjøteklemme 2-pol (eske à 50 stk)",
        description: "Løfteklemme; pris per eske (eks. mva)",
        unitPrice: 412.0,
        categoryId: consumables.id,
        unitId: box.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "CON-WAGO-221-412",
        name: "WAGO 221-412 skjøteklemme 2-pol (eske à 50 stk)",
        description: "Løfteklemme; pris per eske (eks. mva)",
        unitPrice: 412.0,
        categoryId: consumables.id,
        unitId: box.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAB-CAT6-U" },
      update: {
        name: "Cat6 U/UTP datakabel",
        description: "Metervare for strukturert kabling",
        unitPrice: 6.8,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "CAB-CAT6-U",
        name: "Cat6 U/UTP datakabel",
        description: "Metervare for strukturert kabling",
        unitPrice: 6.8,
        categoryId: cables.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "SOL-JA-400M" },
      update: {
        name: "JA Solar 400 W monofasial modul",
        description: "Solcellepanel, svart ramme (stk)",
        unitPrice: 1589.0,
        categoryId: solar.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "SOL-JA-400M",
        name: "JA Solar 400 W monofasial modul",
        description: "Solcellepanel, svart ramme (stk)",
        unitPrice: 1589.0,
        categoryId: solar.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "LUX-DALI-DIM" },
      update: {
        name: "DALI dimreaktor 1-kanal",
        description: "Innbygg dimmer for DALI (stk)",
        unitPrice: 1249.0,
        categoryId: lighting.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "LUX-DALI-DIM",
        name: "DALI dimreaktor 1-kanal",
        description: "Innbygg dimmer for DALI (stk)",
        unitPrice: 1249.0,
        categoryId: lighting.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "ALM-HC-OPT" },
      update: {
        name: "Optisk røykdetektor adresserbar",
        description: "Branndetektor, type Honeywell/Simplex-nivå (stk)",
        unitPrice: 589.0,
        categoryId: alarmCat.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "ALM-HC-OPT",
        name: "Optisk røykdetektor adresserbar",
        description: "Branndetektor, type Honeywell/Simplex-nivå (stk)",
        unitPrice: 589.0,
        categoryId: alarmCat.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "TOOL-INS-FLUKE" },
      update: {
        name: "Fluke 1507 isolasjonstester",
        description: "Feltmåler / megger for elektro (stk)",
        unitPrice: 6990.0,
        categoryId: toolsCat.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "TOOL-INS-FLUKE",
        name: "Fluke 1507 isolasjonstester",
        description: "Feltmåler / megger for elektro (stk)",
        unitPrice: 6990.0,
        categoryId: toolsCat.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "COND-FLEX-20" },
      update: {
        name: "Fleksirør metall Ø20 mm",
        description: "Flytmetallrør, salg i meter (trommel)",
        unitPrice: 9.4,
        categoryId: conduits.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "COND-FLEX-20",
        name: "Fleksirør metall Ø20 mm",
        description: "Flytmetallrør, salg i meter (trommel)",
        unitPrice: 9.4,
        categoryId: conduits.id,
        unitId: metre.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "EV-WALLBOX-P" },
      update: {
        name: "Easee Home ladestasjon 22 kW",
        description: "Laststyring, veggmontert (stk)",
        unitPrice: 7290.0,
        categoryId: evChargers.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
      create: {
        sku: "EV-WALLBOX-P",
        name: "Easee Home ladestasjon 22 kW",
        description: "Laststyring, veggmontert (stk)",
        unitPrice: 7290.0,
        categoryId: evChargers.id,
        unitId: pcs.id,
        supplierId: elektroskandia.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HP-DAIKIN-4k" },
      update: {
        name: "Daikin Perfera 4,0 kW veggmodell",
        description: "Luft-luft varmepumpe m/ Wi‑Fi-adapter (stk)",
        unitPrice: 19890.0,
        categoryId: heatPumps.id,
        unitId: pcs.id,
        supplierId: panasonic.id,
      },
      create: {
        sku: "HP-DAIKIN-4k",
        name: "Daikin Perfera 4,0 kW veggmodell",
        description: "Luft-luft varmepumpe m/ Wi‑Fi-adapter (stk)",
        unitPrice: 19890.0,
        categoryId: heatPumps.id,
        unitId: pcs.id,
        supplierId: panasonic.id,
      },
    }),
  ]);
  console.log(`   ✓ ${products.length} products created`);

  for (let i = 0; i < products.length; i++) {
    const p = products[i]!;
    if (p.barcode) continue;
    await prisma.product.update({
      where: { id: p.id },
      data: { barcode: `7090123${String(1_000_000 + i).slice(1)}` },
    });
  }

  // ── Users & Employees (before time-series data references users) ─────────
  console.log("👤 Creating users and employees...");
  const passwordHash = await bcrypt.hash("Aqila2026!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@aqila.no" },
    update: { passwordHash, mustChangePassword: false },
    create: {
      name: "Lars Erik Flygel",
      email: "admin@aqila.no",
      passwordHash,
      role: UserRole.ADMIN,
      mustChangePassword: false,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@aqila.no" },
    update: { passwordHash, mustChangePassword: false },
    create: {
      name: "Silje Nordvik",
      email: "manager@aqila.no",
      passwordHash,
      role: UserRole.MANAGER,
      mustChangePassword: false,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@aqila.no" },
    update: { passwordHash, mustChangePassword: false },
    create: {
      name: "Ole Petter Amundsen",
      email: "staff@aqila.no",
      passwordHash,
      role: UserRole.STAFF,
      mustChangePassword: false,
    },
  });

  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {
      phone: "+47 76 06 09 99",
      address: "Sjøgata 1, 8300 Svolvær",
      nationality: "Norsk",
    },
    create: {
      employeeCode: "AQ-0001",
      firstName: "Lars Erik",
      lastName: "Flygel",
      hireDate: new Date("2019-11-01"),
      nationality: "Norsk",
      phone: "+47 76 06 09 99",
      address: "Sjøgata 1, 8300 Svolvær",
      userId: adminUser.id,
      locationId: svolvær.id,
      departmentId: departments[5].id,
    },
  });

  await prisma.employee.upsert({
    where: { userId: managerUser.id },
    update: {
      phone: "+47 934 22 118",
      address: "Storgata 14, 8370 Leknes",
      nationality: "Norsk",
    },
    create: {
      employeeCode: "AQ-0002",
      firstName: "Silje",
      lastName: "Nordvik",
      hireDate: new Date("2020-03-15"),
      nationality: "Norsk",
      phone: "+47 934 22 118",
      address: "Storgata 14, 8370 Leknes",
      userId: managerUser.id,
      locationId: gravdal.id,
      departmentId: departments[0].id,
    },
  });

  await prisma.employee.upsert({
    where: { userId: staffUser.id },
    update: {
      phone: "+47 901 55 442",
      address: "Kong Øystein veg 12, 8300 Svolvær",
      nationality: "Norsk",
    },
    create: {
      employeeCode: "AQ-0003",
      firstName: "Ole Petter",
      lastName: "Amundsen",
      hireDate: new Date("2021-06-01"),
      nationality: "Norsk",
      phone: "+47 901 55 442",
      address: "Kong Øystein veg 12, 8300 Svolvær",
      userId: staffUser.id,
      locationId: svolvær.id,
      departmentId: departments[0].id,
    },
  });

  const extraStaffProfiles: Array<{
    email: string;
    name: string;
    role: UserRole;
    code: string;
    firstName: string;
    lastName: string;
    deptIdx: number;
    locationIdx: number;
    hireDate: Date;
    phone: string;
    address: string;
    nationality: string;
  }> = [
    {
      email: "viewer@aqila.no",
      name: "Maria Haugen",
      role: UserRole.VIEWER,
      code: "AQ-0004",
      firstName: "Maria",
      lastName: "Haugen",
      deptIdx: 5,
      locationIdx: 1,
      hireDate: new Date("2022-01-10"),
      phone: "+47 412 88 901",
      address: "Torget 3, 8370 Leknes",
      nationality: "Norsk",
    },
    {
      email: "montør1@aqila.no",
      name: "Jonas Berg",
      role: UserRole.STAFF,
      code: "AQ-0005",
      firstName: "Jonas",
      lastName: "Berg",
      deptIdx: 0,
      locationIdx: 2,
      hireDate: new Date("2021-09-01"),
      phone: "+47 918 44 220",
      address: "Hamna 7, 8064 Røst",
      nationality: "Norsk",
    },
    {
      email: "montør2@aqila.no",
      name: "Eirik Solheim",
      role: UserRole.STAFF,
      code: "AQ-0006",
      firstName: "Eirik",
      lastName: "Solheim",
      deptIdx: 3,
      locationIdx: 3,
      hireDate: new Date("2020-08-17"),
      phone: "+47 905 11 773",
      address: "Rambergveien 22, 8382 Ramberg",
      nationality: "Norsk",
    },
    {
      email: "alarm@aqila.no",
      name: "Ingrid Moen",
      role: UserRole.STAFF,
      code: "AQ-0007",
      firstName: "Ingrid",
      lastName: "Moen",
      deptIdx: 2,
      locationIdx: 0,
      hireDate: new Date("2023-02-01"),
      phone: "+47 977 60 014",
      address: "Holmen 5, 8300 Svolvær",
      nationality: "Norsk",
    },
    {
      email: "vp@aqila.no",
      name: "Thomas Vik",
      role: UserRole.MANAGER,
      code: "AQ-0008",
      firstName: "Thomas",
      lastName: "Vik",
      deptIdx: 4,
      locationIdx: 0,
      hireDate: new Date("2018-05-01"),
      phone: "+47 920 88 441",
      address: "Sjøgata 8, 8300 Svolvær",
      nationality: "Norsk",
    },
    {
      email: "lager@aqila.no",
      name: "Hanne Kristoffersen",
      role: UserRole.STAFF,
      code: "AQ-0009",
      firstName: "Hanne",
      lastName: "Kristoffersen",
      deptIdx: 0,
      locationIdx: 0,
      hireDate: new Date("2019-03-11"),
      phone: "+47 934 55 009",
      address: "Industrivegen 2, 8300 Svolvær",
      nationality: "Norsk",
    },
    {
      email: "sol@aqila.no",
      name: "Petra Nilsen",
      role: UserRole.STAFF,
      code: "AQ-0010",
      firstName: "Petra",
      lastName: "Nilsen",
      deptIdx: 4,
      locationIdx: 1,
      hireDate: new Date("2022-11-15"),
      phone: "+47 458 90 112",
      address: "Leknes industriområde, 8370 Leknes",
      nationality: "Norsk",
    },
  ];

  const branchByIdx = [svolvær, gravdal, røst, ramberg];
  for (const row of extraStaffProfiles) {
    const u = await prisma.user.upsert({
      where: { email: row.email },
      update: { passwordHash, mustChangePassword: false, name: row.name, role: row.role },
      create: {
        name: row.name,
        email: row.email,
        passwordHash,
        role: row.role,
        mustChangePassword: false,
      },
    });
    await prisma.employee.upsert({
      where: { userId: u.id },
      update: {
        phone: row.phone,
        address: row.address,
        nationality: row.nationality,
        departmentId: departments[row.deptIdx]!.id,
        locationId: branchByIdx[row.locationIdx]!.id,
      },
      create: {
        employeeCode: row.code,
        firstName: row.firstName,
        lastName: row.lastName,
        hireDate: row.hireDate,
        nationality: row.nationality,
        phone: row.phone,
        address: row.address,
        userId: u.id,
        locationId: branchByIdx[row.locationIdx]!.id,
        departmentId: departments[row.deptIdx]!.id,
      },
    });
  }

  console.log(`   ✓ ${3 + extraStaffProfiles.length} users and employee profiles`);

  // ── Target stock (every SKU × every branch — presentation-rich inventory grids / CSV)
  type StockTarget = {
    productId: string;
    locationId: string;
    quantity: number;
    reorderPoint: number;
  };

  const branchLocationsForStock = [svolvær, gravdal, røst, ramberg];
  const stockTargets: StockTarget[] = [];

  function skuStockKind(sku: string): "m" | "esk" | "stk" {
    if (sku.includes("WAGO")) return "esk";
    if (sku.includes("NYM") || sku.includes("CAT") || sku.includes("COND")) return "m";
    return "stk";
  }

  for (let pi = 0; pi < products.length; pi++) {
    const product = products[pi]!;
    const kind = skuStockKind(product.sku);
    for (let li = 0; li < branchLocationsForStock.length; li++) {
      const loc = branchLocationsForStock[li]!;
      const branchFactor = [1.55, 1.05, 0.42, 0.28][li]!;
      let base: number;
      let reorder: number;
      if (kind === "m") {
        base = Math.round((2200 + pi * 180) * branchFactor);
        reorder = Math.round((420 + pi * 40) * branchFactor);
      } else if (kind === "esk") {
        base = Math.max(8, Math.round((22 + pi * 3) * branchFactor));
        reorder = Math.max(4, Math.round((7 + pi) * branchFactor));
      } else {
        base = Math.max(12, Math.round((48 + pi * 6) * branchFactor));
        reorder = Math.max(6, Math.round((14 + pi * 2) * branchFactor));
      }
      stockTargets.push({
        productId: product.id,
        locationId: loc.id,
        quantity: base,
        reorderPoint: reorder,
      });
    }
  }

  const [van1, van2] = [locations[4]!, locations[5]!];
  const vanSkuIdx = [2, 4, 7, 10, 12];
  for (const van of [van1, van2]) {
    for (const idx of vanSkuIdx) {
      const p = products[idx];
      if (!p) continue;
      stockTargets.push({
        productId: p.id,
        locationId: van.id,
        quantity: 14 + idx,
        reorderPoint: 5,
      });
    }
  }

  console.log("📊 Ensuring stock rows…");
  for (const t of stockTargets) {
    await prisma.stock.upsert({
      where: { productId_locationId: { productId: t.productId, locationId: t.locationId } },
      update: {
        quantity: new Prisma.Decimal(t.quantity),
        reorderPoint: new Prisma.Decimal(t.reorderPoint),
      },
      create: {
        productId: t.productId,
        locationId: t.locationId,
        quantity: new Prisma.Decimal(t.quantity),
        reorderPoint: new Prisma.Decimal(t.reorderPoint),
      },
    });
  }
  console.log(`   ✓ ${stockTargets.length} stock rows (levels set after timeline below)`);

  const allStocks = await prisma.stock.findMany({
    include: {
      product: { select: { unitPrice: true, unit: { select: { symbol: true } } } },
    },
  });

  const demoStart = subDays(new Date(), 365);
  const demoDays = eachDayOfInterval({ start: demoStart, end: new Date() });
  const rand = mulberry32(20260512);

  function movementQty(unitSymbol: string, isIn: boolean): number {
    if (unitSymbol === "m") {
      return isIn ? 40 + Math.floor(rand() * 460) : 18 + Math.floor(rand() * 220);
    }
    if (unitSymbol === "esk") {
      return isIn ? 2 + Math.floor(rand() * 22) : 1 + Math.floor(rand() * 8);
    }
    if (unitSymbol === "kg") {
      return isIn ? 5 + Math.floor(rand() * 45) : 2 + Math.floor(rand() * 18);
    }
    if (unitSymbol === "rull" || unitSymbol === "sett") {
      return isIn ? 2 + Math.floor(rand() * 14) : 1 + Math.floor(rand() * 6);
    }
    return isIn ? 8 + Math.floor(rand() * 95) : 3 + Math.floor(rand() * 42);
  }

  function transferQty(unitSymbol: string): number {
    if (unitSymbol === "m") return 80 + Math.floor(rand() * 920);
    if (unitSymbol === "esk") return 2 + Math.floor(rand() * 16);
    return 6 + Math.floor(rand() * 44);
  }

  const productUnitById = new Map(
    (
      await prisma.product.findMany({
        select: { id: true, unit: { select: { symbol: true } } },
      })
    ).map((p) => [p.id, p.unit.symbol])
  );

  function poOrderedQty(productId: string): number {
    const sym = productUnitById.get(productId) ?? "stk";
    if (sym === "m") return 180 + Math.floor(rand() * 4_200);
    if (sym === "esk") return 6 + Math.floor(rand() * 36);
    return 15 + Math.floor(rand() * 125);
  }
  const employees = await prisma.employee.findMany();

  // ── Stock movements (~12 months, weekdays) ────────────────────────────────
  console.log("📈 Generating ~12 months of stock movements…");
  const movementRows: Prisma.StockMovementCreateManyInput[] = [];
  const notesOut = [
    "[demo] Ut til prosjekt",
    "[demo] Servicebil SV-01",
    "[demo] Kundeinstallasjon",
    "[demo] Forbruk verksted",
    "[demo] Ramberg kabeltrekk",
  ];
  const notesIn = [
    "[demo] Leveranse Elektroskandia",
    "[demo] Mottak varehus",
    "[demo] Korrigert leveranse",
    "[demo] Retur fra prosjekt",
    "[demo] Ahlsell parti",
  ];

  for (const day of demoDays) {
    if (isWeekend(day)) continue;
    const bursts = rand() < 0.22 ? 0 : rand() < 0.5 ? 1 : rand() < 0.82 ? 2 : 3;
    for (let b = 0; b < bursts; b++) {
      const stock = allStocks[Math.floor(rand() * allStocks.length)]!;
      const sym = stock.product.unit.symbol;
      const isIn = rand() < 0.36;
      const qty = movementQty(sym, isIn);
      const hour = 7 + Math.floor(rand() * 11);
      const unitCostIn = isIn
        ? Number((Number(stock.product.unitPrice) * 0.72).toFixed(2))
        : undefined;
      movementRows.push({
        stockId: stock.id,
        type: isIn ? MovementType.IN : MovementType.OUT,
        quantity: new Prisma.Decimal(qty),
        unitCost: unitCostIn !== undefined ? new Prisma.Decimal(unitCostIn) : undefined,
        note: isIn
          ? notesIn[Math.floor(rand() * notesIn.length)]
          : notesOut[Math.floor(rand() * notesOut.length)],
        createdAt: addHours(day, hour),
        userId: rand() < 0.55 ? staffUser.id : rand() < 0.85 ? managerUser.id : adminUser.id,
      });
    }
    // Occasional transfer story (paired OUT/IN on two branches)
    if (rand() < 0.08 && allStocks.length >= 4) {
      const fromS = allStocks.filter((s) => s.locationId === svolvær.id);
      const toS = allStocks.filter(
        (s) => s.locationId === gravdal.id && s.productId === fromS[0]?.productId
      );
      if (fromS[0] && toS[0]) {
        const sym = fromS[0].product.unit.symbol;
        const tq = transferQty(sym);
        const t0 = addHours(day, 10);
        movementRows.push({
          stockId: fromS[0].id,
          type: MovementType.TRANSFER,
          quantity: new Prisma.Decimal(tq),
          note: "[demo] Internflytt Svolvær → Gravdal",
          createdAt: t0,
          fromLocationId: svolvær.id,
          toLocationId: gravdal.id,
          userId: managerUser.id,
        });
        movementRows.push({
          stockId: toS[0].id,
          type: MovementType.TRANSFER,
          quantity: new Prisma.Decimal(tq),
          note: "[demo] Internflytt Svolvær → Gravdal",
          createdAt: addMinutes(addHours(day, 10), 30),
          fromLocationId: svolvær.id,
          toLocationId: gravdal.id,
          userId: managerUser.id,
        });
      }
    }
  }

  const chunk = 400;
  for (let i = 0; i < movementRows.length; i += chunk) {
    await prisma.stockMovement.createMany({ data: movementRows.slice(i, i + chunk) });
  }
  console.log(`   ✓ ${movementRows.length} stock movements inserted`);

  // ── Purchase orders ───────────────────────────────────────────────────────
  console.log("🧾 Creating purchase orders across the year…");
  const poCreators = [managerUser.id, adminUser.id];
  const poLocations = [svolvær.id, gravdal.id, røst.id];
  for (let i = 0; i < 55; i++) {
    const createdAt = addDays(demoStart, Math.floor(rand() * 360));
    const ageDays = (Date.now() - createdAt.getTime()) / 86400000;
    let status: POStatus = POStatus.RECEIVED;
    if (ageDays < 14) status = POStatus.SUBMITTED;
    else if (ageDays < 35) status = POStatus.ORDERED;
    else if (ageDays < 70) status = POStatus.PARTIALLY_RECEIVED;
    else if (ageDays < 95) status = POStatus.APPROVED;
    else if (rand() < 0.06) status = POStatus.CANCELLED;

    const poNum = `PO-DEMO-${(2400 + i).toString()}`;
    const nLines = 1 + Math.floor(rand() * 3);
    let total = 0;
    const items: { productId: string; ordered: number; price: number }[] = [];
    for (let L = 0; L < nLines; L++) {
      const p = products[Math.floor(rand() * products.length)]!;
      const ordered = poOrderedQty(p.id);
      const price = Number(p.unitPrice);
      total += ordered * price;
      items.push({ productId: p.id, ordered, price });
    }

    const createdById = poCreators[Math.floor(rand() * poCreators.length)]!;
    const tMs = createdAt.getTime();

    const auditLogsCreate: Prisma.PurchaseOrderAuditLogCreateWithoutPurchaseOrderInput[] = [];
    auditLogsCreate.push({
      kind: POAuditEventKind.STATUS_CHANGE,
      fromStatus: null,
      toStatus: POStatus.SUBMITTED,
      details: "[demo seed] Registrert i IMS og sendt til godkjenning",
      actor: { connect: { id: createdById } },
      createdAt: new Date(tMs + 2 * 3600000),
    });

    if (status === POStatus.CANCELLED) {
      auditLogsCreate.push({
        kind: POAuditEventKind.STATUS_CHANGE,
        fromStatus: POStatus.SUBMITTED,
        toStatus: POStatus.CANCELLED,
        details: "[demo seed] Innkjøp stoppet — prosjekt på vent",
        actor: { connect: { id: createdById } },
        createdAt: new Date(tMs + 72 * 3600000),
      });
    } else if (status !== POStatus.SUBMITTED) {
      auditLogsCreate.push({
        kind: POAuditEventKind.STATUS_CHANGE,
        fromStatus: POStatus.SUBMITTED,
        toStatus: POStatus.APPROVED,
        details: "[demo seed] Budsjett og leverandør bekreftet",
        actor: { connect: { id: adminUser.id } },
        createdAt: new Date(tMs + 36 * 3600000),
      });
    }

    if (
      status === POStatus.ORDERED ||
      status === POStatus.PARTIALLY_RECEIVED ||
      status === POStatus.RECEIVED
    ) {
      auditLogsCreate.push({
        kind: POAuditEventKind.STATUS_CHANGE,
        fromStatus: POStatus.APPROVED,
        toStatus: POStatus.ORDERED,
        details: "[demo seed] Ordre bekreftet hos leverandør",
        actor: { connect: { id: managerUser.id } },
        createdAt: new Date(tMs + 60 * 3600000),
      });
    }

    if (status === POStatus.PARTIALLY_RECEIVED) {
      auditLogsCreate.push({
        kind: POAuditEventKind.RECEIPT,
        fromStatus: POStatus.ORDERED,
        toStatus: POStatus.PARTIALLY_RECEIVED,
        details: "[demo seed] Dellevering skannet inn på terminal",
        actor: { connect: { id: staffUser.id } },
        createdAt: new Date(tMs + 120 * 3600000),
      });
    }

    if (status === POStatus.RECEIVED) {
      auditLogsCreate.push({
        kind: POAuditEventKind.RECEIPT,
        fromStatus: POStatus.ORDERED,
        toStatus: POStatus.RECEIVED,
        details: "[demo seed] Komplett parti — kvalitetssjekk OK",
        actor: { connect: { id: staffUser.id } },
        createdAt: new Date(tMs + 132 * 3600000),
      });
    }

    if (status === POStatus.SUBMITTED && rand() < 0.28) {
      auditLogsCreate.push({
        kind: POAuditEventKind.ESCALATION_NOTE,
        details: "[demo seed] Påminnelse: godkjenning >48 timer",
        actor: { connect: { id: managerUser.id } },
        createdAt: new Date(tMs + 96 * 3600000),
      });
    }

    await prisma.purchaseOrder.create({
      data: {
        poNumber: poNum,
        status,
        expectedDate: addDays(createdAt, 10 + Math.floor(rand() * 12)),
        receivedAt:
          status === POStatus.RECEIVED || status === POStatus.PARTIALLY_RECEIVED
            ? addDays(createdAt, 12 + Math.floor(rand() * 8))
            : null,
        totalAmount: new Prisma.Decimal(Math.round(total * 100) / 100),
        notes: `[demo] Årsbestilling spor ${i + 1} · referanse EL-${2400 + i}`,
        createdAt,
        supplierId: rand() < 0.72 ? elektroskandia.id : ahlsell.id,
        locationId: poLocations[Math.floor(rand() * poLocations.length)]!,
        createdById,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            orderedQuantity: new Prisma.Decimal(it.ordered),
            receivedQuantity: new Prisma.Decimal(
              status === POStatus.RECEIVED
                ? it.ordered
                : status === POStatus.PARTIALLY_RECEIVED
                  ? Math.floor(it.ordered * 0.5)
                  : 0
            ),
            unitPrice: new Prisma.Decimal(it.price),
          })),
        },
        auditLogs: { create: auditLogsCreate },
      },
    });
  }
  console.log("   ✓ 55 purchase orders with audit timeline");

  // ── Projects ──────────────────────────────────────────────────────────────
  console.log("📂 Creating projects with history…");
  const projectBlueprints = [
    { name: "Lofothallen oppgradering belysning", client: "Lofoten Rør AS" },
    { name: "Elbil-lading Berlevåg kai", client: "Boreal Kaidrift" },
    { name: "Brannalarm Røst kommunehus", client: "Røst kommune" },
    { name: "Varmepumpe enebolig Reine", client: "Privat" },
    { name: "Solceller næringsbygg Leknes", client: "Nordland Invest AS" },
    { name: "Datasentral Cat6 Ramberg skole", client: "Vest-Lofoten skole" },
    { name: "Serviceavtale Melbu industri", client: "Cermaq Norway" },
    { name: "Ny skiltforsterker Svolvær sentrum", client: "Aqila Service" },
    { name: "Havbruksanlegg svakstrøm", client: "Lofoten Aqua" },
    { name: "Passivhus elektrisk Røst", client: "Statsbygg" },
  ];

  const demoCustomers = await Promise.all(
    projectBlueprints.map((bp, i) => {
      const slug = bp.client
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return prisma.customer.create({
        data: {
          name: bp.client,
          phone: `+47 76 ${String(1000 + i).slice(1)} ${String(20 + i).padStart(2, "0")}`,
          email:
            i % 2 === 0 ? `kontakt@${slug || "kunde"}.no` : `firmapost@${slug || "bedrift"}.no`,
          address:
            i % 3 === 0
              ? `Bedriftsveien ${10 + i}, 8300 Svolvær`
              : `Industrigata ${5 + (i % 8)}, ${8370 + (i % 5)} Leknes`,
          notes: "[demo seed] Referansekunde for presentasjon.",
          isActive: true,
        },
      });
    })
  );
  const customerIdByName = new Map(
    demoCustomers.map((c: { id: string; name: string }) => [c.name, c.id] as const)
  );

  for (let i = 0; i < 30; i++) {
    const bp = projectBlueprints[i % projectBlueprints.length]!;
    const start = addDays(demoStart, 8 + Math.floor(rand() * 320));
    const span = 25 + Math.floor(rand() * 120);
    const end = addDays(start, span);
    const ageEnd = (Date.now() - end.getTime()) / 86400000;
    const ageStart = (Date.now() - start.getTime()) / 86400000;
    let status: ProjectStatus = ProjectStatus.IN_PROGRESS;
    if (ageEnd > 30 && rand() < 0.45) status = ProjectStatus.COMPLETED;
    else if (ageStart > 200 && rand() < 0.12) status = ProjectStatus.PLANNING;
    else if (rand() < 0.06) status = ProjectStatus.ON_HOLD;
    else if (rand() < 0.03) status = ProjectStatus.CANCELLED;

    const loc = [svolvær, gravdal, røst, ramberg][Math.floor(rand() * 4)]!;
    const leadEmp = employees[Math.floor(rand() * employees.length)]!;
    let mateIx = Math.floor(rand() * employees.length);
    if (employees[mateIx]!.id === leadEmp.id) mateIx = (mateIx + 1) % employees.length;
    const mateEmp = employees[mateIx]!;

    const matCount = 2 + Math.floor(rand() * 4);
    const matProducts = [...products].sort(() => rand() - 0.5).slice(0, matCount);

    await prisma.project.create({
      data: {
        projectCode: `PRJ-DEMO-${(8100 + i).toString()}`,
        name: `${bp.name} (#${i + 1})`,
        description: `[demo] Omfang: materiell, montering og dokumentasjon. Lokasjon: ${loc.name}. Kontraktår 2025–2026.`,
        status,
        startDate: start,
        endDate:
          status === ProjectStatus.COMPLETED
            ? end
            : status === ProjectStatus.IN_PROGRESS
              ? null
              : addDays(start, span),
        clientName: bp.client,
        clientPhone: `+47 9${String(10 + (i % 70)).padStart(2, "0")} ${String(10_000 + i).slice(1)}`,
        customerId: customerIdByName.get(bp.client) ?? null,
        createdAt: addDays(start, -5),
        locationId: loc.id,
        employees: {
          create: [
            { employeeId: leadEmp.id, role: "Prosjektleder" },
            ...(rand() < 0.82 ? [{ employeeId: mateEmp.id, role: "Montør" }] : []),
          ],
        },
        materials: {
          create: matProducts.map((prod) => {
            const reserved = 5 + Math.floor(rand() * 48);
            const used = Math.min(reserved + 12, Math.max(2, Math.floor(rand() * (reserved + 28))));
            return {
              productId: prod.id,
              reservedQuantity: new Prisma.Decimal(reserved),
              usedQuantity: new Prisma.Decimal(used),
              unitCostAtTime: new Prisma.Decimal(Number(prod.unitPrice)),
            };
          }),
        },
      },
    });
  }
  console.log("   ✓ Demo customers & 30 projects (material lines + team)");

  console.log("🔗 Linking stock movements to POs and projects (richer CSV reference columns)…");
  const poLinkIds = (
    await prisma.purchaseOrder.findMany({
      where: { status: { in: [POStatus.RECEIVED, POStatus.PARTIALLY_RECEIVED] } },
      select: { id: true },
      take: 48,
    })
  ).map((r) => r.id);
  const projectLinkIds = (
    await prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED, ProjectStatus.ON_HOLD] },
      },
      select: { id: true },
      take: 40,
    })
  ).map((r) => r.id);

  if (poLinkIds.length > 0) {
    const inMoves = await prisma.stockMovement.findMany({
      where: { type: MovementType.IN },
      orderBy: { createdAt: "desc" },
      take: Math.min(70, Math.max(25, poLinkIds.length * 2)),
      select: { id: true },
    });
    for (let i = 0; i < inMoves.length; i++) {
      await prisma.stockMovement.update({
        where: { id: inMoves[i]!.id },
        data: { purchaseOrderId: poLinkIds[i % poLinkIds.length] },
      });
    }
  }

  if (projectLinkIds.length > 0) {
    const outMoves = await prisma.stockMovement.findMany({
      where: { type: MovementType.OUT },
      orderBy: { createdAt: "desc" },
      take: Math.min(95, Math.max(35, projectLinkIds.length * 3)),
      select: { id: true },
    });
    for (let i = 0; i < outMoves.length; i++) {
      await prisma.stockMovement.update({
        where: { id: outMoves[i]!.id },
        data: { projectId: projectLinkIds[i % projectLinkIds.length] },
      });
    }
  }
  console.log("   ✓ Movement ↔ PO / project links applied");

  // ── Attendance (weekdays, ~1 year) ────────────────────────────────────────
  console.log("🕐 Generating attendance (weekdays, last ~12 months)…");
  let attendanceCount = 0;
  for (const emp of employees) {
    for (const day of demoDays) {
      if (isWeekend(day)) continue;
      const r = rand();
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      if (r > 0.93) status = AttendanceStatus.ABSENT;
      else if (r > 0.88) status = AttendanceStatus.LATE;
      else if (r > 0.985) status = AttendanceStatus.LEAVE;
      const d = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
      const checkIn = addHours(
        day,
        status === AttendanceStatus.ABSENT ? 0 : status === AttendanceStatus.LATE ? 9 : 7
      );
      const checkOut =
        status === AttendanceStatus.ABSENT
          ? null
          : addHours(day, status === AttendanceStatus.LATE ? 16 : 15);
      const hours =
        checkIn && checkOut
          ? Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 3600000)
          : null;
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          date: d,
          status,
          checkIn: status === AttendanceStatus.ABSENT ? null : checkIn,
          checkOut,
          hoursWorked: hours != null ? new Prisma.Decimal(Math.round(hours * 100) / 100) : null,
          notes:
            status !== AttendanceStatus.PRESENT
              ? "[demo seed] Avvik registrert av vaktleder — se HR-protokoll"
              : null,
        },
      });
      attendanceCount++;
    }
  }
  console.log(`   ✓ ${attendanceCount} attendance records`);

  // ── Shifts (sample) ───────────────────────────────────────────────────────
  console.log("📅 Creating sample shifts…");
  for (let s = 0; s < 120; s++) {
    const emp = employees[Math.floor(rand() * employees.length)]!;
    const d0 = addDays(demoStart, Math.floor(rand() * 340));
    const start = addHours(d0, 7);
    const end = addHours(d0, 15);
    await prisma.shift.create({
      data: {
        employeeId: emp.id,
        startTime: start,
        endTime: end,
        title: rand() < 0.5 ? "Vakttelefon" : "Site visit",
        notes: "[demo]",
      },
    });
  }
  console.log("   ✓ 120 shifts created");

  // ── Notifications ─────────────────────────────────────────────────────────
  console.log("🔔 Creating notifications…");
  const notifTypes: NotificationType[] = [
    NotificationType.LOW_STOCK,
    NotificationType.PO_SUBMITTED,
    NotificationType.PO_APPROVED,
    NotificationType.PO_ORDERED,
    NotificationType.PO_RECEIVED,
    NotificationType.PO_APPROVAL_OVERDUE,
    NotificationType.PROJECT_STARTED,
    NotificationType.PROJECT_COMPLETED,
    NotificationType.DAILY_DIGEST,
    NotificationType.SYSTEM,
  ];
  const notifTitles: Record<NotificationType, string[]> = {
    LOW_STOCK: ["Lav beholdning: NYM 3x2.5", "Påfyll Zaptec", "MCB 16A under minimum"],
    PO_SUBMITTED: ["PO sendt til godkjenning", "Ny bestilling venter"],
    PO_APPROVED: ["PO godkjent", "Innkjøp klar for sending"],
    PO_ORDERED: ["Bestilt fra leverandør", "PO sendt"],
    PO_RECEIVED: ["Varer ankom Svolvær", "Parti mottatt Gravdal"],
    PO_APPROVAL_OVERDUE: ["PO venter for lenge på godkjenning", "Påminnelse: godkjenn bestilling"],
    PROJECT_STARTED: ["Prosjekt startet", "Ny arbeidsordre aktiv"],
    PROJECT_COMPLETED: ["Prosjekt avsluttet", "Sluttført: melding til kunde"],
    DAILY_DIGEST: ["Daglig sammendrag", "Driftsnotat for deg"],
    SYSTEM: ["Kvartalsrapport klar", "Vedlikeholdsnett nattestopp"],
  };
  const notifRecipients = [adminUser.id, managerUser.id];
  for (let n = 0; n < 64; n++) {
    const t = notifTypes[Math.floor(rand() * notifTypes.length)]!;
    const titles = notifTitles[t];
    await prisma.notification.create({
      data: {
        userId: notifRecipients[n % notifRecipients.length]!,
        type: t,
        title: titles[Math.floor(rand() * titles.length)]!,
        message: `[demo seed] Hendelse ${n + 1} — presentasjonsdatasett med realistisk tekst.`,
        isRead: rand() < 0.35,
        createdAt: addDays(demoStart, Math.floor(rand() * 365)),
      },
    });
  }
  console.log("   ✓ 64 notifications (admin + manager innboks)");

  console.log("📜 Creating sample org audit events…");
  await prisma.auditEvent.createMany({
    data: [
      {
        actorUserId: adminUser.id,
        actorEmail: "admin@aqila.no",
        category: AuditEventCategory.SETTINGS,
        action: "demo.exception_thresholds_reviewed",
        targetType: "AppSettings",
        targetId: "default",
        summary:
          "[demo seed] Gjennomgått unntaksgrenser for manager-hub (innkjøp + lav beholdning).",
      },
      {
        actorUserId: managerUser.id,
        actorEmail: "manager@aqila.no",
        category: AuditEventCategory.DATA,
        action: "demo.customer_master_touchpoint",
        targetType: "Customer",
        summary: "[demo seed] Oppdatert kontaktperson hos referansekunde (CRM-sync).",
      },
      {
        actorUserId: adminUser.id,
        actorEmail: "admin@aqila.no",
        category: AuditEventCategory.SECURITY,
        action: "demo.invite_policy_ack",
        targetType: "OrgPolicy",
        summary: "[demo seed] Årlig bekreftelse: invitasjonsrutiner og passordkrav.",
      },
      {
        actorUserId: staffUser.id,
        actorEmail: "staff@aqila.no",
        category: AuditEventCategory.AUTH,
        action: "demo.password_rotation_ok",
        summary: "[demo seed] Passordrotasjon fullført for feltpersonell.",
      },
      {
        actorUserId: managerUser.id,
        actorEmail: "manager@aqila.no",
        category: AuditEventCategory.EXPORT,
        action: "demo.po_csv_ack",
        targetType: "Export",
        summary: "[demo seed] Eksporterte innkjøpsliste (CSV) til økonomi — sporbarhet OK.",
      },
      {
        actorUserId: adminUser.id,
        actorEmail: "admin@aqila.no",
        category: AuditEventCategory.DATA,
        action: "demo.product_catalog_refresh",
        targetType: "Product",
        summary: "[demo seed] Synkronisert katalogpriser mot leverandørliste Q2.",
      },
      {
        actorUserId: managerUser.id,
        actorEmail: "manager@aqila.no",
        category: AuditEventCategory.DATA,
        action: "demo.project_checkpoint",
        targetType: "Project",
        summary: "[demo seed] Milepæl: HMS og materiell kvittert på aktiv arbeidsordre.",
      },
      {
        actorUserId: adminUser.id,
        actorEmail: "admin@aqila.no",
        category: AuditEventCategory.SETTINGS,
        action: "demo.notification_prefs_bulk",
        summary: "[demo seed] Oppdatert standard varslingspreferanser for nye ledere.",
      },
      {
        actorUserId: staffUser.id,
        actorEmail: "staff@aqila.no",
        category: AuditEventCategory.AUTH,
        action: "demo.mfa_ready_status",
        summary: "[demo seed] MFA-klarhet verifisert for terminalbruk på lager.",
      },
      {
        actorUserId: managerUser.id,
        actorEmail: "manager@aqila.no",
        category: AuditEventCategory.DATA,
        action: "demo.attendance_exception_closed",
        targetType: "Attendance",
        summary: "[demo seed] Lukket avviksmelding — dokumentert i HR.",
      },
    ],
  });
  console.log("   ✓ Audit event samples for innstillinger → revisjon");

  // ── Restore presentation stock quantities (chart data is movements; levels are curated)
  console.log("📦 Applying final stock levels for dashboard / low-stock demo…");
  for (const t of stockTargets) {
    await prisma.stock.update({
      where: { productId_locationId: { productId: t.productId, locationId: t.locationId } },
      data: {
        quantity: new Prisma.Decimal(t.quantity),
        reorderPoint: new Prisma.Decimal(t.reorderPoint),
      },
    });
  }

  console.log("\n   Demo credentials (alle med passord Aqila2026!):");
  console.log("   Admin:    admin@aqila.no");
  console.log("   Manager:  manager@aqila.no");
  console.log("   Staff:    staff@aqila.no");
  console.log("   Viewer:   viewer@aqila.no");
  console.log("   Felt:     montør1@aqila.no, montør2@aqila.no, alarm@aqila.no, …");
  console.log("\n✅ Seed complete (~12 months demo data).\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

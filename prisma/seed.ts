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
    prisma.attendance.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.notification.deleteMany(),
  ]);

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
  const units = await Promise.all([
    prisma.unit.upsert({
      where: { name: "Piece" },
      update: { name: "Stykk", symbol: "stk" },
      create: { name: "Stykk", symbol: "stk" },
    }),
    prisma.unit.upsert({
      where: { name: "Metre" },
      update: { name: "Meter", symbol: "m" },
      create: { name: "Meter", symbol: "m" },
    }),
    prisma.unit.upsert({
      where: { name: "Kilogram" },
      update: { name: "Kilogram", symbol: "kg" },
      create: { name: "Kilogram", symbol: "kg" },
    }),
    prisma.unit.upsert({
      where: { name: "Box" },
      update: { name: "Eske", symbol: "esk" },
      create: { name: "Eske", symbol: "esk" },
    }),
    prisma.unit.upsert({
      where: { name: "Roll" },
      update: { name: "Rull", symbol: "rull" },
      create: { name: "Rull", symbol: "rull" },
    }),
    prisma.unit.upsert({
      where: { name: "Set" },
      update: { name: "Sett", symbol: "sett" },
      create: { name: "Sett", symbol: "sett" },
    }),
  ]);
  const [pcs, metre, , box] = units;
  console.log(`   ✓ ${units.length} units created`);

  // ── Categories (norske navn) ──────────────────────────────────────────────
  console.log("🏷️  Creating categories…");
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Cables & Wiring" },
      update: {
        name: "Kabler & kabling",
        description: "Kraftkabler, datakabler, koaks, fiber",
      },
      create: { name: "Kabler & kabling", description: "Kraftkabler, datakabler, koaks, fiber" },
    }),
    prisma.category.upsert({
      where: { name: "Switchgear & Breakers" },
      update: {
        name: "Vern & kurser",
        description: "Automatsikringer, dreiesikringer, jordfeil, kurser",
      },
      create: {
        name: "Vern & kurser",
        description: "Automatsikringer, dreiesikringer, jordfeil, kurser",
      },
    }),
    prisma.category.upsert({
      where: { name: "Conduits & Trunking" },
      update: {
        name: "Rør & kabelrenner",
        description: "Installasjonsrør, stålrørkode, kabelrenner",
      },
      create: {
        name: "Rør & kabelrenner",
        description: "Installasjonsrør, stålrørkode, kabelrenner",
      },
    }),
    prisma.category.upsert({
      where: { name: "EV Chargers" },
      update: {
        name: "Elbilladere",
        description: "Ladestasjoner og tilbehør til elbil",
      },
      create: { name: "Elbilladere", description: "Ladestasjoner og tilbehør til elbil" },
    }),
    prisma.category.upsert({
      where: { name: "Heat Pumps" },
      update: {
        name: "Varmepumper",
        description: "Luft-til-luft, installasjonssett",
      },
      create: { name: "Varmepumper", description: "Luft-til-luft, installasjonssett" },
    }),
    prisma.category.upsert({
      where: { name: "Solar Panels" },
      update: {
        name: "Solceller",
        description: "Moduler, vekselrettere, festesystemer",
      },
      create: { name: "Solceller", description: "Moduler, vekselrettere, festesystemer" },
    }),
    prisma.category.upsert({
      where: { name: "Alarm & Security" },
      update: {
        name: "Brann & sikkerhet",
        description: "Brannalarm, detektorer, sentraler, kamera",
      },
      create: {
        name: "Brann & sikkerhet",
        description: "Brannalarm, detektorer, sentraler, kamera",
      },
    }),
    prisma.category.upsert({
      where: { name: "Lighting" },
      update: {
        name: "Belysning",
        description: "LED-armatur, nødlys, dimmere",
      },
      create: { name: "Belysning", description: "LED-armatur, nødlys, dimmere" },
    }),
    prisma.category.upsert({
      where: { name: "Tools & Equipment" },
      update: {
        name: "Verktøy & måleutstyr",
        description: "Håndverktøy, elverktøy, feltmålere",
      },
      create: { name: "Verktøy & måleutstyr", description: "Håndverktøy, elverktøy, feltmålere" },
    }),
    prisma.category.upsert({
      where: { name: "Consumables" },
      update: {
        name: "Forbruksmateriell",
        description: "Tape, strips, skjøter, festemateriell",
      },
      create: { name: "Forbruksmateriell", description: "Tape, strips, skjøter, festemateriell" },
    }),
  ]);
  const [
    cables,
    switchgear,
    conduits,
    evChargers,
    heatPumps,
    solar,
    alarmCat,
    lighting,
    toolsCat,
    consumables,
  ] = categories;
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

  // ── Users & Employees (before time-series data references users) ─────────
  console.log("👤 Creating users and employees...");
  const passwordHash = await bcrypt.hash("Aqila2026!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@aqila.no" },
    update: { passwordHash },
    create: {
      name: "Lars Erik Flygel",
      email: "admin@aqila.no",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@aqila.no" },
    update: { passwordHash },
    create: {
      name: "Silje Nordvik",
      email: "manager@aqila.no",
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@aqila.no" },
    update: { passwordHash },
    create: {
      name: "Ole Petter Amundsen",
      email: "staff@aqila.no",
      passwordHash,
      role: UserRole.STAFF,
    },
  });

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
      departmentId: departments[5].id,
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
      departmentId: departments[0].id,
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
      departmentId: departments[0].id,
    },
  });

  console.log("   ✓ 3 users and employee profiles created");

  // ── Target stock (kurert for demo: realistiske nivåer per enhet) ───────────
  type StockTarget = {
    productId: string;
    locationId: string;
    quantity: number;
    reorderPoint: number;
  };
  const stockTargets: StockTarget[] = [
    { productId: products[0].id, locationId: svolvær.id, quantity: 2_850, reorderPoint: 600 },
    { productId: products[1].id, locationId: svolvær.id, quantity: 1_920, reorderPoint: 450 },
    { productId: products[2].id, locationId: svolvær.id, quantity: 240, reorderPoint: 80 },
    { productId: products[3].id, locationId: svolvær.id, quantity: 95, reorderPoint: 30 },
    { productId: products[4].id, locationId: svolvær.id, quantity: 14, reorderPoint: 4 },
    { productId: products[5].id, locationId: svolvær.id, quantity: 8, reorderPoint: 2 },
    { productId: products[6].id, locationId: svolvær.id, quantity: 18, reorderPoint: 6 },
    { productId: products[7].id, locationId: svolvær.id, quantity: 4_200, reorderPoint: 900 },
    { productId: products[0].id, locationId: gravdal.id, quantity: 1_680, reorderPoint: 400 },
    { productId: products[2].id, locationId: gravdal.id, quantity: 88, reorderPoint: 28 },
    { productId: products[4].id, locationId: gravdal.id, quantity: 4, reorderPoint: 3 },
    { productId: products[5].id, locationId: gravdal.id, quantity: 2, reorderPoint: 2 },
    { productId: products[8].id, locationId: svolvær.id, quantity: 190, reorderPoint: 40 },
    { productId: products[9].id, locationId: gravdal.id, quantity: 120, reorderPoint: 32 },
    { productId: products[10].id, locationId: røst.id, quantity: 24, reorderPoint: 8 },
    { productId: products[11].id, locationId: ramberg.id, quantity: 4, reorderPoint: 2 },
    { productId: products[12].id, locationId: svolvær.id, quantity: 920, reorderPoint: 220 },
    { productId: products[13].id, locationId: gravdal.id, quantity: 12, reorderPoint: 4 },
    { productId: products[14].id, locationId: svolvær.id, quantity: 9, reorderPoint: 3 },
  ];

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
  for (let i = 0; i < 42; i++) {
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
      const p = products[Math.floor(rand() * Math.min(10, products.length))]!;
      const ordered = poOrderedQty(p.id);
      const price = Number(p.unitPrice);
      total += ordered * price;
      items.push({ productId: p.id, ordered, price });
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
        notes: `[demo] Årsbestilling spor ${i + 1}`,
        createdAt,
        supplierId: rand() < 0.72 ? elektroskandia.id : ahlsell.id,
        locationId: poLocations[Math.floor(rand() * poLocations.length)]!,
        createdById: poCreators[Math.floor(rand() * poCreators.length)]!,
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
      },
    });
  }
  console.log("   ✓ 42 purchase orders created");

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
  for (let i = 0; i < 24; i++) {
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
    await prisma.project.create({
      data: {
        projectCode: `PRJ-DEMO-${(8100 + i).toString()}`,
        name: `${bp.name} (#${i + 1})`,
        description: `[demo] 12-måneders historikk`,
        status,
        startDate: start,
        endDate:
          status === ProjectStatus.COMPLETED
            ? end
            : status === ProjectStatus.IN_PROGRESS
              ? null
              : addDays(start, span),
        clientName: bp.client,
        clientPhone: "76 00 00 00",
        createdAt: addDays(start, -5),
        locationId: loc.id,
        employees: {
          create: [
            {
              employeeId: employees[1]!.id,
              role: "Prosjektleder",
            },
            ...(rand() < 0.6 ? [{ employeeId: employees[2]!.id, role: "Montør" }] : []),
          ],
        },
      },
    });
  }
  console.log("   ✓ 24 projects created");

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
          notes: status !== AttendanceStatus.PRESENT ? "[demo]" : null,
        },
      });
      attendanceCount++;
    }
  }
  console.log(`   ✓ ${attendanceCount} attendance records`);

  // ── Shifts (sample) ───────────────────────────────────────────────────────
  console.log("📅 Creating sample shifts…");
  for (let s = 0; s < 60; s++) {
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
  console.log("   ✓ 60 shifts created");

  // ── Notifications ─────────────────────────────────────────────────────────
  console.log("🔔 Creating notifications…");
  const notifTypes: NotificationType[] = [
    NotificationType.LOW_STOCK,
    NotificationType.PO_APPROVED,
    NotificationType.PO_RECEIVED,
    NotificationType.PROJECT_STARTED,
    NotificationType.PROJECT_COMPLETED,
    NotificationType.SYSTEM,
  ];
  const notifTitles: Record<NotificationType, string[]> = {
    LOW_STOCK: ["Lav beholdning: NYM 3x2.5", "Påfyll Zaptec", "MCB 16A under minimum"],
    PO_APPROVED: ["PO godkjent", "Innkjøp klar for sending"],
    PO_RECEIVED: ["Varer ankom Svolvær", "Parti mottatt Gravdal"],
    PROJECT_STARTED: ["Prosjekt startet", "Ny arbeidsordre aktiv"],
    PROJECT_COMPLETED: ["Prosjekt avsluttet", "Sluttført: melding til kunde"],
    SYSTEM: ["Kvartalsrapport klar", "Vedlikeholdsnett nattestopp"],
  };
  for (let n = 0; n < 48; n++) {
    const t = notifTypes[Math.floor(rand() * notifTypes.length)]!;
    const titles = notifTitles[t];
    await prisma.notification.create({
      data: {
        userId: adminUser.id,
        type: t,
        title: titles[Math.floor(rand() * titles.length)]!,
        message: `[demo] Hendelse ${n + 1} i presentasjonsdatasett.`,
        isRead: rand() < 0.35,
        createdAt: addDays(demoStart, Math.floor(rand() * 365)),
      },
    });
  }
  console.log("   ✓ 48 notifications created");

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

  console.log("\n   Demo credentials:");
  console.log("   Admin:   admin@aqila.no   / Aqila2026!");
  console.log("   Manager: manager@aqila.no / Aqila2026!");
  console.log("   Staff:   staff@aqila.no   / Aqila2026!");
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

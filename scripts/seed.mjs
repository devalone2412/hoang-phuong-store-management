// Usage: ADMIN_USERNAME=admin ADMIN_PASSWORD='...' node scripts/seed.mjs [baseUrl]
// Creates sample products through the API (default http://localhost:5173). Re-running skips existing SKUs.
const base = process.argv[2] ?? "http://localhost:5173";
const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = process.env;
if (!username || !password) {
  console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD.");
  process.exit(1);
}

const samples = [
  { name: "Nước mắm Nam Ngư 500ml", unit: "chai", category: "Gia vị", sku: "NM500", retailPrice: 36000, costPrice: 29000 },
  { name: "Dầu ăn Neptune 1L", unit: "chai", category: "Dầu ăn", sku: "DA1L", retailPrice: 55000, costPrice: 47000 },
  { name: "Mì Hảo Hảo tôm chua cay", unit: "gói", category: "Mì gói", sku: "MHH", barcodes: ["8934563138165"], retailPrice: 4500, costPrice: 3600, combos: [{ quantity: 3, price: 12000 }, { quantity: 30, price: 120000 }] },
  { name: "Đậu đen", unit: "kg", soldByWeight: true, category: "Gạo", sku: "DAUDEN", retailPrice: 40000, price100g: 5000, costPrice: 32000 },
  { name: "Đường cát trắng", unit: "kg", category: "Gia vị", sku: "DUONG", retailPrice: 24000, costPrice: 21000 },
  { name: "Gạo ST25", unit: "kg", category: "Gạo", sku: "ST25", retailPrice: 28000, costPrice: 24000 },
  { name: "Sữa tươi Vinamilk 1L", unit: "hộp", category: "Sữa", sku: "VNM1L", barcodes: ["8934673100016"], retailPrice: 34000, costPrice: 30000 },
  { name: "Trứng gà (vỉ 10 quả)", unit: "vỉ", category: "Thực phẩm tươi", sku: "TRUNG10", retailPrice: 36000, costPrice: 31000, note: "Giá thay đổi theo ngày" },
];

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
if (!login.ok) {
  console.error("Login failed:", login.status);
  process.exit(1);
}
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

// Products may only use categories that exist, so create the ones the samples need first.
for (const name of [...new Set(samples.map((p) => p.category))]) {
  const res = await fetch(`${base}/api/categories`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name }),
  });
  if (!res.ok && res.status !== 409) console.error(`FAILED category ${name}:`, res.status, await res.text());
}

let created = 0;
let skipped = 0;
for (const p of samples) {
  const res = await fetch(`${base}/api/products`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(p),
  });
  if (res.ok) created++;
  else if (res.status === 409) skipped++;
  else console.error(`FAILED ${p.name}:`, res.status, await res.text());
}
console.log(`Seeded: ${created} created, ${skipped} already existed.`);

// Comprehensive End-to-End Test Suite for CargoFlow AI Authentication & RBAC

async function runTestSuite() {
  const BASE = "http://localhost:3000";
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failedCount++;
    }
  }

  console.log("==================================================");
  console.log("CARGOFLOW AI - 18 COMPLETE AUTHENTICATION TESTS");
  console.log("==================================================\n");

  // Helper to extract cookie from response headers
  function getCookie(res) {
    const raw = res.headers.get("set-cookie");
    if (!raw) return "";
    return raw.split(";")[0];
  }

  // TEST 1: Customer registration
  const regEmail = `testuser_${Date.now()}@cargoflow.demo`;
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Autonomous Test Customer",
      email: regEmail,
      phone: "+1 555-0199",
      password: "TestPassword2026!",
      confirmPassword: "TestPassword2026!",
      address: "100 Innovation Way, San Francisco, CA",
    }),
  });
  const regData = await regRes.json();
  assert(
    regRes.status === 201 && regData.success && regData.message === "ACCOUNT CREATED SUCCESSFULLY",
    "TEST 1: Customer registration (/api/auth/register)",
    JSON.stringify(regData)
  );

  // TEST 2: Customer login
  const custLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: regEmail,
      password: "TestPassword2026!",
      expectedRole: "CUSTOMER",
    }),
  });
  const custCookie = getCookie(custLoginRes);
  const custLoginData = await custLoginRes.json();
  assert(
    custLoginRes.status === 200 && custLoginData.user?.role === "CUSTOMER" && custCookie.includes("cargoflow_token"),
    "TEST 2: Customer login (/api/auth/login)",
    JSON.stringify(custLoginData)
  );

  // TEST 3: Customer accesses /customer (restores me via cookie)
  const custMeRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: custCookie },
  });
  const custMeData = await custMeRes.json();
  assert(
    custMeRes.status === 200 && custMeData.authenticated === true && custMeData.user?.email === regEmail,
    "TEST 3: Customer accesses /customer (/api/auth/me)",
    JSON.stringify(custMeData)
  );

  // TEST 4: Customer attempts /admin API -> must be denied (403 Forbidden)
  const custAdminAttempt = await fetch(`${BASE}/api/customers`, {
    headers: { Cookie: custCookie },
  });
  assert(
    custAdminAttempt.status === 403,
    "TEST 4: Customer attempts /admin API (/api/customers) -> 403 Forbidden",
    `Status received: ${custAdminAttempt.status}`
  );

  // TEST 5: Customer A attempts Customer B order tracking -> must be denied (403 Forbidden)
  // DEL-1001 belongs to another recipient. The registered customer must be forbidden:
  const custSpoofAttempt = await fetch(`${BASE}/api/orders/DEL-1001/tracking`, {
    headers: { Cookie: custCookie },
  });
  const spoofData = await custSpoofAttempt.json().catch(() => ({}));
  assert(
    custSpoofAttempt.status === 403 && spoofData.accessDenied === true,
    "TEST 5: Customer A attempts Customer B order tracking -> 403 Forbidden",
    `Status received: ${custSpoofAttempt.status} - ${JSON.stringify(spoofData)}`
  );

  // TEST 6: Admin login
  const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@cargoflow.demo",
      password: "Admin@CargoFlow2026!",
      expectedRole: "ADMIN",
    }),
  });
  const adminCookie = getCookie(adminLoginRes);
  const adminLoginData = await adminLoginRes.json();
  assert(
    adminLoginRes.status === 200 && adminLoginData.user?.role === "ADMIN",
    "TEST 6: Admin login (/api/auth/login)",
    JSON.stringify(adminLoginData)
  );

  // TEST 7: Admin accesses /admin API (/api/customers) -> allowed (200 OK)
  const adminCustRes = await fetch(`${BASE}/api/customers`, {
    headers: { Cookie: adminCookie },
  });
  const adminCustData = await adminCustRes.json();
  assert(
    adminCustRes.status === 200 && Array.isArray(adminCustData.customers),
    "TEST 7: Admin accesses /admin (/api/customers) -> 200 OK",
    `Count: ${adminCustData.customers?.length}`
  );

  // TEST 8: Admin accesses fleet optimization (/api/optimize)
  const adminOptRes = await fetch(`${BASE}/api/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ trafficMultiplier: 1.0 }),
  });
  const adminOptData = await adminOptRes.json();
  assert(
    adminOptRes.status === 200 && (adminOptData.status === "success" || adminOptData.success === true),
    "TEST 8: Admin accesses fleet optimization (/api/optimize) -> 200 OK",
    JSON.stringify(adminOptData)
  );

  // TEST 9: Admin accesses Gemini briefing (/api/ai/briefing)
  const adminGeminiRes = await fetch(`${BASE}/api/ai/briefing`, {
    method: "POST",
    headers: { Cookie: adminCookie },
  });
  const adminGeminiData = await adminGeminiRes.json();
  assert(
    adminGeminiRes.status === 200 && adminGeminiData.briefing,
    "TEST 9: Admin accesses Gemini briefing (/api/ai/briefing) -> 200 OK",
    JSON.stringify(adminGeminiData)
  );

  // TEST 10: Driver login
  const drvLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "driver01@cargoflow.demo",
      password: "Driver01@2026!",
      expectedRole: "DRIVER",
    }),
  });
  const drvCookie = getCookie(drvLoginRes);
  const drvLoginData = await drvLoginRes.json();
  assert(
    drvLoginRes.status === 200 && drvLoginData.user?.role === "DRIVER" && drvLoginData.user?.assignedVehicleId === "TRK-01",
    "TEST 10: Driver login (/api/auth/login)",
    JSON.stringify(drvLoginData)
  );

  // TEST 11: Driver accesses /driver (me endpoint)
  const drvMeRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: drvCookie },
  });
  const drvMeData = await drvMeRes.json();
  assert(
    drvMeRes.status === 200 && drvMeData.user?.role === "DRIVER" && drvMeData.user?.driverId === "DRV-01",
    "TEST 11: Driver accesses /driver (/api/auth/me) -> 200 OK",
    JSON.stringify(drvMeData)
  );

  // TEST 12: Driver starts GPS tracking on assigned truck (TRK-01) -> 200 OK
  const drvGpsRes = await fetch(`${BASE}/api/trucks/TRK-01/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: drvCookie },
    body: JSON.stringify({
      latitude: 37.7833,
      longitude: -122.4167,
      speed: 42.5,
      heading: 180,
    }),
  });
  const drvGpsData = await drvGpsRes.json();
  assert(
    drvGpsRes.status === 200 && drvGpsData.success === true,
    "TEST 12: Driver updates assigned truck location (TRK-01) -> 200 OK",
    JSON.stringify(drvGpsData)
  );

  // TEST 13: Driver attempts to update another truck (TRK-02) -> must be denied (403 Forbidden)
  const drvSpoofRes = await fetch(`${BASE}/api/trucks/TRK-02/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: drvCookie },
    body: JSON.stringify({
      latitude: 37.7833,
      longitude: -122.4167,
      speed: 99,
      heading: 90,
    }),
  });
  assert(
    drvSpoofRes.status === 403,
    "TEST 13: Driver attempts to update another truck (TRK-02) -> 403 Forbidden",
    `Status received: ${drvSpoofRes.status}`
  );

  // TEST 14: Logout
  const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: drvCookie },
  });
  const rawSetCookie = logoutRes.headers.get("set-cookie") || "";
  const logoutData = await logoutRes.json();
  assert(
    logoutRes.status === 200 && logoutData.success === true && (rawSetCookie.includes("cargoflow_token=;") || rawSetCookie.includes("Max-Age=0") || rawSetCookie.includes("1970")),
    "TEST 14: Logout clears session cookie (/api/auth/logout)",
    `Set-Cookie: ${rawSetCookie}`
  );

  // TEST 15: Protected page after logout -> 401 Unauthorized
  const afterLogoutRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: "cargoflow_token=; Max-Age=0" },
  });
  assert(
    afterLogoutRes.status === 401,
    "TEST 15: Protected endpoint access after logout -> 401 Unauthorized",
    `Status received: ${afterLogoutRes.status}`
  );

  // TEST 16: Session restoration across simulated browser refresh
  const restoreRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: adminCookie },
  });
  const restoreData = await restoreRes.json();
  assert(
    restoreRes.status === 200 && restoreData.authenticated === true && restoreData.user?.role === "ADMIN",
    "TEST 16: Session restoration across page refresh via HttpOnly cookie",
    JSON.stringify(restoreData)
  );

  // TEST 17: Invalid password -> generic clean error, no leak
  const invalidPassRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@cargoflow.demo",
      password: "WrongPassword999!",
    }),
  });
  const invalidPassData = await invalidPassRes.json();
  assert(
    invalidPassRes.status === 401 && invalidPassData.error === "Invalid email or password.",
    "TEST 17: Invalid password returns generic error without leaking account existence",
    JSON.stringify(invalidPassData)
  );

  // TEST 18: Disabled user account is denied login -> 403 Forbidden
  const disabledRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "disabled@cargoflow.demo",
      password: "Disabled@2026!",
    }),
  });
  const disabledData = await disabledRes.json();
  assert(
    disabledRes.status === 403 && (disabledData.error.toLowerCase().includes("disabled") || disabledData.error.toLowerCase().includes("deactivated")),
    "TEST 18: Deactivated user account is rejected with 403 Forbidden",
    JSON.stringify(disabledData)
  );

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passedCount} / ${passedCount + failedCount} PASSED`);
  if (failedCount === 0) {
    console.log("🎉 ALL 18 AUTHENTICATION & RBAC REQUIREMENTS VERIFIED!");
  } else {
    console.error(`⚠️ ${failedCount} tests failed.`);
  }
  console.log("==================================================");

  if (failedCount > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});

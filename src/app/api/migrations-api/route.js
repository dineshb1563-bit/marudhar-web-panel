import { NextResponse } from "next/server";
import admin from "../admin";
import fs from "fs";
import path from "path";

// ── JSON files folder ────────────────────────────────────────────────
// Place all files inside:  <project-root>/data/migration/
//   mayaras.json  states.json  districs.json  cities.json  users.json  casts.json
const DATA_DIR = path.join(process.cwd(), "data", "migration");

function loadJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function extractTable(jsonArray, tableName) {
  const table = jsonArray.find(x => x.type === "table" && x.name === tableName);
  return table ? table.data : [];
}

// ── Build lookup maps once and cache in memory ───────────────────────
let _maps = null;

function getMaps() {
  if (_maps) return _maps;

  const stateMap    = Object.fromEntries(extractTable(loadJson("states.json"),   "states")  .map(s => [s.id, s.name.trim()]));
  const districtMap = Object.fromEntries(extractTable(loadJson("districs.json"), "districs").map(d => [d.id, d.name.trim()]));
  const cityMap     = Object.fromEntries(extractTable(loadJson("cities.json"),   "cities")  .map(c => [c.id, c.name.trim()]));
  const castMap     = Object.fromEntries(extractTable(loadJson("casts.json"),    "casts")   .map(c => [c.id, c.name.trim()]));
  const agentMap    = Object.fromEntries(
    extractTable(loadJson("users.json"), "users")
      .filter(u => u.user_type === "2")
      .map(u => [u.id, { name: u.name, phone: u.mobile_number, agentId: u.agentId || null }])
  );

  _maps = { stateMap, districtMap, cityMap, castMap, agentMap };
  return _maps;
}

// ── Age groups (from your Firestore program doc) ─────────────────────
const AGE_GROUPS =[
    {
        "endAge": 10,
        "joinFee": 2100,
        "id": "85bbefb2-7551-41ba-ac3a-e5e2be5d9f86",
        "payAmount": 100,
        "startAge": 5
    },
    {
        "joinFee": 5100,
        "id": "f2500cc9-485d-46b1-b844-113b1b0bb28f",
        "payAmount": 200,
        "startAge": 11,
        "endAge": 15
    },
    {
        "startAge": 16,
        "payAmount": 300,
        "joinFee": 9100,
        "id": "dd98cba2-db50-45e3-bb40-e860c4957462",
        "endAge": 20
    },
    {
        "endAge": 30,
        "startAge": 21,
        "id": "4ca4934f-2397-4fc7-a572-e24914ef73d3",
        "joinFee": 11000,
        "payAmount": 300
    }
]

const LOCATION_GROUP = 
    {
        "location": "All",
        "groupName": "Group1",
        "id": "84ff5b8f-12af-4bfa-b996-fae78da32dd4",
        "groupType": "A"
    }


// ── Helpers ──────────────────────────────────────────────────────────

function generate6DigitRegNo() {
  return "R" + Math.floor(100000 + Math.random() * 900000);
}

// "2003-03-18" → "18-03-2003"
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y}`;
}

/**
 * Returns completed years (birthday-based), same as how people count age.
 * Examples:
 *   DOB 2014-10-01, join 2025-03-15 → 10 years completed → group 5-10 ✓
 *   DOB 2014-10-01, join 2025-10-05 → 11 years completed → group 11-15 ✓
 */
function getCompletedYears(dobStr, joinDateStr) {
  const dob  = new Date(dobStr);
  const join = new Date(joinDateStr || Date.now());

  let years = join.getFullYear() - dob.getFullYear();
  const monthDiff = join.getMonth() - dob.getMonth();

  // Subtract 1 if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && join.getDate() < dob.getDate())) {
    years--;
  }

  return years;
}

/**
 * Match age group using completed years (not decimal).
 * Uses startAge <= completedYears <= endAge so gaps like 5-10 / 11-15
 * never lose a member — age 10y5m = 10 completed years → correctly matches 5-10.
 */
function resolveAgeGroup(dobStr, joinDateStr) {
  const completedYears = getCompletedYears(dobStr, joinDateStr);

  // Sort ascending so first match is always the tightest lower bound
  const sorted = [...AGE_GROUPS].sort((a, b) => a.startAge - b.startAge);

  return sorted.find(g => completedYears >= g.startAge && completedYears <= g.endAge) || null;
}

function mapGender(code) {
  return code === "1" ? "male" : code === "2" ? "female" : "male";
}

function transformMember(row, maps, memberCount, existingRegNos, programId, programName) {
  const { stateMap, districtMap, cityMap, castMap, agentMap } = maps;

  // jati: cast_id → Hindi caste name; fallback to sel_cat
  const jati = (row.cast_id && castMap[row.cast_id]) ? castMap[row.cast_id] : (row.sel_cat || "");

  const displayName = `${row.first_name.trim()} ${(row.last_name || "").trim()}`.trim();
  const agent       = agentMap[row.agent_id] || { name: "Unknown Agent", phone: "", agentId: null };
  const ageGroup    = resolveAgeGroup(row.dob, row.join_date);

  const rawAadhaar         = (row.aadhar_no || "").replace(/[^0-9]/g, "");
  const aadhaarNo          = rawAadhaar.length === 12 ? rawAadhaar : "";
  const rawGuardianAadhaar = (row.varisdar_aadhar_no || "").replace(/[^0-9]/g, "");
  const guardianAadhaarNo  = rawGuardianAadhaar.length === 12 ? rawGuardianAadhaar : "";

  let regNo;
  do { regNo = generate6DigitRegNo(); } while (existingRegNos.has(regNo));
  existingRegNos.add(regNo);

  return {
    displayName,
    fatherName:       row.father_name || "",
    guardian:         row.varisdar || row.father_name || "",
    guardianRelation: row.relation_type || "",
    guardianAadharNo: guardianAadhaarNo,
    gender:           mapGender(row.gender),
    jati,
    gotra:            row.gotra || "",

    phone:    row.mobile_number || "",
    phoneAlt: "",
    aadhaarNo,

    bobDate:  formatDate(row.dob),
    dateJoin: formatDate(row.join_date),

    state:          stateMap[row.state_id]      || "",
    district:       districtMap[row.distric_id] || "",
    village:        cityMap[row.city_id]         || row.address || "",
    currentAddress: row.address || "",
    pinCode:        "",

    programId,
    programName,
    ageGroup:         ageGroup ? ageGroup.id : "",
    ageGroupRange:    ageGroup ? `${ageGroup.startAge}-${ageGroup.endAge}` : "",
    payAmount:        ageGroup ? ageGroup.payAmount : parseInt(row.kist_amount) || 0,
    joinFees:         ageGroup ? ageGroup.joinFee   : 0,
    memberGroup:      LOCATION_GROUP.groupName,
    locationGroup:    LOCATION_GROUP.location,
    locactionGroupId: LOCATION_GROUP.id,

    role:          "member",
    status:        row.status === "1" ? "accepted" : "blocked",
    active_flag:   row.status === "1",
    delete_flag:   false,
    isBlocked:     false,
    marriage_flag: row.shadi_status === "1",
    joinFeesDone:  false,
    joinFeesTxtId: "",

    addedBy:     "agent",
    addedByName: agent.name,
    agentId:     agent.agentId,

    registrationNumber: row.application_number || regNo,
    memberNumber:       memberCount,
    extraDetails:       [],

    createdAt: admin.firestore.Timestamp.fromDate(new Date(row.created_at)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(row.updated_at)),

    sourceSystem:      "migration",
    sourceId:          row.id,
    applicationNumber: row.application_number || "",
  };
}

// ── API Handler ───────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const { action, userUid, programId, programName } = await req.json();
 return NextResponse.json({success: false, error: "action is required"}, { status: 400 });
    
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const maps          = getMaps();
    const vivahjRecords = extractTable(loadJson("vivahs.json"), "vivahs").filter(x=>x.gender==="2");

    // ── preview ────────────────────────────────────────────────────
    if (action === "preview") {
      const existingRegNos = new Set();
      const preview        = [];

      for (const row of vivahjRecords.slice(0, 5)) {
        if (row.formCancelDate) continue;
        preview.push(
          transformMember(row, maps, preview.length + 1, existingRegNos, programId || "PREVIEW", programName || "PREVIEW")
        );
      }

      return NextResponse.json({
        success:          true,
        totalRecords:     vivahjRecords.length,
        cancelledRecords: vivahjRecords.filter(r => r.formCancelDate).length,
        toMigrate:        vivahjRecords.filter(r => !r.formCancelDate).length,
        preview,
      });
    }

    // ── migrate ────────────────────────────────────────────────────
    if (action === "migrate") {
      if (!userUid || !programId) {
        return NextResponse.json({ error: "userUid and programId are required" }, { status: 400 });
      }

      const db                   = admin.firestore();
      const programDocPath       = `users/${userUid}/programs/${programId}`;
      const memberCollectionPath = `${programDocPath}/members`;

      const programSnap = await db.doc(programDocPath).get();
      if (!programSnap.exists) {
        return NextResponse.json({ error: "Program not found. Check userUid and programId." }, { status: 404 });
      }

      const currentMemberCount  = programSnap.data().memberCount || 0;
      const resolvedProgramName = programName || programSnap.data().name;

      const existingRegNos = new Set();
      const members        = [];

      for (const row of vivahjRecords) {
        if (row.formCancelDate) continue;
        members.push(
          transformMember(
            row, maps,
            currentMemberCount + members.length + 1,
            existingRegNos,
            programId,
            resolvedProgramName
          )
        );
      }

      if (members.length === 0) {
        return NextResponse.json({ success: true, inserted: 0, message: "No records to migrate." });
      }

      const BATCH_SIZE = 400;
      let   totalWritten = 0;

      for (let start = 0; start < members.length; start += BATCH_SIZE) {
        const chunk = members.slice(start, start + BATCH_SIZE);
        const batch = db.batch();

        chunk.forEach(member => {
          batch.set(db.collection(memberCollectionPath).doc(), member);
        });

        // Update memberCount on the last batch only
        if (start + BATCH_SIZE >= members.length) {
          batch.update(db.doc(programDocPath), {
            memberCount: currentMemberCount + members.length,
          });
        }

        await batch.commit();
        totalWritten += chunk.length;
      }

      return NextResponse.json({
        success:        true,
        inserted:       totalWritten,
        skipped:        vivahjRecords.length - totalWritten,
        newMemberCount: currentMemberCount + totalWritten,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'migrate' or 'preview'." }, { status: 400 });

  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
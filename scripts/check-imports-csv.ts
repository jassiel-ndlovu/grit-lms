/**
 * Checks the CSV reader and writer used by imports and exports
 * (src/features/imports/csv.ts). Pure; runs in CI.
 *
 *   npx tsx scripts/check-imports-csv.ts
 */

import { mapHeaders, normaliseHeader, parseCsv, parseYesNo, safeCell, splitList, toCsv } from "../src/features/imports/csv";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const comma = parseCsv('﻿Full name,Email,Courses\r\n"Mokoena, Thandi",t@example.com,"Maths; Science"\r\n\r\nSipho,,"Say ""hi"""\n');
check("byte-order mark dropped, headers trimmed", comma.headers, ["Full name", "Email", "Courses"]);
check("quoted comma and quoted list", comma.rows[0], ["Mokoena, Thandi", "t@example.com", "Maths; Science"]);
check("blank line skipped, doubled quotes", comma.rows[1], ["Sipho", "", 'Say "hi"']);
check("comma delimiter", comma.delimiter, ",");

const semi = parseCsv("Name;Email;Minor\nThandi;t@example.com;ja\nSipho;s@example.com\n");
check("semicolon delimiter (South African Excel)", semi.delimiter, ";");
check("short row padded", semi.rows[1], ["Sipho", "s@example.com", ""]);

const multiline = parseCsv('Name,Notes\nThandi,"line one\nline two"\n');
check("line break inside quotes", multiline.rows[0], ["Thandi", "line one\nline two"]);

check("tab delimiter", parseCsv("a\tb\n1\t2").rows[0], ["1", "2"]);
check("header normalised", normaliseHeader("  Parent_EMAIL-address "), "parent email address");

const mapped = mapHeaders(["Learner", "E-mail", "Parent email", "Shoe size"], { name: ["name", "learner"], email: ["email", "e mail"], parent: ["parent email"] });
check("headers mapped by alias", mapped.columns, { name: 0, email: 1, parent: 2 });
check("unknown headers listed", mapped.unknown, ["Shoe size"]);

check("yes/no in English and Afrikaans", ["Yes", "n", "JA", "nee", "maybe", ""].map(parseYesNo), [true, false, true, false, null, null]);
check("list split on ; and |", splitList("Maths; Science | English ;"), ["Maths", "Science", "English"]);
check("formula cells defused", ["=SUM(A1)", "+27", "-1", "@x", "ok"].map(safeCell), ["'=SUM(A1)", "'+27", "'-1", "'@x", "ok"]);

const out = toCsv(["Name", "Notes"], [["Mokoena, Thandi", 'Said "hi"'], ["=cmd", null]]);
check("written with BOM, quoted, defused", out, '﻿Name,Notes\r\n"Mokoena, Thandi","Said ""hi"""\r\n\'=cmd,\r\n');
check("round trip", parseCsv(out).rows, [["Mokoena, Thandi", 'Said "hi"'], ["'=cmd", ""]]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll CSV checks passed.");

import { expandOccurrences, describeRecurrence } from "../src/features/events/lib/recurrence";

const W0 = new Date("2026-01-01T00:00:00");
const W1 = new Date("2027-06-30T23:59:59");

// Format in LOCAL time: the expander works in the server's zone, so
// toISOString() would shift every result by the UTC offset.
function fmt(ds: Date[]) {
  const p = (n: number) => String(n).padStart(2, "0");
  return ds
    .map(
      (d) =>
        `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`,
    )
    .join(", ");
}
function rule(over: Partial<Parameters<typeof expandOccurrences>[1]>) {
  return {
    repeatFrequency: "NONE" as const,
    repeatInterval: 1,
    repeatWeekdays: [],
    repeatUntil: null,
    repeatCount: null,
    ...over,
  } as Parameters<typeof expandOccurrences>[1];
}

let failures = 0;
function check(name: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`        got:  ${got}`);
    console.log(`        want: ${want}`);
  }
}

// 1. one-off
check(
  "NONE yields just the start",
  fmt(expandOccurrences(new Date("2026-03-04T09:00:00"), rule({}), W0, W1)),
  "2026-03-04T09:00",
);

// 2. daily, capped by count
check(
  "DAILY x1, count 5",
  fmt(
    expandOccurrences(
      new Date("2026-03-04T09:00:00"),
      rule({ repeatFrequency: "DAILY", repeatCount: 5 }),
      W0,
      W1,
    ),
  ),
  "2026-03-04T09:00, 2026-03-05T09:00, 2026-03-06T09:00, 2026-03-07T09:00, 2026-03-08T09:00",
);

// 3. weekly on Mon/Wed/Fri, ends on a date. 2026-03-04 is a Wednesday.
check(
  "WEEKLY Mon/Wed/Fri until Mar 16",
  fmt(
    expandOccurrences(
      new Date("2026-03-04T09:00:00"),
      rule({
        repeatFrequency: "WEEKLY",
        repeatWeekdays: [1, 3, 5],
        repeatUntil: new Date("2026-03-16T23:59:59"),
      }),
      W0,
      W1,
    ),
  ),
  "2026-03-04T09:00, 2026-03-06T09:00, 2026-03-09T09:00, 2026-03-11T09:00, 2026-03-13T09:00, 2026-03-16T09:00",
);

// 4. fortnightly, no weekday list -> same weekday as start
check(
  "WEEKLY x2, count 3",
  fmt(
    expandOccurrences(
      new Date("2026-03-04T09:00:00"),
      rule({ repeatFrequency: "WEEKLY", repeatInterval: 2, repeatCount: 3 }),
      W0,
      W1,
    ),
  ),
  "2026-03-04T09:00, 2026-03-18T09:00, 2026-04-01T09:00",
);

// 5. monthly from the 31st -> clamps, then returns to 31
check(
  "MONTHLY from Jan 31, count 6",
  fmt(
    expandOccurrences(
      new Date("2026-01-31T09:00:00"),
      rule({ repeatFrequency: "MONTHLY", repeatCount: 6 }),
      W0,
      W1,
    ),
  ),
  "2026-01-31T09:00, 2026-02-28T09:00, 2026-03-31T09:00, 2026-04-30T09:00, 2026-05-31T09:00, 2026-06-30T09:00",
);

// 6. yearly from Feb 29 (2024 was a leap year)
check(
  "YEARLY from Feb 29 2024, count 3, wide window",
  fmt(
    expandOccurrences(
      new Date("2024-02-29T09:00:00"),
      rule({ repeatFrequency: "YEARLY", repeatCount: 3 }),
      new Date("2024-01-01T00:00:00"),
      new Date("2027-01-01T00:00:00"),
    ),
  ),
  "2024-02-29T09:00, 2025-02-28T09:00, 2026-02-28T09:00",
);

// 7. count is spent by occurrences BEFORE the window
check(
  "count consumed outside the window",
  fmt(
    expandOccurrences(
      new Date("2025-12-29T09:00:00"),
      rule({ repeatFrequency: "DAILY", repeatCount: 4 }),
      W0,
      W1,
    ),
  ),
  "2026-01-01T09:00",
);

// 8. open-ended daily is bounded by the window, not infinite
const openEnded = expandOccurrences(
  new Date("2026-01-01T09:00:00"),
  rule({ repeatFrequency: "DAILY" }),
  W0,
  new Date("2026-01-10T23:59:59"),
);
check("open-ended DAILY bounded by window", String(openEnded.length), "10");

// 9. a series that started before the window still shows later occurrences
check(
  "series starting before the window",
  fmt(
    expandOccurrences(
      new Date("2025-11-05T18:00:00"),
      rule({ repeatFrequency: "MONTHLY" }),
      new Date("2026-01-01T00:00:00"),
      new Date("2026-03-31T23:59:59"),
    ),
  ),
  "2026-01-05T18:00, 2026-02-05T18:00, 2026-03-05T18:00",
);

// 10. descriptions
check("describe: none", String(describeRecurrence(rule({}))), "null");
check(
  "describe: weekly days + until",
  String(
    describeRecurrence(
      rule({
        repeatFrequency: "WEEKLY",
        repeatWeekdays: [1, 3],
        repeatUntil: new Date("2026-06-30T00:00:00"),
      }),
    ),
  ).replace(/until .+$/, "until <date>"),
  "Every week on Mon, Wed, until <date>",
);
check(
  "describe: every 3 months, 4 times",
  String(
    describeRecurrence(
      rule({ repeatFrequency: "MONTHLY", repeatInterval: 3, repeatCount: 4 }),
    ),
  ),
  "Every 3 months, 4 times",
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);

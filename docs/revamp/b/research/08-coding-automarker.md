# Coding automarker (Judge0, Delphi via Free Pascal, judge mode, plagiarism)

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Judge0 CE is still the best fit, but the open-source release is old. The latest is [v1.13.1 from 18 Apr 2024](https://github.com/judge0/judge0/releases), it needs cgroup v1 ([CHANGELOG](https://github.com/judge0/judge0/blob/master/CHANGELOG.md)), and cgroup v1 is gone from [systemd 258](https://linuxiac.com/systemd-258-drops-cgroup-v1-raises-kernel-baseline-to-5-4/). Pin the VM to Ubuntu 22.04. Its standard support ends in [May 2027](https://ubuntu.com/about/release-cycle).
- The stock self-hosted image does not ship the compilers in our plan. It has [FPC 3.0.4, OpenJDK 13.0.1 and GCC 9.2.0](https://raw.githubusercontent.com/judge0/judge0/v1.13.1/db/languages/active.rb). FPC 3.0.4 does not include Delphi's `Generics.Collections` ([FPC wiki](https://wiki.lazarus.freepascal.org/TDictionary)), and there is no Java 17/21. We need a custom image that adds FPC 3.2.x and JDK 21, and runs them through "Multi-file program" (id 89) scripts.
- The three critical 2024 sandbox escapes are fixed in 1.13.1 ([advisories](https://github.com/judge0/judge0/security/advisories)). We must still turn network off, change the default passwords and keep the Judge0 VM away from our data.
- Most CAPS Delphi work is GUI, not console. NSC Paper 1 hands candidates a VCL form to complete ([search summary of NSC papers](https://insideeducation.co.za/wp-content/uploads/2023/10/Information-Technology-P1.pdf), partly unverified). In v1, console Delphi covers algorithm and drill tasks only. Exam-style Delphi stays manually marked.
- For Delphi plagiarism only [MOSS](https://theory.stanford.edu/~aiken/moss/) supports Pascal, and MOSS is for non-commercial use only. JPlag has no Pascal support. Dolos could work through a tree-sitter Pascal grammar but would need engineering. Defer the plagiarism report to v1.1.

## 1. Where the codebase is today

- `TestQuestion.type = CODE` already exists, plus a free-text `language String?` column (`prisma/schema.prisma`, model `TestQuestion`).
- A CODE answer is a plain `<Textarea>` with monospace styling (`src/features/assessments/components/question-renderer.tsx`, `LongText`).
- CODE is "keyable" but never auto-marked. The model answer is stored in `answer` as the memo and ignored by `lib/auto-grade.ts` (comment in `src/features/assessments/lib/answer-key.ts`).
- Uploads go through Vercel Blob with role-gated kinds. `BlobKind.TestAnswer` (50 MB, any content type) and `BlobKind.Submission` (200 MB) already exist (`src/lib/blob/paths.ts`). Source uploads (.pas/.dpr/.java/.cpp/.h/.zip) fit `TestAnswer` with no new kind. Add an extension allow-list on the server.

What has to be built:

- New tables, for example `CodeTestCase` (questionId, stdin, expectedOutput, visible, points, checker, group) and `CodeRun` (submissionId, questionId, mode CHECK/SUBMIT, judge0Tokens, status, per-case results, score).
- A webhook route at `/api/webhooks/judge0`.
- A results panel in the question renderer.
- Wiring the CODE score into `QuestionGrade`, so it reaches the existing gradebook path.

## 2. Judge0 CE facts

### Version, licence, status

| Item | Value | Source |
|---|---|---|
| Latest release | v1.13.1, 18 Apr 2024. No release since. | [Releases](https://github.com/judge0/judge0/releases) |
| Previous | v1.13.0, 10 Mar 2021 | [CHANGELOG](https://github.com/judge0/judge0/blob/master/CHANGELOG.md) |
| Licence | GPL-3.0 | [Repo](https://github.com/judge0/judge0) |
| Popularity | about 4.5k stars, 941 forks | [Repo](https://github.com/judge0/judge0) |
| Telemetry | On by default. Sends the instance ID and version every 12 h. Turn it off with `JUDGE0_TELEMETRY_ENABLE=false`. | [TELEMETRY.md](https://raw.githubusercontent.com/judge0/judge0/master/TELEMETRY.md) |

On the GPL: we only call Judge0 over HTTP and do not distribute it, so GPL-3.0 does not reach our Next.js code (Guess: confirm with Agent A/legal). If we change the Judge0 image and run it only ourselves, that is still not distribution (Guess).

### Install requirements

- Linux only. Ubuntu 22.04 is recommended, with Docker and Docker Compose ([CHANGELOG v1.13.1 deployment](https://github.com/judge0/judge0/blob/master/CHANGELOG.md)).
- You must force cgroup v1 by adding `systemd.unified_cgroup_hierarchy=0` to `GRUB_CMDLINE_LINUX`, then running `update-grub` and rebooting ([CHANGELOG](https://github.com/judge0/judge0/blob/master/CHANGELOG.md)).
- Why this matters: Judge0 bundles an older isolate. [isolate 2.0 (Feb 2024)](https://raw.githubusercontent.com/ioi/isolate/master/NEWS) "runs only on systems supporting CGroup v2", and isolate 1.10.1 is the last v1 version. I found no Judge0 release or merged PR that moves to isolate 2.x (unverified, based on [search results](https://dev.to/nischal_kshaj_f2c1d595ea/internal-error-no-such-file-or-directory-rbsysopen-boxscriptjs-when-using-judge0-api-2la4) and [isolate issue #78](https://github.com/ioi/isolate/issues/78)).
- systemd 257 turned v1 off by default, and [systemd 258 removed it](https://lwn.net/Articles/1028275). So the cgroup v1 workaround only works on distros with systemd 256 or older. Ubuntu 22.04 qualifies. Ubuntu 24.04 ships systemd 255 (unverified), but third-party reports describe failures there ([Hashnode guide](https://hashnode.com/posts/setting-up-ubuntu-and-judge0-on-windows-a-complete-guide-for-developers/680a10836052bf4c451d3453)).
- WSL2 and most PaaS hosts (for example [Railway](https://station.railway.com/questions/judge0-deployment-failing-with-cgroup-an-c536e4d6)) cannot run it. It needs a real VM with GRUB access.
- Recommended resources: none published in the release notes (checked). Guess: 2 vCPU / 4 GB RAM / 40 GB disk handles a class of about 30 students submitting in bursts. The compilers image is several GB (Guess). Input for Agent A: VM sizing and region.
- Long-term risk: Ubuntu 22.04 standard support ends [May 2027](https://ubuntu.com/about/release-cycle). After that we need ESM, a cgroup-v2 fork, or a move to another engine (see section 4).

### Configuration that matters to us (`judge0.conf` defaults)

From [judge0.conf](https://raw.githubusercontent.com/judge0/judge0/master/judge0.conf):

| Setting | Default | Our v1 value (Guess) | Why |
|---|---|---|---|
| `CPU_TIME_LIMIT` / `MAX_CPU_TIME_LIMIT` | 5 / 15 s | 2 / 10 | School tasks are small. Java needs about 1 s of JVM start-up (Guess). |
| `WALL_TIME_LIMIT` | 10 s | 5 | Must be at least 1 s since 1.13.0 ([CHANGELOG](https://github.com/judge0/judge0/blob/master/CHANGELOG.md)) |
| `MEMORY_LIMIT` / `MAX_MEMORY_LIMIT` | 128000 / 512000 KB | 256000 / 512000 | The JVM needs headroom |
| `STACK_LIMIT` | 64000 KB | keep | |
| `MAX_PROCESSES_AND_OR_THREADS` | 60 | keep | The JVM needs threads |
| `ENABLE_NETWORK` / `ALLOW_ENABLE_NETWORK` | false / **true** | false / **false** | The SSRF in CVE-2024-29021 needed network to be allowed ([GHSA-q7vg](https://github.com/judge0/judge0/security/advisories/GHSA-q7vg-26pg-v5hr)) |
| `MAX_QUEUE_SIZE` | 100 | 500 | A class of 30 × 10 cases = 300 jobs |
| `COUNT` (workers) | 2 × nproc | keep | |
| `CALLBACKS_MAX_TRIES` / `CALLBACKS_TIMEOUT` | 3 / 5 s | keep | |
| `ENABLE_BATCHED_SUBMISSIONS` / `MAX_SUBMISSION_BATCH_SIZE` | true / 20 | keep | One batch per student run |
| `ENABLE_WAIT_RESULT` | true | false | Use callbacks. Do not hold Vercel functions open. |
| `AUTHN_TOKEN` / `AUTHZ_TOKEN` | empty (off) | set both | Otherwise anyone who can reach the port can run code |
| `MAX_FILE_SIZE` | 1024 KB | keep | Limits program output files |
| `ENABLE_ADDITIONAL_FILES` | true | true | Needed for id 89 |
| `ENABLE_COMPILER_OPTIONS` | true | true, limited by `ALLOWED_LANGUAGES_FOR_COMPILER_OPTIONS` | We set flags. Students do not. |
| `MAX_EXTRACT_SIZE` | 10240 KB | keep | Zip bomb guard |
| `JUDGE0_TELEMETRY_ENABLE` | true | false | Privacy |

The public docs list different per-submission defaults (cpu 2 s, wall 5 s, memory 128000 KB, max memory 256000 KB) ([API docs](https://ce.judge0.com/)). Those are the hosted instance's settings. Ours come from `judge0.conf`.

### API behaviour we rely on

- **Callbacks.** If `callback_url` is set, Judge0 sends a `PUT` with the submission body ([docs](https://ce.judge0.com/)). The body is always base64-encoded JSON ([isolate_job.rb](https://raw.githubusercontent.com/judge0/judge0/master/app/jobs/isolate_job.rb)). Two catches:
  - Judge0 retries **only on exceptions**. Any HTTP response, even a 500, stops the retries ([isolate_job.rb](https://raw.githubusercontent.com/judge0/judge0/master/app/jobs/isolate_job.rb)). We need a reconciliation job that polls `GET /submissions/batch?tokens=` for runs stuck in "pending" for more than about 60 s (Guess).
  - Callbacks are not signed. Put a per-run HMAC token in the callback URL path (`/api/webhooks/judge0/<runId>/<hmac>`), and accept results only for tokens we issued.
- **Batch.** `POST /submissions/batch` with `{"submissions":[...]}` returns tokens. `GET /submissions/batch?tokens=a,b,c` reads them ([docs](https://ce.judge0.com/)). The batch size limit is 20 by default ([judge0.conf](https://raw.githubusercontent.com/judge0/judge0/master/judge0.conf)).
- **Multi-file program (id 89).** Send no `source_code`. `additional_files` is a base64 `.zip` whose root holds a bash `compile` script (optional) and a `run` script ([docs](https://ce.judge0.com/)). Added in [v1.10.0](https://github.com/judge0/judge0/blob/master/CHANGELOG.md).
- **Status ids.** 3 Accepted, 4 Wrong Answer, 5 TLE, 6 Compilation Error, 7–12 runtime errors, 13 Internal Error ([docs](https://ce.judge0.com/)).
- **Built-in comparison.** Judge0 strips trailing whitespace on each line and at the end, then compares exactly. Leading whitespace and case still count ([isolate_job.rb `strip`](https://raw.githubusercontent.com/judge0/judge0/master/app/jobs/isolate_job.rb)). If `expected_output` is null, the result is always "Accepted". We should send **no** `expected_output` and compare in our own code (section 7), so we can offer case-insensitive and float modes.

### Languages and exact compiler versions

Self-hosted v1.13.1 has 47 language rows ([active.rb at v1.13.1](https://raw.githubusercontent.com/judge0/judge0/v1.13.1/db/languages/active.rb)):

| Our language | Judge0 id | Name | Compile command | Fit |
|---|---|---|---|---|
| Delphi (console) | 67 | Pascal (FPC 3.0.4) | `fpc %s main.pas` | Old. Lacks `Generics.Collections` (section 5). |
| Java | 62 | Java (OpenJDK 13.0.1) | `javac %s Main.java`, run `java Main` | Not 17/21. Class must be `Main`. |
| C++ | 54 | C++ (GCC 9.2.0) | `g++ %s main.cpp` | Supports `-std=c++17` through `compiler_options` |
| Python (optional) | 71 | Python (3.8.1) | `python3 script.py` | End of life |
| Multi-file | 89 | Multi-file program | your `compile` / `run` scripts | Our route for custom toolchains |

The **hosted** ce.judge0.com lists newer rows that are not in the open-source release: [Java (JDK 17.0.6) id 91, C++ (GCC 14.1.0) id 105, Python 3.11–3.14 (ids 92/100/109/113)](https://ce.judge0.com/languages/). Pascal is still FPC 3.0.4 there. So the cloud runs a newer, unreleased image (unverified inference).

**Plan for the custom image.** Base it on `judge0/judge0:1.13.1`. Add `/usr/local/fpc-3.2.2` (or [3.2.4, announced as out](https://www.freepascal.org/_new/docs/download)) and a JDK 21. Call them from id-89 `compile` / `run` scripts that our server generates. No changes to Judge0's DB language table are needed. Guess: 1–2 days of DevOps work. Input for Agent A.

### Security advisories

All three were published 18 Apr 2024, affect versions up to and including 1.13.0, and are fixed in **1.13.1** ([advisories](https://github.com/judge0/judge0/security/advisories), [The Hacker News](https://thehackernews.com/2024/04/sandbox-escape-vulnerabilities-in.html)):

| CVE | GHSA | CVSS | Issue |
|---|---|---|---|
| CVE-2024-28185 | GHSA-h9g2-45c8-89cf | 10.0 | Sandbox escape through a symlink in the sandbox directory ([NVD/Aqua](https://avd.aquasec.com/nvd/2024/cve-2024-28185)) |
| CVE-2024-28189 | GHSA-3xpw-36v7-2cmg | 10.0 | Bypass of the above patch through `chown` on a symlink ([NVD](https://nvd.nist.gov/vuln/detail/CVE-2024-28189)) |
| CVE-2024-29021 | GHSA-q7vg-26pg-v5hr | 9.0–9.1 | SSRF from sandboxed code into Judge0's Postgres when network is allowed, leading to command injection and a host escape through the `privileged` container ([GHSA](https://github.com/judge0/judge0/security/advisories/GHSA-q7vg-26pg-v5hr)) |

The researcher thinks the underlying command-execution issue "might still exist" through other routes ([The Hacker News](https://thehackernews.com/2024/04/sandbox-escape-vulnerabilities-in.html)). Hardening for v1:

1. Use 1.13.1 or later.
2. Set `ALLOW_ENABLE_NETWORK=false`.
3. Use random `POSTGRES_PASSWORD` and `REDIS_PASSWORD` values.
4. Set `AUTHN_TOKEN` and `AUTHZ_TOKEN`.
5. Allow only Vercel egress IPs or a proxy to reach the firewall port (Agent A).
6. Keep the VM single-purpose, with no secrets for our main DB or Blob.
7. Assume a compromise is possible and plan to rebuild the VM from an image.

## 3. Hosted Judge0 (input for Agent A)

| Option | Price | Quota | Source |
|---|---|---|---|
| RapidAPI Basic | $0 | 50 submissions/day, 1,000 req/h | [RapidAPI Extra CE pricing](https://rapidapi.com/ru/judge0-official/api/judge0-extra-ce/pricing) (CE page did not render) |
| Pro | €27/mo | 2,000/day, €0.001 per extra | [judge0.com](https://judge0.com/) |
| Ultra | €54/mo | 5,000/day, €0.001 per extra | [judge0.com](https://judge0.com/) |
| Mega | €107/mo | 10,000/day, €0.001 per extra | [judge0.com](https://judge0.com/) |
| Sulu trial | free | "20K free submissions" | via [search result](https://judge0.com/ce) (unverified) |
| Dedicated Cloud | not shown | not shown | [judge0.com](https://judge0.com/) |

Important: in Judge0 every test case is one "submission". Ten cases × 30 students × 3 checks = 900 per lesson. Hosted CE has Java 17 but only FPC 3.0.4, and it cannot run our custom FPC 3.2 image. Student code also leaves the country (POPIA: Agent A). Hosted is a reasonable dev or fallback option, not the main plan.

## 4. Alternatives

| Option | Licence | Sandbox | cgroup v2 | Pascal | Fit for us |
|---|---|---|---|---|---|
| **Judge0 CE 1.13.1** | GPL-3.0 | isolate (old), Docker | No (v1 only) | FPC 3.0.4 stock | REST API, callbacks, batches. Best fit today. Aging. |
| **Piston** | MIT ([repo](https://github.com/engineer-man/piston)) | isolate in Docker | **Yes, requires v2** | yes (version unverified) | Modern host support. No callbacks or batches; we would build the queue. Public API closed since 15 Feb 2026 ([repo](https://github.com/engineer-man/piston)). |
| **isolate directly** | GPL-2.0+ ([LICENSE](https://raw.githubusercontent.com/ioi/isolate/master/LICENSE)) | itself | Yes, 2.x. Latest 2.7, 24 Aug 2026 ([NEWS](https://raw.githubusercontent.com/ioi/isolate/master/NEWS)). | any binary | Best sandbox. We would write our own queue, worker and API (Guess: 2–3 weeks). |
| **nsjail** | Apache-2.0 ([repo](https://github.com/google/nsjail)) | namespaces + seccomp-bpf | v1 and v2 | any binary | Same build-it-yourself cost as isolate |
| **DMOJ judge-server** | AGPL-3.0 ([repo](https://github.com/DMOJ/judge-server)) | ptrace + seccomp | n/a | yes | Good checkers. Built for the DMOJ site, so we would need a bridge. AGPL. |
| **CMS** | AGPL-3.0 ([repo](https://github.com/cms-dev/cms)) | isolate ≥ 2.0, cgroup v2 ([install docs](https://cms.readthedocs.io/en/latest/Installation.html)) | yes | FPC | A whole IOI contest system, not an API. Overkill. |

Exit path for 2027: a small worker of our own over **isolate 2.x** (or Piston), keeping Judge0's REST shape so the app does not change. Put our code behind a `Runner` interface now (submitBatch, getResults, webhook parse) so the swap is local.

## 5. Delphi through Free Pascal (`-Mdelphi`)

### What Delphi mode does

From the [FPC docs, D.3 Delphi mode](https://www.freepascal.org/docs-html/prog/progse74.html):

- AnsiStrings are on by default (`{$H+}`).
- `Objpas` is loaded, so `Integer` = `Longint`.
- `overload` is required for overloads.
- Implementations may omit forward-declared parameters.
- Address-of is not allowed for procedural variables, and nested comments are not allowed.

### What usually compiles (console)

| Feature | FPC 3.0.4 (stock) | FPC 3.2.x (custom image) | Note |
|---|---|---|---|
| `SysUtils`, `Math`, `StrUtils`, `DateUtils`, `Classes` (`TStringList`) | yes | yes | Standard RTL/FCL units (Guess, based on general FPC knowledge) |
| Classes, records, exceptions, `try..except/finally` | yes | yes | Objpas in Delphi mode |
| Dynamic arrays, `SetLength`, `Length`, `High/Low` | yes | yes | |
| String routines (`Pos`, `Copy`, `Delete`, `Insert`, `UpperCase`, `IntToStr`, `StrToInt`, `FloatToStrF`, `Format`) | yes | yes | (Guess) |
| Text files (`AssignFile`, `Reset`, `Readln`, `CloseFile`) | yes | yes | Files must be included in the zip |
| Generic classes `TMyList<T>` | yes | yes | Delphi-style generic classes have worked since 2.6 ([fpc-devel 2013](https://lists.freepascal.org/fpc-devel/2013-March/031925.html)) |
| `Generics.Collections` (`TList<T>`, `TDictionary`) | **no** (separate package for 3.0.4) | **yes**, in RTL since 3.2 (June 2020) | [FPC wiki TDictionary](https://wiki.lazarus.freepascal.org/TDictionary), [ANN 2018](https://lists.freepascal.org/fpc-pascal/2018-March/053453.html) |
| Generic functions/methods | no ([announcement](https://lists.freepascal.org/pipermail/fpc-announce/2015-November/000595.html)) | yes | |
| Anonymous methods | no | no in 3.2.x (in trunk since 2022) | [FPC article](https://www.freepascal.org/~michael/articles/anonymous/anonymous.pdf), [announcement](https://lists.freepascal.org/fpc-pascal/2022-May/060507.html) |
| Inline `var` declarations (Delphi 10.3+) | no (unverified) | no (unverified) | Test with a real file |

The test fixtures will show the real gaps. Build a small corpus of 20 typical Grade 10–12 console tasks and compile it in CI against the image (Guess).

### What fails, and how to detect it on upload

Free Pascal has no VCL or FMX. Any of these makes the program "GUI, manual marking":

- `uses` contains `Forms`, `Dialogs`, `Graphics`, `Controls`, `StdCtrls`, `ExtCtrls`, `ComCtrls`, `Buttons`, `Spin`, `Grids`, `DBGrids`, `ADODB`, `DB`, `Messages`, `Windows`, or any `Vcl.*`, `FMX.*` or `Winapi.*` unit. Delphi's dotted names (`System.SysUtils`) should be mapped to FPC names (`SysUtils`). FPC 3.2 does not accept dotted RTL unit names (Guess). Our pre-processor can rewrite them.
- The source contains `{$R *.dfm}` or `{$R *.fmx}`, or the zip contains `.dfm`, `.fmx` or `.res` files.
- The `.dpr` body calls `Application.Initialize`, `Application.CreateForm` or `Application.Run`.
- It calls `ShowMessage`, `InputBox`, `MessageDlg`, or uses component-style names (`edtX.Text`, `lblX.Caption`, `memX.Lines`).

A positive signal for console: `{$APPTYPE CONSOLE}` in the `.dpr`. This is Delphi's console flag (Embarcadero docwiki returned 403, so unverified here).

Parsing approach. Strip comments (`//`, `{ }`, `(* *)`) and string literals. Then regex every `uses ... ;` clause and lowercase the names. Run this server-side before calling Judge0. Show the student "This looks like a form (VCL) program. It will be marked by your tutor." A tree-sitter parse is possible later with [tree-sitter-pascal](https://github.com/Isopod/tree-sitter-pascal) (MIT, covers Delphi and FPC dialects).

### `.dpr` vs `.pas`

- A `.dpr` is the program file (`program X; uses ...; begin ... end.`).
- A `.pas` is either a `unit` or, in pasted single-file work, a `program`.
- The id-89 `compile` script runs `fpc -Mdelphi -O2 -FE. <main>`. The main file is the single `.dpr`, or the single `.pas` that starts with `program`. Extra `unit` files sit in the same folder and FPC resolves them through `uses`.
- Reject an upload with zero or more than one main file, and give a clear message.
- Strip `in 'path\Unit.pas'` from `uses` clauses: Windows paths will not resolve on Linux (Guess). Lowercase or case-match filenames too, because Linux is case-sensitive.

### stdin and stdout

- `Readln` / `Writeln` map to stdin/stdout.
- `Eof` with no file means standard input. It may block while waiting for data ([FPC Eof](https://www.freepascal.org/docs-html/rtl/system/eof.html)). Judge0 closes stdin at the end of input, so `while not Eof do` loops end.
- A common school habit is a trailing `Readln;` to keep the console open. On empty stdin it returns at once, so it is harmless.
- `Write` without a newline at the end is fine, because Judge0 strips trailing whitespace and so do we.

### What CAPS Delphi tasks look like

- The DBE "still strongly recommended Delphi" for CAPS IT, and provinces once split between Java and Delphi ([DBE IT tools standardisation plan](https://delphiorg.github.io/assets/images/2016/05/IT-Tools-Standardisation-Implementation-Plan-Delphi.pdf)).
- Grade 10 starts with "components and properties" and events in the Delphi IDE ([WCED lesson](https://www.wcedeportal.co.za/node/194606), [Siyavula Gr10 teacher guide](https://www.siyavula.com/downloads/books/it/IT_teachers_guide_grade10.epub)).
- NSC Paper 1 gives candidates a prepared GUI form with sections per question. Answers go into named components (`edt…`, `lbl…`, `memQ1_5`) and include database and text-file work ([search snippets of the 2019, 2022 and Gr10 papers](https://wcedonline.westerncape.gov.za/documents/ExamPapers%26Memos/NSC-Exams-2022-Nov/non-languages/Information%20Technology/Information%20Technology%20P1%20Nov%202022%20Eng.pdf)). I could not extract the PDF text to count questions, so this is unverified in detail.
- Guess: nearly 100% of formal CAPS Delphi assessment is GUI-form based. Console is mainly a tutor's choice for algorithm drills.

What this means for the product. The "Delphi automarker" in v1 covers tutor-written console drills: sorting, string handling, arrays, text-file parsing through stdin. It does not mark past papers. Marketing must not claim "marks NSC Paper 1". A v2 option is a "logic-only" pattern: tutors write tasks as a unit with functions (`function IsPrime(n: Integer): Boolean`), and we compile it against a hidden console harness that calls them. This tests the logic students would put behind a button click (Guess). See section 6.

## 6. Java and C++ specifics

**Java.**

- Stock Judge0 compiles `Main.java` and runs `java Main` ([active.rb](https://raw.githubusercontent.com/judge0/judge0/v1.13.1/db/languages/active.rb)).
- IDE code often has `package za.school.task1;` and `public class Task1`. Through id 89 we can:
  1. Strip a leading `package` line, or keep it and place the file at the matching path.
  2. Find classes with `public static void main(String[] args)` (regex, after removing comments and strings).
  3. If exactly one is found, compile with `javac -d out $(find . -name '*.java')` and run `java -cp out <fqcn>`.
  4. If none or several are found, ask the student to pick one. Store the choice on the run.
- Inputs with `Scanner(System.in)` work. Swing or JavaFX imports (`javax.swing`, `java.awt`, `javafx`) route to manual marking, the same as Delphi GUI.

**C++.**

- Single file: id 54 with `compiler_options: "-std=c++17 -O2"`.
- Multi-file (`.cpp` + `.h`): id 89 zip with `compile` = `g++ -std=c++17 -O2 -o main *.cpp` and `run` = `./main` ([docs on id 89](https://ce.judge0.com/)). GCC 9.2 supports C++17. For C++20, add a newer GCC in the custom image.
- Reject `#include <windows.h>` and `conio.h` (`getch()`), which is common in school code, with a clear message. Guess: `system("pause")` just fails harmlessly with no shell in the sandbox.

**Zip handling.** Unzip on our side first. Check the size, file count, extensions, and that there is no path traversal. Then rebuild a clean zip for Judge0 with our scripts at the root.

## 7. Output comparison and checkers

Reference points:

| Mode | DMOJ | Kattis default validator | Judge0 built-in |
|---|---|---|---|
| Exact | `identical` (with a "presentation error" hint) | `case_sensitive` + `space_change_sensitive` | none |
| Ignore whitespace | `standard` (default; ignores whitespace differences and blank lines) | default (tokens split on whitespace) | trailing whitespace only |
| Ignore case | `easy` | default is case-**insensitive** | no |
| Float tolerance | `floats` (precision 6, absolute/relative/either) | `float_tolerance`, `float_absolute_tolerance`, `float_relative_tolerance` | no |
| Unordered | `sorted` / `unordered` | — | no |
| Custom | Python `check` returning partial points; testlib/coci bridges | custom output validators | no |

Sources: [DMOJ checkers](https://raw.githubusercontent.com/DMOJ/docs/master/docs/problem_format/custom_checkers.md), [Kattis package format 2025-09](https://www.kattis.com/problem-package-format/spec/2025-09.html), [isolate_job.rb](https://raw.githubusercontent.com/judge0/judge0/master/app/jobs/isolate_job.rb).

v1 proposal. Run the checker in our Next.js webhook as a pure TypeScript function per case. Offer these modes:

- `tokens` (default): split on whitespace, case-sensitive.
- `tokens_ci`: as above, ignoring case.
- `exact_trimmed`: Judge0-like, trailing whitespace stripped.
- `float(abs, rel)`: numeric tokens within tolerance, other tokens exact.
- `lines_unordered`.

Default float tolerance 1e-6, either absolute or relative, as DMOJ and Kattis do. The tutor picks the mode per question. Defer custom checker code (it would itself need sandboxing), interactive problems and special judges.

Show feedback by case visibility:

- Visible (sample) cases: show input, expected output, the student's output and a diff.
- Hidden cases: show only pass/fail per case and the verdict (TLE/RE/WA). This matches IOI-style "limited feedback" ([IOI 2026 rules](https://www.ioi2026.uz/contest-rules)).

## 8. Check vs Submit flow (v1)

1. Student uploads or pastes code. The server validates it (extensions, size, GUI detection, main-file detection) and stores it in Blob under `BlobKind.TestAnswer`.
2. **Check:** runs only visible cases. Rate limit per student per question, for example 1 per 30 s and 30 per hour (Guess). The IOI uses one submission per minute per task and 50 per task ([IOI 2026](https://www.ioi2026.uz/contest-rules)). Results are not graded.
3. **Submit:** runs all cases (visible + hidden). Score = sum of points of passed cases, or of passed groups if all cases in a group pass. A compile error scores 0 and shows the compiler output.
4. Judge0 → PUT `/api/webhooks/judge0/<runId>/<hmac>`. The handler decodes base64, runs the checker, updates `CodeRun`, and writes `QuestionGrade` on Submit. A cron reconciler polls stuck runs.
5. The tutor can override the auto score in the existing grading form (`grading-form.tsx`). GUI-routed answers appear there as "manual".

Server-side code runs through next-safe-action. The webhook is a plain route handler. Vercel function time is not an issue because nothing waits for results.

## 9. Judge mode / contests (Pro, defer to v1.1)

| Style | Score | Penalty | Ranking | Freeze | Source |
|---|---|---|---|---|---|
| ICPC | Problems solved (all or nothing) | Solve minute + 20 min per earlier wrong try. Compile errors carry no penalty. | Solved count, then penalty | Last hour | [ECNA rules](https://icpc-ecna.ysu.edu/rules.html), [HKUST 2025](https://cse.hkust.edu.hk/icpc2025/assets/pdf/guidance.pdf) |
| IOI | Per-subtask score = min over its cases. Final subtask score = max over all submissions. Task score = sum of subtasks. | none; limit 1 per minute, max 50 | Total points | none (live) | [IOI 2026](https://www.ioi2026.uz/contest-rules), [IOI 2020](https://ioi2020.sg/rules) |
| Codeforces | Problem value decays per minute, floor 30% | −50 per wrong try (2024 post); hacks ±100/−50 (old) | Points | n/a | [CF forum topic](https://codeforces.net/topic/135830/diff/en1/en2?locale=ru), [CF blog 456](https://codeforces.com/blog/entry/456) |
| Kattis (IOI-style contests) | Sum of best per test group across submissions | — | Points | per contest | [Kattis rules page](https://pofinal24.kattis.com/contests/axs4xx/rules) |
| DMOJ | Points per case or batch. Batches can depend on others. | — | Points (+ time) | configurable | [DMOJ problem format](https://raw.githubusercontent.com/DMOJ/docs/master/docs/problem_format/problem_format.md) |

Recommendation for the classroom: IOI-style is the default. It gives partial credit, which suits learners, and fits the per-case points model above. ICPC-style is an option for older and competitive students. Freeze is an option ("hide standings in last N minutes"). Never show public rankings of minors by full name by default. Show initials or opt-in nicknames (Agent A, POPIA).

## 10. Plagiarism

| Tool | Licence / terms | Languages relevant to us | Self-host | Delphi? |
|---|---|---|---|---|
| JPlag | GPL-3.0, needs Java SE 25 ([repo](https://github.com/jplag/JPlag)) | Java (mature), C++ (mature), Python (mature), `text` (legacy, "naive") | yes (CLI / JAR) | **No** Pascal module |
| MOSS | Free, **"for non-commercial use"**. Commercial use goes through Similix. Results are public to anyone with the URL and deleted after about 14 days. 100 submissions/day per user. Has had outages. ([MOSS](https://theory.stanford.edu/~aiken/moss/)) | C, C++, Java, Python, **Pascal**, … | no (Stanford service) | **Yes** (Pascal) |
| Dolos | MIT ([repo](https://github.com/dodona-edu/dolos)) | Java, C, C++, Python, … (any tree-sitter grammar) ([languages](https://dolos.ugent.be/about/languages.html)) | yes (npm CLI, Docker, web UI) | Not bundled. Possible with [tree-sitter-pascal](https://github.com/Isopod/tree-sitter-pascal) (MIT, Delphi + FPC dialects). Effort unverified. |

Assessment:

- MOSS is the only tool that covers Delphi out of the box. But a paid Pro tier is commercial use. Results are also public URLs and the code leaves SA, so it is a no for minors' work (Agent A to confirm).
- JPlag is solid for Java and C++, but its GPL-3.0 licence and Java 25 runtime mean a separate service.
- Dolos (MIT, Node-based, tree-sitter) fits our stack best. It covers Java, C++ and Python today, and Delphi after we add the Pascal grammar. Guess: 3–5 days to wire tree-sitter-pascal into a Dolos run and validate it on a corpus.
- Defer the plagiarism report to v1.1 Pro. Start with Java/C++/Python through Dolos, then add Delphi.

## Recommendation

**Pick: self-hosted Judge0 CE 1.13.1 on a dedicated Ubuntu 22.04 VM (cgroup v1), with a custom image that adds FPC 3.2.x and JDK 21, driven through "Multi-file program" (id 89) scripts we generate.**

- Use batch submissions with HMAC-tokened callbacks to `/api/webhooks/judge0`, plus a reconciler.
- Compare output in our own TypeScript checker.
- Wrap it all behind a `Runner` interface.

Why:

- It is the only option that gives us a ready REST API, batches and callbacks today.
- id 89 lets us control compiler versions without forking Judge0.
- The known CVEs are fixed in 1.13.1.

**v1 scope:**

- Console Delphi, Java and C++ (Python optional through id 71 or a custom 3.12).
- Upload or paste.
- Check (visible cases, rate-limited) and Submit (hidden cases, writes `QuestionGrade`).
- Five comparison modes.
- GUI detection routes to manual marking.
- Tutor override.

**Defer:**

- Judge mode with rankings, freeze and ICPC/IOI options (v1.1).
- Plagiarism report through Dolos with tree-sitter-pascal (v1.1).
- Custom checkers and interactive tasks.
- Delphi "logic harness" for form-style tasks.
- In-browser editor.

**Fallback:**

- If the cgroup v1 VM becomes untenable (Ubuntu 22.04 standard support ends May 2027), replace Judge0 behind the `Runner` interface with **Piston** (MIT, cgroup v2) or a thin worker over **isolate 2.x**.
- Hosted Judge0 (€27–€107/mo) is acceptable for development and demos only. It has FPC 3.0.4, sends data offshore, and counts every test case as a submission.

## Open questions for the owner

1. Is console-only Delphi acceptable for v1, given that NSC-style Delphi is GUI-based? Or do you want the "function harness" pattern (tutor defines function signatures) in v1?
2. Which FPC version should we target: 3.2.2 (long-established) or the newly announced 3.2.4? Which Delphi version do your students' schools use (this decides features such as inline `var`)?
3. Java 17 or 21 as the single runtime? Python in v1, yes or no?
4. Is a GPL-3.0 service on our own VM acceptable to you (and to Agent A/legal), given we do not distribute it?
5. Rate limits for Check: per question, per test, or a daily budget per student?
6. Should hidden-case results show input for failed cases after the test closes (learning value), or never (so cases can be reused)?
7. For judge mode with minors: are public leaderboards allowed, or only per-class with nicknames?
8. Is MOSS ruled out for Delphi plagiarism (non-commercial terms, public result URLs)? If yes, do you accept no Delphi plagiarism report until Dolos and Pascal are built?

## Sources

- https://github.com/judge0/judge0/releases (checked 2026-11-16)
- https://github.com/judge0/judge0/blob/master/CHANGELOG.md (checked 2026-11-16)
- https://github.com/judge0/judge0 (checked 2026-11-16)
- https://raw.githubusercontent.com/judge0/judge0/master/judge0.conf (checked 2026-11-16)
- https://raw.githubusercontent.com/judge0/judge0/master/app/jobs/isolate_job.rb (checked 2026-11-16)
- https://raw.githubusercontent.com/judge0/judge0/v1.13.1/db/languages/active.rb (checked 2026-11-16)
- https://raw.githubusercontent.com/judge0/judge0/master/TELEMETRY.md (checked 2026-11-16)
- https://github.com/judge0/judge0/security/advisories (checked 2026-11-16)
- https://github.com/judge0/judge0/security/advisories/GHSA-q7vg-26pg-v5hr (checked 2026-11-16)
- https://ce.judge0.com/ (checked 2026-11-16)
- https://ce.judge0.com/languages/ (checked 2026-11-16)
- https://extra-ce.judge0.com/languages/ (checked 2026-11-16)
- https://judge0.com/ (checked 2026-11-16)
- https://judge0.com/ce (checked 2026-11-16)
- https://rapidapi.com/ru/judge0-official/api/judge0-extra-ce/pricing (checked 2026-11-16)
- https://thehackernews.com/2024/04/sandbox-escape-vulnerabilities-in.html (checked 2026-11-16)
- https://nvd.nist.gov/vuln/detail/CVE-2024-28189 (checked 2026-11-16)
- https://avd.aquasec.com/nvd/2024/cve-2024-28185 (checked 2026-11-16)
- https://linuxiac.com/systemd-258-drops-cgroup-v1-raises-kernel-baseline-to-5-4/ (checked 2026-11-16)
- https://lwn.net/Articles/1028275 (checked 2026-11-16)
- https://ubuntu.com/about/release-cycle (checked 2026-11-16)
- https://github.com/ioi/isolate/issues/78 (checked 2026-11-16)
- https://dev.to/nischal_kshaj_f2c1d595ea/internal-error-no-such-file-or-directory-rbsysopen-boxscriptjs-when-using-judge0-api-2la4 (checked 2026-11-16)
- https://hashnode.com/posts/setting-up-ubuntu-and-judge0-on-windows-a-complete-guide-for-developers/680a10836052bf4c451d3453 (checked 2026-11-16)
- https://station.railway.com/questions/judge0-deployment-failing-with-cgroup-an-c536e4d6 (checked 2026-11-16)
- https://raw.githubusercontent.com/ioi/isolate/master/NEWS (checked 2026-11-16)
- https://raw.githubusercontent.com/ioi/isolate/master/LICENSE (checked 2026-11-16)
- https://github.com/engineer-man/piston (checked 2026-11-16)
- https://github.com/google/nsjail (checked 2026-11-16)
- https://github.com/DMOJ/judge-server (checked 2026-11-16)
- https://github.com/cms-dev/cms (checked 2026-11-16)
- https://cms.readthedocs.io/en/latest/Installation.html (checked 2026-11-16)
- https://www.freepascal.org/docs-html/prog/progse74.html (checked 2026-11-16)
- https://www.freepascal.org/docs-html/rtl/system/eof.html (checked 2026-11-16)
- https://www.freepascal.org/_new/docs/download (checked 2026-11-16)
- https://wiki.lazarus.freepascal.org/TDictionary (checked 2026-11-16)
- https://lists.freepascal.org/fpc-pascal/2018-March/053453.html (checked 2026-11-16)
- https://lists.freepascal.org/pipermail/fpc-announce/2015-November/000595.html (checked 2026-11-16)
- https://lists.freepascal.org/fpc-devel/2013-March/031925.html (checked 2026-11-16)
- https://www.freepascal.org/~michael/articles/anonymous/anonymous.pdf (checked 2026-11-16)
- https://lists.freepascal.org/fpc-pascal/2022-May/060507.html (checked 2026-11-16)
- https://github.com/Isopod/tree-sitter-pascal (checked 2026-11-16)
- https://delphiorg.github.io/assets/images/2016/05/IT-Tools-Standardisation-Implementation-Plan-Delphi.pdf (checked 2026-11-16)
- https://www.wcedeportal.co.za/node/194606 (checked 2026-11-16)
- https://www.siyavula.com/downloads/books/it/IT_teachers_guide_grade10.epub (checked 2026-11-16)
- https://wcedonline.westerncape.gov.za/documents/ExamPapers%26Memos/NSC-Exams-2022-Nov/non-languages/Information%20Technology/Information%20Technology%20P1%20Nov%202022%20Eng.pdf (checked 2026-11-16)
- https://insideeducation.co.za/wp-content/uploads/2023/10/Information-Technology-P1.pdf (checked 2026-11-16)
- https://raw.githubusercontent.com/DMOJ/docs/master/docs/problem_format/custom_checkers.md (checked 2026-11-16)
- https://raw.githubusercontent.com/DMOJ/docs/master/docs/problem_format/problem_format.md (checked 2026-11-16)
- https://www.kattis.com/problem-package-format/spec/2025-09.html (checked 2026-11-16)
- https://pofinal24.kattis.com/contests/axs4xx/rules (checked 2026-11-16)
- https://icpc-ecna.ysu.edu/rules.html (checked 2026-11-16)
- https://cse.hkust.edu.hk/icpc2025/assets/pdf/guidance.pdf (checked 2026-11-16)
- https://www.ioi2026.uz/contest-rules (checked 2026-11-16)
- https://ioi2020.sg/rules (checked 2026-11-16)
- https://codeforces.net/topic/135830/diff/en1/en2?locale=ru (checked 2026-11-16)
- https://codeforces.com/blog/entry/456 (checked 2026-11-16)
- https://github.com/jplag/JPlag (checked 2026-11-16)
- https://theory.stanford.edu/~aiken/moss/ (checked 2026-11-16)
- https://github.com/dodona-edu/dolos (checked 2026-11-16)
- https://dolos.ugent.be/about/languages.html (checked 2026-11-16)

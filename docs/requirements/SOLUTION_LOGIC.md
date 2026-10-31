# DealSync — Solution Logic (step-by-step)

> Converted from `DealSync_Solution_Logic.docx`. The .docx is the source of truth.

> **Step-by-Step Logic of the Flow**
>
> **Step 1: Connect Data**

1.  Problems resolved: Data is scattered

    1.  Users upload all of the files (apps, servers, network and
        licences, user accounts, moving employees, cost per system, and
        the SPA and TSA schedule)

    2.  AI matches column names:

        1.  Every team names columns differently. AI reads only the
            headers and the first 3 rows of each file and matches each
            column to a "Standard Name" (like app_name) basis our
            glossary.

        2.  It compares the header words and sample values with our
            standard list. Since fixed rules cannot catch all way people
            name a column. The user confirms any low confidence match.

    3.  Mark broken links: Each file has an ID that points to another
        file. If the app points to a server that does not exist, it is
        marked as a broken link.

    4.  Personal data hidden at upload: Names and emails in the identity
        and HR files are replaced with counts and roles, so no personal
        data is stored. The deal only needs to know how many people need
        access and where. It doesn’t need their names, so we don’t keep
        them, and privacy rules are respected.

    5.  We get a single merged dataset, where every file comes in the
        same format with broken links marked.

> **Step 2: Clean and Map**

2.  Problems resolved: Missing, duplicate and out of date data; Hidden
    links across systems; Clean network data

    1.  Filling gaps in merged data

        1.  First copy from linked files if any linkages are visible (if
            an app's site is blank, copy the site of the server it runs
            on). Then AI fills simple descriptive fields like owner team
            or vendor.

        2.  AI looks at the record and its linked records, and suggests
            a value with a reason only if there is a clear clue,
            otherwise it says "unknown".

        3.  Duplicates: Exact copies are found by the same ID or the
            same name. AI then spots look-alike pairs such as "Payments
            Server 1" and "SRV-PAY-01". How: it compares name, site and
            owner and gives a confidence score with a reason. The user
            clicks merge, and the more complete record is kept after
            copying missing details.

    2.  Out of date data:

        1.  Anything not updated in the last 6 months is marked stale.
            Apps with 0 users, servers with no app, and licences for an
            app that does not exist are also flagged. The owner confirms
            "still in use" or "retired", and retired items are not
            moved.

        2.  Data Hygiene Score: Each file gets a score out of 100. 90+
            is green, and only green data moves forward.

        3.  Owner queue: Every item still left goes to an owner with a
            name and a deadline. If it is overdue, it is escalated to
            the engagement manager.

    3.  Finding hidden links

        1.  The cleaned data already shows links (app runs on server,
            server uses network, licence belongs to app), and these are
            drawn on one map.

        2.  AI suggests hidden links by reading app names, functions and
            descriptions and suggests links nobody recorded. How: it
            looks for business sense, for example "Order Processing
            probably sends data to Finance, because orders need to be
            billed". Why AI: these links are not in any file, but are
            often obvious from what the apps do. Each suggestion comes
            with a reason, and the user clicks confirm or reject.

        3.  Owner questionnaire: Each app owner answers 3 questions in
            the app: which systems does your app send data to or get
            data from, does it use anything owned by the seller, and
            what breaks if it is switched off.

        4.  Tags and score: Every link is tagged buyer owned, shared or
            seller owned (seller and shared shown in red). Each app gets
            an Entanglement Score (buyer link 1, shared 2, seller 3): 0
            to 3 low, 4 to 8 medium, 9+ high.

        5.  Move groups: Apps that run on the same server or send data
            to each other are put in one group, so they move together
            and nothing breaks.

        6.  If a link is still unclear: It is treated as seller owned
            and kept running under the TSA. Before cutting it, the team
            does a trial run: AI drafts a short test checklist, the team
            switches off the link in a test, and anything that breaks
            are added to the map.

> **Step 3: Classify Items**

3.  Problems resolved: One missing tool can stop the business; Revenue
    gets blocked; Five buckets for every app

    1.  12 deal components: Every item is tagged to one component
        (applications, infrastructure, network, laptops and email,
        identity and security, people, licences, engineering tools,
        revenue systems, finance, sites, TSA services). Most come from
        the file type; for apps, AI suggests the component from the
        app's name and function, and the user confirms.

    2.  Day-1 Priority Index: Each item gets 4 scores from 1 to 5:
        Criticality (C), Dependency on the seller (D), Regulatory
        risk (R) and Security risk (S). D comes automatically from the
        Entanglement Score; C, R and S come from the owner. Priority
        Index = 0.35C + 0.25D + 0.20R + 0.20S.

    3.  Special flags: Items marked "critical tool" (like Rioja's
        engineering tools) or "revenue-linked" (like products stuck in
        Solution Central) are always Day-1 critical, whatever their
        score.

> AI suggests one of 6 buckets for each app: AI reads whether the app is
> Day-1 critical, whether the buyer uses it, its Entanglement Score, its
> age, whether its licence can be transferred, the owner's answers and
> the days left to Day-1.

- How: it follows simple rules:

  - Transfer as-is (nothing shared with the seller)

  - Clone and Go (Day-1 critical, shared, and can legally be copied)

  - Commercial agreement / TSA (Day-1 critical but too tangled or not
    enough time)

  - Stand-up new (old or cannot be copied, and not needed on Day-1)

  - Consolidate (the buyer already has a similar system)

  - Extract and Sunset (the buyer does not use it).

  - Why AI: it weighs many facts at once and explains its choice. The
    reason states the facts used, for example "TSA: Finance ERP is Day-1
    critical, score 11, only 12 days to Day-1". The user confirms or
    changes it.

> **Step 4: Deciding on who pays for what**

4.  Problems resolved: Arguments over costs; Options for leaders with
    trade-offs; Clear split of who pays

    1.  Once items have been classified decisions for who pays can be
        provided by giving options for leaders: where ranking is done
        basis 5 being best for cost

        1.  For a big choice (like how to move staff laptops), up to 3
            options are rated-\> Full rebuild first, Move in Phases,
            Move now & secure later. The rating is of 1 to 5 on
            security, productivity, cost and speed. Any option with
            security below 3 is removed first. The rest are scored
            (security 35%, productivity 30%, cost 20%, speed 15%) and
            the highest is recommended.

    2.  AI writes the board summary: AI turns the scores into a 4-line
        note for the board, explaining the trade-off in plain words. Why
        AI: it saves time writing. The numbers come from the formula, so
        AI explains the choice but does not make it.

    3.  Cost split: Who pays for what is decided basis:

        1.  Who caused it (seller 1, shared 0.5, buyer 0)

        2.  Is it like-for-like or an upgrade (1, 0.5, 0)

        3.  What the contract says (1, 0.5, 0). Seller share = 0.4 x
            cause + 0.4 x like-for-like + 0.2 x contract. The app shows
            what the seller and buyer each pay.

> AI reads the SPA clause: The user pastes the cost-sharing clause from
> the SPA. AI suggests the "contract" answer and quotes the line it is
> based on. Why AI: legal text is long and hard to read. The user
> confirms.
>
> Disputed lines and wave plan: Any line still disputed is sent to the
> Funding Layer (Step 10). Move groups are placed in waves based on
> their timing (detailed in Step 7).
>
> **Step 5: Track and Score**

5.  Problems resolved: Too much to track; No clear Day-1 status

    1.  The company now knows what to do with every system.

        1.  One task tracker: Each team works on one single tracker for
            a workstream. Everyone edits the same table instead of
            separate sheets.

    2.  Progress by workstream: Each workstream shows a progress bar, so
        it is easy to see which team is behind.

    3.  Early warning: A rule flags tasks that are likely to slip (due
        within 5 days and not started, or blocked). AI then writes the
        reason and a suggested next step, for example "3 of 5 licence
        tasks not started and due in 4 days, escalate vendor consent
        today". Why AI: it turns a list of red flags into a clear
        action.

> **Step 6: Day-1 Readiness Score**

6.  Problems resolved: No clear Day-1 status; One missing tool; Revenue
    blocked; Automated dashboards

    1.  Item readiness: For each Day-1 critical item: 50% tasks done +
        30% tests passed + 20% data hygiene.

    2.  One score: Item readiness is rolled up by component (weighted by
        how much each can stop the business) into one score out of 100.

    3.  Signal: 90+ is Go, 80 to 89 is Go with conditions, below 80 is
        No-go.

> Blocker rule: If any critical tool or revenue-linked item is blocked,
> the score is capped at 79 (No-go), however good the rest looks.
>
> Drill-down: Leaders can click the score to see exactly which items and
> numbers are behind it. This one dashboard replaces the separate
> trackers.
>
> **Step 7: TSA Exit and Waves**

7.  Problems resolved: Revenue gets blocked; Product priority list and
    step-by-step plans

    1.  TSA tracker with exit date, monthly fee & owner: Every service
        in the TSA schedule is listed with its exit date, monthly fee
        and owner.

    2.  Burn-down: Every two weeks, services exited are compared with
        the plan. If the team is behind, the service is flagged as an
        extension risk.

    3.  Product priority list: Products linked to stuck systems are
        ranked by revenue and country, so the biggest blocked revenue is
        unlocked first.

    4.  Waves: Move groups go in order: Wave 0 Day-1 critical, Wave 1
        security, Wave 2 most tangled, Wave 3 revenue systems, Wave 4
        consolidate and save cost. A wave cannot start until its data is
        green (90+).

> Step-by-step plan: Each wave gets the 12-step roadmap as a checklist.
>
> **Step 8: Close and Learn**

8.  Problems resolved: Client data cannot be freely reused; AI deal
    knowledge hub

    1.  Capture lessons: When the deal closes, the team answers 5
        questions: what worked, what did not, was Day-1 on time, was the
        TSA extended, and the key lesson.

    2.  AI writes the Learning Record and hides client details: AI
        replaces client and people names with codes and turns exact
        numbers into ranges (415 apps becomes "200+ apps"). How: it is
        given the list of names to hide and the rounding rules. Why AI:
        the notes are free text, and AI can rewrite them safely and
        quickly.

> Human check: A data steward reviews the record before it is saved.
>
> Consent: A record is only saved if the client agreed to anonymised
> reuse in the contract.
>
> **Step 9: Firm Knowledge and Deal Copilot**

9.  Problems resolved: Work is redone on every deal; Step-by-step plans;
    AI deal knowledge hub

    1.  Framework library: PwC's methods are saved in one place: the 6
        buckets, the 12-step roadmap, the options method, the cost split
        rule and TSA exit tips.

    2.  Past deal cards: Saved Learning Records become cards. A new deal
        is matched to the most similar past deals by industry, deal type
        and size.

    3.  The Copilot (chatbot): On every question, the app sends AI three
        things: an instruction (answer only from the information given
        and name your source), the framework library and matching past
        deal cards, and the live dashboard numbers (score, blockers,
        hygiene). Why this way: the answer is about this deal right now,
        not a generic answer.

    4.  Two ways to use it: Live metrics ("Why are we No-go? What moves
        us to 90?") and frameworks ("Which framework fits this stage?
        How do we settle the cost dispute?"). It can also draft board
        updates.

> Safety: If the answer is not in the information given, it says "I
> don't know". The copilot never changes data; the consultant decides,
> and every override is logged.
>
> Model: The copilot runs on a small Google model (SLM) through our
> Gemini API key. In production, Gemini would generate training examples
> and a small model would be trained on them and hosted inside PwC.
>
> **Step 10: Funding Layer (Banks)**

10. Problems resolved: Arguments over costs (when the split is still
    disputed)

    1.  The Three Funding options:

        1.  For any disputed amount from Step 4, the app shows three
            options:

            1.  Escrow (a bank holds the money until both sides agree)

            2.  A bridge loan (with an EMI calculator)

            3.  Leasing the equipment and licences.

    2.  Who can afford it: Each company's financial health (debt,
        profit, cash) from Prowess shows who can absorb the cost and who
        needs a loan.

    3.  Products by segment: Simple product ideas for the acquirer
        (separation loan), the seller (separation cost facility, escrow)
        and smaller firms (small-ticket financing).

> Consent: Data is shared with a bank only with the client's consent.
>
> **Step 11: Insights Out (Marketing)**

11. Problems resolved: Case question on marketing and outreach (beyond
    our problem list)

    1.  Benchmarks: Anonymised past deals show patterns, such as the
        share of deals where Day-1 was on time, by industry.

    2.  Board scorecards: The Day-1 Readiness Score becomes a simple
        scorecard PwC can show client boards.

> Prospect list: Prowess data (many business segments, a loss-making
> segment, high debt) helps spot companies likely to sell a business, so
> PwC can reach out early.

**Worked Example: DealSync on Project Rioja**

**The deal:** ChipCo (buyer) is taking over a chip design business from
SemiCorp (seller). The business runs across 3 sites with 27 systems, and
Day-1 is 15 Nov. All company names and most numbers are illustrative;
the 27 systems, 300+ activities, 8 workstreams and \$1.74M gap come from
the case.

**Step 1: Connect Data**

- **Files uploaded:** SemiCorp’s teams send separate files: apps,
  servers, network, licences, user accounts, moving employees, costs,
  plus the SPA and TSA schedule.

- **AI matches column names:** The app file says “Application Title” and
  “Hosted On”. AI matches them to app_name and hosting_server_id (it can
  tell “Hosted On” means a server because the values look like
  “SRV-14”). The user confirms.

- **Broken link found:** Order Tracker says it runs on SRV-99, but no
  SRV-99 exists in the servers file, so it is flagged.

- **Personal data hidden:** The HR file’s names and emails are replaced
  with “Design engineer, Pune: 2”.

- **Result:** One connected dataset. For example: CircuitDesign Pro runs
  on SRV-14 (seller-owned), uses network NET-3 (shared), needs licence
  L-07 (transfer unknown), has 120 users and costs \$90K a year.

**Step 2: Clean and Map**

- **Gaps filled:** CircuitDesign Pro’s blank site is copied from its
  server (Pune). AI suggests WaferTest Suite’s vendor from its linked
  licence, and the user accepts.

- **Duplicate merged:** AI spots that “Payments Server 1” and
  “SRV-PAY-01” are the same server (same site, similar name). The user
  merges them.

- **Stale records:** The Old Fax Server (0 users, not updated in 2
  years) is confirmed retired and won’t be moved.

- **Hygiene score:** The apps file rises from 72 (red) to 92 (green).

- **Owner queue:** “Can licence L-07 be transferred?” goes to the
  procurement lead, due 5 Nov.

- **Hidden links found:** AI suggests Order Tracker sends data to
  Finance ERP and CircuitDesign Pro saves files to DesignVault. The
  owner questionnaire confirms CircuitDesign Pro also uses the seller’s
  licence server.

- **Entanglement Score:** CircuitDesign Pro scores 12 (High), so it is
  heavily tied to SemiCorp.

- **Move group:** CircuitDesign Pro, DesignVault and WaferTest Suite
  must move together.

- **Unclear link:** SpecViewer’s owner is “not sure”, so it is treated
  as seller-owned and kept under the TSA. A trial run reveals a hidden
  link to a seller file server, which is added to the map.

**Step 3: Classify Items**

- **Components:** AI labels CircuitDesign Pro as “Engineering tools” and
  Order Tracker as “Revenue systems”.

- **Priority Index:**

| **App**           | **C** | **D** | **R** | **S** | **Score** | **Timing**                                              |
|-------------------|-------|-------|-------|-------|-----------|---------------------------------------------------------|
| CircuitDesign Pro | 5     | 5     | 2     | 3     | 4.00      | Day-1 critical                                          |
| Finance ERP       | 4     | 4     | 4     | 3     | 3.80      | Day-1 critical                                          |
| Order Tracker     | 3     | 2     | 1     | 2     | 2.15      | Post-TSA, but flagged revenue-linked, so Day-1 critical |

- **Buckets suggested by AI:**

  - CircuitDesign Pro: **Clone and Go** (“needed on Day-1 and the
    licence can transfer”)

  - Finance ERP: **TSA** (“too tangled to separate in 12 days”)

  - Order Tracker: **Clone and Go**

  - Marketing Dashboard: **Consolidate**

  - Old Fax Server: **Extract and Sunset**

  - HR Portal: **Transfer as-is**

**Step 4: Decide**

- **Options for leaders (moving 340 laptops):** Option C (move now,
  secure later) fails the security check. Option B (move in phases)
  scores 3.65 against Option A’s 3.05, so B is recommended. AI writes
  the 4-line board note.

- **Cost split (\$1.74M):** AI reads the SPA clause (“separation costs
  shared equally; buyer pays for enhancements”) and quotes it.

| **Cost line**                     | **Amount**  | **Seller pays** | **ChipCo pays** |
|-----------------------------------|-------------|-----------------|-----------------|
| Moving licences to ChipCo         | \$600K      | \$540K          | \$60K           |
| Copies of engineering equipment   | \$700K      | \$490K          | \$210K          |
| Faster equipment ChipCo asked for | \$440K      | \$0             | \$440K          |
| **Total**                         | **\$1.74M** | **\$1.03M**     | **\$0.71M**     |

- **Dispute:** SemiCorp disputes the \$700K equipment line, so it goes
  to the funding layer.

**Step 5: Track and Score**

- **One tracker:** 300+ tasks across 8 workstreams sit in one table.

- **Progress:** The licences workstream is at 70%, behind every other
  team.

- **Early warning (3 Nov):** Vendor consent from EDA Corp is blocked. AI
  writes: “3 of 5 licence tasks are waiting on vendor consent for a
  Day-1 critical design tool. Escalate through ChipCo’s CIO today.”

**Step 6: Day-1 Readiness Score**

- **Item readiness:** CircuitDesign Pro 63%, Order Tracker 99%, Finance
  ERP 93%, laptops 94%.

- **Score:** The calculated score is 86, but CircuitDesign Pro (a
  critical tool) is blocked, so it’s **capped at 79: No-go**.

- **Drill-down:** The board clicks through and sees the blocker: vendor
  consent, owned by the procurement lead, due 6 Nov.

- **After the fix:** Consent arrives on 6 Nov and the remaining tasks
  and tests are completed. The score rises to **96: Go**.

**Step 7: TSA Exit and Waves**

- **TSA tracker:** After Day-1, ChipCo pays SemiCorp \$90K a month for 4
  services (licence server, email, network, Finance ERP).

- **Burn-down:** On 15 Jan, email is behind plan, so it’s flagged as an
  extension risk (\$25K a month).

- **Product priority:** Timing chip T-200 in the USA (\$4M a quarter
  blocked) is registered first.

- **Waves:** Wave 0 Group 1 and Order Tracker; Wave 1 logins and
  laptops; Wave 2 Finance ERP; Wave 3 customer portal; Wave 4 Marketing
  Dashboard and Legacy Reporting Tool.

- **Data gate:** Finance ERP’s data scores 85, so Wave 2 waits until it
  reaches 90.

**Step 8: Close and Learn**

- **Lessons captured:** The team answers 5 questions at close.

- **AI anonymises:** ChipCo, SemiCorp, EDA Corp and Priya become codes,
  and \$1.74M becomes “\$1M to \$2M”.

- **Learning Record SEMI-07:** “Semiconductor carve-out, 20 to 50 apps.
  Key lesson: request licence consent from design tool vendors in week
  1.”

- **Checks:** The data steward removes one detail that could still
  identify the client. ChipCo’s engagement letter allows anonymised
  reuse, so the record is saved.

**Step 9: Firm Knowledge and Deal Copilot**

- **Past deal match:** At the start of Rioja, SEMI-03 matched at 95% and
  warned about licence delays.

- **Copilot (3 Nov):**

  - Q: “Why are we No-go?” A: “The score is capped at 79 because
    CircuitDesign Pro’s vendor consent is blocked. *(Source: live
    dashboard)*”

  - Q: “What moves us to 90?” A: “Get vendor consent and finish
    CircuitDesign Pro’s 4 remaining tasks; the score rises to about 96.
    *(Source: readiness formula)*”

  - Q: “What will EDA Corp charge?” A: “I don’t know; this isn’t in the
    deal data.”

**Step 10: Funding Layer**

- **Who can afford it (Prowess):** ChipCo’s cash is tight after the
  purchase; SemiCorp has plenty.

- **Funding:** ChipCo takes a bridge loan of \$700K (about \$61,500 a
  month for 12 months), and SemiCorp’s disputed \$490K is held in
  escrow.

- **Result:** The equipment arrives before Day-1, and the dispute is
  settled later.

- **Consent:** The bank sees only the readiness score, cost split and
  financial summary.

**Step 11: Insights Out**

- **Benchmark:** Across 20 past deals, those that asked for licence
  consent in week 1 hit Day-1 on time 90% of the time, against 50% for
  those that asked late.

- **Scorecard:** Rioja’s one-page readiness scorecard becomes a sample
  for pitches.

- **Prospect list:** Alpha Industries (6 segments, a loss-making
  electronics unit, high debt) scores 8 and goes to the top of the
  outreach list.

**Step 12: Controls Across All Steps**

- Only needed data is kept, personal data is hidden, and each user sees
  only their own deal.

- Deal data goes only to approved AI services; every AI suggestion is
  approved by a person.

- Raw data is deleted after the deal, and lessons are kept only with
  client consent.

**Summary:** On Rioja, DealSync turned scattered files into one clean
dataset, found the hidden links that could have stopped chip design, and
showed the board a No-go two weeks early because of a single blocked
licence. That gave the team time to fix it and reach a Go of 96. Bank
funding kept a \$700K dispute from delaying Day-1, the TSA exit was
tracked month by month, and the deal’s lessons were saved safely to help
the next semiconductor deal and to win new clients.

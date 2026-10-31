# Business Requirements Document — DealSync

> Text extracted from `BRD_Final.pdf` for easy reference by people and AI agents. The PDF is the source of truth.

```text
Business Requirements Document


Objectives:

   1.​ Turn scattered, messy client IT data into one deal-ready baseline within days​
       Apps, servers, networks, licences, people and contract files arrive from different teams in
       different formats. DealSync merges them into one standard dataset, fixes gaps,
       duplicates and stale records, and scores each file, so no decision is taken on data
       scoring below 90.
   2.​ Make sure nothing stops the business on Day-1​
       Every hidden dependency on the seller is found, every item is ranked by urgency, and
       critical tools and revenue systems are always flagged. All of this rolls into one live Day-1
       Readiness Score with a Go or No-go, so leaders know days ahead, not on the day,
       whether design, orders and reporting will keep running.
   3.​ Stop cost disputes and tough trade-offs from delaying the deal​
       Boards get scored options with a security check built in, costs like Rioja’s $1.74M are
       split line by line using one clear rule backed by the SPA, and any amount still disputed is
       funded by a bank through escrow, a bridge loan or a lease. The deal moves forward
       while the argument is settled separately.
   4.​ Cut the buyer’s dependence on the seller as fast and cheaply as possible after
       Day-1​
       Every TSA service is tracked against its exit date and monthly cost, the most valuable
       blocked products are unlocked first, and systems move in a fixed order of waves only
       when their data is ready. This avoids costly TSA extensions and lost revenue.
   5.​ Give every consultant the judgement of the firm’s best deal teams​
        One shared tracker and dashboard replace separate sheets and status decks, and an
       AI copilot reads the live deal numbers and PwC’s own methods to explain what is going
       wrong and what to do next. Consultants spend less time on reporting and more on
       decisions, while a person still makes every call.
   6.​ Make every deal improve the next one without exposing any client​
        At close, each deal becomes an anonymised, human-approved lesson, kept only with
       client consent and under strict access and deletion rules. These lessons speed up future
       deals, and the anonymised patterns become benchmarks and scorecards that help PwC
       win new clients.



Key Stakeholders:

   1.​ Buyer’s leadership​
       The client leaders, including the CIO, CFO and CISO, who own the deal and make the
      Day-1 Go or No-go call. They rely on DealSync’s Readiness Score, blockers and scoring
      options to approve decisions, and they see only their own deal.
  2.​ Seller’s IT team​
      They hold most of the original data and keep TSA services running after Day-1. Their
      data, answers on hidden links and help with exit dates decide how quickly the buyer
      becomes independent.
  3.​ PwC engagement team (Consultants)​
      The partner, manager and consultants who run DealSync on the deal. They clean the
      data, review AI suggestions, use the copilot and own every recommendation given to the
      client.
  4.​ PwC (Company)​
      With these frameworks scaled across the firm, while Risk, Legal and Privacy make sure
      client data is used only with consent and under strict rules. Together, they decide where
      DealSync is rolled out and how lessons can be safely reused.
  5.​ Banks​
      They fund cost gaps like Rioja’s $1.74M through escrow, bridge loans or leases, using
      the readiness score and cost split shared with client consent.



Scope

  ●​ Deals covered: Carve-outs, acquisitions, divestitures and mergers run by PwC’s
     Corporate Deals Technology practice.
  ●​ Deal stages: From pre-deal data collection through Day-1 and the TSA period to final
     TSA exit.
  ●​ What it covers: All IT parts of a deal: apps, servers, networks, licences, user access,
     moving employees, costs and TSA services.
  ●​ Users: PwC deal teams (full access), client leaders (read-only view of their own deal)
     and banks (only what the client approves).
  ●​ Internal use: Reusing anonymised lessons across PwC and using benchmarks for
     marketing.
  ●​ Prototype: Built in Google AI Studio with Gemini, using sample data.



Expected Outcomes

  1.​ Decisions are made on data everyone trusts​
       Teams stop arguing over whose spreadsheet is right. Every file is merged, cleaned and
      scored, so the board, PwC and the seller all work from the same version of the facts.
  2.​ Day-1 happens without surprises​
       Critical tools, revenue systems and hidden links to the seller are found weeks in
      advance. The board sees exactly what is blocking Day-1 and who owns it, and the
      business keeps designing, selling and reporting from the first day.
   3.​ Money and trade-offs no longer hold the deal back​
        Cost disputes are settled line by line with clear reasons, leaders choose between
       options in one meeting instead of several, and any amount still in dispute is funded by a
       bank so work continues.
   4.​ The buyer stands on its own sooner and at lower cost​
        TSA services are exited on schedule, extra months of seller fees are avoided, and the
       most valuable blocked products start earning again first.
   5.​ Consultants spend their time solving problems, not building reports​
        One tracker and one dashboard replace scattered sheets and status decks, and the
       copilot gives quick, sourced answers. Even a junior consultant can work with the method
       and judgement of an experienced team.
   6.​ Every deal makes PwC better at the next one​
        Lessons from each deal are saved safely and matched to new deals, so teams start with
       proven methods instead of a blank page, and client confidentiality is never put at risk.



Success Criteria

   1.​ Data is clean before it’s used​
       Every data file reaches a hygiene score of 90 or above before it feeds any decision, and
       every gap left over has a named owner and a deadline.
   2.​ No business stops on Day-1​
       Zero Day-1 failures of critical tools or revenue systems on pilot deals, and no failure
       caused by a hidden link that wasn’t on the map.
   3.​ Readiness is known early​
       The Day-1 Readiness Score is updated every day, and the board has a clear Go or
       No-go at least two weeks before Day-1.
   4.​ Decisions and disputes are settled faster​
       Board decisions are closed 25% faster than before, every cost line is split with a written
       reason, and 100% of the funding needed, including disputed amounts, is in place before
       Day-1.
   5.​ The buyer exits the TSA on time​
       No TSA service is extended because of late tracking, and the products with the highest
       blocked revenue are unlocked first.
   6.​ Less time is spent on reporting​
       Time spent building status reports drops by 30%, and all tasks sit in one shared tracker
       instead of separate sheets.
   7.​ Consultants trust and use the copilot​
       At least 85% of copilot answers are rated correct on a test set of 200 deal questions,
       every answer names its source, and at least 70% of pilot consultants use it every week.
   8.​ Knowledge is reused safely​
       A Learning Record is saved for 100% of closed deals where the client gave consent, at
       least 80% of new deals start with matched past lessons, and there are zero data leaks or
       access breaches.
Functional Requirements (Specific Features & Actions)

   ●​ Data intake and cleaning
          ○​ Upload all deal files, match column names with AI, flag broken links and hide
             personal data.
          ○​ Fill gaps (rules first, then AI), merge duplicates, flag stale records and score each
             file, blocking anything below 90.
          ○​ Send unresolved items to an owner queue with a deadline.
   ●​ Dependency map
          ○​ Map all links, suggest hidden ones with AI, and confirm them through an owner
             questionnaire.
          ○​ Tag links as buyer, shared or seller, calculate an Entanglement Score and form
             move groups.
   ●​ Classification
          ○​ Tag items to 12 components, calculate the Priority Index and timing, and always
             treat critical tools and revenue items as Day-1 critical.
          ○​ Suggest one of 6 buckets per app with a reason, which the user can change.
   ●​ Decisions and cost split
          ○​ Score options after a security check, with an AI-written board summary.
          ○​ Split costs using the 3-question rule, read SPA clauses with AI, and send
             disputed amounts to funding.
   ●​ Tracking and Day-1 readiness
          ○​ Keep all tasks in one tracker, show workstream progress, and flag at-risk tasks
             with an AI-written next step.
          ○​ Calculate one Day-1 Readiness Score (Go / Conditions / No-go), cap it at 79 if a
             critical item is blocked, and allow drill-down.
   ●​ TSA exit and waves
          ○​ Track TSA services against exit dates and fees, flag extension risks, rank
             blocked products by revenue, and release waves only when data is green.
   ●​ Funding
          ○​ Show escrow, bridge loan and lease options using Prowess financial health,
             shared with banks only after client consent.
   ●​ Close and learn
          ○​ Capture closing lessons, create an anonymised Learning Record with AI, and
             save it only after human approval and client consent.
   ●​ Deal Copilot
          ○​ Answer questions using live dashboard numbers, PwC frameworks and past
             deals, cite a source or say “I don’t know”, never change data, and log overrides.
   ●​ Insights and marketing
          ○​ Show anonymised benchmarks, create board scorecards, and rank likely future
             clients using Prowess.

Non-Functional Requirements (How well system must work)
   ●​ Security: Secure login with role-based access, so each user sees only their own deal
      and only what their role needs.
   ●​ Privacy and compliance: Personal data is hidden at upload, raw client data is deleted
      after the deal, and data protection laws (DPDP Act, GDPR) and contract terms are
      followed.
   ●​ Approved AI only: Deal data goes only to approved AI services that do not keep it or
      train on it.
   ●​ Accuracy: At least 85% of copilot answers are correct, every answer names its source,
      and it says “I don’t know” when unsure.
   ●​ Explainability: Every score can be traced back to its formula and the items behind it.
   ●​ Human control: AI only suggests; a person approves every decision, and all changes
      and overrides are logged.
   ●​ Speed: Pages load in under 3 seconds and the copilot replies in under 5 seconds.
   ●​ Reliability: The platform is available 99.5% of the time, and more during the weeks
      around Day-1.
   ●​ Ease of use: A new consultant can use it after a 2-hour walkthrough, on a laptop or
      tablet.
   ●​ Scalability: It handles many deals at once, from small deals to large ones like Phoenix
      (400+ apps, 35,000+ records).
   ●​ Easy to update: Scoring weights, thresholds and frameworks can be changed without
      rebuilding the app.



Solution: AI Workflow




   1)​ Current Problems: External
          a)​ Data is Scattered & Messy:
                 i)​ App, network and asset details sit in many different systems that don’t talk
                     to each other.
                ii)​ Plus data records are missing, duplicated or out of date, like Phoenix’s
                     35,000+ incomplete network records.
          b)​ Hidden Links across systems:
                 i)​ Nobody fully knows which apps depend on which servers or seller
                     systems, so things break on Day-1.
          c)​ No clear Day 1 status:
                 i)​ Leaders can’t see at a glance whether the deal is ready for Day-1 or what
                     is blocking it.
                ii)​ One missing tool can stop the business from operating normally
               iii)​ Stuck systems can cause revenue to get blocked
          d)​ Arguments over costs:
                 i)​ Buyer and seller argue over costs, like Rioja’s $1.74M equipment and
                     licence gap.
          e)​ Too much to track:
                 i)​ Hundreds of apps, tasks & assets are tracked in separate sheets

   2)​ Current Problems: Internal
          a)​ Work is redone on every deal
          b)​ Client data cannot be freely reused
          c)​ Scale the PwC solutions firmwide
                  i)​ Giving options to leaders with tradeoffs such as security vs staff
                      productivity
                 ii)​ Product priority list & Step by Step plans for what to do & in what order
                iii)​ Five buckets for every app
               iv)​ Clean network data & fix PwC’s record gaps
                 v)​ Clearing split of who pays
               vi)​ Automated dashboards
               vii)​ AI deal knowledge hub

Complete solution & example in other file
```

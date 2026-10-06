# Pricing

How Verityio is priced, why, and the alternatives that were weighed.
Prices live in `lib/billing/plans.ts` (single source of truth); the page is
`/pricing` (public) and `/premium` (in the app).

Researched October 2026. Competitor prices come from public pricing pages
and comparison sites (sources at the end); cost figures are estimates and
are labelled as such -- revisit them once real usage data exists.

## Customer segments

| Segment | Who | What they pay for | Willingness to pay |
|---|---|---|---|
| Hourly / shift workers | Retail, food service, warehouse, healthcare aides, often 2+ jobs | Proof of hours and pay (disputes, missing overtime), knowing what the next paycheque will be | Low. A few dollars a month is roughly 10-20 minutes of their wage; price-sensitive, monthly billing preferred |
| Gig and contract workers | Delivery, rideshare, trades, freelancers | Earnings by job, expenses and mileage for taxes, exports for an accountant | Medium. Already pay $5-8/month for Gridwise/Everlance-type tools when it saves tax money |
| Money-conscious workers | Either of the above who budget | Spending against hours worked, bank sync, insights | Medium-high: budgeting apps sell at $95-109/year |
| Crews / small employers (future) | A lead with 3-15 people | Everyone's hours in one place | Per-seat; Deputy $5-9/user, Homebase per location |

The core promise -- an accurate record of your own work -- must stay free:
the people who most need proof of their hours can least afford a paywall,
and the free record is what makes the paid insights valuable.

## Competitor pricing (USD, 2026)

| Product | Category | Free tier | Paid |
|---|---|---|---|
| Clockify | Time tracking | Yes (now capped at 5 users) | from $3.99/user/mo, up to $14.99 |
| My Hours | Time tracking | Yes | $4 / $8 per user/mo |
| Toggl Track | Time tracking | Limited | $9 - $18 per user/mo |
| Harvest | Time tracking | Limited | $11 - $14 per user/mo |
| Gridwise | Gig earnings + mileage | Yes | $4.99 - $7.99/mo |
| Everlance | Mileage + expenses | 30 trips/mo | $8 - $20/mo |
| Hurdlr | Gig income/expenses | Manual only | $10 - $16.99/mo |
| Stride | Mileage | Fully free | -- |
| Monarch Money | Budgeting + bank sync | No | $99.99/yr |
| YNAB | Budgeting | No | $109/yr |
| Copilot Money | Budgeting + bank sync | No | $95/yr or $13/mo |
| Rocket Money | Budgeting | Yes | Premium+ $15/mo |
| Deputy | Team scheduling/time clock | No | $5 - $9/user/mo |
| Homebase | Team time clock | 1 location, 10 staff | from $24.95/location/mo |

Takeaways: single-user worker tools cluster at **$4-8/month**; anything with
**bank sync** sits at **$8-15/month or ~$100/year**; team tools charge
**$4-9 per seat**.

## Unit costs (estimates, per paying user per month)

| Cost | Estimate | Notes |
|---|---|---|
| Stripe fees | 2.9% + $0.30 per charge | The fixed $0.30 punishes low monthly prices: 13% of $2.99, 9% of $4.99, 6% of $9.99, ~3.5% of an annual plan |
| Plaid (bank sync) | ~$0.30 - $1.50 per connected account | Plaid quotes per-product rates in the production application; assume $1.00 |
| AI assistant (Claude) | ~$0.02 - $0.06 per question | Assume $1.50 typical; needs a fair-use cap |
| Receipt scan (Claude) | ~$0.01 - $0.03 per receipt | Assume $0.40 (about 20 scans) |
| Supabase + Vercel | ~$0.05 | Marginal per user at small scale |

## Strategies considered

### A. One Premium tier, cheap ($3.99/mo or $34.99/yr)

Free + a single Premium that includes everything (bank sync, AI, reports).

- Gross margin: about 16% monthly and slightly negative annually once
  bank sync and AI are used (~$2.95 of variable cost against $2.92-3.99 of
  revenue). The previous $2.99 / $29.99 price was already under water.
- Simple to explain, but every subscriber carries the most expensive
  features' costs, and there's no upgrade path.
- LTV of roughly $5 leaves no room for any paid acquisition.
- **Rejected**: it loses money on the users who use it most.

### B. Good / Better / Best -- Free, Plus $4.99, Pro $9.99 (chosen)

| | Free | Plus | Pro |
|---|---|---|---|
| Monthly | $0 | $4.99 | $9.99 |
| Yearly | $0 | $39.99 ($3.33/mo, save 33%) | $79.99 ($6.67/mo, save 33%) |
| For | Recording your work | Proof, exports and budgeting | Automatic money tracking |

- **Free**: unlimited time tracking, breaks, jobs, overtime (weekly and
  daily), pay and tax estimates, pay periods, expenses with receipt
  photos, mileage, journal, calendar, reminders, reports for any period
  up to 3 months long (with drill-downs), and a full data export.
- **Plus**: reports for any range (up to 2 years), pie and line charts,
  PDF and CSV exports, budget and spending insights, and receipt scanning
  when it's switched on. Its variable costs are small, so its margin is
  high (~82% monthly, ~83% yearly).
- **Pro**: everything in Plus, plus bank connections and the AI
  assistant -- the two features with real per-user costs. Margin is ~65%
  monthly and ~55% yearly at typical usage, which is why the AI needs a
  fair-use cap.
- Price points sit in each segment's existing range: Plus next to
  Gridwise / Clockify / My Hours; Pro well under Copilot, Monarch and
  YNAB while doing hours *and* money.
- Pro is the anchor that makes Plus look like the sensible choice
  (decoy effect), and the most popular card is the one in the middle.
- Estimated LTV (55% choose yearly, ~14-month average life):
  Plus ≈ $47, Pro ≈ $69. That supports a blended CAC ceiling of about
  $16-23 at 3:1, which means organic-first growth (search for "hours
  calculator", "overtime calculator", "pay stub check", worker communities,
  referrals) rather than paid social, where consumer-finance CAC is
  usually far higher.

### C. One paid tier, trial-first ($7.99/mo or $59.99/yr, 14-day trial)

- Hard-paywall and trial-first apps convert better at day 35 (RevenueCat
  2026: ~10.7% vs ~2.1% for freemium), but annual retention is almost the
  same (27% vs 28%), and a $7.99 floor shuts out the hourly workers who
  only want exports.
- Gross margin ~56% monthly and ~38% yearly, because everyone carries the
  bank and AI costs.
- **Rejected** for now; a trial is borrowed instead (see below).

### D. Team (later): ~$4 per user per month, minimum 3 seats

Undercuts Deputy ($5+/user with a $30 minimum) and per-location Homebase
for small crews. **Not offered yet** -- Verityio has no team features, so
the pricing page only mentions that team plans are coming.

## Conversion choices on the pricing page

- Prices are always visible, signed in or not (`/pricing` is public).
- **Yearly is selected by default** with the saving shown; monthly is one
  tap away. Annual plans retain far better and halve Stripe's fee share.
- Plus is highlighted as **Most popular**; the yearly price is also shown
  as a monthly equivalent.
- **7-day free trial** on a first subscription (card collected by Stripe
  Checkout; cancel before day 7 and nothing is charged). Most trial
  decisions happen in the first days, so 7 days is enough to try exports
  and reports.
- "Your records are always free", "Cancel anytime", "Secure payments by
  Stripe" and "Export your data anytime" sit next to the buttons to answer
  the usual objections.
- A short side-by-side comparison and an FAQ (trial, cancelling, what
  happens to data on downgrade, currency).
- **Pro shows "Coming soon" and can't be bought** until at least one of
  its features is live (`isProAvailable()`: the AI assistant has its key,
  or bank linking is configured against Plaid production). Selling a
  feature that only works with test banks would be misleading.

## Existing subscribers

None at launch (October 2026). Legacy "Premium" prices
(`verityio_premium_*` lookup keys) map to Pro if any ever appear, so
nobody loses a feature they paid for.

## What to measure next

Free-to-trial rate, trial-to-paid rate, monthly vs yearly mix, month-1
and month-12 retention per tier, AI questions per Pro user (to tune the
cap), Plaid accounts per Pro user, and refund/dispute rate. Revisit
prices after ~200 paying users.

## Sources

- [Kimai: time-tracking SaaS price comparison 2026](https://www.kimai.org/blog/2025/price-comparison)
- [Costbench: time tracking software pricing 2026](https://costbench.com/software/time-tracking/)
- [Capterra: My Hours pricing 2026](https://capterra.com/p/149427/My-Hours/pricing/)
- [Gridwise vs Everlance vs Stride](https://gridwise.io/blog/gridwise-vs-everlance-vs-stride)
- [Gerald: mileage tracking app subscription costs](https://joingerald.com/learn/work--income/mileage-tracking-apps-subscription-costs)
- [Budget apps ranked 2026 (YNAB, Rocket Money, Monarch, Copilot)](https://unstar.app/blog/ynab-rocket-money-monarch-everydollar-copilot-budget-apps-ranked-2026)
- [Costbench: Connecteam vs Deputy pricing 2026](https://www.costbench.com/compare/connecteam-vs-deputy/)
- [Homebase vs Deputy](https://www.joinhomebase.com/compare/homebase-vs-deputy)
- [Plaid pricing plans (support)](https://support.plaid.com/hc/en-us/articles/16110502116887)
- [Fintegration: Plaid pricing guide](https://www.fintegrationfs.com/post/how-much-does-a-plaid-subscription-cost-a-guide-to-plaid-pricing)
- [RevenueCat: State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [Stripe pricing](https://stripe.com/pricing)

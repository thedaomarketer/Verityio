import { redirect } from "next/navigation";
import { CircleAlert, Info, Landmark, Lightbulb, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";

import { requireUserContext } from "@/lib/data/context";
import { getEntitlement } from "@/lib/data/subscription";
import { getBudgetData } from "@/lib/data/budget";
import { isPlaidConfigured } from "@/lib/bank/plaid";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { dollarsToCents, formatCents, SPENDING_CATEGORIES, type BudgetInsight, type SpendingCategory } from "@/lib/calculations";
import { formatMinutesAsHours, formatShortDate } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/charts/donut-chart";
import { LineChart } from "@/components/charts/line-chart";
import { PremiumUpsell } from "@/components/premium/premium-upsell";
import { ConnectBankButton } from "@/components/budget/connect-bank-button";
import { DisconnectBankButton, RefreshBanksButton } from "@/components/budget/bank-actions";
import { cn } from "@/lib/utils";
import { Amount, AmountsToggle } from "@/components/privacy/amounts-visibility";

/** Fixed category -> color mapping (never re-assigned by rank); "other" is neutral gray. */
const CATEGORY_COLORS: Record<SpendingCategory, string> = {
  housing: "var(--chart-1)",
  groceries: "var(--chart-2)",
  dining: "var(--chart-3)",
  transport: "var(--chart-4)",
  shopping: "var(--chart-5)",
  bills: "var(--chart-6)",
  health: "var(--chart-7)",
  entertainment: "var(--chart-8)",
  other: "var(--muted-foreground)",
};

function insightText(
  insight: BudgetInsight,
  m: Messages,
  money: (cents: number) => string,
  hours: (minutes: number) => string
): string {
  const t = m.budget.insights;
  const category = (c: SpendingCategory) => m.budget.categories[c];
  switch (insight.kind) {
    case "kept":
      return fmt(t.kept, { percent: insight.percent, amount: money(insight.keptCents) });
    case "overspent":
      return fmt(t.overspent, { amount: money(insight.overCents) });
    case "workHours":
      return fmt(t.workHours, { hours: hours(insight.minutes) });
    case "topCategory":
      return insight.minutes !== null
        ? fmt(t.topCategoryHours, { category: category(insight.category), amount: money(insight.spentCents), hours: hours(insight.minutes) })
        : fmt(t.topCategory, { category: category(insight.category), amount: money(insight.spentCents) });
    case "categoryUp":
      return fmt(t.categoryUp, { category: category(insight.category), percent: insight.percent, amount: money(insight.deltaCents) });
    case "categoryDown":
      return fmt(t.categoryDown, { category: category(insight.category), percent: insight.percent, amount: money(insight.deltaCents) });
    case "pace":
      return fmt(t.pace, { spend: money(insight.projectedSpendCents), earned: money(insight.projectedEarnedCents) });
  }
}

const INSIGHT_ICON = { kept: TrendingUp, overspent: CircleAlert, workHours: Lightbulb, topCategory: Lightbulb, categoryUp: TrendingUp, categoryDown: TrendingDown, pace: Info };

function BudgetBar({ label, actual, target, money }: { label: string; actual: number; target: number; money: (c: number) => string }) {
  const over = actual > target;
  const percent = target > 0 ? Math.min(100, Math.round((actual * 100) / target)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {money(actual)} / {money(target)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={actual}
        aria-valuetext={`${money(actual)} / ${money(target)}`}
      >
        <div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default async function BudgetPage() {
  const [ctx, { locale, intl, m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const heading = (
    <div>
      <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.budget.title}</h1>
      <p className="text-sm text-muted-foreground">{m.budget.subtitle}</p>
    </div>
  );

  const { premium } = await getEntitlement(ctx.userId);
  if (!premium) {
    return (
      <div className="space-y-6">
        {heading}
        <PremiumUpsell feature="budget" />
      </div>
    );
  }

  const data = await getBudgetData(ctx);
  const bankConfigured = isPlaidConfigured();
  const moneyFormat = { kind: "money" as const, currency: ctx.currency, intl };
  const money = (cents: number) => formatCents(cents, ctx.currency, intl);
  const hours = (minutes: number) => formatMinutesAsHours(minutes, locale);
  const kept = data.earnedCents - data.spentCents;
  // Split the sentence around its amount so the amount alone can be masked.
  const [spentSubBefore, spentSubAfter = ""] = fmt(m.budget.spentSub, { days: data.dayOfMonth, amount: "\u0000" }).split("\u0000");

  const donutData = SPENDING_CATEGORIES.map((category) => ({
    key: category,
    label: m.budget.categories[category],
    value: data.byCategory[category],
    color: CATEGORY_COLORS[category],
  }));
  const trendData = data.trend.map((point) => ({
    label: formatShortDate(`${point.date}T12:00:00Z`, "UTC", intl),
    values: { thisMonth: point.thisMonth, lastMonth: point.lastMonth },
  }));

  return (
    <div className="space-y-6">
      {heading}

      <section className="hero-surface overflow-hidden rounded-3xl p-5 shadow-[0_18px_40px_-18px_rgb(10_30_80/0.55)] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium text-white/75">{m.budget.spentThisMonth}</h2>
          <AmountsToggle tone="dark" className="-mt-2.5 -mr-2" />
        </div>
        <p className="mt-1 text-[40px] leading-none font-bold tracking-tight tabular-nums md:text-5xl">
          <Amount value={money(data.spentCents)} />
        </p>
        <p className="mt-1.5 text-xs text-white/70">
          {spentSubBefore}
          <Amount value={money(data.lastMonthToDateCents)} />
          {spentSubAfter}
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
          <div className="min-w-0">
            <dt className="truncate text-xs text-white/70">{m.budget.earned}</dt>
            <dd className="mt-0.5 text-lg leading-tight font-semibold tabular-nums">
              <Amount value={money(data.earnedCents)} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate text-xs text-white/70">{kept >= 0 ? m.budget.kept : m.budget.overBy}</dt>
            <dd className="mt-0.5 text-lg leading-tight font-semibold tabular-nums">
              <Amount value={money(Math.abs(kept))} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate text-xs text-white/70">{m.budget.hoursWorked}</dt>
            <dd className="mt-0.5 text-lg leading-tight font-semibold tabular-nums">{hours(data.paidMinutes)}</dd>
          </div>
        </dl>
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {data.source === "bank" ? m.budget.sourceBank : m.budget.sourceExpenses} {m.budget.estimateNote}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.budget.insightsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.budget.noInsights}</p>
          ) : (
            <ul className="space-y-3">
              {data.insights.map((insight) => {
                const Icon = INSIGHT_ICON[insight.kind];
                return (
                  <li key={insight.kind} className="flex gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl",
                        insight.tone === "warning" && "bg-warning/15 text-[#a35a00]",
                        insight.tone === "positive" && "bg-success/10 text-success",
                        insight.tone === "neutral" && "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <p className="pt-1 text-[15px] leading-snug">{insightText(insight, m, money, hours)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.budget.whereItWent}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={donutData}
              format={moneyFormat}
              totalLabel={m.budget.total}
              otherLabel={m.budget.categories.other}
              otherColor={CATEGORY_COLORS.other}
              emptyMessage={m.budget.noSpending}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.budget.trendTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={trendData}
              series={[
                { key: "thisMonth", label: m.budget.thisMonth, color: "var(--chart-1)" },
                { key: "lastMonth", label: m.budget.lastMonth, color: "var(--muted-foreground)", dashed: true },
              ]}
              format={moneyFormat}
              emptyMessage={m.budget.noSpending}
              caption={m.budget.trendTitle}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.budget.planTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.plan.incomeCents > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">{fmt(m.budget.planBody, { income: money(data.plan.incomeCents) })}</p>
              <BudgetBar label={m.budget.needs} actual={data.plan.needs.actualCents} target={data.plan.needs.targetCents} money={money} />
              <BudgetBar label={m.budget.wants} actual={data.plan.wants.actualCents} target={data.plan.wants.targetCents} money={money} />
              <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-[#1b6e33]">
                {fmt(m.budget.savingsTarget, { target: money(data.plan.savings.targetCents) })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{m.budget.planNoIncome}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-base">{m.budget.banksTitle}</CardTitle>
          {bankConfigured && data.banks.length > 0 && (
            <div className="flex items-start gap-1">
              <AmountsToggle className="-mt-1.5" />
              <RefreshBanksButton />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!bankConfigured ? (
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">{m.budget.bankNotConfigured}</p>
          ) : (
            <>
              {data.banks.length === 0 && <p className="text-sm text-muted-foreground">{m.budget.noBanks}</p>}
              {data.banks.map((bank) => (
                <div key={bank.id} className="rounded-2xl bg-secondary/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                        <Landmark className="size-[18px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{bank.institution_name ?? m.budget.bank}</p>
                        <p className="text-xs text-muted-foreground">
                          {bank.last_synced_at
                            ? fmt(m.budget.lastSynced, { time: formatShortDate(bank.last_synced_at, ctx.timezone, intl) })
                            : m.budget.neverSynced}
                        </p>
                      </div>
                    </div>
                    <DisconnectBankButton itemId={bank.id} bankName={bank.institution_name ?? m.budget.bank} />
                  </div>
                  {bank.status !== "active" && (
                    <p className="mt-2 rounded-lg bg-warning/15 px-2.5 py-1.5 text-xs">
                      {bank.status === "login_required" ? m.budget.reconnectNeeded : m.budget.syncError}
                    </p>
                  )}
                  {bank.accounts.length > 0 && (
                    <ul className="mt-2 divide-y divide-black/[0.06]">
                      {bank.accounts.map((account) => (
                        <li key={account.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                          <span className="min-w-0 truncate">
                            {account.name}
                            {account.mask && <span className="text-muted-foreground"> ••{account.mask}</span>}
                          </span>
                          {account.current_balance !== null && (
                            <Amount
                              className="font-medium tabular-nums"
                              value={formatCents(dollarsToCents(account.current_balance), account.iso_currency_code ?? ctx.currency, intl)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <ConnectBankButton label={data.banks.length > 0 ? m.budget.connectAnother : undefined} />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {m.budget.plaidNote}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {data.recentTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.budget.recentTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-black/[0.06]">
              {data.recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px]">{t.merchant_name ?? t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(`${t.date}T12:00:00Z`, "UTC", intl)}
                      {t.pending && ` · ${m.budget.pending}`}
                    </p>
                  </div>
                  {/* Plaid: positive = money out. Show money in as +. */}
                  <span className={cn("shrink-0 font-medium tabular-nums", t.amount < 0 && "text-success")}>
                    <Amount
                      value={`${t.amount < 0 ? "+" : ""}${formatCents(Math.abs(dollarsToCents(t.amount)), t.iso_currency_code ?? ctx.currency, intl)}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

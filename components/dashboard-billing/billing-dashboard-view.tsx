"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { evaluateLedger, formatCurrency, formatDate } from "@/lib/billing/ledger-engine";
import { LedgerSummary, LedgerStatus } from "@/lib/types/billing";
import { HelpTip } from "@/components/ui/help-tip";
import { LedgerStatusBadge } from "@/components/dashboard-billing/ledger-status-badge";
import {
  Search,
  ChevronRight,
  ArrowUpDown,
  Calendar,
} from "lucide-react";

type SortField = "account" | "due" | "payable" | "balance";

interface BillingDashboardViewProps {
  initialSummaries: LedgerSummary[];
  initialAsOfDate?: string;
}

export function BillingDashboardView({
  initialSummaries,
  initialAsOfDate,
}: BillingDashboardViewProps) {
  const router = useRouter();
  const [asOfDate, setAsOfDate] = useState<string>(
    () => initialAsOfDate || new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState<"all" | LedgerStatus | "cleared" | "forfeited">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("due");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Recalculate summary metrics dynamically when as-of reference date changes
  const summaries = useMemo(() => {
    return initialSummaries.map((s) => evaluateLedger(s.ledger, asOfDate));
  }, [initialSummaries, asOfDate]);

  const metrics = useMemo(() => {
    let totalPayableNow = 0;
    let totalOverduePrincipal = 0;
    let totalPenaltyDue = 0;
    let totalReceivables = 0;
    let totalCollected = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let settledCount = 0;
    let currentCount = 0;
    let noticesServedCount = 0;
    let clearedCount = 0;
    let forfeitedCount = 0;

    summaries.forEach((s) => {
      const stage = s.ledger.overdueEscalation?.currentStage || "none";
      const isCleared = Boolean(s.ledger.clearedAt);
      const isForfeited = s.ledger.status === "Forfeited" || stage === "forfeited";

      if (!isForfeited) {
        totalPayableNow += s.totalPayableNow;
        totalOverduePrincipal += s.arrearsPrincipal;
        totalPenaltyDue += s.totalPenaltyDue;
        totalReceivables += s.tspOutstandingBalance;
      }
      totalCollected += s.totalCollected;

      if (isCleared) {
        clearedCount++;
      } else if (isForfeited) {
        forfeitedCount++;
      } else if (s.status === "overdue") {
        overdueCount++;
        if (stage !== "none") noticesServedCount++;
      } else if (s.status === "due_soon") {
        dueSoonCount++;
      } else if (s.status === "settled") {
        settledCount++;
      } else if (s.status === "current") {
        currentCount++;
      }
    });

    return {
      totalPayableNow,
      totalOverduePrincipal,
      totalPenaltyDue,
      totalReceivables,
      totalCollected,
      overdueCount,
      dueSoonCount,
      settledCount,
      currentCount,
      noticesServedCount,
      clearedCount,
      forfeitedCount,
      activeCount: summaries.length - settledCount - clearedCount - forfeitedCount,
    };
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    return summaries
      .filter((s) => {
        const stage = s.ledger.overdueEscalation?.currentStage || "none";
        const isCleared = Boolean(s.ledger.clearedAt);
        const isForfeited = s.ledger.status === "Forfeited" || stage === "forfeited";

        if (filterStatus === "cleared") {
          if (!isCleared) return false;
        } else if (filterStatus === "forfeited") {
          if (!isForfeited || isCleared) return false;
        } else if (filterStatus !== "all") {
          if (isCleared || isForfeited || s.status !== filterStatus) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const clientName = s.ledger.client.fullName.toLowerCase();
          const propertyInfo = `${s.ledger.property.projectArea} blk ${s.ledger.property.blockNumber} lot ${s.ledger.property.lotNumber}`.toLowerCase();
          const stageLabel =
            stage === "first_notice"
              ? "1st notice first notice"
              : stage === "second_notice"
              ? "2nd notice second notice demand"
              : stage === "final_demand"
              ? "final demand cancellation"
              : stage === "forfeited"
              ? "forfeited forfeiture"
              : "";
          const clearedLabel = s.ledger.clearedAt ? "cleared legal cleared for legal" : "";

          return (
            clientName.includes(q) ||
            propertyInfo.includes(q) ||
            stageLabel.includes(q) ||
            clearedLabel.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === "account") {
          diff = a.ledger.client.fullName.localeCompare(b.ledger.client.fullName);
        } else if (sortField === "due") {
          const dateA = a.currentTermDueDate || "9999-12-31";
          const dateB = b.currentTermDueDate || "9999-12-31";
          diff = dateA.localeCompare(dateB);
        } else if (sortField === "payable") {
          diff = a.totalPayableNow - b.totalPayableNow;
        } else if (sortField === "balance") {
          diff = a.tspOutstandingBalance - b.tspOutstandingBalance;
        }
        return sortAsc ? diff : -diff;
      });
  }, [summaries, filterStatus, searchQuery, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const renderDueBreakdown = (s: LedgerSummary) => {
    if (s.status === "settled") {
      return <span className="text-muted-foreground">Paid in full</span>;
    }
    if (s.totalPayableNow === 0) {
      return s.advanceCredit > 0 ? (
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
          +{formatCurrency(s.advanceCredit)} advance credit
        </span>
      ) : (
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Current cycle paid</span>
      );
    }

    const parts: string[] = [];
    if (s.arrearsPrincipal > 0) parts.push(`${formatCurrency(s.arrearsPrincipal)} arrears`);
    if (s.currentTermBalance > 0) {
      if (s.currentTermBalance < s.ledger.monthlyAmortization && s.arrearsPrincipal === 0) {
        parts.push(`${formatCurrency(s.currentTermBalance)} left of ${formatCurrency(s.ledger.monthlyAmortization)}`);
      } else {
        parts.push(`${formatCurrency(s.currentTermBalance)} cur`);
      }
    }
    if (s.totalPenaltyDue > 0) parts.push(`${formatCurrency(s.totalPenaltyDue)} pen`);

    return (
      <span className={s.totalPenaltyDue > 0 || s.arrearsPrincipal > 0 ? "text-foreground/80" : "text-muted-foreground"}>
        {parts.join(" + ")}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title & As-of Date Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing &amp; Ledgers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage buyer installment ledgers, running statements, penalty calculations, and notices.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-lg shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="uppercase font-medium text-[11px]">
              As-of
              <HelpTip
                title="Reference Date"
                text="Change this date to simulate what any account owed or accumulated in late penalties on a past or future day."
              />
              :
            </span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="text-xs bg-muted/50 border border-border rounded px-2 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center font-medium">
            <span>Total Due Now</span>
            <HelpTip
              title="Total Due Now"
              text="Combined total owed right now across all contracts: overdue months, late penalties, and this month's open installment."
            />
          </div>
          <div className="text-xl font-mono font-bold text-foreground tabular-nums">
            {formatCurrency(metrics.totalPayableNow)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <span className="font-mono tabular-nums">{formatCurrency(metrics.totalOverduePrincipal)}</span> overdue +{" "}
            <span className="font-mono tabular-nums">{formatCurrency(metrics.totalPenaltyDue)}</span> pen
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-medium">
            Late Penalties
          </div>
          <div className="text-xl font-mono font-bold text-destructive tabular-nums">
            {formatCurrency(metrics.totalPenaltyDue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {metrics.overdueCount} overdue
            {metrics.noticesServedCount > 0 && ` (${metrics.noticesServedCount} on notice)`} • {metrics.dueSoonCount} nearing due
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center font-medium">
            <span>Contract Balance</span>
            <HelpTip
              title="Contract Balance (TSP)"
              text="Total remaining balance across all contracts, including future months that are not due yet."
            />
          </div>
          <div className="text-xl font-mono font-bold text-foreground tabular-nums">
            {formatCurrency(metrics.totalReceivables)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {metrics.activeCount} active • {metrics.settledCount} settled
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-medium">
            Total Collected
          </div>
          <div className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(metrics.totalCollected)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {summaries.length} total ledgers
          </div>
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="bg-card p-3 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center space-x-1 overflow-x-auto text-xs">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            All ({summaries.length})
          </button>
          <button
            onClick={() => setFilterStatus("overdue")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStatus === "overdue"
                ? "bg-destructive text-destructive-foreground font-medium"
                : "text-destructive hover:bg-destructive/10"
            }`}
          >
            Overdue ({metrics.overdueCount})
          </button>
          <button
            onClick={() => setFilterStatus("due_soon")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStatus === "due_soon"
                ? "bg-amber-600 text-white font-medium"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            Due Soon ({metrics.dueSoonCount})
          </button>
          <button
            onClick={() => setFilterStatus("current")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStatus === "current"
                ? "bg-emerald-600 text-white font-medium"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            Current ({metrics.currentCount})
          </button>
          <button
            onClick={() => setFilterStatus("settled")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStatus === "settled"
                ? "bg-muted-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Settled ({metrics.settledCount})
          </button>
          <button
            onClick={() => setFilterStatus("cleared")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStatus === "cleared"
                ? "bg-emerald-600 text-white font-medium"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            Cleared for Legal ({metrics.clearedCount})
          </button>
          {metrics.forfeitedCount > 0 && (
            <button
              onClick={() => setFilterStatus("forfeited")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterStatus === "forfeited"
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Forfeited ({metrics.forfeitedCount})
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search client or property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-border rounded-lg bg-muted/40 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Primary Identifier: Client and Property composition table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 px-4 w-36">
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <HelpTip
                      title="Status & Notices"
                      text="Shows whether the account is current, due soon, or overdue, plus its active overdue notice stage."
                    />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("account")}
                  className="py-2.5 px-4 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center space-x-1">
                    <span>Buyer &amp; Property</span>
                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  </div>
                </th>
                <th className="py-2.5 px-4 text-center">Term</th>
                <th
                  onClick={() => toggleSort("due")}
                  className="py-2.5 px-4 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center space-x-1">
                    <span>Due Date</span>
                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("payable")}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-foreground bg-muted/30 border-l border-border"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>
                      Due Now
                      <HelpTip
                        title="Due Now"
                        text="What the buyer owes right now to catch up (arrears + late penalties + current month installment)."
                      />
                    </span>
                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("balance")}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-foreground border-l border-border"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Contract Balance</span>
                    <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  </div>
                </th>
                <th className="py-2.5 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No matching ledgers found.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s) => (
                  <tr
                    key={s.ledger.id}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/billing/${s.ledger.id}`)}
                  >
                    <td className="py-3 px-4 align-top">
                      <LedgerStatusBadge summary={s} />
                    </td>
                    <td className="py-3 px-4 align-top font-semibold text-foreground group-hover:text-primary transition-colors">
                      <div className="text-sm font-medium">{s.ledger.client.fullName}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">
                        {s.ledger.property.projectArea} • Blk {s.ledger.property.blockNumber} Lot {s.ledger.property.lotNumber}
                        <span className="font-mono tabular-nums ml-1">
                          ({formatCurrency(s.ledger.monthlyAmortization)}/mo)
                        </span>
                      </div>
                      {(s.ledger.policies?.enableMaturityAmnesty || s.ledger.policies?.enablePostMaturityReducedRate) && (
                        <div className="mt-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            Policies active
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-center tabular-nums text-muted-foreground">
                      {s.status === "settled"
                        ? `${s.ledger.termMonths}/${s.ledger.termMonths}m`
                        : `#${s.currentInstNo}/${s.ledger.termMonths}m`}
                    </td>
                    <td className="py-3 px-4 align-top text-muted-foreground whitespace-nowrap">
                      {s.status === "settled"
                        ? "Completed"
                        : s.currentTermDueDate
                        ? formatDate(s.currentTermDueDate)
                        : "-"}
                    </td>
                    <td className="py-3 px-4 align-top text-right bg-muted/20 border-l border-border">
                      <div
                        className={`text-sm font-mono font-bold tabular-nums ${
                          s.status === "overdue"
                            ? "text-destructive"
                            : s.status === "due_soon"
                            ? "text-amber-700 dark:text-amber-400"
                            : s.totalPayableNow === 0
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {formatCurrency(s.totalPayableNow)}
                      </div>
                      <div className="text-[11px] mt-0.5">{renderDueBreakdown(s)}</div>
                    </td>
                    <td className="py-3 px-4 align-top text-right border-l border-border">
                      <div className="font-mono font-semibold tabular-nums text-foreground/90">
                        {formatCurrency(s.tspOutstandingBalance)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        of <span className="font-mono tabular-nums">{formatCurrency(s.ledger.contractPrice)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

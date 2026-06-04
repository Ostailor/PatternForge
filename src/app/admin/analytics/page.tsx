import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { analyticsEventNames } from "@/lib/analytics-events/events";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";

const ADMIN_ANALYTICS_WINDOW_DAYS = 30;
const RECENT_EVENTS_PAGE_SIZE = 50;
const TREND_EVENT_SAMPLE_LIMIT = 2000;

type AdminAnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function hasEnabledDeveloperFlag() {
  return process.env.PATTERNFORGE_ADMIN_ANALYTICS === "true";
}

function readRole(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const role = (metadata as { role?: unknown }).role;

  return typeof role === "string" ? role : null;
}

async function canViewAnalytics() {
  if (!getFeatureFlag("adminTools") || !getFeatureFlag("analytics")) {
    return false;
  }

  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return false;
  }

  if (hasEnabledDeveloperFlag()) {
    return true;
  }

  const user = await currentUser();
  const role =
    readRole(user?.publicMetadata) ?? readRole(user?.privateMetadata);

  return role === "admin" || role === "developer";
}

function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function stringifyProperties(properties: unknown) {
  const serialized = JSON.stringify(properties);

  if (!serialized) {
    return "{}";
  }

  return serialized.length > 180 ? `${serialized.slice(0, 180)}...` : serialized;
}

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parsePage(
  searchParams: Record<string, string | string[] | undefined>,
): number {
  const page = Number.parseInt(getSingleSearchParam(searchParams, "page"), 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

function analyticsPageHref(page: number): string {
  return page > 1 ? `/admin/analytics?page=${page}` : "/admin/analytics";
}

export default async function AdminAnalyticsPage({
  searchParams,
}: AdminAnalyticsPageProps) {
  if (!(await canViewAnalytics())) {
    notFound();
  }

  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const page = parsePage(resolvedSearchParams);
  const prisma = getPrisma();
  const since = new Date();

  since.setDate(since.getDate() - ADMIN_ANALYTICS_WINDOW_DAYS);

  const [eventCounts, recentEvents, trendEvents, totalEvents, optOutCount] =
    await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["eventName"],
      where: {
        createdAt: {
          gte: since,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        eventName: true,
        userProfileId: true,
        properties: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * RECENT_EVENTS_PAGE_SIZE,
      take: RECENT_EVENTS_PAGE_SIZE,
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      select: {
        eventName: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: TREND_EVENT_SAMPLE_LIMIT,
    }),
    prisma.analyticsEvent.count({
      where: {
        createdAt: {
          gte: since,
        },
      },
    }),
    prisma.userSettings.count({
      where: {
        analyticsOptOut: true,
      },
    }),
  ]);

  const sortedEventCounts = eventCounts
    .map((event) => ({
      eventName: event.eventName,
      count: event._count._all,
    }))
    .sort((left, right) => right.count - left.count);
  const trackedEventNames = new Set(sortedEventCounts.map((event) => event.eventName));
  const untrackedEvents = analyticsEventNames.filter(
    (eventName) => !trackedEventNames.has(eventName),
  );
  const dailyCounts = Array.from(
    trendEvents
      .slice()
      .reverse()
      .reduce<Map<string, number>>((countsByDay, event) => {
      const day = toDayKey(event.createdAt);

      countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
      return countsByDay;
    }, new Map()),
  );
  const pageCount = Math.max(1, Math.ceil(totalEvents / RECENT_EVENTS_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Admin Analytics
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Product quality events
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
          Privacy-conscious event counts for the last{" "}
          {ADMIN_ANALYTICS_WINDOW_DAYS} days. Analytics properties are limited
          to IDs, counts, statuses, scores, and feature flags.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Events"
          value={String(totalEvents)}
          detail={`Last ${ADMIN_ANALYTICS_WINDOW_DAYS} days`}
        />
        <MetricCard
          label="Tracked event types"
          value={`${sortedEventCounts.length}/${analyticsEventNames.length}`}
          detail="Configured v0.9 events"
        />
        <MetricCard
          label="Analytics opt-outs"
          value={String(optOutCount)}
          detail="Users with product analytics disabled"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Event counts</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedEventCounts.map((event) => (
                  <tr key={event.eventName}>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {event.eventName}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">
                      {event.count}
                    </td>
                  </tr>
                ))}
                {sortedEventCounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-sm font-semibold text-slate-500"
                    >
                      No analytics events recorded in this window.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {untrackedEvents.length > 0 ? (
            <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
              Not seen yet: {untrackedEvents.join(", ")}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Daily volume</h2>
          <div className="mt-4 grid gap-2">
            {dailyCounts.map(([day, count]) => (
              <div
                key={day}
                className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm"
              >
                <span className="font-bold text-slate-600">{day}</span>
                <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-teal-600"
                    style={{
                      width: `${Math.max(
                        5,
                        (count /
                          Math.max(
                            1,
                            ...dailyCounts.map(([, dailyCount]) => dailyCount),
                          )) *
                          100,
                      )}%`,
                    }}
                  />
                </span>
                <span className="text-right font-black text-slate-950">
                  {count}
                </span>
              </div>
            ))}
            {dailyCounts.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">
                No daily analytics volume yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-black text-slate-950">Recent events</h2>
          <p className="text-sm font-bold text-slate-500">
            Page {page} of {pageCount}
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">User scoped</th>
                <th className="px-4 py-3">Properties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                    {formatDateTime(event.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {event.eventName}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {event.userProfileId ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {stringifyProperties(event.properties)}
                  </td>
                </tr>
              ))}
              {recentEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-sm font-semibold text-slate-500"
                  >
                    No recent analytics events.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {pageCount > 1 ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {page > 1 ? (
              <Link
                href={analyticsPageHref(page - 1)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Previous
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link
                href={analyticsPageHref(page + 1)}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700"
              >
                Next
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

/** The timesheet pages' header: whose, and the month stepper. Server-safe. */

import { PageFrame } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";

import { monthLabel, stepMonth, timesheetRoutes } from "../../lib/staff-time-ui";
import { WeekStepper } from "../booking/pickers";

export function TimesheetFrame({ month, thisMonth, locale, at, tabs, current, person, actions, children }: {
  month: string;
  thisMonth: string;
  locale: string;
  /** The page's URL for a month. */
  at: (month: string | null) => string;
  /** Staff and Mine: for managers who also have a timesheet of their own. */
  tabs: boolean;
  current: "staff" | "mine";
  /** One person's, from the staff list. */
  person?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const monthParam = month === thisMonth ? null : month;
  const href = (m: string) => at(m === thisMonth ? null : m);
  const staff = timesheetRoutes.staff({ month: monthParam });
  const mine = timesheetRoutes.mine(monthParam);
  return (
    <PageFrame
      type={current === "staff" && !person ? "list" : "record"}
      breadcrumb={person ? [{ label: "Timesheets", href: staff }, { label: person }] : [{ label: "Timesheets" }]}
      actions={actions}
      secondary={
        <>
          {tabs ? (
            <RibbonNav
              label="Timesheets"
              links={[
                { label: "Staff", href: staff },
                { label: "Mine", href: mine },
              ]}
              current={current === "staff" ? staff : mine}
              className="flex-initial"
            />
          ) : null}
          <WeekStepper
            label={monthLabel(month, locale)}
            previous={href(stepMonth(month, -1))}
            today={at(null)}
            next={href(stepMonth(month, 1))}
            isToday={month === thisMonth}
            todayLabel="This month"
            unit="month"
          />
        </>
      }
    >
      {children}
    </PageFrame>
  );
}

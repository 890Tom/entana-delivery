import type { AdminReseller } from "@entana/contracts";
import type { ReactElement } from "react";
import { Link } from "wouter";

import { Pill } from "../../../components/pill/pill";
import { Switch } from "../../../components/switch/switch";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { resellerPath } from "../../../routes";
import { daysSince, isStale, staleMonths } from "../rules/reseller-list";

import styles from "./reseller-table.module.css";

const t = texts.resellers;

function agoText(days: number): string {
  if (days === 0) {
    return t.row.today;
  }
  return days === 1 ? t.row.yesterday : t.row.daysAgo(days);
}

/** What the "last verification" column says: the pills that need attention, else the age. */
function VerificationCell({ reseller, now }: { reseller: AdminReseller; now: Date }): ReactElement {
  const isOverdue = isStale(reseller, now);
  return (
    <div className={styles.verification}>
      {!reseller.consentGiven && <Pill tone="error">{t.row.consentPending}</Pill>}
      {isOverdue && <Pill tone="highlight">{t.row.stale(staleMonths(reseller, now))}</Pill>}
      {!isOverdue && reseller.consentGiven && reseller.verifiedAt !== null && (
        <span>{agoText(daysSince(reseller.verifiedAt, now))}</span>
      )}
    </div>
  );
}

export interface VisibilityControl {
  readonly pendingIds: ReadonlySet<string>;
  readonly onToggle: (reseller: AdminReseller) => void;
}

function ResellerRow({
  reseller,
  now,
  visibility,
}: {
  reseller: AdminReseller;
  now: Date;
  visibility: VisibilityControl;
}): ReactElement {
  return (
    <tr className={[styles.row, reseller.visible ? "" : styles.dimmed].join(" ")}>
      <td>
        <Link
          href={resellerPath(reseller.id)}
          className={styles.name}
          aria-label={t.row.edit(reseller.name)}
        >
          {reseller.name}
        </Link>
      </td>
      <td>{reseller.neighborhood}</td>
      <td>
        <VerificationCell reseller={reseller} now={now} />
      </td>
      <td>
        <div className={styles.visibility}>
          <Switch
            label={t.row.switchLabel(reseller.name)}
            isOn={reseller.visible}
            isDisabled={visibility.pendingIds.has(reseller.id)}
            onToggle={() => {
              visibility.onToggle(reseller);
            }}
          />
          <span className={styles.visible}>{reseller.visible ? t.row.yes : t.row.no}</span>
        </div>
      </td>
    </tr>
  );
}

/** The resellers in the order given: the API sorts them by neighborhood, then name. */
export function ResellerTable({
  resellers,
  now,
  visibility,
}: {
  resellers: readonly AdminReseller[];
  now: Date;
  visibility: VisibilityControl;
}): ReactElement {
  return (
    <div className={styles.frame}>
      <table className={styles.table} aria-label={t.tableLabel}>
        <thead className={styles.head}>
          <tr>
            <th scope="col">{t.columns.reseller}</th>
            <th scope="col">{t.columns.neighborhood}</th>
            <th scope="col">{t.columns.verification}</th>
            <th scope="col">
              <span className={visuallyHidden.visuallyHidden}>{t.columns.visible}</span>
              <span aria-hidden="true">{t.columns.visible}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {resellers.map((reseller) => (
            <ResellerRow key={reseller.id} reseller={reseller} now={now} visibility={visibility} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

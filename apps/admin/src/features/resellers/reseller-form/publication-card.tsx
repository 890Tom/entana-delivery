import type { AdminReseller } from "@entana/contracts";
import type { ReactElement } from "react";

import { useNow } from "../../../clock/use-now";
import { texts } from "../../../i18n/texts";
import cardStyles from "../../../components/card/card.module.css";
import { FormButton } from "../../../components/form-buttons/form-buttons";
import { SwitchRow } from "../../../components/switch-row/switch-row";
import type { ResellerFormModel } from "./use-reseller-form";
import { isStale } from "../rules/reseller-list";
import { verificationViewOf } from "../rules/verification-view";

import styles from "./reseller-form.module.css";

const t = texts.resellers.form;

/** The consent: it cannot be withdrawn while the reseller is visible. */
function ConsentField({ model }: { model: ResellerFormModel }): ReactElement {
  const { values } = model;
  const isLocked = values.visible && values.consentGiven;
  return (
    <>
      <label className={styles.consent} aria-disabled={isLocked ? true : undefined}>
        <input
          type="checkbox"
          checked={values.consentGiven}
          aria-disabled={isLocked ? true : undefined}
          onChange={(event) => {
            if (!isLocked) {
              model.setConsent(event.target.checked);
            }
          }}
        />
        {t.publication.consent}
      </label>
      {isLocked && <p className={styles.help}>{t.publication.consentLockedHelp}</p>}
    </>
  );
}

function visibleHelpOf(isLocked: boolean): string {
  return isLocked ? t.publication.visibleLockedHelp : t.publication.visibleHelp;
}

/** The line under the date: what to do when the verification is old, else how old it is. */
function verificationHelp(reseller: AdminReseller, now: Date): string | null {
  if (isStale(reseller, now)) {
    return t.verification.staleHelp;
  }
  const view = verificationViewOf(reseller, now);
  if (view.kind === "never") {
    return null;
  }
  return view.days === 0 ? t.verification.today : t.verification.daysAgo(view.days);
}

function VerificationBlock({
  reseller,
  isBusy,
  onVerify,
}: {
  reseller: AdminReseller | null;
  isBusy: boolean;
  onVerify: () => void;
}): ReactElement {
  const now = useNow();
  if (reseller === null) {
    return (
      <div className={styles.verification}>
        <p className={styles.verificationTitle}>{t.verification.never}</p>
        <p className={styles.help}>{t.verification.newHelp}</p>
      </div>
    );
  }
  const view = verificationViewOf(reseller, now);
  const help = verificationHelp(reseller, now);
  return (
    <div className={styles.verification}>
      <p className={styles.verificationTitle}>
        {view.kind === "verified" ? t.verification.verifiedOn(view.date) : t.verification.never}
      </p>
      {help !== null && <p className={styles.help}>{help}</p>}
      <FormButton
        variant="secondary"
        label={t.verification.mark}
        isDisabled={isBusy}
        onClick={onVerify}
      />
    </div>
  );
}

interface PublicationCardProps {
  readonly model: ResellerFormModel;
  /** The reseller being changed; null for a new one. */
  readonly reseller: AdminReseller | null;
  readonly isBusy: boolean;
  readonly onVerify: () => void;
}

/** The "Publication" card: consent, visibility and the verification of the reseller. */
export function PublicationCard({
  model,
  reseller,
  isBusy,
  onVerify,
}: PublicationCardProps): ReactElement {
  const { values } = model;
  const isLocked = !model.isPublishable && !values.visible;
  return (
    <section className={[cardStyles.card, styles.card].join(" ")}>
      <h2 className={cardStyles.title}>{t.publication.title}</h2>
      <ConsentField model={model} />
      <SwitchRow
        label={t.publication.visible}
        help={visibleHelpOf(isLocked)}
        error={model.hasPublishError ? t.errors.notPublishable : undefined}
        isOn={values.visible}
        isLocked={isLocked}
        isDisabled={model.isSaving}
        onToggle={() => {
          model.setVisible(!values.visible);
        }}
      />
      <VerificationBlock
        reseller={reseller}
        isBusy={isBusy || model.isSaving}
        onVerify={onVerify}
      />
    </section>
  );
}

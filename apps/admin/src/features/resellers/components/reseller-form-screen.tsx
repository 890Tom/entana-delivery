import type { AdminReseller } from "@entana/contracts";
import type { ReactElement } from "react";
import { Link, useParams } from "wouter";

import { Notice } from "../../../components/notice/notice";
import { Pill } from "../../../components/pill/pill";
import { texts } from "../../../i18n/texts";
import { NotFound } from "../../../layout/not-found/not-found";
import { OrderIcon } from "../../../order-display/order-icons";
import { RESELLERS_PATH } from "../../../routes";
import { useResellerActions } from "../hooks/use-reseller-actions";
import type { ActionNotice } from "../hooks/use-reseller-actions";
import { useResellerForm } from "../hooks/use-reseller-form";
import type { FormNotice } from "../hooks/use-reseller-form";
import { useResellers } from "../hooks/use-resellers";

import { DeleteDialog } from "./delete-dialog";
import { ResellerForm } from "./reseller-form";
import styles from "./reseller-form.module.css";

const t = texts.resellers.form;

function BackLink(): ReactElement {
  return (
    <Link href={RESELLERS_PATH} className={styles.back}>
      <OrderIcon name="arrow-left" size={20} />
      {t.back}
    </Link>
  );
}

function StatusPill({ reseller }: { reseller: AdminReseller }): ReactElement {
  return reseller.visible ? (
    <Pill tone="highlight">{t.status.visible}</Pill>
  ) : (
    <Pill tone="neutral">{t.status.hidden}</Pill>
  );
}

const NOTICE_TEXT: Readonly<Record<FormNotice | ActionNotice, string>> = {
  failed: t.notices.saveFailed,
  gone: t.notices.gone,
  verified: t.verification.marked,
  verifyFailed: t.notices.verifyFailed,
  deleteFailed: t.notices.deleteFailed,
};

function NoticeView({ notice }: { notice: FormNotice | ActionNotice | null }): ReactElement | null {
  if (notice === null) {
    return null;
  }
  const text = NOTICE_TEXT[notice];
  return notice === "verified" ? (
    <div role="status">
      <Notice tone="info">{text}</Notice>
    </div>
  ) : (
    <Notice tone="error">{text}</Notice>
  );
}

/** The page of the form: the title, what was refused, then the form and the question of deletion. */
function FormPage({ reseller }: { reseller: AdminReseller | null }): ReactElement {
  const model = useResellerForm(reseller);
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <BackLink />
        <div className={styles.title}>
          <h1 className={styles.heading}>{reseller === null ? t.newTitle : reseller.name}</h1>
          {reseller !== null && <StatusPill reseller={reseller} />}
        </div>
      </header>
      {reseller === null ? (
        <>
          <NoticeView notice={model.notice} />
          <ResellerForm
            model={model}
            reseller={null}
            isBusy={false}
            onVerify={() => undefined}
            onAskDelete={null}
          />
        </>
      ) : (
        <ExistingReseller reseller={reseller} model={model} />
      )}
    </div>
  );
}

function ExistingReseller({
  reseller,
  model,
}: {
  reseller: AdminReseller;
  model: ReturnType<typeof useResellerForm>;
}): ReactElement {
  const actions = useResellerActions(reseller);
  return (
    <>
      <NoticeView notice={actions.notice ?? model.notice} />
      <ResellerForm
        model={model}
        reseller={reseller}
        isBusy={actions.isBusy}
        onVerify={actions.verify}
        onAskDelete={actions.askDelete}
      />
      {actions.isAsking && (
        <DeleteDialog
          reseller={reseller}
          isBusy={actions.isBusy}
          onCancel={actions.cancelDelete}
          onConfirm={actions.confirmDelete}
        />
      )}
    </>
  );
}

/** The form of a new reseller. */
export function NewResellerScreen(): ReactElement {
  return <FormPage reseller={null} />;
}

/** The form of one reseller, read in the list: there is no route that reads a single one. */
export function EditResellerScreen(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const model = useResellers();
  if (model.resellers === undefined) {
    return model.hasFailed ? (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: model.retry }}>
        {texts.resellers.loadFailed}
      </Notice>
    ) : (
      <p role="status">{texts.resellers.loading}</p>
    );
  }
  const reseller = model.resellers.find((candidate) => candidate.id === id);
  return reseller === undefined ? <NotFound /> : <FormPage key={reseller.id} reseller={reseller} />;
}

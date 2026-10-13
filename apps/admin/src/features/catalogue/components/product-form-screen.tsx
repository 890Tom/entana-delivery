import type { AdminProduct } from "@entana/contracts";
import { useState } from "react";
import type { ReactElement } from "react";
import { Link, useParams } from "wouter";

import { Notice } from "../../../components/notice/notice";
import { Pill } from "../../../components/pill/pill";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { CATALOGUE_PATH } from "../../../routes";
import { useCatalogueNotice } from "../hooks/use-catalogue-notice";
import type { NoticeState } from "../hooks/use-catalogue-notice";
import { useProductActions } from "../hooks/use-product-actions";
import { useProducts } from "../hooks/use-products";

import { CatalogueIcon } from "./catalogue-icons";
import { CatalogueNoticeView } from "./catalogue-notice-view";
import { ProductForm } from "./product-form";
import styles from "./product-form.module.css";
import { RetireDialog } from "./retire-dialog";

const t = texts.catalogueForm;

function BackLink(): ReactElement {
  return (
    <Link href={CATALOGUE_PATH} className={styles.back}>
      <OrderIcon name="arrow-left" size={20} />
      {t.back}
    </Link>
  );
}

function StateBadge({ product }: { product: AdminProduct }): ReactElement {
  if (product.retired) {
    return <Pill tone="neutral">{t.status.retired}</Pill>;
  }
  if (!product.available) {
    return (
      <Pill tone="highlight" icon={<CatalogueIcon name="pause-circle" size={18} />}>
        {t.status.unavailable}
      </Pill>
    );
  }
  return (
    <Pill tone="neutral" icon={<OrderIcon name="check" size={18} />}>
      {t.status.available}
    </Pill>
  );
}

function Page({
  title,
  badge,
  notices,
  children,
}: {
  title: string;
  badge?: ReactElement;
  notices: NoticeState;
  children: ReactElement;
}): ReactElement {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <BackLink />
        <div className={styles.title}>
          <h1 className={styles.heading}>{title}</h1>
          {badge}
        </div>
      </header>
      <CatalogueNoticeView notice={notices.notice} />
      {children}
    </div>
  );
}

/** The form of a new product: it does not need the list, only the cache to add the product to. */
export function NewProductScreen(): ReactElement {
  const notices = useCatalogueNotice();
  return (
    <Page title={t.newTitle} notices={notices}>
      <ProductForm product={null} notices={notices} onSaved={() => undefined} onAskRetire={null} />
    </Page>
  );
}

function RetireQuestion({
  product,
  retire,
  onCancel,
  onRetired,
}: {
  product: AdminProduct;
  retire: () => Promise<void>;
  onCancel: () => void;
  onRetired: () => void;
}): ReactElement {
  const [isBusy, setIsBusy] = useState(false);
  return (
    <RetireDialog
      product={product}
      isBusy={isBusy}
      onCancel={onCancel}
      onConfirm={() => {
        setIsBusy(true);
        void retire().then(onRetired);
      }}
    />
  );
}

function useCounter(): [number, () => void] {
  const [count, setCount] = useState(0);
  return [
    count,
    () => {
      setCount((current) => current + 1);
    },
  ];
}

function useFlag(): [boolean, () => void, () => void] {
  const [isSet, setIsSet] = useState(false);
  return [
    isSet,
    () => {
      setIsSet(true);
    },
    () => {
      setIsSet(false);
    },
  ];
}

function EditForm({
  product,
  notices,
  retire,
}: {
  product: AdminProduct;
  notices: NoticeState;
  retire: () => Promise<void>;
}): ReactElement {
  // The form starts again from the product when it was saved or retired: a new key.
  const [revision, restart] = useCounter();
  const [isAsking, startAsking, stopAsking] = useFlag();
  const askRetire = product.retired ? null : startAsking;
  return (
    <Page title={product.name} badge={<StateBadge product={product} />} notices={notices}>
      <>
        <ProductForm
          key={`${product.id}-${String(revision)}-${String(product.retired)}`}
          product={product}
          notices={notices}
          onSaved={restart}
          onAskRetire={askRetire}
        />
        {isAsking && (
          <RetireQuestion
            product={product}
            retire={retire}
            onCancel={stopAsking}
            onRetired={() => {
              stopAsking();
              restart();
            }}
          />
        )}
      </>
    </Page>
  );
}

/** The form of one product, read in the list: there is no route that reads a single product. */
export function EditProductScreen(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const model = useProducts();
  const notices = useCatalogueNotice();
  const actions = useProductActions(model, notices);
  if (model.products === undefined) {
    return model.hasFailed ? (
      <Notice tone="error" action={{ label: texts.common.retry, onClick: model.retry }}>
        {texts.catalogue.loadFailed}
      </Notice>
    ) : (
      <p role="status">{texts.catalogue.loading}</p>
    );
  }
  const product = model.products.find((candidate) => candidate.id === id);
  if (product === undefined) {
    return (
      <div className={styles.screen}>
        <BackLink />
        <h1 className={styles.heading}>{t.notFound}</h1>
      </div>
    );
  }
  return <EditForm product={product} notices={notices} retire={() => actions.retire(product)} />;
}

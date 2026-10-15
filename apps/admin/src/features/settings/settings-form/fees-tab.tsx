import type { DeliverySettings } from "@entana/contracts";
import type { ReactElement } from "react";

import { useAxes } from "../api/use-axes";

import { AxesCard } from "../axes-list/axes-card";
import { AxesMapCard } from "../axes-map/axes-map-card";
import { FeesForm } from "./fees-form";
import styles from "../settings-screen.module.css";

/** As on the owner's capture: the axes above « Hors axe » on the left, the map on the right. */
export function FeesTab({ settings }: { settings: DeliverySettings }): ReactElement {
  const axes = useAxes();
  return (
    <div className={styles.columns}>
      <div className={styles.stack}>
        <AxesCard model={axes} />
        <FeesForm settings={settings} />
      </div>
      <AxesMapCard model={axes} />
    </div>
  );
}

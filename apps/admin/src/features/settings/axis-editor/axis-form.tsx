import { DELIVERY_NAME_MAX_LENGTH } from "@entana/contracts";
import type { AdminDeliveryPlace } from "@entana/contracts";
import { useId, useState } from "react";
import type { ReactElement } from "react";

import { Switch } from "../../../components/switch/switch";
import { TextField } from "../../../components/text-field/text-field";
import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { SETTINGS_PATH } from "../../../routes";
import { FormButton, FormLink } from "../../../components/form-buttons/form-buttons";
import cardStyles from "../../../components/card/card.module.css";
import type { AxisFormModel } from "./use-axis-form";
import type { PlaceDrawingModel } from "../place-drawing/use-place-drawing";
import { canAddPlace, searchPlaces, validateAxisForm } from "../rules/axis-form";

import styles from "./axis-editor.module.css";
import { AxisPlaceList } from "./axis-place-list";
import type { PlaceRow } from "./axis-place-list";
import { TraceTools } from "../place-drawing/drawing-tools";
import { PlaceSearch } from "../../../components/place-search/place-search";

const t = texts.settings.axisEditor;

interface AxisFormProps {
  readonly model: AxisFormModel;
  readonly rows: readonly PlaceRow[];
  /** The active places of the shop: what the search offers. */
  readonly places: readonly AdminDeliveryPlace[];
  /** Present on an axis that exists: it opens the question of the deletion. */
  readonly onAskDelete: (() => void) | null;
  /** The places created on the map: the trace tools, the point being named. */
  readonly drawing: PlaceDrawingModel;
}

function ColorField({ model }: { model: AxisFormModel }): ReactElement {
  const id = useId();
  return (
    <div className={styles.color}>
      <label htmlFor={id} className={styles.colorLabel}>
        {t.color}
      </label>
      <input
        id={id}
        type="color"
        className={styles.colorInput}
        value={model.values.color}
        onChange={(event) => {
          model.setColor(event.target.value.toLowerCase());
        }}
      />
      <span className={styles.colorValue}>{model.values.color}</span>
    </div>
  );
}

function PlacesSection(props: Omit<AxisFormProps, "onAskDelete">): ReactElement {
  const { model, rows, places, drawing } = props;
  const [search, setSearch] = useState("");
  const hasDraft = drawing.draft !== null;
  return (
    <div className={styles.places}>
      <h2 className={cardStyles.title}>{t.places.title}</h2>
      {rows.length === 0 && !hasDraft ? (
        <p className={cardStyles.muted}>{t.places.empty}</p>
      ) : (
        <AxisPlaceList
          rows={rows}
          color={model.values.color}
          onMove={model.movePlaces}
          onRemove={model.removePlace}
          hasDraft={hasDraft}
        />
      )}
      <PlacesErrors model={model} />
      <TraceTools drawing={drawing} />
      <PlaceSearch
        search={search}
        results={searchPlaces(places, search, model.values)}
        optionOf={(place) => ({ key: place.id, label: place.name })}
        isDisabled={!canAddPlace(model.values)}
        onSearch={setSearch}
        onPick={(place) => {
          setSearch("");
          model.addPlace(place);
        }}
      />
    </div>
  );
}

function PlacesErrors({ model }: { model: AxisFormModel }): ReactElement {
  return (
    <>
      {model.hasPlacesError && (
        <p className={styles.error} role="alert">
          {t.places.none}
        </p>
      )}
      {model.hasNewPlaceNameError && (
        <p className={styles.error} role="alert">
          {t.places.newNameTaken}
        </p>
      )}
    </>
  );
}

function ActiveField({ model }: { model: AxisFormModel }): ReactElement {
  const noteId = useId();
  const isActive = model.values.active;
  return (
    <div className={styles.active}>
      <div className={styles.activeLine}>
        <Switch
          label={t.active}
          isOn={isActive}
          describedBy={noteId}
          onToggle={() => {
            model.setActive(!isActive);
          }}
        />
        <span className={styles.activeLabel} aria-hidden="true">
          {t.active}
        </span>
        <span className={cardStyles.muted} aria-hidden="true">
          {isActive ? t.yes : t.no}
        </span>
      </div>
      <p id={noteId} className={styles.note}>
        <OrderIcon name="info" size={20} />
        {t.priority}
      </p>
    </div>
  );
}

/** Why a new axis cannot be saved yet, written under the greyed button. */
function Reasons({ model }: { model: AxisFormModel }): ReactElement {
  const errors = validateAxisForm(model.values);
  const reasons = [
    errors.name === undefined ? null : t.nameEmpty,
    errors.places === undefined ? null : t.places.none,
  ].filter((reason) => reason !== null);
  return <p className={cardStyles.muted}>{reasons.join(" ")}</p>;
}

function Actions({ model, onAskDelete, drawing }: AxisFormProps): ReactElement {
  return (
    <>
      <div className={styles.buttons}>
        <FormButton
          type="submit"
          variant="primary"
          label={t.save}
          icon={<OrderIcon name="check" size={20} />}
          // Not while the window « Nouveau lieu » is open: its point is not in the axis yet.
          isDisabled={model.isSaveDisabled || model.isSaving || drawing.draft !== null}
          isBusy={model.isSaving}
        />
        <FormLink href={SETTINGS_PATH} variant="ghost" label={t.cancel} />
      </div>
      {model.isNew && model.isSaveDisabled && <Reasons model={model} />}
      {onAskDelete !== null && (
        <div className={styles.buttons}>
          <FormButton
            variant="dangerGhost"
            label={t.delete}
            icon={<OrderIcon name="trash" size={20} />}
            isDisabled={model.isSaving}
            onClick={onAskDelete}
          />
        </div>
      )}
    </>
  );
}

/** The card of the form: name, colour, places, state, then the buttons. */
export function AxisForm(props: AxisFormProps): ReactElement {
  const { model } = props;
  const nameError =
    model.nameError === null ? undefined : model.nameError === "taken" ? t.nameTaken : t.nameEmpty;
  return (
    <form
      className={[cardStyles.card, styles.card].join(" ")}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (props.drawing.draft === null) {
          model.submit();
        }
      }}
    >
      <TextField
        label={t.name}
        placeholder={t.namePlaceholder}
        maxLength={DELIVERY_NAME_MAX_LENGTH}
        value={model.values.name}
        error={nameError}
        onChange={model.setName}
      />
      <ColorField model={model} />
      <PlacesSection
        model={model}
        rows={props.rows}
        places={props.places}
        drawing={props.drawing}
      />
      <ActiveField model={model} />
      <Actions {...props} />
    </form>
  );
}

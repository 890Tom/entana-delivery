import { useId, useRef, useState } from "react";
import type { DragEvent, ReactElement, ReactNode } from "react";

import { NoticeIcon } from "../../../components/notice/notice-icons";
import { texts } from "../../../i18n/texts";
import { PHOTO_ACCEPT } from "../rules/photo-check";
import type { PhotoProblem } from "../rules/photo-check";

import { CatalogueIcon } from "./catalogue-icons";
import { FormButton } from "./form-buttons";
import styles from "./photo-card.module.css";
import cardStyles from "../../order-detail/components/card.module.css";

const t = texts.catalogueForm;

const PROBLEM_TEXT: Readonly<Record<PhotoProblem, string>> = {
  invalid: t.errors.photoInvalid,
  tooLarge: t.errors.photoTooLarge,
  tooSmall: t.errors.photoTooSmall,
};

interface PhotoCardProps {
  /** The address of the photo the product already has. */
  readonly currentUrl: string | null;
  /** The address of the photo just chosen, not sent yet. */
  readonly chosenUrl: string | null;
  readonly problem: PhotoProblem | null;
  readonly isUploading: boolean;
  readonly isDisabled: boolean;
  readonly onChoose: (file: File) => void;
  /** The alternative text field, under the photo. */
  readonly children: ReactNode;
}

/** The photo as it is stored: a square, cropped from the centre. */
function PhotoFrame({
  currentUrl,
  chosenUrl,
}: Pick<PhotoCardProps, "currentUrl" | "chosenUrl">): ReactElement {
  const [hasFailed, setHasFailed] = useState(false);
  const shownUrl = chosenUrl ?? currentUrl;
  if (shownUrl === null || (chosenUrl === null && hasFailed)) {
    // The pattern of the screens: a grey square with the name of what it stands for.
    return (
      <div className={styles.frame}>
        <div className={styles.placeholder}>
          <CatalogueIcon name="image" size={24} />
          <span>{t.photo.current}</span>
        </div>
      </div>
    );
  }
  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>
        <img
          src={shownUrl}
          alt=""
          className={styles.photo}
          onError={() => {
            setHasFailed(true);
          }}
        />
      </div>
      {chosenUrl === null && <figcaption className={styles.caption}>{t.photo.current}</figcaption>}
    </figure>
  );
}

function FileInput({
  isDisabled,
  onChoose,
  inputRef,
}: {
  isDisabled: boolean;
  onChoose: (file: File) => void;
  inputRef: { current: HTMLInputElement | null };
}): ReactElement {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={PHOTO_ACCEPT}
      hidden
      aria-label={t.photo.inputLabel}
      disabled={isDisabled}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file !== undefined) {
          onChoose(file);
        }
        // The same file can be chosen again after a refusal.
        event.target.value = "";
      }}
    />
  );
}

interface DropZoneProps extends Pick<PhotoCardProps, "currentUrl" | "chosenUrl" | "isDisabled"> {
  readonly hasProblem: boolean;
  readonly problemId: string;
  readonly onChoose: (file: File) => void;
  readonly onBrowse: () => void;
}

/** The invitation to drop a photo, with the link that opens the file chooser. */
function EmptyDrop({
  isDisabled,
  hasProblem,
  problemId,
  onBrowse,
}: Pick<DropZoneProps, "isDisabled" | "hasProblem" | "problemId" | "onBrowse">): ReactElement {
  return (
    <div className={styles.drop}>
      <CatalogueIcon name="image-plus" size={32} />
      <p className={styles.dropText}>
        {t.photo.drop}{" "}
        <button
          type="button"
          className={styles.browse}
          aria-describedby={hasProblem ? problemId : undefined}
          aria-disabled={isDisabled ? true : undefined}
          onClick={isDisabled ? undefined : onBrowse}
        >
          {t.photo.browse}
        </button>
      </p>
    </div>
  );
}

/** The drop zone while there is no photo, the photo and its replacement button after. */
function DropZone({ currentUrl, chosenUrl, onChoose, ...empty }: DropZoneProps): ReactElement {
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file !== undefined && !empty.isDisabled) {
      onChoose(file);
    }
  };
  return (
    <div
      className={styles.zone}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={onDrop}
    >
      {currentUrl !== null || chosenUrl !== null ? (
        <>
          <PhotoFrame currentUrl={currentUrl} chosenUrl={chosenUrl} />
          <FormButton
            label={t.photo.replace}
            variant="secondary"
            icon={<CatalogueIcon name="image-up" size={20} />}
            isDisabled={empty.isDisabled}
            onClick={empty.onBrowse}
          />
        </>
      ) : (
        <EmptyDrop {...empty} />
      )}
    </div>
  );
}

/** The "Photo" card: the drop zone (or the photo and its replacement), the help and the alt text. */
export function PhotoCard({
  problem,
  isUploading,
  children,
  ...zone
}: PhotoCardProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const problemId = useId();
  return (
    <section
      className={[cardStyles.card, styles.card].join(" ")}
      aria-labelledby={`${problemId}-title`}
    >
      <h2 id={`${problemId}-title`} className={cardStyles.title}>
        {t.photo.title}
      </h2>
      <FileInput isDisabled={zone.isDisabled} onChoose={zone.onChoose} inputRef={inputRef} />
      <DropZone
        {...zone}
        hasProblem={problem !== null}
        problemId={problemId}
        onBrowse={() => {
          inputRef.current?.click();
        }}
      />
      {isUploading && <p role="status">{t.photo.uploading}</p>}
      {problem !== null && (
        <p id={problemId} className={styles.problem}>
          <NoticeIcon name="circle-alert" />
          {PROBLEM_TEXT[problem]}
        </p>
      )}
      <p className={styles.help}>{t.photo.help}</p>
      {children}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";

import { readImageSize } from "./read-image-size";
import { checkPhotoDimensions, checkPhotoFile } from "../rules/photo-check";
import type { PhotoProblem } from "../rules/photo-check";

export interface PhotoChoice {
  /** The photo chosen and accepted, not sent yet. */
  readonly file: File | null;
  /** An address to show the chosen photo; released when the photo changes or the screen closes. */
  readonly previewUrl: string | null;
  readonly problem: PhotoProblem | null;
  readonly choose: (file: File) => void;
  readonly setProblem: (problem: PhotoProblem | null) => void;
}

/** The photo of the form: checked in the browser at once, the server stays the authority. */
export function usePhotoChoice(): PhotoChoice {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<PhotoProblem | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (file === null) {
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [file]);

  const choose = (candidate: File): void => {
    latest.current += 1;
    const turn = latest.current;
    const early = checkPhotoFile(candidate);
    if (early !== null) {
      setProblem(early);
      return;
    }
    void readImageSize(candidate).then((size) => {
      if (turn !== latest.current) {
        return;
      }
      const found = size === null ? "invalid" : checkPhotoDimensions(size);
      setProblem(found);
      if (found === null) {
        setFile(candidate);
      }
    });
  };

  return { file, previewUrl, problem, choose, setProblem };
}

import {useEffect, useState} from 'react';
import type {FC, FormEvent} from 'react';
import {Check, X} from 'lucide-react';
import type {HotLink} from '../../types/storage';
import styles from '../App.module.scss';

export interface LinkDraft {
  title: string;
  url: string;
}

interface LinkEditorProps {
  initialLink?: HotLink;
  onCancel: () => void;
  onSave: (draft: LinkDraft) => string | null;
  submitLabel: string;
  title: string;
}

export const LinkEditor: FC<LinkEditorProps> = ({
  initialLink,
  onCancel,
  onSave,
  submitLabel,
  title,
}) => {
  const [draft, setDraft] = useState<LinkDraft>({
    title: initialLink?.title ?? '',
    url: initialLink?.url ?? '',
  });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDraft({
      title: initialLink?.title ?? '',
      url: initialLink?.url ?? '',
    });
    setErrorMessage('');
  }, [initialLink]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const nextErrorMessage = onSave(draft);

    if (nextErrorMessage) {
      setErrorMessage(nextErrorMessage);
      return;
    }

    setErrorMessage('');
  };

  return (
    <form className={styles.linkEditor} onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <div className={styles.editorGrid}>
        <label>
          <span>Title</span>
          <input
            type="text"
            value={draft.title}
            onChange={(event): void => {
              setDraft((currentDraft): LinkDraft => {
                return {
                  ...currentDraft,
                  title: event.target.value,
                };
              });
            }}
            placeholder="GitHub"
            autoComplete="off"
          />
        </label>
        <label>
          <span>URL</span>
          <input
            type="text"
            inputMode="url"
            value={draft.url}
            onChange={(event): void => {
              setDraft((currentDraft): LinkDraft => {
                return {
                  ...currentDraft,
                  url: event.target.value,
                };
              });
            }}
            placeholder="https://github.com"
            autoComplete="off"
          />
        </label>
        <div className={styles.editorActions}>
          <button
            type="submit"
            className={styles.iconButton}
            aria-label={submitLabel}
            title={submitLabel}
          >
            <Check size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onCancel}
            aria-label="Cancel"
            title="Cancel"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      {errorMessage && <p className={styles.formError}>{errorMessage}</p>}
    </form>
  );
};

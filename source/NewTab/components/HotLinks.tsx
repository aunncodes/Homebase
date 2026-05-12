import {useState} from 'react';
import type {FC} from 'react';
import {Plus, SlidersHorizontal} from 'lucide-react';
import type {HotLink} from '../../types/storage';
import {HotLinkCard} from './HotLinkCard';
import {LinkEditor} from './LinkEditor';
import type {LinkDraft} from './LinkEditor';
import styles from '../App.module.scss';

interface HotLinksProps {
  links: HotLink[];
  onAddLink: (draft: LinkDraft) => string | null;
  onDeleteLink: (linkId: string) => void;
  onUpdateLink: (linkId: string, draft: LinkDraft) => string | null;
}

export const HotLinks: FC<HotLinksProps> = ({
  links,
  onAddLink,
  onDeleteLink,
  onUpdateLink,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const editingLink = links.find((link) => link.id === editingLinkId);

  const handleCreate = (draft: LinkDraft): string | null => {
    const errorMessage = onAddLink(draft);

    if (!errorMessage) {
      setIsAdding(false);
    }

    return errorMessage;
  };

  const handleUpdate = (draft: LinkDraft): string | null => {
    if (!editingLink) {
      return null;
    }

    const errorMessage = onUpdateLink(editingLink.id, draft);

    if (!errorMessage) {
      setEditingLinkId(null);
    }

    return errorMessage;
  };

  return (
    <section className={styles.hotLinks} aria-labelledby="hot-links-title">
      <div className={styles.sectionHeader}>
        <h2 id="hot-links-title" className={styles.kicker}>
          Quick launch
        </h2>
        <div className={styles.headerActions}>
          {isManaging && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={(): void => {
                setEditingLinkId(null);
                setIsAdding(true);
              }}
              aria-label="Add link"
              title="Add link"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconButton} ${
              isManaging ? styles.iconButtonActive : ''
            }`}
            onClick={(): void => {
              setIsManaging((currentValue): boolean => !currentValue);
              setIsAdding(false);
              setEditingLinkId(null);
            }}
            aria-label={isManaging ? 'Close link controls' : 'Manage links'}
            aria-pressed={isManaging}
            title={isManaging ? 'Close link controls' : 'Manage links'}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isManaging && isAdding && (
        <LinkEditor
          submitLabel="Save new link"
          title="New link"
          onCancel={(): void => setIsAdding(false)}
          onSave={handleCreate}
        />
      )}

      {isManaging && editingLink && (
        <LinkEditor
          initialLink={editingLink}
          submitLabel="Save link"
          title="Edit link"
          onCancel={(): void => setEditingLinkId(null)}
          onSave={handleUpdate}
        />
      )}

      <div className={styles.linkGrid}>
        {links.map((link) => (
          <HotLinkCard
            key={link.id}
            link={link}
            isManaging={isManaging}
            onDelete={(): void => onDeleteLink(link.id)}
            onEdit={(): void => {
              setIsAdding(false);
              setEditingLinkId(link.id);
            }}
          />
        ))}
      </div>

      {links.length === 0 && (
        <div className={styles.emptyState}>
          <p>No hot links yet.</p>
          <button
            type="button"
            className={styles.iconButton}
            onClick={(): void => {
              setIsManaging(true);
              setIsAdding(true);
            }}
            aria-label="Add first link"
            title="Add first link"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
};

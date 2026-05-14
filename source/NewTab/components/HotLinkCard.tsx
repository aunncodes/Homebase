import type { FC } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { HotLink } from "../../types/storage";
import styles from "../App.module.scss";

interface HotLinkCardProps {
	isManaging: boolean;
	link: HotLink;
	onDelete: () => void;
	onEdit: () => void;
}

function getHostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function getInitial(title: string): string {
	return title.trim().charAt(0).toUpperCase() || "H";
}

function getFaviconUrl(url: string): string | null {
	try {
		const hostname = new URL(url).hostname;

		return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
	} catch {
		return null;
	}
}

export const HotLinkCard: FC<HotLinkCardProps> = ({ isManaging, link, onDelete, onEdit }) => {
	const hostname = getHostname(link.url);
	const faviconUrl = link.iconUrl || getFaviconUrl(link.url);
	const iconClassName = faviconUrl ? `${styles.linkIcon} ${styles.linkIconWithImage}` : styles.linkIcon;

	return (
		<article className={styles.linkCard}>
			<a className={styles.linkTarget} href={link.url}>
				<span className={iconClassName} aria-hidden="true">
					{faviconUrl ? <img src={faviconUrl} alt="" loading="lazy" /> : getInitial(link.title)}
				</span>

				<span className={styles.linkText}>
					<strong>{link.title}</strong>
					<span>{hostname}</span>
				</span>
			</a>

			{isManaging && (
				<div className={styles.cardActions}>
					<button type="button" className={styles.iconButton} onClick={onEdit} aria-label={`Edit ${link.title}`} title={`Edit ${link.title}`}>
						<Pencil size={16} aria-hidden="true" />
					</button>

					<button type="button" className={`${styles.iconButton} ${styles.iconButtonDanger}`} onClick={onDelete} aria-label={`Delete ${link.title}`} title={`Delete ${link.title}`}>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				</div>
			)}
		</article>
	);
};

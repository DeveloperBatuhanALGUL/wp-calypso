import moment from 'moment';
import Notice from 'calypso/components/notice';
import { isPartnerPurchase } from 'calypso/lib/purchases';
import { getTopNoticeCopy } from './get-confirmation-copy';
import type { Purchases } from '@automattic/data-stores';
interface TimeRemainingNoticeProps {
	purchase: Purchases.Purchase;
	displayVariant: 'cancel' | 'remove' | 'auto-renew';
	intent: 'cancel' | 'remove' | 'auto-renew' | null;
}

export default function TimeRemainingNotice( {
	purchase,
	displayVariant,
	intent,
}: TimeRemainingNoticeProps ) {
	if ( displayVariant === 'remove' ) {
		return null;
	}
	if ( isPartnerPurchase( purchase ) || ! purchase.expiryDate ) {
		return null;
	}
	if ( moment( purchase.expiryDate ).isSameOrBefore( moment(), 'day' ) ) {
		return null;
	}

	const copy = getTopNoticeCopy( { purchase, intent: intent ?? 'cancel' } );
	if ( ! copy ) {
		return null;
	}

	return (
		<Notice
			className="cancel-purchase__time-remaining-notice"
			showDismiss={ false }
			status="is-info"
		>
			{ copy }
		</Notice>
	);
}

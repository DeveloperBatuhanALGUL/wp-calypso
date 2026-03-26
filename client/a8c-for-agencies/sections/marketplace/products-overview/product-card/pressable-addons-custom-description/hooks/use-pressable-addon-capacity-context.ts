import { formatNumber } from '@automattic/number-formatters';
import { useMemo } from 'react';
import useGetPressablePlan from 'calypso/a8c-for-agencies/sections/marketplace/pressable-overview/hooks/use-get-pressable-plan';

export type PressableAddonType = 'sites' | 'storage' | 'visits' | 'unknown';

export type PressableAddonCapacityCopyContext = {
	type: PressableAddonType;
	install: number;
	storage: number;
	visits: number;
	formattedInstall: string;
	formattedStorage: string;
	formattedVisits: string;
};

export function getPressableAddonType( productSlug: string ): PressableAddonType {
	if ( productSlug.startsWith( 'pressable-addon-sites-' ) ) {
		return 'sites';
	}

	if ( productSlug.startsWith( 'pressable-addon-storage-' ) ) {
		return 'storage';
	}

	if ( productSlug.startsWith( 'pressable-addon-visits-' ) ) {
		return 'visits';
	}

	return 'unknown';
}

export default function usePressableAddonCapacityContext( productSlug: string ) {
	const getPressablePlan = useGetPressablePlan();
	const plan = getPressablePlan( productSlug );

	return useMemo( () => {
		if ( ! plan ) {
			return null;
		}
		const type = getPressableAddonType( productSlug );

		return {
			type,
			install: plan.install,
			storage: plan.storage,
			visits: plan.visits,
			formattedInstall: formatNumber( plan.install ),
			formattedStorage: `${ formatNumber( plan.storage ) } GB`,
			formattedVisits: formatNumber( plan.visits ),
		};
	}, [ plan, productSlug ] );
}

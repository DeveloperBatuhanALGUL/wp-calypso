import { isDomainMoveInternal } from '@automattic/calypso-products';
import { useQuery } from '@tanstack/react-query';
import { addAvailabilityAsSuggestion } from '../helpers/add-availability-as-suggestion';
import { useDomainSearch } from '../page/context';
import type { DomainSuggestion } from '@automattic/api-core';

export enum DomainPriceRule {
	ONE_TIME_PRICE = 'ONE_TIME_PRICE',
	HIDE_PRICE = 'HIDE_PRICE',
	FREE_FOR_FIRST_YEAR = 'FREE_FOR_FIRST_YEAR',
	PRICE = 'PRICE',
	DOMAIN_MOVE_PRICE = 'DOMAIN_MOVE_PRICE',
}

export interface PriceRulesConfig {
	hidePrice?: boolean;
	oneTimePrice?: boolean;
	freeForFirstYear?: boolean;
}

const getPriceRuleForSuggestion = ( {
	suggestion,
	priceRules,
}: {
	suggestion: DomainSuggestion;
	priceRules: PriceRulesConfig;
} ) => {
	if ( priceRules.hidePrice ) {
		return DomainPriceRule.HIDE_PRICE;
	}

	if ( priceRules.oneTimePrice ) {
		return DomainPriceRule.ONE_TIME_PRICE;
	}

	if ( isDomainMoveInternal( suggestion ) ) {
		return DomainPriceRule.DOMAIN_MOVE_PRICE;
	}

	if ( suggestion.is_premium ) {
		return DomainPriceRule.PRICE;
	}

	if ( priceRules.freeForFirstYear ) {
		return DomainPriceRule.FREE_FOR_FIRST_YEAR;
	}

	return DomainPriceRule.PRICE;
};

export const useSuggestion = ( domainName: string ) => {
	const { query, queries, config, events } = useDomainSearch();

	const { data: fqdnAvailability } = useQuery( {
		...queries.domainAvailability( domainName ),
	} );

	const { data: mainSuggestions } = useQuery( {
		...queries.domainSuggestions( query ),
	} );

	// Flows with config.promotedTlds fire a secondary suggestions query to
	// guarantee commerce-native TLDs appear. Domains from that query have to
	// be resolvable here too, otherwise downstream components crash when they
	// try to render a promoted suggestion the main cache doesn't know about.
	const { data: promotedSuggestions } = useQuery( {
		...queries.promotedDomainSuggestions( query ),
	} );

	const suggestions: DomainSuggestion[] | undefined = ( () => {
		if ( ! mainSuggestions ) {
			return undefined;
		}
		if ( ! promotedSuggestions?.length ) {
			return mainSuggestions;
		}
		const seen = new Set( mainSuggestions.map( ( s ) => s.domain_name ) );
		const extras = promotedSuggestions.filter( ( s ) => ! seen.has( s.domain_name ) );
		return extras.length > 0 ? [ ...mainSuggestions, ...extras ] : mainSuggestions;
	} )();

	if ( suggestions && fqdnAvailability ) {
		addAvailabilityAsSuggestion( suggestions, fqdnAvailability );
	}

	if ( suggestions ) {
		const suggestionPosition = suggestions.findIndex(
			( suggestion ) => suggestion.domain_name === domainName
		);

		if ( suggestionPosition === -1 ) {
			events.onSuggestionNotFound( domainName );
			throw new Error( `Suggestion not found for domain: ${ domainName }` );
		}

		const suggestion = suggestions[ suggestionPosition ];

		return {
			...suggestion,
			position: suggestionPosition,
			price_rule: getPriceRuleForSuggestion( { suggestion, priceRules: config.priceRules } ),
		};
	}

	throw new Error( `Suggestion not found for domain: ${ domainName }` );
};

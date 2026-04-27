import { type DomainAvailability, DomainAvailabilityStatus } from '@automattic/api-core';
import { DefinedUseQueryResult, useQueries, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
	getTld,
	isFreeSubdomainQuery,
	isWpcomSubdomainQuery,
	stripWpcomSubdomainSuffix,
} from '../helpers';
import { addAvailabilityAsSuggestion } from '../helpers/add-availability-as-suggestion';
import { isSupportedPremiumDomain } from '../helpers/is-supported-premium-domain';
import { partitionSuggestions } from '../helpers/partition-suggestions';
import { useDomainSearch } from '../page/context';

const hasDataAndIsSupportedPremiumDomain = (
	result: UseQueryResult< DomainAvailability, Error >
): result is DefinedUseQueryResult< DomainAvailability, Error > => {
	return !! result.data && isSupportedPremiumDomain( result.data );
};

const availablePremiumDomainsCombinator = (
	results: UseQueryResult< DomainAvailability, Error >[]
) => {
	return {
		isLoadingAvailablePremiumDomains: results.some( ( result ) => result.isLoading ),
		availablePremiumDomains: results
			.filter( hasDataAndIsSupportedPremiumDomain )
			.map( ( { data: availabilityQuery } ) => availabilityQuery.domain_name ),
	};
};

export const useSuggestionsList = () => {
	const { query, queries, config } = useDomainSearch();

	const isFreeSubdomain = isFreeSubdomainQuery( query );
	const freeSuggestionQuery = isWpcomSubdomainQuery( query )
		? stripWpcomSubdomainSuffix( query )
		: query;

	const { data: mainSuggestions = [], isLoading: isLoadingSuggestions } = useQuery( {
		...queries.domainSuggestions( query ),
		enabled: true,
	} );

	// Secondary query: ask the API directly for suggestions in the configured
	// `promotedTlds`, so commerce-native TLDs are guaranteed to appear even when
	// the main query's natural suggestion set didn't include them. Opt-in per flow.
	const hasPromotedTlds = ( config.promotedTlds?.length ?? 0 ) > 0;
	const { data: promotedSuggestions = [], isLoading: isLoadingPromotedSuggestions } = useQuery( {
		...queries.promotedDomainSuggestions( query ),
		enabled: hasPromotedTlds && query.length > 0,
	} );

	const suggestions = useMemo( () => {
		if ( ! hasPromotedTlds || promotedSuggestions.length === 0 ) {
			return mainSuggestions;
		}
		const seen = new Set( mainSuggestions.map( ( s ) => s.domain_name ) );
		const extras = promotedSuggestions.filter( ( s ) => ! seen.has( s.domain_name ) );
		return extras.length > 0 ? [ ...mainSuggestions, ...extras ] : mainSuggestions;
	}, [ mainSuggestions, promotedSuggestions, hasPromotedTlds ] );

	const isFqdnQuery = ! isFreeSubdomain && !! getTld( query );

	const { isLoading: isLoadingFreeSuggestion } = useQuery( {
		...queries.freeSuggestion( freeSuggestionQuery ),
		enabled: config.skippable && ! isFqdnQuery,
	} );

	const { isLoading: isLoadingQueryAvailability, data: fqdnAvailability } = useQuery( {
		...queries.domainAvailability( query ),
		enabled: isFqdnQuery,
	} );

	const premiumSuggestions = useMemo(
		() =>
			suggestions
				.filter( ( suggestion ) => suggestion.is_premium )
				.map( ( suggestion ) => suggestion.domain_name ),
		[ suggestions ]
	);

	const availabilityResults = useQueries( {
		queries: premiumSuggestions.map( ( suggestion ) => ( {
			...queries.domainAvailability( suggestion ),
			enabled: true,
		} ) ),
	} );

	const { isLoadingAvailablePremiumDomains, availablePremiumDomains } = useMemo(
		() => availablePremiumDomainsCombinator( availabilityResults ),
		[ availabilityResults ]
	);

	const isLoading =
		isLoadingSuggestions ||
		isLoadingPromotedSuggestions ||
		isLoadingFreeSuggestion ||
		isLoadingQueryAvailability ||
		isLoadingAvailablePremiumDomains;

	const { featuredSuggestions, regularSuggestions } = useMemo( () => {
		if ( suggestions && fqdnAvailability && query === fqdnAvailability.domain_name ) {
			addAvailabilityAsSuggestion( suggestions, fqdnAvailability );
		}

		const filteredSuggestions = suggestions
			.filter( ( { domain_name: suggestion, is_premium } ) => {
				if ( suggestion !== query ) {
					return ! is_premium || availablePremiumDomains.includes( suggestion );
				}

				if ( ! fqdnAvailability ) {
					return false;
				}

				if (
					fqdnAvailability.status === DomainAvailabilityStatus.AVAILABLE ||
					( config.includeOwnedDomainInSuggestions &&
						fqdnAvailability.status === DomainAvailabilityStatus.REGISTERED_OTHER_SITE_SAME_USER )
				) {
					return true;
				}

				return isSupportedPremiumDomain( fqdnAvailability );
			} )
			.map( ( suggestion ) => suggestion.domain_name );

		// Three-tier pre-sort before partitioning:
		//   1. Super-priority: the query's canonical .com (query stripped of
		//      whitespace/special chars + .com). An exact .com match is the
		//      strongest signal of user intent and outranks even promoted TLDs.
		//   2. Promoted TLDs, in the order given by config.promotedTlds.
		//   3. Neutral TLDs (neither promoted nor deemphasized), original order.
		//   4. Deemphasized TLDs sunk to the bottom, original order.
		// This ensures the full list is still visible via "show more" — nothing is
		// filtered out, only reordered.
		const promotedTlds = config.promotedTlds ?? [];
		const deemphasizedTlds = config.deemphasizedTlds ?? [];
		const canonicalCom = `${ query.toLowerCase().replace( /[^a-z0-9-]/g, '' ) }.com`;
		const getRankingTier = ( suggestion: string ): number => {
			if ( suggestion === canonicalCom ) {
				return Number.NEGATIVE_INFINITY;
			}
			const tld = getTld( suggestion );
			const promotedIndex = promotedTlds.indexOf( tld );
			if ( promotedIndex !== -1 ) {
				// Negative tier so promoted always beats neutral (0); preserves promotedTlds order.
				return promotedIndex - promotedTlds.length;
			}
			if ( deemphasizedTlds.includes( tld ) ) {
				return 1;
			}
			return 0;
		};
		const hasTldRanking = promotedTlds.length > 0 || deemphasizedTlds.length > 0;
		const sortedSuggestions = hasTldRanking
			? [ ...filteredSuggestions ].sort( ( a, b ) => getRankingTier( a ) - getRankingTier( b ) )
			: filteredSuggestions;

		return partitionSuggestions( {
			suggestions: sortedSuggestions,
			query,
			deemphasizedTlds: config.deemphasizedTlds,
		} );
	}, [
		suggestions,
		query,
		config.deemphasizedTlds,
		config.promotedTlds,
		availablePremiumDomains,
		fqdnAvailability,
		config.includeOwnedDomainInSuggestions,
	] );

	return {
		isLoading,
		featuredSuggestions,
		regularSuggestions,
	};
};

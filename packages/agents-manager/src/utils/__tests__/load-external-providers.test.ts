/**
 * @jest-environment jsdom
 */
import { loadExternalProviders, mergeUseSuggestionsHooks } from '../load-external-providers';
import type { UseSuggestionsHook } from '../load-external-providers';

describe( 'loadExternalProviders', () => {
	afterEach( () => {
		delete ( globalThis as typeof globalThis & { agentsManagerData?: unknown } ).agentsManagerData;
		delete ( window as typeof window & { agentsManagerData?: unknown } ).agentsManagerData;
	} );

	it( 'does not merge external editor providers into Reader Chat', async () => {
		const agentsManagerData = {
			agentId: 'reader-chat',
			agentProviders: [ 'https://widgets.wp.com/agents-manager/jetpack-ai-sidebar.provider.mjs' ],
		};
		( globalThis as typeof globalThis & { agentsManagerData?: unknown } ).agentsManagerData =
			agentsManagerData;
		( window as typeof window & { agentsManagerData?: unknown } ).agentsManagerData =
			agentsManagerData;

		const providers = await loadExternalProviders();

		expect( providers.toolProvider ).toBeUndefined();
		expect( providers.contextProvider ).toBeUndefined();
		expect( providers.useSuggestions ).toEqual( expect.any( Function ) );
	} );
} );

describe( 'mergeUseSuggestionsHooks', () => {
	it( 'treats undefined provider hook results as no suggestions', () => {
		const undefinedHook = jest.fn( () => undefined ) as UseSuggestionsHook;
		const suggestionsHook = jest.fn( () => ( {
			suggestions: [ { id: 'reader-followup', label: 'Follow up', prompt: 'Follow up on this.' } ],
		} ) ) as UseSuggestionsHook;

		const merged = mergeUseSuggestionsHooks( [ undefinedHook, suggestionsHook ] );

		expect( merged?.() ).toEqual( {
			suggestions: [ { id: 'reader-followup', label: 'Follow up', prompt: 'Follow up on this.' } ],
		} );
	} );

	it( 'dedupes suggestions by id when multiple providers return suggestions', () => {
		const firstHook = jest.fn( () => ( {
			suggestions: [
				{ id: 'shared', label: 'First shared', prompt: 'First shared prompt.' },
				{ id: 'first-only', label: 'First only', prompt: 'First only prompt.' },
			],
		} ) ) as UseSuggestionsHook;
		const secondHook = jest.fn( () => ( {
			suggestions: [
				{ id: 'shared', label: 'Second shared', prompt: 'Second shared prompt.' },
				{ id: 'second-only', label: 'Second only', prompt: 'Second only prompt.' },
			],
		} ) ) as UseSuggestionsHook;

		const merged = mergeUseSuggestionsHooks( [ firstHook, secondHook ] );

		expect( merged?.() ).toEqual( {
			suggestions: [
				{ id: 'shared', label: 'First shared', prompt: 'First shared prompt.' },
				{ id: 'first-only', label: 'First only', prompt: 'First only prompt.' },
				{ id: 'second-only', label: 'Second only', prompt: 'Second only prompt.' },
			],
		} );
	} );
} );

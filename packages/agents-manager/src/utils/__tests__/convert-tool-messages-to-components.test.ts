import ButtonPicker from '../../components/button-picker';
import ColorPicker from '../../components/color-picker';
import { EscalationButton } from '../../components/escalation-button';
import FontPicker from '../../components/font-picker';
import NextStepButton from '../../components/next-step-button';
import PatternPicker from '../../components/pattern-picker';
import UnavailableToolMessage from '../../components/unavailable-tool-message';
import convertToolMessagesToComponents from '../convert-tool-messages-to-components';
import isAmAbilitiesEnabled from '../is-am-abilities-enabled';
import { isEditorPage } from '../is-editor-page';
import type { UIMessage } from '@automattic/agenttic-client';

jest.mock(
	'@automattic/components',
	() => ( {
		SummaryButton: () => null,
		FoldableCard: () => null,
	} ),
	{ virtual: true }
);
jest.mock( '../is-editor-page' );
jest.mock( '../is-am-abilities-enabled' );
jest.mock( '../../components/button-picker', () => ( { __esModule: true, default: jest.fn() } ) );
jest.mock( '../../components/color-picker', () => ( { __esModule: true, default: jest.fn() } ) );
jest.mock( '../../components/escalation-button', () => ( { EscalationButton: jest.fn() } ) );
jest.mock( '../../components/font-picker', () => ( { __esModule: true, default: jest.fn() } ) );
jest.mock( '../../components/next-step-button', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );
jest.mock( '../../components/pattern-picker', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );
jest.mock( '../../components/unavailable-tool-message', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );

const MockComponent = jest.fn();
const mockOnSubmit = jest.fn();

const convertWithDefaults = (
	options: Omit< Parameters< typeof convertToolMessagesToComponents >[ 0 ], 'onSubmit' >
) => convertToolMessagesToComponents( { ...options, onSubmit: mockOnSubmit } );

const createMessage = ( overrides: Partial< UIMessage > = {} ): UIMessage =>
	( {
		id: 'msg-1',
		role: 'agent',
		content: [ { type: 'text', text: 'Hello' } ],
		...overrides,
	} ) as UIMessage;

const createToolMessage = (
	toolId: string,
	data?: object | string,
	overrides?: Partial< UIMessage >
): UIMessage =>
	createMessage( {
		content: [ { type: 'text', text: JSON.stringify( { tool_id: toolId, data } ) } ],
		...overrides,
	} );

describe( 'convertToolMessagesToComponents', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		( isEditorPage as jest.Mock ).mockReturnValue( true );
		( isAmAbilitiesEnabled as jest.Mock ).mockReturnValue( false );
	} );

	it( 'passes through user messages unchanged', () => {
		const message = createMessage( { role: 'user' } );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toEqual( [ message ] );
	} );

	it( 'passes through plain-text agent messages unchanged', () => {
		const message = createMessage( {
			content: [ { type: 'text', text: 'Hello, how can I help?' } ],
		} );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toEqual( [ message ] );
	} );

	it( 'renders tool messages as components', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			props: { name: 'test' },
			isCurrent: true,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			type: 'component',
			component: MockComponent,
			componentProps: { name: 'test', contentType: 'my-component' },
		} );
	} );

	it( 'filters out unregistered components', () => {
		const message = createToolMessage( 'big_sky__show_component', { type: 'unknown-component' } );
		const getChatComponent = jest.fn().mockReturnValue( null );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
		} );

		expect( result ).toEqual( [] );
	} );

	it( 'appends `NextStepButton` with `onSubmit` as `onMoveToNextStep` only to the last active message with follow-up tasks', () => {
		const data = { type: 'my-component', followUpTasks: true, isCurrent: true };
		const actions = [
			{ id: 'action-1', label: 'Do something', onClick: jest.fn() },
		] as UIMessage[ 'actions' ];
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [
				createToolMessage( 'big_sky__show_component', data, { id: 'msg-1', actions } ),
				createToolMessage( 'big_sky__show_component', data, { id: 'msg-2', actions } ),
			],
			getChatComponent,
		} );

		expect( result ).toHaveLength( 3 );
		expect( result[ 0 ].id ).toBe( 'msg-1' );
		expect( result[ 1 ].id ).toBe( 'msg-2' );
		expect( result[ 2 ].id ).toBe( 'msg-2-next-step' );
		expect( result[ 2 ].content[ 0 ] ).toMatchObject( {
			type: 'component',
			component: NextStepButton,
			componentProps: { onMoveToNextStep: mockOnSubmit },
		} );
		expect( result[ 2 ].actions ).toBeUndefined();
	} );

	it( 'renders `UnavailableToolMessage` when not on an editor page', () => {
		( isEditorPage as jest.Mock ).mockReturnValue( false );
		const message = createToolMessage( 'big_sky__show_component', { type: 'my-component' } );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			type: 'component',
			component: UnavailableToolMessage,
			componentProps: { type: 'picker' },
		} );
	} );

	it( 'renders `UnavailableToolMessage` for the start-over tool', () => {
		const message = createToolMessage( 'big_sky__client_assistants', {
			assistantId: 'big-sky-site-admin',
		} );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			type: 'component',
			component: UnavailableToolMessage,
			componentProps: { type: 'start-over' },
		} );
	} );

	it( 'renders support tool data as plain text', () => {
		const supportText = 'Here is some help for your domain question.';
		const message = createToolMessage( 'big_sky__wordpress_com_support', supportText );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			type: 'text',
			text: supportText,
		} );
	} );

	it( 'renders apply-block-edits tool summary as plain text', () => {
		const summaryText = 'Updated the heading and added a new paragraph.';
		const message = createToolMessage( 'big_sky__apply_block_edits', {
			summary: summaryText,
			calypsoCheckpointId: 'checkpoint-1',
		} );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			type: 'text',
			text: summaryText,
		} );
	} );

	it( 'renders `EscalationButton` when `forward_to_human_support` flag is set', () => {
		const message = createMessage( {
			content: [
				{ type: 'text', text: 'Hello' },
				{
					type: 'data',
					data: { flags: { forward_to_human_support: true } },
				},
			],
		} );

		const result = convertWithDefaults( {
			messages: [ message ],
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			type: 'component',
			component: EscalationButton,
		} );
	} );

	it( 'filters out unhandled tool messages', () => {
		const result = convertWithDefaults( {
			messages: [ createToolMessage( 'other_tool' ) ],
		} );

		expect( result ).toEqual( [] );
	} );

	it( 'disables component when `isCurrent` is false', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			isCurrent: false,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ] ).toMatchObject( { disabled: true } );
	} );

	it( 'does not append `NextStepButton` when `isCurrent` is false', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			followUpTasks: true,
			isCurrent: false,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			component: MockComponent,
		} );
	} );

	it( 'disables component when `postId` differs from `currentPostId`', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			isCurrent: true,
			postId: 10,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
			currentPostId: 20,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ] ).toMatchObject( { disabled: true } );
	} );

	it( 'does not append `NextStepButton` when `postId` differs from `currentPostId`', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			followUpTasks: true,
			isCurrent: true,
			postId: 10,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
			currentPostId: 20,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
			component: MockComponent,
		} );
	} );

	it( 'does not disable component when `postId` matches `currentPostId`', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			isCurrent: true,
			postId: 10,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
			currentPostId: 10,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ] ).toMatchObject( { disabled: false } );
	} );

	it( 'does not disable component when `postId` is missing from the tool message', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			isCurrent: true,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
			currentPostId: 20,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ] ).toMatchObject( { disabled: false } );
	} );

	it( 'does not disable component when `currentPostId` is undefined', () => {
		const message = createToolMessage( 'big_sky__show_component', {
			type: 'my-component',
			isCurrent: true,
			postId: 10,
		} );
		const getChatComponent = jest.fn().mockReturnValue( MockComponent );

		const result = convertWithDefaults( {
			messages: [ message ],
			getChatComponent,
		} );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ] ).toMatchObject( { disabled: false } );
	} );

	describe( 'AM path', () => {
		beforeEach( () => {
			( isAmAbilitiesEnabled as jest.Mock ).mockReturnValue( true );
		} );

		it.each( [
			[ 'button-picker', ButtonPicker ],
			[ 'color-picker', ColorPicker ],
			[ 'font-picker', FontPicker ],
			[ 'pattern-picker', PatternPicker ],
		] )( 'resolves %s to its AM component', ( type, expected ) => {
			const message = createToolMessage( 'big_sky__show_component', {
				type,
				props: { variations: [] },
				isCurrent: true,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
			} );

			expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
				type: 'component',
				component: expected,
			} );
		} );

		it( 'passes props without `contentType`', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'color-picker',
				props: { variations: [ { title: 'Bold' } ] },
				isCurrent: true,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
			} );

			expect( result[ 0 ].content[ 0 ].componentProps ).toEqual( {
				variations: [ { title: 'Bold' } ],
			} );
		} );

		it( 'drops unknown component types', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'unknown',
				props: {},
				isCurrent: true,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
			} );

			expect( result ).toEqual( [] );
		} );

		it( 'does not call `getChatComponent`', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'color-picker',
				props: { variations: [] },
				isCurrent: true,
			} );
			const getChatComponent = jest.fn().mockReturnValue( jest.fn() );

			convertWithDefaults( {
				messages: [ message ],
				getChatComponent,
			} );

			expect( getChatComponent ).not.toHaveBeenCalled();
		} );

		it( 'appends `NextStepButton` with `onSubmit` as `onMoveToNextStep` for follow-up tasks and omits `actions`', () => {
			const data = {
				type: 'font-picker',
				props: { variations: [] },
				followUpTasks: true,
				isCurrent: true,
			};
			const actions = [
				{ id: 'action-1', label: 'Do something', onClick: jest.fn() },
			] as UIMessage[ 'actions' ];

			const result = convertWithDefaults( {
				messages: [ createToolMessage( 'big_sky__show_component', data, { actions } ) ],
			} );

			expect( result ).toHaveLength( 2 );
			expect( result[ 0 ].actions ).toBeDefined();
			expect( result[ 1 ].id ).toBe( 'msg-1-next-step' );
			expect( result[ 1 ].actions ).toBeUndefined();
			expect( result[ 1 ].content[ 0 ] ).toMatchObject( {
				component: NextStepButton,
				componentProps: { onMoveToNextStep: mockOnSubmit },
			} );
		} );

		it( 'renders `UnavailableToolMessage` when not on an editor page', () => {
			( isEditorPage as jest.Mock ).mockReturnValue( false );
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'color-picker',
				props: {},
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
			} );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ].content[ 0 ] ).toMatchObject( {
				type: 'component',
				component: UnavailableToolMessage,
				componentProps: { type: 'picker' },
			} );
		} );

		it( 'appends next-step-button only to the last active message', () => {
			const data = {
				type: 'color-picker',
				props: { variations: [] },
				followUpTasks: true,
				isCurrent: true,
			};

			const result = convertWithDefaults( {
				messages: [
					createToolMessage( 'big_sky__show_component', data, { id: 'msg-1' } ),
					createToolMessage( 'big_sky__show_component', data, { id: 'msg-2' } ),
				],
			} );

			expect( result.map( ( m ) => m.id ) ).toEqual( [ 'msg-1', 'msg-2', 'msg-2-next-step' ] );
		} );

		it( 'disables component when `isCurrent` is false', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'button-picker',
				props: { buttonVariations: [] },
				followUpTasks: true,
				isCurrent: false,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
			} );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ] ).toMatchObject( { disabled: true } );
		} );

		it( 'disables component when `postId` differs from `currentPostId`', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'button-picker',
				props: { buttonVariations: [] },
				followUpTasks: true,
				isCurrent: true,
				postId: 10,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
				currentPostId: 20,
			} );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ] ).toMatchObject( { disabled: true } );
		} );

		it( 'does not disable component when `postId` matches `currentPostId`', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'color-picker',
				props: { variations: [] },
				isCurrent: true,
				postId: 10,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
				currentPostId: 10,
			} );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ] ).toMatchObject( { disabled: false } );
		} );

		it( 'does not disable component when `postId` is missing from the tool message', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'color-picker',
				props: { variations: [] },
				isCurrent: true,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
				currentPostId: 20,
			} );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ] ).toMatchObject( { disabled: false } );
		} );

		it( 'does not disable component when `currentPostId` is undefined', () => {
			const message = createToolMessage( 'big_sky__show_component', {
				type: 'color-picker',
				props: { variations: [] },
				isCurrent: true,
				postId: 10,
			} );

			const result = convertWithDefaults( {
				messages: [ message ],
			} );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ] ).toMatchObject( { disabled: false } );
		} );
	} );
} );

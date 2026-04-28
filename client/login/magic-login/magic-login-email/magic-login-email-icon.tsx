import AsyncLoad from 'calypso/components/async-load';
import AppleIcon from 'calypso/components/social-icons/apple';

interface MagicLoginEmailIconProps {
	icon: string;
}

export function MagicLoginEmailIcon( { icon }: MagicLoginEmailIconProps ) {
	switch ( icon ) {
		case 'apple':
			return <AppleIcon />;
		case 'gmail':
			return (
				<AsyncLoad
					require={ () =>
						import(
							/* webpackChunkName: "async-load-calypso-components-social-icons-gmail" */ 'calypso/components/social-icons/gmail'
						)
					}
					placeholder={ null }
				/>
			);
		case 'outlook':
			return (
				<AsyncLoad
					require={ () =>
						import(
							/* webpackChunkName: "async-load-calypso-components-social-icons-outlook" */ 'calypso/components/social-icons/outlook'
						)
					}
					placeholder={ null }
				/>
			);
		case 'yahoo':
			return (
				<AsyncLoad
					require={ () =>
						import(
							/* webpackChunkName: "async-load-calypso-components-social-icons-yahoo" */ 'calypso/components/social-icons/yahoo'
						)
					}
					placeholder={ null }
				/>
			);
		case 'aol':
			return (
				<AsyncLoad
					require={ () =>
						import(
							/* webpackChunkName: "async-load-calypso-components-social-icons-aol" */ 'calypso/components/social-icons/aol'
						)
					}
					placeholder={ null }
				/>
			);
		default:
			return null;
	}
}

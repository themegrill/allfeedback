/**
 * Answer checks shared by the live widget and the builder preview.
 * Keep the email rule close to PHP's is_email(), which free uses on submit.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail( value: string ): boolean {
	return EMAIL_PATTERN.test( value.trim() );
}

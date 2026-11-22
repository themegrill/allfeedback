<?php
/**
 * Validate response data.
 *
 * @package AllFeedback\Application\Response\Pipes
 * @since   1.0.0
 */

declare(strict_types=1);

namespace AllFeedback\Application\Response\Pipes;

defined( 'ABSPATH' ) || exit;

use AllFeedback\Core\Exceptions\ValidationException;

/**
 * Pipeline stage: assert that the response payload contains at least one answer.
 *
 * @package AllFeedback\Application\Response\Pipes
 * @since   1.0.0
 */
class ValidateResponseData implements PipeInterface {

	/**
	 * Reject the submission when response_data is empty.
	 *
	 * @param  ResponseContext $context Shared pipeline context.
	 * @param  \Closure        $next    Next stage in the pipeline.
	 * @return mixed
	 * @throws ValidationException When response_data is empty.
	 * @since  1.0.0
	 */
	public function execute( ResponseContext $context, \Closure $next ): mixed {
		$data = $context->dto->response_data;

		if ( empty( $data ) ) {
			throw ValidationException::withErrors(
				[ 'response_data' => esc_html__( 'Response data cannot be empty.', 'allfeedback' ) ]
			);
		}

		$max_keys = max( 1, (int) apply_filters( 'allfeedback_response_max_keys', 100 ) );
		if ( count( $data ) > $max_keys ) {
			throw ValidationException::withErrors(
				[ 'response_data' => esc_html__( 'Response data contains too many fields.', 'allfeedback' ) ]
			);
		}

		$max_length = max( 1, (int) apply_filters( 'allfeedback_response_max_value_length', 5000 ) );
		array_walk_recursive(
			$data,
			function ( $value ) use ( $max_length ): void {
				if ( is_string( $value ) && mb_strlen( $value ) > $max_length ) {
					throw ValidationException::withErrors(
						[ 'response_data' => esc_html__( 'A response value exceeds the maximum allowed length.', 'allfeedback' ) ]
					);
				}
			}
		);

		// Email questions must hold a valid address; empty answers are handled by "required" in the widget.
		foreach ( (array) ( $context->survey->getFormSchema()['sections'] ?? [] ) as $section ) {
			foreach ( (array) ( $section['fields'] ?? [] ) as $field ) {
				if ( 'email' !== ( $field['type'] ?? '' ) ) {
					continue;
				}
				$value = $data[ (string) ( $field['id'] ?? '' ) ] ?? '';
				if ( is_string( $value ) && '' !== trim( $value ) && ! is_email( trim( $value ) ) ) {
					throw ValidationException::withErrors(
						[ 'response_data' => esc_html__( 'Please enter a valid email address.', 'allfeedback' ) ]
					);
				}
			}
		}

		return $next( $context );
	}
}
